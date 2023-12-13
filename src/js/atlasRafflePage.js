console.info('atlasPage.js begin', window?.location?.href);

import '../styles/atlasPage.css';

import { JOIN_BUTTON_TEXT, JOIN_BUTTON_IN_PROGRESS_TEXT, JOIN_BUTTON_TITLE } from './premintHelperLib';

import { initRafflePage } from './rafflePage';

import {
  ONE_SECOND,
  sleep,
  waitForSelector,
  waitForTextEquals,
  //setStorageData,
  noDuplicates,
  //addToDate,
  //normalizePendingLink,
  millisecondsAhead,
  extractTwitterHandle,
  myConsole,
} from 'hx-lib';

//import { createObserver as createRaffleObserver, getPreviousWalletsWon } from './observerGeneric';
import { createObserver as createRaffleObserver, getPreviousWalletsWon } from './observerGeneric';
import { createObserver as createTwitterObserver } from './twitterObserver.js';

const console2 = myConsole();

// DATA ----------------------------------------------------------------------------

let storage = null;

const config = {
  name: 'ATLAS',
  enableForceRegister: false,
  storageKeys: ['runtime', 'options'],
  setStorage,
  createObserver,
  createObserver2,
  waitForRafflePageLoaded,
  forceRegister,
  readyToRegister,
  skipReqsIfReady,
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
  getMustLikeLinks,
  getMustRetweetLinks,
  getMustLikeAndRetweetLinks,
  getMustFollowLinks,
  getMustJoinLinks,
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

  const stopTime = millisecondsAhead(storage.options.ATLAS_WAIT_FOR_RAFFLE_PAGE_LOADED);
  while (Date.now() <= stopTime) {
    const du = getDiscordUser();
    const tu = getTwitterUser();
    console2.log('du, tu:', du, tu);
    if (du || tu) {
      await sleep(1000);
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
  return null;
}

function readyToRegister() {
  return isAllTasksCompleted();
}

function skipReqsIfReady() {
  return storage.options.ATLAS_SKIP_REQS_IF_READY && isAllTasksCompleted();
}

function isAllTasksCompleted() {
  const s = getEntryContainer()?.innerText;
  if (!s) {
    return false;
  }
  const matches = s.matchAll(/([0-9]+) of ([0-9]+) TASKS COMPLETED/gi);
  const matchesArr = [...matches].flat();
  console2.log('matches', matches, matchesArr);

  const r = (matchesArr.length === 3) & (matchesArr[1] === matchesArr[2]);
  console2.log('r', r);

  return r;
}

// REGISTER BTN FUNCS ----------------------------------------------

async function getRegisterButton(maxWait = 1000, interval = 10) {
  console2.log('getRegisterButton');
  return await waitForTextEquals(storage.options.ATLAS_REG_BTN_SEL, 'button', maxWait, interval);
}

function getRegisterButtonSync() {
  return [...document.querySelectorAll('button')].filter(
    (x) => x.innerText === storage.options.ATLAS_REG_BTN_SEL
  )[0];
}

function isAllRegBtnsEnabled() {
  const regBtn = getRegisterButtonSync();
  console2.log('regBtn', regBtn);
  if (regBtn?.disabled) {
    return false;
  }
  return !!regBtn;
}

async function addQuickRegButton(options, clickHandler) {
  const regBtnContainer = await getRegisterButton();
  console2.log('regBtn', regBtnContainer);
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
  console2.log('container', container);
  container.after(btn);
}

function getEntryContainer() {
  return (
    [...document.querySelectorAll('div.pb-2')].filter((x) =>
      x.innerText.startsWith('Entry Requirements')
    )[0] || null
  );
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
  console2.log('hasRaffleTrigger:', elem);
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

// PARSE TASK LINKS -------------------------------------

function getMustLikeLinks() {
  return parseTaskLinks(storage.options.ATLAS_MUST_LIKE_SEL);
}

function getMustRetweetLinks() {
  return parseTaskLinks(storage.options.ATLAS_MUST_RETWEET_SEL);
}

function getMustLikeAndRetweetLinks() {
  return parseTaskLinks(storage.options.ATLAS_MUST_LIKE_AND_RETWEET_SEL);
}

function getMustFollowLinks() {
  return parseTaskLinks(storage.options.ATLAS_MUST_FOLLOW_SEL);
}

function getMustJoinLinks(options, mustHaveRole = false) {
  if (mustHaveRole) {
    return [];
  }
  return parseTaskLinks(storage.options.ATLAS_JOIN_DISCORD_SEL);
}

function parseTaskLinks(prefix) {
  console2.log('parseTaskLinks; prefix:', prefix);
  try {
    const baseElems = getMainTaskElements();
    if (!baseElems?.length) {
      return [];
    }
    const mainElems = baseElems.filter((e) => e.innerText.toLowerCase().trim().startsWith(prefix));
    console2.log('elems', mainElems);

    const arr = mainElems.map((x) => x.getElementsByTagName('a')).map((x) => Array.from(x));
    console2.log('arr', arr);
    const noDups = noDuplicates(arr.flat().map((x) => x.href));
    console2.log('noDups', noDups);
    const badLinks = noDups.filter((x) => isCorruptTaskLink(x));
    const useLinks = noDups.filter((x) => !isCorruptTaskLink(x));
    console2.log('badLinks, useLinks', badLinks, useLinks);
    // return noDuplicates(arr);
    return useLinks;
  } catch (e) {
    console2.error('Failed parsing task links. Error:', e);
    return [];
  }
}

function parseTaskTexts(prefix) {
  console2.log('parseTaskText; prefix:', prefix);
  try {
    const baseElems = getMainTaskElements();
    if (!baseElems?.length) {
      return [];
    }
    const mainElems = baseElems.filter((e) => e.innerText.trim().startsWith(prefix));
    console2.log('elems', mainElems);
    return mainElems;
  } catch (e) {
    console2.error('Failed parsing task texts. Error:', e);
    return [];
  }
}

function getMainTaskElements() {
  console2.log('getMainTaskElements');
  const mainElems = [...document.querySelectorAll('p')].filter(
    (x) => x.innerText === storage.options.ATLAS_MAIN_REGION_SEL
  );
  if (!mainElems) {
    return [];
  }
  const baseElems = document.querySelectorAll('div.flex.py-5');
  console2.log('baseElems', baseElems);
  if (!baseElems?.length) {
    return [];
  }
  return [...baseElems];
}

function isCorruptTaskLink(s) {
  // eslint-disable-next-line no-useless-escape
  const n = countOccurances(s, /https\:\/\//gi);
  console2.log('isCorruptTaskLink', s, n, n > 1);
  return n > 1;
  // return s.includes('https://twitter.com/any/status/');
}

// MISC HELPERS

function countOccurances(str, regexp) {
  return ((str || '').match(regexp) || []).length;
}

// WON WALLETS

function addPreviouslyWonWallets(pageState) {
  const twitterHandle = getRaffleTwitterHandle();
  if (!twitterHandle) {
    return;
  }
  console2.log('twitterHandle', twitterHandle);

  const section = pageState.observer.createPreviousWonSection(twitterHandle, true);
  if (!section) {
    return;
  }
  console2.log('section', section);
  document.body.appendChild(section);

  /*
  const tasksElem = getElementByText('Tasks', 'h5', { contains: true });
  if (!tasksElem) {
    console2.error('Missing Tasks elem!');
    return;
  }
  console2.log('tasksElem', tasksElem);
  tasksElem.after(section);
  */
}

function getWonWalletsByAllAccounts() {
  return getPreviousWalletsWon(getRaffleTwitterHandle());
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
  await sleep(500);
  const regBtn = getRegisterButtonSync();
  console2.log('Wait for regbtn not disabled');
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

// RAFFLE GETTERS

function getSelectedWallet() {
  try {
    const elem = document.getElementById('headlessui-listbox-button-:r0:');
    if (elem?.innerText) {
      return null;
    }

    const shortWallet = elem?.innerText || '';
    const longWallet = '';
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
  return [];
}

function getRaffleTwitterHandle() {
  const mustFollowLinks = getMustFollowLinks();
  console2.log('mustFollowLinks', mustFollowLinks);
  if (!mustFollowLinks?.length) {
    return null;
  }
  const twitterHandle = extractTwitterHandle(mustFollowLinks[0]);
  if (!twitterHandle) {
    return null;
  }
  console2.log('twitterHandle', twitterHandle);

  return twitterHandle;
}

function getTwitterUser() {
  try {
    const elems = parseTaskTexts(storage.options.ATLAS_TWITTER_USER_SEL);
    console2.log('getTwitterUser elems', elems);
    if (!elems?.length) {
      return null;
    }
    return elems[0].innerText.replace(storage.options.ATLAS_TWITTER_USER_SEL, '').replace('@', '').trim();
  } catch (e) {
    console2.error('Failed getTwitterUser! Error:', e);
    return null;
  }
}

function getDiscordUser() {
  try {
    const elems = parseTaskTexts(storage.options.ATLAS_DISCORD_USER_SEL);
    console2.log('getDiscordUser elems', elems);
    if (!elems?.length) {
      return null;
    }
    return elems[0].innerText.replace(storage.options.ATLAS_DISCORD_USER_SEL, '').trim();
  } catch (e) {
    console2.error('Failed getDiscordUser! Error:', e);
    return null;
  }
}
