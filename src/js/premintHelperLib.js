import {
  sleep,
  millisecondsAhead,
  getStorageItems,
  addPendingRequest,
  createLogger,
  extractTwitterHandle,
  onlyNumbers,
  pluralize,
  dynamicSortMultiple,
} from 'hx-lib';

const debug = createLogger();

// DATA ----------------------------------------------------------------------------------

export const JOIN_BUTTON_TEXT = 'PH Auto Join';
export const JOIN_BUTTON_IN_PROGRESS_TEXT = 'PH Auto Join in progress...';
export const JOIN_BUTTON_TITLE = 'Automatically try to fulfill all raffle tasks and then register for raffle';
export const STATUSBAR_DEFAULT_TEXT = 'Premint Helper';

// FUNCTIONS ----------------------------------------------------------------------------------

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

const NO_SUBSCRIPTION_STATUSBAR_TEXT = 'No active Premint Helper subscription, premium features disabled';

export function checkIfSubscriptionEnabled(permissions, doAlert, updateStatusbarFn) {
  if (!permissions?.enabled) {
    showNoSubscriptionStatusbar(updateStatusbarFn);
    if (doAlert) {
      const premiumText = premiumFeatures.join('\n* ');
      const freeText = freeFeatures.join('\n* ');
      window.alert(
        `No active Premint Helper subscription! These premium features are disabled:\n\n* ${premiumText}\n\nThe features are free:\n\n* ${freeText}`
      );
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
  console.log('wallet', wallet);
  const walletLow = wallet.toLowerCase();
  debug.trace('walletToAlias:', wallet, options.WALLET_ALIAS);
  const items = options.WALLET_ALIAS.filter((x) => x.toLowerCase().endsWith(walletLow));
  return items.length ? items[0].toLowerCase().replace(`${walletLow}`, '').replace(':', '').trim() : '';
}

export function trimMintAddress(text) {
  if (typeof text !== 'string') {
    return '';
  }
  if (text.length < 20) {
    return text;
  }
  return text.substr(0, 2) + '...' + text.substr(text.length - 4, 4);
}

export function trimMintAddresses(texts) {
  return texts.map((x) => trimMintAddress(x));
}

export function sortMintAddresses(addrList, options) {
  console.log('addrList', addrList);
  const sortData = addrList.map((x) => {
    console.log('x', x);
    const alias = walletToAlias(x, options);
    const tokens = alias.split('-');
    const sortParamNumber =
      tokens.length > 1
        ? Number(tokens[tokens.length - 1])
            .toString()
            .padStart(5, '0')
        : alias;
    const sortParamName = tokens.length > 1 ? tokens[0] : alias;
    return { sortParamNumber, sortParamName, addr: x };
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

export function createStatusbarButtons({ options = true, help = false, results = false, reveal = false, followers = false } = {}) {
  console.log('createStatusbarButtons; options, help, results, reveal, followers:', options, help, results, reveal, followers);

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

  if (options) {
    const callback = options === 'disabled' ? '' : () => chrome.runtime.sendMessage({ cmd: 'openOptionsPage' });
    add('Options', 'Open Premint Helper Options page', callback);
  }

  if (help) {
    const callback =
      help === 'disabled'
        ? ''
        : () => chrome.runtime.sendMessage({ cmd: 'openTab', active: true, url: chrome.runtime.getURL('/help.html') });
    add('Help', 'Open Premint Helper Help page', callback);
  }

  if (results) {
    const callback =
      results === 'disabled'
        ? ''
        : () => chrome.runtime.sendMessage({ cmd: 'openTab', active: true, url: chrome.runtime.getURL('alphabotResults.html') });
    add('Results', 'Open Premint Helper Alphabot Results page', callback);
  }

  if (followers) {
    add('Followers', 'Lookup followers for all Twitter links on page', followers);
  }

  if (reveal) {
    add('Reveal', 'Reveal odds and previously won wallets for all Alphabot raffles on page', reveal);
  }

  debug.log('createStatusbarButtons:', buttons);

  return buttons.reverse();
}

function setPageBodyClass(className) {
  document.body.classList.add(className);
}

export function exitActionMain(result, context, options) {
  console.log('exitActionMain', result, context, options);
  setPageBodyClass('exitAction');
  setPageBodyClass(result);

  if (result === 'joinWithWonWallet') {
    context.updateStatusbarError('Selected wallet has already won a raffle! Change wallet before joining raffle.');
    context.pageState.pause = true;
  }
  if (result === 'raffleCaptcha') {
    context.updateStatusbarError('Raffle has captcha! First solve captcha, then click register button.');
    context.pageState.pause = true;
  }
  if (result === 'invalidContext') {
    context.updateStatusbarError('Chrome Extension is not recognized by web page. Reload extension and webpage and try again.');
    context.pageState.pause = true;
  }
  if (result === 'raffleUnknownError') {
    context.updateStatusbarError('Raffle error');
  }
  if (result === 'unspecifiedRaffleError') {
    context.updateStatusbarError('Unspecified raffle error, see error messages on page');
  }
  if (result === 'raffleUnknownErrorWillRetry') {
    console.log('context.forceRegister', context.forceRegister);
    if (context.forceRegister && context.forceRegister()) {
      console.log('forceRegister success!');
      // successful register, do nothing
    } else {
      if (options.retries) {
        handleRetries(context, options.retries, options.retrySecs);
      } else {
        context.updateStatusbarInfo(`Raffle error`);
      }
      context.pageState.pause = true;
    }
  }
  if (result === 'alreadyWon') {
    context.pageState.done = true;
    context.updateStatusbarOk('You won a raffle for this project from the same team already');
    context.removeQuickRegBtn();
    context.pageState.pause = true;
  }
  if (result === 'walletConnectDialog') {
    context.updateStatusbarError('Raffle has wallet connect dialog, need to be done manually');
    context.pageState.pause = true;
  }
  if (result === 'doingItTooOften') {
    context.updateStatusbarError('Alphabot says you are doing that too often. Please try again later.');
    context.pageState.pause = true;
  }
  if (result === 'registered') {
    context.pageState.done = true;
    context.updateStatusbarOk('You are registered');
    context.removeQuickRegBtn();
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
  if (result === 'premintDisabled') {
    context.updateStatusbar('Premint automation disabled, do nothing');
    context.pageState.pause = true;
  }
  if (result === 'twitterLocked') {
    context.updateStatusbarError('Twitter account is locked!');
    context.pageState.pause = true;
  }
  if (result === 'alphabotDisabled') {
    context.updateStatusbar('Alphabot automation disabled, do nothing');
    context.removeQuickRegBtn();
    context.pageState.pause = true;
  }
  if (result === 'alreadyRegistered') {
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
  if (result === 'noRaffleTrigger') {
    context.updateStatusbarError('Cannot recognize raffle elements');
    context.removeQuickRegBtn();
    context.pageState.pause = true;
  }
  if (result === 'noRaffleRegisterBtn') {
    context.updateStatusbarError('Cannot recognize Register button');
    context.removeQuickRegBtn();
    context.pageState.pause = true;
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
    chrome.runtime.sendMessage({ cmd: 'focusMyTab' });
  }
}

function minimizeVerifiedRaffle(context) {
  console.log('minimizeVerifiedRaffle', context);
  if (context.pageState.action === 'verifyAlphabotRaffle') {
    console.log('do minimizeVerifiedRaffle');
    chrome.runtime.sendMessage({ cmd: 'minimizeWindow' });
  }
}

function closeTasksWhenFinished(context) {
  console.log('closeTasksWhenFinished', context);
  console.log('closeTasksWhenFinished', JSON.stringify(context));
  if (context.options.RAFFLE_CLOSE_TASKS_WHEN_FINISHED && context.pageState.finishedTabsIds?.length) {
    console.log('do closeTasksWhenFinished');
    chrome.runtime.sendMessage({ cmd: 'closeTabs', tabIds: context.pageState.finishedTabsIds });
  } else {
    console.log('do NOT closeTasksWhenFinished');
  }
}

function minimizeRaffleWhenFinished(context) {
  console.log('minimizeRaffleWhenFinished', context);
  if (context.options.RAFFLE_MINIMIZE_WHEN_FINISHED && context.pageState.isAutoStarted) {
    console.log('do minimizeRaffleWhenFinished');
    chrome.runtime.sendMessage({ cmd: 'minimizeWindow' });
  }
}

function closeRaffleWhenFinished(context) {
  console.log('closeRaffleWhenFinished', context);
  console.log('closeRaffleWhenFinished', JSON.stringify(context));
  if (context.options.RAFFLE_CLOSE_WHEN_FINISHED && context.pageState.isAutoStarted) {
    console.log('do closeRaffleWhenFinished');
    chrome.runtime.sendMessage({ cmd: 'closeRaffleWhenFinished', url: window.location.href });
  } else {
    console.log('do NOT closeRaffleWhenFinished');
  }
}

function cleanupRaffleWhenFinished(context) {
  console.log('cleanupRaffleWhenFinished', context);
  if (context.options.RAFFLE_CLEANUP_WHEN_FINISHED && context.pageState.isAutoStarted) {
    console.log('do cleanupRaffleWhenFinished');
    chrome.runtime.sendMessage({ cmd: 'cleanupRaffleWhenFinished', url: window.location.href });
  }
}

function handleRetries(context, retries, retrySecs) {
  if (context.pageState.done) {
    return;
  }
  context.updateStatusbar(
    `Raffle error! Will auto retry ${retries} ${pluralize(retries, 'time', 'times')} in ${retrySecs} seconds...`,
    'retry'
  );
  if (retrySecs >= 1) {
    setTimeout(() => {
      handleRetries(context, retries, retrySecs - 1);
    }, 1000);
  }
}

export async function getMyTabIdFromExtension(context, maxWait, intervall = 100) {
  debug.log('getMyTabIdFromExtension', context, maxWait, intervall);
  if (!context) {
    return null;
  }

  if (context?.myTabId) {
    return context?.myTabId;
  }

  setTimeout(async () => {
    debug.log('sendMessage getMyTabId');
    const result = await chrome.runtime.sendMessage({ cmd: 'getMyTabIdAsync' });
    if (result) {
      // context.myTabId = result;
    }
    debug.log('context.myTabId after fetch; result:', context.myTabId, result);
  }, 1);

  const stopTime = millisecondsAhead(maxWait);
  while (Date.now() <= stopTime) {
    if (context.myTabId) {
      debug.log('context.myTabId after waited:', context.myTabId);
      return context.myTabId;
    }
    await sleep(intervall);
  }
  debug.log('context.myTabId after waited in vain:', context.myTabId);
  return context.myTabId;
}

export function makeTwitterFollowIntentUrl(url) {
  if (url.includes('/intent/follow') || url.includes('/intent/user')) {
    return url;
  }
  const val = extractTwitterHandle(url);
  const key = onlyNumbers(val) ? 'user_id' : 'screen_name';
  return `https://twitter.com/intent/user?${key}=${val}`;
}
