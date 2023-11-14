console.info('luckyPage.js begin', window?.location?.href);

import '../styles/luckyPage.css';

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
  createLogger,
  //setStorageData,
  noDuplicates,
  //addToDate,
  //normalizePendingLink,
  millisecondsAhead,
  extractTwitterHandle,
  getTextEquals,
} from 'hx-lib';

import { createObserver as createRaffleObserver, getPreviousWalletsWon } from './observerGeneric';

const debug = createLogger();

// DATA ----------------------------------------------------------------------------

let storage = null;

const config = {
  name: 'LUCKY',
  enableForceRegister: true,
  storageKeys: ['runtime', 'options'],
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

async function createObserver() {
  return await createRaffleObserver();
}

// WAIT FOR LOADED ----------------------------------------------

async function waitForRafflePageLoaded() {
  debug.log('waitForRafflePageLoaded');

  const stopTime = millisecondsAhead(storage.options.LUCKY_WAIT_FOR_RAFFLE_PAGE_LOADED);
  while (Date.now() <= stopTime) {
    if (hasRegistered()) {
      return true;
    }
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
  const regBtn = getRegisterButtonSync(true);
  debug.log('forceRegister; regBtn:', regBtn);

  if (!regBtn) {
    debug.log('!regBtn');
    return null;
  }

  const errors = getErrors();
  debug.log('errors:', errors);
  if (errors.discord) {
    debug.log('Do not force register when discord errors!');
    return null;
  }

  if (hasDoingItTooOften()) {
    debug.log('hasDoingItTooOften');
    return null;
  }

  if (!isAllRegBtnsEnabled()) {
    debug.log('!isAllRegBtnsEnabled');
    return null;
  }

  clickElement(regBtn);
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
  console.log('matches', matches, matchesArr);

  const r = (matchesArr.length === 3) & (matchesArr[1] === matchesArr[2]);
  console.log('r', r);

  return r;
}
*/

// REGISTER BTN FUNCS ----------------------------------------------

async function getRegisterButton(maxWait = 1000, interval = 10) {
  console.log('getRegisterButton');
  return await waitForTextEquals(storage.options.LUCKY_REG_BTN_SEL, 'div', maxWait, interval);
}

function getRegisterButtonSync() {
  return [...document.querySelectorAll('div')].filter(
    (x) => x.innerText === storage.options.LUCKY_REG_BTN_SEL
  )[0];
}

function getRegisteringButtonSync() {
  return [...document.querySelectorAll('div')].filter((x) => x.innerText === 'Registering')[0];
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
  debug.log('regBtnContainer', regBtnContainer);
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
  return false; //  !!document.querySelector('div.text-white.bg-red-500');
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
  console.log('getTwitterLinks, elems', elems);
  if (!elems.length) {
    return [];
  }
  const allLinks = [];
  for (let elem of elems) {
    console.log('elem', elem);
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

  console.log('getTwitterLinks', allLinks);

  return noDuplicates(allLinks);
}

function parseMustJoinLinks(mustHaveRole = false) {
  console.log('parseMustJoinLinks:', mustHaveRole);
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
  console.log('parseMustJoinLinks, elems:', elems);
  */

  const matches = [
    ...document.body.innerHTML.matchAll(/"invite_link":"(https:\/\/discord.gg\/[a-z0-9_-]+)"/gim),
    ...document.body.innerHTML.matchAll(/"invite_link":"(https:\/\/discord.com\/invite\/[a-z0-9_-]+)"/gim),
  ];
  console.log('matches:', matches);

  return matches.map((x) => x[1]);
}

// MISC HELPERS

// WON WALLETS

function addPreviouslyWonWallets(pageState) {
  const twitterHandle = getRaffleTwitterHandle();
  if (!twitterHandle) {
    return;
  }
  debug.log('twitterHandle', twitterHandle);

  const section = pageState.observer.createPreviousWonSection(twitterHandle, true, pageState.permissions);
  if (!section) {
    return;
  }
  debug.log('section', section);
  document.body.appendChild(section);

  /*
  const tasksElem = getElementByText('Tasks', 'h5', { contains: true });
  if (!tasksElem) {
    console.error('Missing Tasks elem!');
    return;
  }
  debug.log('tasksElem', tasksElem);
  tasksElem.after(section);
  */
}

function getWonWalletsByAllAccounts() {
  return getPreviousWalletsWon(getRaffleTwitterHandle());
}

// ERROR HANDLING

function getErrors() {
  /*
  const elems = [...document.querySelectorAll('.alert-danger')];
  if (elems?.length) {
    return ['unspecifiedRaffleError'];
  }
  */
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
  console.log('Wait for regbtn not registering');
  while (getRegisteringButtonSync()) {
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
    console.error(e);
    return null;
  }
}

function getWonWalletsByThisAccount() {
  return [];
}

function getRaffleTwitterHandle() {
  const mustFollowLinks = parseMustFollowLinks();
  console.log('mustFollowLinks', mustFollowLinks);
  if (!mustFollowLinks?.length) {
    return null;
  }
  const twitterHandle = extractTwitterHandle(mustFollowLinks[0]);
  if (!twitterHandle) {
    return null;
  }
  debug.log('twitterHandle', twitterHandle);

  return twitterHandle;
}

function getTwitterUser() {
  try {
    const elems = [...document.querySelectorAll('div')].filter((x) => x.innerText === 'Twitter');
    if (!elems?.length) {
      return null;
    }
    return elems[0].nextElementSibling?.innerText.replace('@', '').trim();
  } catch (e) {
    console.error('Failed getTwitterUser! Error:', e);
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
    console.error('Failed getDiscordUser! Error:', e);
    return null;
  }
}
