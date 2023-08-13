import { sleep, millisecondsAhead, getStorageItems, addPendingRequest, createLogger } from '@ahstream/hx-utils';

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
    add('Results', 'Open Premint Helper Alphabot Results page', () =>
      chrome.runtime.sendMessage({ cmd: 'openTab', active: true, url: chrome.runtime.getURL('alphabotResults.html') })
    );
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
  }
  if (result === 'raffleCaptcha') {
    context.updateStatusbarError('Raffle has captcha! First solve captcha, then click register button.');
  }
  if (result === 'invalidContext') {
    context.updateStatusbarError('Chrome Extension is not recognized by web page. Reload page and try again.');
  }
  if (result === 'raffleUnknownError') {
    context.updateStatusbarError('Raffle error');
  }
  if (result === 'unspecifiedRaffleError') {
    context.updateStatusbarError('Unspecified raffle error, see error messages on page');
  }
  if (result === 'raffleUnknownErrorWillRetry') {
    if (options.retries) {
      handleRetries(context, options.retries, options.retrySecs);
    } else {
      context.updateStatusbarInfo(`Raffle error`);
    }
  }
  if (result === 'alreadyWon') {
    context.updateStatusbarOk('You won a raffle for this project from the same team already');
    context.removeQuickRegBtn();
  }
  if (result === 'walletConnectDialog') {
    context.updateStatusbarError('Raffle has wallet connect dialog, need to be done manually');
  }
  if (result === 'doingItTooOften') {
    context.updateStatusbarError('Alphabot says you are doing that too often. Please try again later.');
  }
  if (result === 'registered') {
    context.updateStatusbarOk('You are registered');
    context.removeQuickRegBtn();
  }
  if (result === 'notRegisterProperly') {
    context.updateStatusbarError('Raffle does not seem to register properly');
  }
  if (result === 'discordCaptcha') {
    context.updateStatusbarError('Discord has captcha! First solve captcha, then click register button.');
    context.pageState.hasDiscordCaptcha = true;
  }
  if (result === 'premintDisabled') {
    context.updateStatusbar('Premint automation disabled, do nothing');
  }
  if (result === 'twitterLocked') {
    context.updateStatusbarError('Twitter account is locked!');
  }
  if (result === 'alphabotDisabled') {
    context.updateStatusbar('Alphabot automation disabled, do nothing');
    context.removeQuickRegBtn();
  }
  if (result === 'alreadyRegistered') {
    context.updateStatusbarOk('You are registered');
    context.removeQuickRegBtn();
  }
  if (result === 'noRaffleTrigger') {
    context.updateStatusbarError('Cannot recognize raffle elements');
    context.removeQuickRegBtn();
  }
  if (result === 'noRaffleRegisterBtn') {
    context.updateStatusbarError('Cannot recognize Register button');
    context.removeQuickRegBtn();
  }
  if (result === 'ignoredRaffle') {
    context.updateStatusbar('Raffle is ignored');
  }
  if (result === 'switchTwitterUserError') {
    context.updateStatusbarError(`Cannot switch to Twitter user ${options.twitterUser}!`);
  }
  if (result === 'abort') {
    // do nothing
  }

  context.resetQuickRegBtn();

  if (!context.pageState.hasDiscordCaptcha) {
    // If discord captcha, raffle tab has already been focused earlier, avoid flickering by focusing more than once!
    chrome.runtime.sendMessage({ cmd: 'focusMyTab' });
  }
}

function handleRetries(context, retries, retrySecs) {
  context.updateStatusbarInfo(`Raffle error but will automatically retry ${retries} times in ${retrySecs} seconds...`);
  if (retrySecs >= 1) {
    setTimeout(() => {
      handleRetries(context, retries, retrySecs - 1);
    }, 1000);
  }
}

export async function getMyTabIdFromExtension(context, maxWait, intervall = 100) {
  if (!context) {
    return null;
  }

  if (context?.myTabId) {
    return context?.myTabId;
  }

  setTimeout(async () => {
    context.myTabId = await chrome.runtime.sendMessage({ cmd: 'getMyTabId' });
    debug.log('context.myTabId after fetch', context.myTabId);
  }, 1);

  const stopTime = millisecondsAhead(maxWait);
  while (Date.now() <= stopTime) {
    if (context.myTabId) {
      return context.myTabId;
    }
    await sleep(intervall);
  }
  debug.log('context.myTabId after waited in vain', context.myTabId);
  return context.myTabId;
}
