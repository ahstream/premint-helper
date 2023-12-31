console.info('alphabotRafflePage.js begin', window?.location?.href);

import '../styles/alphabotPage.css';

import {
  JOIN_BUTTON_TEXT,
  JOIN_BUTTON_IN_PROGRESS_TEXT,
  JOIN_BUTTON_TITLE,
  clickElement,
} from './premintHelperLib';

import {
  ONE_SECOND,
  sleep,
  waitForSelector,
  extractTwitterHandle,
  getElementByText,
  millisecondsAhead,
  getTextContains,
  waitForTextContains,
  isTwitterURL,
  myConsole,
} from 'hx-lib';

import { createObserver as createRaffleObserver, getPreviousWalletsWon } from './observerGeneric';
import { createObserver as createTwitterObserver } from './twitterObserver.js';

import { initRafflePage } from './rafflePage';

import {} from './alphabotLib';

const console2 = myConsole();

// DATA ----------------------------------------------------------------------------

let storage = null;

const config = {
  name: 'ALPHABOT',
  enableForceRegister: true,
  storageKeys: ['runtime', 'options'],
  setStorage,
  createObserver,
  createObserver2,
  waitForRafflePageLoaded,
  forceRegister,
  hasRegistered,
  hasCaptcha,
  hasWalletConnectDialog,
  hasAlreadyWon,
  hasDoingItTooOften,
  hasRaffleTrigger,
  hasRaffleTrigger2,
  isIgnored,
  getRegisterButton,
  isAllRegBtnsEnabled,
  addQuickRegButton,
  isPendingReg,
  setPendingReg,
  getTwitterUser,
  getDiscordUser,
  parseMustLikeLinks,
  parseMustRetweetLinks,
  parseMustLikeAndRetweetLinks,
  parseMustFollowLinks,
  parseMustJoinLinks,
  getErrors,
  handleSimpleErrors,
  handleComplexErrors,
  loadRafflePageWithCustomContent,
  addPreviouslyWonWallets,
  getWonWalletsByThisAccount,
  getWonWalletsByAllAccounts,
  getSelectedWallet,
  JOIN_BUTTON_TEXT,
  JOIN_BUTTON_TITLE,
  JOIN_BUTTON_IN_PROGRESS_TEXT,
};

// STARTUP ----------------------------------------------------------------------------

runNow();

function runNow() {
  initRafflePage(config);
}

// STORAGE ----------------------------------------------------------------------------

function setStorage(newStorage) {
  storage = newStorage;
}

// OBSERVER ----------------------------------------------

async function createObserver(config) {
  return await createRaffleObserver(config);
}

async function createObserver2(config) {
  return await createTwitterObserver(config);
}

// WAIT FOR LOADED ----------------------------------------------

async function waitForRafflePageLoaded() {
  console2.info('Wait for raffle page to load');

  const stopTime = millisecondsAhead(storage.options.ALPHABOT_WAIT_FOR_RAFFLE_PAGE_LOADED);
  while (Date.now() <= stopTime) {
    if (document.querySelector('[data-action="view-project-register"]')) {
      console2.info('Raffle page has loaded!');
      return true;
    }
    if (document.querySelector('[data-action="view-project-cancel-registration"]')) {
      console2.info('Raffle page has loaded!');
      return true;
    }
    await sleep(1000);
  }

  console2.warn('Raffle page has NOT loaded!');
  return false;
}

// REGISTER

function forceRegister() {
  const regBtn = getRegisterButtonSync(true);
  console2.log('forceRegister; regBtn:', regBtn);
  if (!regBtn) {
    console2.log('!regBtn');
    return null;
  }
  if (regBtn?.disabled) {
    console2.log('regBtn?.disable');
    return null;
  }

  const errors = getErrors();
  console2.log('errors:', errors);
  if (errors.discord) {
    console2.log('Do not force register when discord errors!');
    return null;
  }

  if (hasDoingItTooOften()) {
    console2.log('hasDoingItTooOften');
    return null;
  }

  if (!isAllRegBtnsEnabled()) {
    console2.log('!isAllRegBtnsEnabled');
    return null;
  }

  clickElement(regBtn);
  // pageState.isRegistering = true;
  return regBtn;
}

// REGISTER BTN FUNCS ----------------------------------------------

async function getRegisterButton(maxWait = 1000, interval = 10) {
  const regPlus1Btn = await waitForTextContains(
    storage.options.ALPHABOT_REG_PLUS_1_BTN_SEL,
    'button',
    maxWait,
    interval
  );
  if (regPlus1Btn) {
    return regPlus1Btn;
  }
  return await waitForSelector(storage.options.ALPHABOT_REG_BTN_SEL, 60 * ONE_SECOND, 100);
}

function getRegisterButtonSync(mustHaveAllBtns = false) {
  console2.log('getRegisterButtonSync; mustHaveAllBtns:', mustHaveAllBtns);
  const regPlus1Btn = getTextContains(storage.options.ALPHABOT_REG_PLUS_1_BTN_SEL, 'button');
  if (regPlus1Btn) {
    if (mustHaveAllBtns) {
      return document.querySelector(storage.options.ALPHABOT_REG_BTN_SEL) ? regPlus1Btn : null;
    }
    return regPlus1Btn;
  }
  return document.querySelector(storage.options.ALPHABOT_REG_BTN_SEL);
}

function isAllRegBtnsEnabled() {
  const regBtn = document.querySelector(storage.options.ALPHABOT_REG_BTN_SEL);
  const regPlus1Btn = getTextContains(storage.options.ALPHABOT_REG_PLUS_1_BTN_SEL, 'button');
  console2.log('regBtn', regBtn);
  console2.log('regPlus1Btn', regPlus1Btn);
  if (regBtn?.disabled) {
    return false;
  }
  if (regPlus1Btn?.disabled) {
    return false;
  }
  if (regBtn || regPlus1Btn) {
    return true;
  }
  return false;
}

async function addQuickRegButton(clickHandler) {
  const regBtnContainer = await waitForSelector(
    '[data-action="view-project-register"]',
    60 * ONE_SECOND,
    100
  );
  console2.log('regBtn', regBtnContainer);
  if (!regBtnContainer) {
    return;
  }

  const btn = document.createElement('button');
  btn.id = 'ph-quick-reg';
  btn.innerHTML = JOIN_BUTTON_TEXT;
  btn.title = JOIN_BUTTON_TITLE;
  btn.className = 'alphabotButton';
  btn.addEventListener('click', clickHandler);

  const tasksElem = getElementByText('Tasks', 'h5', { contains: true });
  console2.log('tasksElem', tasksElem);
  if (tasksElem) {
    tasksElem.after(btn);
  } else {
    regBtnContainer.after(btn);
  }
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

function hasCaptcha() {
  // document.querySelector('.recaptcha-checkbox-checked')
  // document.querySelector('.recaptcha-checkbox-borderAnimation')
  // const elem = document.querySelector('iframe[title="reCAPTCHA"]');
  const elem = document.querySelector('iframe[src*="hcaptcha.com"]');

  if (!elem) {
    return false;
  }

  if (typeof elem?.disabled === 'boolean' && elem.disabled === false) {
    return true;
  }

  const parent = elem.parentElement?.parentElement;
  if (!parent) {
    return false;
  }

  if (parent.ariaHidden === 'true') {
    return false;
  }

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

async function hasRaffleTrigger() {
  const elem = await waitForTextContains('mint wallet', '.MuiAlert-message', 10 * ONE_SECOND, 50);
  console2.log('hasRaffleTrigger:', elem);
  return !!elem;
}

async function hasRaffleTrigger2() {
  const elem = await waitForSelector(storage.options.ALPHABOT_REG_BTN_SEL, 60 * ONE_SECOND, 100);
  console2.log('hasRaffleTrigger2:', elem);
  return !!elem;
}

function isIgnored(pageState) {
  const teamName = getTeamName();
  let ignored =
    pageState.isAutoStarted && // only ignore auto started raffles!
    storage.options.ALPHABOT_IGNORED_NAMES.length &&
    teamName &&
    storage.options.ALPHABOT_IGNORED_NAMES.includes(teamName);
  console2.log('isIgnored; teamName, ignored:', teamName, ignored);
  return ignored;
}

// PENDING REG --------------------------------

function isPendingReg() {
  return false;
}

async function setPendingReg() {
  return false;
}

// PARSE TASK LINKS -------------------------------------

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
  console2.log('parseMustFollowLinks:', val);
  return val;
}

function parseTwitterLinks(prefix) {
  const elems = [
    ...[...document.querySelectorAll('div.MuiPaper-root')].filter((e) =>
      e.innerText.toLowerCase().startsWith(prefix)
    ),
  ];
  const val = elems.length < 1 ? [] : Array.from(elems[0].getElementsByTagName('a')).map((a) => a.href);
  console2.log('parseTwitterLinks:', prefix, val);
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
  console2.log('parseMustJoinLinks:', mustHaveRole, elems, val);
  return val;
}

// WON WALLETS

function addPreviouslyWonWallets(pageState) {
  const twitterLink = document.querySelector('a[data-action="option-twitter"]');
  if (!twitterLink) {
    return;
  }
  console2.log('twitterLink', twitterLink);

  const twitterHandle = extractTwitterHandle(twitterLink?.href);
  if (!twitterHandle) {
    return;
  }
  console2.log('twitterHandle', twitterHandle);

  const section = pageState.observer.createPreviousWonSection(twitterHandle, true);
  if (!section) {
    return;
  }
  console2.log('section', section);

  const tasksElem = getElementByText('Tasks', 'h5', { contains: true });
  if (!tasksElem) {
    console2.error('Missing Tasks elem!');
    return;
  }
  console2.log('tasksElem', tasksElem);
  tasksElem.after(section);
}

function getWonWalletsByAllAccounts() {
  return getPreviousWalletsWon(getRaffleTwitterHandle());
}

// ERROR HANDLING

function getErrors() {
  const elems = [...document.querySelectorAll('.MuiAlert-standardError')].map((x) =>
    x.innerText.toLowerCase()
  );
  return {
    texts: elems,
    twitter: elems.some((x) => x.includes('follow') || x.includes('like') || x.includes('retweet')),
    discord: elems.some((x) => x.includes('join')),
    discordRoled: elems.some((x) => x.includes('join') && x.includes('have role')),
  };
}

async function handleSimpleErrors() {
  return false;
}

async function handleComplexErrors(pageState, context) {
  const errors = getErrors();

  if (errors.texts.length) {
    await sleep(1000);
    console2.log('Has errors:', errors);

    if (hasCaptcha()) {
      //return exitAction('raffleCaptcha');
      context.handleRaffleCaptcha();
      return true;
    }

    if (pageState.hasDiscordCaptcha) {
      context.handleDiscordCaptcha();
      return true;
    }

    if (pageState.hasHadRaffleError) {
      context.exitAction('raffleUnknownError');
      return true;
    }

    pageState.hasHadRaffleError = true;

    if (!errors.twitter) {
      context.exitAction('raffleUnknownError');
      return true;
    }

    const retries = pageState.request?.retries
      ? pageState.request?.retries - 1
      : storage.options.RAFFLE_RETRY_TIMES;

    if (!retries && pageState.request?.retries) {
      // Have retried before but have no retries left, try one last time without retries!
      context.waitAndTryRegisterOneLastTime();
      return true;
    }

    if (!retries) {
      context.exitAction('raffleUnknownError');
      return true;
    }

    context.exitAction('raffleUnknownErrorWillRetry', {
      retrySecs: storage.options.RAFFLE_RETRY_SECS,
      retries,
    });

    console2.log('retry in secs; times:', storage.options.RAFFLE_RETRY_SECS, retries);

    await context.waitAndTryRegisterBeforeRetry(retries);

    return true;
  }

  return false;
}

// CUSTOM CONTENT ----------------------------------------------------------------------------------

function loadRafflePageWithCustomContent() {
  return false;
}

// RAFFLE GETTERS

function getSelectedWallet() {
  try {
    const elems = [...document.querySelectorAll('div.MuiAlert-message')].filter((x) =>
      x.innerText.toLowerCase().includes(' mint wallet:\n')
    );
    if (!elems?.length) {
      return null;
    }
    const elem = elems[0].querySelector('div[role="button"]');
    if (!elem) {
      return null;
    }

    const shortWallet = elem?.innerText || '';
    const longWallet = elem.nextSibling?.value || '';
    const tokens = shortWallet.split('...');
    const shortPrefix = tokens.length >= 2 ? tokens[0] : '';
    const shortSuffix = tokens.length >= 2 ? tokens[1] : '';

    return { shortWallet, longWallet, shortPrefix, shortSuffix };
  } catch (e) {
    console2.error(e);
    return null;
  }
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
    console2.error(e);
    return [];
  }
}

function getTeamName() {
  // /from\\n\\n([a-z0-9 ]*)\\n\\non/i
  const elem = document.querySelector(
    '.MuiChip-root.MuiChip-filled.MuiChip-sizeSmall.MuiChip-colorSecondary.MuiChip-filledSecondary'
  );
  return elem?.innerText || '';
}

function getRaffleTwitterHandle() {
  const twitterLink = document.querySelector('a[data-action="option-twitter"]');
  if (!twitterLink) {
    return null;
  }
  console2.log('twitterLink', twitterLink);

  const twitterHandle = extractTwitterHandle(twitterLink?.href);
  if (!twitterHandle) {
    return null;
  }
  console2.log('twitterHandle', twitterHandle);

  return twitterHandle;
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
