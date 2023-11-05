console.info('raffleResults.js begin', window?.location?.href);

import './raffleResults.scss';

import { getAccount as getAtlasAccount, getWins as getAtlasWins } from '../../js/atlasLib';
import {
  getAccount as getAlphabotAccount,
  getWinsByNewest as getAlphabotWinsByNewest,
} from '../../js/alphabotLib';
import { getAccount as getPremintAccount, getWins as getPremintWins } from '../../js/premintLib';

import { readWins, writeWins } from '../../js/cloudLib';

import {
  createStatusbarButtons,
  checkIfSubscriptionEnabled,
  STATUSBAR_DEFAULT_TEXT,
  toShortWallet,
  walletToAlias,
} from '../../js/premintHelperLib.js';

import {} from '../../js/alphabotLib.js';

import {
  createHashArgs,
  getStorageItems,
  setStorageData,
  createLogger,
  dynamicSortMultiple,
  noDuplicatesByKey,
  noDuplicates,
} from 'hx-lib';

import { getPermissions } from '../../js/permissions';

import { createStatusbar } from 'hx-statusbar';

const jht = require('json-html-table');

const debug = createLogger();

// DATA ------------------------------

const MAX_ALPHABOT_WINS = 30; // null; // 30; // null;
const MAX_ATLAS_WINS = null;
const MAX_PREMINT_WINS = 30; // 300; //  5; // 200;

const ALPHABOT_INTERVAL = 1500;
const ATLAS_INTERVAL = 1500;
const PREMINT_INTERVAL = 520;

let storage;
let pageState = {};

const DEFAULT_LOCALE = 'SV-se'; // undefined; // 'SV-se'; // string() | undefined
// const SORT_ORDER_LOCALE = 'sv-SE';

// STARTUP ------------------------------

runNow();

async function runNow() {
  runPage();
}

function initStorage() {
  storage.alphabot = storage.alphabot || {};
  storage.alphabot.myWins = storage.alphabot.myWins || [];
  storage.alphabot.cloudWins = storage.alphabot.cloudWins || [];
  storage.alphabot.wins = storage.alphabot.wins || [];

  storage.atlas = storage.atlas || {};
  storage.atlas.myWins = storage.atlas.myWins || [];
  storage.atlas.cloudWins = storage.atlas.cloudWins || [];
  storage.atlas.wins = storage.atlas.wins || [];

  storage.premint = storage.premint || {};
  storage.premint.myWins = storage.premint.myWins || [];
  storage.premint.myLost = storage.premint.myLost || [];
  storage.premint.cloudWins = storage.premint.cloudWins || [];
  storage.premint.wins = storage.premint.wins || [];

  storage.wins = storage.wins || [];
  storage.projectWins = storage.projectWins || [];
}

async function runPage() {
  debug.log('runPage');

  storage = await getStorageItems(['options', 'wins', 'alphabot', 'atlas', 'premint', 'projectWins']);
  debug.log('storage:', storage);

  if (!storage?.options) {
    return debug.log('Options missing, exit!');
  }

  initStorage();

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

  document.getElementById('hx-update').addEventListener('click', () => updateWins());
  document.getElementById('hx-reset').addEventListener('click', () => resetWins());

  if (pageState.hashArgs.has('action', 'update')) {
    return updateWins();
  }

  await showPage();
}

async function updateWins() {
  document.getElementById('main-table').innerHTML = 'Waiting for updated results...';

  const premint = await updatePremintWins();
  // showPage();
  //process.exit();
  const atlas = await updateAtlasWins();
  const alphabot = await updateAlphabotWins();

  const mergedWins = mergeAllWins({ atlas, alphabot, premint });
  debug.log('mergedWins:', mergedWins);
  storage.wins = mergedWins;
  await setStorageData(storage);

  showPage();
}

async function resetWins() {
  if (!window.confirm('Do you want to reset all results?')) {
    return debug.log('no');
  }

  storage.atlas = {};
  storage.alphabot = {};
  storage.premint = {};
  storage.wins = [];
  storage.projectWins = [];
  initStorage();

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

  showPage();
}

// MAIN ------------------------------

async function showPage(customWins = null, customHeader = '') {
  debug.log('showPage');

  document.getElementById('main-table').innerHTML = '';

  if (customWins) {
    appendWinsTable(createWinsTable(customWins, customHeader));
    appendWinsTable(createWinsTable(customWins, customHeader, true));
    return;
  }
  appendWinsTable(createWinsTable(storage.wins, 'All raffle providers'));
  appendWinsTable(createWinsTable(storage.alphabot?.wins, 'Alphabot raffles'));
  appendWinsTable(createWinsTable(storage.atlas?.wins, 'Atlas raffles'));
  appendWinsTable(createWinsTable(storage.premint?.wins, 'Premint raffles'));
  appendWinsTable(createWinsTable(storage.wins, 'All raffles, all columns', true));

  debug.log('Done showing results page!');
}

function appendWinsTable(table) {
  document.getElementById('main-table').appendChild(table);
}

function mergeAllWins({ atlas = null, alphabot = null, premint = null } = {}) {
  const r = [
    ...(atlas?.length ? atlas : []),
    ...(alphabot?.length ? alphabot : []),
    ...(premint?.length ? premint : []),
  ];
  return r;
}

// ALPHABOT ------------------------------

async function updateAlphabotWins() {
  debug.log('updateAlphabotWins');

  await reloadOptions(); // options may have changed, reload them!

  const account = await getAlphabotAccount();
  console.log('account', account);
  if (!account?.userId) {
    console.error('Failed getting alphabot account!', account);
    return [];
  }

  const lastPickedDate = storage.alphabot.myWins?.length
    ? Math.max(...storage.alphabot.myWins.map((x) => x.pickedDate))
    : null;
  const lastPickedDateStr = lastPickedDate ? new Date(lastPickedDate).toLocaleString() : 'null';
  console.log('lastPickedDate', lastPickedDate, lastPickedDateStr);

  const myWins = await getAlphabotWinsByNewest(account, {
    interval: ALPHABOT_INTERVAL,
    max: MAX_ALPHABOT_WINS,
    lastPickedDate,
  });
  console.log('myWins', myWins);

  if (storage.options.ALPHABOT_ENABLE_CLOUD && storage.options.CLOUD_MODE === 'save') {
    await writeWins(myWins, storage.options);
  }

  let cloudWins = [];
  if (storage.options.ALPHABOT_ENABLE_CLOUD && storage.options.CLOUD_MODE === 'load') {
    cloudWins = await readWins(0, storage.options).filter((x) => x.provider === 'alphabot');
    console.log('cloudWins', cloudWins);
    storage.alphabot.cloudWins = mergeWins(cloudWins, storage.alphabot.cloudWins);
  }

  storage.alphabot.myWins = mergeWins(myWins, storage.alphabot.myWins);
  storage.alphabot.wins = mergeWins([...myWins, ...cloudWins], storage.alphabot.wins);

  await setStorageData(storage);

  return storage.alphabot.wins;
}

// ATLAS ------------------------------

async function updateAtlasWins() {
  debug.log('updateAtlasWins');

  await reloadOptions(); // options may have changed, reload them!

  const account = await getAtlasAccount();
  console.log('account', account);
  if (!account?.userId) {
    console.error('Failed getting atlas account!', account);
    return [];
  }

  const myWins = await getAtlasWins(account, { interval: ATLAS_INTERVAL, max: MAX_ATLAS_WINS });
  console.log('myWins', myWins);

  if (storage.options.ATLAS_ENABLE_CLOUD && storage.options.CLOUD_MODE === 'save') {
    await writeWins(myWins, storage.options);
  }

  let cloudWins = [];
  if (storage.options.ATLAS_ENABLE_CLOUD && storage.options.CLOUD_MODE === 'load') {
    cloudWins = await readWins(0, storage.options).filter((x) => x.provider === 'atlas');
    console.log('cloudWins', cloudWins);
    storage.atlas.cloudWins = mergeWins(cloudWins, storage.atlas.cloudWins);
  }

  storage.atlas.myWins = mergeWins(myWins, storage.atlas.myWins);
  storage.atlas.wins = mergeWins([...myWins, ...cloudWins], storage.atlas.wins);

  await setStorageData(storage);

  return storage.atlas.wins;
}

// PREMINT ------------------------------

async function updatePremintWins() {
  debug.log('updatePremintWins');

  await reloadOptions(); // options may have changed, reload them!

  const account = await getPremintAccount();
  console.log('account', account);
  if (!account?.userId) {
    console.error('Failed getting premint account!', account);
    return [];
  }

  const skip = [...storage.premint.myWins.map((x) => x.id), ...storage.premint.myLost.map((id) => id)];
  const { wins, lost } = await getPremintWins(account, {
    interval: PREMINT_INTERVAL,
    max: MAX_PREMINT_WINS,
    skip,
  });
  const myWins = wins;
  const myLost = lost;
  console.log('myWins', myWins);
  console.log('myLost', myLost);

  if (storage.options.PREMINT_ENABLE_CLOUD && storage.options.CLOUD_MODE === 'save') {
    await writeWins(myWins, storage.options);
  }

  let cloudWins = [];
  if (storage.options.PREMINT_ENABLE_CLOUD && storage.options.CLOUD_MODE === 'load') {
    cloudWins = await readWins(0, storage.options).filter((x) => x.provider === 'premint');
    console.log('cloudWins', cloudWins);
    storage.premint.cloudWins = mergeWins(cloudWins, storage.premint.cloudWins);
  }

  storage.premint.myLost = noDuplicates(myLost, storage.premint.myLost);
  storage.premint.myWins = mergeWins(myWins, storage.premint.myWins);
  storage.premint.wins = mergeWins([...myWins, ...cloudWins], storage.premint.wins);

  await setStorageData(storage);

  return storage.premint.wins;
}

function mergeWins(arr1, arr2) {
  return noDuplicatesByKey([...arr1, ...arr2], 'id');
}

// HELPERS ------------------------------

const TIMESTAMP_BEFORE_ALL_RAFFLES = 1577836800000;

function toDateHTML(timestamp, defaultVal = '') {
  try {
    if (typeof timestamp !== 'number' || timestamp < TIMESTAMP_BEFORE_ALL_RAFFLES) {
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
        const trimmed = toShortWallet(x);
        const alias = walletToAlias(x, storage.options);
        const aliasText = alias ? ` (${alias})` : '';
        //debug.log('toWalletsHTML', x, trimmed, alias);
        return `<span title="${x.toLowerCase()}">${trimmed}${aliasText}</span>`;
      })
      .join('<br>');
  } catch (e) {
    console.error(e);
    return defaultVal;
  }
}

function createWinsTable(wins, header = '', allColumns = false) {
  console.log('createWinsTable wins', header, wins);

  const sortedWins = [...(wins?.length ? wins : [])].sort(dynamicSortMultiple('-hxSortKey'));
  console.log('sortedWins', sortedWins);

  const data = allColumns
    ? sortedWins
    : sortedWins.map((x) => {
        return {
          Name: x.name,
          Provider: x.provider,
          SortKey: toDateHTML(x.hxSortKey, x.hxSortKey),
          MintDate: toDateHTML(x.mintDate),
          EndDate: toDateHTML(x.endDate),
          Twitter: x.twitterHandleGuess,
          Chain: x.blockchain,
          W: x.winnerCount,
          E: x.entryCount,
          Wallets: toWalletsHTML(x.wallets),
          UserName: x.userName,
          UserId: x.userId,
          Team: x.teamName,
        };
      });

  const keys = data?.length ? Object.keys(data[0]) : [];
  const div = document.createElement('div');
  div.innerHTML =
    (header ? `<h3>${header} (${data.length})</h3>` : '') + (data.length ? jht(data, keys) : 'No results');
  return div;
}

// UPDATE FUNCS -----------------------------------------------------

// WINS FUNCS -----------------------------------------------------

// MISC HELPERS -----------------------------------------------------

async function reloadOptions() {
  const { options } = await getStorageItems(['options']);
  storage.options = options;
}
