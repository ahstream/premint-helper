console.info('atlasPage.js begin', window?.location?.href);

import '../styles/atlasPage.css';

import { JOIN_BUTTON_TEXT, JOIN_BUTTON_IN_PROGRESS_TEXT, JOIN_BUTTON_TITLE } from './premintHelperLib';
import { initRafflePage } from './rafflePage';

import {
  ONE_SECOND,
  sleep,
  waitForSelector,
  waitForTextEquals,
  createLogger,
  //setStorageData,
  noDuplicates,
  //addToDate,
  //normalizePendingLink,
  millisecondsAhead,
} from 'hx-lib';

const debug = createLogger();

// DATA ----------------------------------------------------------------------------

let storage = null;

const config = {
  name: 'ATLAS',
  enableForceRegister: false,
  storageKeys: ['runtime', 'options'],
  setStorage,
  createObserver,
  waitForRafflePageLoaded,
  forceRegister,
  readyToRegister,
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
  return null; // do nothing
}

// WAIT FOR LOADED ----------------------------------------------

async function waitForRafflePageLoaded() {
  debug.log('waitForRafflePageLoaded');

  const stopTime = millisecondsAhead(storage.options.ATLAS_WAIT_FOR_RAFFLE_PAGE_LOADED);
  while (Date.now() <= stopTime) {
    const du = getDiscordUser();
    const tu = getTwitterUser();
    console.log('du, tu:', du, tu);
    if (du || tu) {
      await sleep(1000);
      return true;
    }
    await sleep(1000);
  }

  debug.log('Raffle page has NOT loaded!');
  return false;
}

// REGISTER

function forceRegister() {
  return null;
}

function readyToRegister() {
  return isAllTasksCompleted();
}

// REGISTER BTN FUNCS ----------------------------------------------

async function getRegisterButton(maxWait = 1000, interval = 10) {
  console.log('getRegisterButtonSync', getRegisterButtonSync());
  return await waitForTextEquals(storage.options.ATLAS_REG_BTN_SEL, 'button', maxWait, interval);
}

function getRegisterButtonSync() {
  return [...document.querySelectorAll('button')].filter(
    (x) => x.innerText === storage.options.ATLAS_REG_BTN_SEL
  )[0];
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
  btn.className =
    'ph-button flex justify-center items-center gap-2 py-2 px-4 bg-primary-500 rounded-lg text-white w-full transition hover:cursor-pointer';
  btn.addEventListener('click', clickHandler);

  const container = getEntryContainer();
  console.log('container', container);
  container.after(btn);
}

function getEntryContainer() {
  return (
    [...document.querySelectorAll('div.pb-2')].filter((x) =>
      x.innerText.startsWith('Entry Requirements')
    )[0] || null
  );
}

function isAllTasksCompleted() {
  const s = getEntryContainer()?.innerText;
  if (!s) {
    return false;
  }
  const matches = s.matchAll(/([0-9]+) of ([0-9]+) TASKS COMPLETED/gi);
  const matchesArr = [...matches].flat();
  console.log('matches', matches, matchesArr);

  return (matchesArr.length === 3) & (matchesArr[1] === matchesArr[2]);
}

// RAFFLE STATE CHECKERS -------------------------------------------------------------------

function hasRegistered() {
  return document.body.innerHTML.match(/REGISTERED SUCCESSFULLY - /i);
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
  const elem = await waitForSelector(storage.options.ATLAS_MAIN_REGION_SEL, 10 * ONE_SECOND, 50);
  debug.log('hasRaffleTrigger:', elem);
  return !!elem;
}

async function hasRaffleTrigger2() {
  return hasRaffleTrigger();
}

function isIgnored() {
  return false;
}

function hasErrors() {
  return !!document.querySelector('div.text-white.bg-red-500');
}

// PENDING REG --------------------------------

function isPendingReg() {
  return false;
}

async function setPendingReg() {
  return false;
}

// PAGE GETTERS -------------------------------------

function getTwitterUser() {
  try {
    const elems = parseTaskTexts(storage.options.ATLAS_TWITTER_USER_SEL);
    console.log('getTwitterUser elems', elems);
    if (!elems?.length) {
      return null;
    }
    return elems[0].innerText.replace(storage.options.ATLAS_TWITTER_USER_SEL, '').replace('@', '').trim();
  } catch (e) {
    console.error('Failed getTwitterUser! Error:', e);
    return null;
  }
}

function getDiscordUser() {
  try {
    const elems = parseTaskTexts(storage.options.ATLAS_DISCORD_USER_SEL);
    console.log('getDiscordUser elems', elems);
    if (!elems?.length) {
      return null;
    }
    return elems[0].innerText.replace(storage.options.ATLAS_DISCORD_USER_SEL, '').trim();
  } catch (e) {
    console.error('Failed getDiscordUser! Error:', e);
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
  return parseTaskLinks(storage.options.ATLAS_MUST_LIKE_SEL);
}

function parseMustRetweetLinks() {
  return parseTaskLinks(storage.options.ATLAS_MUST_RETWEET_SEL);
}

function parseMustLikeAndRetweetLinks() {
  return parseTaskLinks(storage.options.ATLAS_MUST_LIKE_AND_RETWEET_SEL);
}

function parseMustFollowLinks() {
  return parseTaskLinks(storage.options.ATLAS_MUST_FOLLOW_SEL);
}

function parseMustJoinLinks(mustHaveRole = false) {
  if (mustHaveRole) {
    return [];
  }
  return parseTaskLinks(storage.options.ATLAS_JOIN_DISCORD_SEL);
}

function parseTaskLinks(prefix) {
  debug.log('parseTaskLinks; prefix:', prefix);
  try {
    const baseElems = getMainTaskElements();
    if (!baseElems?.length) {
      return [];
    }
    const mainElems = baseElems.filter((e) => e.innerText.toLowerCase().trim().startsWith(prefix));
    debug.log('elems', mainElems);

    const arr = mainElems.map((x) => x.getElementsByTagName('a')).map((x) => Array.from(x));
    debug.log('arr', arr);
    const noDups = noDuplicates(arr.flat().map((x) => x.href));
    debug.log('noDups', noDups);
    const badLinks = noDups.filter((x) => isCorruptTaskLink(x));
    const useLinks = noDups.filter((x) => !isCorruptTaskLink(x));
    debug.log('badLinks, useLinks', badLinks, useLinks);
    // return noDuplicates(arr);
    return useLinks;
  } catch (e) {
    console.error('Failed parsing task links. Error:', e);
    return [];
  }
}

function parseTaskTexts(prefix) {
  debug.log('parseTaskText; prefix:', prefix);
  try {
    const baseElems = getMainTaskElements();
    if (!baseElems?.length) {
      return [];
    }
    const mainElems = baseElems.filter((e) => e.innerText.trim().startsWith(prefix));
    debug.log('elems', mainElems);
    return mainElems;
  } catch (e) {
    console.error('Failed parsing task texts. Error:', e);
    return [];
  }
}

function getMainTaskElements() {
  debug.log('getMainTaskElements');
  const mainElems = [...document.querySelectorAll('p')].filter(
    (x) => x.innerText === storage.options.ATLAS_MAIN_REGION_SEL
  );
  if (!mainElems) {
    return [];
  }
  const baseElems = document.querySelectorAll('div.flex.py-5');
  debug.log('baseElems', baseElems);
  if (!baseElems?.length) {
    return [];
  }
  return [...baseElems];
}

function count(str, regexp) {
  return ((str || '').match(regexp) || []).length;
}

function isCorruptTaskLink(s) {
  // eslint-disable-next-line no-useless-escape
  const n = count(s, /https\:\/\//gi);
  console.log('isCorruptTaskLink', s, n, n > 1);
  return n > 1;
  // return s.includes('https://twitter.com/any/status/');
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

async function handleComplexErrors(pageState, context) {
  if (!pageState.isRegistering) {
    return false;
  }
  await sleep(500);
  const regBtn = getRegisterButtonSync();
  console.log('Wait for regbtn not disabled');
  while (regBtn && regBtn.disabled) {
    await sleep(10);
  }
  if (hasErrors()) {
    context.exitAction('raffleUnknownError');
    return true;
  }

  return false;
}

// CUSTOM CONTENT ----------------------------------------------------------------------------------

function loadRafflePageWithCustomContent() {
  return false;
}
