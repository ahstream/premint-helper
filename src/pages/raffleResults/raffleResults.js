console.info('raffleResults.js begin', window?.location?.href);

import './raffleResults.scss';

import { getAccount as getAtlasAccount, getWins as getAtlasWins } from '../../js/atlasLib';
import {
  getAccount as getAlphabotAccount,
  getWinsByNewest as getAlphabotWinsByNewest,
  getWinsByMinting as getAlphabotWinsByMinting,
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
let pageState = {
  shownProvider: 'all',
};

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
    ...pageState,
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

  document.getElementById('show-all').addEventListener('click', () => showProviderClickHandler('all'));
  document
    .getElementById('show-alphabot')
    .addEventListener('click', () => showProviderClickHandler('alphabot'));
  document
    .getElementById('show-premint')
    .addEventListener('click', () => showProviderClickHandler('premint'));
  document.getElementById('show-atlas').addEventListener('click', () => showProviderClickHandler('atlas'));
  document.getElementById('show-debug').addEventListener('click', () => showProviderClickHandler('debug'));

  if (pageState.hashArgs.has('action', 'update')) {
    return updateWins();
  }

  await showPage();
}

async function updateWins() {
  updateMainStatus('Updating results');

  document.getElementById('main-table').innerHTML = 'Waiting for results...';

  const checkTime = Date.now();
  const premint = await updatePremintWins(checkTime);
  const atlas = await updateAtlasWins(checkTime);
  const alphabot = await updateAlphabotWins(checkTime);

  const mergedWins = mergeAllWins({ atlas, alphabot, premint });
  debug.log('mergedWins:', mergedWins);
  storage.wins = mergedWins;
  storage.winsLastUpdateTime = checkTime;
  await setStorageData(storage);

  updateMainStatus('Raffle results updated!');

  showPage();
}

async function resetWins() {
  if (!window.confirm('Do you want to reset all raffle results?')) {
    return debug.log('no');
  }

  storage.atlas = {};
  storage.alphabot = {};
  storage.premint = {};
  storage.wins = [];
  // storage.projectWins = [];
  storage.winsLastUpdateTime = null;
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
  appendWinsTable(createWinsTable(storage.wins, 'All raffle providers', 'all'));
  appendWinsTable(createWinsTable(storage.alphabot?.wins, 'Alphabot raffles', 'alphabot'));
  appendWinsTable(createWinsTable(storage.atlas?.wins, 'Atlas raffles', 'atlas'));
  appendWinsTable(createWinsTable(storage.premint?.wins, 'Premint raffles', 'premint'));
  appendWinsTable(createWinsTable(storage.wins, 'All raffles, all columns', 'debug', true));

  debug.log('Done showing results page!');
}

function appendWinsTable(table) {
  document.getElementById('main-table').appendChild(table);
  updateShownProvider();
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

async function updateAlphabotWins(checkTime) {
  debug.log('updateAlphabotWins', checkTime);

  await reloadOptions(); // options may have changed, reload them!

  updateMainStatus('Get Alphabot account info');
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

  const myWinsByNewest = await getAlphabotWinsByNewest(account, {
    interval: ALPHABOT_INTERVAL,
    max: MAX_ALPHABOT_WINS,
    lastPickedDate,
    statusFn: updateMainStatus,
  });
  console.log('myWinsByNewest', myWinsByNewest);

  updateMainStatus('Get updated mint dates from Alphabot');
  const myWinsByMinting = await getAlphabotWinsByMinting(account, {
    interval: ALPHABOT_INTERVAL,
    max: MAX_ALPHABOT_WINS,
  });
  console.log('myWinsByMinting', myWinsByMinting);

  const myWins = mergeWins(myWinsByMinting, myWinsByNewest);

  if (storage.options.ALPHABOT_ENABLE_CLOUD && storage.options.CLOUD_MODE === 'save') {
    await writeWins(myWins, storage.options);
  }

  let cloudWins = [];
  if (storage.options.ALPHABOT_ENABLE_CLOUD && storage.options.CLOUD_MODE === 'load') {
    cloudWins = await readWins(0, storage.options).filter((x) => x.provider === 'alphabot');
    console.log('cloudWins', cloudWins);
    storage.alphabot.cloudWins = mergeWins(cloudWins, storage.alphabot.cloudWins, checkTime);
  }

  storage.alphabot.myWins = mergeWins(myWins, storage.alphabot.myWins, checkTime);
  storage.alphabot.wins = mergeWins([...myWins, ...cloudWins], storage.alphabot.wins, checkTime);

  await setStorageData(storage);

  return storage.alphabot.wins;
}

// ATLAS ------------------------------

async function updateAtlasWins(checkTime) {
  debug.log('updateAtlasWins', checkTime);

  await reloadOptions(); // options may have changed, reload them!

  updateMainStatus('Get Atlas account info');
  const account = await getAtlasAccount();
  console.log('account', account);
  if (!account?.userId) {
    console.error('Failed getting atlas account!', account);
    return [];
  }

  const myWins = await getAtlasWins(account, {
    interval: ATLAS_INTERVAL,
    max: MAX_ATLAS_WINS,
    statusFn: updateMainStatus,
  });
  console.log('myWins', myWins);

  if (storage.options.ATLAS_ENABLE_CLOUD && storage.options.CLOUD_MODE === 'save') {
    await writeWins(myWins, storage.options);
  }

  let cloudWins = [];
  if (storage.options.ATLAS_ENABLE_CLOUD && storage.options.CLOUD_MODE === 'load') {
    cloudWins = await readWins(0, storage.options).filter((x) => x.provider === 'atlas');
    console.log('cloudWins', cloudWins);
    storage.atlas.cloudWins = mergeWins(cloudWins, storage.atlas.cloudWins, checkTime);
  }

  storage.atlas.myWins = mergeWins(myWins, storage.atlas.myWins, checkTime);
  storage.atlas.wins = mergeWins([...myWins, ...cloudWins], storage.atlas.wins, checkTime);

  await setStorageData(storage);

  return storage.atlas.wins;
}

// PREMINT ------------------------------

async function updatePremintWins(checkTime) {
  debug.log('updatePremintWins', checkTime);

  await reloadOptions(); // options may have changed, reload them!

  updateMainStatus('Get Premint account info');
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
    statusFn: updateMainStatus,
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
    storage.premint.cloudWins = mergeWins(cloudWins, storage.premint.cloudWins, checkTime);
  }

  storage.premint.myLost = noDuplicates(myLost, storage.premint.myLost);
  storage.premint.myWins = mergeWins(myWins, storage.premint.myWins, checkTime);
  storage.premint.wins = mergeWins([...myWins, ...cloudWins], storage.premint.wins, checkTime);

  await setStorageData(storage);

  return storage.premint.wins;
}

function mergeWins(newWins, oldWins, checkTime = null) {
  if (checkTime) {
    newWins.forEach((win) => {
      const oldWin = oldWins.find((x) => x.id === win.id);
      if (!oldWin) {
        win.hxCreated = checkTime;
        win.hxUpdated = checkTime;
      } else if (isWinModified(win, oldWin)) {
        win.hxUpdated = checkTime;
      }
    });
  }
  return noDuplicatesByKey([...newWins, ...oldWins], 'id');
}

function isWinModified(newWin, oldWin) {
  return newWin.hxSortKey && newWin.hxSortKey !== oldWin.hxSortKey;
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

function createWinsTable(wins, header, id, allColumns = false) {
  console.log('createWinsTable wins', header, wins);

  const sortedWins = [...(wins?.length ? wins : [])].sort(dynamicSortMultiple('-hxSortKey'));
  console.log('sortedWins', sortedWins);

  const lastUpdate = storage.winsLastUpdateTime;

  const data = allColumns
    ? sortedWins
    : sortedWins.map((x) => {
        return {
          Name: x.name,
          Provider: x.provider,
          IsNew: x.hxCreated && lastUpdate && x.hxCreated >= lastUpdate,
          IsUpdated: x.hxUpdated && lastUpdate && x.hxUpdated >= lastUpdate,
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
  div.id = id;
  div.className = 'provider-wins';
  div.innerHTML =
    (header ? `<h3>${header} (${data.length})</h3>` : '') + (data.length ? jht(data, keys) : 'No results');
  return div;
}

function showProviderClickHandler(id) {
  pageState.shownProvider = id;
  updateShownProvider();
}

function updateShownProvider() {
  const update = (id) => {
    const elem = document.getElementById(id);
    console.log('id, elem', id, elem, pageState);
    if (elem && pageState.shownProvider === id) {
      elem.classList.toggle('show', true);
    } else if (elem) {
      elem.classList.toggle('show', false);
    }
  };
  update('all');
  update('alphabot');
  update('premint');
  update('atlas');
  update('debug');
}

// UPDATE FUNCS -----------------------------------------------------

// WINS FUNCS -----------------------------------------------------

// MISC HELPERS -----------------------------------------------------

async function reloadOptions() {
  const { options } = await getStorageItems(['options']);
  storage.options = options;
}

// STATUS FUNCS -----------------------------------------------------

function updateMainStatus(text) {
  const elem = document.getElementById('hx-status-main');
  if (elem) {
    elem.innerText = text;
  }
}

/*
function resetSubStatus() {
  document.getElementById('hx-status').replaceChildren();
}

function updateSubStatus(html, reuseLast = false) {
  const elem = document.getElementById('hx-status');
  if (!elem) {
    console.error('Missing status element in HTML!');
    return false;
  }
  let item;
  let isReused = false;
  if (reuseLast) {
    const items = Array.from(elem.getElementsByTagName('LI'));
    if (items.length) {
      item = items[items.length - 1];
      isReused = true;
    }
  }
  if (isReused) {
    item.innerHTML = html;
  } else {
    item = document.createElement('LI');
    item.innerHTML = html;
    elem.appendChild(item);
  }
}
*/
