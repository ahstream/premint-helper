console.info('superfulPage.js begin', window?.location?.href);

import '../styles/superfulPage.css';

import {
  getRaffleTwitterHandle,
  getRaffleDiscordHandle,
  getSelectedWallet,
  getErrors,
  hasErrors,
  getMustJoinLinks,
  getMustFollowLinks,
  getMustLikeAndRetweetLinks,
  getMustLikeLinks,
  getMustRetweetLinks,
  hasJoinedRaffle,
  getJoinButton,
  getJoiningButton,
  hasRaffleTrigger,
  hasRaffleTrigger2,
} from './superfulLib.js';

import {
  JOIN_BUTTON_TEXT,
  JOIN_BUTTON_IN_PROGRESS_TEXT,
  JOIN_BUTTON_TITLE,
  clickElement,
} from './premintHelperLib.js';

import { initRafflePage } from './rafflePage.js';

import {
  sleep,
  myConsole,
  //normalizePendingLink,
  millisecondsAhead,
} from 'hx-lib';

import { createObserver as createRaffleObserver, getPreviousWalletsWon } from './observerGeneric.js';
import { createObserver as createTwitterObserver } from './twitterObserver.js';

const console2 = myConsole();

// DATA ----------------------------------------------------------------------------

const SLEEP_BEFORE_NEXT_FORCE_REGISTER = 10000;

let storage = null;

const config = {
  name: 'SUPERFUL',
  enableForceRegister: true,
  visitTwitterLinks: true,
  storageKeys: ['runtime', 'options'],
  SLEEP_BETWEEN_WAIT_FOR_REGISTERED: 10000,
  setStorage,
  createObserver,
  createObserver2,
  waitForRafflePageLoaded,
  register,
  forceRegister,
  getRegisterButton,
  isAllRegBtnsEnabled,
  addQuickRegButton,
  hasRegistered: hasJoinedRaffle,
  hasCaptcha: () => false,
  hasWalletConnectDialog: () => false,
  hasAlreadyWon: () => false,
  hasDoingItTooOften: () => false,
  hasRaffleTrigger,
  hasRaffleTrigger2,
  isIgnored: () => false,
  isPendingReg: () => false,
  setPendingReg: () => false,
  getTwitterUser: getRaffleTwitterHandle,
  getDiscordUser: getRaffleDiscordHandle,
  parseMustLikeLinks: getMustLikeLinks,
  parseMustRetweetLinks: getMustRetweetLinks,
  parseMustLikeAndRetweetLinks: getMustLikeAndRetweetLinks,
  parseMustFollowLinks: getMustFollowLinks,
  parseMustJoinLinks: getMustJoinLinks,
  getErrors,
  handleSimpleErrors,
  handleComplexErrors,
  loadRafflePageWithCustomContent: () => false,
  addPreviouslyWonWallets,
  getWonWalletsByThisAccount,
  getWonWalletsByAllAccounts,
  getSelectedWallet,
  JOIN_BUTTON_TEXT,
  JOIN_BUTTON_TITLE,
  JOIN_BUTTON_IN_PROGRESS_TEXT,
  getRegisteringButtonSync,
  shouldOpenTwitterTasks: () => true,
};

// STARTUP ----------------------------------------------------------------------------

runNow();

async function runNow() {
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

  const stopTime = millisecondsAhead(storage.options.SUPERFUL_WAIT_FOR_RAFFLE_PAGE_LOADED);
  while (Date.now() <= stopTime) {
    if (hasJoinedRaffle()) {
      return true;
    }
    const du = getRaffleDiscordHandle();
    const tu = getRaffleTwitterHandle();
    console2.log('du, tu:', du, tu);
    if (du || tu) {
      console2.info('Raffle page has loaded!');
      await sleep(1000);
      return true;
    }
    await sleep(1000);
  }

  console2.warn('Raffle page has NOT loaded!');
  return false;
}

// REGISTER

async function register(regBtn) {
  clickElement(regBtn, { real: true, simulate: true });
}

async function forceRegister(pageState) {
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

  if (!isAllRegBtnsEnabled(pageState)) {
    console2.log('!isAllRegBtnsEnabled');
    return null;
  }

  clickElement(regBtn, { real: true, simulate: true });
  console2.log('pageState', pageState);
  if (pageState.isRegistering) {
    await sleep(SLEEP_BEFORE_NEXT_FORCE_REGISTER);
  }
  // pageState.isRegistering = true;
  return regBtn;
}

async function getRegisterButton(maxWait = 1000, interval = 10) {
  const stopTime = millisecondsAhead(maxWait);
  while (Date.now() <= stopTime) {
    const btn = getJoinButton();
    if (btn) {
      console2.log('getRegisterButton:', btn);
      return btn;
    }
    await sleep(interval);
  }
}

function getRegisterButtonSync() {
  return getJoinButton();
}

function getRegisteringButtonSync() {
  return getJoiningButton();
}

function isAllRegBtnsEnabled() {
  const regBtn = getRegisterButtonSync();
  // console2.log('regBtn', regBtn);
  if (regBtn?.disabled) {
    return false;
  }
  return !!regBtn;
}

async function addQuickRegButton(clickHandler) {
  const regBtnContainer = await getRegisterButton();
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

// WON WALLETS

function getWonWalletsByThisAccount() {
  return [];
}

function getWonWalletsByAllAccounts() {
  return getPreviousWalletsWon(getRaffleTwitterHandle());
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

  const container = getJoinButton();
  if (!container) {
    return console2.error('Missing  container:', container);
  }
  console2.log('container', container);
  container.before(section);
}

// ERROR HANDLING

async function handleSimpleErrors() {
  if (hasErrors()) {
    return false;
  }
}

async function handleComplexErrors() {
  return false;
}

// CUSTOM CONTENT ----------------------------------------------------------------------------------

// RAFFLE GETTERS
