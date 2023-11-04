console.info('raffleResults.js begin', window?.location?.href);

import './raffleResults.scss';

import { getWins as getAtlasWins } from '../../js/atlasLib';

import {
  createStatusbarButtons,
  checkIfSubscriptionEnabled,
  STATUSBAR_DEFAULT_TEXT,
} from '../../js/premintHelperLib.js';

import {} from '../../js/alphabotLib.js';

import { createHashArgs, getStorageItems, setStorageData, createLogger } from 'hx-lib';

import { getPermissions } from '../../js/permissions';

import { createStatusbar } from 'hx-statusbar';

const jht = require('json-html-table');

const debug = createLogger();

// DATA ----------------------------------------------------------------------------

let storage;
let pageState = {};

const DEBUG_MODE = false;

const DEFAULT_LOCALE = 'SV-se'; // undefined; // 'SV-se'; // string() | undefined
const SORT_ORDER_LOCALE = 'sv-SE';

// STARTUP ----------------------------------------------------------------------------

runNow();

async function runNow() {
  runPage();
}

async function runPage() {
  debug.log('runPage');

  storage = await getStorageItems(['options', 'alphabot', 'atlas', 'premint', 'projectWins']);
  debug.log('storage:', storage);

  if (!storage?.options) {
    return debug.log('Options missing, exit!');
  }

  storage.alphabot = storage.alphabot || {};
  storage.atlas = storage.atlas || {};
  storage.premint = storage.premint || {};
  storage.projectWins = storage.projectWins || [];

  debug.log('storage after checks:', storage);

  const hashArgs = createHashArgs(window.location.hash);

  pageState = {
    hashArgs,
    statusbar: createStatusbar(STATUSBAR_DEFAULT_TEXT),
    permissions: await getPermissions(),
  };
  debug.log('pageState', pageState);

  pageState.statusbar.buttons(
    createStatusbarButtons({
      options: true,
      results: 'disabled',
      reveal: 'disabled',
      followers: 'disabled',
    })
  );

  checkIfSubscriptionEnabled(pageState.permissions, false, pageState.statusbar.warn);

  document.getElementById('hx-update-atlas').addEventListener('click', () => updateAtlas({ cloud: true }));
  document.getElementById('hx-reset-atlas').addEventListener('click', () => resetAtlas());

  if (pageState.hashArgs.has('action', 'update-atlas')) {
    return updateAtlas({ cloud: true });
  }

  await showAtlas();
}

// ATLAS FUNCS ---------------------------------------------------

async function updateAtlas({ cloud = false } = {}) {
  debug.log('updateAtlas; cloud:', cloud);

  await reloadOptions(); // options may have changed, reload them!

  const wins = await getAtlasWins();
  console.log('wins', wins);
  storage.atlas.wins = wins;

  showAtlas();
}

async function resetAtlas() {
  if (!window.confirm('Do you want to reset Atlas results?')) {
    return debug.log('no');
  }

  storage.atlas = {};

  /*
  removeStorageItem('alphabotSiteRaffles');
  removeStorageItem('alphabotLastAccount');
  removeStorageItem('alphabotLastAccountName');
  removeStorageItem('alphabotLastFetchedEndDate');
  removeStorageItem('alphabotLastSiteUpdate');
  removeStorageItem('alphabotLastCloudUpdate');
  removeStorageItem('alphabotCloudAccounts');
  removeStorageItem('alphabotCloudRaffles');
  */

  await setStorageData(storage);
  debug.log('storage', storage);

  //resetStatus();
  //resetPage();
  // updateStatus('Atlas raffle results reset');

  showAtlas();
}

async function showAtlas() {
  debug.log('showAtlas:');

  const wins = storage.atlas.wins || [];
  console.log('wins', wins);

  document.body.appendChild(createWinnersTable(winners));

  const keys = Object.keys(winners[0]);
  const div = document.createElement('div');
  div.innerHTML = jht(winners, keys);
  document.body.appendChild(div);

  const keys2 = [
    'hxSortKey',
    'name',
    'endDate',
    'twitterHandleGuess',
    'wallets',
    'teamName',
    'blockchain',
    'winnerCount',
    'entryCount',
  ];
  const div2 = document.createElement('div');
  div2.innerHTML = jht(winners, keys2);
  document.body.appendChild(div2);
}

function toDateHTML(timestamp, defaultVal = '') {
  try {
    if (typeof timestamp !== 'number') {
      return defaultVal;
    }
    return new Date(timestamp).toLocaleDateString(DEFAULT_LOCALE || null);
  } catch (e) {
    console.error(e);
    return defaultVal;
  }
}

function toWalletsHTML(wallets, defaultVal = '') {
  try {
    if (!wallets?.length) {
      return defaultVal;
    }
    return wallets
      .map((x) => {
        const alias = walletToAlias(x, storage.options);
        const aliasText = alias ? ` (${alias})` : '';
        return `<span title="${x}">${trimMintAddress(x)}${aliasText}</span>`;
      })
      .join('<br>');
  } catch (e) {
    console.error(e);
    return defaultVal;
  }
}

function createWinnersTable(winners) {
  console.log('winners', winners);

  const sortedWinners = [...winners].sort(dynamicSortMultiple('-hxSortKey'));
  console.log('sortedWinners', sortedWinners);

  const data = sortedWinners.map((x) => {
    return {
      Name: x.name,
      MintDate: toDateHTML(x.mintDate),
      EndDate: toDateHTML(x.endDate),
      Twitter: x.twitterHandleGuess,
      Chain: x.blockchain,
      W: x.winnerCount,
      E: x.entryCount,
      Wallets: toWalletsHTML(x.wallets),
      Team: x.teamName,
    };
  });

  const keys = Object.keys(data[0]);
  const div = document.createElement('div');
  div.innerHTML = jht(data, keys);
  return div;
}

// UPDATE FUNCS -----------------------------------------------------

// WINNERS FUNCS -----------------------------------------------------

// MISC HELPERS -----------------------------------------------------

async function reloadOptions() {
  const { options } = await getStorageItems(['options']);
  storage.options = options;
}
