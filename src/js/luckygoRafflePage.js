console.info('luckygoPage.js begin', window?.location?.href);

import '../styles/luckygoPage.css';

import {
  // OTHER API
  isAutomateTwitterTasksSelected,
  // RAFFLE API
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
  isAllRegBtnsEnabled,
  hasRaffleTrigger,
  hasRaffleTrigger2,
  waitForRafflePageLoaded,
  // HELPER API
  getRegisteringButton,
  hasErrors,
} from './luckygoLib.js';

import {
  JOIN_BUTTON_TEXT,
  JOIN_BUTTON_IN_PROGRESS_TEXT,
  JOIN_BUTTON_TITLE,
  clickElement,
} from './premintHelperLib';

import { initRafflePage } from './rafflePage';

import { createObserver as createRaffleObserver, getPreviousWalletsWon } from './observerGeneric';
import { createObserver as createTwitterObserver } from './twitterObserver.js';

import { sleep, myConsole } from 'hx-lib';

const console2 = myConsole();

// DATA ----------------------------------------------------------------------------

// eslint-disable-next-line no-unused-vars
let storage = null;

const config = {
  name: 'LUCKYGO',

  // SETTINGS
  storageKeys: ['runtime', 'options'],
  SLEEP_BETWEEN_WAIT_FOR_REGISTERED: 2000,
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
  shouldOpenTwitterTasks, //: () => true,
  hasCaptcha,
  hasWalletConnectDialog: () => false,
  hasAlreadyWon: () => false,
  hasDoingItTooOften: () => false,
  isIgnored: () => false,
  isPendingReg: () => false,
  setPendingReg: () => false,
  loadRafflePageWithCustomContent: () => false,

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

async function runNow() {
  initRafflePage(config);
}

// CUSTOM API

async function register(regBtn) {
  clickElement(regBtn, { real: false, simulate: true });
}

async function forceRegister(options, pageState) {
  const regBtn = getRegisterButtonSync(options);
  console2.log('forceRegister; regBtn:', regBtn);

  if (!regBtn) {
    console2.log('!regBtn');
    return null;
  }

  const errors = getErrors();
  console2.log('errors:', errors);
  if (errors.discord) {
    console2.log('Do not force register when discord errors!');
    return null;
  }

  if (!isAllRegBtnsEnabled(options)) {
    console2.log('!isAllRegBtnsEnabled');
    return null;
  }

  clickElement(regBtn);
  console2.log('pageState', pageState);
  if (pageState.isRegistering) {
    await sleep(config.SLEEP_BEFORE_NEXT_FORCE_REGISTER);
  }
  // pageState.isRegistering = true;
  return regBtn;
}

async function addQuickRegButton(options, clickHandler) {
  const regBtnContainer = await getRegisterButton(options);
  console2.log('regBtnContainer', regBtnContainer);
  if (!regBtnContainer) {
    return;
  }

  const btn = document.createElement('button');
  btn.id = 'ph-quick-reg';
  btn.innerHTML = JOIN_BUTTON_TEXT;
  btn.title = JOIN_BUTTON_TITLE;
  btn.className =
    'ph-button active:buttonShadow mt-6 flex h-12 cursor-pointer items-center justify-center rounded-full bg-primary-500 text-base font-medium text-neutral-100 hover:bg-primary-600 bg-primary-500 text-neutral-100';
  btn.addEventListener('click', clickHandler);

  regBtnContainer.before(btn);
}

function addPreviouslyWonWallets(pageState) {
  console2.log('addPreviouslyWonWallets', pageState);

  const twitterHandle = getRaffleTwitterHandle();
  if (!twitterHandle) {
    return;
  }
  console2.log('twitterHandle', twitterHandle);

  const section = pageState.observer.createPreviousWonSection(twitterHandle, true);
  console2.log('section', section);
  if (!section) {
    return;
  }
  console2.log('section', section);

  const containers1 = [...document.querySelectorAll('div')].filter((x) =>
    x.innerText.startsWith('Mint wallet')
  );
  const containers2 = [...document.querySelectorAll('div')].filter((x) =>
    x.innerText.startsWith('You submitted:')
  );
  const containers = [...containers1, ...containers2];

  if (!containers?.length) {
    console2.error('Missing mint wallet container:', containers);
    return;
  }
  console2.log('section', section);
  containers[0].before(section);
}
async function handleSimpleErrors(exitFn) {
  const errors = getErrors();
  if (errors?.length) {
    await sleep(1000);
    console2.log('Has errors:', errors);
    if (hasCaptcha()) {
      exitFn('raffleCaptcha');
      return true;
    }
    exitFn('unspecifiedRaffleError');
    return true;
  }
  return false;
}

async function handleComplexErrors(pageState, context) {
  if (!pageState.isRegistering) {
    return false;
  }
  if (hasErrors()) {
    context.exitAction('raffleUnknownError');
    return true;
  }
  await sleep(500);
  if (hasErrors()) {
    context.exitAction('raffleUnknownError');
    return true;
  }
  console2.log('Wait for regbtn not registering');
  while (getRegisteringButton()) {
    if (hasErrors()) {
      context.exitAction('raffleUnknownError');
      return true;
    }
    await sleep(10);
  }
  if (hasErrors()) {
    context.exitAction('raffleUnknownError');
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
  return elem && typeof elem?.disabled === 'boolean' && elem.disabled === false;
}

// MISC

function shouldOpenTwitterTasks() {
  return !isAutomateTwitterTasksSelected();
}
