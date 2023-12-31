console.info('alphabotResults.js begin', window?.location?.href);

import './alphabotResults.scss';
import {
  trimWallet,
  accountToAlias,
  walletToAlias,
  sortWallets,
  createStatusbarButtons,
  checkIfSubscriptionEnabled,
  reloadOptions,
  STATUSBAR_DEFAULT_TEXT,
} from '../../js/premintHelperLib.js';

import { createObserver } from '../../js/observer';

import {
  winnersSortedByNewestURL,
  winnersSortedByMintingURL,
  fetchAccountAddress,
  makeRaffleURL,
  trimTeamName,
  trimPrice,
  trimText,
  trimTextNum,
} from '../../js/alphabotLib.js';

import {
  noDuplicatesByKey,
  sleep,
  dynamicSort,
  timestampToISOString,
  timestampToLocaleString,
  timestampToLocaleDateString,
  timestampToLocaleTimeString,
  millisecondsAhead,
  ONE_DAY,
  dynamicSortMultiple,
  extractTwitterHandle,
  makeTwitterURL,
  extractDiscordHandle,
  noDuplicates,
  addClassName,
  addTarget,
  textAsClass,
  kFormatter,
  isToday,
  createHashArgs,
  daysBetween,
  hoursBetween,
  minutesBetween,
  secondsBetween,
  pluralize,
  fetchHelper,
  rateLimitHandler,
  getStorageItems,
  setStorageData,
  removeStorageItem,
  myConsole,
} from 'hx-lib';
import { getPermissions } from '../../js/permissions';

import { createStatusbar } from 'hx-statusbar';

const console2 = myConsole();

// DATA ----------------------------------------------------------------------------

let storage;
let pageState = {
  statusbar: null,
};

const DEBUG_MODE = false;

const DEFAULT_LOCALE = undefined; // 'SV-se'; // string() | undefined
const SORT_ORDER_LOCALE = 'sv-SE';

// STARTUP ----------------------------------------------------------------------------

runNow();

async function runNow() {
  runPage();
}

async function runPage() {
  console2.log('runPage');

  storage = await getStorageItems(['options', 'alphabot', 'alphabotProjectWinners']);
  console2.log('storage:', storage);

  if (!storage?.options) {
    return console2.log('Options missing, exit!');
  }

  if (!storage?.alphabot) {
    console2.log('!storage.alphabot');
    storage.alphabot = {};
  }

  if (!storage?.alphabot.deleted) {
    storage.alphabot.deleted = {};
  }

  if (!storage?.alphabotProjectWinners) {
    storage.alphabotProjectWinners = [];
  }

  console2.log('storage after checks:', storage);

  const hashArgs = createHashArgs(window.location.hash);

  pageState = {
    hashArgs,
    twitterObserver: await createObserver({ autoFollowers: true }),
    statusbar: createStatusbar(STATUSBAR_DEFAULT_TEXT),
    permissions: await getPermissions(),
  };
  console2.info('PageState:', pageState);

  pageState.statusbar.buttons(
    createStatusbarButtons({
      options: true,
      results: 'disabled',
      reveal: 'disabled',
      followers: 'disabled',
    })
  );

  checkIfSubscriptionEnabled(pageState.permissions, false, pageState.statusbar.warn);

  document.getElementById('hx-update-cloud').addEventListener('click', () => updatePage({ cloud: true }));
  document.getElementById('hx-reset').addEventListener('click', () => resetWinners());

  if (pageState.hashArgs.has('action', 'update')) {
    return updatePage({ cloud: true });
  }

  await showPage();
}

// PAGE FUNCTIONS ---------------------------------------------------

async function updatePage({ cloud = false } = {}) {
  console2.log('updatePage; cloud:', cloud);

  await reloadOptions(storage);
  resetStatus();
  resetPage();

  const accountName = await getAccountName();
  if (!accountName) {
    updateStatus(`Failed getting Alphabot Account address. Make sure you are logged in to Alphabot.`);
    showPage();
    return;
  }
  console2.log('accountName:', accountName);

  if (!(await updateMyWinners(accountName))) {
    return;
  }
  if (cloud && !(await updateCloudWinners())) {
    return;
  }

  const allWinners = getAllWinners();

  const projectWinners = await createProjectWinners(allWinners);

  const oldData = JSON.stringify(storage.alphabotProjectWinners);
  const newData = JSON.stringify(projectWinners);

  if (oldData !== newData) {
    console2.log('projectWinners is new');
    storage.alphabotProjectWinners = projectWinners;
    await setStorageData({ alphabotProjectWinners: projectWinners });
  } else {
    console2.log('projectWinners is old');
  }

  showPage();
}

function getAllWinners() {
  const myWinners = storage.alphabot.myWinners || [];
  const cloudWinners = storage.alphabot.cloudWinners || [];
  return [...myWinners, ...cloudWinners].sort(dynamicSortMultiple('-dateKey', 'twitterHandle'));
}

async function showPage() {
  console2.log('showPage:');

  const allWinners = getAllWinners();
  console2.log('allWinners:', allWinners);

  const nowDate = new Date();

  if (storage.alphabot.myWinnersLastUpdateTime) {
    const timeText1 = timestampToLocaleString(storage.alphabot.myWinnersLastUpdateTime, '-', DEFAULT_LOCALE);
    const days1 = daysBetween(storage.alphabot.myWinnersLastUpdateTime, nowDate);
    const hours1 = hoursBetween(storage.alphabot.myWinnersLastUpdateTime, nowDate);
    const minutes1 = minutesBetween(storage.alphabot.myWinnersLastUpdateTime, nowDate);
    const seconds1 = secondsBetween(storage.alphabot.myWinnersLastUpdateTime, nowDate);
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
    updateStatus(`Alphabot winners last fetched at ${timeText1} (<b>${agoText1}</b>)`);
  } else {
    updateStatus(`Alphabot winners never fetched`);
  }

  if (storage.options.CLOUD_MODE !== 'disabled') {
    const timeText2 = timestampToLocaleString(storage.alphabot.lastCloudFetchDate, '-', DEFAULT_LOCALE);

    const days2 = daysBetween(storage.alphabot.lastCloudFetchDate, nowDate);
    const hours2 = hoursBetween(storage.alphabot.lastCloudFetchDate, nowDate);
    const minutes2 = minutesBetween(storage.alphabot.lastCloudFetchDate, nowDate);
    const seconds2 = secondsBetween(storage.alphabot.lastCloudFetchDate, nowDate);
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

    if (storage.alphabot.lastCloudFetchDate) {
      updateStatus(`Cloud winners last fetched at ${timeText2} (<b>${agoText2}</b>)`);
    } else {
      updateStatus(`Cloud winners never fetched`);
    }
  }

  const projectWinners = await createProjectWinners(allWinners);
  console2.log('projectWinners', projectWinners);

  const minMintDate = millisecondsAhead(-storage.options.ALPHABOT_RESULTS_DAYS_TO_KEEP_MINTED_WINS * ONE_DAY);
  console2.log('minMintDate', minMintDate);

  const projectWinnersMin = projectWinners.filter((x) => isWinnerToShow(x, minMintDate));
  console2.log('projectWinnersMin', projectWinnersMin);

  createProjectsTable(projectWinnersMin, 'main-table');

  await updateTwitterFollowers();
}

async function resetPage() {
  console2.log('resetPage');
  document.getElementById('main-table').replaceChildren();
}

// UPDATE FUNCS -----------------------------------------------------

async function updateMyWinners(accountName) {
  updateStatus(`Update Alphabot winners...`);

  pageState.alphabotPage = 0;

  const oldWinners = storage.alphabot.myWinners || [];
  console2.log('oldWinners', oldWinners);

  const myWinnersLastPickedDate = storage.alphabot.myWinnersLastPickedDate || null;

  const now = Date.now();

  const alphabotWinners = await getWinnersFromAlphabot(accountName, myWinnersLastPickedDate);
  console2.log('alphabotWinners', alphabotWinners);
  if (alphabotWinners.error) {
    updateStatus(`Error: ${alphabotWinners.msg}`);
    return false;
  }

  alphabotWinners.forEach((win) => {
    if (!oldWinners.find((x) => x.hxId === win.hxId)) {
      console2.log('New winner from alphabot:', win);
      win.fetchedNew = now;
    }
  });

  const lastPickedDate = Math.max(...alphabotWinners.map((x) => x.picked));
  storage.alphabot.myWinnersLastPickedDate = lastPickedDate;
  storage.alphabot.myWinnersLastUpdateTime = now;

  const validWinners = filterValidWinners(alphabotWinners, oldWinners, now);
  console2.log('validWinners', validWinners);
  console2.log(
    'validWinners',
    validWinners.map((x) => x.name)
  );

  const newMyWinners = noDuplicatesByKey([...validWinners, ...oldWinners], 'id').sort(
    dynamicSort('-hxSortKey')
  );
  console2.log('newMyWinners', newMyWinners);

  storage.alphabot.myWinners = newMyWinners;

  await setStorageData(storage);
  console2.log('storage', storage);

  const updatedWinners = newMyWinners.filter((x) => x.hxUpdated >= now);
  console2.log('updatedWinners', updatedWinners);

  updateStatus(`Fetched ${updatedWinners.length} new or updated winners from Alphabot`);

  if (storage.options.CLOUD_MODE === 'save') {
    // If cloud has no winners DB has likely been cleared and we need to upload all winners!
    const winnersToUpload =
      (await countWinners(accountName)) > 0 ? updatedWinners : storage.alphabot.myWinners;
    console2.log('winnersToUpload', winnersToUpload);
    const cloudResult = await saveWinnersToCloud(winnersToUpload);
    console2.log('cloudResult', cloudResult);
    if (cloudResult.error) {
      updateStatus(`Error: ${cloudResult.msg}`);
    } else {
      updateStatus(`Uploaded ${cloudResult.numSaved} wins to cloud`);
    }
  }

  return true;
}

async function updateCloudWinners() {
  if (storage.options.CLOUD_MODE !== 'load') {
    return true;
  }

  updateStatus(`Update Cloud winners...`);

  const now = Date.now();

  const cloudWinners = await fetchWinnersFromCloud();
  if (cloudWinners.error) {
    updateStatus(`Error: ${cloudWinners.msg}`);
    return false;
  }

  storage.alphabot.cloudWinners = storage.alphabot.cloudWinners || [];

  cloudWinners.forEach((win) => {
    if (!storage.alphabot.cloudWinners.find((x) => x.hxId === win.hxId)) {
      console2.log('New winner from cloud:', win);
      win.fetchedNew = now;
    }
  });

  const numOldWinners = storage.alphabot.cloudWinners.length;
  const numFetchedWinners = cloudWinners.length;
  const allWinners = noDuplicatesByKey([...cloudWinners, ...storage.alphabot.cloudWinners], 'hxId');
  const numNewWinners = allWinners.length - numOldWinners;

  console2.log(
    'numOldWinners, numFetchedWinners, numNewWinners:',
    numOldWinners,
    numFetchedWinners,
    numNewWinners
  );

  updateStatus(`Fetched ${numNewWinners} new or updated winners from Cloud`);

  storage.alphabot.lastCloudFetchDate = now;
  storage.alphabot.cloudWinners = allWinners;

  await setStorageData(storage);
  console2.log('storage', storage);

  return true;
}

// WINNERS FUNCS -----------------------------------------------------

async function getWinnersFromAlphabot(accountName, lastPickedDate) {
  console2.log(
    'getMyWinners; accountName, lastPickedDate:',
    accountName,
    timestampToLocaleString(new Date(lastPickedDate))
  );

  if (DEBUG_MODE && storage.alphabot.myWinnersCache) {
    console2.log('return storage.alphabot.myWinnersCache');
    return storage.alphabot.myWinnersCache;
  }

  const winnersByNewest = await fetchMyWinnersSortedByNewest(lastPickedDate);
  if (winnersByNewest.error) {
    console2.error(winnersByNewest.error);
    return {
      error: winnersByNewest.error,
      msg: 'Failed getting raffle wins from Alphabot website. Try again later.',
    };
  }
  console2.log('winnersByNewest', winnersByNewest);

  const winnersByMinting = await fetchMyWinnersSortedByMinting();
  if (winnersByMinting.error) {
    console2.error(winnersByMinting.error);
    return {
      error: winnersByMinting.error,
      msg: 'Failed getting raffle wins from Alphabot website. Try again later.',
    };
  }
  console2.log('winnersByMinting', winnersByMinting);

  const allWinners = convertWinners(accountName, [...winnersByNewest, ...winnersByMinting]);
  console2.log('allWinners', allWinners);

  const winners = noDuplicatesByKey(allWinners, 'id').sort(dynamicSort('-hxSortKey'));
  console2.log('winners', winners);

  if (DEBUG_MODE && storage.alphabot.myWinnersCache) {
    storage.alphabot.myWinnersCache = winners;
    await setStorageData(storage);
  }

  return winners;
}

async function resetWinners() {
  if (!window.confirm('Do you want to reset Alphabot results?')) {
    console2.log('no');
    return;
  }

  storage.alphabot = {};
  storage.alphabotProjectWinners = [];

  removeStorageItem('alphabotSiteRaffles');
  removeStorageItem('alphabotLastAccount');
  removeStorageItem('alphabotLastAccountName');
  removeStorageItem('alphabotLastFetchedEndDate');
  removeStorageItem('alphabotLastSiteUpdate');
  removeStorageItem('alphabotLastCloudUpdate');
  removeStorageItem('alphabotCloudAccounts');
  removeStorageItem('alphabotCloudRaffles');

  await setStorageData(storage);
  console2.log('storage', storage);

  resetStatus();
  resetPage();
  updateStatus('Alphabot raffle results reset');
  showPage();
}

function isWinnerDeleted(winner) {
  if (!storage.alphabot.deleted) {
    storage.alphabot.deleted = {};
  }
  const isDeleted = !!storage.alphabot.deleted[winner.id];
  return isDeleted;
}

function filterValidWinners(winners, oldWinners, updateDate) {
  console2.log('filterValidWinners; winners', winners);
  const minMintDate = millisecondsAhead(-storage.options.ALPHABOT_RESULTS_DAYS_TO_KEEP_MINTED_WINS * ONE_DAY);
  // const filteredWinners = winners.filter((x) => !x.mintDate || x.mintDate >= minMintDate).filter((x) => !isWinnerDeleted(x));
  const filteredWinners = winners
    .filter((x) => isWinnerToShow(x, minMintDate))
    .filter((x) => !isWinnerDeleted(x));

  console2.log(
    'filterValidWinners; minMintDate::',
    timestampToLocaleString(minMintDate, null, DEFAULT_LOCALE),
    winners.length,
    filteredWinners.length
  );

  filteredWinners.forEach((item) => {
    const dupItem = oldWinners.find((x) => x.id === item.id);
    if (dupItem && dupItem.mintDate !== item.mintDate) {
      item.hxUpdated = updateDate;
    } else if (!dupItem) {
      item.hxUpdated = updateDate;
    }
  });

  return filteredWinners;
}

function isWinnerToShow(project, minMintDate) {
  console2.log('isWinnerToShow', project.name, project, minMintDate);
  if (!project) {
    console2.log('!project');
    return false;
  }
  if (!project.mintDate) {
    // no mint date set -> include in result set!
    console2.log('!project.mintDate');
    return true;
  }
  if (project.mintDate >= minMintDate) {
    console2.log('project.mintDate >= minMintDate');
    return true;
  }
  if (project.startDate && project.mintDate && project.startDate >= project.mintDate) {
    console2.log('already minted but new raffle');
    // already minted but new raffle, probably restarted drop -> include in result set!
    return true;
  }
  console2.log('do not show winner');
  return false;
}

async function createProjectWinners(winners) {
  const twitterHandles = noDuplicates(
    winners
      .map((x) => x.twitterHandle)
      .filter((x) => !!x)
      .sort()
  );
  console2.log('twitterHandles', twitterHandles);

  const data = [];
  twitterHandles.forEach((handle) => {
    const subWinners = winners.filter((x) => x.twitterHandle === handle);
    const dateKey = maxOrNull(...subWinners.map((x) => x.hxSortKey).filter((x) => x));
    const startDate = maxOrNull(...subWinners.map((x) => x.startDate).filter((x) => x));
    const mintDate = maxOrNull(...subWinners.map((x) => x.mintDate).filter((x) => x));
    const picked = maxOrNull(...subWinners.map((x) => x.picked).filter((x) => x));
    const wallets = noDuplicates(subWinners.map((x) => x.wallet.toLowerCase()));
    data.push({
      name: handle,
      twitterHandle: handle,
      dateKey,
      mintDate,
      picked,
      startDate,
      wallets,
      winners: subWinners,
    });
  });

  winners
    .filter((x) => x.twitterHandle === '')
    .forEach((winner) => {
      const subWinners = [winner];
      const dateKey = winner.hxSortKey;
      const wallets = [winner.wallet.toLowerCase()];
      data.push({
        name: '',
        twitterHandle: '',
        dateKey,
        mintDate: winner.mintDate,
        picked: winner.picked,
        wallets,
        winners: subWinners,
      });
    });

  data.sort(dynamicSortMultiple('-mintDate', '-picked'));
  console2.log('data:', data);

  const pivotTodayStr = new Date().toLocaleDateString(SORT_ORDER_LOCALE);
  const pivotTodayDate = new Date(pivotTodayStr);
  console2.log('pivotTodayStr, pivotTodayDate:', pivotTodayStr, pivotTodayDate);

  const pivotTomorrowStr = new Date(millisecondsAhead(1 * ONE_DAY)).toLocaleDateString(SORT_ORDER_LOCALE);
  const pivotTomorrowDate = new Date(pivotTomorrowStr);
  console2.log('pivotTomorrowStr, pivotTomorrowStr:', pivotTomorrowStr, pivotTomorrowDate);

  const pivotYesterdayStr = new Date(millisecondsAhead(-1 * ONE_DAY)).toLocaleDateString(SORT_ORDER_LOCALE);
  const pivotYesterdayDate = new Date(pivotYesterdayStr);
  console2.log('pivotYesterdayStr, pivotYesterdayDate:', pivotYesterdayStr, pivotYesterdayDate);

  if (!data.length) {
    return [];
  }

  for (let i = data.length - 1; i--; i >= 0) {
    const item = data[i];
    // console2.trace('item:', new Date(item.mintDate), pivotTomorrowDate, item.mintDate >= pivotTomorrowDate, item);

    if (!item.mintDate) {
      continue;
    }
    const itemDateStr = new Date(item.mintDate).toLocaleDateString(SORT_ORDER_LOCALE);

    if (itemDateStr >= pivotTomorrowStr) {
      item.isTomorrowish = true;
      console2.log('isTomorrowish:', item);
      break;
    }
    if (itemDateStr < pivotTodayStr && itemDateStr >= pivotYesterdayStr) {
      item.isYesterdayish = true;
      console2.log('isYesterdayish:', item);
    }
  }

  return data;
}

function convertWinners(accountName, winners) {
  return winners.map((x) => {
    return {
      hxId: `${accountName}-${x._id}`,
      hxSortKey: x.mintDate || x.picked,
      hxUpdated: x.hxUpdated || null,
      hxAccount: accountName,
      id: x._id,
      name: x.name,
      slug: x.slug,
      updated: x.updated,
      picked: x.picked,
      startDate: x.startDate,
      endDate: x.endDate,
      mintDate: x.mintDate,
      mintDateHasTime: x.mintDateHasTime,
      twitterHandle: extractTwitterHandle(x.twitterUrl),
      discordUrl: x.discordUrl,
      wallet: x.entry.mintAddress,
      teamName: x.alphaTeam.name,
      teamId: x.teamId,
      blockchain: x.blockchain,
      dtc: x.dtc,
      entryCount: x.entryCount,
      winnerCount: x.winnerCount,
      supply: x.supply,
      pubPrice: x.pubPrice,
      wlPrice: x.wlPrice,
      dataId: x.dataId,
      type: x.type,
    };
  });
}

// FETCH MY WINNERS -----------------------------------------------------

async function fetchMyWinnersSortedByNewest(lastPickedDate) {
  const minPickedDate =
    lastPickedDate ||
    millisecondsAhead(-storage.options.ALPHABOT_RESULTS_FETCH_MINE_PICKED_LAST_DAYS * ONE_DAY);

  console2.log(
    'fetchMyWinnersSortedByNewest; lastPickedDate, minPickedDate:',
    lastPickedDate,
    timestampToISOString(minPickedDate)
  );

  const checkIfContinue = (result) => {
    updateStatus(`Update Alphabot winners... (page ${pageState.alphabotPage})`, true);
    console2.log('result', result);
    if (!result?.data?.length) {
      console2.log('no data, stop');
      return false;
    }
    if (!minPickedDate) {
      console2.log('continue');
      return true;
    }
    const thisPickedDate = result.data[result.data.length - 1].picked;

    if (thisPickedDate < minPickedDate) {
      console2.log('stop');
      return false;
    }
    console2.log('continue');
    return true;
  };

  const baseUrl = winnersSortedByNewestURL;
  return fetchMyWinners(baseUrl, checkIfContinue);
}

async function fetchMyWinnersSortedByMinting() {
  console2.log('fetchMyWinnersSortedByMinting');

  const baseUrl = winnersSortedByMintingURL;
  return fetchMyWinners(baseUrl);
}

async function fetchMyWinners(baseUrl, checkIfContinueFn = null) {
  console2.log('fetchMyWinners; baseUrl:', baseUrl);

  const projects = [];
  let pageNum = 0;

  while (pageNum >= 0) {
    console2.log(`Get results from Alphabot website (page ${pageNum + 1})`);
    pageState.alphabotPage++;
    updateStatus(`Update Alphabot winners... (page ${pageState.alphabotPage})`, true);

    const url = `${baseUrl}&pageNum=${pageNum}`;
    console2.log('url', url);

    const result = await fetchHelper(url, { method: 'GET' }, rateLimitHandler);
    console2.log('result', result);

    if (result?.ok && !result.data?.length) {
      return projects;
    }

    if (result.error) {
      return { error: result.error, result };
    }

    projects.push(...result.data);
    pageNum++;

    if (checkIfContinueFn && !checkIfContinueFn(result)) {
      console2.log('checkIfContinueFn() says to stop');
      break;
    }

    console2.info(`Sleep ${storage.options.ALPHABOT_FETCH_RESULTS_DELAY} ms before next fetch`);
    await sleep(storage.options.ALPHABOT_FETCH_RESULTS_DELAY);
  }

  return projects;
}

// CLOUD FUNCS -----------------------------------------------------

async function saveWinnersToCloud(winners) {
  if (!winners?.length) {
    console2.log('No new winners');
    return { ok: true, numSaved: 0 };
  }

  if (!storage.options.CLOUD_SAVE_URL) {
    return { error: true, msg: 'Save to cloud URL property missing in Options' };
  }

  if (!storage.options.CLOUD_TAG) {
    return { error: true, msg: 'Cloud Tag property missing in Options' };
  }

  winners.forEach((winner) => (winner.hxTag = storage.options.CLOUD_TAG));
  console2.log('winners', winners);

  const result = await fetchHelper(storage.options.CLOUD_SAVE_URL, {
    method: 'POST',
    body: JSON.stringify({
      winners,
    }),
  });
  console2.log('result:', result);

  if (result.error || !result.data) {
    console2.error(result);
    return { error: true, msg: result.msg || 'Invalid data returned when saving to cloud' };
  }

  const data = JSON.parse(result.data);
  console2.log('data:', data);

  if (!data.ok) {
    console2.error(data.msg);
    return { error: true, msg: `Invalid response when saving to cloud: ${data.msg}` };
  }

  return { ...data };
}

async function fetchWinnersFromCloud() {
  console2.log('fetchWinnersFromCloud; mode:', storage.options.CLOUD_MODE);

  if (!storage.options.CLOUD_LOAD_URL) {
    return { error: true, msg: 'Load from cloud URL property missing in Options' };
  }

  if (!storage.options.CLOUD_TAG) {
    return { error: true, msg: 'Cloud Tag property missing in Options' };
  }

  const lastUpdated = storage.alphabot.lastCloudFetchDate || 0;

  const result = await fetchHelper(storage.options.CLOUD_LOAD_URL, {
    method: 'POST',
    body: JSON.stringify({
      hxTag: storage.options.CLOUD_TAG,
      lastUpdated,
    }),
  });

  console2.log('result:', result);

  if (result.error) {
    console2.error(result);
    return { error: true, msg: result.msg || 'Invalid data returned when loading from cloud' };
  }

  return result.data;
}

async function countWinners(account) {
  const result = await fetchCountWinners(account);
  if (!result.ok) {
    console2.error('Failed getting winner count from cloud. Error:', result);
  }
  return result.ok ? result.count : -1;
}

async function fetchCountWinners(account) {
  console2.log('fetchCountWinners; account:', account);

  if (!storage.options.CLOUD_HAS_URL) {
    return { error: true, msg: 'CLOUD_HAS_URL property missing in Options' };
  }

  if (!storage.options.CLOUD_TAG) {
    return { error: true, msg: 'Cloud Tag property missing in Options' };
  }

  const result = await fetchHelper(storage.options.CLOUD_HAS_URL, {
    method: 'POST',
    body: JSON.stringify({
      hxAccount: account,
      hxTag: storage.options.CLOUD_TAG,
    }),
  });

  console2.log('result:', result);

  if (result.error) {
    console2.error(result);
    return { error: true, msg: result.msg || 'Invalid data returned from cloud' };
  }

  return { ok: true, count: result.data.count };
}

// MISC GETTERS -----------------------------------------------------

async function getAccountName() {
  return await fetchAccountAddress();
}

// TABLE FUNCS -----------------------------------------------------

function createLink(url, text, { dataset, target, className } = {}) {
  const elem = document.createElement('A');
  elem.href = url;
  elem.target = target || undefined;
  addTarget(elem, target);
  addClassName(elem, className);
  elem.innerText = text.trim();
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
    elem.appendChild(createLink(thisUrl, thisText, { target, className: thisClass }));
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

function createMultiTexts(texts, { className, useTextAsClass, hideDups = true } = {}) {
  const elem = document.createElement('SPAN');
  elem.style.whiteSpace = 'nowrap';
  let isFirst = true;
  let lastText = null;
  for (const text of texts) {
    if (!isFirst) {
      elem.appendChild(document.createElement('BR'));
    }
    let newElem = document.createElement('SPAN');
    if (hideDups && text === lastText) {
      newElem.innerText = ' ';
    } else {
      newElem.innerText = text;
      lastText = text;
    }
    addClassName(newElem, className);
    addClassName(newElem, isFirst ? 'first' : null);
    addClassName(newElem, useTextAsClass ? textAsClass(text) : null);
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

function createTableHeaderRow() {
  const head = document.createElement('THEAD');
  const row = document.createElement('TR');
  row.appendChild(
    createCell(
      '#',
      'Num unique wallets that won (in all raffles connected to projects with given Twitter handle)'
    )
  );
  row.appendChild(createCell('Name'));
  row.appendChild(
    createCell(
      'DTC',
      'Wallet added Direct To Contract? This is set by Alphabot project, and can hardly be fully trusted, so do your own research!'
    )
  );
  row.appendChild(createCell('Twitter'));
  row.appendChild(createCell('Mint Date'));
  row.appendChild(createCell('Time'));
  row.appendChild(createCell('Raffle Date'));
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

function createProjectsTable(projects, mountOnElementId) {
  const table = document.createElement('TABLE');

  table.appendChild(createTableHeaderRow());

  for (const p of projects) {
    console2.trace('project', p);

    const row = document.createElement('TR');
    if (p.mintDate && isToday(new Date(p.mintDate))) {
      row.classList.toggle('is-today', true);
    }
    if (p.isTomorrowish) {
      row.classList.toggle('is-tomorrowish', true);
    }
    if (p.isYesterdayish) {
      row.classList.toggle('is-yesterdayish', true);
    }

    row.appendChild(createCell(p.wallets.length.toString()));

    const raffleLinks = p.winners.map((x) => {
      const isNew =
        x.fetchedNew &&
        (x.fetchedNew === storage.alphabot.lastCloudFetchDate ||
          x.fetchedNew === storage.alphabot.myWinnersLastUpdateTime);
      const isUpdated =
        x.hxUpdated &&
        (x.hxUpdated >= storage.alphabot.lastCloudFetchDate ||
          x.hxUpdated >= storage.alphabot.myWinnersLastUpdateTime);
      return { url: makeRaffleURL(x.slug), text: x.name, isNew, isUpdated };
    });
    row.appendChild(
      createCell(createMultiLinks(raffleLinks, { className: 'raffle-link', target: '_blank' }))
    );

    const dtcTexts = p.winners.map((x) => `${typeof x.dtc === 'undefined' ? ' ' : x.dtc ? 'Yes' : 'No'}`);
    row.appendChild(createCell(createMultiTexts(dtcTexts, { className: 'dtc', useTextAsClass: true })));

    const twitterHandle = pageState.permissions?.enabled ? p.twitterHandle : 'hidden';
    row.appendChild(
      createCell(
        createLink(makeTwitterURL(twitterHandle), twitterHandle, {
          dataset: [{ key: 'username', val: p.twitterHandle }],
          className: 'twitter-link',
          target: '_blank',
        })
      )
    );

    const mintDates = p.winners.map((x) => {
      return { date: x.mintDate, hasTime: false };
    });
    row.appendChild(createCell(createMultiDates(mintDates, '', { className: 'mint-date' })));

    const mintTimes = p.winners.map((x) => {
      return { date: x.mintDateHasTime ? x.mintDate : null };
    });
    row.appendChild(createCell(createMultiDates(mintTimes, '', { className: 'mint-time', timeOnly: true })));

    const raffleDates = p.winners.map((x) => {
      return { date: x.picked, hasTime: false };
    });
    row.appendChild(createCell(createMultiDates(raffleDates, '', { className: 'raffle-date' })));

    row.appendChild(
      createCell(
        createMultiTexts(
          p.winners.map((x) => trimPrice(x.wlPrice)),
          { className: 'wl-price' }
        )
      )
    );

    row.appendChild(
      createCell(
        createMultiTexts(
          p.winners.map((x) => trimPrice(x.pubPrice)),
          { className: 'pub-price' }
        )
      )
    );

    row.appendChild(
      createCell(
        createMultiTexts(
          p.winners.map((x) => trimText(x.supply, 8)),
          { className: 'wl-supply' }
        )
      )
    );

    row.appendChild(
      createCell(
        createMultiTexts(
          p.winners.map((x) => trimText(x.blockchain, 6)),
          { className: 'blockchain' }
        )
      )
    );

    row.appendChild(
      createCell(
        createMultiTexts(
          p.winners.map((x) => trimTextNum(x.winnerCount, 6)),
          { className: 'winner-count' }
        )
      )
    );

    row.appendChild(
      createCell(
        createMultiTexts(
          p.winners.map((x) => trimTextNum(x.entryCount, 6)),
          { className: 'entry-count' }
        )
      )
    );

    const sortedWallets = sortWallets(
      p.winners.map((x) => x.wallet),
      storage.options
    );
    const wallets = noDuplicates(
      sortedWallets.map((addr) => {
        const walletAlias = walletToAlias(addr, storage.options);
        const suffix = walletAlias; // ? ` (${walletAlias})` : '';
        return { addr: trimWallet(addr.toLowerCase()), alias: suffix };
      })
    );

    // row.appendChild(createCell(createMultiTexts(wallets, { className: 'mint-address' })));
    row.appendChild(
      createCell(
        createMultiTexts(
          wallets.map((x) => x.addr),
          { className: 'mint-address' }
        )
      )
    );
    row.appendChild(
      createCell(
        createMultiTexts(
          wallets.map((x) => x.alias),
          { className: 'mint-aliases' }
        )
      )
    );

    const accountAddresses = noDuplicates(
      p.winners.map((x) => accountToAlias(x.hxAccount, storage.options) || trimWallet(x.hxAccount))
    );

    row.appendChild(createCell(createMultiTexts(accountAddresses, { className: 'account-name' })));

    const teamNames = p.winners.map((x) => trimTeamName(x.teamName));
    const teamNamesEnabled = pageState.permissions?.enabled
      ? teamNames
      : Array(teamNames.length).fill('hidden');
    row.appendChild(createCell(createMultiTexts(teamNamesEnabled, { className: 'team-name' })));

    const discordUrls = p.winners.filter((x) => x.discordUrl);
    const discordUrl = discordUrls.length ? discordUrls[0].discordUrl : null;
    const discordUrlEnabled = pageState.permissions?.enabled ? discordUrl : 'https://discord.gg/hidden';
    row.appendChild(
      createCell(
        createLink(discordUrlEnabled, extractDiscordHandle(discordUrlEnabled), {
          className: 'discord-link',
          target: '_blank',
        })
      )
    );

    table.appendChild(row);
  }

  document.getElementById(mountOnElementId).append(table);
}

// STATUS FUNCS -----------------------------------------------------

function resetStatus() {
  document.getElementById('hx-status').replaceChildren();
}

function updateStatus(html, reuseLast = false) {
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

// TWITTER HELPERS -----------------------------------------------------

async function getTwitterFollowerCount(username) {
  return (await getTwitterObserver()).getTwitter(username, 999);
}

async function getTwitterObserver() {
  if (!pageState.twitterObserver) {
    pageState.twitterObserver = await createObserver({ autoFollowers: true });
  }
  return pageState.twitterObserver;
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

// MISC HELPERS -----------------------------------------------------

function maxOrNull(...args) {
  if (!args.length) {
    return null;
  }
  return Math.max(...args);
}
