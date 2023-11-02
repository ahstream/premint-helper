console.info('alphabotRafflePage.js begin', window?.location?.href);

import '../styles/alphabotPage.css';
import {
  createStatusbarButtons,
  exitActionMain,
  getMyTabIdFromExtension,
  checkIfSubscriptionEnabled,
  showNoSubscriptionStatusbar,
  removeDoneLinks,
  finishTask,
  finishUnlockedTwitterAccount,
  JOIN_BUTTON_TEXT,
  JOIN_BUTTON_IN_PROGRESS_TEXT,
  JOIN_BUTTON_TITLE,
  STATUSBAR_DEFAULT_TEXT,
} from './premintHelperLib';
import { createObserver, getPreviousWalletsWon } from './observer';
import { createHistory } from './history';
import { getPermissions } from './permissions';

import {
  createLogger,
  createLogLevelArg,
  getStorageItems,
  getStorageData,
  setStorageData,
  sleep,
  createHashArgs,
  waitForSelector,
  waitForTextContains,
  getElementByText,
  millisecondsAhead,
  noDuplicates,
  extractTwitterHandle,
  addPendingRequest,
  dispatch,
  normalizePendingLink,
  getTextContains,
  simulateClick,
  makeTwitterFollowIntentUrl,
  makeTwitterRetweetIntentUrl,
  makeTwitterLikeIntentUrl,
  isTwitterURL,
  ONE_SECOND,
  ONE_MINUTE,
} from 'hx-lib';
import { createStatusbar } from 'hx-statusbar';

const debug = createLogger();

// DATA ----------------------------------------------------------------------------------

let storage = null;

let pageState = {
  parentTabId: null,
  storageModified: false,
  action: '',
  pendingRequests: [],
  isRegistering: false,
  statusbar: null,
  history: null,
  lastURL: '',
  observer: null,
};

// STARTUP ----------------------------------------------------------------------------

runNow();

async function runNow() {
  await reloadStorage();

  if (!storage?.options) {
    console.info('Options missing, exit!');
    return;
  }

  if (!storage.options.ALPHABOT_ENABLE) {
    console.info('Disabled, exit!');
    return;
  }

  pageState.observer = await createObserver();

  window.addEventListener('load', onLoad);
  window.addEventListener('DOMContentLoaded', onLoad);
}

async function onLoad() {
  debug.log('onLoad');

  if (pageState.loaded) {
    debug.log('Page already loaded, ignore onLoad event!');
    return;
  }
  pageState.loaded = true;

  const hashArgs = createHashArgs(window.location.hash);

  pageState = {
    ...pageState,
    ...{
      hashArgs,
      parentTabId: hashArgs.getOne('id'),
      storageModified: false,
      action: hashArgs.getOne('action'),
      pendingRequests: [],
      isRegistering: false,
      statusbar: createStatusbar(STATUSBAR_DEFAULT_TEXT),
      history: await createHistory(),
      permissions: await getPermissions(),
      lastURL: window.location.href,
      finishedTabsIds: [],
    },
  };

  debug.log('pageState', pageState);

  runPage();
}

// EVENT HANDLERS ----------------------------------------------------------------------------------

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  debug.log('Received message:', request, sender);

  if (request.message === 'hekt-captcha-solved') {
    window.alert('hekt-captcha-solved in premint-helper');
  }

  if (request.cmd === 'finish') {
    return finishTask(request, sender, {
      pageState,
      exitAction,
      handleDiscordCaptcha,
      registerRaffle,
      options: storage.options,
    });
  }

  if (request.cmd === 'switchedToTwitterUser') {
    if (request.error) {
      pageState.abort = true;
      updateStatusbarError(`Cannot switch to Twitter user ${request.user}! Error msg: ${request.error}`);
      exitAction('abort');
    }
  }

  if (request.cmd === 'lockedTwitterAccount') {
    pageState.abort = true;
    exitAction('twitterLocked');
  }

  if (request.cmd === 'unlockedTwitterAccount') {
    return finishUnlockedTwitterAccount(request, sender, {
      pageState,
      exitAction,
      handleDiscordCaptcha,
      registerRaffle,
      options: storage.options,
    });
  }

  if (request.cmd === 'onHistoryStateUpdated') {
    debug.log('onHistoryStateUpdated in content');
    const lastURL = pageState.lastURL;
    const currentURL = window.location.href;
    pageState.lastURL = currentURL;
    if (currentURL.includes('?') && lastURL.includes('?')) {
      debug.log('Only search args changed, do not rerun page!');
    } else if (lastURL && currentURL !== lastURL) {
      debug.log('Page navigation, reload page!');
      window.location.reload();
    } else {
      debug.log('No new navigation, skip reload');
    }
  }

  if (request.cmd === 'getMyTabIdAsyncResponse') {
    pageState.myTabId = request.response;
  }

  sendResponse();
  return true;
});

// PAGE FUNCS ----------------------------------------------------------------------------------

async function runPage(runRaffle = false) {
  debug.log('runPage; runRaffle, pageState:', runRaffle, pageState);

  // debug.log('pageState:', JSON.stringify(pageState));

  pageState.statusbar.buttons(
    createStatusbarButtons({
      options: true,
      results: true,
      reveal: 'disabled',
      followers: 'disabled',
    })
  );

  if (!pageState.action) {
    await sleep(100);
    const request = await dispatch(window.location.href, 5 * 60);
    debug.log('dispatched request:', request);
    if (!request) {
      console.log('full storage when !dispatched:', await getStorageData());
    }
    pageState.request = request;
    pageState.action = request?.action;
  }

  if (pageState.action === 'shortcut') {
    pageState.isAutoStarted = true;
    runRaffle = true;
  }

  if (pageState.action === 'retryJoin') {
    pageState.isAutoStarted = true;
    runRaffle = true;
  }

  if (pageState.action === 'verifyAlphabotRaffle') {
    pageState.isAutoStarted = true;
    runRaffle = true;
  }

  if (!pageState.permissions?.enabled) {
    showNoSubscriptionStatusbar(pageState.statusbar.warn);
    runRaffle = false;
    pageState.isAutoStarted = false;
  }

  debug.log('runPage new state:', runRaffle, pageState);

  await showRafflePage(runRaffle);
}

// RAFFLE PAGE FUNCS -----------------------------------------------------------------------------------------

async function showRafflePage(runRaffle) {
  debug.log('showRafflePage', runRaffle);

  if (!storage.options.ALPHABOT_ENABLE) {
    return exitAction('alphabotDisabled');
  }

  await waitForRafflePageLoaded();

  addPreviouslyWonWallets();

  if (hasRegistered()) {
    return exitAction('alreadyRegistered');
  }

  await addQuickRegButton();

  if (!checkIfSubscriptionEnabled(pageState.permissions, false, pageState.statusbar.warn)) {
    return;
  }

  if (await shouldIgnore()) {
    return exitAction('ignoredRaffle');
  }

  waitForRegisteredMainLoop();

  await addQuickLinks();

  if (runRaffle) {
    runRafflePage();
  }
}

function addPreviouslyWonWallets() {
  const twitterLink = document.querySelector('a[data-action="option-twitter"]');
  if (!twitterLink) {
    return;
  }
  debug.log('twitterLink', twitterLink);

  const twitterHandle = extractTwitterHandle(twitterLink?.href);
  if (!twitterHandle) {
    return;
  }
  debug.log('twitterHandle', twitterHandle);

  const section = pageState.observer.createPreviousWonSection(twitterHandle, true, pageState.permissions);
  if (!section) {
    return;
  }
  debug.log('section', section);

  const tasksElem = getElementByText('Tasks', 'h5', { contains: true });
  if (!tasksElem) {
    console.error('Missing Tasks elem!');
    return;
  }
  debug.log('tasksElem', tasksElem);
  tasksElem.after(section);
}

async function waitForRafflePageLoaded() {
  debug.log('waitForRafflePageLoaded');

  const stopTime = millisecondsAhead(storage.options.ALPHABOT_WAIT_FOR_RAFFLE_PAGE_LOADED);
  while (Date.now() <= stopTime) {
    if (document.querySelector('[data-action="view-project-register"]')) {
      debug.log('Raffle page has loaded!');
      return true;
    }
    if (document.querySelector('[data-action="view-project-cancel-registration"]')) {
      debug.log('Raffle page has loaded!');
      return true;
    }
    await sleep(1000);
  }

  debug.log('Raffle page has NOT loaded!');
  return false;
}

async function runRafflePage() {
  debug.log('runRafflePage');

  if (!storage.options.ALPHABOT_ENABLE) {
    return exitAction('alphabotDisabled');
  }

  await waitForRafflePageLoaded();

  if (hasRegistered()) {
    return exitAction('alreadyRegistered');
  }

  const triggerElem = await waitForTextContains('mint wallet', '.MuiAlert-message', 10 * ONE_SECOND, 50);
  if (!triggerElem) {
    return exitAction('noRaffleTrigger');
  }
  debug.log('triggerElem:', triggerElem);

  await sleep(100);

  if (await shouldIgnore()) {
    return exitAction('ignoredRaffle');
  }

  const parentRegion = await waitForSelector(storage.options.ALPHABOT_REG_BTN_SEL, 60 * ONE_SECOND, 100);
  if (!parentRegion) {
    return exitAction('noRaffleTrigger');
  }
  debug.log('parentRegion:', parentRegion);

  joinRaffle();
}

async function joinRaffle() {
  debug.log('joinRaffle');

  if (!checkIfSubscriptionEnabled(pageState.permissions, true, pageState.statusbar.warn)) {
    return;
  }

  await reloadStorage();

  pageState.abort = false;

  updateStatusbarRunning('Fulfilling raffle tasks...');
  startQuickRegBtn();

  const reqs = getRequirements();
  debug.log('reqs', reqs);

  const skipDoneTasks = pageState.action === 'retryJoin' || storage.options.RAFFLE_SKIP_DONE_TASKS;
  const discordLinks = skipDoneTasks
    ? await removeDoneLinks(reqs.discordUser, reqs.discordLinks, pageState)
    : reqs.discordLinks;
  const twitterLinks = skipDoneTasks
    ? await removeDoneLinks(reqs.twitterUser, reqs.twitterLinks, pageState)
    : reqs.twitterLinks;

  const reqLinks = [...discordLinks, ...twitterLinks];
  debug.log('reqLinks', reqLinks);

  if (reqLinks.length) {
    await getMyTabIdFromExtension(pageState, 5000);
    if (!pageState.myTabId) {
      console.error('Invalid myTabId');
      return exitAction('invalidContext');
    }
  }

  if (discordLinks.length) {
    storage.runtime.pendingDiscordJoin = JSON.stringify(new Date());
    await setStorageData(storage);
  }

  reqLinks.forEach((link) => pageState.pendingRequests.push(normalizePendingLink(link)));
  debug.log('pageState.pendingRequests:', pageState.pendingRequests);

  pageState.twitterLinkSuffix = `#id=${pageState.myTabId}&user=${
    storage.options.RAFFLE_SWITCH_TWITTER_USER ? reqs.twitterUser : ''
  }&${createLogLevelArg()}`;

  for (let i = 0; i < reqLinks.length; i++) {
    if (pageState.abort) {
      return exitAction('abort');
    }
    const reqLink = reqLinks[i];
    const mustJoinWithRole = reqs.mustJoinWithRoleLinks.some((x) => x === reqLink);
    if (mustJoinWithRole) {
      pageState.haveRoleDiscordLink = true;
      pageState.roleDiscordLinks = pageState.roleDiscordLinks || [];
      pageState.roleDiscordLinks.push(reqLink);
      debug.log('pageState.haveRoleDiscordLink', pageState.haveRoleDiscordLink);
      debug.log('pageState.roleDiscordLinks', pageState.roleDiscordLinks);
    }

    const url = reqLink + pageState.twitterLinkSuffix;
    debug.log('Open URL:', url);

    const isTwitter = isTwitterURL(reqLink);
    const user = isTwitter ? reqs.twitterUser : reqs.discordUser;

    if (isTwitter) {
      pageState.twitterUser = reqs.twitterUser;
    }

    if (!isTwitter) {
      // Only add discord links to history at once; add twitter links when they are finished!
      await pageState.history.add(user, reqLink);
    }

    if (storage.options.RAFFLE_OPEN_LINKS_IN_FOREGROUND) {
      window.open(url, '_blank');
    } else {
      chrome.runtime.sendMessage({ cmd: 'openTab', url });
    }

    if (isTwitter && storage.options.TWITTER_OPEN_LINKS_IN_SEQUENCE) {
      console.log('Open rest of twitter links in sequence!');
      break;
    }

    if (i + 1 < reqLinks.length) {
      const delayMs = Math.round(
        isTwitter
          ? storage.options.RAFFLE_OPEN_TWITTER_LINK_DELAY
          : storage.options.RAFFLE_OPEN_TWITTER_LINK_DELAY / 2
      );
      await sleep(delayMs, null, 0.2);
    }
  }

  await pageState.history.save();

  await sleep(50, 100);

  if (!pageState.request?.retries) {
    waitForRegistered();
  }

  if (reqLinks.length === 0) {
    registerRaffle();
  }

  waitForRegistered();
}

// STATUSBAR FUNCS ----------------------------------------------------------------------------------

function updateStatusbar(content, className = null) {
  pageState.statusbar.text(content, className);
}

function updateStatusbarOk(content) {
  pageState.statusbar.ok(content);
}

function updateStatusbarError(content) {
  pageState.statusbar.error(content);
}

function updateStatusbarInfo(content) {
  pageState.statusbar.info(content);
}

function updateStatusbarRunning(content) {
  pageState.statusbar.text(content, 'running');
}

// REPORT FUNCS -----------------------------------------------------------------------------------------

/*
async function finish(request, sender) {
  const context = {
    pageState,
    exitAction,
    handleDiscordCaptcha,
    registerRaffle,
    normalizePendingLink,
    options: storage.options,
  };
  return finishTask(request, sender, context);

  debug.log('finish; request, sender:', request, sender);

  if (pageState.abort) {
    return exitAction('abort');
  }

  if (request.status === 'captcha') {
    pageState.discordCaptchaSender = sender;
    pageState.discordCaptchaTabId = sender?.tab?.id;
    console.log('sender', sender);
    return handleDiscordCaptcha();
  }

  pageState.finishedTabsIds.push(request.senderTabId);
  pageState.finishedDiscordTabIds = pageState.finishedDiscordTabIds || [];
  if (request.isDiscord) {
    pageState.finishedDiscordTabIds.push(request.senderTabId);
  }
  debug.log('pageState.finishedDiscordTabIds:', pageState.finishedDiscordTabIds);

  const normalizedUrl = normalizePendingLink(request.url);
  const prevLength = pageState.pendingRequests.length;

  debug.log('finish; url:', request.url);
  debug.log('finish; normalizedUrl:', normalizedUrl);

  debug.log('finish; pendingRequests A:', pageState.pendingRequests.length, pageState.pendingRequests);
  pageState.pendingRequests = pageState.pendingRequests.filter((item) => item !== normalizedUrl);
  debug.log('finish; pendingRequests B:', pageState.pendingRequests.length, pageState.pendingRequests);

  if (request.twitter) {
    console.log('Add url to history:', request.url);
    await pageState.history.add(pageState.twitterUser, request.url);
    await pageState.history.save();
  }

  if (pageState.pendingRequests.length === 0 && prevLength > 0) {
    const sleepMs = request.delay ?? 500;
    console.info('Finished all required links, register raffle after sleep:', sleepMs);
    await sleep(sleepMs);
    debug.log('pageState:', pageState);

    let tabsToClose = [...pageState.finishedTabsIds];

    if (pageState.haveRoleDiscordLink && storage.options.RAFFLE_KEEP_ROLED_DISCORD_TASK_OPEN) {
      // if having role discord link we often times need to do some verification task to get role.
      // we save time by keeping those tabs open!
      debug.log('focus roled discord tabs');
      pageState.finishedDiscordTabIds.forEach((id) => {
        tabsToClose = tabsToClose.filter((tabId) => tabId !== id);
        chrome.runtime.sendMessage({ cmd: 'focusTab', id });
      });
    }

    if (storage.options.RAFFLE_CLOSE_TASKS_BEFORE_JOIN) {
      debug.log('Close finishedTabsIds');
      chrome.runtime.sendMessage({ cmd: 'closeTabs', tabIds: tabsToClose });
    }

    const focusTabWhenRegister = pageState.haveRoleDiscordLink ? false : true;
    return registerRaffle(focusTabWhenRegister);
  }

  console.info('Not all required links finished yet!');

  if (storage.options.TWITTER_OPEN_LINKS_IN_SEQUENCE & request.twitter) {
    const nextLink = pageState.pendingRequests.find((x) => isTwitterURL(x));
    if (nextLink) {
      const nextLinkUrl = 'https://' + nextLink + pageState.twitterLinkSuffix;
      console.log('Open next twitter link:', nextLinkUrl);

      await sleep(storage.options.RAFFLE_OPEN_TWITTER_LINK_DELAY, null, 0.1);

      if (storage.options.RAFFLE_OPEN_LINKS_IN_FOREGROUND) {
        window.open(nextLinkUrl, '_blank');
      } else {
        chrome.runtime.sendMessage({ cmd: 'openTab', url: nextLinkUrl });
      }
    } else {
      console.log('No more twitter links');
    }
  }

  if (pageState.hasDiscordCaptcha) {
    handleDiscordCaptcha();
  }
}
  */

// GETTERS -----------------------------------------------------------------------------------------

function getAlphaName() {
  // /from\\n\\n([a-z0-9 ]*)\\n\\non/i
  const elem = document.querySelector(
    '.MuiChip-root.MuiChip-filled.MuiChip-sizeSmall.MuiChip-colorSecondary.MuiChip-filledSecondary'
  );
  return elem?.innerText || '';
}

function getTwitterUser() {
  const elems = [...document.querySelectorAll('div.MuiSelect-select[role="button"]')].filter((e) =>
    e.innerText.startsWith('@')
  );
  return elems?.length === 1 ? elems[0].innerText.replace('@', '') : null;
}

function getDiscordUser() {
  const elems = [...document.querySelectorAll('div.MuiBox-root')].filter((e) =>
    e.innerText.toLowerCase().startsWith('discord:')
  );
  if (!elems || !elems.length) {
    return null;
  }
  const elem = elems[0].querySelector('div[role="button"]');
  return elem ? elem.innerText : null;
}

// REGISTER ----------------------------------------------------------------------------------

function forceRegister() {
  debug.log('forceRegister');
  const regBtn = getRegisterButtonSync(true);
  debug.log('forceRegister; regBtn:', regBtn, storage.options.ALPHABOT_REG_BTN_SEL);
  if (!regBtn) {
    debug.log('!regBtn');
    return null;
  }
  if (regBtn?.disabled) {
    debug.log('regBtn?.disable');
    return null;
  }

  const errors = getErrors();
  debug.log('errors:', errors);
  if (errors.discord) {
    debug.log('Do not force register when discord errors!');
    return null;
  }

  if (hasDoingItTooOften()) {
    debug.log('hasDoingItTooOften');
    return null;
  }

  clickElement(regBtn);
  // pageState.isRegistering = true;
  return regBtn;
}

async function registerRaffle(focusTab = true) {
  console.info('Register raffle; focusTab:', focusTab);

  pageState.pause = false;

  if (checkForJoinWithWonWallet()) {
    return exitAction('joinWithWonWallet');
  }

  updateStatusbarRunning('Joining raffle...');
  if (focusTab) {
    console.info('focusTab');
    chrome.runtime.sendMessage({ cmd: 'focusMyTab' });
  }

  const regBtn = await getRegisterButton();
  debug.log('registerRaffle; regBtn:', regBtn, storage.options.ALPHABOT_REG_BTN_SEL);
  if (!regBtn) {
    return exitAction('noRaffleRegisterBtn');
  }

  if (hasCaptcha()) {
    return handleRaffleCaptcha();
  }

  if (regBtn && !regBtn.disabled) {
    if (pageState.request?.retries) {
      debug.log('Wait some time before clicking reg button when retrying');
      await sleep(1500);
    }
    debug.log('Click register button:', regBtn);
    clickElement(regBtn);
    pageState.isRegistering = true;
  }

  if (pageState.request?.retries) {
    debug.log('Wait some time to let prev errors clear first when retrying register after errors!');
    await sleep(1500);
    await waitForRegistered();
  }
}

function clickElement(elem) {
  elem.click();
  simulateClick(elem);
}

async function waitForRegistered(maxWait = 1 * ONE_MINUTE, interval = 100) {
  console.info('Wait for registered...');

  const stopTime = millisecondsAhead(maxWait || storage.options.ALPHABOT_WAIT_FOR_REGISTERED_SEC * 1000);

  while (Date.now() <= stopTime) {
    if (hasCaptcha()) {
      // return exitAction('raffleCaptcha');
      return handleRaffleCaptcha();
    }

    if (hasAlreadyWon()) {
      return exitAction('alreadyWon');
    }

    if (hasWalletConnectDialog()) {
      exitAction('walletConnectDialog');
      return;
    }

    if (hasDoingItTooOften()) {
      exitAction('doingItTooOften');
      return;
    }

    if (hasRegistered()) {
      return exitAction('registered');
    }

    if (pageState.abort) {
      return exitAction('abort');
    }

    await sleep(interval);
  }

  if (pageState.hasDiscordCaptcha) {
    return handleDiscordCaptcha();
  }

  if (!pageState.pause) {
    return waitAndTryRegisterOneLastTime();
    // exitAction('notRegisterProperly');
  }
  pageState.pause = false;

  debug.log('Stop waiting for registered!');
}

async function waitAndTryRegisterOneLastTime() {
  // We have retried max number of times, now we can as well
  // wait for register button one last time and try to register!
  debug.log('waitAndTryRegisterOneLastTime');

  const waitSecs = 600;

  updateStatusbarRunning(`Raffle error? Wait for register button ${waitSecs} secs and try again...`);

  const stopTime = millisecondsAhead(waitSecs * 1000);
  while (Date.now() <= stopTime && storage.options.RAFFLE_FORCE_REGISTER) {
    debug.log('try to forceRegister');
    const regBtn = forceRegister();
    if (regBtn) {
      debug.log('forceRegister ok!');
      return waitForRegisteredMainLoop(regBtn);
    }
    await sleep(1000);
  }

  if (hasRegistered()) {
    return exitAction('registered');
  }

  return exitAction('raffleUnknownError');
}

async function waitAndTryRegisterBeforeRetry(retries) {
  debug.log('waitAndTryRegisterBeforeRetry; retries:', retries);

  const stopTime = millisecondsAhead(storage.options.RAFFLE_RETRY_SECS * 1000);
  while (Date.now() <= stopTime) {
    if (storage.options.RAFFLE_FORCE_REGISTER) {
      debug.log('try to forceRegister');
      const regBtn = forceRegister();
      if (regBtn) {
        debug.log('forceRegister ok!');
        return waitForRegisteredMainLoop(regBtn);
      }
    }
    await sleep(1000);
  }

  if (hasRegistered()) {
    return exitAction('registered');
  }

  await addPendingRequest(window.location.href, { action: 'retryJoin', retries });
  window.location.reload();
}

async function handleRaffleCaptcha() {
  debug.log('handleRaffleCaptcha');

  if (pageState.hasHandledRaffleCaptcha) {
    return;
  }
  pageState.hasHandledRaffleCaptcha = true;
  exitAction('raffleCaptcha');

  const stopTime = millisecondsAhead(60 * 1000);
  while (Date.now() <= stopTime) {
    debug.log('try to handleRaffleCaptcha with forceRegister');
    if (forceRegister()) {
      debug.log('forceRegister ok!');
      return waitForRegisteredMainLoop();
    } else {
      debug.log('forceRegister NOK!');
    }
    await sleep(1000);
  }
}

async function handleDiscordCaptcha() {
  pageState.hasDiscordCaptcha = true;
  exitAction('discordCaptcha');
  chrome.runtime.sendMessage({ cmd: 'focusTab', id: pageState.discordCaptchaTabId });
}

async function waitForRegisteredMainLoop(regBtn = null, maxWait = 300 * ONE_MINUTE, interval = 1000) {
  debug.log('Wait for registered main loop...');

  const stopTime = millisecondsAhead(maxWait);

  while (Date.now() <= stopTime) {
    if (regBtn) {
      if (hasDoingItTooOften()) {
        debug.log('hasDoingItTooOften');
        return;
      } else {
        clickElement(regBtn);
      }
    }
    if (hasRegistered()) {
      return exitAction('registered');
    }
    if (hasCaptcha()) {
      handleRaffleCaptcha();
    }
    await sleep(interval);
  }

  debug.log('Stop waiting for registered main loop!');
}

async function getRegisterButton() {
  const regPlus1Btn = await waitForTextContains(
    storage.options.ALPHABOT_REG_PLUS_1_BTN_SEL,
    'button',
    100,
    100
  );
  if (regPlus1Btn) {
    return regPlus1Btn;
  }
  return await waitForSelector(storage.options.ALPHABOT_REG_BTN_SEL, 60 * ONE_SECOND, 100);
}

function getRegisterButtonSync(mustHaveAllBtns = false) {
  debug.log('getRegisterButtonSync; mustHaveAllBtns:', mustHaveAllBtns);
  const regPlus1Btn = getTextContains(storage.options.ALPHABOT_REG_PLUS_1_BTN_SEL, 'button');
  if (regPlus1Btn) {
    if (mustHaveAllBtns) {
      return document.querySelector(storage.options.ALPHABOT_REG_BTN_SEL) ? regPlus1Btn : null;
    }
    return regPlus1Btn;
  }
  return document.querySelector(storage.options.ALPHABOT_REG_BTN_SEL);
}

// EXIT ACTIONS -------------------------------------------------------------------

function exitAction(result, options) {
  const context = {
    updateStatusbar,
    updateStatusbarError,
    updateStatusbarInfo,
    updateStatusbarOk,
    removeQuickRegBtn,
    resetQuickRegBtn,
    pageState,
    options: storage.options,
  };
  console.info('Exit:', result);
  exitActionMain(result, context, options);
}

// RAFFLE STATE CHECKERS -------------------------------------------------------------------

function hasRegistered() {
  const elems = [...document.querySelectorAll('h5')].filter(
    (e) =>
      e.innerText === 'Registered successfully' || e.innerText === 'Your wallet was submitted successfully'
  );
  const result = elems.length > 0;
  return result;
}

async function shouldIgnore() {
  if (
    pageState.isAutoStarted && // only ignore auto started raffles!
    storage.options.ALPHABOT_IGNORED_NAMES &&
    storage.options.ALPHABOT_IGNORED_NAMES.includes(getAlphaName())
  ) {
    return true;
  }
  return false;
}

function hasCaptcha() {
  // document.querySelector('.recaptcha-checkbox-checked')
  // document.querySelector('.recaptcha-checkbox-borderAnimation')
  // const elem = document.querySelector('iframe[title="reCAPTCHA"]');
  const elem = document.querySelector('iframe[src*="hcaptcha.com"]');

  if (!elem) {
    return false;
  }

  if (typeof elem?.disabled === 'boolean' && elem.disabled === false) {
    // debug.log('Has captcha:', elem);
    return true;
  }

  const parent = elem.parentElement?.parentElement;
  if (!parent) {
    return false;
  }

  if (parent.ariaHidden === 'true') {
    return false;
  }

  // debug.log('Has captcha:', elem, parent);

  return true;
}

function hasWalletConnectDialog() {
  const elem = document.querySelector('#WEB3_CONNECT_MODAL_ID');
  return !!elem;
}

function hasAlreadyWon() {
  const elem = [...document.querySelectorAll('div#notistack-snackbar.SnackbarItem-message')].filter((e) =>
    e.innerText.startsWith('You won a raffle for this project from the same team already')
  );
  const result = elem.length > 0;
  return result;
}

function hasDoingItTooOften() {
  const elem = [...document.querySelectorAll('div#notistack-snackbar.SnackbarItem-message')].filter((e) =>
    e.innerText.startsWith('You are doing that too often. Please try again in 5 minutes')
  );
  const result = elem.length > 0;
  return result;
}

function getErrors() {
  const elems = [...document.querySelectorAll('.MuiAlert-standardError')].map((x) =>
    x.innerText.toLowerCase()
  );
  return {
    texts: elems,
    twitter: elems.some((x) => x.includes('follow') || x.includes('like') || x.includes('retweet')),
    discord: elems.some((x) => x.includes('join')),
  };
}

// GUI -----------------------------------------------------------------------------------------

async function addQuickRegButton() {
  debug.log('addQuickRegButton...');

  const regBtn = await waitForSelector('[data-action="view-project-register"]', 60 * ONE_SECOND, 100);
  debug.log('regBtn', regBtn);
  if (!regBtn) {
    return;
  }

  const regDiv = regBtn.parentElement;
  debug.log('regDiv', regDiv);

  const quickRegBtn = document.querySelector('[id="ph-quick-reg"]');
  debug.log('quickRegBtn', quickRegBtn);

  if (quickRegBtn) {
    debug.log('Do nothing');
  } else {
    const btn = document.createElement('button');
    btn.id = 'ph-quick-reg';
    btn.innerHTML = JOIN_BUTTON_TEXT;
    btn.title = JOIN_BUTTON_TITLE;
    btn.className = 'alphabotButton';
    btn.addEventListener('click', quickRegClickHandler);

    const tasksElem = getElementByText('Tasks', 'h5', { contains: true });
    debug.log('tasksElem', tasksElem);
    if (tasksElem) {
      tasksElem.after(btn);
    } else {
      regBtn.after(btn);
    }
  }
}

function getQuickRegBtn() {
  return document.querySelector('[id="ph-quick-reg"]');
}

function setQuickRegButton(text, className = null) {
  const btn = getQuickRegBtn();
  if (btn) {
    btn.innerHTML = text;
  }
  if (btn && className) {
    btn.classList.add(className);
  }
}

function resetQuickRegBtn() {
  const btn = getQuickRegBtn();
  if (btn) {
    setQuickRegButton(JOIN_BUTTON_TEXT);
    btn.disabled = false;
  }
}

function removeQuickRegBtn() {
  const btn = getQuickRegBtn();
  if (btn) {
    btn.remove();
  }
}

function startQuickRegBtn() {
  const btn = getQuickRegBtn();
  if (btn) {
    setQuickRegButton(JOIN_BUTTON_IN_PROGRESS_TEXT);
    btn.disabled = true;
  }
}

function quickRegClickHandler(event) {
  event.preventDefault();
  event.stopImmediatePropagation();
  joinRaffle();
}

// RAFFLE LINKS ----------------------------------------------------------------------------------

function getRequirements() {
  debug.log('getRequirements');

  const twitterUser = getTwitterUser();
  const discordUser = getDiscordUser();

  const mustFollowLinks = getMustFollowLinks();
  const mustLikeLinks = getMustLikeLinks();
  const mustRetweetLinks = getMustRetweetLinks();
  const mustLikeAndRetweetLinks = getMustLikeAndRetweetLinks();
  const mustJoinLinks = getMustJoinLinks();
  const mustJoinWithRoleLinks = getMustJoinWithRoleLinks();

  const twitterLinks = noDuplicates(mustFollowLinks, mustLikeLinks, mustRetweetLinks);
  const discordLinks = noDuplicates(mustJoinLinks);

  const result = {
    twitterUser,
    discordUser,
    mustFollowLinks,
    mustLikeLinks,
    mustRetweetLinks,
    mustLikeAndRetweetLinks,
    mustJoinLinks,
    mustJoinWithRoleLinks,
    twitterLinks,
    discordLinks,
    links: [...twitterLinks, ...discordLinks],
  };

  return result;
}

function getMustFollowLinks() {
  return parseMustFollowLinks().map((x) => makeTwitterFollowIntentUrl(x));
}

function getMustLikeAndRetweetLinks() {
  return [...new Set([...parseMustLikeAndRetweetLinks()])];
}

function getMustRetweetLinks() {
  const links = [
    ...new Set(
      [...parseMustRetweetLinks(), ...parseMustLikeAndRetweetLinks()].map((x) =>
        makeTwitterRetweetIntentUrl(x)
      )
    ),
  ];
  return links;
}

function getMustLikeLinks() {
  const links = [
    ...new Set(
      [...parseMustLikeLinks(), ...parseMustLikeAndRetweetLinks()].map((x) => makeTwitterLikeIntentUrl(x))
    ),
  ];
  return links;
}

function getMustJoinLinks() {
  return parseMustJoinLinks();
}

function getMustJoinWithRoleLinks() {
  return parseMustJoinLinks(true);
}

// PARSE -----------------

function parseMustLikeLinks() {
  return parseTwitterLinks('like\n');
}

function parseMustRetweetLinks() {
  return parseTwitterLinks('retweet\n');
}

function parseMustLikeAndRetweetLinks() {
  return parseTwitterLinks('like & retweet');
}

function parseMustFollowLinks() {
  const val = [...document.querySelectorAll('a')]
    .filter((elem) => isTwitterURL(elem.href) && elem.href.toLowerCase().includes('intent/user?'))
    .map((e) => e.href);
  console.log('parseMustFollowLinks:', val);
  return val;
}

function parseTwitterLinks(prefix) {
  const elems = [
    ...[...document.querySelectorAll('div.MuiPaper-root')].filter((e) =>
      e.innerText.toLowerCase().startsWith(prefix)
    ),
  ];
  const val = elems.length < 1 ? [] : Array.from(elems[0].getElementsByTagName('a')).map((a) => a.href);
  console.log('parseTwitterLinks:', prefix, val);
  return val;
}

function parseMustJoinLinks(mustHaveRole = false) {
  let elems;
  if (mustHaveRole) {
    elems = [...document.querySelectorAll('p.MuiTypography-root')].filter(
      (e) =>
        e.innerText.toLowerCase().includes('join') &&
        e.innerText.toLowerCase().includes('discord') &&
        e.innerText.toLowerCase().includes('have role')
    );
  } else {
    elems = [...document.querySelectorAll('p.MuiTypography-root')].filter(
      (e) => e.innerText.toLowerCase().includes('join') && e.innerText.toLowerCase().includes('discord')
    );
  }
  const val = elems
    .map((e) => e.getElementsByTagName('a'))
    .map((e) => Array.from(e))
    .flat()
    .map((e) => e.href);
  console.log('parseMustJoinLinks:', val);
  return val;
}

async function addQuickLinks() {
  const sectionElem = await waitForTextContains('Like & retweet', 'p', 1000, 100);
  if (!sectionElem) {
    return;
  }

  const links = getMustLikeAndRetweetLinks();
  console.log('links', links);

  return;
  /*
  links.forEach((url) => {
    const retweetUrl = url;
    const likeUrl = url.replace('/retweet?', '/like?');

    sectionElem.innerHTML = `<a href="${likeUrl}" target="_blank">Like</a> & <a href="${retweetUrl}" target="_blank">retweet</a>`;
  });
  */
}

// HELPERS ---------------------------------------------------------------------------------------------------

function checkForJoinWithWonWallet() {
  const wonWallets = getWonWallets();
  debug.log('wonWallets', wonWallets);
  if (!wonWallets.length) {
    return false;
  }

  const selectedWallet = getSelectedWallet();
  debug.log('selectedWallet', selectedWallet);
  if (!selectedWallet) {
    return false;
  }

  if (wonWallets.includes(selectedWallet.shortWallet) || wonWallets.includes(selectedWallet.longWallet)) {
    return true;
  }

  return false;
}

function getWonWallets() {
  const w1 = getWonWalletsByThisAccount();
  const w2 = getWonWalletsByAllAccounts();
  const wonWallets = noDuplicates([...w1, ...w2].map((x) => x.toLowerCase()));
  console.log('xxxxx:', w1, w2, wonWallets);
  return wonWallets;
}

function getWonWalletsByAllAccounts() {
  const twitterLink = document.querySelector('a[data-action="option-twitter"]');
  if (!twitterLink) {
    return [];
  }
  debug.log('twitterLink', twitterLink);

  const twitterHandle = extractTwitterHandle(twitterLink?.href);
  if (!twitterHandle) {
    return [];
  }
  debug.log('twitterHandle', twitterHandle);

  return getPreviousWalletsWon(twitterHandle);
}

function getWonWalletsByThisAccount() {
  try {
    const elems = [
      ...[...document.querySelectorAll('div.MuiBox-root')].filter(
        (x) => x.innerText.toLowerCase() === 'you won'
      ),
    ];
    if (!elems?.length) {
      return [];
    }
    return [...elems[0].nextElementSibling.querySelectorAll('p')]
      .filter((x) => x.innerText.includes('...'))
      .map((x) => x.innerText);
  } catch (e) {
    console.error(e);
    return [];
  }
}

function getSelectedWallet() {
  try {
    const elems = [...document.querySelectorAll('div.MuiAlert-message')].filter((x) =>
      x.innerText.toLowerCase().includes(' mint wallet:\n')
    );
    // console.log('elems', elems);
    //const elems = [...document.querySelectorAll('svg[aria-label^="Select a wallet address"]')];
    if (!elems?.length) {
      return null;
    }
    const elem = elems[0].querySelector('div[role="button"]');
    if (!elem) {
      return null;
    }

    const shortWallet = elem?.innerText || '';
    const longWallet = elem.nextSibling?.value || '';

    return { shortWallet, longWallet };
    /*
    console.log('elem', elem);
    console.log('elem?.nextSibling', elem?.nextSibling);
    console.log('elem?.nextSibling?.value', elem?.nextSibling?.value);
    return elem?.nextSibling?.value || null;
    */
    // return elems[0].previousElementSibling.querySelector('div[role="button"]').parentElement.innerText;
  } catch (e) {
    console.error(e);
    return null;
  }
}

async function reloadStorage(key = null) {
  if (!key) {
    storage = await getStorageItems(['runtime', 'options']);
  } else {
    const storageTemp = await getStorageItems([key]);
    storage[key] = storageTemp[key];
  }
  debug.log('reloadStorage:', key, storage);
}