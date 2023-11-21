console.info('luckygoPage.js begin', window?.location?.href);

import '../styles/luckygoPage.css';

import { getRaffleTwitterHandle, isAutomateTwitterTasksSelected } from './luckygoLib';

import {
  JOIN_BUTTON_TEXT,
  JOIN_BUTTON_IN_PROGRESS_TEXT,
  JOIN_BUTTON_TITLE,
  clickElement,
} from './premintHelperLib';

import { initRafflePage } from './rafflePage';

import {
  sleep,
  waitForTextEquals,
  myConsole,
  //setStorageData,
  noDuplicates,
  //addToDate,
  //normalizePendingLink,
  millisecondsAhead,
  getTextEquals,
} from 'hx-lib';

import { createObserver as createRaffleObserver, getPreviousWalletsWon } from './observerGeneric';
import { createObserver as createTwitterObserver } from './twitterObserver.js';

const console2 = myConsole();

// DATA ----------------------------------------------------------------------------

const SLEEP_BEFORE_NEXT_FORCE_REGISTER = 10000;

let storage = null;

const config = {
  name: 'LUCKYGO',
  enableForceRegister: true,
  storageKeys: ['runtime', 'options'],
  SLEEP_BETWEEN_WAIT_FOR_REGISTERED: 2000,
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
  getRegisteringButtonSync,
  shouldOpenTwitterTasks,
};

function shouldOpenTwitterTasks() {
  return !isAutomateTwitterTasksSelected();
}

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

  const stopTime = millisecondsAhead(storage.options.LUCKYGO_WAIT_FOR_RAFFLE_PAGE_LOADED);
  while (Date.now() <= stopTime) {
    if (hasRegistered()) {
      return true;
    }
    const du = getDiscordUser();
    const tu = getTwitterUser();
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

async function forceRegister(pageState) {
  const regBtn = getRegisterButtonSync(true);
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

  if (hasDoingItTooOften()) {
    console2.log('hasDoingItTooOften');
    return null;
  }

  if (!isAllRegBtnsEnabled(pageState)) {
    console2.log('!isAllRegBtnsEnabled');
    return null;
  }

  clickElement(regBtn);
  console2.log('pageState', pageState);
  if (pageState.isRegistering) {
    await sleep(SLEEP_BEFORE_NEXT_FORCE_REGISTER);
  }
  // pageState.isRegistering = true;
  return regBtn;
}

/*
function readyToRegister() {
  return isAllTasksCompleted();
}

function skipReqsIfReady() {
  return false;
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
*/

// REGISTER BTN FUNCS ----------------------------------------------

async function getRegisterButton(maxWait = 1000, interval = 10) {
  console2.log('getRegisterButton');
  return await waitForTextEquals(storage.options.LUCKYGO_REG_BTN_SEL, 'div', maxWait, interval);
}

function getRegisterButtonSync() {
  return [...document.querySelectorAll('div')].filter(
    (x) => x.innerText === storage.options.LUCKYGO_REG_BTN_SEL
  )[0];
}

function getRegisteringButtonSync() {
  return [...document.querySelectorAll('div')].filter((x) => x.innerText === 'Registering')[0];
}

function isAllRegBtnsEnabled() {
  /*
  if (pageState.isRegistering) {
    // if registering, all reg buttons should not be enabled!
    return false;
  }
  */
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
  btn.className =
    'ph-button active:buttonShadow mt-6 flex h-12 cursor-pointer items-center justify-center rounded-full bg-primary-500 text-base font-medium text-neutral-100 hover:bg-primary-600 bg-primary-500 text-neutral-100';
  btn.addEventListener('click', clickHandler);

  regBtnContainer.before(btn);
}

/*
function getEntryContainer() {
  return (
    [...document.querySelectorAll('div.pb-2')].filter((x) =>
      x.innerText.startsWith('Entry Requirements')
    )[0] || null
  );
}
*/

// RAFFLE STATE CHECKERS -------------------------------------------------------------------

function hasRegistered() {
  return !!getTextEquals('Registered successfully.', 'div');
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
  return !!getTextEquals('Congratulations', 'div');
}

function hasDoingItTooOften() {
  return false;
}

async function hasRaffleTrigger() {
  return !!getRegisterButtonSync();
}

async function hasRaffleTrigger2() {
  return hasRaffleTrigger();
}

function isIgnored() {
  return false;
}

function hasErrors() {
  return false;
  // return !!getErrors()?.length;
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
  return getTwitterLinks(
    [...document.querySelectorAll('div')].filter(
      (x) => x.innerText.startsWith('Like this') && x.innerText.endsWith('s) .')
    )
  );
}

function parseMustRetweetLinks() {
  return getTwitterLinks(
    [...document.querySelectorAll('div')].filter(
      (x) => x.innerText.startsWith('Retweet this') && x.innerText.endsWith('s) .')
    )
  );
}

function parseMustLikeAndRetweetLinks() {
  return getTwitterLinks(
    [...document.querySelectorAll('div')].filter(
      (x) => x.innerText.startsWith('Like & Retweet') && x.innerText.endsWith('s) .')
    )
  );
}

function parseMustFollowLinks() {
  return getTwitterLinks(
    [...document.querySelectorAll('div')].filter(
      (x) => x.innerText.startsWith('Follow') && x.innerText.endsWith('on Twitter.')
    )
  );
}

function getTwitterLinks(elems) {
  console2.log('getTwitterLinks, elems', elems);
  if (!elems.length) {
    return [];
  }
  const allLinks = [];
  for (let elem of elems) {
    console2.log('elem', elem);
    const links = [...elem.querySelectorAll('a')]
      .filter(
        (x) =>
          x.href.toLowerCase().startsWith('https://twitter.com/') ||
          x.href.toLowerCase().startsWith('https://x.com/')
      )
      .map((x) => x.href);
    if (links.length) {
      allLinks.push(...links);
    }
  }

  console2.log('getTwitterLinks', allLinks);

  return noDuplicates(allLinks);
}

function parseMustJoinLinks(mustHaveRole = false) {
  console2.log('parseMustJoinLinks:', mustHaveRole);
  /*
  let elems;
  if (mustHaveRole) {
    elems = [...document.querySelectorAll('div')].filter(
      (e) =>
        e.innerText.toLowerCase().startsWith('join') &&
        e.innerText.toLowerCase().includes('discord') &&
        e.innerText.toLowerCase().includes('have role')
    );
  } else {
    elems = [...document.querySelectorAll('div')].filter(
      (e) => e.innerText.toLowerCase().startsWith('join') && e.innerText.toLowerCase().includes('discord')
    );
  }
  console2.log('parseMustJoinLinks, elems:', elems);
  */

  const matches = [
    ...document.body.innerHTML.matchAll(/"invite_link":"(https:\/\/discord.gg\/[a-z0-9_-]+)"/gim),
    ...document.body.innerHTML.matchAll(/"invite_link":"(https:\/\/discord.com\/invite\/[a-z0-9_-]+)"/gim),
  ];
  console2.log('matches:', matches);

  return matches.map((x) => x[1]);
}

// MISC HELPERS

// WON WALLETS

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
  if (
    [...document.querySelectorAll('p')].filter((x) => x.innerText.includes('Please add mint wallet first'))
      ?.length
  ) {
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
  while (getRegisteringButtonSync()) {
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

// CUSTOM CONTENT ----------------------------------------------------------------------------------

function loadRafflePageWithCustomContent() {
  return false;
}

// RAFFLE GETTERS

function getSelectedWallet() {
  try {
    const elems = [...document.querySelectorAll('img')].filter((x) => x.src.includes('Ethereum-fill-brand'));
    if (!elems?.length) {
      return null;
    }
    const elem = elems[0].nextElementSibling;

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

function getTwitterUser() {
  try {
    const elems = [...document.querySelectorAll('div')].filter((x) => x.innerText === 'Twitter');
    if (!elems?.length) {
      return null;
    }
    return elems[0].nextElementSibling?.innerText.replace('@', '').trim();
  } catch (e) {
    console2.error('Failed getTwitterUser! Error:', e);
    return null;
  }
}

function getDiscordUser() {
  try {
    const elems = [...document.querySelectorAll('div')].filter((x) => x.innerText === 'Discord');
    if (!elems?.length) {
      return null;
    }
    return elems[0].nextElementSibling?.innerText.trim();
  } catch (e) {
    console2.error('Failed getDiscordUser! Error:', e);
    return null;
  }
}
