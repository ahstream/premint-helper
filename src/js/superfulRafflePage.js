console.info('superfulPage.js begin', window?.location?.href);

import '../styles/superfulPage.css';

import global from './global.js';
console.log(global);

import {
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
  // CUSTOM
  getJoinButton,
} from './superfulLib.js';

import {
  JOIN_BUTTON_TEXT,
  JOIN_BUTTON_IN_PROGRESS_TEXT,
  JOIN_BUTTON_TITLE,
  clickElement,
} from './premintHelperLib.js';

import { initRafflePage } from './rafflePage.js';

import { createObserver as createRaffleObserver, getPreviousWalletsWon } from './observerGeneric.js';
import { createObserver as createTwitterObserver } from './twitterObserver.js';

import {
  sleep,
  myConsole,
  //normalizePendingLink,
  //millisecondsAhead,
} from 'hx-lib';

const console2 = myConsole(global.LOGLEVEL);

// DATA ----------------------------------------------------------------------------

// eslint-disable-next-line no-unused-vars
let storage = null;

const config = {
  name: 'SUPERFUL',

  // SETTINGS
  storageKeys: ['runtime', 'options'],
  SLEEP_BETWEEN_WAIT_FOR_REGISTERED: 5000,
  SLEEP_BEFORE_NEXT_FORCE_REGISTER: 5000,

  // ENABLERS
  enableForceRegister: true,
  visitTwitterLinks: true,

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
  hasCaptcha: () => false,
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
  clickElement(regBtn, { real: true, simulate: true });
}

async function forceRegister(options, pageState) {
  const regBtn = getRegisterButtonSync();
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

  if (!isAllRegBtnsEnabled()) {
    console2.log('!isAllRegBtnsEnabled');
    return null;
  }

  clickElement(regBtn, { real: true, simulate: true });
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
  /*
  btn.className =
    'px-8 sm:px-0 sm:w-52 capitalize inline-flex items-center py-3 justify-center border border-transparent text-base font-medium rounded-xl shadow-sm  bg-teal-400  hover:bg-teal-500  focus:outline-none transition hidden sm:block';
  */
  btn.classList.add('ph-button');
  btn.addEventListener('click', clickHandler);

  regBtnContainer.before(btn);
}

function addPreviouslyWonWallets(pageState) {
  console2.log('addPreviouslyWonWallets', pageState);

  const twitterHandle = getTwitterHandle();
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

  const container = getJoinButton();
  if (!container) {
    return console2.error('Missing  container:', container);
  }
  console2.log('container', container);
  container.before(section);
}

async function handleSimpleErrors() {
  return false;
}

async function handleComplexErrors() {
  return false;
}

// SEMI CUSTOM API

// nothing here
