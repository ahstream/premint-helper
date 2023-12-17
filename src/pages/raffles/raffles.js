console.info('raffles.js begin', window?.location?.href);

import './raffles.scss';

import {
  createStatusbarButtons,
  getMyTabIdFromExtension,
  loadStorage,
  reloadOptions,
  updateMainStatus,
  updateMidStatus,
  updateSubStatus,
  resetSubStatus,
  STATUSBAR_DEFAULT_TEXT,
  normalizeTwitterHandle,
} from '../../js/premintHelperLib.js';

import {
  createHashArgs,
  myConsole,
  toObjArray,
  dynamicSort,
  setStorageData,
  addClassName,
  textAsClass,
  round,
  addTarget,
  timestampToLocaleString,
  timestampToLocaleDateString,
  timestampToLocaleTimeString,
  minutesBetween,
  hoursBetween,
  daysBetween,
  secondsBetween,
  makeTwitterURL,
  pluralize,
  sleep,
  noDuplicates,
  ONE_DAY,
} from 'hx-lib';

import { getPermissions } from '../../js/permissions.js';

import {
  getRaffles as getLuckygoRaffles,
  getAuth as getLuckygoAuth,
  getRaffle as getLuckygoRaffle,
} from '../../js/luckygoLib.js';

import { getRaffles as getAlphabotRaffles } from '../../js/alphabotLib.js';

import { getRaffles as getSuperfulRaffles, getAuth as getSuperfulAuth } from '../../js/superfulLib.js';

import { createStatusbar } from 'hx-statusbar';

import { createObserver as createTwitterObserver } from '../../js/twitterObserver.js';
import { createObserver } from '../../js/observerGeneric.js';

const console2 = myConsole();

const jht = require('json-html-table');

// DATA ------------------------------

let storage = {};
let pageState = {
  shownRaffles: {},
};

const SHORTENED_TEXT_SUFFIX = '...';
const MAX_LEN_RAFFLE_NAME = 44;
const MAX_LEN_TEAM_NAME = 14;
const MAX_LEN_TWITTER_HANDLE = 16;

const DEFAULT_LOCALE = 'SV-se'; // undefined; // 'SV-se'; // string() | undefined
const SORT_ORDER_LOCALE = 'sv-SE';

const SLEEP_RAFFLE_LIST_LUCKYGO_RAFFLE_MAP_FETCH = 500;
const SLEEP_RAFFLE_LIST_QUERY_FETCH = 300;

const MINUTES_FOR_ALL_OPTION = 100000;

const statusLogger = { main: updateMainStatus, mid: updateMidStatus, sub: updateSubStatus };

// STARTUP ------------------------------

runNow();

async function runNow() {
  runPage();
}

async function runPage() {
  console2.log('runPage');

  const statusbar = createStatusbar(STATUSBAR_DEFAULT_TEXT, {
    buttons: createStatusbarButtons({
      options: true,
      results: 'disabled',
      reveal: 'disabled',
      followers: 'disabled',
    }),
  });
  const hashArgs = createHashArgs(window.location.hash);
  const permissions = await getPermissions();
  const twitterObserver = await createTwitterObserver({ permissions });
  const observer = await createObserver({ permissions, autoFollowers: false });

  storage = await loadStorage({}, null, [], [{ key: 'raffles', val: {} }]);
  console.log('storage', storage);

  initEventHandlers(pageState);

  pageState = {
    ...pageState,
    hashArgs,
    statusbar,
    permissions,
    twitterObserver,
    observer,
  };
  console2.info('PageState:', pageState);

  chrome.runtime.sendMessage({ cmd: 'cleanupInternalWebPages' });

  statusLogger.main('');
  statusLogger.mid('');
  resetSubStatus();

  document.getElementById('hx-update').addEventListener('click', () => updateRaffles());

  creteFiltersHTML();

  if (pageState.hashArgs.has('action', 'update')) {
    return updateRaffles();
  }

  showPage();
}

async function initEventHandlers() {
  console2.info('Init event handlers');

  chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    console2.info('Received message:', request, sender);

    if (request.cmd === 'getAuth') {
      console.log('Received getAuth');
      pageState[`${request.cmd}`] = true;
      pageState[`${request.cmd}Val`] = request.val;
      console.log('pageState', pageState);
    }

    if (request.cmd === 'getMyTabIdAsyncResponse') {
      pageState.myTabId = request.response;
    }

    sendResponse();
    return true;
  });
}

// SHOW PAGE -----------------------------------------------------

async function showPage() {
  console2.log('showPage');

  resetPage();
  statusLogger.main('Processing raffles...');
  await sleep(300);
  showLastUpdatedStatus();

  const skipDups = storage.options.RAFFLE_LIST_SKIP_DUPS;
  const skipSearchDups = skipDups && storage.options.RAFFLE_LIST_SKIP_SEARCH_DUPS;

  showRafflesTableForOne(
    'searchTop',
    'Search: Top',
    `${storage.options.RAFFLE_LIST_SEARCH_TOP.join(', ')}`,
    skipSearchDups
  );

  showRafflesTableForOne(
    'searchGreat',
    'Search: Great',
    `${storage.options.RAFFLE_LIST_SEARCH_GREAT.join(', ')}`,
    skipSearchDups
  );

  showRafflesTableForOne(
    'searchGood',
    'Search: Good',
    `${storage.options.RAFFLE_LIST_SEARCH_GOOD.join(', ')}`,
    skipSearchDups
  );

  showRafflesTableForOne(
    'searchEarly',
    'Search: Early',
    `${storage.options.RAFFLE_LIST_SEARCH_EARLY.join(', ')}`,
    skipSearchDups
  );

  updateAlphabotSelectedRaffles();
  showRafflesTableForOne('alphabotSelected', 'Selected Alphabot Raffles', '', skipDups);
  showRafflesTableForOne('alphabotMine', 'My Alphabot Raffles', '', skipDups);
  showRafflesTableForOne('alphabotAll', 'All Alphabot Raffles', '', skipDups);
  showRafflesTableForOne('luckygoMine', 'My LuckyGo Raffles', '', skipDups);
  showRafflesTableForOne('luckygoAll', 'All LuckyGo Raffles', '', skipDups);
  showRafflesTableForOne('superfulAll', 'All Superful Raffles', '', skipDups);
  showRafflesTableForOne('ignored', 'Ignored Raffles', '', skipDups, false);

  console2.log('Done showing raffles page!');
  statusLogger.main('');
}

function showRafflesTableForOne(key, header, subHeader, skipDups = false, useIgnored = true) {
  console.log('showRafflesTableForOne', key, header, subHeader);

  const now = Date.now();

  const baseRaffles = (storage.raffles[key] ? storage.raffles[key] : [])
    .filter((x) => x.endDate > now && !isRaffleToLongToShow(x))
    .filter((x) => (skipDups ? !pageState.shownRaffles[x.id] : true));
  console.log('baseRaffles', baseRaffles);

  if (!storage.raffles.ignored) {
    storage.raffles.ignored = [];
  }

  const ignoredRaffles = baseRaffles.filter(
    (x) => useIgnored && storage.raffles.ignoredMap && storage.raffles.ignoredMap[x.id]
  );
  ignoredRaffles.forEach((x) => {
    if (!storage.raffles.ignored.find((y) => x.id === y.id)) {
      storage.raffles.ignored.push(x);
    }
  });

  const raffles = baseRaffles.filter(
    (x) => !useIgnored || !storage.raffles.ignoredMap || !storage.raffles.ignoredMap[x.id]
  );

  if (skipDups) {
    raffles.forEach((x) => (pageState.shownRaffles[x.id] = true));
  }

  const filters = getFilters();
  console.log('filters', filters);

  const filteredRaffles = filterRaffles(raffles, filters);
  console.log('filteredRaffles', filteredRaffles);
  if (filters.text) {
    subHeader = subHeader + (subHeader ? '<br><br>' : '') + '<b>Filters:</b> ' + filters.text;
  }

  updateLuckygoTwitterHandles(filteredRaffles);

  const packedRaffles = processRaffles(filteredRaffles);
  console.log('packedRaffles', packedRaffles);

  packedRaffles?.forEach((i) => {
    i.endDate = i.raffles.length ? i.raffles[0].endDate : null;
  });

  appendRafflesTable(createRafflesTable(packedRaffles.sort(dynamicSort('endDate')), header, subHeader, key));
}

function resetPage() {
  document.getElementById('main-table').innerHTML = '';
  resetSubStatus();
  pageState.shownRaffles = {};
}

// UPDATE ------------------------------

async function updateRaffles() {
  console.log('updateRaffles');

  resetPage();
  await reloadOptions(storage);

  statusLogger.main(`Updating raffles...`);

  const skipDups = storage.options.RAFFLE_LIST_SKIP_DUPS;

  await getMyTabIdFromExtension(pageState, 5000);
  console.log('pageState', pageState);

  statusLogger.mid(`Getting LuckyGo authentication key...`);
  const authKeyLuckygo = await getLuckygoAuth(pageState);
  console.log('authKey', authKeyLuckygo);
  if (!authKeyLuckygo) {
    statusLogger.sub(`Failed getting LuckyGo authentication key. Check if logged in to website?`);
  }
  statusLogger.mid(``);

  statusLogger.mid(`Getting Superful authentication key...`);
  const authKeySuperful = await getSuperfulAuth(pageState);
  console.log('authKeySuperful', authKeySuperful);
  if (!authKeySuperful) {
    statusLogger.sub(`Failed getting Superful authentication key. Check if logged in to website?`);
  }
  statusLogger.mid(``);

  statusLogger.main(`Search raffles...`);
  await updateSearchRaffles(authKeyLuckygo, authKeySuperful);

  if (pageState.foo2) {
    return;
  }

  statusLogger.main(`Updating My Alphabot raffles...`);
  await updateMyAlphabotRaffles();
  statusLogger.sub(`Fetched ${storage.raffles.alphabotMine?.length || 0} Alphabot projects (My communities)`);
  statusLogger.mid(``);

  updateAlphabotSelectedRaffles();
  showRafflesTableForOne('alphabotSelected', 'Selected Alphabot Raffles', '', skipDups);
  showRafflesTableForOne('alphabotMine', 'My Alphabot Raffles', '', skipDups);

  statusLogger.main(`Updating All Alphabot raffles...`);
  await updateAllAlphabotRaffles();
  statusLogger.sub(`Fetched ${storage.raffles.alphabotAll?.length || 0} Alphabot projects (All communities)`);
  statusLogger.mid(``);
  showRafflesTableForOne('alphabotAll', 'All Alphabot Raffles', '', skipDups);

  statusLogger.main(`Updating My LuckyGo raffles...`);
  await updateMyLuckygoRaffles(authKeyLuckygo);
  statusLogger.sub(`Fetched ${storage.raffles.luckygoMine?.length || 0} LuckyGo projects (My communities)`);
  statusLogger.mid(``);
  showRafflesTableForOne('luckygoMine', 'My LuckyGo Raffles', '', skipDups);

  statusLogger.main(`Updating All LuckyGo raffles...`);
  await updateAllLuckygoRaffles(authKeyLuckygo);
  statusLogger.sub(`Fetched ${storage.raffles.luckygoAll?.length || 0} LuckyGo projects (All communities)`);
  statusLogger.mid(``);
  showRafflesTableForOne('luckygoAll', 'All LuckyGo Raffles', '', skipDups);

  statusLogger.main(`Updating All Superful raffles...`);
  await updateAllSuperfulRaffles(authKeySuperful);
  statusLogger.sub(`Fetched ${storage.raffles.superfulAll?.length || 0} Superful projects`);
  statusLogger.mid(``);
  showRafflesTableForOne('superfulAll', 'All Superful Raffles', '', skipDups);

  showRafflesTableForOne('ignored', 'Ignored Raffles', '', skipDups);

  storage.raffles.lastUpdate = Date.now();

  await setStorageData(storage);

  statusLogger.main('Done updating raffles!');
  statusLogger.mid('');
}

// SEARCH ------------------------------

async function updateSearchRaffles(authKeyLuckygo, authKeySuperful) {
  statusLogger.main(`Updating Search Query raffles...`);

  await updateSearchRafflesOne(
    'searchTop',
    'Search: Top Projects',
    storage.options.RAFFLE_LIST_SEARCH_TOP,
    authKeyLuckygo,
    authKeySuperful
  );

  await updateSearchRafflesOne(
    'searchGreat',
    'Search: Great Projects',
    storage.options.RAFFLE_LIST_SEARCH_GREAT,
    authKeyLuckygo,
    authKeySuperful
  );

  await updateSearchRafflesOne(
    'searchGood',
    'Search: Good Projects',
    storage.options.RAFFLE_LIST_SEARCH_GOOD,
    authKeyLuckygo,
    authKeySuperful
  );

  await updateSearchRafflesOne(
    'searchEarly',
    'Search: Early Projects',
    storage.options.RAFFLE_LIST_SEARCH_EARLY,
    authKeyLuckygo,
    authKeySuperful
  );
}

function addSearchQuery(query, raffles) {
  raffles.forEach((r) => (r.query = query));
}

async function updateSearchRafflesOne(key, header, query, authKeyLuckygo, authKeySuperful) {
  console.log('updateSearchRaffles:', key, header, query);

  const queries = noDuplicates(
    query
      .map((x) => x.split(','))
      .flat()
      .map((x) => x.trim())
  );
  console.log('queries', queries);

  const raffles = [];

  for (let i = 0; i < queries.length; i++) {
    const query = queries[i].trim();
    console.log('query', query);
    if (!query) {
      continue;
    }
    if (query.length < 2) {
      statusLogger.sub(`Invalid search query (need to be >= 2 characters):`, query);
      continue;
    }
    statusLogger.main(`Fetching raffles for ${key} search query ${i + 1} of ${queries.length}: ${query}`);

    const alphabotRaffles = await getAlphabotRaffles(null, {
      statusLogger,
      max: storage.options.RAFFLE_LIST_MAX_ITEMS,
      search: query,
    });
    addSearchQuery(query, alphabotRaffles);
    console.log('alphabotRaffles:', query, alphabotRaffles);
    raffles.push(...alphabotRaffles);

    const luckygoRaffles = !authKeyLuckygo
      ? []
      : await getLuckygoRaffles(authKeyLuckygo, {
          statusLogger,
          max: storage.options.RAFFLE_LIST_MAX_ITEMS,
          key_words: query,
        });
    addSearchQuery(query, luckygoRaffles);
    console.log('luckygoRaffles:', query, luckygoRaffles);
    raffles.push(...luckygoRaffles);

    const superfulRaffles = !authKeySuperful
      ? []
      : await getSuperfulRaffles(authKeySuperful, {
          statusLogger,
          max: storage.options.RAFFLE_LIST_MAX_ITEMS,
          search_text: query,
        });
    addSearchQuery(query, superfulRaffles);
    console.log('superfulRaffles:', query, superfulRaffles);
    raffles.push(...superfulRaffles);

    await sleep(SLEEP_RAFFLE_LIST_QUERY_FETCH);
  }

  for (let r of raffles) {
    await updateLuckygoRaffleMap(r);
  }

  storage.raffles[key] = raffles;

  await setStorageData(storage);

  statusLogger.sub(`Fetched ${storage.raffles[key].length || 0} projects (${header})`);
  statusLogger.mid(``);
  showRafflesTableForOne(
    key,
    header,
    `${queries.join(', ')}`,
    storage.options.RAFFLE_LIST_SKIP_DUPS && storage.options.RAFFLE_LIST_SKIP_SEARCH_DUPS
  );
}

// ALPHABOT ------------------------------

async function updateAllAlphabotRaffles() {
  await updateAlphabotRaffles('alphabotAll', null);
}

async function updateMyAlphabotRaffles() {
  await updateAlphabotRaffles('alphabotMine', null, { scope: 'community' });
}

async function updateAlphabotRaffles(key, authKey, options = {}) {
  console.log('updateAlphabotRaffles', key, authKey, options);
  const r1 = await getAlphabotRaffles(authKey, {
    statusLogger,
    max: storage.options.RAFFLE_LIST_MAX_ITEMS,
    ...options,
  });
  console.log('r1', r1);
  const r2 = processRaffles(r1 || []);
  console.log('r2', r2);
  //storage.raffles[key] = r2;
  storage.raffles[key] = r1;
}

async function updateAlphabotSelectedRaffles() {
  console.log('updateAlphabotSelectedRaffles');

  const myTeams = noDuplicates(
    storage.options.RAFFLE_LIST_MY_TEAMS.map((x) => x.split(','))
      .flat()
      .map((x) => x.trim())
      .map((x) => x.toLowerCase())
  );
  //console.log('myTeams', myTeams);

  const raffles = [];
  storage.raffles?.alphabotMine?.forEach((raffle) => {
    //console.log('raffle', raffle);
    const teamName = raffle.teamName?.toLowerCase ? raffle.teamName.toLowerCase() : '';
    //console.log('teamName', teamName);
    if (myTeams.includes(teamName)) {
      raffles.push({ ...raffle });
    }
  });
  //storage.raffles.alphabotSelected = processRaffles(raffles);
  storage.raffles.alphabotSelected = raffles;
}

// LUCKYGO ------------------------------

async function updateAllLuckygoRaffles(authKey) {
  await updateLuckygoRaffles('luckygoAll', authKey);
}

async function updateMyLuckygoRaffles(authKey) {
  await updateLuckygoRaffles('luckygoMine', authKey, { community_type: 'My' });
}

async function updateLuckygoRaffles(key, authKey, options = {}) {
  if (!authKey) {
    storage.raffles[key] = [];
    return;
  }
  console.log('updateLuckygoRaffles', key, authKey, options);
  const r1 = await getLuckygoRaffles(authKey, {
    statusLogger,
    max: storage.options.RAFFLE_LIST_MAX_ITEMS,
    ...options,
  });
  console.log('r1', r1);
  storage.raffles[key] = r1;

  for (let r of r1) {
    await updateLuckygoRaffleMap(r);
  }
  console.log('storage.raffles.luckygoMap', storage.raffles.luckygoMap);

  await setStorageData(storage);
}

async function updateLuckygoRaffleMap(r) {
  console.log('updateLuckygoRaffleMap', r);

  if (r.provider !== 'luckygo') {
    return;
  }

  if (!storage.options.RAFFLE_LIST_FETCH_LUCKYGO_RAFFLES) {
    return;
  }

  if (!storage.raffles.luckygoMap) {
    storage.raffles.luckygoMap = {};
  }
  if (
    !storage.raffles.luckygoMap[r.collabId] ||
    !storage.raffles.luckygoMap[r.collabId].collabTwitterHandle
  ) {
    const fullRaffle = await getLuckygoRaffle(r.url);
    console.log('fullRaffle', fullRaffle);
    if (!fullRaffle) {
      return;
    }
    storage.raffles.luckygoMap[r.collabId] = {
      modified: Date.now(),
      collabTwitterHandle: normalizeTwitterHandle(fullRaffle.collabTwitterHandle),
    };
    await sleep(SLEEP_RAFFLE_LIST_LUCKYGO_RAFFLE_MAP_FETCH);
  }
}

function updateLuckygoTwitterHandles(raffles) {
  console.log('updateLuckygoTwitterHandles', raffles);
  raffles?.forEach((r) => {
    if (r.provider !== 'luckygo' || r.collabTwitterHandle) {
      return;
    }
    if (!storage.raffles.luckygoMap[r.collabId]) {
      return;
    }
    r.collabTwitterHandle = normalizeTwitterHandle(
      storage.raffles.luckygoMap[r.collabId].collabTwitterHandle
    );
  });
  console.log('updateLuckygoTwitterHandles 2', raffles);
}

// ALPHABOT ------------------------------

async function updateAllSuperfulRaffles(authKey) {
  await updateSuperfulRaffles('superfulAll', authKey);
}

async function updateSuperfulRaffles(key, authKey, options = {}) {
  console.log('updateSuperfulRaffles', key, authKey, options);
  const r1 = await getSuperfulRaffles(authKey, {
    statusLogger,
    max: storage.options.RAFFLE_LIST_MAX_ITEMS,
    ...options,
  });
  console.log('r1', r1);
  const r2 = processRaffles(r1 || []);
  console.log('r2', r2);
  //storage.raffles[key] = r2;
  storage.raffles[key] = r1;
}

// RAFFLES ------------------------------

function processRaffles(raffles) {
  const obj = {};
  for (let raffle of raffles) {
    const id = raffle.collabTwitterHandle || raffle.collabId || raffle.id;
    let item = obj[id];
    if (!item) {
      obj[id] = createNewRaffle(id, raffle);
      item = obj[id];
    }
    const dupItem = item.raffles.find((x) => x.id === raffle.id);
    if (dupItem) {
      console.log('Skip duplicate raffle; item, dupItem:', raffle, dupItem);
      continue;
    }
    item.raffles.push(raffle);
  }

  const packedItems = toObjArray(obj).sort(dynamicSort('endDate'));
  packedItems.forEach((item) => (item.raffles = item.raffles.sort(dynamicSort('endDate'))));

  return packedItems;
}

function createNewRaffle(id, raffle) {
  return {
    sortKey: raffle.mintDate || raffle.endDate || raffle.startDate,
    collabId: id,
    collabBanner: raffle.collabBanner,
    collabLogo: raffle.collabLogo,
    mintDate: raffle.mintDate,
    endDate: raffle.endDate,
    provider: raffle.provider,
    blockchain: raffle.blockchain,
    remainingSeconds: raffle.remainingSeconds || secondsBetween(raffle.endDate, Date.now()) || 0,
    collabTwitterHandle: raffle.collabTwitterHandle,
    raffles: [],
  };
}

// TABLE -----------------------------------------------------

function createTableHeadRow() {
  const head = document.createElement('THEAD');
  const row = document.createElement('TR');

  //row.appendChild(createCell('#M', 'Remaining minutes'));
  //row.appendChild(createCell('#R', 'Number of raffles'));
  row.appendChild(createCell('', 'tooltip'));
  row.appendChild(createCell('Twitter', ''));
  //row.appendChild(createCell('Req', 'Requirements'));
  row.appendChild(createCell('', 'Is raffle considered easy to fulfill?'));
  row.appendChild(createCell('', 'Num wallets already won for this project'));
  row.appendChild(createCell('', 'Have I entered this raffle?'));
  row.appendChild(createCell('W', 'Num winners'));
  row.appendChild(createCell('%', 'Win odds'));
  row.appendChild(createCell('E', 'Remaining time'));
  row.appendChild(createCell('Team', ''));
  row.appendChild(createCell('Name', ''));
  row.appendChild(createCell('Provider', ''));
  row.appendChild(createCell('Mint Date', ''));
  row.appendChild(createCell('Method', ''));
  row.appendChild(createCell('Chain', ''));
  row.appendChild(createCell('W', 'Number of winners'));
  row.appendChild(createCell('E', 'Number of entrants now'));
  // row.appendChild(createCell('P', 'Require premium subscription?'));

  head.appendChild(row);
  return head;
}

function createRafflesTable(packedRafflesIn, header, subHeader, sectionId, { allColumns = false } = {}) {
  console2.log('createRafflesTable', packedRafflesIn, header, subHeader, allColumns);

  const packedRaffles = packedRafflesIn?.length ? packedRafflesIn : [];

  if (allColumns) {
    const sortedRaffles = packedRaffles.map((x) => x.raffles).flat();
    const keys = sortedRaffles?.length ? Object.keys(sortedRaffles[0]) : [];
    const div = document.createElement('div');
    div.className = 'raffles';
    div.innerHTML =
      (header ? `<h4>${header} (${sortedRaffles.length})</h4>` : '') +
      (sortedRaffles.length ? jht(sortedRaffles, keys) : 'No results');
    return div;
  }

  const table = document.createElement('TABLE');
  table.classList.add('raffle-list');

  table.appendChild(createTableHeadRow());

  for (const parent of packedRaffles) {
    //console.log('parent', parent);

    const row = document.createElement('TR');

    // CELL: collab-banner
    row.appendChild(createProjectImage(parent, 'collab-banner'));

    // CELL: collabTwitterHandle
    const twitterHandle = pageState.permissions?.enabled ? parent.collabTwitterHandle || '?' : 'hidden';
    row.appendChild(
      createCell(
        createLink(makeTwitterURL(twitterHandle), trimText(twitterHandle, MAX_LEN_TWITTER_HANDLE), {
          dataset: [{ key: 'username', val: parent.collabTwitterHandle }],
          className: 'twitter-link',
          target: '_blank',
          fullText: twitterHandle,
        })
      )
    );

    // CELL: reqStrings
    /*
    const reqStrings = parent.raffles.map((x) => x.reqString || '');
    row.appendChild(createCell(createMultiTexts(reqStrings, { className: 'req-string', hideDups: false })));
    */

    // CELL: easy
    const easys = parent.raffles.map((x) =>
      x.reqString && !x.reqString.toLowerCase().includes('d') ? 'E' : ''
    );
    const easyTitles = parent.raffles.map((x) =>
      x.reqString && !x.reqString.toLowerCase().includes('d') ? 'Easy raffle' : ''
    );
    row.appendChild(
      createCell(
        createMultiTexts(easys, {
          className: 'easy',
          useTextAsClass: true,
          hideDups: false,
          titles: easyTitles,
        })
      )
    );

    // CELL: wins
    const numWinsElem = document.createElement('SPAN');
    numWinsElem.classList.toggle('wins-id', true);
    numWinsElem.classList.toggle('win', false);
    numWinsElem.innerText = '';
    numWinsElem.dataset.twitterHandle = twitterHandle;
    numWinsElem.dataset.wins = '';
    row.appendChild(createCell(numWinsElem));

    // CELL: entered
    const hasEntereds = parent.raffles.map((x) => (x.hasEntered ? 'X' : ''));
    const hasEnteredTitles = parent.raffles.map((x) => (x.hasEntered ? 'Has entered' : ''));
    row.appendChild(
      createCell(
        createMultiTexts(hasEntereds, {
          className: 'has-entered',
          useTextAsClass: true,
          hideDups: false,
          titles: hasEnteredTitles,
        })
      )
    );

    /*
    // ATTRIBUTES
    row.appendChild(
      createCell(
        createAttributeTexts([
          { list: [easys, easyTitles, 'easy']},
          {elem: numWinsElem},
          {[hasEntereds, hasEnteredTitles, 'has-entered'],
        ])
      )
    );
    */

    // CELL: entry-info
    const entryInfos = parent.raffles.map((x) => `${x.winnerCount}`);
    row.appendChild(createCell(createMultiTexts(entryInfos, { className: 'entry-infos', hideDups: false })));

    // CELL: odds
    const winnerOdds = parent.raffles.map((x) => {
      const odds = makeRaffleOdds(x.entryCount, x.winnerCount);
      console2.trace('odds', odds);
      return odds.toString();
    });
    row.appendChild(
      createCell(createMultiTexts(winnerOdds, { className: 'odds', useTextAsDataset: true, hideDups: false }))
    );

    // CELL: timeLeft
    const now = Date.now();
    const timeLeft = parent.raffles.map((x) => {
      const m = minutesBetween(x.endDate, now);
      const h = hoursBetween(x.endDate, now);
      const d = daysBetween(x.endDate, now);
      if (m <= 60) {
        return `${m} m`;
      } else if (h <= 47) {
        return `${h} h`;
      } else {
        return `${d} d`;
      }
    });
    row.appendChild(createCell(createMultiTexts(timeLeft, { className: 'time-left', hideDups: false })));

    // CELL: teamName
    /*
    row.appendChild(
      createCell(
        createMultiTexts(
          parent.raffles.map((x) => x.teamName),
          { className: 'team-name', hideDups: false }
        )
      )
    );
    */

    // CELL: teamName + raffle links
    const teamNames = parent.raffles.map((x) => {
      return {
        url: x.url,
        text: trimText(x.teamName, MAX_LEN_TEAM_NAME),
        fullText: x.name,
      };
    });
    row.appendChild(createCell(createMultiLinks(teamNames, { className: 'raffle-link', target: '_blank' })));

    // CELL: raffle links + query
    const raffleLinks = parent.raffles.map((x) => {
      return {
        url: x.url,
        text: trimText(x.name, MAX_LEN_RAFFLE_NAME),
        // fullText: x.name,
        fullText: x.name + (x.query ? `\n\nSEARCH QUERY: ${x.query}` : ''),
      };
    });
    row.appendChild(
      createCell(
        createMultiLinks(raffleLinks, {
          className: 'raffle-link',
          target: '_blank',
          addIgnoreLink: true,
          raffles: parent.raffles,
        })
      )
    );

    // CELL: provider
    row.appendChild(
      createCell(
        createMultiTexts(
          parent.raffles.map((x) => x.provider || ''),
          { className: 'provider', hideDups: false }
        )
      )
    );

    // CELL: mintDates
    const mintDates = parent.raffles.map((x) => {
      return { date: x.mintDate, hasTime: false };
    });
    row.appendChild(createCell(createMultiDates(mintDates, '', { className: 'mint-date' })));

    // CELL: endDates
    /*
    const endDates = parent.raffles.map((x) => {
      return { date: x.endDate, hasTime: false };
    });
    row.appendChild(createCell(createMultiDates(endDates, '', { className: 'end-date' })));
    */

    // CELL: whitelistMethod
    row.appendChild(
      createCell(
        createMultiTexts(
          parent.raffles.map((x) => x.whitelistMethod),
          { className: 'dtc', hideDups: false }
        )
      )
    );

    // CELL: blockchain
    row.appendChild(
      createCell(
        createMultiTexts(
          parent.raffles.map((x) => x.blockchain),
          { className: 'blockchain', hideDups: false }
        )
      )
    );

    // CELL: winner-count
    const winnerCounts = parent.raffles.map((x) => trimTextNum(x.winnerCount, 6));
    row.appendChild(
      createCell(createMultiTexts(winnerCounts, { className: 'winner-count', hideDups: false }))
    );

    // CELL: entry-count
    const entryCounts = parent.raffles.map((x) => trimTextNum(x.entryCount, 6));
    row.appendChild(createCell(createMultiTexts(entryCounts, { className: 'entry-count', hideDups: false })));

    // CELL: requirePremium
    /*
    const requirePremiums = parent.raffles.map((x) => (x.requirePremium ? 'Yes' : ''));
    row.appendChild(
      createCell(createMultiTexts(requirePremiums, { className: 'require-premium', hideDups: false }))
    );
    */

    table.appendChild(row);
  }

  const numProjects = packedRaffles.length;
  const numRaffles = packedRaffles.map((x) => x.raffles).flat().length;

  const sectionLinkElem = document.getElementById(`show-${sectionId}`);
  console.log('sectionId', sectionId);
  sectionLinkElem.dataset.hxCount = `(${numRaffles})`;

  console2.log('table', table);
  const div = document.createElement('div');
  // div.id = id;
  div.className = 'provider-raffles';
  const div2 = document.createElement('div');
  div2.innerHTML =
    `<a name='${sectionId}'></a>` +
    (header ? `<h4 class='raffle-list'>${header} (${numProjects}/${numRaffles})</h4>` : '') +
    (subHeader ? `<span class='sub-header'>${subHeader}</span><br>` : '');
  div.appendChild(div2);
  if (numRaffles) {
    div.appendChild(table);
  } else {
    div.appendChild(createElem('span', 'No raffles', 'no-raffles'));
  }
  /*
    div.innerHTML =
      `<a name='${sectionId}'></a>` +
      (header ? `<h4 class='sticky'>${header} (${numProjects}/${numRaffles})</h4>` : '') +
      (subHeader ? `<span>${subHeader}</span><br>` : '') +
      (numRaffles ? table.outerHTML : '<br>No raffles');
      */
  return div;
}

function createElem(tag, text, className) {
  const elem = document.createElement(tag);
  if (text) {
    elem.innerText = text;
  }
  if (className) {
    addClassName(elem, className);
  }
  return elem;
}

function appendRafflesTable(table) {
  document.getElementById('main-table').appendChild(table);
}

// TABLE HELPERS

function createCell(content, title = '') {
  const elem = document.createElement('TD');
  if (typeof content === 'string') {
    elem.innerText = content;
  } else if (typeof content === 'number') {
    elem.innerText = content.toString();
  } else {
    elem.appendChild(content);
  }
  if (title) {
    elem.title = title;
  }
  return elem;
}

const MISSING_BANNER_URL = 'https://plchldr.co/i/250x250?text=Missing%20Banner&bg=111111';

function createProjectImage(raffle, className = '') {
  const elem = document.createElement('TD');
  const img = document.createElement('IMG');
  // const url = raffle.collabBanner || MISSING_BANNER_URL;
  const url = raffle.collabBanner || raffle.collabLogo || MISSING_BANNER_URL;
  img.src = url;
  /*
  img.addEventListener('error', () => {
    img.src = raffle.collabLogo || MISSING_BANNER_URL;
  });
  */
  addClassName(img, className);
  elem.appendChild(img);
  return elem;
}

function createMultiTexts(
  texts,
  { className, useTextAsClass, useTextAsDataset, hideDups = true, fullTexts, titles } = {}
) {
  // console.log('texts', texts);

  // const texts = textsIn.map((x) => (typeof x === 'number' ? x.toString() : x));

  const elem = document.createElement('SPAN');
  elem.style.whiteSpace = 'nowrap';
  let isFirst = true;
  let lastText = null;
  for (const [index, textIn] of texts.entries()) {
    const text = textIn || '';
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
      } else if (titles?.length) {
        newElem.title = titles[index];
      }
    }
    addClassName(newElem, className);
    addClassName(newElem, isFirst ? 'first' : null);
    addClassName(newElem, useTextAsClass ? textAsClass(text) : null);
    if (useTextAsDataset) {
      newElem.dataset.n = text;
    }
    elem.appendChild(newElem);
    isFirst = false;
  }
  return elem;
}

function createMultiLinks(
  links,
  { target, className, addBackgroundLink = true, addIgnoreLink, raffles } = {}
) {
  const elem = document.createElement('SPAN');
  elem.style.whiteSpace = 'nowrap';
  let isFirst = true;

  let idx = 0;
  for (const link of links) {
    if (!isFirst) {
      elem.appendChild(document.createElement('BR'));
    }
    const thisClass = `${className || ''} ${isFirst ? 'first' : ''} ${link.isNew ? 'is-new' : ''} ${
      link.isUpdated ? 'is-updated' : ''
    }`.trim();
    const thisUrl = pageState.permissions?.enabled ? link.url : 'http://example.org/hidden-premium-feature';
    const thisText = pageState.permissions?.enabled ? link.text : 'Hidden Raffle Name';
    if (addIgnoreLink) {
      elem.appendChild(createIgnoreLink(raffles[idx], { className: thisClass }));
    }
    elem.appendChild(
      createLink(thisUrl, thisText, { target, className: thisClass, fullText: link.fullText })
    );
    if (addBackgroundLink) {
      elem.appendChild(createBackgroundLink(thisUrl, '+', { className: thisClass }));
    }
    isFirst = false;
    idx++;
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
  if (fullText) {
    elem.title = fullText;
  }
  if (dataset?.length) {
    dataset.forEach((x) => {
      elem.dataset[x.key] = x.val;
    });
  }
  return elem;
}

function createBackgroundLink(url, text, { className } = {}) {
  const elem = document.createElement('a');
  elem.addEventListener('click', () => {
    chrome.runtime.sendMessage({ cmd: 'openTab', url, active: false });
  });
  // elem.href = '';
  //elem.href = `javascript:console.log('foo')`;
  addClassName(elem, className);
  addClassName(elem, 'background-link');
  elem.innerText = text.trim();
  return elem;
}

function createIgnoreLink(raffle, { className } = {}) {
  console.log('createIgnoreLink', raffle);
  const elem = document.createElement('a');
  elem.addEventListener('click', () => {
    if (!storage.raffles.ignoredMap) {
      storage.raffles.ignoredMap = {};
    }
    storage.raffles.ignoredMap[raffle.id] = raffle.endDate;
    elem.innerText = '';
    elem.nextElementSibling.style = 'text-decoration: line-through;';
    setStorageData(storage);
    console.log(storage);
  });
  // elem.href = '';
  //elem.href = `javascript:console.log('foo')`;
  elem.title = 'Ignore raffle';
  addClassName(elem, className);
  addClassName(elem, 'ignore-link');
  elem.innerText = '-';
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

// MISC HELPERS -----------------------------------------------------

// FILTER

function recalcFilters() {
  console.log('recalcFilters');
  showPage();
}

function filterRaffles(raffles, filters) {
  return raffles.filter((x) => isFiltered(x, filters));
  /*
  console.log('filterRaffles', raffles, filters);
  const baseRaffles = [...raffles];
  baseRaffles.forEach((r) => {
    console.log('r.raffles', r.raffles);
    r.raffles = r.raffles.filter((x) => isFiltered(x, filters));
  });
  console.log('baseRaffles', baseRaffles);
  const newRaffles = baseRaffles.filter((x) => x.raffles.length > 0);
  newRaffles.forEach((x) => (x.endDate = x.raffles[0].endDate));
  console.log('newRaffles', newRaffles);
  return newRaffles;
  */
}

function getFilters(fromInput = true) {
  const f = fromInput ? getFiltersFromInput() : getFiltersFromOptions();
  console.log('filters:', f);
  const filters = [];
  filters.push(f.minutes !== null ? `Ends in ${timeLeftToText(f.minutes)}` : '');
  filters.push(f.winPct !== null ? `Win >= ${f.winPct}%` : '');
  filters.push(f.easy ? `Easy` : '');
  filters.push(f.reqDiscord ? `No Discord req` : '');
  filters.push(f.reqFollow ? `Follow` : '');
  filters.push(f.reqLike ? `Like` : '');
  filters.push(f.reqRetweet ? `Retweet` : '');
  f.text = filters.filter((x) => !!x).join(' | ');
  return f;
}

function getFiltersFromOptions() {
  return {
    minutes: storage.options.RAFFLE_LIST_FILTER_MINUTES
      ? Number(storage.options.RAFFLE_LIST_FILTER_MINUTES)
      : null,
    winPct: storage.options.RAFFLE_LIST_FILTER_PCT ? Number(storage.options.RAFFLE_LIST_FILTER_PCT) : null,
    easy: storage.options.RAFFLE_LIST_FILTER_EASY,
    reqDiscord: storage.options.RAFFLE_LIST_FILTER_REQ_DISCORD,
    reqFollow: storage.options.RAFFLE_LIST_FILTER_REQ_FOLLOW,
    reqLike: storage.options.RAFFLE_LIST_FILTER_REQ_LIKE,
    reqRetweet: storage.options.RAFFLE_LIST_FILTER_REQ_RETWEET,
  };
}

function getFiltersFromInput() {
  return {
    minutes: Number(document.getElementById('time-left').value) || null,
    winPct: Number(document.getElementById('win-pct').value) || null,
    easy: document.getElementById('easy').checked,
    reqDiscord: document.getElementById('d').checked,
    reqFollow: document.getElementById('f').checked,
    reqLike: document.getElementById('l').checked,
    reqRetweet: document.getElementById('r').checked,
  };
}

function isFiltered(raffle, filters) {
  console2.log('isFiltered', raffle, filters);
  const now = Date.now();

  if (filters.easy && !isRaffleEasy(raffle)) {
    console2.log('false: easy');
    return false;
  }

  if (filters.minutes !== null && raffle.endDate - filters.minutes * 60 * 1000 > now) {
    console2.log('false: minutes');
    return false;
  }

  if (filters.winPct !== null && getWinPct(raffle) * 100 < filters.winPct) {
    console2.log('false: winPct');
    return false;
  }

  if (filters.reqDiscord && (raffle.reqString?.includes('d') || !raffle.reqString)) {
    console2.log('false: reqDiscord');
    return false;
  }

  if (filters.reqFollow && (raffle.reqString?.includes('f') || !raffle.reqString)) {
    console2.log('false: reqFollow');
    return false;
  }

  if (filters.reqLike && (raffle.reqString?.includes('l') || !raffle.reqString)) {
    console2.log('false: reqLike');
    return false;
  }

  if (filters.reqRetweet && (raffle.reqString?.includes('r') || !raffle.reqString)) {
    console2.log('false: reqRetweet');
    return false;
  }

  console2.log('true');
  return true;
}

function isRaffleEasy(r) {
  const f = {
    minutes: storage.options.RAFFLE_LIST_FILTER_MINUTES_EASY
      ? Number(storage.options.RAFFLE_LIST_FILTER_MINUTES_EASY)
      : null,
    winPct: storage.options.RAFFLE_LIST_FILTER_PCT_EASY
      ? Number(storage.options.RAFFLE_LIST_FILTER_PCT_EASY)
      : null,
    reqDiscord: storage.options.RAFFLE_LIST_FILTER_REQ_DISCORD_EASY,
    reqFollow: storage.options.RAFFLE_LIST_FILTER_REQ_FOLLOW_EASY,
    reqLike: storage.options.RAFFLE_LIST_FILTER_REQ_LIKE_EASY,
    reqRetweet: storage.options.RAFFLE_LIST_FILTER_REQ_RETWEET_EASY,
    text: '',
  };

  return isFiltered(r, f);
}

function isRaffleToLongToShow(r) {
  return r.endDate + storage.options.RAFFLE_LIST_MAX_DAYS_OLD * ONE_DAY <= Date.now();
}

function getWinPct(r) {
  if (typeof r.entryCount !== 'number' || typeof r.winnerCount !== 'number') {
    return 0;
  }
  if (!r.winnerCount) {
    return 0;
  }
  if (!r.entryCount) {
    return 1;
  }
  return r.winnerCount / r.entryCount;
}

function creteFiltersHTML() {
  const f = getFilters(false);

  const div = document.createElement('div');
  div.appendChild(createLabel('FILTERS:', 'filter-header'));
  div.appendChild(makeCheckbox('easy', 'Easy', 'lorem', f.easy));
  div.appendChild(makeCheckbox('d', '-D', 'lorem', f.reqDiscord));
  div.appendChild(makeCheckbox('f', '-F', 'lorem', f.reqFollow));
  div.appendChild(makeCheckbox('l', '-L', 'lorem', f.reqLike));
  div.appendChild(makeCheckbox('r', '-R', 'lorem', f.reqRetweet));
  div.appendChild(createLabel('Time Left:', 'filter-label'));
  div.appendChild(makeSelect(getTimeLeftOptionsArr(), 'time-left', 'time-left'));
  div.appendChild(createLabel('Min Win %:', 'filter-label'));
  div.appendChild(makeSelect(getWinPctOptionsArr(), 'win-pct', 'win-pct'));

  document.getElementById('filters').replaceChildren(div);
}

function getTimeLeftOptionsArr() {
  const arr = [15, 60, 240, 480, 720, 960, 1440, 2880, 4320, MINUTES_FOR_ALL_OPTION];
  let selectedVal = null;
  if (storage.options.RAFFLE_LIST_FILTER_MINUTES) {
    selectedVal = Number(storage.options.RAFFLE_LIST_FILTER_MINUTES);
    arr.push(selectedVal);
  }
  return noDuplicates(arr)
    .sort((x, y) => x - y)
    .map((x) => {
      return { value: x, text: timeLeftToText(x), selected: x === selectedVal };
    });
}

const timeLeftToText = (minutes) => {
  if (minutes < 60) {
    return `${minutes} ${pluralize(minutes, 'minute', 'minutes')}`;
  } else if (minutes < 60 * 24) {
    const hours = Math.floor(minutes / 60);
    return `${hours} ${pluralize(hours, 'hour', 'hours')}`;
  } else if (minutes < MINUTES_FOR_ALL_OPTION) {
    const days = Math.floor(minutes / 1440);
    return `${days} ${pluralize(days, 'day', 'days')}`;
  } else {
    return 'All';
  }
};

function getWinPctOptionsArr() {
  const arr = [0, 1, 2, 3, 4, 5, 10, 25, 50, 75, 90, 100];
  let selectedVal = null;
  if (storage.options.RAFFLE_LIST_FILTER_PCT) {
    selectedVal = Number(storage.options.RAFFLE_LIST_FILTER_PCT);
    arr.push(selectedVal);
  }
  const toText = (val) => {
    return `${val}`;
  };
  return noDuplicates(arr)
    .sort((x, y) => x - y)
    .map((x) => {
      return { value: x, text: toText(x), selected: x === selectedVal };
    });
}

function makeSelect(options, id, className) {
  const base = createElement('select', className);
  base.id = id;
  options.forEach((opt) => {
    const optElem = createElement('option');
    optElem.value = opt.value;
    optElem.text = opt.text;
    optElem.selected = opt.selected;
    base.appendChild(optElem);
  });
  return base;
}

function makeCheckbox(id, labelText, labelTitle, isChecked, className = 'filter') {
  const section = createElement('span', className);
  const elem = createElement('input', className);
  elem.type = 'checkbox';
  elem.checked = isChecked;
  elem.addEventListener('click', recalcFilters);
  const label = createElement('label', className);
  elem.id = id;
  label.htmlFor = id;
  label.title = labelTitle;
  label.innerText = labelText;
  section.appendChild(elem);
  section.appendChild(label);
  return section;
}

export function trimTextNum(valToTrim, maxLen, errVal = '') {
  if (typeof valToTrim !== 'number') {
    return errVal;
  }
  const text = valToTrim.toString();
  return text.length <= maxLen ? text : text.substring(0, maxLen - 1) + '...';
}

export function trimText(valToTrim, maxLen, errVal = '') {
  if (typeof valToTrim !== 'string') {
    return errVal;
  }
  return valToTrim.length <= maxLen ? valToTrim : valToTrim.substring(0, maxLen - 1) + '...';
}

function makeRaffleOdds(entries, winners) {
  if (typeof entries !== 'number') {
    return '?';
  }
  if (entries < 1) {
    return 100;
  }
  if (entries <= winners) {
    return 100;
  }
  const pct = (winners / entries) * 100;
  if (pct < 1) {
    return round(pct, 0);
  } else {
    return round(pct, 0);
  }
}

function showLastUpdatedStatus() {
  const nowDate = new Date();

  // resetSubStatus();

  if (storage.raffles.lastUpdate) {
    const timestamp = storage.raffles.lastUpdate;

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
    statusLogger.sub(`Raffles last fetched from providers at ${timeText1} <b>(${agoText1})</b>`);
  } else {
    // updateSubStatus(`Raffles never fetched from raffle providers`);
  }
}

function createElement(tag, className) {
  const elem = document.createElement(tag);
  addClassName(elem, className);
  return elem;
}

function createLabel(text, className) {
  const elem = createElement('label', className);
  elem.innerText = text;
  return elem;
}
