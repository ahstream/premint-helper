console.info('raffles.js begin', window?.location?.href);

import './raffles.scss';

import {
  createStatusbarButtons,
  getMyTabIdFromExtension,
  loadStorage,
  reloadOptions,
  updateMainStatus,
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
const MAX_LEN_TWITTER_HANDLE = 24;

const SORT_ORDER_LOCALE = 'sv-SE';
const MAX_RAFFLES = 300;

const statusLogger = { main: updateMainStatus, sub: updateSubStatus };

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

  // storage = await loadStorage({}, null, [], [{ key: 'raffles', val: {} }]);
  storage = await loadStorage({}, null, [], []);
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

  resetSubStatus();
  updateMainStatus('');

  document.getElementById('hx-update').addEventListener('click', () => updateRaffles());

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

// MAIN ------------------------------

async function updateRaffles() {
  console.log('updateRaffles');

  resetPage();

  statusLogger.main(`Update raffles...`);

  await reloadOptions(storage);

  await getMyTabIdFromExtension(pageState, 5000);
  console.log('pageState', pageState);

  await updateLuckygoRaffles();
  statusLogger.sub(`Fetched ${storage.raffles.luckygo?.length || 0} LuckyGo raffles`);
  await updateAlphabotRaffles();
  statusLogger.sub(`Fetched ${storage.raffles.alphabot?.length || 0} Alphabot raffles`);

  await setStorageData(storage);

  showPage();
}

// LUCKYGO ------------------------------

async function updateLuckygoRaffles() {
  console.log('updateLuckygoRaffles');

  if (pageState.foo) {
    return;
  }

  const authKey = await getLuckygoAuth(pageState);
  if (!authKey) {
    statusLogger.sub(`Failed getting LuckyGo authentication key. Check if logged in to website.`);
    return;
  }
  console.log('authKey', authKey);

  const r1 = await getLuckygoRaffles(authKey, {
    statusLogger,
    max: MAX_RAFFLES,
  });
  console.log('r1', r1);
  if (!r1) {
    statusLogger.sub(`No raffles found at LuckyGo!`);
    console2.error('Empty raffles from LuckyGo!');
    return;
  }

  const r2 = processRaffles(r1);
  console.log('r2', r2);

  storage.raffles.luckygoLast = storage.raffles.luckygo;
  storage.raffles.luckygo = r2;

  await setStorageData(storage);
}

// ALPHABOT ------------------------------

async function updateAlphabotRaffles() {
  console.log('updateAlphabotRaffles');

  const authKey = null;
  console.log('authKey', authKey);

  const r1 = await getAlphabotRaffles(authKey, {
    statusLogger,
    max: MAX_RAFFLES,
  });
  console.log('r1', r1);
  if (!r1) {
    statusLogger.sub(`No raffles found at Alphabot!`);
    console2.error('Empty raffles from Alphabot!');
    return;
  }

  const r2 = processRaffles(r1);
  console.log('r2', r2);
  storage.raffles.alphabotLast = storage.raffles.alphabot;
  storage.raffles.alphabot = r2;

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

// SHOW PAGE -----------------------------------------------------

async function showPage() {
  console2.log('showPage');

  resetPage();

  appendRafflesTable(createRafflesTable(storage.raffles.alphabot.sort(dynamicSort('endDate')), 'Alphabot'));
  appendRafflesTable(createRafflesTable(storage.raffles.luckygo.sort(dynamicSort('endDate')), 'LuckyGo'));

  updateMainStatus('Showing raffles below');

  console2.log('Done showing raffles page!');
}

function resetPage() {
  document.getElementById('main-table').innerHTML = '';
}

// TABLES -----------------------------------------------------

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
  row.appendChild(createCell('Wins', ''));
  row.appendChild(createCell('%', 'Win odds'));
  row.appendChild(createCell('#W', 'Number of winners'));
  row.appendChild(createCell('#E', 'Number of winners'));
  row.appendChild(createCell('R?', 'Registered?'));
  row.appendChild(createCell('', ''));
  row.appendChild(createCell('Req', 'Requirements'));
  row.appendChild(createCell('P', 'Require premium subscription?'));
  row.appendChild(createCell('Mint Date', ''));
  row.appendChild(createCell('Ends', 'Remaining time'));
  row.appendChild(createCell('Method', ''));
  row.appendChild(createCell('Chain', ''));
  row.appendChild(createCell('Team', ''));

  head.appendChild(row);
  return head;
}

function createRafflesTable(packedRafflesIn, header, allColumns = false) {
  console2.log('createRafflesTable', packedRafflesIn, header);

  const packedRaffles = packedRafflesIn?.length ? packedRafflesIn : [];

  if (allColumns) {
    const sortedRaffles = packedRaffles.map((x) => x.raffles).flat();
    const keys = sortedRaffles?.length ? Object.keys(sortedRaffles[0]) : [];
    const div = document.createElement('div');
    div.className = 'raffles';
    div.innerHTML =
      (header ? `<h3>${header} (${sortedRaffles.length})</h3>` : '') +
      (sortedRaffles.length ? jht(sortedRaffles, keys) : 'No results');
    return div;
  }

  const table = document.createElement('TABLE');

  table.appendChild(createTableHeadRow());

  for (const parent of packedRaffles) {
    const row = document.createElement('TR');

    // CELL: collab-banner
    row.appendChild(createImage(parent.collabBanner, 'collab-banner'));

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
      return `${odds.toString()}`;
    });
    row.appendChild(createCell(createMultiTexts(winnerOdds, { className: 'winner-count', hideDups: false })));

    // CELL: winner-count
    const winnerCounts = parent.raffles.map((x) => trimTextNum(x.winnerCount, 6));
    row.appendChild(
      createCell(createMultiTexts(winnerCounts, { className: 'winner-count', hideDups: false }))
    );

    // CELL: entry-count
    const entryCounts = parent.raffles.map((x) => trimTextNum(x.entryCount, 6));
    row.appendChild(createCell(createMultiTexts(entryCounts, { className: 'entry-count', hideDups: false })));

    // CELL: Has entered
    const hasEntereds = parent.raffles.map((x) => (x.hasEntered ? 'x' : ''));
    row.appendChild(
      createCell(
        createMultiTexts(hasEntereds, { className: 'has-entered', useTextAsClass: true, hideDups: false })
      )
    );

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

    // CELL: reqStrings
    const reqStrings = parent.raffles.map((x) => x.reqString || '');
    row.appendChild(createCell(createMultiTexts(reqStrings, { className: 'req-string', hideDups: false })));

    // CELL: reqStrings
    const requirePremiums = parent.raffles.map((x) => (x.requirePremium ? 'Yes' : ''));
    row.appendChild(
      createCell(createMultiTexts(requirePremiums, { className: 'require-premium', hideDups: false }))
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

    // CELL: timeLeft
    const now = Date.now();
    const timeLeft = parent.raffles.map((x) => {
      const m = minutesBetween(x.endDate, now);
      const h = hoursBetween(x.endDate, now);
      const d = daysBetween(x.endDate, now);
      if (m <= 60) {
        return `${m} m`;
      } else if (h <= 24) {
        return `${h} hours`;
      } else {
        return `${d} days`;
      }
    });
    row.appendChild(createCell(createMultiTexts(timeLeft, { className: 'time-left', hideDups: false })));

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

    // CELL: teamName
    row.appendChild(
      createCell(
        createMultiTexts(
          parent.raffles.map((x) => x.teamName),
          { className: 'team-name', hideDups: false }
        )
      )
    );

    table.appendChild(row);
  }

  console2.log('table', table);
  const div = document.createElement('div');
  div.className = 'provider-wins';
  const sortedRaffles = packedRaffles.map((x) => x.raffles).flat();
  const numRaffles = sortedRaffles.length;
  div.innerHTML =
    (header ? `<h3>${header} (${numRaffles})</h3>` : '') + (numRaffles ? table.outerHTML : 'No raffles');
  return div;
}

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

function createImage(url, className = '') {
  const elem = document.createElement('TD');
  const img = document.createElement('IMG');
  img.src = url;
  addClassName(img, className);
  elem.appendChild(img);
  return elem;
}

function createMultiTexts(texts, { className, useTextAsClass, hideDups = true, fullTexts } = {}) {
  // console.log('texts', texts);

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
    return round(pct, 2);
  } else {
    return round(pct, 0);
  }
}
