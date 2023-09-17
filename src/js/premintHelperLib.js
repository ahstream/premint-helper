import {
  sleep,
  millisecondsAhead,
  getStorageItems,
  addPendingRequest,
  createLogger,
  extractTwitterHandle,
  onlyNumbers,
  pluralize,
} from '@ahstream/hx-lib';

const debug = createLogger();

// DATA ----------------------------------------------------------------------------------

export const JOIN_BUTTON_TEXT = 'PH Auto Join';
export const JOIN_BUTTON_IN_PROGRESS_TEXT = 'PH Auto Join in progress...';
export const JOIN_BUTTON_TITLE = 'Automatically try to fulfill all raffle tasks and then register for raffle';
export const STATUSBAR_DEFAULT_TEXT = 'Premint Helper';

// FUNCTIONS ----------------------------------------------------------------------------------

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
    add('Options', 'Open Premint Helper Options page', () => chrome.runtime.sendMessage({ cmd: 'openOptionsPage' }));
  }

  if (help) {
    add('Help', 'Open Premint Helper Help page', () =>
      chrome.runtime.sendMessage({ cmd: 'openTab', active: true, url: chrome.runtime.getURL('/help.html') })
    );
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
    context.updateStatusbarError('Chrome Extension is not recognized by web page. Reload page and try again.');
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
    if (context.pageState.verifyRaffle) {
      chrome.runtime.sendMessage({ cmd: 'minimizeWindow' });
    }
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
    if (context.pageState.verifyRaffle) {
      chrome.runtime.sendMessage({ cmd: 'minimizeWindow' });
    }
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
    if (context.pageState.verifyRaffle) {
      chrome.runtime.sendMessage({ cmd: 'minimizeWindow' });
    }
  }
  if (result === 'switchTwitterUserError') {
    context.updateStatusbarError(`Cannot switch to Twitter user ${options.twitterUser}!`);
  }
  if (result === 'abort') {
    // do nothing
  }

  context.resetQuickRegBtn();

  context.pageState.pause = true;

  if (!context.pageState.hasDiscordCaptcha) {
    // If discord captcha, raffle tab has already been focused earlier, avoid flickering by focusing more than once!
    chrome.runtime.sendMessage({ cmd: 'focusMyTab' });
  }
}

function handleRetries(context, retries, retrySecs) {
  if (context.pageState.done) {
    return;
  }
  context.updateStatusbar(
    `Raffle error but will auto retry ${retries} ${pluralize(retries, 'time', 'times')} in ${retrySecs} seconds...`,
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
