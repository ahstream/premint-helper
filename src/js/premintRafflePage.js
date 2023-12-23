console.info('premintRafflePage.js begin', window?.location?.href);

import '../styles/premintPage.css';

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
} from './premintLib.js';

import {
  JOIN_BUTTON_TEXT,
  JOIN_BUTTON_IN_PROGRESS_TEXT,
  JOIN_BUTTON_TITLE,
  clickElement,
} from './premintHelperLib';

import { initRafflePage } from './rafflePage';

import { createObserver as createRaffleObserver, getPreviousWalletsWon } from './observerGeneric.js';
import { createObserver as createTwitterObserver } from './twitterObserver.js';

import {
  sleep,
  myConsole,
  setStorageData,
  addToDate,
  normalizePendingLink,
  //addPendingRequest,
} from 'hx-lib';

const console2 = myConsole(global.LOGLEVEL);

// DATA ----------------------------------------------------------------------------

let storage = null;

const config = {
  name: 'PREMINT',

  // SETTINGS
  storageKeys: ['runtime', 'options', 'pendingPremintReg'],
  SLEEP_BETWEEN_WAIT_FOR_REGISTERED: 5000,
  SLEEP_BEFORE_NEXT_FORCE_REGISTER: 5000,

  // ENABLERS
  enableForceRegister: false,
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
  hasWalletConnectDialog: () => false,
  hasAlreadyWon: () => false,
  hasDoingItTooOften: () => false,
  isIgnored: () => false,
  isPendingReg, //: () => false,
  setPendingReg, //: () => false,
  loadRafflePageWithCustomContent, //: () => false,

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

async function forceRegister() {
  return null;
}

async function addQuickRegButton(options, clickHandler) {
  const regBtnContainer = await getRegisterButton(options);
  console2.log('regBtn', regBtnContainer);
  if (!regBtnContainer) {
    return;
  }

  const btn = document.createElement('button');
  btn.id = 'ph-quick-reg';
  btn.innerHTML = JOIN_BUTTON_TEXT;
  btn.title = JOIN_BUTTON_TITLE;
  btn.className = 'btn btn-styled btn-success btn-shadow btn-xl btn-block premintButton';
  btn.addEventListener('click', clickHandler);

  regBtnContainer.before(btn);
}

function addPreviouslyWonWallets() {
  return;
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

async function handleComplexErrors() {
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

function isPendingReg() {
  console2.log('isPendingReg');
  const url = normalizePendingLink(window.location.href);
  if (!storage.pendingPremintReg[url]) {
    console2.log('No pending register!');
    return false;
  }
  const pendingDate = new Date(JSON.parse(storage.pendingPremintReg[url]));
  const toDate = addToDate(pendingDate, { seconds: storage.options.PREMINT_PENDING_REG_FOR_SECS });
  const nowDate = new Date();
  const isPending = toDate > nowDate;

  console2.log('pendingDate, toDate, nowDate, isPending:', pendingDate, toDate, nowDate, isPending);

  if (!isPending) {
    delete storage.pendingPremintReg[url];
    setStorageData({ pendingPremintReg: storage.pendingPremintReg });
  }

  return isPending;
}

async function setPendingReg() {
  const url = normalizePendingLink(window.location.href);
  storage.pendingPremintReg[url] = JSON.stringify(new Date());
  console2.log('storage.pendingPremintReg set:', storage.pendingPremintReg, url);
  await setStorageData({ pendingPremintReg: storage.pendingPremintReg });
}

function loadRafflePageWithCustomContent() {
  console2.log('loadRafflePageWithCustomContent...');
  if (!storage.options.PREMINT_ENABLE) {
    return console2.log('Premint automation disabled, do nothing!');
  }
  fillPremintCustomField();
}

// MISC HELPERS

function fillPremintCustomField() {
  console2.log('fillPremintCustomField');

  const premintData = getPremintData();

  if (premintData.customFieldText) {
    // This one need to be first since it should override all others!
    return setPremintCustomField(premintData.customFieldText);
  }

  if (premintData.customFieldIsEmail && storage.options.USER_INFO_EMAIL_ADDRESS) {
    return setPremintCustomField(storage.options.USER_INFO_EMAIL_ADDRESS);
  }

  if (premintData.customFieldIsTwitter && storage.options.USER_INFO_TWITTER_ALIAS) {
    return setPremintCustomField(storage.options.USER_INFO_TWITTER_ALIAS);
  }

  if (premintData.customFieldIsDiscord && storage.options.USER_INFO_DISCORD_ALIAS) {
    return setPremintCustomField(storage.options.USER_INFO_DISCORD_ALIAS);
  }

  if (premintData.customFieldIsEthWallet && storage.options.USER_INFO_ETH_WALLET) {
    return setPremintCustomField(storage.options.USER_INFO_ETH_WALLET);
  }

  if (premintData.customFieldIsSolWallet && storage.options.USER_INFO_SOL_WALLET) {
    return setPremintCustomField(storage.options.USER_INFO_SOL_WALLET);
  }

  if (premintData.customFieldIsTezWallet && storage.options.USER_INFO_TEZ_WALLET) {
    return setPremintCustomField(storage.options.USER_INFO_TEZ_WALLET);
  }

  if (premintData.customFieldIsBtcWallet && storage.options.USER_INFO_BTC_WALLET) {
    return setPremintCustomField(storage.options.USER_INFO_BTC_WALLET);
  }
}

function getPremintData() {
  let customFieldText = storage.runtime?.customFieldText;
  if (!customFieldText) {
    // If custom field value is not already set, use value found on premint page!
    customFieldText = document.querySelector(storage.options.PREMINT_CUSTOM_FIELD_SEL)?.value ?? '';
  }
  const customFieldProperties = getPremintCustomFieldProperties();
  console2.log('customFieldProperties', customFieldProperties);
  return { customFieldText, ...customFieldProperties };
}

function getPremintCustomFieldProperties() {
  const customFieldLabel = document
    .querySelector(storage.options.PREMINT_CUSTOM_FIELD_LABEL_SEL)
    ?.textContent.trim();
  console2.log('customFieldLabel', customFieldLabel);
  if (customFieldLabel) {
    return {
      customFieldLabel: customFieldLabel,
      customFieldIsRetweetLink:
        customFieldLabel.search(new RegExp(storage.options.PREMINT_RETWEET_RE, 'i')) > -1,
      customFieldIsEmail: customFieldLabel.search(new RegExp(storage.options.PREMINT_EMAIL_RE, 'i')) > -1,
      customFieldIsTwitter: customFieldLabel.search(new RegExp(storage.options.PREMINT_TWITTER_RE, 'i')) > -1,
      customFieldIsDiscord: customFieldLabel.search(new RegExp(storage.options.PREMINT_DISCORD_RE, 'i')) > -1,
      customFieldIsSolWallet:
        customFieldLabel.search(new RegExp(storage.options.PREMINT_SOL_WALLET_RE, 'i')) > -1,
      customFieldIsEthWallet:
        customFieldLabel.search(new RegExp(storage.options.PREMINT_ETH_WALLET_RE, 'i')) > -1,
      customFieldIsTezWallet:
        customFieldLabel.search(new RegExp(storage.options.PREMINT_TEZ_WALLET_RE, 'i')) > -1,
      customFieldIsBtcWallet:
        customFieldLabel.search(new RegExp(storage.options.PREMINT_BTC_WALLET_RE, 'i')) > -1,
    };
  }
  return {};
}

function setPremintCustomField(text) {
  console2.log('setPremintCustomField', text);
  if (typeof text !== 'string') {
    console2.log('Custom field value not a string!');
    return;
  }
  const elem = document.querySelector(storage.options.PREMINT_CUSTOM_FIELD_SEL);
  if (elem) {
    elem.value = text;
  }
}
