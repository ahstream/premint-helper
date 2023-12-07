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
} from 'hx-lib';

import { getPermissions } from '../../js/permissions.js';
import { getRaffles as getLuckygoRaffles, getLuckygoAuth } from '../../js/luckygoLib.js';
import { getRaffles as getAlphabotRaffles } from '../../js/alphabotLib.js';

import { createStatusbar } from 'hx-statusbar';

import { createObserver as createTwitterObserver } from '../../js/twitterObserver.js';
import { createObserver } from '../../js/observerGeneric.js';

const console2 = myConsole();

const jht = require('json-html-table');

// DATA ------------------------------

let storage = {};
let pageState = {};

const SHORTENED_TEXT_SUFFIX = '...';
const MAX_LEN_RAFFLE_NAME = 32;
const MAX_LEN_TEAM_NAME = 24;
const MAX_LEN_TWITTER_HANDLE = 16;

const DEFAULT_LOCALE = 'SV-se'; // undefined; // 'SV-se'; // string() | undefined
const SORT_ORDER_LOCALE = 'sv-SE';
const MAX_RAFFLES = 300;

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

  const queryText = `Queries: ${storage.options.RAFFLES_SEARCH_QUERY.join(', ')}`;
  showRafflesTableForOne('search', 'Search Query Raffles', queryText);
  updateAlphabotSelectedRaffles();
  showRafflesTableForOne('alphabotSelected', 'Selected Alphabot Raffles');
  showRafflesTableForOne('alphabotMine', 'My Alphabot Raffles');
  showRafflesTableForOne('alphabotAll', 'All Alphabot Raffles');
  showRafflesTableForOne('luckygoMine', 'My LuckyGo Raffles');
  showRafflesTableForOne('luckygoAll', 'All LuckyGo Raffles');

  console2.log('Done showing raffles page!');
  statusLogger.main('');
}

function showRafflesTableForOne(key, header, subHeader = '') {
  const items = storage.raffles[key] ? storage.raffles[key] : [];
  console.log('items', items);

  const now = Date.now();

  items.forEach((i) => {
    i.raffles = i.raffles.filter((x) => x.endDate > now);
    i.endDate = i.raffles.length ? i.raffles[0].endDate : null;
  });

  const validItems = items.filter((x) => x.endDate > now);
  console.log('validItems', validItems);

  appendRafflesTable(createRafflesTable(validItems.sort(dynamicSort('endDate')), header, subHeader, key));
}

function resetPage() {
  document.getElementById('main-table').innerHTML = '';
  resetSubStatus();
}

// UPDATE ------------------------------

async function updateRaffles() {
  console.log('updateRaffles');

  resetPage();
  await reloadOptions(storage);

  statusLogger.main(`Updating raffles...`);

  await getMyTabIdFromExtension(pageState, 5000);
  console.log('pageState', pageState);

  statusLogger.mid(`Getting LuckyGo authentication key...`);
  const authKeyLuckygo = await getLuckygoAuth(pageState);
  console.log('authKey', authKeyLuckygo);
  if (!authKeyLuckygo) {
    statusLogger.sub(`Failed getting LuckyGo authentication key. Check if logged in to website?`);
  }
  statusLogger.mid(``);

  statusLogger.main(`Updating Search Query raffles...`);
  await updateSearchRaffles(authKeyLuckygo);
  statusLogger.sub(`Fetched ${storage.raffles.search?.length || 0} Search Query raffle projects`);
  statusLogger.mid(``);
  showRafflesTableForOne(
    'search',
    'Search Query Raffles',
    `Queries: ${storage.options.RAFFLES_SEARCH_QUERY.join(', ')}`
  );

  if (pageState.foo2) {
    return;
  }

  statusLogger.main(`Updating My Alphabot raffles...`);
  await updateMyAlphabotRaffles();
  statusLogger.sub(
    `Fetched ${storage.raffles.alphabotMine?.length || 0} of my Alphabot raffle projects (My communities)`
  );
  statusLogger.mid(``);
  updateAlphabotSelectedRaffles();
  showRafflesTableForOne('alphabotSelected', 'Selected Alphabot Raffles');
  showRafflesTableForOne('alphabotMine', 'My Alphabot Raffles');

  statusLogger.main(`Updating All Alphabot raffles...`);
  await updateAllAlphabotRaffles();
  statusLogger.sub(
    `Fetched ${storage.raffles.alphabotAll?.length || 0} of all Alphabot raffle projects (All communities)`
  );
  statusLogger.mid(``);
  showRafflesTableForOne('alphabotAll', 'All Alphabot Raffles');

  statusLogger.main(`Updating My LuckyGo raffles...`);
  await updateMyLuckygoRaffles(authKeyLuckygo);
  statusLogger.sub(
    `Fetched ${storage.raffles.luckygoMine?.length || 0} LuckyGo raffle projects (My communities)`
  );
  statusLogger.mid(``);
  showRafflesTableForOne('luckygoMine', 'My LuckyGo Raffles');

  statusLogger.main(`Updating All LuckyGo raffles...`);
  await updateAllLuckygoRaffles(authKeyLuckygo);
  statusLogger.sub(
    `Fetched ${storage.raffles.luckygoAll?.length || 0} of all LuckyGo raffle projects (All communities)`
  );
  statusLogger.mid(``);
  showRafflesTableForOne('luckygoAll', 'All LuckyGo Raffles');

  storage.raffles.lastUpdate = Date.now();

  await setStorageData(storage);

  statusLogger.main('Done updating raffles!');
  statusLogger.mid('');
}

// SEARCH ------------------------------

async function updateSearchRaffles(luckygoAuthKey) {
  console.log('updateSearchRaffles');

  const search = storage.options.RAFFLES_SEARCH_QUERY;
  console.log('search', search);

  const queries = noDuplicates(
    search
      .map((x) => x.split(','))
      .flat()
      .map((x) => x.trim())
  );
  console.log('queries', queries);

  const raffles = [];

  for (let i = 0; i < queries.length; i++) {
    const query = queries[i];
    console.log('query', query);
    if (!query || query.length < 2) {
      statusLogger.sub(`Invalid search query:`, query);
      continue;
    }
    statusLogger.main(`Fetching raffles for search query ${i + 1} of ${queries.length}: ${query}`);

    const alphabotRaffles = await getAlphabotRaffles(null, {
      statusLogger,
      max: MAX_RAFFLES,
      search: query,
    });
    console.log('alphabotRaffles:', query, alphabotRaffles);
    raffles.push(...alphabotRaffles);

    const luckygoRaffles = !luckygoAuthKey
      ? []
      : await getLuckygoRaffles(luckygoAuthKey, {
          statusLogger,
          max: MAX_RAFFLES,
          key_words: query,
        });
    console.log('luckygoRaffles:', query, luckygoRaffles);
    raffles.push(...luckygoRaffles);

    await sleep(300);
  }

  const processedRaffles = processRaffles(raffles);
  console.log('processedRaffles', processedRaffles);
  storage.raffles.search = processedRaffles;

  await setStorageData(storage);
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
  const r1 = await getAlphabotRaffles(authKey, { statusLogger, max: MAX_RAFFLES, ...options });
  console.log('r1', r1);
  const r2 = processRaffles(r1 || []);
  console.log('r2', r2);
  storage.raffles[key] = r2;
}

async function updateAlphabotSelectedRaffles() {
  console.log('updateAlphabotSelectedRaffles');

  const myTeams = noDuplicates(
    storage.options.RAFFLES_MY_TEAMS.map((x) => x.split(','))
      .flat()
      .map((x) => x.trim())
      .map((x) => x.toLowerCase())
  );
  console.log('myTeams', myTeams);

  const raffles = [];
  storage.raffles.alphabotMine.forEach((r) => {
    r.raffles.forEach((raffle) => {
      console.log('raffle', raffle);
      const teamName = raffle.teamName?.toLowerCase ? raffle.teamName.toLowerCase() : '';
      console.log('teamName', teamName);
      if (myTeams.includes(teamName)) {
        raffles.push({ ...raffle });
      }
    });
  });
  storage.raffles.alphabotSelected = processRaffles(raffles);
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
  const r1 = await getLuckygoRaffles(authKey, { statusLogger, max: MAX_RAFFLES, ...options });
  console.log('r1', r1);
  const r2 = processRaffles(r1 || []);
  console.log('r2', r2);
  storage.raffles[key] = r2;

  await setStorageData(storage);
}

// RAFFLES ------------------------------

function processRaffles(raffles) {
  const obj = {};
  for (let raffle of raffles) {
    const id = raffle.collabId || raffle.collabTwitterHandle || raffle.id;
    let item = obj[id];
    if (!item) {
      obj[id] = createNewRaffle(id, raffle);
      item = obj[id];
    }
    item.raffles.push(raffle);
  }
  return toObjArray(obj).sort(dynamicSort('endDate'));
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
    const reqStrings = parent.raffles.map((x) => x.reqString || '');
    row.appendChild(createCell(createMultiTexts(reqStrings, { className: 'req-string', hideDups: false })));

    // CELL: easy
    const easys = parent.raffles.map((x) =>
      x.reqString && !x.reqString.toLowerCase().includes('d') ? 'Yes' : ''
    );
    row.appendChild(createCell(createMultiTexts(easys, { className: 'easy', hideDups: false })));

    // CELL: wins
    const elem = document.createElement('SPAN');
    elem.classList.toggle('wins-id', true);
    elem.classList.toggle('win', false);
    elem.innerText = '';
    elem.dataset.twitterHandle = twitterHandle;
    elem.dataset.wins = '';
    row.appendChild(createCell(elem));

    // CELL: odds
    const winnerOdds = parent.raffles.map((x) => {
      const odds = makeRaffleOdds(x.entryCount, x.winnerCount);
      console2.trace('odds', odds);
      return odds.toString();
    });
    row.appendChild(
      createCell(createMultiTexts(winnerOdds, { className: 'odds', useTextAsDataset: true, hideDups: false }))
    );

    // CELL: entered
    const hasEntereds = parent.raffles.map((x) => (x.hasEntered ? 'x' : ''));
    row.appendChild(
      createCell(
        createMultiTexts(hasEntereds, { className: 'has-entered', useTextAsClass: true, hideDups: false })
      )
    );

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

    // CELL: timeLeft
    const now = Date.now();
    const timeLeft = parent.raffles.map((x) => {
      const m = minutesBetween(x.endDate, now);
      const h = hoursBetween(x.endDate, now);
      const d = daysBetween(x.endDate, now);
      if (m <= 60) {
        return `${m} min`;
      } else if (h <= 24) {
        return `${h} h`;
      } else {
        return `${d} d`;
      }
    });
    row.appendChild(createCell(createMultiTexts(timeLeft, { className: 'time-left', hideDups: false })));

    // CELL: raffle links
    const raffleLinks = parent.raffles.map((x) => {
      return {
        url: x.url,
        text: trimText(x.name, MAX_LEN_RAFFLE_NAME),
        fullText: x.name,
      };
    });
    row.appendChild(
      createCell(createMultiLinks(raffleLinks, { className: 'raffle-link', target: '_blank' }))
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

    table.appendChild(row);
  }

  const numProjects = packedRaffles.length;
  const numRaffles = packedRaffles.map((x) => x.raffles).flat().length;

  const sectionLinkElem = document.getElementById(`show-${sectionId}`);
  sectionLinkElem.dataset.hxCount = `(${numRaffles})`;

  console2.log('table', table);
  const div = document.createElement('div');
  // div.id = id;
  div.className = 'provider-raffles';
  div.innerHTML =
    `<a name='${sectionId}'></a>` +
    (header ? `<h4 class='sticky'>${header} (${numProjects}/${numRaffles})</h4>` : '') +
    (subHeader ? `<span>${subHeader}</span><br>` : '') +
    (numRaffles ? table.outerHTML : 'No raffles');
  return div;
}

function appendRafflesTable(table) {
  document.getElementById('main-table').appendChild(table);
}

function createTableHeadRow() {
  const head = document.createElement('THEAD');
  const row = document.createElement('TR');

  //row.appendChild(createCell('#M', 'Remaining minutes'));
  //row.appendChild(createCell('#R', 'Number of raffles'));
  row.appendChild(createCell('', 'tooltip'));
  row.appendChild(createCell('Twitter', ''));
  row.appendChild(createCell('Req', 'Requirements'));
  row.appendChild(createCell('Easy', 'Is raffle considered easy to fulfill?'));
  row.appendChild(createCell('W', 'Num wallets already won for this project'));
  row.appendChild(createCell('%', 'Win odds'));
  row.appendChild(createCell('E', 'Have i entered this raffle?'));
  row.appendChild(createCell('Team', ''));
  row.appendChild(createCell('Ends', 'Remaining time'));
  row.appendChild(createCell('Name', ''));
  row.appendChild(createCell('#W', 'Number of winners'));
  row.appendChild(createCell('#E', 'Number of entrants now'));
  // row.appendChild(createCell('P', 'Require premium subscription?'));
  row.appendChild(createCell('Provider', ''));
  row.appendChild(createCell('Mint Date', ''));
  row.appendChild(createCell('Method', ''));
  row.appendChild(createCell('Chain', ''));

  head.appendChild(row);
  return head;
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
  img.addEventListener('error', () => {
    img.src = raffle.collabLogo || MISSING_BANNER_URL;
  });
  addClassName(img, className);
  elem.appendChild(img);
  return elem;
}

function createMultiTexts(
  texts,
  { className, useTextAsClass, useTextAsDataset, hideDups = true, fullTexts } = {}
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
