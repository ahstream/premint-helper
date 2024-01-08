console.info('atlasPage.js begin', window?.location?.href);

import '../styles/atlasPage.css';

import global from './global.js';
console.log('global:', global);

import {
  // OTHER API
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
  hasErrors,
} from './atlasLib.js';

import {
  JOIN_BUTTON_TEXT,
  JOIN_BUTTON_IN_PROGRESS_TEXT,
  JOIN_BUTTON_TITLE,
  clickElement,
  hasRaffleCaptcha,
} from './premintHelperLib';

import { initRafflePage } from './rafflePage';

import { createObserver as createRaffleObserver, getPreviousWalletsWon } from './observerGeneric';
import { createObserver as createTwitterObserver } from './twitterObserver.js';

import { sleep, myConsole } from 'hx-lib';

const console2 = myConsole(global.LOGLEVEL);

// DATA ----------------------------------------------------------------------------

let storage = {};

const config = {
  // COMMON API
  name: 'ATLAS',
  storageKeys: ['runtime', 'options'],
  enableForceRegister: true,
  visitTwitterTasks: false,

  // STATIC (SAME CONTENT FOR ALL PROVIDERS) COMMON API
  createObserver: async (config) => createRaffleObserver(config),
  createObserver2: async (config) => createTwitterObserver(config),
  setStorage: (newStorage) => (storage = newStorage),
  getRaffleTwitterHandle,
  getPreviousWalletsWon,

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
  hasErrors,
  isAllRegBtnsEnabled,
  JOIN_BUTTON_TEXT,
  JOIN_BUTTON_TITLE,
  JOIN_BUTTON_IN_PROGRESS_TEXT,

  // SEMI CUSTOM API
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

  // PROVIDER SPECIFIC API
  SLEEP_BEFORE_NEXT_FORCE_REGISTER: 10000, // luckygo, superful
  readyToRegister, // atlas
  skipReqsIfReady, // atlas
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
  btn.className =
    'ph-button flex justify-center items-center gap-2 py-2 px-4 bg-primary-500 rounded-lg text-white w-full transition hover:cursor-pointer';
  btn.addEventListener('click', clickHandler);

  const container = getEntryContainer();
  console2.log('container', container);
  container.after(btn);
}

function addPreviouslyWonWallets(options, pageState) {
  const twitterHandle = getRaffleTwitterHandle(options);
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
}

async function handleSimpleErrors(exitFn) {
  const errors = getErrors();
  if (errors?.length) {
    await sleep(1000);
    console2.log('Has errors:', errors);
    if (hasRaffleCaptcha(config.name)) {
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
  const regBtn = getRegisterButtonSync(context.options);
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

// SEMI CUSTOM API

function readyToRegister() {
  return isAllTasksCompleted();
}

function skipReqsIfReady() {
  return storage.options.ATLAS_SKIP_REQS_IF_READY && isAllTasksCompleted();
}

// REGISTER

// REGISTER BTN FUNCS ----------------------------------------------

function getEntryContainer() {
  return (
    [...document.querySelectorAll('div.pb-2')].filter((x) =>
      x.innerText.startsWith('Entry Requirements')
    )[0] || null
  );
}

// RAFFLE STATE CHECKERS -------------------------------------------------------------------

// HELPERS

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
