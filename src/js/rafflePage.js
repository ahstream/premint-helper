import global from './global.js';
console.log(global);

import {
  exitActionMain,
  getMyTabIdFromExtension,
  checkIfSubscriptionEnabled,
  showNoSubscriptionStatusbar,
  removeDoneLinks,
  finishTask,
  finishUnlockedTwitterAccount,
  clickElement,
  normalizeTwitterHandle,
  normalizeDiscordHandle,
  createStatusbar,
  loadStorage,
} from './premintHelperLib';

import {
  ONE_MINUTE,
  myConsole,
  createLogLevelArg,
  setStorageData,
  sleep,
  createHashArgs,
  millisecondsAhead,
  noDuplicates,
  addPendingRequest,
  dispatch,
  normalizePendingLink,
  makeTwitterFollowIntentUrl,
  makeTwitterRetweetIntentUrl,
  makeTwitterLikeIntentUrl,
  isTwitterURL,
} from 'hx-lib';

import { createHistory } from './history';
import { getPermissions } from './permissions';

const console2 = myConsole(global.LOGLEVEL);

// DATA ----------------------------------------------------------------------------------

let provider = null;

let storage = null;

let pageState = {
  provider: null,
  parentTabId: null,
  storageModified: false,
  action: '',
  pendingRequests: [],
  statusbar: null,
  history: null,
  lastURL: '',
  observer: null,
};

const VISIT_TWITTER_LINK_DURATION = 4000;
const VISIT_TWITTER_LINK_INTERVAL = 2000;

// INIT ----------------------------------------------------------------------------

export async function initRafflePage(raffleProvider) {
  pageState.href = window.location.href;
  console2.info('Init raffle page, provider:', raffleProvider?.name);
  provider = raffleProvider;

  window.addEventListener('load', onLoad);
  window.addEventListener('DOMContentLoaded', onLoad);

  pageState.observer = await provider.createObserver({ permissions: null });
  pageState.twitterObserver = await provider.createObserver2({ permissions: null });
  const permissions = await getPermissions();
  pageState.permissions = permissions;
  console2.info('PageState:', pageState);

  await reloadStorage();

  if (!storage?.options) {
    return console2.info('Options missing, exit!');
  }

  if (!isEnabled()) {
    return console2.info('Raffle provider disabled, exit!');
  }

  initEventHandlers();

  pageState.initialized = true;
  //setTimeout(onLoad, 1000);
}

async function onLoad() {
  console2.log('onLoad');

  if (pageState.loaded) {
    return console2.log('Page already loaded, ignore load event!');
  }
  pageState.loaded = true;

  while (!pageState.initialized) {
    console2.info('Wait for initialized...');
    await sleep(200);
  }

  const hashArgs = createHashArgs(window.location.hash);

  pageState = {
    ...pageState,
    ...{
      hashArgs,
      action: hashArgs.getOne('action'),
      parentTabId: hashArgs.getOne('id'),
      storageModified: false,
      pendingRequests: [],
      isRegistering: false,
      statusbar: createStatusbar(storage.options, {
        buttons: provider?.statusbarBtnOptions || {},
      }),
      history: await createHistory(),
      lastURL: window.location.href,
      finishedTabsIds: [],
    },
  };

  console2.info('PageState:', pageState);

  showPage();
}

function initEventHandlers() {
  console2.info('Init event handlers');
  chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    console2.info('Received message:', request, sender);

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
        updateStatusbar,
        options: storage.options,
      });
    }

    if (request.cmd === 'onHistoryStateUpdated') {
      console2.log('onHistoryStateUpdated in content');
      const lastURL = pageState.lastURL;
      const currentURL = window.location.href;
      pageState.lastURL = currentURL;
      if (currentURL.includes('?') && lastURL.includes('?')) {
        console2.log('Only search args changed, do not rerun page!');
      } else if (lastURL && currentURL !== lastURL) {
        console2.log('Page navigation, reload page!');
        window.location.reload();
      } else {
        console2.log('No new navigation, skip reload');
      }
    }

    if (request.cmd === 'finish') {
      return finishTask(request, sender, {
        pageState,
        exitAction,
        handleDiscordCaptcha,
        registerRaffle,
        visitTwitterLinks: provider.visitTwitterLinks ? visitTwitterLinks : null,
        options: storage.options,
      });
    }

    if (request.cmd === 'getMyTabIdAsyncResponse') {
      pageState.myTabId = request.response;
    }

    sendResponse();
    return true;
  });
}

// OPTIONS

function isEnabled() {
  return storage.options[`${provider?.name}_ENABLE`];
}

function isTwitterTasksEnabled() {
  return storage.options[`${provider?.name}_ENABLE_TWITTER_TASKS`];
}

function isDiscordTasksEnabled() {
  return storage.options[`${provider?.name}_ENABLE_DISCORD_TASKS`];
}

function getWaitForRegistered() {
  const n = storage.options[`${provider?.name}_WAIT_FOR_REGISTERED_SEC`];
  return n ? n * 1000 : null;
}

// PAGE FUNCS ----------------------------------------------------------------------------------

async function showPage() {
  const href = window.location.href;
  console2.log('showPage; pageState, href:', pageState, href);

  if (provider.isPendingReg()) {
    pageState.isPendingReg = true;
  }

  if (!pageState.action) {
    await sleep(100);
    const request = await dispatch(pageState.href, 5 * 60);
    console2.log('Dispatched request:', request);
    pageState.request = request;
    pageState.action = request?.action;
  }

  let runRaffle = false;

  /*
  if (pageState.action === 'wasAutoStarted') {
    console2.log('wasAutoStarted, set isAutoStarted = true');
    pageState.isAutoStarted = true;
  }
  */

  if (
    pageState.action === 'shortcut' ||
    pageState.action === 'retryJoin' ||
    pageState.action === 'verifyAlphabotRaffle'
  ) {
    console2.log('set isAutoStarted = true');
    pageState.isAutoStarted = true;
    runRaffle = true;
  }

  if (!pageState.permissions?.enabled) {
    showNoSubscriptionStatusbar(pageState.statusbar.warn);
    runRaffle = false;
    pageState.isAutoStarted = false;
  }

  await showRafflePage(runRaffle);
}

// RAFFLE FUNCS -----------------------------------------------------------------------------------------

async function showRafflePage(runPage) {
  console2.log('showRafflePage', runPage);

  if (!isEnabled()) {
    return exitAction('providerDisabled');
  }

  await provider.waitForRafflePageLoaded(storage.options);

  provider.addPreviouslyWonWallets(pageState);

  provider.loadRafflePageWithCustomContent();

  if (provider.hasRegistered()) {
    return exitAction('registered');
  }

  if (provider.isPendingReg()) {
    await waitForRegistered();
  }

  await addQuickRegButton();

  if (!checkIfSubscriptionEnabled(pageState.permissions, false, pageState.statusbar.warn)) {
    return;
  }

  if (provider.isIgnored(storage.options, pageState)) {
    console2.log('ignored 2');
    return exitAction('ignoredRaffle');
  }

  if (await handleSimpleErrors()) {
    return;
  }

  waitForRegisteredMainLoop();

  if (runPage) {
    runRafflePage();
  }
}

async function runRafflePage() {
  console2.log('runRafflePage');

  if (!isEnabled()) {
    return exitAction('providerDisabled');
  }

  await provider.waitForRafflePageLoaded(storage.options);

  if (provider.hasRegistered()) {
    return exitAction('registered');
  }

  if (!provider.hasRaffleTrigger()) {
    return exitAction('noRaffleTrigger');
  }

  await sleep(100);

  if (provider.isIgnored(storage.options, pageState)) {
    console2.log('ignored 1');
    return exitAction('ignoredRaffle');
  }

  if (!provider.hasRaffleTrigger2(storage.options)) {
    return exitAction('noRaffleTrigger');
  }

  joinRaffle();
}

async function joinRaffle() {
  console2.info('Start joining raffle...');

  if (!checkIfSubscriptionEnabled(pageState.permissions, true, pageState.statusbar.warn)) {
    return;
  }

  await reloadStorage();

  pageState.abort = false;

  updateStatusbarRunning('Fulfilling raffle tasks...');
  startQuickRegBtn();

  if (provider.skipReqsIfReady && provider.skipReqsIfReady()) {
    console2.log('ready to register, skip reqs');
    registerRaffle();
    return waitForRegistered();
  }

  const reqs = getRequirements();
  pageState.reqs = reqs;
  console2.info('Task requirements:', reqs);

  if (provider.visitTwitterLinks) {
    // await visitTwitterLinks();
  }

  const skipDoneTasks = pageState.action === 'retryJoin' || storage.options.RAFFLE_SKIP_DONE_TASKS;
  const discordLinks = skipDoneTasks
    ? await removeDoneLinks(reqs.discordUserNorm, reqs.discordLinks, pageState)
    : reqs.discordLinks;
  let twitterIntentLinks = skipDoneTasks
    ? await removeDoneLinks(reqs.twitterUserNorm, reqs.twitterIntentLinks, pageState)
    : reqs.twitterIntentLinks;

  if (provider.shouldOpenTwitterTasks && !provider.shouldOpenTwitterTasks()) {
    console2.log('Should not open twitter tasks, empty link list');
    twitterIntentLinks = [];
  }

  const reqLinks = [...discordLinks, ...twitterIntentLinks];
  console2.log('reqLinks', reqLinks);

  if (reqLinks.length) {
    await getMyTabIdFromExtension(pageState, 5000);
    if (!pageState.myTabId) {
      console2.error('Invalid myTabId');
      return exitAction('invalidContext');
    }
  }

  if (discordLinks.length) {
    storage.runtime.pendingDiscordJoin = JSON.stringify(new Date());
    await setStorageData(storage);
  }

  reqLinks.forEach((link) => pageState.pendingRequests.push(normalizePendingLink(link)));
  console2.info('Pending requests to open:', pageState.pendingRequests);

  pageState.twitterLinkSuffix = `#id=${pageState.myTabId}&user=${
    storage.options.RAFFLE_SWITCH_TWITTER_USER ? reqs.twitterUser : ''
  }&${createLogLevelArg()}`;

  for (let i = 0; i < reqLinks.length; i++) {
    if (pageState.abort) {
      return exitAction('abort');
    }
    const reqLink = reqLinks[i];
    const mustJoinWithRole = reqs.mustJoinWithRoleLinks.links.some((x) => x === reqLink);
    if (mustJoinWithRole) {
      pageState.haveRoleDiscordLink = true;
      pageState.roleDiscordLinks = pageState.roleDiscordLinks || [];
      pageState.roleDiscordLinks.push(reqLink);
      console2.log('pageState.haveRoleDiscordLink', pageState.haveRoleDiscordLink);
      console2.log('pageState.roleDiscordLinks', pageState.roleDiscordLinks);
    }

    const url = reqLink + pageState.twitterLinkSuffix;

    const isTwitter = isTwitterURL(reqLink);
    const userNorm = isTwitter
      ? normalizeTwitterHandle(reqs.twitterUser)
      : normalizeDiscordHandle(reqs.discordUser);

    if (isTwitter) {
      pageState.twitterUser = reqs.twitterUser;
    }

    if (!isTwitter) {
      // Only add discord links to history at once; add twitter links when they are finished!
      await pageState.history.add(userNorm, reqLink);
    }

    console2.log('Open URL:', url);
    if (storage.options.RAFFLE_OPEN_LINKS_IN_FOREGROUND) {
      window.open(url, '_blank');
    } else {
      chrome.runtime.sendMessage({ cmd: 'openTab', url });
    }

    if (isTwitter && storage.options.TWITTER_QUEUE_TASK_LINKS) {
      console2.log('Open rest of twitter links in queue!');
      break;
    }

    if (i + 1 < reqLinks.length) {
      const delayMs = Math.round(
        isTwitter
          ? storage.options.RAFFLE_OPEN_AT_ONCE_TWITTER_LINK_DELAY
          : storage.options.RAFFLE_OPEN_DISCORD_LINK_DELAY
      );
      await sleep(delayMs, null, 0.2);
    }
  }
  // await visitTwitterLinks();

  await pageState.history.save();

  await sleep(50, 100);

  if (!pageState.request?.retries) {
    waitForRegistered();
  }

  if (!reqLinks.length) {
    if (provider.visitTwitterLinks) {
      await visitTwitterLinks();
    }
    registerRaffle();
  }

  waitForRegistered();
}

async function visitTwitterLinks() {
  if (pageState.visitedTwitterLinks) {
    console.log('Already visitedTwitterLinks');
    return;
  }
  pageState.visitedTwitterLinks = true;
  const reqs = pageState.reqs;
  console.log('visitTwitterLinks', reqs, reqs.mustFollowLinks.elems);
  const duration = VISIT_TWITTER_LINK_DURATION;
  const interval = VISIT_TWITTER_LINK_INTERVAL;
  for (let elem of reqs.mustFollowLinks.elems) {
    console.log('elem', elem);
    const url = elem.href;
    console.log('url', url);
    await addPendingRequest(url, { action: 'visit', url, duration });
    await sleep(300);
    console.info('Click twitter link:', url, elem);
    clickElement(elem, { real: false, simulate: true });
    // elem.click();
    // window.open(url, '_blank');
    // chrome.runtime.sendMessage({ cmd: 'openTab', url });
    await sleep(interval);
  }
  if (reqs.mustFollowLinks.elems?.length) {
    await sleep(duration - interval);
  }
}

// REGISTER ----------------------------------------------------------------------------------

async function registerRaffle(focusTab = true, checkIfReady = true) {
  console2.info('Register raffle', focusTab);

  pageState.pause = false;

  if (!pageState.pause) {
    // return; // todo
  }

  if (checkForJoinWithWonWallet()) {
    return exitAction('joinWithWonWallet');
  }

  updateStatusbarRunning('Joining raffle...');
  if (focusTab) {
    console2.log('focusTab');
    chrome.runtime.sendMessage({ cmd: 'focusMyTab' });
  }

  const regBtn = await provider.getRegisterButton(storage.options);
  if (!regBtn) {
    return exitAction('noRaffleRegisterBtn');
  }
  console2.log('registerRaffle; regBtn:', regBtn);

  if (provider.hasCaptcha()) {
    return handleRaffleCaptcha();
  }

  while (checkIfReady && provider.readyToRegister && !provider.readyToRegister()) {
    console2.info('Wait until ready to register...');
    await sleep(500);
  }

  if (regBtn && !regBtn.disabled) {
    await provider.setPendingReg();
    if (pageState.request?.retries) {
      console2.info('Wait some time before clicking reg button when retrying');
      await sleep(1500);
    }
    console2.info('Click register button:', regBtn);
    if (provider.register) {
      await provider.register(regBtn, pageState);
    } else {
      clickElement(regBtn);
    }
    pageState.isRegistering = true;
  }

  if (pageState.request?.retries) {
    console2.info('Wait some time to let prev errors clear first when retrying register after errors!');
    await sleep(1500);
    await waitForRegistered();
  }

  console2.info('Done with register raffle');
  //await waitForRegistered();
}

async function waitForRegistered(maxWait = 1 * ONE_MINUTE, interval = 100) {
  console2.info('Wait for raffle registered...');

  const stopTime = millisecondsAhead(getWaitForRegistered() || maxWait);

  while (Date.now() <= stopTime) {
    if (
      await provider.handleComplexErrors(pageState, {
        handleRaffleCaptcha,
        handleDiscordCaptcha,
        exitAction,
        waitAndTryRegisterOneLastTime,
        waitAndTryRegisterBeforeRetry,
      })
    ) {
      return;
    }

    if (provider.hasCaptcha()) {
      return handleRaffleCaptcha();
    }

    if (provider.hasAlreadyWon()) {
      return exitAction('alreadyWon');
    }

    if (provider.hasWalletConnectDialog()) {
      return exitAction('walletConnectDialog');
    }

    if (provider.hasDoingItTooOften()) {
      return exitAction('doingItTooOften');
    }

    if (provider.hasRegistered()) {
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

  if (provider.hasRegistered()) {
    return exitAction('registered');
  }

  if (!pageState.pause) {
    return waitAndTryRegisterOneLastTime();
  }
  pageState.pause = false;

  console2.log('Stop waiting for registered!');
}

async function waitAndTryRegisterOneLastTime() {
  console2.log('waitAndTryRegisterOneLastTime', pageState);

  if (!provider.enableForceRegister) {
    return exitAction('notRegisterProperly');
  }

  if (pageState.pause || pageState.done) {
    console2.log('skip waitAndTryRegisterOneLastTime because pause or done', pageState);
    return;
  }

  // We have retried max number of times, now we can as well
  // wait for register button one last time and try to register!
  console2.log('waitAndTryRegisterOneLastTime', pageState);

  const waitSecs = 600;

  updateStatusbarRunning(`Raffle error? Wait for register button ${waitSecs} secs and try again...`);
  chrome.runtime.sendMessage({ cmd: 'focusTab', id: pageState.discordCaptchaTabId });

  const stopTime = millisecondsAhead(waitSecs * 1000);
  while (Date.now() <= stopTime && storage.options.RAFFLE_FORCE_REGISTER) {
    console2.log('try to forceRegister');
    const regBtn = await provider.forceRegister(storage.options, pageState);
    if (regBtn) {
      console2.log('forceRegister ok!');
      return waitForRegisteredMainLoop(regBtn);
    }
    if (provider.hasRegistered()) {
      return exitAction('registered');
    }
    if (provider.SLEEP_BETWEEN_WAIT_FOR_REGISTERED) {
      await sleep(provider.SLEEP_BETWEEN_WAIT_FOR_REGISTERED);
    } else {
      await sleep(1500);
    }
  }

  if (provider.hasRegistered()) {
    return exitAction('registered');
  }

  return exitAction('raffleUnknownError');
}

async function waitAndTryRegisterBeforeRetry(retries) {
  if (!provider.enableForceRegister) {
    return;
  }
  console2.log('waitAndTryRegisterBeforeRetry; retries:', retries);

  const stopTime = millisecondsAhead(storage.options.RAFFLE_RETRY_SECS * 1000);
  while (Date.now() <= stopTime) {
    if (storage.options.RAFFLE_FORCE_REGISTER) {
      console2.log('try to forceRegister');
      const regBtn = await provider.forceRegister(storage.options, pageState, { retryJoin });
      if (regBtn) {
        console2.log('forceRegister ok!');
        return waitForRegisteredMainLoop(regBtn);
      } else {
        if (provider.hasRegistered()) {
          return exitAction('registered');
        }
      }
    }
    if (provider.SLEEP_BETWEEN_WAIT_FOR_REGISTERED) {
      await sleep(provider.SLEEP_BETWEEN_WAIT_FOR_REGISTERED);
    } else {
      await sleep(1500);
    }
  }

  if (provider.hasRegistered()) {
    return exitAction('registered');
  }

  await retryJoin(retries);
}

async function retryJoin(retries = null) {
  if (!retries) {
    retries = pageState.request?.retries
      ? pageState.request?.retries - 1
      : storage.options.RAFFLE_RETRY_TIMES;
  }
  await addPendingRequest(window.location.href, { action: 'retryJoin', retries });
  window.location.reload();
}

async function waitForRegisteredMainLoop(regBtn = null, maxWait = 300 * ONE_MINUTE, interval = 1000) {
  console2.log('Wait for raffle to register (main loop)...');

  const stopTime = millisecondsAhead(maxWait);

  while (Date.now() <= stopTime) {
    if (regBtn) {
      if (provider.hasDoingItTooOften()) {
        return console2.log('hasDoingItTooOften');
      }
      if (provider.isAllRegBtnsEnabled(storage.options)) {
        clickElement(regBtn);
      } else {
        console2.log('Not isAllRegBtnsEnabled');
      }
    }
    if (provider.hasRegistered()) {
      return exitAction('registered');
    }
    if (provider.hasCaptcha()) {
      handleRaffleCaptcha();
    }
    if (regBtn) {
      // await sleep(1000);
    }
    if (provider.SLEEP_BETWEEN_WAIT_FOR_REGISTERED) {
      await sleep(provider.SLEEP_BETWEEN_WAIT_FOR_REGISTERED);
    } else {
      await sleep(interval);
    }
  }

  console2.log('Stop waiting for registered in main loop');
}

// HANDLERS ----------------------------------------------------------------------------------

async function handleSimpleErrors() {
  return await provider.handleSimpleErrors(exitAction);
}

// EXIT ACTIONS -------------------------------------------------------------------

function exitAction(result, options = {}) {
  const context = {
    updateStatusbar,
    updateStatusbarError,
    updateStatusbarWarn,
    updateStatusbarInfo,
    updateStatusbarOk,
    removeQuickRegBtn,
    resetQuickRegBtn,
    forceRegister: provider.forceRegister,
    pageState,
    options: storage.options,
    storage,
  };
  exitActionMain(result, context, options);
}

// GUI -----------------------------------------------------------------------------------------

async function addQuickRegButton() {
  const quickRegBtn = getQuickRegBtn();
  console2.log('quickRegBtn', quickRegBtn);
  if (quickRegBtn) {
    console2.log('QuickReg button already exists');
    return;
  }

  console2.info('Add Premint Helper QuickReg button');
  provider.addQuickRegButton(storage.options, quickRegClickHandler);
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
    setQuickRegButton(provider.JOIN_BUTTON_TEXT);
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
    setQuickRegButton(provider.JOIN_BUTTON_IN_PROGRESS_TEXT);
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
  const twitterUser = provider.getTwitterUser();
  const mustFollowLinks = getMustFollowLinks();
  const mustLikeLinks = getMustLikeLinks();
  const mustRetweetLinks = getMustRetweetLinks();
  const mustLikeAndRetweetLinks = getMustLikeAndRetweetLinks();
  const twitterElems = isTwitterTasksEnabled()
    ? [...mustFollowLinks.elems, ...mustLikeLinks.elems, ...mustRetweetLinks.elems]
    : [];
  const twitterLinks = isTwitterTasksEnabled()
    ? noDuplicates(mustFollowLinks.links, mustLikeLinks.links, mustRetweetLinks.links)
    : [];
  const twitterIntentLinks = isTwitterTasksEnabled()
    ? noDuplicates(mustFollowLinks.intentLinks, mustLikeLinks.intentLinks, mustRetweetLinks.intentLinks)
    : [];

  const discordUser = provider.getDiscordUser();
  const mustJoinLinks = getMustJoinLinks();
  const mustJoinWithRoleLinks = getMustJoinWithRoleLinks();
  const discordLinks = isDiscordTasksEnabled() ? noDuplicates(mustJoinLinks.links) : [];

  const result = {
    twitterUser,
    twitterUserNorm: normalizeTwitterHandle(twitterUser),
    discordUser,
    discordUserNorm: normalizeDiscordHandle(discordUser),
    mustFollowLinks,
    mustLikeLinks,
    mustRetweetLinks,
    mustLikeAndRetweetLinks,
    mustJoinLinks,
    mustJoinWithRoleLinks,
    twitterElems,
    twitterLinks,
    twitterIntentLinks,
    discordLinks,
    links: [...twitterLinks, ...discordLinks],
  };

  return result;
}

export function getRequirements2() {
  const twitterUser = provider.getTwitterUser();
  const discordUser = provider.getDiscordUser();

  const mustFollowLinks = getMustFollowLinks();
  const mustLikeLinks = getMustLikeLinks();
  const mustRetweetLinks = getMustRetweetLinks();
  const mustLikeAndRetweetLinks = getMustLikeAndRetweetLinks();
  const mustJoinLinks = getMustJoinLinks();
  const mustJoinWithRoleLinks = getMustJoinWithRoleLinks();

  const twitterLinks = isTwitterTasksEnabled()
    ? noDuplicates(mustFollowLinks, mustLikeLinks, mustRetweetLinks)
    : [];
  const discordLinks = isDiscordTasksEnabled() ? noDuplicates(mustJoinLinks) : [];

  const result = {
    twitterUser,
    twitterUserNorm: normalizeTwitterHandle(twitterUser),
    discordUser,
    discordUserNorm: normalizeDiscordHandle(discordUser),
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

// GET -----------------

function getMustFollowLinks() {
  const data = provider.getMustFollowLinks(storage.options);
  return {
    ...data,
    intentLinks: data.links.map((x) => makeTwitterFollowIntentUrl(x)),
  };
}

function getMustLikeAndRetweetLinks() {
  const data = provider.getMustRetweetLinks(storage.options);
  return {
    ...data,
    intentLinks: [],
  };
}

function getMustRetweetLinks() {
  const data1 = provider.getMustRetweetLinks(storage.options);
  const data2 = provider.getMustLikeAndRetweetLinks(storage.options);
  const data = {
    elems: [...data1.elems, ...data2.elems],
    links: noDuplicates([...data1.links, ...data2.links]),
  };
  return {
    ...data,
    intentLinks: data.links.map((x) => makeTwitterRetweetIntentUrl(x)),
  };
}

function getMustLikeLinks() {
  const data1 = provider.getMustLikeLinks(storage.options);
  const data2 = provider.getMustLikeAndRetweetLinks(storage.options);
  const data = {
    elems: [...data1.elems, ...data2.elems],
    links: noDuplicates([...data1.links, ...data2.links]),
  };
  return {
    ...data,
    intentLinks: data.links.map((x) => makeTwitterLikeIntentUrl(x)),
  };
}

function getMustJoinLinks() {
  return provider.getMustJoinLinks(storage.options, false);
}

function getMustJoinWithRoleLinks() {
  return provider.getMustJoinLinks(storage.options, true);
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

function updateStatusbarWarn(content) {
  pageState.statusbar.warn(content);
}

function updateStatusbarInfo(content) {
  pageState.statusbar.info(content);
}

function updateStatusbarRunning(content) {
  pageState.statusbar.text(content, 'running');
}

// WON WALLETS

function checkForJoinWithWonWallet() {
  console2.info('Check if alrady won with wallet');

  const wonWallets = getWonWallets().map((x) => x.toLowerCase());
  console2.log('Won with wallets:', wonWallets);
  if (!wonWallets.length) {
    return false;
  }

  const selectedWallet = provider.getSelectedWallet();
  console2.info('Selected wallet:', selectedWallet);
  if (!selectedWallet) {
    return false;
  }

  selectedWallet.shortWallet = selectedWallet.shortWallet.toLowerCase();
  selectedWallet.longWallet = selectedWallet.longWallet.toLowerCase();
  selectedWallet.shortPrefix = selectedWallet.shortPrefix.toLowerCase();
  selectedWallet.shortSuffix = selectedWallet.shortSuffix.toLowerCase();

  if (wonWallets.includes(selectedWallet.shortWallet)) {
    console2.info('Already won with wallet:', selectedWallet.shortWallet);
    console2.log('checkForJoinWithWonWallet shortWallet hit!', selectedWallet, wonWallets);
    return true;
  }

  if (wonWallets.includes(selectedWallet.longWallet)) {
    console2.info('Already won with wallet:', selectedWallet.longWallet);
    console2.log('checkForJoinWithWonWallet longWallet hit!', selectedWallet, wonWallets);
    return true;
  }

  if (selectedWallet.shortPrefix && selectedWallet.shortSuffix) {
    if (
      wonWallets.find(
        (x) => x.startsWith(selectedWallet.shortPrefix) && x.endsWith(selectedWallet.shortSuffix)
      )
    ) {
      console2.info('Already won with wallet:', selectedWallet.shortPrefix, selectedWallet.shortSuffix);
      console2.log('checkForJoinWithWonWallet prefix/suffix hit!', selectedWallet, wonWallets);
      return true;
    }
  }
  console2.log('checkForJoinWithWonWallet no hit!');

  return false;
}

function getWonWallets() {
  const w1 = provider.getWonWalletsByThisAccount();
  const w2 = provider.getWonWalletsByAllAccounts();
  const wonWallets = noDuplicates([...w1, ...w2].map((x) => x.toLowerCase()));
  console2.log('getWonWallets:', w1, w2, wonWallets);
  return wonWallets;
}

// CAPTCHA -------------------------------------

async function handleRaffleCaptcha() {
  console2.log('handleRaffleCaptcha');

  if (pageState.hasHandledRaffleCaptcha) {
    return;
  }
  pageState.hasHandledRaffleCaptcha = true;
  exitAction('raffleCaptcha');

  if (!provider.enableForceRegister) {
    return;
  }

  const stopTime = millisecondsAhead(60 * 1000);
  while (Date.now() <= stopTime) {
    console2.log('try to handleRaffleCaptcha with forceRegister');
    if (await provider.forceRegister(storage.options, pageState)) {
      console2.log('forceRegister ok!');
      return waitForRegisteredMainLoop();
    } else {
      console2.log('forceRegister NOK!');
    }
    await sleep(1500);
  }
}

async function handleDiscordCaptcha() {
  pageState.hasDiscordCaptcha = true;
  exitAction('discordCaptcha');
  chrome.runtime.sendMessage({ cmd: 'focusTab', id: pageState.discordCaptchaTabId });
  pageState.stopFocusTabs = true;
}

// MISC HELPERS -------------------------------------

async function reloadStorage() {
  const keys = provider.storageKeys?.length ? provider.storageKeys : ['options'];
  storage = await loadStorage({ keys });
  await provider.setStorage(storage);
  console2.info('storage', storage);
}
