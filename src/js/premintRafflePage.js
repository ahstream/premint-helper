console.info('premintRafflePage.js begin', window?.location?.href);

import '../styles/premintPage.css';

import { JOIN_BUTTON_TEXT, JOIN_BUTTON_IN_PROGRESS_TEXT, JOIN_BUTTON_TITLE } from './premintHelperLib';
import { initRafflePage } from './rafflePage';

import {
  ONE_SECOND,
  sleep,
  waitForSelector,
  createLogger,
  setStorageData,
  noDuplicates,
  addToDate,
  normalizePendingLink,
} from 'hx-lib';

import { createObserver as createRaffleObserver } from './observerGeneric';

const debug = createLogger();

// DATA ----------------------------------------------------------------------------

let storage = null;

const config = {
  name: 'PREMINT',
  enableForceRegister: false,
  storageKeys: ['runtime', 'options', 'pendingPremintReg'],
  setStorage,
  createObserver,
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
  getAlphaName,
  getRaffleTwitterHandle,
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

async function createObserver() {
  return await createRaffleObserver();
}

// WAIT FOR LOADED ----------------------------------------------

async function waitForRafflePageLoaded() {
  // skip waiting for dom elements for now, perhaps need to in future?!
  return true;
}

// REGISTER

function forceRegister() {
  return null;
}

// REGISTER BTN FUNCS ----------------------------------------------

async function getRegisterButton(maxWait = 1000, interval = 10) {
  return await waitForSelector(storage.options.PREMINT_REG_BTN_SEL, maxWait, interval);
}

function getRegisterButtonSync() {
  return document.querySelector(storage.options.PREMINT_REG_BTN_SEL);
}

function isAllRegBtnsEnabled() {
  const regBtn = getRegisterButtonSync();
  console.log('regBtn', regBtn);
  if (regBtn?.disabled) {
    return false;
  }
  return !!regBtn;
}

async function addQuickRegButton(clickHandler) {
  const regBtnContainer = await getRegisterButton();
  debug.log('regBtn', regBtnContainer);
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

// RAFFLE STATE CHECKERS -------------------------------------------------------------------

function hasRegistered() {
  return document.body.innerHTML.match(/<i class="fas fa-check-circle text-success mr-2"><\/i>Registered/i);
}

function hasCaptcha() {
  // document.querySelector('.recaptcha-checkbox-checked')
  // document.querySelector('.recaptcha-checkbox-borderAnimation')
  // const elem = document.querySelector('iframe[title="reCAPTCHA"]');
  const elem = document.querySelector('iframe[src*="hcaptcha.com"]');
  return elem && typeof elem?.disabled === 'boolean' && elem.disabled === false;
}

function hasWalletConnectDialog() {
  return false;
}

function hasAlreadyWon() {
  return false;
}

function hasDoingItTooOften() {
  return false;
}

async function hasRaffleTrigger() {
  const elem = await waitForSelector(storage.options.PREMINT_MAIN_REGION_SEL, 10 * ONE_SECOND, 50);
  debug.log('hasRaffleTrigger:', elem);
  return !!elem;
}

async function hasRaffleTrigger2() {
  return hasRaffleTrigger();
}

function isIgnored() {
  return false;
}

// PENDING REG --------------------------------

function isPendingReg() {
  debug.log('isPendingReg');
  const url = normalizePendingLink(window.location.href);
  if (!storage.pendingPremintReg[url]) {
    debug.log('No pending register!');
    return false;
  }
  const pendingDate = new Date(JSON.parse(storage.pendingPremintReg[url]));
  const toDate = addToDate(pendingDate, { seconds: storage.options.PREMINT_PENDING_REG_FOR_SECS });
  const nowDate = new Date();
  const isPending = toDate > nowDate;

  debug.log('pendingDate, toDate, nowDate, isPending:', pendingDate, toDate, nowDate, isPending);

  if (!isPending) {
    delete storage.pendingPremintReg[url];
    setStorageData({ pendingPremintReg: storage.pendingPremintReg });
  }

  return isPending;
}

async function setPendingReg() {
  const url = normalizePendingLink(window.location.href);
  storage.pendingPremintReg[url] = JSON.stringify(new Date());
  debug.log('storage.pendingPremintReg set:', storage.pendingPremintReg, url);
  await setStorageData({ pendingPremintReg: storage.pendingPremintReg });
}

// PAGE GETTERS -------------------------------------

function getTwitterUser() {
  try {
    return document.querySelector('#step-twitter').querySelector('span').innerText?.trim();
  } catch (e) {
    console.error('Failed getting Twitter user! Error:', e);
    return null;
  }
}

function getDiscordUser() {
  try {
    return document.querySelector('#step-discord').querySelector('span').innerText?.trim();
  } catch (e) {
    console.error('Failed getting Twitter user! Error:', e);
    return null;
  }
}

function getAlphaName() {
  return '';
}

function getRaffleTwitterHandle() {
  return '';
}

// PARSE TASK LINKS -------------------------------------

function parseMustLikeLinks() {
  return parseTwitterLinks(storage.options.PREMINT_MUST_LIKE_SEL);
}

function parseMustRetweetLinks() {
  return parseTwitterLinks(storage.options.PREMINT_MUST_RETWEET_SEL);
}

function parseMustLikeAndRetweetLinks() {
  return parseTwitterLinks(storage.options.PREMINT_MUST_LIKE_AND_RETWEET_SEL);
}

function parseMustFollowLinks() {
  return parseTwitterLinks(storage.options.PREMINT_MUST_FOLLOW_SEL);
}

function parseTwitterLinks(prefix) {
  try {
    debug.log('parseTwitterLinks; prefix', prefix);
    const baseElem = document.querySelector('#step-twitter');
    if (!baseElem) {
      return [];
    }
    const baseElems = baseElem.querySelectorAll('div[class*="text-md"]');
    debug.log('baseElems', baseElems);
    if (!baseElems?.length) {
      return [];
    }
    const elems = [...baseElems].filter((e) => e.innerText.toLowerCase().trim().startsWith(prefix));
    debug.log('elems', elems);
    const arr = elems.length < 1 ? [] : Array.from(elems[0].getElementsByTagName('a')).map((a) => a.href);
    debug.log('arr', arr);
    return noDuplicates(arr);
  } catch (e) {
    console.error('Failed parsing twitter links. Error:', e);
    return [];
  }
}

function parseMustJoinLinks(mustHaveRole = false) {
  /*
  return [...document.querySelectorAll('p.MuiTypography-root')]
    .filter((e) => e.innerText.toLowerCase().includes('join') && e.innerText.toLowerCase().includes('discord'))
    .map((e) => e.getElementsByTagName('a'))
    .map((e) => Array.from(e))
    .flat()
    .map((e) => e.href);
    */
  debug.log('parseMustJoinLinks');
  const selectors = mustHaveRole
    ? storage.options.PREMINT_JOIN_DISCORD_WITH_ROLE_SEL
    : storage.options.PREMINT_JOIN_DISCORD_SEL;

  const allElems = [...document.querySelectorAll(selectors[0])].filter(
    (el) =>
      el.textContent.trim().toLowerCase().startsWith(selectors[1]) &&
      el.textContent.trim().toLowerCase().includes(selectors[2])
  );
  debug.log('selectors', selectors);
  debug.log('allElems', allElems);
  debug.log('allElems[0]', allElems[0]);
  const validElems = allElems.length ? [allElems[0].querySelector(selectors[3])] : [];
  debug.log('validElems', validElems);
  const links = validElems.filter((e) => !!e).map((x) => x.href);
  debug.log('links', links);
  return links;
}

// WON WALLETS

function addPreviouslyWonWallets() {
  return;
}

function getWonWalletsByThisAccount() {
  return [];
}

function getWonWalletsByAllAccounts() {
  return [];
}

function getSelectedWallet() {
  return null;
}

// ERROR HANDLING

function getErrors() {
  const elems = [...document.querySelectorAll('.alert-danger')];
  if (elems?.length) {
    return ['unspecifiedRaffleError'];
  }
  return [];
}

async function handleSimpleErrors(exitFn) {
  const errors = getErrors();
  if (errors?.length) {
    await sleep(1000);
    debug.log('Has errors:', errors);
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

// CUSTOM CONTENT ----------------------------------------------------------------------------------

function loadRafflePageWithCustomContent() {
  debug.log('loadRafflePageWithCustomContent...');
  if (!storage.options.PREMINT_ENABLE) {
    return debug.log('Premint automation disabled, do nothing!');
  }
  fillPremintCustomField();
}

function fillPremintCustomField() {
  debug.log('fillPremintCustomField');

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
  debug.log('customFieldProperties', customFieldProperties);
  return { customFieldText, ...customFieldProperties };
}

function getPremintCustomFieldProperties() {
  const customFieldLabel = document
    .querySelector(storage.options.PREMINT_CUSTOM_FIELD_LABEL_SEL)
    ?.textContent.trim();
  debug.log('customFieldLabel', customFieldLabel);
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
  debug.log('setPremintCustomField', text);
  if (typeof text !== 'string') {
    debug.log('Custom field value not a string!');
    return;
  }
  const elem = document.querySelector(storage.options.PREMINT_CUSTOM_FIELD_SEL);
  if (elem) {
    elem.value = text;
  }
}
