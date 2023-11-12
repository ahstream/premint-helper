import {
  STATUSBAR_DEFAULT_TEXT,
  createStatusbarButtons,
  exitActionMain,
  getMyTabIdFromExtension,
  checkIfSubscriptionEnabled,
  showNoSubscriptionStatusbar,
  removeDoneLinks,
  finishTask,
  finishUnlockedTwitterAccount,
  clickElement,
} from './premintHelperLib';

import {
  ONE_MINUTE,
  createLogger,
  createLogLevelArg,
  getStorageItems,
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
import { createStatusbar } from 'hx-statusbar';

const debug = createLogger();

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

// INIT ----------------------------------------------------------------------------

export async function initRafflePage(raffleProvider) {
  console.log('initRafflePage, provider:', raffleProvider?.name);
  provider = raffleProvider;

  await loadStorage();

  if (!storage?.options) {
    return debug.info('Options missing, exit!');
  }

  if (!isEnabled()) {
    return debug.info('Raffle provider disabled, exit!');
  }

  initEventHandlers();

  pageState.observer = await provider.createObserver();

  window.addEventListener('load', onLoad);
  window.addEventListener('DOMContentLoaded', onLoad);
}

async function onLoad() {
  debug.log('onLoad');

  if (pageState.loaded) {
    return debug.log('Page already loaded, ignore load event!');
  }
  pageState.loaded = true;

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
      statusbar: createStatusbar(STATUSBAR_DEFAULT_TEXT),
      history: await createHistory(),
      permissions: await getPermissions(),
      lastURL: window.location.href,
      finishedTabsIds: [],
    },
  };

  debug.log('pageState', pageState);

  showPage();
}

function initEventHandlers() {
  chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    debug.log('Received message:', request, sender);

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

    if (request.cmd === 'finish') {
      return finishTask(request, sender, {
        pageState,
        exitAction,
        handleDiscordCaptcha,
        registerRaffle,
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

function getStatusbarBtnOptions() {
  return (
    provider?.statusbarBtnOptions || {
      options: true,
      results: true,
      reveal: 'disabled',
      followers: 'disabled',
    }
  );
}

// PAGE FUNCS ----------------------------------------------------------------------------------

async function showPage() {
  debug.log('showPage; pageState:', pageState);

  pageState.statusbar.buttons(createStatusbarButtons(getStatusbarBtnOptions()));

  if (!pageState.action) {
    await sleep(100);
    const request = await dispatch(window.location.href, 5 * 60);
    debug.log('Dispatched request:', request);
    pageState.request = request;
    pageState.action = request?.action;
  }

  let runRaffle = false;

  if (
    pageState.action === 'shortcut' ||
    pageState.action === 'retryJoin' ||
    pageState.action === 'verifyAlphabotRaffle'
  ) {
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
  debug.log('showRafflePage', runPage);

  if (!isEnabled()) {
    return exitAction('providerDisabled');
  }

  await provider.waitForRafflePageLoaded();

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

  if (provider.isIgnored(pageState)) {
    console.log('ignored 2');
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
  debug.log('runRafflePage');

  if (!isEnabled()) {
    return exitAction('providerDisabled');
  }

  await provider.waitForRafflePageLoaded();

  if (provider.hasRegistered()) {
    return exitAction('registered');
  }

  if (!provider.hasRaffleTrigger()) {
    return exitAction('noRaffleTrigger');
  }

  await sleep(100);

  if (provider.isIgnored(pageState)) {
    console.log('ignored 1');
    return exitAction('ignoredRaffle');
  }

  if (!provider.hasRaffleTrigger2()) {
    return exitAction('noRaffleTrigger');
  }

  joinRaffle();
}

async function joinRaffle() {
  debug.log('joinRaffle');

  if (!checkIfSubscriptionEnabled(pageState.permissions, true, pageState.statusbar.warn)) {
    return;
  }

  await loadStorage();

  pageState.abort = false;

  updateStatusbarRunning('Fulfilling raffle tasks...');
  startQuickRegBtn();

  if (provider.skipReqsIfReady && provider.skipReqsIfReady()) {
    console.log('ready to register, skip reqs');
    registerRaffle();
    return waitForRegistered();
  }

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

    const isTwitter = isTwitterURL(reqLink);
    const user = isTwitter ? reqs.twitterUser : reqs.discordUser;

    if (isTwitter) {
      pageState.twitterUser = reqs.twitterUser;
    }

    if (!isTwitter) {
      // Only add discord links to history at once; add twitter links when they are finished!
      await pageState.history.add(user, reqLink);
    }

    debug.log('Open URL:', url);
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
          : storage.options.RAFFLE_OPEN_DISCORD_LINK_DELAY
      );
      await sleep(delayMs, null, 0.2);
    }
  }

  await pageState.history.save();

  await sleep(50, 100);

  if (!pageState.request?.retries) {
    waitForRegistered();
  }

  if (!reqLinks.length) {
    registerRaffle();
  }

  waitForRegistered();
}

// REGISTER ----------------------------------------------------------------------------------

async function registerRaffle(focusTab = true, checkIfReady = true) {
  console.info('Register raffle; focusTab:', focusTab);

  pageState.pause = false;

  if (!pageState.pause) {
    // return; // todo
  }

  if (checkForJoinWithWonWallet()) {
    return exitAction('joinWithWonWallet');
  }

  updateStatusbarRunning('Joining raffle...');
  if (focusTab) {
    console.info('focusTab');
    chrome.runtime.sendMessage({ cmd: 'focusMyTab' });
  }

  const regBtn = await provider.getRegisterButton();
  if (!regBtn) {
    return exitAction('noRaffleRegisterBtn');
  }
  debug.log('registerRaffle; regBtn:', regBtn);

  if (provider.hasCaptcha()) {
    return handleRaffleCaptcha();
  }

  while (checkIfReady && provider.readyToRegister && !provider.readyToRegister()) {
    console.log('wait until ready to register');
    await sleep(500);
  }

  if (regBtn && !regBtn.disabled) {
    await provider.setPendingReg();
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

  //await waitForRegistered();
}

async function waitForRegistered(maxWait = 1 * ONE_MINUTE, interval = 100) {
  debug.info('Wait for registered...');

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

  debug.log('Stop waiting for registered!');
}

async function waitAndTryRegisterOneLastTime() {
  if (!provider.enableForceRegister) {
    return exitAction('notRegisterProperly');
  }

  // We have retried max number of times, now we can as well
  // wait for register button one last time and try to register!
  debug.log('waitAndTryRegisterOneLastTime');

  const waitSecs = 600;

  updateStatusbarRunning(`Raffle error? Wait for register button ${waitSecs} secs and try again...`);

  const stopTime = millisecondsAhead(waitSecs * 1000);
  while (Date.now() <= stopTime && storage.options.RAFFLE_FORCE_REGISTER) {
    debug.log('try to forceRegister');
    const regBtn = provider.forceRegister();
    if (regBtn) {
      debug.log('forceRegister ok!');
      return waitForRegisteredMainLoop(regBtn);
    }
    await sleep(1000);
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
  debug.log('waitAndTryRegisterBeforeRetry; retries:', retries);

  const stopTime = millisecondsAhead(storage.options.RAFFLE_RETRY_SECS * 1000);
  while (Date.now() <= stopTime) {
    if (storage.options.RAFFLE_FORCE_REGISTER) {
      debug.log('try to forceRegister');
      const regBtn = provider.forceRegister();
      if (regBtn) {
        debug.log('forceRegister ok!');
        return waitForRegisteredMainLoop(regBtn);
      } else {
        if (provider.hasRegistered()) {
          return exitAction('registered');
        }
      }
    }
    await sleep(1000);
  }

  if (provider.hasRegistered()) {
    return exitAction('registered');
  }

  await addPendingRequest(window.location.href, { action: 'retryJoin', retries });
  window.location.reload();
}

async function waitForRegisteredMainLoop(regBtn = null, maxWait = 300 * ONE_MINUTE, interval = 1000) {
  debug.log('Wait for registered main loop...');

  const stopTime = millisecondsAhead(maxWait);

  while (Date.now() <= stopTime) {
    if (regBtn) {
      if (provider.hasDoingItTooOften()) {
        return debug.log('hasDoingItTooOften');
      }
      if (provider.isAllRegBtnsEnabled()) {
        clickElement(regBtn);
      } else {
        console.log('Not isAllRegBtnsEnabled');
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
    await sleep(interval);
  }

  debug.log('Stop waiting for registered in main loop');
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
  debug.log('addQuickRegButton');

  const quickRegBtn = getQuickRegBtn();
  debug.log('quickRegBtn', quickRegBtn);
  if (quickRegBtn) {
    return debug.log('quickRegBtn already present, do nothing');
  }

  provider.addQuickRegButton(quickRegClickHandler);
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

// GET -----------------

function getMustFollowLinks() {
  return provider.parseMustFollowLinks().map((x) => makeTwitterFollowIntentUrl(x));
}

function getMustLikeAndRetweetLinks() {
  return [...new Set([...provider.parseMustRetweetLinks()])];
}

function getMustRetweetLinks() {
  const links = [
    ...new Set(
      [...provider.parseMustRetweetLinks(), ...provider.parseMustLikeAndRetweetLinks()].map((x) =>
        makeTwitterRetweetIntentUrl(x)
      )
    ),
  ];
  return links;
}

function getMustLikeLinks() {
  const links = [
    ...new Set(
      [...provider.parseMustLikeLinks(), ...provider.parseMustLikeAndRetweetLinks()].map((x) =>
        makeTwitterLikeIntentUrl(x)
      )
    ),
  ];
  return links;
}

function getMustJoinLinks() {
  return provider.parseMustJoinLinks(false);
}

function getMustJoinWithRoleLinks() {
  return provider.parseMustJoinLinks(true);
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
  const wonWallets = getWonWallets().map((x) => x.toLowerCase());
  debug.log('wonWallets', wonWallets);
  if (!wonWallets.length) {
    return false;
  }

  const selectedWallet = provider.getSelectedWallet();
  debug.log('selectedWallet', selectedWallet);
  if (!selectedWallet) {
    return false;
  }

  selectedWallet.shortWallet = selectedWallet.shortWallet.toLowerCase();
  selectedWallet.longWallet = selectedWallet.longWallet.toLowerCase();
  selectedWallet.shortPrefix = selectedWallet.shortPrefix.toLowerCase();
  selectedWallet.shortSuffix = selectedWallet.shortSuffix.toLowerCase();

  if (wonWallets.includes(selectedWallet.shortWallet)) {
    console.log('checkForJoinWithWonWallet shortWallet hit!', selectedWallet, wonWallets);
    return true;
  }

  if (wonWallets.includes(selectedWallet.longWallet)) {
    console.log('checkForJoinWithWonWallet longWallet hit!', selectedWallet, wonWallets);
    return true;
  }

  if (selectedWallet.shortPrefix && selectedWallet.shortSuffix) {
    if (
      wonWallets.find(
        (x) => x.startsWith(selectedWallet.shortPrefix) && x.endsWith(selectedWallet.shortSuffix)
      )
    ) {
      console.log('checkForJoinWithWonWallet prefix/suffix hit!', selectedWallet, wonWallets);
      return true;
    }
  }
  console.log('checkForJoinWithWonWalletno hit!');

  return false;
}

function getWonWallets() {
  const w1 = provider.getWonWalletsByThisAccount();
  const w2 = provider.getWonWalletsByAllAccounts();
  const wonWallets = noDuplicates([...w1, ...w2].map((x) => x.toLowerCase()));
  console.log('getWonWallets:', w1, w2, wonWallets);
  return wonWallets;
}

// CAPTCHA -------------------------------------

async function handleRaffleCaptcha() {
  debug.log('handleRaffleCaptcha');

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
    debug.log('try to handleRaffleCaptcha with forceRegister');
    if (provider.forceRegister()) {
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
  pageState.stopFocusTabs = true;
}

// MISC HELPERS -------------------------------------

async function loadStorage(key = null) {
  if (!key) {
    storage = await getStorageItems(provider.storageKeys);
  } else {
    const storageTemp = await getStorageItems([key]);
    storage[key] = storageTemp[key];
  }
  provider.setStorage(storage);
  debug.log('loadStorage:', key, storage);
}
