console.info('raffleResults.js begin', window?.location?.href);

import './raffleResults.scss';

import { getAccount as getAtlasAccount, getWins as getAtlasWins } from '../../js/atlasLib';

import { getAccount as getLuckygoAccount, getWins as getLuckygoWins } from '../../js/luckygoLib.js';

import {
  getAccount as getAlphabotAccount,
  getWinsByNewest as getAlphabotWinsByNewest,
  getWinsByMinting as getAlphabotWinsByMinting,
} from '../../js/alphabotLib';

import { getAccount as getPremintAccount, getWins as getPremintWins } from '../../js/premintLib';

import { readWins, writeWins, countWins, readProjectWins, writeProjectWins } from '../../js/cloudLib';

// import { waitForUser } from '../../js/twitterLib';

import {
  createStatusbarButtons,
  checkIfSubscriptionEnabled,
  STATUSBAR_DEFAULT_TEXT,
  toShortWallet,
  walletToAlias,
  sortWallets,
  trimWallet,
  accountToAlias,
  reloadOptions,
  getMyTabIdFromExtension,
  normalizeTwitterHandle,
  lookupTwitterFollowersClickEventHandler,
} from '../../js/premintHelperLib.js';

import { trimPrice, trimText, trimTextNum } from '../../js/raffleResultsLib.js';

import {
  ONE_DAY,
  sleep,
  createHashArgs,
  getStorageItems,
  setStorageData,
  dynamicSortMultiple,
  noDuplicatesByKey,
  noDuplicates,
  isToday,
  addClassName,
  addTarget,
  textAsClass,
  makeTwitterURL,
  timestampToLocaleString,
  timestampToLocaleDateString,
  timestampToLocaleTimeString,
  extractDiscordHandle,
  millisecondsAhead,
  pluralize,
  daysBetween,
  hoursBetween,
  minutesBetween,
  secondsBetween,
  // kFormatter,
  addPendingRequest,
  myConsole,
} from 'hx-lib';

import { getPermissions } from '../../js/permissions';

import { createStatusbar } from 'hx-statusbar';

// import { createObserver } from '../../js/observerGeneric';

import { createObserver as createTwitterObserver } from '../../js/twitterObserver.js';

const jht = require('json-html-table');

const console2 = myConsole();

// DATA ------------------------------

const ALPHABOT_INTERVAL = 1500;
const ATLAS_INTERVAL = 1500;
const PREMINT_INTERVAL = 520;
const LUCKYGO_INTERVAL = 1500;

const SHORTENED_TEXT_SUFFIX = '...';

const MAX_LEN_RAFFLE_NAME = 32;
const MAX_LEN_TWITTER_HANDLE = 24;
const MAX_LEN_DISCORD_HANDLE = 15;
const MAX_LEN_TEAM_NAME = 24;

let storage;
let pageState = {
  shownProvider: 'all-providers',
};

const statusLogger = { main: updateMainStatus, sub: updateSubStatus };

const DEFAULT_LOCALE = 'SV-se'; // undefined; // 'SV-se'; // string() | undefined
const SORT_ORDER_LOCALE = 'sv-SE';

// STARTUP ------------------------------

runNow();

async function runNow() {
  runPage();
}

function initStorage() {
  storage.results = storage.results || {};

  storage.alphabot = storage.alphabot || {};
  storage.alphabot.myWins = storage.alphabot.myWins || [];
  storage.alphabot.cloudWins = storage.alphabot.cloudWins || [];
  storage.alphabot.wins = storage.alphabot.wins || [];

  storage.premint = storage.premint || {};
  storage.premint.myWins = storage.premint.myWins || [];
  storage.premint.myLost = storage.premint.myLost || [];
  storage.premint.cloudWins = storage.premint.cloudWins || [];
  storage.premint.wins = storage.premint.wins || [];

  storage.atlas = storage.atlas || {};
  storage.atlas.myWins = storage.atlas.myWins || [];
  storage.atlas.cloudWins = storage.atlas.cloudWins || [];
  storage.atlas.wins = storage.atlas.wins || [];

  storage.luckygo = storage.luckygo || {};
  storage.luckygo.myWins = storage.luckygo.myWins || [];
  storage.luckygo.cloudWins = storage.luckygo.cloudWins || [];
  storage.luckygo.wins = storage.luckygo.wins || [];

  storage.wins = storage.wins || [];
  storage.allProjectWins = storage.allProjectWins || [];
}

async function runPage() {
  console2.log('runPage');

  storage = await getStorageItems([
    'options',
    'wins',
    'allProjectWins',
    'results',
    'alphabot',
    'premint',
    'atlas',
    'luckygo',
  ]);
  console2.log('storage:', storage);

  if (!storage?.options) {
    return console2.log('Options missing, exit!');
  }

  initStorage();

  console2.log('storage after checks:', storage);

  const hashArgs = createHashArgs(window.location.hash);
  const permissions = await getPermissions();
  pageState = {
    ...pageState,
    hashArgs,
    statusbar: createStatusbar(STATUSBAR_DEFAULT_TEXT),
    permissions,
    observer: await createTwitterObserver({ permissions }),
  };

  console2.info('PageState:', pageState);

  pageState.statusbar.buttons(
    createStatusbarButtons({
      options: true,
      results: 'disabled',
      reveal: 'disabled',
      followers: lookupTwitterFollowersClickEventHandler,
    })
  );

  checkIfSubscriptionEnabled(pageState.permissions, false, pageState.statusbar.warn);

  document.getElementById('hx-update').addEventListener('click', () => updateWins());
  document.getElementById('hx-reset').addEventListener('click', () => resetWins());

  document
    .getElementById('show-all-providers')
    .addEventListener('click', () => showProviderClickHandler('all-providers'));
  document
    .getElementById('show-alphabot')
    .addEventListener('click', () => showProviderClickHandler('alphabot'));
  document
    .getElementById('show-premint')
    .addEventListener('click', () => showProviderClickHandler('premint'));
  document.getElementById('show-atlas').addEventListener('click', () => showProviderClickHandler('atlas'));
  document
    .getElementById('show-luckygo')
    .addEventListener('click', () => showProviderClickHandler('luckygo'));
  document.getElementById('show-hidden').addEventListener('click', showCheckboxedClickHandler);
  document.getElementById('show-extended').addEventListener('click', showCheckboxedClickHandler);

  if (pageState.hashArgs.has('action', 'update')) {
    return updateWins();
  }

  if (pageState.hashArgs.has('action', 'updateProjectWins')) {
    return updateProjectWins();
  }

  showPage();
}

async function updateWins() {
  updateMainStatus('Updating results');
  resetSubStatus();

  document.getElementById('main-table').innerHTML = '';

  const checkTime = Date.now();

  let cloudWins = [];

  if (storage.options.CLOUD_MODE === 'load') {
    const fromTimestamp = (storage.results.lastCloudTimestamp || -1) + 1;
    console2.log('storage.results.lastCloudTimestamp', storage.results.lastCloudTimestamp);
    console2.log('fromTimestamp', fromTimestamp);
    cloudWins = await readWins(fromTimestamp, storage.options);
    console2.log('cloudWins', cloudWins);
    if (cloudWins.error) {
      statusLogger.sub('Failed getting results from Cloud! Error:' + cloudWins.msg);
    } else {
      statusLogger.sub(`Fetched ${cloudWins.length} new or updated winners from Cloud`);
      storage.results.lastCloudTimestamp = checkTime;
      console2.log('storage.results.lastCloudTimestamp', storage.results.lastCloudTimestamp);
      const lastCloudTimestamp = cloudWins?.length ? Math.max(...cloudWins.map((x) => x.hxCloudUpdated)) : 0;
      console2.log('lastCloudTimestamp', lastCloudTimestamp);

      if (lastCloudTimestamp > 0) {
        storage.results.lastCloudTimestamp = lastCloudTimestamp;
      }

      storage.results.lastCloudUpdate = checkTime;
      storage.results.lastProviderUpdate = checkTime;
    }
  }

  const alphabot = await updateAlphabotWins(checkTime, cloudWins);
  const premint = await updatePremintWins(checkTime, cloudWins);
  const atlas = await updateAtlasWins(checkTime, cloudWins);
  const luckygo = await updateLuckygoWins(checkTime, cloudWins);

  const mergedWins = mergeAllWins({ atlas, alphabot, premint, lucky: luckygo });
  storage.wins = mergedWins;
  console2.log('mergedWins:', mergedWins);

  storage.results.lastProviderUpdate = checkTime;
  storage.results.lastWinsUpdate = checkTime;

  const prevProjectWins = storage.allProjectWins;
  const packedWins = packWins(storage.wins, true);
  const newProjectWins = createProjectWins(packedWins.filter((x) => !!x.twitterHandle));
  storage.allProjectWins = newProjectWins;
  console2.info('storage.allProjectWins', storage.allProjectWins);

  const hasChanged = hasProjectWinsChanged(prevProjectWins, newProjectWins);
  console2.info('Is new won wallets found:', hasChanged);

  if (hasChanged && storage.options.ALPHABOT_ENABLE_CLOUD && storage.options.CLOUD_MODE === 'load') {
    const writeResult = await writeProjectWins(storage.allProjectWins, storage.options);
    if (writeResult.error) {
      statusLogger.sub(`Failed uploading won wallets to Cloud. Network problems?`);
    } else {
      storage.results.lastCloudUploadProjectWins = Date.now();
      statusLogger.sub(`Uploaded ${countProjectWinsWallets()} won wallets to Cloud`);
    }
  }

  await setStorageData(storage);

  updateMainStatus('Raffle results updated!');

  showPage();

  if (storage.options.CLOUD_MODE === 'load' && storage.options.RESULTS_NOTIFICATION_1_URL) {
    window.open(storage.options.RESULTS_NOTIFICATION_1_URL, '_blank');
  }
}

async function updateProjectWins() {
  updateMainStatus('Getting wallets won from Cloud...');
  resetSubStatus();

  document.getElementById('main-table').innerHTML = '';

  if (storage.options.CLOUD_MODE === 'load') {
    statusLogger.sub(
      `Won wallets is only fetched from Cloud when saving own results to Cloud (this account is reading results from Cloud)`
    );
    return;
  }

  if (storage.options.CLOUD_MODE === 'save') {
    const readResult = await readProjectWins(storage.options);
    if (readResult.error) {
      statusLogger.sub(`Failed getting won wallets from Cloud. Network problems?`);
    } else {
      storage.allProjectWins = readResult;
      statusLogger.sub(`Fetched ${countProjectWinsWallets()} won wallets from Cloud`);
      console2.info('storage.allProjectWins', storage.allProjectWins);
    }

    await setStorageData(storage);

    updateMainStatus('Done getting wallets won from Cloud!');

    document.body.classList.toggle('success', true);
    /*
    if (
      storage.options.RESULTS_ENABLE_READ_PROJECT_WINS_NOTIFICATION &&
      storage.options.RESULTS_NOTIFICATION_2_URL
    ) {
      window.open(storage.options.RESULTS_NOTIFICATION_2_URL, '_blank');
    }
    */
  }
}

function countProjectWinsWallets() {
  let ct = 0;
  for (const wallets in storage.allProjectWins) {
    ct = ct + wallets?.length;
  }
  return ct;
}

function hasProjectWinsChanged(projectWins1, projectWins2) {
  console.log('Object.entries(projectWins1).length', Object.entries(projectWins1).length);
  console.log('Object.entries(projectWins2).length', Object.entries(projectWins2).length);

  if (Object.entries(projectWins1).length !== Object.entries(projectWins2).length) {
    return true;
  }

  for (const [key] of Object.entries(projectWins1)) {
    console.log(key, projectWins1[key], projectWins2[key]);
    if (JSON.stringify(projectWins1[key]) !== JSON.stringify(projectWins2[key])) {
      return true;
    }
  }
  return false;
}

async function resetWins() {
  if (!window.confirm('Do you want to reset all raffle results?')) {
    return console2.log('no');
  }

  storage.results = {};
  storage.atlas = {};
  storage.alphabot = {};
  storage.premint = {};
  storage.wins = [];
  storage.allProjectWins = {};
  initStorage();

  await setStorageData(storage);
  console2.log('storage', storage);

  resetSubStatus();
  showPage({ updateStatus: true });
}

// EVENT HANDLERS ----------------------------------------------------------------------------------

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  console2.log('Received message:', request, sender);

  if (request.cmd === 'getAuth') {
    console2.log('Received getAuth');
    pageState[`${request.cmd}`] = true;
    pageState[`${request.cmd}Val`] = request.val;
  }

  if (request.cmd === 'switchedToTwitterUser') {
    pageState.switchedToTwitterUser = request;
  }

  if (request.cmd === 'getMyTabIdAsyncResponse') {
    pageState.myTabId = request.response;
  }

  sendResponse();
  return true;
});

async function getFromWebPage(url, key, tabId, maxWait = 30000, interval = 10) {
  console2.log('getFromWebPage:', url);

  await addPendingRequest(url, { action: key, tabId });
  window.open(url);

  const stopTime = millisecondsAhead(maxWait);
  while (Date.now() <= stopTime) {
    if (pageState[key]) {
      const result = pageState[`${key}Val`];
      pageState[key] = null;
      return result;
    }
    await sleep(interval);
  }
  return null;
}

// MAIN ------------------------------

async function showPage({
  wins = null,
  header = '',
  allRaffles = false,
  extended = false,
  updateStatus = true,
} = {}) {
  console2.log('showPage');

  document.getElementById('main-table').innerHTML = '';

  if (updateStatus) {
    showLastUpdatedStatus();
  }

  updateShownProvider();

  if (wins) {
    appendWinsTable(createWinsTable(wins, header));
    appendWinsTable(createWinsTable(wins, header, { allColumns: true }));
    return;
  }

  appendWinsTable(
    createWinsTable(storage.wins, 'All raffle providers', 'all-providers', { allRaffles, extended })
  );
  appendWinsTable(
    createWinsTable(storage.alphabot?.wins, 'Alphabot raffles', 'alphabot', { allRaffles, extended })
  );
  appendWinsTable(
    createWinsTable(storage.premint?.wins, 'Premint raffles', 'premint', { allRaffles, extended })
  );
  appendWinsTable(createWinsTable(storage.atlas?.wins, 'Atlas raffles', 'atlas', { allRaffles, extended }));
  appendWinsTable(
    createWinsTable(storage.luckygo?.wins, 'LuckyGo raffles', 'luckygo', { allRaffles, extended })
  );
  appendWinsTable(
    createWinsTable(storage.wins, 'Debug', 'debug', { allColumns: true, allRaffles, extended })
  );

  // await updateTwitterFollowers();

  window.preminthelper = {
    storage,
  };

  statusLogger.main('Showing raffle results below');

  console2.log('Done showing results page!');
}

/*
async function showAllPage() {
  console2.log('showAllPage');
}
*/

function appendWinsTable(table) {
  document.getElementById('main-table').appendChild(table);
  updateShownProvider();
}

function mergeAllWins({ atlas = null, alphabot = null, premint = null, lucky = null } = {}) {
  const r = [
    ...(alphabot?.length ? alphabot : []),
    ...(premint?.length ? premint : []),
    ...(atlas?.length ? atlas : []),
    ...(lucky?.length ? lucky : []),
  ];
  return r;
}

// ALPHABOT ------------------------------

async function updateAlphabotWins(checkTime, allCloudWins) {
  console2.log('updateAlphabotWins', checkTime);

  const providerName = 'Alphabot';
  const providerKey = providerName.toLowerCase();
  const raffleStorage = storage.alphabot;

  await reloadOptions(storage); // options may have changed, reload them!

  if (!storage.options.ALPHABOT_ENABLE_RESULTS) {
    statusLogger.sub(`Skip fetching new ${providerName} results (disabled in Options)`);
    return [];
  }

  updateMainStatus(`Get ${providerName} account info...`);
  const account = await getAlphabotAccount();
  console2.log('account', account);
  if (!account?.id) {
    statusLogger.sub(`Failed getting ${providerName} account. Check if logged in to website.`);
    return [];
  }

  const lastEndDate = raffleStorage.myWins?.length
    ? Math.max(...raffleStorage.myWins.map((x) => x.endDate))
    : null;
  const lastEndDateStr = lastEndDate ? new Date(lastEndDate).toLocaleString() : 'null';
  console2.log('lastEndDate', lastEndDate, lastEndDateStr);

  const myWinsByNewest = await getAlphabotWinsByNewest(account, {
    interval: ALPHABOT_INTERVAL,
    max: storage.options.ALPHABOT_RESULTS_MAX_FETCH_WINS,
    lastEndDate,
    statusLogger,
  });
  console2.log('myWinsByNewest', myWinsByNewest);

  updateMainStatus(`Get updated mint dates from ${providerName}...`);
  const myWinsByMinting = await getAlphabotWinsByMinting(account, {
    interval: ALPHABOT_INTERVAL,
    max: storage.options.ALPHABOT_RESULTS_MAX_FETCH_WINS,
    statusLogger,
  });
  console2.log('myWinsByMinting', myWinsByMinting);

  const myWins = mergeWins(myWinsByMinting, myWinsByNewest, 'id', null);

  const myWinsNew = filterNewWins(myWins, raffleStorage.myWins, checkTime);
  statusLogger.sub(`Fetched ${myWinsNew.length} new or updated winners from ${providerName}`);

  let cloudWins = [];
  if (storage.options.ALPHABOT_ENABLE_CLOUD && storage.options.CLOUD_MODE === 'load') {
    cloudWins = allCloudWins.filter((x) => x.provider === providerKey);
    console2.log('cloudWins', cloudWins);
    // cloudWins should check for duplicates on full key hxId
    raffleStorage.cloudWins = mergeWins(cloudWins, raffleStorage.cloudWins, 'hxId', checkTime);
  }

  // myWins should check for duplicates on raffle id
  raffleStorage.myWins = mergeWins(myWinsNew, raffleStorage.myWins, 'id', checkTime);

  // check if updated only on myWins and cloudWins, not on aggregated wins!
  raffleStorage.wins = mergeWins([...myWinsNew, ...cloudWins], raffleStorage.wins, 'hxId', null);

  await setStorageData(storage);

  if (storage.options.ALPHABOT_ENABLE_CLOUD && storage.options.CLOUD_MODE === 'save') {
    const ct = await countWins(providerKey, account.id, storage.options);
    console2.log('Count wins:', ct);
    // if no wins in cloud, upload everything we got!
    const winsToUpload = ct > 0 ? myWinsNew : raffleStorage.myWins;
    console2.log('winsToUpload', winsToUpload);
    const writeResult = await writeWins(winsToUpload, storage.options);
    if (writeResult.error) {
      statusLogger.sub(`Failed uploading ${providerName} results to Cloud. Network problems?`);
    } else {
      storage.results.lastCloudUpload = Date.now();
      statusLogger.sub(`Uploaded ${winsToUpload.length} ${providerName} winners to Cloud`);
    }
  }

  return raffleStorage.wins;
}

// PREMINT ------------------------------

async function updatePremintWins(checkTime, allCloudWins) {
  console2.log('updatePremintWins', checkTime);

  const providerName = 'Premint';
  const providerKey = providerName.toLowerCase();
  const raffleStorage = storage.premint;

  await reloadOptions(storage); // options may have changed, reload them!

  if (!storage.options.PREMINT_ENABLE_RESULTS) {
    statusLogger.sub(`Skip fetching new ${providerName} results (disabled in Options)`);
    return [];
  }

  updateMainStatus(`Get ${providerName} account info`);
  const account = await getPremintAccount();
  console2.log('account', account);
  if (!account?.id) {
    statusLogger.sub(`Failed getting ${providerName} account. Check if logged in to website.`);
    return [];
  }

  const skip = [...raffleStorage.myWins.map((x) => x.id), ...raffleStorage.myLost.map((id) => id)];
  const { wins, lost } = await getPremintWins(account, {
    interval: PREMINT_INTERVAL,
    max: storage.options.PREMINT_RESULTS_MAX_FETCH_WINS,
    skip,
    statusLogger,
  });
  const myWins = wins;
  const myLost = lost;
  console2.log('myWins', myWins);
  console2.log('myLost', myLost);

  const myWinsNew = filterNewWins(myWins, raffleStorage.myWins, checkTime);
  statusLogger.sub(`Fetched ${myWinsNew.length} new or updated winners from ${providerName}`);

  let cloudWins = [];
  if (storage.options.PREMINT_ENABLE_CLOUD && storage.options.CLOUD_MODE === 'load') {
    cloudWins = allCloudWins.filter((x) => x.provider === providerKey);
    console2.log('cloudWins', cloudWins);
    raffleStorage.cloudWins = mergeWins(cloudWins, raffleStorage.cloudWins, 'hxId', checkTime);
  }

  raffleStorage.myLost = noDuplicates(myLost, raffleStorage.myLost);
  raffleStorage.myWins = mergeWins(myWinsNew, raffleStorage.myWins, 'id', checkTime);

  // check if updated only on myWins and cloudWins, not on aggregated wins!
  raffleStorage.wins = mergeWins([...myWinsNew, ...cloudWins], raffleStorage.wins, 'hxId', null);

  await setStorageData(storage);

  if (storage.options.PREMINT_ENABLE_CLOUD && storage.options.CLOUD_MODE === 'save') {
    const ct = await countWins(providerKey, account.id, storage.options);
    console2.log('Count wins:', ct);
    // if no wins in cloud, upload everything we got!
    const winsToUpload = ct > 0 ? myWinsNew : raffleStorage.myWins;
    console2.log('winsToUpload', winsToUpload);
    const writeResult = await writeWins(winsToUpload, storage.options);
    if (writeResult.error) {
      statusLogger.sub(`Failed uploading ${providerName} results to Cloud. Network problems?`);
    } else {
      storage.results.lastCloudUpload = Date.now();
      statusLogger.sub(`Uploaded ${winsToUpload.length} ${providerName} winners to Cloud`);
    }
  }

  return raffleStorage.wins;
}

// ATLAS ------------------------------

async function updateAtlasWins(checkTime, allCloudWins) {
  console2.log('updateAtlasWins', checkTime);

  const providerName = 'Atlas';
  const providerKey = providerName.toLowerCase();
  const raffleStorage = storage.atlas;

  await reloadOptions(storage); // options may have changed, reload them!

  if (!storage.options.ATLAS_ENABLE_RESULTS) {
    statusLogger.sub(`Skip fetching new ${providerName} results (disabled in Options)`);
    return [];
  }

  updateMainStatus(`Get ${providerName} account info`);
  const account = await getAtlasAccount();
  console2.log('account', account);
  if (!account?.id) {
    statusLogger.sub(`Failed getting ${providerName} account. Check if logged in to website.`);
    return [];
  }

  const myWins = await getAtlasWins(account, {
    interval: ATLAS_INTERVAL,
    max: storage.options.ATLAS_RESULTS_MAX_FETCH_WINS,
    statusLogger,
  });
  console2.log('myWins', myWins);

  const myWinsNew = filterNewWins(myWins, raffleStorage.myWins, checkTime);
  statusLogger.sub(`Fetched ${myWinsNew.length} new or updated winners from ${providerName}`);

  let cloudWins = [];
  if (storage.options.ATLAS_ENABLE_CLOUD && storage.options.CLOUD_MODE === 'load') {
    cloudWins = allCloudWins.filter((x) => x.provider === providerKey);
    console2.log('cloudWins', cloudWins);
    raffleStorage.cloudWins = mergeWins(cloudWins, raffleStorage.cloudWins, 'hxId', checkTime);
  }

  raffleStorage.myWins = mergeWins(myWinsNew, raffleStorage.myWins, 'id', checkTime);

  // check if updated only on myWins and cloudWins, not on aggregated wins!
  raffleStorage.wins = mergeWins([...myWinsNew, ...cloudWins], raffleStorage.wins, 'hxId', null);

  await setStorageData(storage);

  if (storage.options.ATLAS_ENABLE_CLOUD && storage.options.CLOUD_MODE === 'save') {
    const ct = await countWins(providerKey, account.id, storage.options);
    console2.log('Count wins:', ct);
    // if no wins in cloud, upload everything we got!
    const winsToUpload = ct > 0 ? myWinsNew : raffleStorage.myWins;
    console2.log('winsToUpload', winsToUpload);
    const writeResult = await writeWins(winsToUpload, storage.options);
    if (writeResult.error) {
      statusLogger.sub(`Failed uploading ${providerName} results to Cloud. Network problems?`);
    } else {
      storage.results.lastCloudUpload = Date.now();
      statusLogger.sub(`Uploaded ${winsToUpload.length} ${providerName} winners to Cloud`);
    }
  }

  return raffleStorage.wins;
}

// LUCKY ------------------------------

async function updateLuckygoWins(checkTime, allCloudWins) {
  console2.log('updateLuckygoWins', checkTime);

  const providerName = 'LuckyGo';
  const providerKey = providerName.toLowerCase();
  const raffleStorage = storage.luckygo;

  await reloadOptions(storage); // options may have changed, reload them!

  if (!storage.options.LUCKYGO_ENABLE_RESULTS) {
    statusLogger.sub(`Skip fetching new ${providerName} results (disabled in Options)`);
    return [];
  }

  updateMainStatus(`Get ${providerName} account info`);
  const account = await getLuckygoAccount();
  console2.log('account', account);
  if (!account?.id) {
    statusLogger.sub(`Failed getting ${providerName} account. Check if logged in to website.`);
    return [];
  }

  const authKey = await getLuckygoAuth();
  if (!authKey) {
    statusLogger.sub(`Failed getting ${providerName} authentication key. Check if logged in to website.`);
    return [];
  }

  const skip = [...raffleStorage.myWins.map((x) => x.id)];
  const wins = await getLuckygoWins(account, authKey, {
    interval: LUCKYGO_INTERVAL,
    max: storage.options.LUCKYGO_RESULTS_MAX_FETCH_WINS,
    skip,
    statusLogger,
  });
  const myWins = wins;
  console2.log('myWins', myWins);

  const myWinsNew = filterNewWins(myWins, raffleStorage.myWins, checkTime);
  statusLogger.sub(`Fetched ${myWinsNew.length} new or updated winners from ${providerName}`);

  let cloudWins = [];
  if (storage.options.LUCKYGO_ENABLE_CLOUD && storage.options.CLOUD_MODE === 'load') {
    cloudWins = allCloudWins.filter((x) => x.provider === providerKey);
    console2.log('cloudWins', cloudWins);
    raffleStorage.cloudWins = mergeWins(cloudWins, raffleStorage.cloudWins, 'hxId', checkTime);
  }

  raffleStorage.myWins = mergeWins(myWinsNew, raffleStorage.myWins, 'id', checkTime);

  // check if updated only on myWins and cloudWins, not on aggregated wins!
  raffleStorage.wins = mergeWins([...myWinsNew, ...cloudWins], raffleStorage.wins, 'hxId', null);

  await setStorageData(storage);

  if (storage.options.LUCKYGO_ENABLE_CLOUD && storage.options.CLOUD_MODE === 'save') {
    const ct = await countWins(providerKey, account.id, storage.options);
    console2.log('Count wins:', ct);
    // if no wins in cloud, upload everything we got!
    const winsToUpload = ct > 0 ? myWinsNew : raffleStorage.myWins;
    console2.log('winsToUpload', winsToUpload);
    const writeResult = await writeWins(winsToUpload, storage.options);
    if (writeResult.error) {
      statusLogger.sub(`Failed uploading ${providerName} results to Cloud. Network problems?`);
    } else {
      storage.results.lastCloudUpload = Date.now();
      statusLogger.sub(`Uploaded ${winsToUpload.length} ${providerName} winners to Cloud`);
    }
  }

  return raffleStorage.wins;
}

async function getLuckygoAuth() {
  await getMyTabIdFromExtension(pageState, 5000);
  if (!pageState.myTabId) {
    console2.error('Invalid myTabId');
    return null;
  }
  const authKey = await getFromWebPage(`https://luckygo.io/myraffles`, 'getAuth', pageState.myTabId);
  console2.log('authKey', authKey);

  if (typeof authKey !== 'string') {
    return null;
  }

  const authKeyTrim = authKey.replace('%20', ' ');

  return authKeyTrim;
}

// WINS ------------------------------

function mergeWins(newWins, oldWins, key, checkTime) {
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
  return noDuplicatesByKey([...newWins, ...oldWins], key);
}

function isWinModified(newWin, oldWin) {
  // todo use mintDate instead?
  return (newWin.hxSortKey && newWin.hxSortKey !== oldWin.hxSortKey) || newWin.mintTime !== oldWin.mintTime;
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
    console2.error(e);
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
        //console2.log('toWalletsHTML', x, trimmed, alias);
        return `<span title="${x.toLowerCase()}">${trimmed}${aliasText}</span>`;
      })
      .join('<br>');
  } catch (e) {
    console2.error(e, wallets, defaultVal);
    return defaultVal;
  }
}

function packWins(wins, allRaffles = false) {
  console2.log('sortWins', wins);
  const winsToSort = resortHxUpdated([...(wins?.length ? wins : [])]);

  winsToSort.forEach((x) => {
    x.twitterHandle = normalizeTwitterHandle(x.twitterHandle);
    x.twitterHandleGuess = normalizeTwitterHandle(x.twitterHandleGuess);
  });

  const sortedWins = winsToSort.sort(dynamicSortMultiple('twitterHandleGuess', '-hxSortKey'));

  const winsWithTwitter = [];
  const winsWithoutTwitterRaw = [];
  sortedWins.forEach((win) => {
    const handle = win.twitterHandleGuess;
    if (!handle) {
      return winsWithoutTwitterRaw.push(win);
    }
    const handleLow = handle.toLowerCase();
    let baseWin = winsWithTwitter.find((x) => x.twitterHandle && x.twitterHandle.toLowerCase() === handleLow);
    if (!baseWin) {
      baseWin = {
        twitterHandle: handle,
        wins: [],
      };
      winsWithTwitter.push(baseWin);
    }
    baseWin.wins.push(win);
  });

  winsWithTwitter.forEach((x) => {
    x.hxSortKey = Math.max(...x.wins.map((w) => w.hxSortKey || 0));
    x.mintDateLast = Math.max(...x.wins.map((w) => w.mintDate || 0));
    x.mintDate = x.wins.some((w) => isRestarted(w)) ? null : Math.max(...x.wins.map((w) => w.mintDate || 0));
  });

  const winsWithoutTwitter = winsWithoutTwitterRaw.map((x) => {
    return {
      twitterHandle: '',
      wins: [x],
      hxSortKey: x.hxSortKey,
    };
  });

  console2.log('winsWithTwitter', winsWithTwitter);
  console2.log('winsWithoutTwitter', winsWithoutTwitterRaw);

  const allWins = [...winsWithTwitter, ...winsWithoutTwitter];
  allWins.sort(dynamicSortMultiple('-hxSortKey'));

  const minMintDate = millisecondsAhead(-storage.options.RESULTS_DAYS_TO_KEEP_MINTED_WINS * ONE_DAY);
  console2.log('minMintDate', minMintDate, storage.options.RESULTS_DAYS_TO_KEEP_MINTED_WINS);

  const winsToShow = allRaffles ? allWins : allWins.filter((x) => isWinnerToShow(x.wins[0], minMintDate));
  console2.log('winsToShow', winsToShow);

  const winsToShowSorted = [
    ...winsToShow.filter((x) => x.mintDate),
    ...winsToShow.filter((x) => !x.mintDate),
  ];
  console2.log('winsToShowSorted', winsToShowSorted);

  return winsToShowSorted;
}

function countPackedWins(packedWins) {
  let ct = 0;
  packedWins.forEach((x) => (ct = ct + x.wins.length));
  return ct;
}

function resortHxUpdated(wins) {
  wins.forEach((win) => {
    if (isRestarted(win)) {
      win.hxSortKey = win.pickedDate > win.startDate ? win.pickedDate : win.startDate;
    }
  });
  return wins;
}

function isWinnerToShow(win, minMintDate) {
  console2.log('isWinnerToShow', win.name, minMintDate, win);
  if (!win) {
    console2.log('!win, hide');
    return false;
  }
  if (!win.mintDate) {
    // no mint date set -> include in result set!
    console2.log('!win.mintDate, show');
    return true;
  }
  if (win.mintDate >= minMintDate) {
    console2.log('win.mintDate >= minMintDate, show');
    return true;
  }
  if (isRestarted(win)) {
    console2.log('already minted but new raffle');
    // already minted but new raffle, probably restarted drop -> include in result set!?
    return true;
  }
  console2.log('do not show winner');
  return false;
}

function isRestarted(win) {
  // already minted but new raffle, probably restarted drop
  return win.startDate && win.mintDate && win.startDate >= win.mintDate;
}

function createWinsTableHeadRow(extended = false) {
  const head = document.createElement('THEAD');
  const row = document.createElement('TR');

  row.appendChild(
    createCell(
      '#W',
      'Num unique wallets that won (in all raffles connected to projects with given Twitter handle)'
    )
  );

  row.appendChild(
    createCell(
      '#U',
      'Num unique users that won (in all raffles connected to projects with given Twitter handle)'
    )
  );

  row.appendChild(createCell('Provider'));

  row.appendChild(createCell('Name'));
  row.appendChild(
    createCell(
      'DTC',
      'Wallet added Direct To Contract? This is set by Alphabot projects, and cannot always be fully trusted, so do your own research!'
    )
  );

  row.appendChild(createCell('Twitter'));
  row.appendChild(createCell('Mint Date'));
  row.appendChild(createCell('Time'));
  row.appendChild(createCell('Raffle Date'));
  row.appendChild(createCell('Start Date'));
  if (extended) {
    row.appendChild(createCell('Sort Key 1'));
    row.appendChild(createCell('Sort Key 2'));
  }
  row.appendChild(createCell('R?', 'Is raffle restarted after mint date?'));
  row.appendChild(createCell('WL Price', 'Price at Whitelist Mint'));
  row.appendChild(createCell('Price', 'Price at Public Mint'));
  row.appendChild(createCell('Supply'));
  row.appendChild(createCell('CHAIN'));
  row.appendChild(createCell('#W', 'Num raffle winners'));
  row.appendChild(createCell('#E', 'Num raffle entrants'));
  row.appendChild(createCell('Wallets'));
  row.appendChild(createCell('Alias'));
  row.appendChild(createCell('Account'));
  row.appendChild(createCell('Team'));
  row.appendChild(createCell('Discord'));

  head.appendChild(row);
  return head;
}

function createWinsTable(
  wins,
  header,
  id,
  { allColumns = false, allRaffles = false, extended = false } = {}
) {
  console2.log('createWinsTable wins', header, allColumns, wins);

  const packedWins = packWins(wins, allRaffles);
  setDateishOnPackedWins(packedWins);
  console2.log('packedWins', packedWins);

  storage.results[id] = countPackedWins(packedWins);

  if (allColumns) {
    const sortedWins = packedWins.map((x) => x.wins).flat();
    const keys = sortedWins?.length ? Object.keys(sortedWins[0]) : [];
    const div = document.createElement('div');
    div.id = id;
    div.className = 'provider-wins';
    div.innerHTML =
      (header ? `<h3>${header} (${sortedWins.length})</h3>` : '') +
      (sortedWins.length ? jht(sortedWins, keys) : 'No results');
    return div;
  }

  const table = document.createElement('TABLE');

  table.appendChild(createWinsTableHeadRow(extended));

  for (const parent of packedWins) {
    const wins = parent.wins;
    const firstWin = parent.wins[0];
    const allWallets = wins.map((x) => x.wallets).flat();
    const allUsers = wins.map((x) => x.userId).flat();

    /*
    console2.log('pwin', parent);
    console2.log('wins', wins);
    console2.log('firstWin', firstWin);
    console2.log('allWallets', allWallets);
    */

    const row = document.createElement('TR');

    // ROW: Row relative day class
    if (parent.isToday) {
      row.classList.toggle('is-today', true);
    }
    if (parent.isTomorrowish) {
      row.classList.toggle('is-tomorrowish', true);
    }
    if (parent.isYesterdayish) {
      row.classList.toggle('is-yesterdayish', true);
    }

    // CELL: Num wallets
    row.appendChild(createCell(noDuplicates(allWallets).length.toString()));

    // CELL: Num users
    row.appendChild(createCell(noDuplicates(allUsers).length.toString()));

    // CELL: dtc
    const providers = wins.map((x) => x.provider);
    row.appendChild(createCell(createMultiTexts(providers, { className: 'provider', useTextAsClass: true })));

    // CELL: raffle links
    const raffleLinks = wins.map((x) => {
      const isNew = x.hxCreated && x.hxCreated >= storage.results.lastWinsUpdate;
      const isUpdated = x.hxUpdated && x.hxUpdated >= storage.results.lastWinsUpdate;
      return {
        url: x.url,
        text: trimText(x.name, MAX_LEN_RAFFLE_NAME),
        fullText: x.name,
        isNew,
        isUpdated,
      };
    });
    row.appendChild(
      createCell(createMultiLinks(raffleLinks, { className: 'raffle-link', target: '_blank' }))
    );

    // CELL: dtc
    const dtcTexts = wins.map((x) => `${typeof x.dtc !== 'boolean' ? ' ' : x.dtc ? 'Yes' : 'No'}`);
    row.appendChild(createCell(createMultiTexts(dtcTexts, { className: 'dtc', useTextAsClass: true })));

    // CELL: twitterHandleGuess
    const twitterHandle = pageState.permissions?.enabled ? firstWin.twitterHandleGuess : 'hidden';
    row.appendChild(
      createCell(
        createLink(makeTwitterURL(twitterHandle), trimText(twitterHandle, MAX_LEN_TWITTER_HANDLE), {
          dataset: [{ key: 'username', val: firstWin.twitterHandleGuess }],
          className: 'twitter-link',
          target: '_blank',
          fullText: twitterHandle,
        })
      )
    );

    const restarted = !!wins.some((w) => isRestarted(w));
    const restartedClassName = restarted ? ' restarted' : '';

    // CELL: mint-date
    const mintDates = wins.map((x) => {
      return { date: x.mintDate, hasTime: false };
    });
    row.appendChild(
      createCell(createMultiDates(mintDates, '', { className: 'mint-date' + restartedClassName }))
    );

    // CELL: mint-time
    const mintTimes = wins.map((x) => {
      return { date: x.mintTime ? x.mintDate : null };
    });
    row.appendChild(
      createCell(
        createMultiDates(mintTimes, '', { className: 'mint-time' + restartedClassName, timeOnly: true })
      )
    );

    // CELL: raffle-date
    const raffleDates = wins.map((x) => {
      return { date: x.pickedDate, hasTime: false };
    });
    // console2.log('raffleDates', raffleDates);
    row.appendChild(createCell(createMultiDates(raffleDates, '', { className: 'raffle-date' })));

    // CELL: start-date
    const startDates = wins.map((x) => {
      return { date: x.startDate, hasTime: false };
    });
    // console2.log('startDates', startDates);
    row.appendChild(createCell(createMultiDates(startDates, '', { className: 'raffle-date' })));

    if (extended) {
      // CELL: hxSortKey 1
      row.appendChild(createCell(createDate(parent.hxSortKey, false, '', { className: 'sort-key' })));

      // CELL: hxSortKey 2
      const hxSortKeys = wins.map((x) => {
        return { date: x.hxSortKey, hasTime: false };
      });
      row.appendChild(createCell(createMultiDates(hxSortKeys, '', { className: 'sort-key' })));
    }

    // CELL: raffle-restarted
    const isRestarteds = wins.map((x) => (raffleIsRestarted(x) ? 'Yes' : ''));
    row.appendChild(createCell(createMultiTexts(isRestarteds, '', { className: 'raffle-restarted' })));

    // CELL: wl-price
    const wlPrices = wins.map((x) => x.wlPrice);
    const wlPricesShort = wins.map((x) => trimPrice(x.wlPrice));
    row.appendChild(
      createCell(createMultiTexts(wlPricesShort, { className: 'wl-price', fullTexts: wlPrices }))
    );

    // CELL: pub-price
    const pubPrices = wins.map((x) => trimPrice(x.pubPrice));
    row.appendChild(createCell(createMultiTexts(pubPrices, { className: 'pub-price' })));

    // CELL: supply
    const supplies = wins.map((x) => trimText(x.supply, 8));
    row.appendChild(createCell(createMultiTexts(supplies, { className: 'wl-supply' })));

    // CELL: blockchain
    const blockchains = wins.map((x) => trimText(x.blockchain, 6));
    row.appendChild(createCell(createMultiTexts(blockchains, { className: 'blockchain' })));

    // CELL: winner-count
    const winnerCounts = wins.map((x) => trimTextNum(x.winnerCount, 6));
    row.appendChild(
      createCell(createMultiTexts(winnerCounts, { className: 'winner-count', hideDups: false }))
    );

    // CELL: entry-count
    const entryCounts = wins.map((x) => trimTextNum(x.entryCount, 6));
    row.appendChild(createCell(createMultiTexts(entryCounts, { className: 'entry-count', hideDups: false })));

    // CELL: mint-address
    const sortedWallets = sortWallets(wins.map((x) => x.wallets).flat(), storage.options);
    const wallets = noDuplicates(
      sortedWallets.map((addr) => {
        const walletAlias = walletToAlias(addr, storage.options);
        const suffix = walletAlias; // ? ` (${walletAlias})` : '';
        return { addr, shortAddr: trimWallet(addr.toLowerCase()), alias: suffix };
      })
    );
    // row.appendChild(createCell(createMultiTexts(wallets, { className: 'mint-address' })));
    const shortAddrs = wallets.map((x) => x.shortAddr);
    row.appendChild(
      createCell(
        createMultiTexts(shortAddrs, {
          className: 'mint-address',
          fullTexts: wallets.map((x) => x.addr),
        })
      )
    );

    // CELL: mint-aliases
    const aliases = wallets.map((x) => x.alias);
    row.appendChild(createCell(createMultiTexts(aliases, { className: 'mint-aliases' })));

    // CELL: account-name
    const accountNames = noDuplicates(
      wins.map((x) => accountToAlias(x.userId, storage.options) || x.userName || x.userId || '')
    );
    row.appendChild(createCell(createMultiTexts(accountNames, { className: 'account-name' })));

    // CELL: team-name
    const teamNames = wins.map((x) => x.teamName);
    const teamNamesEnabled = pageState.permissions?.enabled
      ? teamNames
      : Array(teamNames.length).fill('hidden');
    row.appendChild(
      createCell(
        createMultiTexts(
          teamNamesEnabled.map((x) => trimText(x, MAX_LEN_TEAM_NAME)),
          { className: 'team-name', fullTexts: teamNamesEnabled }
        )
      )
    );

    // CELL: discord-link
    const discordUrls = wins.filter((x) => x.discordUrl);
    const discordUrl = discordUrls.length ? discordUrls[0].discordUrl : null;
    const discordUrlEnabled = pageState.permissions?.enabled ? discordUrl : 'https://discord.gg/hidden';
    const discordHandle = extractDiscordHandle(discordUrlEnabled);
    row.appendChild(
      createCell(
        createLink(discordUrlEnabled, trimText(discordHandle, MAX_LEN_DISCORD_HANDLE), {
          className: 'discord-link',
          target: '_blank',
          fullText: discordHandle,
        })
      )
    );

    //console2.log('row', row);
    table.appendChild(row);
  }

  console2.log('table', table);

  console2.log(toDateHTML(null));
  console2.log(toWalletsHTML(null));

  const numWins = packedWins.reduce((sum, obj) => sum + obj.wins.length, 0);

  const div = document.createElement('div');
  div.id = id;
  div.className = 'provider-wins';
  div.innerHTML =
    (header ? `<h3>${header} (${numWins})</h3>` : '') + (numWins ? table.outerHTML : 'No results');

  return div;
}

function raffleIsRestarted(win) {
  return (
    (win.mintDate && win.startDate && win.startDate > win.mintDate) ||
    (win.mintDate && win.endDate && win.endDate > win.mintDate) ||
    (win.startDate && win.endDate && win.startDate > win.endDate)
  );
}

function createCell(childOrText, title = '') {
  const elem = document.createElement('TD');
  if (typeof childOrText === 'string') {
    elem.innerText = childOrText;
  } else {
    elem.appendChild(childOrText);
  }
  if (title) {
    elem.title = title;
  }
  return elem;
}

function createLink(url, text, { dataset, target, className, fullText } = {}) {
  const elem = document.createElement('A');
  elem.href = url;
  elem.target = target || undefined;
  addTarget(elem, target);
  addClassName(elem, className);
  elem.innerText = text.trim();
  if (text.includes(SHORTENED_TEXT_SUFFIX) && fullText) {
    elem.title = fullText;
  }
  if (dataset?.length) {
    dataset.forEach((x) => {
      elem.dataset[x.key] = x.val;
    });
  }
  return elem;
}

function createMultiLinks(links, { target, className } = {}) {
  const elem = document.createElement('SPAN');
  elem.style.whiteSpace = 'nowrap';
  let isFirst = true;
  for (const link of links) {
    if (!isFirst) {
      elem.appendChild(document.createElement('BR'));
    }
    const thisClass = `${className || ''} ${isFirst ? 'first' : ''} ${link.isNew ? 'is-new' : ''} ${
      link.isUpdated ? 'is-updated' : ''
    }`.trim();
    const thisUrl = pageState.permissions?.enabled ? link.url : 'http://example.org/hidden-premium-feature';
    const thisText = pageState.permissions?.enabled ? link.text : 'Hidden Raffle Name';
    elem.appendChild(
      createLink(thisUrl, thisText, { target, className: thisClass, fullText: link.fullText })
    );
    isFirst = false;
  }
  return elem;
}

function createMultiTexts(texts, { className, useTextAsClass, hideDups = true, fullTexts } = {}) {
  const elem = document.createElement('SPAN');
  elem.style.whiteSpace = 'nowrap';
  let isFirst = true;
  let lastText = null;
  for (const [index, text] of texts.entries()) {
    if (!isFirst) {
      elem.appendChild(document.createElement('BR'));
    }
    let newElem = document.createElement('SPAN');
    if (hideDups && text === lastText) {
      newElem.innerText = ' ';
    } else {
      newElem.innerText = text;
      lastText = text;
      if (text.includes(SHORTENED_TEXT_SUFFIX) && fullTexts?.length) {
        newElem.title = fullTexts[index];
      }
    }
    addClassName(newElem, className);
    addClassName(newElem, isFirst ? 'first' : null);
    addClassName(newElem, useTextAsClass ? textAsClass(text) : null);
    elem.appendChild(newElem);
    isFirst = false;
  }
  return elem;
}

function createMultiDates(dates, errStr, { className, timeOnly, hideDups = true } = {}) {
  const elem = document.createElement('SPAN');
  elem.style.whiteSpace = 'nowrap';
  let isFirst = true;
  let lastText = null;
  for (const date of dates) {
    if (!isFirst) {
      elem.appendChild(document.createElement('BR'));
    }
    const thisClass = `${className || ''} ${isFirst ? 'first' : ''}`.trim();
    let newElem = createDate(date.date, date.hasTime, errStr, { className: thisClass, timeOnly });
    if (hideDups && newElem.innerText === lastText) {
      newElem = document.createElement('SPAN');
      newElem.innerText = ' ';
    } else {
      lastText = newElem.innerText;
    }
    elem.appendChild(newElem);
    isFirst = false;
  }
  return elem;
}

function createDate(date, hasTime, errStr = '', { className, timeOnly } = {}) {
  const elem = document.createElement('SPAN');
  elem.style.whiteSpace = 'nowrap';
  addClassName(elem, className);
  let text;

  const options = { hour: '2-digit', minute: '2-digit' };

  if (timeOnly) {
    text = timestampToLocaleTimeString(date, errStr, SORT_ORDER_LOCALE, options);
  } else {
    text = hasTime
      ? timestampToLocaleString(date, errStr, SORT_ORDER_LOCALE)
      : timestampToLocaleDateString(date, errStr, SORT_ORDER_LOCALE);
  }
  elem.innerText = text;
  return elem;
}

// PROVIDER FUNCS -----------------------------------------------------

function showProviderClickHandler(id) {
  pageState.shownProvider = id;
  updateShownProvider();
}

function updateShownProvider() {
  const update = (id) => {
    const ct = storage.results[id] || null;
    const elemContent = document.getElementById(id);
    const elemLink = document.getElementById('show-' + id);
    console2.log('updateShownProvider id, ct, pageState', id, ct, pageState);
    console2.log('updateShownProvider elemContent', elemContent);

    const showFlag = pageState.shownProvider === id;

    if (elemLink) {
      elemLink.classList.toggle('show', showFlag);
    }
    if (elemContent) {
      elemContent.classList.toggle('show', showFlag);
    }

    if (elemLink && ct) {
      elemLink.dataset.hxCount = `(${ct})`;
    }
  };
  update('all-providers');
  update('alphabot');
  update('premint');
  update('atlas');
  update('luckygo');
  update('debug');
}

// MISC FUNCS -----------------------------------------------------

function showCheckboxedClickHandler() {
  showPage({
    allRaffles: document.getElementById('show-hidden').checked,
    extended: document.getElementById('show-extended').checked,
    updateStatus: false,
  });
}

// WINS FUNCS -----------------------------------------------------

// MISC HELPERS -----------------------------------------------------

// STATUS FUNCS -----------------------------------------------------

function updateMainStatus(text) {
  console2.log('updateMainStatus', text);

  const elem = document.getElementById('hx-status-main');
  if (elem) {
    elem.innerText = text;
  }
}

function resetSubStatus() {
  document.getElementById('hx-status').replaceChildren();
}

function updateSubStatus(html, reuseLast = false) {
  console2.log('updateSubStatus', html);

  const elem = document.getElementById('hx-status');
  if (!elem) {
    console2.error('Missing status element in HTML!');
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

/*
function resetSubStatus() {
  document.getElementById('hx-status').replaceChildren();
}

function updateSubStatus(html, reuseLast = false) {
  const elem = document.getElementById('hx-status');
  if (!elem) {
    console2.error('Missing status element in HTML!');
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

async function setDateishOnPackedWins(packedWins) {
  if (!packedWins?.length) {
    return;
  }

  const pivotTodayStr = new Date().toLocaleDateString(SORT_ORDER_LOCALE);
  const pivotTodayDate = new Date(pivotTodayStr);
  console2.log('pivotTodayStr, pivotTodayDate:', pivotTodayStr, pivotTodayDate);

  const pivotTomorrowStr = new Date(millisecondsAhead(1 * ONE_DAY)).toLocaleDateString(SORT_ORDER_LOCALE);
  const pivotTomorrowDate = new Date(pivotTomorrowStr);
  console2.log('pivotTomorrowStr, pivotTomorrowStr:', pivotTomorrowStr, pivotTomorrowDate);

  const pivotYesterdayStr = new Date(millisecondsAhead(-1 * ONE_DAY)).toLocaleDateString(SORT_ORDER_LOCALE);
  const pivotYesterdayDate = new Date(pivotYesterdayStr);
  console2.log('pivotYesterdayStr, pivotYesterdayDate:', pivotYesterdayStr, pivotYesterdayDate);

  let lastTommorowishDateStr = null;
  for (let i = packedWins.length - 1; i--; i >= 0) {
    //console2.log('i', i);
    const parent = packedWins[i];
    if (!parent?.wins?.length) {
      continue;
    }

    const item = parent.wins[0];
    // console2.trace('item:', new Date(item.mintDate), pivotTomorrowDate, item.mintDate >= pivotTomorrowDate, item);

    if (!item.mintDate) {
      continue;
    }
    const itemDateStr = new Date(item.mintDate).toLocaleDateString(SORT_ORDER_LOCALE);

    if (isToday(new Date(item.mintDate))) {
      parent.isToday = true;
    }

    if (itemDateStr > lastTommorowishDateStr) {
      console2.log('no more tomorrowishs');
      break;
    }

    if (itemDateStr >= pivotTomorrowStr) {
      lastTommorowishDateStr = itemDateStr;
      parent.isTomorrowish = true;
      console2.log('isTomorrowish:', item);
      // break;
      continue;
    }

    if (itemDateStr < pivotTodayStr && itemDateStr >= pivotYesterdayStr) {
      parent.isYesterdayish = true;
      console2.log('isYesterdayish:', item);
    }
  }
}

function showLastUpdatedStatus() {
  const nowDate = new Date();

  // resetSubStatus();

  if (storage.results.lastProviderUpdate) {
    const timestamp = storage.results.lastProviderUpdate;

    const timeText1 = timestampToLocaleString(timestamp, '-', DEFAULT_LOCALE);
    const days1 = daysBetween(timestamp, nowDate);
    const hours1 = hoursBetween(timestamp, nowDate);
    const minutes1 = minutesBetween(timestamp, nowDate);
    const seconds1 = secondsBetween(timestamp, nowDate);
    let agoText1 = '';
    if (seconds1 < 60) {
      agoText1 = `${seconds1} ${pluralize(seconds1, 'second', 'seconds')} ago`;
    } else if (minutes1 < 60) {
      agoText1 = `${minutes1} ${pluralize(minutes1, 'minute', 'minutes')} ago`;
    } else if (hours1 < 24) {
      agoText1 = `${hours1} ${pluralize(hours1, 'hour', 'hours')} ago`;
    } else if (days1 > 0) {
      agoText1 = `${days1} ${pluralize(days1, 'day', 'days')} ago`;
    }
    updateSubStatus(`Results last fetched from raffle providers at ${timeText1} (<b>${agoText1}</b>)`);
  } else {
    updateSubStatus(`Results never fetched from raffle providers`);
  }

  if (storage.results.lastCloudUpdate) {
    const timestamp = storage.results.lastCloudUpdate;

    const timeText2 = timestampToLocaleString(timestamp, '-', DEFAULT_LOCALE);

    const days2 = daysBetween(timestamp, nowDate);
    const hours2 = hoursBetween(timestamp, nowDate);
    const minutes2 = minutesBetween(timestamp, nowDate);
    const seconds2 = secondsBetween(timestamp, nowDate);
    let agoText2 = '';
    if (seconds2 < 60) {
      agoText2 = `${seconds2} ${pluralize(seconds2, 'second', 'seconds')} ago`;
    } else if (minutes2 < 60) {
      agoText2 = `${minutes2} ${pluralize(minutes2, 'minute', 'minutes')} ago`;
    } else if (hours2 < 24) {
      agoText2 = `${hours2} ${pluralize(hours2, 'hour', 'hours')} ago`;
    } else if (days2 > 0) {
      agoText2 = `${days2} ${pluralize(days2, 'day', 'days')} ago`;
    }
    updateSubStatus(`Results last fetched from Cloud at ${timeText2} (<b>${agoText2}</b>)`);
  } else {
    updateSubStatus(`Results never fetched from Cloud`);
  }

  if (storage.results.lastCloudUpload) {
    const timestamp = storage.results.lastCloudUpload;

    const timeText2 = timestampToLocaleString(timestamp, '-', DEFAULT_LOCALE);

    const days2 = daysBetween(timestamp, nowDate);
    const hours2 = hoursBetween(timestamp, nowDate);
    const minutes2 = minutesBetween(timestamp, nowDate);
    const seconds2 = secondsBetween(timestamp, nowDate);
    let agoText2 = '';
    if (seconds2 < 60) {
      agoText2 = `${seconds2} ${pluralize(seconds2, 'second', 'seconds')} ago`;
    } else if (minutes2 < 60) {
      agoText2 = `${minutes2} ${pluralize(minutes2, 'minute', 'minutes')} ago`;
    } else if (hours2 < 24) {
      agoText2 = `${hours2} ${pluralize(hours2, 'hour', 'hours')} ago`;
    } else if (days2 > 0) {
      agoText2 = `${days2} ${pluralize(days2, 'day', 'days')} ago`;
    }
    updateSubStatus(`Results last uploaded to Cloud at ${timeText2} (<b>${agoText2}</b>)`);
  } else {
    updateSubStatus(`Results never uploaded to Cloud`);
  }
}

function filterNewWins(wins, storageWins, checkTime) {
  return !storageWins
    ? wins
    : wins.filter((x) => {
        const old = storageWins.find((y) => y.id === x.id);
        if (!old) {
          return true;
        }
        return old.hxUpdated >= checkTime;
      });
}

// TWITTER HELPERS -----------------------------------------------------

/*
async function getTwitterFollowerCount() {
  // return (await getObserver()).getTwitter(username, 999);
}

async function updateTwitterFollowers() {
  console2.log('updateTwitterFollowers');
  const elems = [...document.querySelectorAll('a.twitter-link')];
  console2.log('elems', elems);
  for (let link of elems) {
    const followers = await getTwitterFollowerCount(link.dataset.username);
    link.dataset.hxFollowersNum = followers;
    link.dataset.hxFollowers = kFormatter(followers);
  }
}
*/

// PROJECT-WINS

function createProjectWins(packedWins) {
  console2.log('createProjectWins; packedWins:', packedWins);

  const minMintDate = millisecondsAhead(-(storage.options.RESULTS_PREV_WINS_LIFETIME_MINT_DAYS * ONE_DAY));
  const minPickedDate = millisecondsAhead(
    -(storage.options.RESULTS_PREV_WINS_LIFETIME_PICKED_DAYS * ONE_DAY)
  );

  const obj = {};

  //const data = [];
  packedWins.forEach((pw) => {
    console2.log('pw:', pw);

    const handle = pw.twitterHandle.toLowerCase();
    if (!handle) {
      console2.log('No twitter handle, skip');
      return;
    }

    /*
    const dateKey = maxOrNull(...pw.wins.map((x) => x.hxSortKey).filter((x) => x));
    const startDate = maxOrNull(...pw.wins.map((x) => x.startDate).filter((x) => x));
    const mintDate = maxOrNull(...pw.wins.map((x) => x.mintDate).filter((x) => x));
    const picked = maxOrNull(...pw.wins.map((x) => x.picked).filter((x) => x));
    */

    const winsToInclude = pw.wins.filter((win) => {
      if (win.mintDate) {
        if (win.mintDate >= minMintDate) {
          console2.trace('mintDate still valid, keep:', win);
          return true;
        }
        console2.trace('mintDate to early, skip:', win);
        return false;
      }
      return win.pickedDate >= minPickedDate;
    });
    console2.trace('winsToInclude:', winsToInclude);

    const wallets = noDuplicates(winsToInclude.map((x) => x.wallets))
      .flat()
      .map((x) => x.toLowerCase());

    if (!wallets.length) {
      console2.log('No wallets');
      return;
    }

    obj[handle] = wallets;

    /*
    data.push({
      name: handle,
      twitterHandle: handle,
      dateKey,
      mintDate,
      picked,
      startDate,
      wallets,
      wins: pw.wins,
    });
    */
  });

  /*
  data.sort(dynamicSortMultiple('-mintDate', '-picked'));
  console2.log('createProjectWins; data:', data);
  return data;
  */

  return obj;
}

// MISC HELPERS -----------------------------------------------------

/*
function maxOrNull(...args) {
  if (!args.length) {
    return null;
  }
  return Math.max(...args);
}
*/
