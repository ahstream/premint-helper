import {
  sleep,
  millisecondsAhead,
  addPendingRequest,
  pluralize,
  dynamicSortMultiple,
  normalizePendingLink,
  isTwitterURL,
  simulateClick,
  myConsole,
  getStorageData,
  setStorageData,
  getStorageItems,
  // setStorageData,
} from 'hx-lib';

import { raidTwitterPost } from './raid';

import { createStatusbar as createStatusbarMain } from 'hx-statusbar';

const console2 = myConsole();

// DATA ----------------------------------------------------------------------------------

const GLOBAL_REAL_CLICK_ELEMENT = true;
const GLOBAL_SIMULATE_CLICK_ELEMENT = true;

export const JOIN_BUTTON_TEXT = 'PH Auto Join';
export const JOIN_BUTTON_IN_PROGRESS_TEXT = 'PH Auto Join in progress...';
export const JOIN_BUTTON_TITLE = 'Automatically try to fulfill all raffle tasks and then register for raffle';
export const STATUSBAR_DEFAULT_TEXT = 'Premint Helper';

// FUNCTIONS ----------------------------------------------------------------------------------

/*
const premiumFeatures = [
  'Auto Join button on Alphabot.app raffles that automatically fulfills raffle task requirements and join raffle',
  'Show wallets that have already won Alphabot raffles (on all accounts)',
  'Warn when trying to enter raffle with already won wallet',
  'Alphabot results page showing all won raffles',
  'Cloud functionality to show won raffles from multiple accounts',
  '(Add-On) Keyboard hotkeys for automatically joining raffles on multiple browser instances',
];

const freeFeatures = [
  'Auto Join button on Premint.xyz raffles',
  'Reveal current odds of winning Alphabot raffles',
  'Show Twitter follower counts on Alphabot raffles',
];
*/

const NO_SUBSCRIPTION_STATUSBAR_TEXT = 'No active Premint Helper subscription, premium features disabled';

export function checkIfSubscriptionEnabled(permissions, doAlert, updateStatusbarFn) {
  if (!permissions?.enabled) {
    showNoSubscriptionStatusbar(updateStatusbarFn);
    if (doAlert) {
      /*
      const premiumText = premiumFeatures.join('\n* ');
      const freeText = freeFeatures.join('\n* ');
      window.alert(
        `No active Premint Helper subscription! These premium features are disabled:\n\n* ${premiumText}\n\nThe features are free:\n\n* ${freeText}`
      );
      */
      window.alert(`No active Premint Helper subscription! Premium features are disabled.`);
    }
    return false;
  }
  return true;
}

export function showNoSubscriptionStatusbar(updateStatusbarFn) {
  updateStatusbarFn(NO_SUBSCRIPTION_STATUSBAR_TEXT);
}

export function accountToAlias(account, options) {
  if (!account || !account.length) {
    return '';
  }
  const items = options.ACCOUNT_ALIAS.filter((x) => x.endsWith(`${account}`));
  const result = items.length ? items[0].replace(`${account}`, '').replace(':', '').trim() : '';
  return result;
}

export function walletToAlias(wallet, options) {
  console2.trace('wallet', wallet);
  const walletLow = wallet.toLowerCase();
  console2.trace('walletToAlias:', wallet, options.WALLET_ALIAS);
  const items = options.WALLET_ALIAS.filter((x) => x.toLowerCase().endsWith(walletLow));
  return items.length ? items[0].toLowerCase().replace(`${walletLow}`, '').replace(':', '').trim() : '';
}

export function trimWallet(text) {
  if (typeof text !== 'string') {
    return '';
  }
  if (text.length < 20) {
    return text;
  }
  return text.substring(0, 2) + '...' + text.substring(text.length - 4);
}

export function toShortWallet(addr) {
  if (typeof addr !== 'string') {
    console2.log('invalid wallet:', addr);
    return '';
  }
  const text = addr.toLowerCase();
  const r = text.length < 10 ? text : `${text.substring(0, 2)}...${text.substring(text.length - 4)}`;

  return r;
}

export function trimWalletes(texts) {
  return texts.map((x) => trimWallet(x));
}

export function sortWallets(addrList, options) {
  console2.trace('addrList', addrList);
  const sortData = addrList.map((addr) => {
    console2.trace('addr', addr);
    const alias = walletToAlias(addr, options);
    const tokens = alias.split('-');
    const sortParamNumber =
      tokens.length > 1
        ? Number(tokens[tokens.length - 1])
            .toString()
            .padStart(5, '0')
        : alias;
    const sortParamName = tokens.length > 1 ? tokens[0] : alias;
    return { sortParamNumber, sortParamName, addr: addr };
  });
  sortData.sort(dynamicSortMultiple('-sortParamName', 'sortParamNumber'));
  const result = sortData.map((x) => x.addr);
  return result;
}

export function isAlphabotURL(href) {
  const url = new URL(href.toLowerCase());
  return url.host.includes('alphabot.app');
}

export async function addRevealAlphabotRafflesRequest() {
  const storage = await getStorageItems(['options']);
  const url = storage.options.ALPHABOT_REVEAL_RAFFLES_URL;
  await addPendingRequest(url, { action: 'reveal-alphabot-raffles' });
  return url;
}

function setPageBodyClass(className) {
  document.body.classList.add(className);
}

export function exitActionMain(result, context, options) {
  console2.info('Exit with action:', result, options, context);
  console2.trace('Exit with action context:', context);

  setPageBodyClass('exitAction');
  setPageBodyClass(result);

  if (result === 'joinWithWonWallet') {
    context.updateStatusbarError(
      'Selected wallet has already won a raffle! Change wallet before joining raffle.'
    );
    context.pageState.pause = true;
    context.pageState.done = true;
    focusMyTabOnce(context.pageState);
  }
  if (result === 'raffleCaptcha') {
    context.updateStatusbarError('Raffle has captcha! First solve captcha, then click register button.');
    context.pageState.pause = true;
    focusMyTabOnce(context.pageState);
  }
  if (result === 'invalidContext') {
    context.updateStatusbarError(
      'Chrome Extension is not recognized by web page. Reload extension and webpage and try again.'
    );
    context.pageState.pause = true;
    focusMyTabOnce(context.pageState);
  }
  if (result === 'raffleUnknownError') {
    context.updateStatusbarError('Raffle error');
  }
  if (result === 'unspecifiedRaffleError') {
    context.updateStatusbarError('Unspecified raffle error, see error messages on page');
  }
  if (result === 'raffleUnknownErrorWillRetry') {
    console2.log('context.forceRegister', context.forceRegister);
    if (context.forceRegister && context.forceRegister(context.storage)) {
      console2.log('forceRegister success!');
      // successful register, do nothing
    } else {
      if (options.retries) {
        handleRetries(context, options.retries, options.retrySecs);
      } else {
        context.updateStatusbarInfo(`Raffle error (2)`);
      }
      context.pageState.pause = true;
    }
  }
  if (result === 'alreadyWon') {
    context.pageState.done = true;
    context.updateStatusbarOk('You won a raffle for this project from the same team already');
    context.removeQuickRegBtn();
    context.pageState.pause = true;
    focusMyTabOnce(context.pageState);
  }
  if (result === 'walletConnectDialog') {
    context.updateStatusbarError('Raffle has wallet connect dialog, need to be done manually');
    context.pageState.pause = true;
    focusMyTabOnce(context.pageState);
  }
  if (result === 'doingItTooOften') {
    context.updateStatusbarError('Alphabot says you are doing that too often. Please try again later.');
    context.pageState.pause = true;
    focusMyTabOnce(context.pageState);
  }
  if (result === 'registered') {
    focusMyTabOnce(context.pageState);
    context.pageState.done = true;
    context.updateStatusbarOk('You are registered');
    context.removeQuickRegBtn();
    context.pageState.pause = true;
    minimizeVerifiedRaffle(context);
    minimizeRaffleWhenFinished(context);
    closeRaffleWhenFinished(context);
    cleanupRaffleWhenFinished(context);
    closeTasksWhenFinished(context);
  }
  if (result === 'notRegisterProperly') {
    context.updateStatusbarError('Raffle does not seem to register properly');
  }
  if (result === 'discordCaptcha') {
    context.updateStatusbarError('Discord has captcha! First solve captcha, then click register button.');
    context.pageState.hasDiscordCaptcha = true;
    // context.pageState.abort = true;
    context.pageState.pause = true;
  }
  if (result === 'providerDisabled') {
    context.updateStatusbar('Premint Helper automation disabled for this raffle provider');
    context.pageState.pause = true;
  }
  if (result === 'twitterLocked') {
    context.updateStatusbarError('Twitter account is locked!');
    context.pageState.pause = true;
    context.pageState.twitterLockedNotified = true;
  }
  if (result === 'alphabotDisabled') {
    context.updateStatusbar('Alphabot automation disabled, do nothing');
    context.removeQuickRegBtn();
    context.pageState.pause = true;
  }
  if (result === 'noRaffleTrigger') {
    context.updateStatusbarError('Cannot recognize raffle elements');
    context.removeQuickRegBtn();
    context.pageState.pause = true;
    focusMyTabOnce(context.pageState);
  }
  if (result === 'noRaffleRegisterBtn') {
    context.updateStatusbarError('Cannot recognize Register button');
    context.removeQuickRegBtn();
    context.pageState.pause = true;
    focusMyTabOnce(context.pageState);
  }
  if (result === 'ignoredRaffle') {
    context.updateStatusbar('Raffle is ignored');
    context.pageState.pause = true;
    minimizeVerifiedRaffle(context);
    minimizeRaffleWhenFinished(context);
    closeRaffleWhenFinished(context);
    cleanupRaffleWhenFinished(context);
    closeTasksWhenFinished(context);
  }
  if (result === 'abort') {
    // do nothing
  }

  context.resetQuickRegBtn();

  context.pageState.pause = true;

  if (context.pageState.hasDiscordCaptcha) {
    // Do nothing! If discord captcha, raffle tab has already been focused earlier, avoid flickering by focusing more than once!
  } else if (context.pageState.haveRoleDiscordLink) {
    // Do nothing! Let Discord page be focused so user can complete role verificattion!
  } else {
    //chrome.runtime.sendMessage({ cmd: 'focusMyTab' });
  }
}

function focusMyTabOnce(pageState) {
  if (pageState?.tabFocused) {
    return;
  }
  if (pageState) {
    pageState.tabFocused = true;
  }
  focusMyTab();
}

function focusMyTab() {
  chrome.runtime.sendMessage({ cmd: 'focusMyTab' });
}

function minimizeVerifiedRaffle(context) {
  if (context.pageState.action === 'verifyAlphabotRaffle') {
    console2.log('do minimizeVerifiedRaffle');
    chrome.runtime.sendMessage({ cmd: 'minimizeWindow' });
  } else {
    console2.log('do NOT minimizeVerifiedRaffle', context);
  }
}

function closeTasksWhenFinished(context) {
  if (context.options.RAFFLE_CLOSE_TASKS_WHEN_FINISHED && context.pageState.finishedTabsIds?.length) {
    console2.log('do closeTasksWhenFinished');
    chrome.runtime.sendMessage({ cmd: 'closeTabs', tabIds: context.pageState.finishedTabsIds });
  } else {
    console2.log('do NOT closeTasksWhenFinished', context);
  }
}

function minimizeRaffleWhenFinished(context) {
  if (
    context.options.RAFFLE_MINIMIZE_WHEN_FINISHED &&
    (context.pageState.isAutoStarted || context.pageState.isPendingReg)
  ) {
    console2.log('do minimizeRaffleWhenFinished');
    chrome.runtime.sendMessage({ cmd: 'minimizeWindow' });
  } else {
    console2.log('do NOT minimizeRaffleWhenFinished', context);
  }
}

function closeRaffleWhenFinished(context) {
  if (
    context.options.RAFFLE_CLOSE_WHEN_FINISHED &&
    (context.pageState.isAutoStarted || context.pageState.isPendingReg)
  ) {
    console2.log('do closeRaffleWhenFinished');
    chrome.runtime.sendMessage({ cmd: 'closeRaffleWhenFinished', url: window.location.href });
  } else {
    console2.log('do NOT closeRaffleWhenFinished', context);
  }
}

function cleanupRaffleWhenFinished(context) {
  if (
    context.options.RAFFLE_CLEANUP_WHEN_FINISHED &&
    (context.pageState.isAutoStarted || context.pageState.isPendingReg)
  ) {
    console2.log('do cleanupRaffleWhenFinished');
    chrome.runtime.sendMessage({ cmd: 'cleanupRaffleWhenFinished', url: window.location.href });
  } else {
    console2.log('do NOT cleanupRaffleWhenFinished', context);
  }
}

function handleRetries(context, retries, retrySecs) {
  if (context.pageState.done) {
    return;
  }
  context.updateStatusbar(
    `Raffle error! Will auto retry ${retries} ${pluralize(
      retries,
      'time',
      'times'
    )} in ${retrySecs} seconds...`,
    'retry'
  );
  if (retrySecs >= 1) {
    setTimeout(() => {
      handleRetries(context, retries, retrySecs - 1);
    }, 1000);
  }
}

export async function removeDoneLinks(handle, links, pageState) {
  console.log('removeDoneLinks', handle, links, pageState);
  const validLinks = [];
  for (const link of links) {
    console.log('link', link);
    if (await pageState.history.has(handle, link)) {
      continue;
    }
    validLinks.push(link);
  }
  return validLinks;
}

export async function finishUnlockedTwitterAccount(request, sender, context) {
  console2.log('finishUnlockedTwitterAccount; request, sender, context:', request, sender, context);
  const twitterLinks = [...context.pageState.pendingRequests.filter((x) => isTwitterURL(x))];

  if (context.pageState.handledUnlockedTwitterAccount) {
    return context.exitAction('twitterLocked');
  }
  context.pageState.handledUnlockedTwitterAccount = true;

  context.updateStatusbar('Retry after unlocking Twitter account...');
  context.pageState.abort = false;

  // eslint-disable-next-line no-constant-condition
  while (twitterLinks?.length) {
    const nextLink = twitterLinks.shift();
    const nextLinkUrl = 'https://' + nextLink + context.pageState.twitterLinkSuffix;
    console2.info(
      `Sleep ${context.options.RAFFLE_OPEN_QUEUED_TWITTER_LINK_DELAY} before opening next Twitter link`
    );
    await sleep(context.options.RAFFLE_OPEN_QUEUED_TWITTER_LINK_DELAY, null, 0.2);

    console2.info(`Open:`, nextLinkUrl);
    if (context.options.RAFFLE_OPEN_LINKS_IN_FOREGROUND) {
      window.open(nextLinkUrl, '_blank');
    } else {
      chrome.runtime.sendMessage({ cmd: 'openTab', url: nextLinkUrl });
    }
  }
}

export async function finishTask(request, sender, context) {
  console2.log('finishTask; request, sender:', request, sender);

  if (context.pageState.abort) {
    return context.exitAction('abort');
  }

  if (request.status === 'captcha') {
    context.pageState.discordCaptchaSender = sender;
    context.pageState.discordCaptchaTabId = sender?.tab?.id;
    console2.log('sender', sender);
    return context.handleDiscordCaptcha();
  }

  context.pageState.finishedTabsIds.push(request.senderTabId);
  context.pageState.finishedDiscordTabIds = context.pageState.finishedDiscordTabIds || [];
  if (request.isDiscord) {
    context.pageState.finishedDiscordTabIds.push(request.senderTabId);
  }
  console2.log('pageState.finishedDiscordTabIds:', context.pageState.finishedDiscordTabIds);

  const normalizedUrl = normalizePendingLink(request.url);
  const prevLength = context.pageState.pendingRequests.length;

  console2.log('finish; url:', request.url);
  console2.log('finish; normalizedUrl:', normalizedUrl);

  console2.log(
    'finish; pendingRequests A:',
    context.pageState.pendingRequests.length,
    context.pageState.pendingRequests
  );
  context.pageState.pendingRequests = context.pageState.pendingRequests.filter(
    (item) => item !== normalizedUrl
  );
  console2.log(
    'finish; pendingRequests B:',
    context.pageState.pendingRequests.length,
    context.pageState.pendingRequests
  );

  if (request.twitter) {
    console2.info('Add url to history:', request.url);
    await context.pageState.history.add(normalizeTwitterHandle(context.pageState.twitterUser), request.url);
    await context.pageState.history.save();
  }

  if (context.pageState.pendingRequests.length === 0 && prevLength > 0) {
    const sleepMs = request.delay ?? 500;
    console2.info('Finished all required links, register raffle after sleep:', sleepMs);
    await sleep(sleepMs);
    console2.log('pageState:', context.pageState);

    let tabsToClose = [...context.pageState.finishedTabsIds];

    if (context.pageState.haveRoleDiscordLink && context.options.RAFFLE_KEEP_ROLED_DISCORD_TASK_OPEN) {
      // if having role discord link we often times need to do some verification task to get role.
      // we save time by keeping those tabs open!
      console2.log('focus roled discord tabs');
      context.pageState.finishedDiscordTabIds.forEach((id) => {
        tabsToClose = tabsToClose.filter((tabId) => tabId !== id);
        chrome.runtime.sendMessage({ cmd: 'focusTab', id });
      });
    }

    if (context.options.RAFFLE_CLOSE_TASKS_BEFORE_JOIN) {
      console2.log('Close finishedTabsIds');
      chrome.runtime.sendMessage({ cmd: 'closeTabs', tabIds: tabsToClose });
    }

    console.log('context');
    if (context.visitTwitterLinks) {
      context.visitTwitterLinks();
    }

    const focusTabWhenRegister = context.pageState.haveRoleDiscordLink ? false : true;
    return context.registerRaffle(focusTabWhenRegister, false);
  }

  if (context.pageState.pendingRequests.length === 0) {
    console2.info('All required links finished, but gone one finished task anyway?!');
  } else {
    console2.info('Not all required links finished yet!', context.pageState.pendingRequests);
  }

  if (context.options.TWITTER_QUEUE_TASK_LINKS & request.twitter) {
    const nextLink = context.pageState.pendingRequests.find((x) => isTwitterURL(x));
    if (nextLink) {
      const nextLinkUrl = 'https://' + nextLink + context.pageState.twitterLinkSuffix;

      console2.info(
        `Sleep ${context.options.RAFFLE_OPEN_QUEUED_TWITTER_LINK_DELAY} before opening next Twitter link`
      );
      await sleep(context.options.RAFFLE_OPEN_QUEUED_TWITTER_LINK_DELAY, null, 0.2);

      console2.info(`Open:`, nextLinkUrl);
      if (context.options.RAFFLE_OPEN_LINKS_IN_FOREGROUND) {
        window.open(nextLinkUrl, '_blank');
      } else {
        chrome.runtime.sendMessage({ cmd: 'openTab', url: nextLinkUrl });
      }
    } else {
      console2.info('No more twitter links');
    }
  }

  if (context.pageState.hasDiscordCaptcha) {
    context.handleDiscordCaptcha();
  }
}

export function clickElement(elem, { real, simulate } = {}) {
  let clicked = false;

  if (typeof real === 'boolean') {
    if (real && elem?.click) {
      elem.click();
      clicked = true;
    }
  } else if (GLOBAL_REAL_CLICK_ELEMENT && elem?.click) {
    elem.click();
    clicked = true;
  }

  if (typeof simulate === 'boolean') {
    if (simulate && elem) {
      simulateClick(elem);
      clicked = true;
    }
  } else if (GLOBAL_SIMULATE_CLICK_ELEMENT && elem) {
    simulateClick(elem);
    clicked = true;
  }

  if (!clicked) {
    throw new Error('Not configured to click element!');
  }
}

export function clickElement2(elem, { real = false, simulate = false } = {}) {
  let clicked = false;
  if ((real || GLOBAL_REAL_CLICK_ELEMENT) && elem?.click) {
    elem.click();
    clicked = true;
  }
  if ((simulate || GLOBAL_SIMULATE_CLICK_ELEMENT) && elem) {
    simulateClick(elem);
    clicked = true;
  }
  if (!clicked) {
    throw new Error('Not configured to click element!');
  }
}

export function removeBadStuffFromTwitterHandle(s) {
  if (typeof s !== 'string') {
    return s;
  }
  const tokens = s.split('/');
  return tokens.length <= 1 ? s : tokens[tokens.length - 1];
}

export function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
}

export function normalizeDiscordHandle(s) {
  if (typeof s !== 'string') {
    return s;
  }
  let handle = s;
  const tokens = s.split('#');
  if (tokens?.length) {
    handle = tokens[0];
  }
  return handle.trim().toLowerCase();
}

export function normalizeTwitterHandle(s) {
  if (typeof s !== 'string') {
    return s;
  }
  let handle = s;
  const tokens = s.split('/');
  if (tokens.length > 1) {
    handle = tokens[tokens.length - 1];
  }
  return handle.trim().toLowerCase();
}

export function normalizeDiscordUrl(s) {
  if (typeof s !== 'string') {
    return s;
  }
  return s.replaceAll(' ', '').trim().toLowerCase();
}

export async function optimizeStorage() {
  const baseStorage = await getStorageData();
  console2.log('baseStorage', baseStorage);
  const storage = {
    allProjectWins: baseStorage.allProjectWins,
    alphabot: baseStorage.alphabot,
    atlas: baseStorage.atlas,
    luckygo: baseStorage.luckygo,
    options: baseStorage.options,
    pendingPremintReg: {},
    permissions: baseStorage.permissions,
    premint: baseStorage.premint,
    results: baseStorage.results,
    runtime: {},
    wins: baseStorage.wins,
  };

  const normalizeKey = (key) => normalizeDiscordHandle(normalizeTwitterHandle(key.toLowerCase()));

  // hxhistory  --------------------------------------------------

  const hxhistory = {};

  console2.trace('baseStorage.hxHistory', baseStorage.hxhistory);

  for (const prop in baseStorage.hxhistory) {
    console2.trace('prop', prop);
    const propLow = normalizeKey(prop);
    if (!hxhistory[propLow]) {
      hxhistory[propLow] = {};
    }
  }

  const doTwitterHistory = (handle, data) => {
    const handleLow = normalizeKey(handle);
    console2.trace('hxhistory', hxhistory);

    console2.trace('doTwitterHistory', handle, handleLow, data);
    if (!hxhistory[handleLow]) {
      hxhistory[handleLow] = {};
    }
    if (!hxhistory[handleLow].twitter) {
      console2.trace('foo');
      hxhistory[handleLow].twitter = {
        follow: {},
        like: {},
        retweet: {},
      };
    }
    console2.trace('x', hxhistory[handleLow]);
    ['follow', 'like', 'retweet'].forEach((key) => {
      for (const prop in data[key]) {
        const thisKey = normalizeKey(prop);
        const thisVal = data[key][prop];
        console2.trace(key, thisKey, thisVal);
        console2.trace(hxhistory[handleLow]);
        console2.trace(hxhistory[handleLow].twitter);
        if (!hxhistory[handleLow].twitter[key][thisKey]) {
          hxhistory[handleLow].twitter[key][thisKey] = thisVal;
        }
      }
    });
  };

  const doDiscordHistory = (handle, data) => {
    const handleLow = normalizeKey(handle);
    console2.trace('doDiscordHistory', hxhistory);

    console2.trace('doDiscordHistory', handle, handleLow, data);
    if (!hxhistory[handleLow]) {
      hxhistory[handleLow] = {};
    }
    if (!hxhistory[handleLow].discord) {
      console2.trace('foo');
      hxhistory[handleLow].discord = {
        join: {},
      };
    }
    console2.trace('x', hxhistory[handleLow]);
    ['join'].forEach((key) => {
      for (const prop in data[key]) {
        const thisKey = normalizeKey(prop);
        const thisVal = data[key][prop];
        console2.trace(key, thisKey, thisVal);
        console2.trace(hxhistory[handleLow]);
        console2.trace(hxhistory[handleLow].discord);
        if (!hxhistory[handleLow].discord[key][thisKey]) {
          hxhistory[handleLow].discord[key][thisKey] = thisVal;
        }
      }
    });
  };

  for (const prop in baseStorage.hxhistory) {
    if (baseStorage.hxhistory[prop].twitter) {
      doTwitterHistory(prop, baseStorage.hxhistory[prop].twitter);
    }
    if (baseStorage.hxhistory[prop].discord) {
      doDiscordHistory(prop, baseStorage.hxhistory[prop].discord);
    }
  }

  storage.hxhistory = hxhistory;

  // projectObserver  --------------------------------------------------

  const projectObserver = {};
  for (const prop in baseStorage.projectObserver) {
    console2.trace('prop', prop);
    const propLow = prop.toLowerCase();
    if (!projectObserver[propLow]) {
      projectObserver[propLow] = baseStorage.projectObserver[prop];
    }
  }
  storage.projectObserver = projectObserver;

  // projectObserver  --------------------------------------------------

  const twitterObserver = {};
  for (const prop in baseStorage.twitterObserver) {
    console2.trace('prop', prop);
    const propLow = prop.toLowerCase();
    if (!twitterObserver[propLow]) {
      twitterObserver[propLow] = baseStorage.twitterObserver[prop];
    }
  }
  storage.twitterObserver = twitterObserver;

  await chrome.storage.local.remove(['alphabotProjectWinners']);
  await chrome.storage.local.remove(['projectWins']);
  await chrome.storage.local.remove(['projectWinsAll']);
  await chrome.storage.local.remove(['lucky']);

  console2.info('storage', storage);

  return storage;

  //await setStorageData(storage);

  // hxhistory: lowercase
  // projectObserver: lowercase + remove old entries
  // twitterObserver: lowercase + remove old entries
  // wins: remove old?
}

export async function resetStorage() {
  const baseStorage = await getStorageData();
  console2.log('baseStorage', baseStorage);

  const storage = {
    hxhistory: baseStorage.hxhistory,
    options: baseStorage.options,
    permissions: baseStorage.permissions,
    runtime: { pendingRequests: [] },
    pendingPremintReg: {},
  };

  return storage;
}

// MY TAB ID -------------------------------------------------------------------

export async function getMyTabIdFromExtension(context, maxWait, intervall = 100) {
  console2.log('getMyTabIdFromExtension', context, maxWait, intervall);
  if (!context) {
    return null;
  }

  if (context?.myTabId) {
    return context?.myTabId;
  }

  setTimeout(async () => {
    console2.log('sendMessage getMyTabId');
    const result = await chrome.runtime.sendMessage({ cmd: 'getMyTabIdAsync' });
    console2.log('result', result);
    if (result) {
      context.myTabId = result;
    }
    console2.log('context.myTabId after fetch; context.myTabId, result:', context.myTabId, result);
  }, 1);

  const stopTime = millisecondsAhead(maxWait);
  while (Date.now() <= stopTime) {
    if (context.myTabId) {
      console2.log('context.myTabId after waited:', context.myTabId);
      return context.myTabId;
    }
    await sleep(intervall);
  }
  console2.log('context.myTabId after waited in vain:', context.myTabId);
  return context.myTabId;
}

// GET FROM WEBPAGE -------------------------------------------------------------------

export async function getFromWebPage(url, key, tabId, context, maxWait = 30000, interval = 100) {
  console2.log('getFromWebPage:', url);

  await addPendingRequest(url, { action: key, tabId });
  // window.open(url);
  chrome.runtime.sendMessage({ cmd: 'openTab', url });

  const stopTime = millisecondsAhead(maxWait);
  while (Date.now() <= stopTime) {
    if (context[key]) {
      const result = context[`${key}Val`];
      context[key] = null;
      return result;
    }
    console2.log('context', context);
    await sleep(interval);
  }
  return null;
}

// EVENT HANDLERS -----------------------------------------------------

export function initBaseEventHandlers(pageState) {
  console2.info('Init base event handlers');

  chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    console2.info('Received message:', request, sender);

    if (request.cmd === 'pong') {
      // do nothing
    }

    if (request.cmd === 'getAuth') {
      console.log('Received getAuth');
      pageState[`${request.cmd}`] = true;
      pageState[`${request.cmd}Val`] = request.val;
      console.log('pageState', pageState);
    }

    if (request.cmd === 'getMyTabIdAsyncResponse') {
      pageState.myTabId = request.response;
    }

    sendResponse();
    return true;
  });
}

// STORAGE -----------------------------------------------------

export async function saveStorage(storage) {
  await setStorageData(storage);
}

export async function loadStorage({ to = {}, key = null, keys = [], ensure = [] } = {}) {
  console.log('loadStorage', to, key, keys, ensure);

  let storage = to;

  if (key) {
    const storageTemp = await getStorageItems([key]);
    storage[key] = storageTemp[key];
    console2.info('Load storage by key:', key, to);
  } else {
    storage = await getStorageItems(keys?.length ? keys : null);
    console2.info('Load storage by keys:', keys, storage);
  }
  return await setBaseStorage(storage, ensure);
}

async function setBaseStorage(storage, ensure) {
  console2.info('Set ensure storage:', storage, ensure);
  let modified = false;
  ensure.forEach((b) => {
    if (!storage[b.key]) {
      storage[b.key] = b.val;
      modified = true;
    }
  });
  if (modified) {
    await setStorageData(storage);
    console2.info('Ensure storage modified!', storage);
  }
  return storage;
}

export async function reloadOptions(storage) {
  const { options } = await getStorageItems(['options']);
  storage.options = options;
  console2.log('storage.options:', storage.options);
}

// STATUS  -----------------------------------------------------

export function updateMainStatus(text) {
  console2.log('updateMainStatus', text);
  const elem = document.getElementById('hx-status-main');
  if (elem) {
    elem.innerText = text;
    elem.classList.toggle('hidden', !text);
  }
}

export function updateMidStatus(text) {
  console2.log('updateMidStatus', text);
  const elem = document.getElementById('hx-status-mid');
  if (elem) {
    elem.innerText = text;
    elem.classList.toggle('hidden', !text);
  }
}

export function updateSubStatus(html, reuseLast = false) {
  console2.log('updateSubStatus', html);
  const elem = document.getElementById('hx-status');
  if (!elem) {
    console2.error('Missing status element in HTML!');
    return false;
  }
  let item;
  let isReused = false;
  if (reuseLast) {
    const items = Array.from(elem.getElementsByTagName('LI'));
    if (items.length) {
      item = items[items.length - 1];
      isReused = true;
    }
  }
  if (isReused) {
    item.innerHTML = html;
  } else {
    item = document.createElement('LI');
    item.innerHTML = html;
    elem.appendChild(item);
  }
}

export function resetSubStatus() {
  document.getElementById('hx-status').replaceChildren();
}

export function isClosableInternalWebPage(url) {
  const closeableHrefs = [
    //'chrome-extension://ceegpiflkjflcklliibajfhlgoljefio/raffleResults.html',
    //'chrome-extension://ceegpiflkjflcklliibajfhlgoljefio/raffles.html',
    'chrome-extension://ceegpiflkjflcklliibajfhlgoljefio/help.html',
  ];
  return !!closeableHrefs.some((x) => url && url.startsWith(x));
}

export async function copyToTheClipboard(textToCopy) {
  const el = document.createElement('textarea');
  el.value = textToCopy;
  el.setAttribute('readonly', '');
  el.style.position = 'absolute';
  el.style.left = '-9999px';
  document.body.appendChild(el);
  el.select();
  document.execCommand('copy');
  document.body.removeChild(el);
}

export function notifyRaid(request) {
  if (!window.raidStarted) {
    console.log('Ignore raid result');
    return;
  }
  window.raidStarted = false;
  focusMyTab();
  window.alert(
    `Done raiding ${request.fromUrl}.\n\nRetweeted post URL is copied to clipboard after closing this dialog.`
  );
  copyToTheClipboard(request.replyUrl);
}

export function createStatusbar(options, { text = STATUSBAR_DEFAULT_TEXT, buttons = {} } = {}) {
  console.log('createStatusbar', buttons);
  return createStatusbarMain(text, {
    hideTimeShort: options.STATUSBAR_HIDE_TIME_SHORT * 1000 || 6000,
    hideTimeLong: options.STATUSBAR_HIDE_TIME_LONG * 1000 || 60000,
    buttons: createStatusbarButtons({
      options: true,
      results: true,
      raffles: true,
      twitter: true,
      raid: false,
      reveal: false,
      ...buttons,
    }),
  });
}

export function createStatusbarButtons({ options, results, raffles, reveal, raid, twitter, help } = options) {
  console.log('createStatusbarButtons', options);

  const buttons = [];

  const add = (text, title, handler) => {
    const btn = document.createElement('button');
    btn.innerText = text;
    btn.title = title;
    if (typeof handler === 'function') {
      btn.addEventListener('click', handler);
    } else {
      btn.disabled = true;
    }
    buttons.push(btn);
  };

  const makeCallback = (val, cb) => (val === 'disabled' ? '' : cb);

  if (options) {
    const callback = makeCallback(options, () => chrome.runtime.sendMessage({ cmd: 'openOptionsPage' }));
    add('Options', 'Open Premint Helper Options page', callback);
  }

  if (help) {
    const callback = makeCallback(help, () =>
      chrome.runtime.sendMessage({
        cmd: 'openTab',
        active: true,
        url: chrome.runtime.getURL('/help.html'),
      })
    );
    add('Help', 'Open Premint Helper Help page', callback);
  }

  if (results) {
    const callback = makeCallback(results, () =>
      chrome.runtime.sendMessage({
        cmd: 'openTab',
        active: true,
        url: chrome.runtime.getURL('raffleResults.html'),
      })
    );
    add('Wins', 'Open Premint Helper Raffle Wins page', callback);
  }

  if (raffles) {
    const callback = makeCallback(raffles, () =>
      chrome.runtime.sendMessage({
        cmd: 'openTab',
        active: true,
        url: chrome.runtime.getURL('raffles.html'),
      })
    );
    add('Raffles', 'Open Live Raffles page', callback);
  }

  if (raid) {
    add('Raid', 'Raid Twitter post', makeCallback(raid, raidTwitterPost));
  }

  if (reveal) {
    add('Reveal', 'Reveal odds and previously won wallets for all supported raffles on page', reveal);
  }

  if (twitter) {
    add('T3', 'Re-lookup follower counts for non-expired Twitter links on page', (event) =>
      lookupTwitterFollowersClickEventHandler(event, 3)
    );
    add('T2', 'Re-lookup follower counts for expired Twitter links on page', (event) =>
      lookupTwitterFollowersClickEventHandler(event, 2)
    );
    add('Twitter', 'Lookup follower counts for new Twitter links on page', (event) =>
      lookupTwitterFollowersClickEventHandler(event, 1)
    );
  }

  console.trace('createStatusbarButtons:', buttons);

  return buttons.reverse();
}

export function lookupTwitterFollowersClickEventHandler(event, scope = 0) {
  event.preventDefault();
  event.stopImmediatePropagation();
  chrome.runtime.sendMessage({ cmd: 'lookupTwitterFollowersFromBtn', scope });
}
