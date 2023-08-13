console.info('alphabotPage.js begin', window?.location?.href);

import '../styles/alphabotPage.scss';
import {
  createStatusbarButtons,
  exitActionMain,
  getMyTabIdFromExtension,
  JOIN_BUTTON_TEXT,
  JOIN_BUTTON_IN_PROGRESS_TEXT,
  JOIN_BUTTON_TITLE,
  STATUSBAR_DEFAULT_TEXT,
} from './premintHelper';
import { createObserver } from './observer';
import { createHistory } from './history';

import {
  createLogger,
  createLogLevelArg,
  getStorageItems,
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
  ONE_SECOND,
  ONE_MINUTE,
} from '@ahstream/hx-utils';
import { createStatusbar } from '@ahstream/hx-statusbar';
//import '@ahstream/hx-statusbar/dist/main.css';

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

  if (request.cmd === 'finish') {
    finish(request);
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

  if (request.cmd === 'onHistoryStateUpdated') {
    debug.log('onHistoryStateUpdated in content');
    const lastURL = pageState.lastURL;
    const currentURL = window.location.href;
    pageState.lastURL = currentURL;
    if (currentURL.includes('?') && lastURL.includes('?')) {
      debug.log('Only search args changed, do not rerun page!');
    } else if (currentURL !== lastURL) {
      debug.log('Page navigation, reload page!');
      window.location.reload();
    }
  }

  sendResponse();
  return true;
});

// PAGE FUNCS ----------------------------------------------------------------------------------

async function runPage(runRaffle = false) {
  debug.log('runPage; runRaffle, pageState:', runRaffle, pageState);

  pageState.statusbar.buttons(
    createStatusbarButtons({
      options: true,
      results: true,
      reveal: 'disabled',
      followers: 'disabled',
    })
  );

  if (!pageState.action) {
    const request = await dispatch(window.location.href, 5 * 60);
    debug.log('dispatched request:', request);
    pageState.request = request;
    pageState.action = request?.action;
  }

  if (pageState.action === 'bookmark') {
    pageState.isAutoStarted = true;
  }

  await showRafflePage(runRaffle || pageState.action === 'bookmark' || pageState.action === 'retryJoin');
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

  const section = pageState.observer.createPreviousWonSection(twitterHandle, true);
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

function getRequirements() {
  debug.log('getRequirements');

  const twitterUser = getTwitterUser();
  const discordUser = getDiscordUser();

  const mustFollowLinks = getMustFollowLinks();
  const mustLikeLinks = getMustLikeLinks();
  const mustRetweetLinks = getMustRetweetLinks();
  const mustJoinLinks = getMustJoinLinks();

  const twitterLinks = noDuplicates(mustFollowLinks, mustLikeLinks, mustRetweetLinks);
  const discordLinks = noDuplicates(mustJoinLinks);

  const result = {
    twitterUser,
    discordUser,
    mustFollowLinks,
    mustLikeLinks,
    mustRetweetLinks,
    mustJoinLinks,
    twitterLinks,
    discordLinks,
    links: [...twitterLinks, ...discordLinks],
  };

  return result;
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

  await reloadStorage();

  pageState.abort = false;

  updateStatusbarInfo('Fulfilling raffle tasks...');
  startQuickRegBtn();

  const reqs = getRequirements();
  debug.log('reqs', reqs);

  const discordLinks = storage.options.RAFFLE_SKIP_DONE_TASKS
    ? await removeDoneLinks(reqs.discordUser, reqs.discordLinks)
    : reqs.discordLinks;
  const twitterLinks = storage.options.RAFFLE_SKIP_DONE_TASKS
    ? await removeDoneLinks(reqs.twitterUser, reqs.twitterLinks)
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

  for (let i = 0; i < reqLinks.length; i++) {
    if (pageState.abort) {
      return exitAction('abort');
    }
    const reqLink = reqLinks[i];
    const url =
      reqLink +
      `#id=${pageState.myTabId}&user=${storage.options.RAFFLE_SWITCH_TWITTER_USER ? reqs.twitterUser : ''}&${createLogLevelArg()}`;
    debug.log('Open URL:', url);

    const isTwitter = reqLink.includes('twitter.com');
    const user = isTwitter ? reqs.twitterUser : reqs.discordUser;

    await pageState.history.add(user, reqLink);

    if (storage.options.ALPHABOT_OPEN_IN_FOREGROUND) {
      window.open(url, '_blank');
    } else {
      chrome.runtime.sendMessage({ cmd: 'openTab', url });
    }
    if (i + 1 < reqLinks.length) {
      const delayMs = Math.round(
        isTwitter ? storage.options.RAFFLE_OPEN_TWITTER_LINK_DELAY : storage.options.RAFFLE_OPEN_TWITTER_LINK_DELAY / 2
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

// REPORT FUNCS -----------------------------------------------------------------------------------------

async function finish(request) {
  debug.log('finish; request:', request);

  if (pageState.abort) {
    return exitAction('abort');
  }

  if (request.status === 'captcha') {
    return exitAction('discordCaptcha');
  }

  pageState.finishedTabsIds.push(request.senderTabId);
  const normalizedUrl = normalizePendingLink(request.url);
  const prevLength = pageState.pendingRequests.length;
  debug.log('finish; url, normalizedUrl, prevLength, pendingRequests:', request.url, normalizedUrl, prevLength, pageState.pendingRequests);

  pageState.pendingRequests = pageState.pendingRequests.filter((item) => item !== normalizedUrl);

  if (pageState.pendingRequests.length === 0 && prevLength > 0 && storage.options.RAFFLE_CLOSE_TASK_PAGES) {
    console.info('Finished all required links, register raffle!');
    await sleep(request.delay ?? 500);
    debug.log('Close task tabs');
    chrome.runtime.sendMessage({ cmd: 'closeTabs', tabIds: pageState.finishedTabsIds });
    return registerRaffle();
  }

  console.info('Not all required links finished yet!');

  if (pageState.hasDiscordCaptcha) {
    chrome.runtime.sendMessage({ cmd: 'focusMyTab' });
  }
}

// GETTERS -----------------------------------------------------------------------------------------

function getAlphaName() {
  // /from\\n\\n([a-z0-9 ]*)\\n\\non/i
  const elem = document.querySelector('.MuiChip-root.MuiChip-filled.MuiChip-sizeSmall.MuiChip-colorSecondary.MuiChip-filledSecondary');
  return elem?.innerText || '';
}

function getTwitterUser() {
  const elems = [...document.querySelectorAll('div.MuiSelect-select[role="button"]')].filter((e) => e.innerText.startsWith('@'));
  return elems?.length === 1 ? elems[0].innerText.replace('@', '') : null;
}

function getDiscordUser() {
  const elems = [...document.querySelectorAll('div.MuiBox-root')].filter((e) => e.innerText.toLowerCase().startsWith('discord:'));
  if (!elems || !elems.length) {
    return null;
  }
  const elem = elems[0].querySelector('div[role="button"]');
  return elem ? elem.innerText : null;
}

// REGISTER ----------------------------------------------------------------------------------

async function registerRaffle() {
  console.info('Register raffle');

  if (checkForJoinWithWonWallet()) {
    return exitAction('joinWithWonWallet');
  }

  updateStatusbar('Joining raffle...');
  chrome.runtime.sendMessage({ cmd: 'focusMyTab' });

  const regBtn = await getRegisterButton();
  debug.log('registerRaffle; regBtn:', regBtn, storage.options.ALPHABOT_REG_BTN_SEL);
  if (!regBtn) {
    return exitAction('noRaffleRegisterBtn');
  }

  if (hasCaptcha()) {
    return exitAction('raffleCaptcha');
  }

  if (regBtn && !regBtn.disabled) {
    if (pageState.request?.retries) {
      debug.log('Wait some time before clicking reg button when retrying');
      await sleep(1500);
    }
    debug.log('Click register button:', regBtn);
    regBtn.click();
    pageState.isRegistering = true;
  }

  if (pageState.request?.retries) {
    debug.log('Wait some time to let prev errors clear first when retrying register after errors!');
    await sleep(1500);
    await waitForRegistered();
  }
}

async function waitForRegistered(maxWait = 1 * ONE_MINUTE, interval = 100) {
  console.info('Wait for registered...');

  const stopTime = millisecondsAhead(maxWait || storage.options.ALPHABOT_WAIT_FOR_REGISTERED_SEC * 1000);

  while (Date.now() <= stopTime) {
    const errors = getErrors();

    if (errors.texts.length) {
      await sleep(1000);
      debug.log('Has errors:', errors);

      if (hasCaptcha()) {
        return exitAction('raffleCaptcha');
      }

      if (pageState.hasHadRaffleError) {
        return exitAction('raffleUnknownError');
      }
      pageState.hasHadRaffleError = true;

      if (!errors.twitter) {
        return exitAction('raffleUnknownError');
      }

      const retries = pageState.request?.retries ? pageState.request?.retries - 1 : storage.options.RAFFLE_RETRY_TIMES;

      if (!retries) {
        return exitAction('raffleUnknownError');
      }

      exitAction('raffleUnknownErrorWillRetry', { retrySecs: storage.options.RAFFLE_RETRY_SECS, retries });

      debug.log('retry in secs; times:', storage.options.RAFFLE_RETRY_SECS, retries);
      await sleep(storage.options.RAFFLE_RETRY_SECS * 1000);

      if (hasRegistered()) {
        return exitAction('registered');
      }

      await addPendingRequest(window.location.href, { action: 'retryJoin', retries });
      window.location.reload();
      return;
    }

    if (hasCaptcha()) {
      return exitAction('raffleCaptcha');
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

  exitAction('notRegisterProperly');

  debug.log('Stop waiting for registered!');
}

async function waitForRegisteredMainLoop(maxWait = 300 * ONE_MINUTE, interval = 1000) {
  debug.log('Wait for registered main loop...');

  const stopTime = millisecondsAhead(maxWait);

  while (Date.now() <= stopTime) {
    if (hasRegistered()) {
      return exitAction('registered');
    }
    if (hasCaptcha()) {
      if (!pageState.hasReportedCaptchaPresence) {
        pageState.hasReportedCaptchaPresence = true;
        exitAction('raffleCaptcha');
      }
    }
    await sleep(interval);
  }

  debug.log('Stop waiting for registered main loop!');
}

async function getRegisterButton() {
  const regPlus1Btn = await waitForTextContains(storage.options.ALPHABOT_REG_PLUS_1_BTN_SEL, 'button', 100, 100);
  if (regPlus1Btn) {
    return regPlus1Btn;
  }
  return await waitForSelector(storage.options.ALPHABOT_REG_BTN_SEL, 60 * ONE_SECOND, 100);
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
  };
  console.info('Exit:', result);
  exitActionMain(result, context, options);
}

// RAFFLE STATE CHECKERS -------------------------------------------------------------------

function hasRegistered() {
  const elems = [...document.querySelectorAll('h5')].filter(
    (e) => e.innerText === 'Registered successfully' || e.innerText === 'Your wallet was submitted successfully'
  );
  const result = elems.length > 0;
  return result;
}

async function shouldIgnore() {
  if (!pageState.isAutoStarted) {
    // only ignore auto started raffles!
    return false;
  }

  if (storage.options.ALPHABOT_IGNORED_NAMES && storage.options.ALPHABOT_IGNORED_NAMES.includes(getAlphaName())) {
    return true;
  }
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
    debug.log('Has captcha:', elem);
    return true;
  }

  const parent = elem.parentElement?.parentElement;
  if (!parent) {
    return false;
  }

  if (parent.ariaHidden === 'true') {
    return false;
  }

  debug.log('Has captcha:', elem, parent);

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
  const elems = [...document.querySelectorAll('.MuiAlert-standardError')].map((x) => x.innerText.toLowerCase());
  return {
    texts: elems,
    twitter: elems.some((x) => x.includes('follow') || x.includes('like') || x.includes('retweet')),
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

async function removeDoneLinks(user, links) {
  const validLinks = [];
  for (const link of links) {
    if (await pageState.history.has(user, link)) {
      continue;
    }
    validLinks.push(link);
  }
  return validLinks;
}

function getMustFollowLinks() {
  return parseMustFollowLinks();
}

function getMustLikeAndRetweetLinks() {
  return [...new Set([...parseMustLikeAndRetweetLinks()])];
}

function getMustRetweetLinks() {
  return [...new Set([...parseMustRetweetLinks(), ...parseMustLikeAndRetweetLinks().filter((u) => u.includes('/retweet'))])];
}

function getMustLikeLinks() {
  const likeLinks = parseMustLikeAndRetweetLinks().map((x) => x.replace('/retweet?', '/like?'));
  return [...new Set([...parseMustLikeLinks(), ...likeLinks])];
}

function getMustJoinLinks() {
  return parseMustJoinLinks();
}

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
  return [...document.querySelectorAll('a')]
    .filter((elem) => elem.href.toLowerCase().startsWith('https://twitter.com/intent/user?'))
    .map((e) => e.href);
}

function parseTwitterLinks(prefix) {
  const elems = [...[...document.querySelectorAll('div.MuiPaper-root')].filter((e) => e.innerText.toLowerCase().startsWith(prefix))];
  return elems.length < 1 ? [] : Array.from(elems[0].getElementsByTagName('a')).map((a) => a.href);
}

function parseMustJoinLinks() {
  return [...document.querySelectorAll('p.MuiTypography-root')]
    .filter((e) => e.innerText.toLowerCase().includes('join') && e.innerText.toLowerCase().includes('discord'))
    .map((e) => e.getElementsByTagName('a'))
    .map((e) => Array.from(e))
    .flat()
    .map((e) => e.href);
}

async function addQuickLinks() {
  const sectionElem = await waitForTextContains('Like & retweet', 'p', 1000, 100);
  if (!sectionElem) {
    return;
  }

  const links = getMustLikeAndRetweetLinks();

  links.forEach((url) => {
    const retweetUrl = url;
    const likeUrl = url.replace('/retweet?', '/like?');

    sectionElem.innerHTML = `<a href="${likeUrl}" target="_blank">Like</a> & <a href="${retweetUrl}" target="_blank">retweet</a>`;
  });
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

  if (wonWallets.includes(selectedWallet)) {
    return true;
  }

  return false;
}

function getWonWallets() {
  try {
    const elems = [...[...document.querySelectorAll('div.MuiBox-root')].filter((x) => x.innerText.toLowerCase() === 'you won')];
    if (!elems?.length) {
      return [];
    }
    return [...elems[0].nextElementSibling.querySelectorAll('p')].filter((x) => x.innerText.includes('...')).map((x) => x.innerText);
  } catch (e) {
    console.error(e);
    return [];
  }
}

function getSelectedWallet() {
  try {
    const elems = [...document.querySelectorAll('svg[aria-label^="Select a wallet address"]')];
    if (!elems?.length) {
      return null;
    }
    return elems[0].previousElementSibling.querySelector('div[role="button"]').parentElement.innerText;
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
