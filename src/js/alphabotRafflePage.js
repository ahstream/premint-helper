console.info('alphabotRafflePage.js begin', window?.location?.href);

import '../styles/alphabotPage.css';

import global from './global.js';
console.log(global);

import {
  getRaffleTwitterHandle,
  getTwitterHandle,
  getDiscordHandle,
  getSelectedWallet,
  getWonWalletsByThisAccount,
  getMustJoinLinks,
  getMustFollowLinks,
  getMustLikeAndRetweetLinks,
  getMustLikeLinks,
  getMustRetweetLinks,
  hasRegistered,
  getRegisterButton,
  getRegisterButtonSync,
  getErrors,
  getTeamName,
  isAllRegBtnsEnabled,
  hasRaffleTrigger,
  hasRaffleTrigger2,
  waitForRafflePageLoaded,
  // CUSTOM
} from './alphabotLib.js';

import {
  JOIN_BUTTON_TEXT,
  JOIN_BUTTON_IN_PROGRESS_TEXT,
  JOIN_BUTTON_TITLE,
  clickElement,
} from './premintHelperLib';

import { initRafflePage } from './rafflePage';

import { createObserver as createRaffleObserver, getPreviousWalletsWon } from './observerGeneric';
import { createObserver as createTwitterObserver } from './twitterObserver.js';

import {
  ONE_SECOND,
  sleep,
  waitForSelector,
  extractTwitterHandle,
  getElementByText,
  myConsole,
} from 'hx-lib';

const console2 = myConsole(global.LOGLEVEL);

// DATA ----------------------------------------------------------------------------

let storage = null;

const config = {
  name: 'ALPHABOT',

  // SETTINGS
  storageKeys: ['runtime', 'options'],
  SLEEP_BETWEEN_WAIT_FOR_REGISTERED: 10000,
  SLEEP_BEFORE_NEXT_FORCE_REGISTER: 10000,

  // ENABLERS
  enableForceRegister: true,
  visitTwitterLinks: false,

  // STATIC COMMON API
  createObserver: async (config) => createRaffleObserver(config),
  createObserver2: async (config) => createTwitterObserver(config),
  setStorage: (newStorage) => (storage = newStorage),
  getWonWalletsByAllAccounts: () => getPreviousWalletsWon(getRaffleTwitterHandle()),

  // STATIC PROVIDER API
  waitForRafflePageLoaded,
  getTwitterUser: getTwitterHandle,
  getDiscordUser: getDiscordHandle,
  getMustJoinLinks,
  getMustFollowLinks,
  getMustLikeLinks,
  getMustRetweetLinks,
  getMustLikeAndRetweetLinks,
  getSelectedWallet,
  getWonWalletsByThisAccount,
  getRegisterButton,
  getRegisterButtonSync,
  getErrors,
  hasRegistered,
  hasRaffleTrigger,
  hasRaffleTrigger2,
  isAllRegBtnsEnabled,
  JOIN_BUTTON_TEXT,
  JOIN_BUTTON_TITLE,
  JOIN_BUTTON_IN_PROGRESS_TEXT,

  // SEMI CUSTOM API

  shouldOpenTwitterTasks: () => true,
  hasCaptcha, // : () => false,
  hasWalletConnectDialog, // : () => false,
  hasAlreadyWon, // : () => false,
  hasDoingItTooOften, // : () => false,
  isIgnored, // : () => false,
  isPendingReg, // : () => false,
  setPendingReg, // : () => false,
  loadRafflePageWithCustomContent, // : () => false,

  // CUSTOM API
  register,
  forceRegister,
  addQuickRegButton,
  addPreviouslyWonWallets,
  handleSimpleErrors,
  handleComplexErrors,
};

// STARTUP ----------------------------------------------------------------------------

runNow();

function runNow() {
  initRafflePage(config);
}

// CUSTOM API

async function register(regBtn) {
  clickElement(regBtn, { real: true, simulate: true });
}

async function forceRegister(options) {
  const regBtn = getRegisterButtonSync(options, true);
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

  if (!isAllRegBtnsEnabled(options)) {
    console2.log('!isAllRegBtnsEnabled');
    return null;
  }

  clickElement(regBtn);
  // pageState.isRegistering = true;
  return regBtn;
}

async function addQuickRegButton(options, clickHandler) {
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

// SEMI CUSTOM API

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

function isIgnored(options, pageState) {
  const teamName = getTeamName();
  let ignored =
    pageState.isAutoStarted && // only ignore auto started raffles!
    storage.options.ALPHABOT_IGNORED_NAMES.length &&
    teamName &&
    storage.options.ALPHABOT_IGNORED_NAMES.includes(teamName);
  console2.log('isIgnored; teamName, ignored:', teamName, ignored);
  return ignored;
}

function isPendingReg() {
  return false;
}

async function setPendingReg() {
  return false;
}

function loadRafflePageWithCustomContent() {
  return false;
}

// MISC HELPERS
