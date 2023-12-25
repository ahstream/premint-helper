import global from './global.js';
console.log(global);

import {
  sleep,
  fetchHelper,
  rateLimitHandler,
  extractTwitterHandle,
  myConsole,
  noDuplicates,
  millisecondsAhead,
  isTwitterURL,
  waitForTextContains,
  waitForSelector,
  getTextContains,
  ONE_SECOND,
} from 'hx-lib';

import { normalizeTwitterHandle, normalizeDiscordHandle } from './premintHelperLib.js';

const console2 = myConsole(global.LOGLEVEL);
console2.log();

// DATA ----------------------------------------------------------------------------------

const ACCOUNT_URL = 'https://www.alphabot.app/api/auth/session';

const WINS_BASE_URL =
  'https://www.alphabot.app/api/projects?sort={SORT_BY}&scope=all&sortDir=-1&showHidden=true&pageSize={PAGE_SIZE}&pageNum={PAGE_NUM}&filter=winners';

const CALENDAR_URL =
  'https://www.alphabot.app/api/projectData?calendar=true&startDate={START_DATE}&endDate={END_DATE}&selectedMonth={SELECTED_MONTH}';

const RAFFLES_BASE_URL =
  'https://www.alphabot.app/api/projects?sort={SORT}&scope={SCOPE}&showHidden={SHOW_HIDDEN}&pageSize={PAGE_SIZE}&pageNum={PAGE_NUM}&search={SEARCH}&project={PROJECT}&filter={FILTER}';

//https://www.alphabot.app/api/projects?sort=ending&scope=all&showHidden=false&pageSize=16&pageNum=0&search=&project=&filter=unregistered

export const winnersSortedByNewestURL = `https://www.alphabot.app/api/projects?sort=newest&scope=all&sortDir=-1&showHidden=true&pageSize=16&filter=winners`;
export const winnersSortedByMintingURL = `https://www.alphabot.app/api/projects?sort=minting&scope=all&sortDir=-1&showHidden=true&pageSize=16&filter=winners`;

// MISC HELPERS  ----------------------------------------------------------------------------------

export function makeRaffleURL(slug) {
  return `https://www.alphabot.app/${slug}`;
}

export function trimTeamName(valToTrim, maxLen = 30, errVal = '') {
  if (typeof valToTrim !== 'string') {
    return errVal;
  }
  if (valToTrim.length <= maxLen) {
    return valToTrim;
  }
  return valToTrim.substring(0, maxLen - 1) + '...';
}

export function trimPrice(valToTrim, maxLen = 9, errVal = '') {
  if (typeof valToTrim !== 'string') {
    return errVal;
  }
  if (valToTrim.length <= maxLen) {
    return valToTrim;
  }
  return valToTrim.substring(0, maxLen - 1) + '...';
}

export function trimText(valToTrim, maxLen, errVal = '') {
  if (typeof valToTrim !== 'string') {
    return errVal;
  }
  return valToTrim.length <= maxLen ? valToTrim : valToTrim.substring(0, maxLen - 1) + '...';
}

export function trimTextNum(valToTrim, maxLen, errVal = '') {
  if (typeof valToTrim !== 'number') {
    return errVal;
  }
  const text = valToTrim.toString();
  return text.length <= maxLen ? text : text.substring(0, maxLen - 1) + '...';
}

// PROJECTS ----------------------------------------------------------------------------------

export async function fetchProjects({
  pageSize = 16,
  maxPages = null,
  all = false,
  delayMs = 1000,
  loggerFn = null,
  processResultFn = null,
} = {}) {
  console2.log('fetchProjects', pageSize, maxPages, all, delayMs);

  const params = getAlphabotFilterParams();
  console2.log('params:', params);

  const alphas = all ? '' : params.alphas.map((a) => `alpha=${a}`).join('&');
  const filters = params.filters.map((a) => `filter=${a}`).join('&') || ''; // todo? 'filter=unregistered';
  const scope = params.scope || 'all'; // 'community';
  const hidden = params.hidden || false;
  const sort = params.sortBy || 'ending';
  const sortDir = params.sortDir || '1';
  const search = params.q || '';
  const reqFilters = params.reqFilters?.length
    ? params.reqFilters.map((a) => `req=${a}`).join('&') || 'req='
    : '';

  let pageNum = 0;
  const projects = [];

  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (maxPages && pageNum >= maxPages) {
      console2.log('Max result!', maxPages, pageNum);
      return projects;
    }

    if (loggerFn) {
      loggerFn(pageNum);
    }

    const url = `https://www.alphabot.app/api/projects?sort=${sort}&scope=${scope}&sortDir=${sortDir}&showHidden=${hidden}&pageSize=${pageSize}&pageNum=${pageNum}&search=${search}&${filters}&${reqFilters}&${alphas}`;
    console2.log('url:', url);

    const result = await fetchHelper(url);
    console2.log('result', result);

    if (result.error || !result.data) {
      console2.error(result);
      return null;
    }

    if (result.data.length === 0) {
      return projects;
    }

    projects.push(...result.data);

    if (processResultFn) {
      await processResultFn(result.data);
    }

    pageNum++;

    await sleep(delayMs);
  }
}

function getUrlParams(url = window?.location) {
  let params = {};
  new URL(url).searchParams.forEach(function (val, key) {
    if (params[key] !== undefined) {
      if (!Array.isArray(params[key])) {
        params[key] = [params[key]];
      }
      params[key].push(val);
    } else {
      params[key] = val;
    }
  });
  return params;
}

function getAlphabotFilterParams() {
  const params = getUrlParams();
  console2.log('params', params);

  if (!params.filters) {
    params.filters = [];
  }
  if (typeof params.filters === 'string') {
    params.filters = [params.filters];
  }
  if (!params.alphas) {
    params.alphas = [];
  }
  if (typeof params.alphas === 'string') {
    params.alphas = [params.alphas];
  }
  if (typeof params.filters === 'string') {
    params.filters = [params.filters];
  }
  if (typeof params.reqFilters === 'string') {
    params.reqFilters = [params.reqFilters];
  }
  return params;
}

// RAFFLES ----------------------------------------------------------------------------------

export async function getRaffles(authKey, options) {
  const raffles = await fetchRaffles(authKey, options);
  console.log('raffles', raffles);
  return raffles.length ? raffles.map((x) => convertRaffle(x)) : [];
}

async function fetchRaffles(
  authKey,
  {
    sort = 'ending',
    scope = 'all',
    show_hidden = false,
    search = '',
    project = '',
    filter = 'unregistered',
    page_size = 16,
    interval = 2000,
    max,
    statusLogger,
  } = {}
) {
  console2.log('fetchRaffles');

  if (statusLogger) {
    statusLogger.mid(`Get Alphabot raffles...`);
  }

  const raffles = [];
  let page = 0;
  let count = 0;

  while (page >= 0) {
    const url = RAFFLES_BASE_URL.replace('{SORT}', sort)
      .replace('{SCOPE}', scope)
      .replace('{SHOW_HIDDEN}', show_hidden)
      .replace('{SEARCH}', search)
      .replace('{PROJECT}', project)
      .replace('{FILTER}', filter)
      .replace('{PAGE_SIZE}', page_size)
      .replace('{PAGE_NUM}', page);

    if (statusLogger) {
      statusLogger.mid(`Get Alphabot raffles page ${page + 1}`);
    }

    console2.log(`fetchRaffles page: ${page}, ${url}`);
    const headers = authKey ? { Authorization: authKey } : {};
    const result = await fetchHelper(url, { method: 'GET', headers }, rateLimitHandler);
    console2.log('result', result);

    if (result.error) {
      if (statusLogger) {
        statusLogger.sub('Failed getting Alphabot raffles. Error:' + result.error.toString());
      }
      return { error: true, result, raffles };
    }

    if (result?.data && !result.data.length) {
      return raffles;
    }

    raffles.push(...result.data);

    count += result.data.length;
    if (max && count > max) {
      console2.log('Max fetched:', count, '>=', max);
      return raffles;
    }

    if (result.data.length < page_size) {
      console2.log('Less than page_size results, no more result after this!');
      return raffles;
    }

    console2.info(`Sleep ${interval} ms before next fetch`);
    await sleep(interval);

    page++;
  }

  return raffles;
}

function convertRaffle(obj) {
  console.log('obj', obj);

  return {
    provider: 'alphabot',
    id: obj._id,
    name: obj.name,
    slug: obj.slug,
    url: `https://www.alphabot.app/${obj.slug}`,
    myEntry: null,
    hasEntered: obj.isRegistered,
    winnerCount: obj.winnerCount,
    entryCount: obj.entryCount,
    startDate: obj.startDate,
    endDate: obj.endDate,
    mintDate: obj.project?.mintDate,

    blockchain: obj.blockchain,
    chain: obj.blockchain,
    remainingSeconds: undefined,
    status: obj.status,
    active: obj.status === 'active',
    whitelistMethod: typeof obj.dtc !== 'undefined' ? (obj.dtc ? 'DTC' : 'NOT_DTC') : '',
    dtc: typeof obj.dtc !== 'undefined' ? obj.dtc : undefined,

    collabId: undefined,
    collabLogo: undefined,
    collabBanner: obj.bannerImageUrl,
    collabTwitterUrl: obj.twitterUrl,
    collabTwitterHandle: normalizeTwitterHandle(obj.twitterUrl),
    collabDiscordUrl: obj.discordUrl,

    teamId: obj.teamId,
    teamName: obj.alphaTeam?.name,
    teamLogo: obj.alphaTeam?.imageUrl,
    teamTwitterUrl: undefined,

    reqString: obj.reqString,
    requirePremium: obj.requirePremium,
  };
}

// ACCOUNT -----------------------

export async function getAccount() {
  const result = await fetchHelper(ACCOUNT_URL, {});
  console2.log('getAccount:', result);
  const id = result?.data?._id;
  const _id = id?.toString ? id.toString().toLowerCase() : null;
  return {
    id: _id,
    userName:
      result?.data?.user?.name ||
      result?.data?.connections?.find((x) => x.provider === 'discord')?.name ||
      result?.data?.ensName ||
      undefined,
  };
}

export async function getUserId() {
  const result = await fetchHelper(ACCOUNT_URL, {});
  console2.log('fetchAccountAddress:', result);
  return result?.data?._id;
}

// TODO obsolete, replace with getAccount()
export async function fetchAccountAddress() {
  const result = await fetchHelper(ACCOUNT_URL, {});
  console2.log('fetchAccountAddress:', result);
  return result?.data?.address;
}

// CALENDAR -----------------------

function addMonths(date, months) {
  date.setMonth(date.getMonth() + months);
  return date;
}

export async function getCalendars(date, monthsBack = 0, monthsForward = 0) {
  const arr = [];
  for (let i = monthsBack; i > 0; i--) {
    arr.push(addMonths(new Date(date.getTime()), -i));
  }
  arr.push(date);
  for (let i = 1; monthsForward && i <= monthsForward; i++) {
    arr.push(addMonths(new Date(date.getTime()), i));
  }
  console2.log('arr', arr);

  const projects = [];
  for (let d of arr) {
    console2.log('date:', d);
    const result = await getCalendar(d);
    if (result?.length) {
      projects.push(...result);
    }
    await sleep(1500);
  }

  return projects.reverse();
}

export async function getCalendar(date) {
  console2.log('getCalendar, date:', date);
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);

  const url = CALENDAR_URL.replace('{START_DATE}', firstDay.getTime()).replace(
    '{END_DATE}',
    lastDay.getTime()
  );

  const result = await fetchHelper(url, {});
  console2.log('getCalendar:', result);

  if (result.error || !result.data?.projects) {
    return { error: true, result };
  }

  return result.data.projects;
}

// WINS -----------------------

export async function getWinsByNewest(
  account,
  { interval = 1500, max = null, lastEndDate = null, statusLogger = null } = {}
) {
  const checkIfContinueFn = !lastEndDate
    ? null
    : (partResult) => {
        if (!partResult?.data?.length) {
          console2.trace('getWinsByNewest do not continue (!length)');
          return false;
        }
        const endDate = partResult.data[0].endDate;
        console2.trace(
          'getWinsByNewest endDate, lastEndDate, endDate < lastEndDate:',
          endDate,
          lastEndDate,
          endDate < lastEndDate
        );
        if (endDate && endDate < lastEndDate) {
          console2.trace('getWinsByNewest do not continue (endDate < lastEndDate)');
          return false;
        }
        console2.trace('getWinsByNewest continue');
        return true;
      };
  return getWins(account, {
    interval,
    max,
    sortBy: 'newest',
    checkIfContinueFn,
    statusLogger,
  });
}

export async function getWinsByMinting(account, { interval = 1500, max = null } = {}) {
  return getWins(account, { interval, max, sortBy: 'minting' });
}

async function getWins(account, { interval, max, sortBy, checkIfContinueFn, statusLogger }) {
  const result = await fetchWins({ interval, max, sortBy, checkIfContinueFn, statusLogger });
  if (result.error) {
    if (statusLogger) {
      statusLogger.sub(`Error when getting Alphabot results!`);
    }
    return [];
  }
  return convertWins(result, account);
}

async function fetchWins({ interval, max, sortBy, pageLength = 16, checkIfContinueFn = null, statusLogger }) {
  console2.info('Fetch wins; pageLength:', pageLength);

  const wins = [];
  let pageNum = 0;
  let count = 0;

  while (pageNum >= 0) {
    if (statusLogger) {
      statusLogger.mid(`Get Alphabot results page ${count + 1}`);
    }
    const url = WINS_BASE_URL.replace('{PAGE_NUM}', pageNum)
      .replace('{PAGE_SIZE}', pageLength)
      .replace('{SORT_BY}', sortBy);
    console2.info(`fetchWins page: ${pageNum}, ${url}`);
    const result = await fetchHelper(url, { method: 'GET' }, rateLimitHandler);
    console2.log('result', result);

    if (result.error) {
      return { error: true, result, wins };
    }

    if (result?.ok && !result.data?.length) {
      return wins;
    }

    wins.push(...result.data);

    count += result.data.length;
    if (max && count > max) {
      console2.info('Max wins fetched:', count, '>=', max);
      return wins;
    }

    if (checkIfContinueFn && !checkIfContinueFn(result)) {
      console2.log('checkIfContinueFn() says to stop');
      return wins;
    }

    console2.info(`Sleep ${interval} ms before next fetch`);
    await sleep(interval);

    pageNum++;
  }

  return wins;
}

export function cleanTwitterUrl(str) {
  if (typeof str !== 'string') {
    return str;
  }
  let url = str;
  if (url.startsWith('//twitter.com/')) {
    url = url.replace('//twitter.com/', '');
  }
  return url;
}

function convertWins(wins, account) {
  console2.trace('wins', wins);
  return wins.map((x) => {
    const provider = 'alphabot';

    const raffleId = x._id;
    const userId = account?.id;
    const userName = account?.userName;

    const startDate = x.startDate;
    const endDate = x.endDate;
    const pickedDate = x.picked;
    const modifyDate = x.updated;

    const mintDate = x.mintDate;
    const mintTime = x.mintDateHasTime ? mintDate : null;

    const twitterHandle = normalizeTwitterHandle(extractTwitterHandle(cleanTwitterUrl(x.twitterUrl)));
    const twitterHandleGuess = twitterHandle;
    const twitterBannerImage = x.twitterBannerImage;
    const discordUrl = x.discordUrl;
    const websiteUrl = null;

    const wallets = x.entry?.mintAddress ? [x.entry.mintAddress] : [];

    const hxId = `${provider}-${userId}-${raffleId}`;
    const hxSortKey = mintDate || pickedDate;
    //const hxUpdated = null;

    const id = raffleId;
    const name = x.name;
    const slug = x.slug;
    const url = 'https://www.alphabot.app/' + slug;

    const teamName = x.alphaTeam?.name;
    const teamId = x.teamId;
    const blockchain = x.blockchain;
    const dtc = x.dtc;
    const entryCount = x.entryCount;
    const winnerCount = x.winnerCount;
    const maxWinners = null;

    const supply = x.supply;
    const mintPrice = null;
    const pubPrice = x.pubPrice;
    const wlPrice = x.wlPrice;

    const dataId = x.dataId;
    const type = x.type;

    const status = x.status;
    const collabId = null;
    const collabName = null;

    return {
      hxId,
      hxSortKey,
      //hxUpdated,

      provider,
      userId,
      userName,

      id,
      name,
      slug,
      url,

      startDate,
      endDate,
      pickedDate,
      modifyDate,
      mintDate,
      mintTime,

      twitterHandle,
      twitterHandleGuess,
      twitterBannerImage,
      discordUrl,
      websiteUrl,

      wallets,

      teamName,
      teamId,
      blockchain,
      dtc,
      entryCount,
      winnerCount,
      maxWinners,

      supply,
      pubPrice,
      wlPrice,
      mintPrice,

      dataId,
      type,

      status,
      collabId,
      collabName,
    };
  });
}

// RAFFLE API: WAITERS ---------------------------------------------

export async function waitForRafflePageLoaded(options, maxWait = null) {
  console2.info('Wait for raffle page to load');

  const toWait = typeof maxWait === 'number' ? maxWait : options.ALPHABOT_WAIT_FOR_RAFFLE_PAGE_LOADED;

  const stopTime = millisecondsAhead(toWait);
  while (Date.now() <= stopTime) {
    if (document.querySelector('[data-action="view-project-register"]')) {
      console2.info('Raffle page has loaded!');
      return true;
    }
    if (document.querySelector('[data-action="view-project-cancel-registration"]')) {
      console2.info('Raffle page has loaded!');
      return true;
    }
    await sleep(1000);
  }

  console2.warn('Raffle page has NOT loaded!');
  return false;
}

// RAFFLE API: RAFFLE GETTERS ---------------------------------------------

export function getRaffleTwitterHandle({ normalize = true } = {}) {
  const twitterLink = document.querySelector('a[data-action="option-twitter"]');
  if (!twitterLink) {
    return '';
  }
  console2.log('twitterLink', twitterLink);

  const twitterHandle = extractTwitterHandle(twitterLink?.href);
  if (!twitterHandle) {
    return '';
  }
  console2.log('twitterHandle', twitterHandle);

  return !normalize ? twitterHandle : normalizeTwitterHandle(twitterHandle.replace('@', ''));
}

export function getTwitterHandle({ normalize = true } = {}) {
  try {
    const elems = [...document.querySelectorAll('div.MuiSelect-select[role="button"]')].filter((e) =>
      e.innerText.startsWith('@')
    );
    const h = elems?.length === 1 ? elems[0].innerText : '';
    return !normalize ? h : normalizeTwitterHandle(h.replace('@', ''));
  } catch (e) {
    return '';
  }
}

export function getDiscordHandle({ normalize = true } = {}) {
  try {
    const elems = [...document.querySelectorAll('div.MuiBox-root')].filter((e) =>
      e.innerText.toLowerCase().startsWith('discord:')
    );
    if (!elems || !elems.length) {
      return '';
    }
    const h = elems[0].querySelector('div[role="button"]')?.innerText || '';
    return !normalize ? h : normalizeDiscordHandle(h);
  } catch (e) {
    return '';
  }
}

export function getMustJoinLinks(options, mustHaveRole = false) {
  try {
    let baseElems;
    if (mustHaveRole) {
      baseElems = [...document.querySelectorAll('p.MuiTypography-root')].filter(
        (e) =>
          e.innerText.toLowerCase().includes('join') &&
          e.innerText.toLowerCase().includes('discord') &&
          e.innerText.toLowerCase().includes('have role')
      );
    } else {
      baseElems = [...document.querySelectorAll('p.MuiTypography-root')].filter(
        (e) => e.innerText.toLowerCase().includes('join') && e.innerText.toLowerCase().includes('discord')
      );
    }
    const elems = baseElems
      .map((e) => e.getElementsByTagName('a'))
      .map((e) => Array.from(e))
      .flat();
    const links = noDuplicates(elems.map((x) => x.href));

    return { elems, links };
  } catch (e) {
    return { elems: [], links: [] };
  }
}

export function getMustFollowLinks() {
  try {
    const elems = [...document.querySelectorAll('a')].filter(
      (elem) => isTwitterURL(elem.href) && elem.href.toLowerCase().includes('intent/user?')
    );
    const links = noDuplicates(elems.map((x) => x.href));
    return { elems, links };
  } catch (e) {
    return { elems: [], links: [] };
  }
}

export function getMustLikeLinks() {
  try {
    const elems = parseTwitterLinks('like\n');
    const links = noDuplicates(elems.map((x) => x.href));
    return { elems, links };
  } catch (e) {
    return { elems: [], links: [] };
  }
}

export function getMustRetweetLinks() {
  try {
    const elems = parseTwitterLinks('retweet\n');
    const links = noDuplicates(elems.map((x) => x.href));
    return { elems, links };
  } catch (e) {
    return { elems: [], links: [] };
  }
}

export function getMustLikeAndRetweetLinks() {
  try {
    const elems = parseTwitterLinks('like & retweet\n');
    const links = noDuplicates(elems.map((x) => x.href));
    return { elems, links };
  } catch (e) {
    return { elems: [], links: [] };
  }
}

export function getSelectedWallet() {
  try {
    const elems = [...document.querySelectorAll('div.MuiAlert-message')].filter((x) =>
      x.innerText.toLowerCase().includes(' mint wallet:\n')
    );
    if (!elems?.length) {
      return null;
    }
    const elem = elems[0].querySelector('div[role="button"]');
    if (!elem) {
      return null;
    }

    const shortWallet = elem?.innerText || '';
    const longWallet = elem.nextSibling?.value || '';
    const tokens = shortWallet.split('...');
    const shortPrefix = tokens.length >= 2 ? tokens[0] : '';
    const shortSuffix = tokens.length >= 2 ? tokens[1] : '';

    return { shortWallet, longWallet, shortPrefix, shortSuffix };
  } catch (e) {
    console2.error(e);
    return null;
  }
}

export function getWonWalletsByThisAccount() {
  try {
    const elems = [
      ...[...document.querySelectorAll('div.MuiBox-root')].filter(
        (x) => x.innerText.toLowerCase() === 'you won'
      ),
    ];
    if (!elems?.length) {
      return [];
    }
    return [...elems[0].nextElementSibling.querySelectorAll('p')]
      .filter((x) => x.innerText.includes('...'))
      .map((x) => x.innerText);
  } catch (e) {
    console2.error(e);
    return [];
  }
}

// todo add options
export async function getRegisterButton(options, maxWait = 1000, interval = 10) {
  const regPlus1Btn = await waitForTextContains(
    options.ALPHABOT_REG_PLUS_1_BTN_SEL,
    'button',
    maxWait,
    interval
  );
  if (regPlus1Btn) {
    return regPlus1Btn;
  }
  return await waitForSelector(options.ALPHABOT_REG_BTN_SEL, 60 * ONE_SECOND, 100);
}

// todo add options
export function getRegisterButtonSync(options, mustHaveAllBtns = false) {
  console2.log('getRegisterButtonSync; mustHaveAllBtns:', mustHaveAllBtns);
  const regPlus1Btn = getTextContains(options.ALPHABOT_REG_PLUS_1_BTN_SEL, 'button');
  if (regPlus1Btn) {
    if (mustHaveAllBtns) {
      return document.querySelector(options.ALPHABOT_REG_BTN_SEL) ? regPlus1Btn : null;
    }
    return regPlus1Btn;
  }
  return document.querySelector(options.ALPHABOT_REG_BTN_SEL);
}

export function getErrors() {
  const elems = [...document.querySelectorAll('.MuiAlert-standardError')].map((x) =>
    x.innerText.toLowerCase()
  );
  return {
    texts: elems,
    twitter: elems.some((x) => x.includes('follow') || x.includes('like') || x.includes('retweet')),
    discord: elems.some((x) => x.includes('join')),
    discordRoled: elems.some((x) => x.includes('join') && x.includes('have role')),
  };
}

export function getTeamName() {
  // /from\\n\\n([a-z0-9 ]*)\\n\\non/i
  const elem = document.querySelector(
    '.MuiChip-root.MuiChip-filled.MuiChip-sizeSmall.MuiChip-colorSecondary.MuiChip-filledSecondary'
  );
  return elem?.innerText || '';
}

// RAFFLE API: HAS CHECKERS ---------------------------------------------

export function hasRegistered() {
  const elems = [...document.querySelectorAll('h5')].filter(
    (e) =>
      e.innerText === 'Registered successfully' || e.innerText === 'Your wallet was submitted successfully'
  );
  const result = elems.length > 0;
  return result;
}

export async function hasRaffleTrigger() {
  const elem = await waitForTextContains('mint wallet', '.MuiAlert-message', 10 * ONE_SECOND, 50);
  console2.log('hasRaffleTrigger:', elem);
  return !!elem;
}

export async function hasRaffleTrigger2(options) {
  const elem = await waitForSelector(options.ALPHABOT_REG_BTN_SEL, 60 * ONE_SECOND, 100);
  console2.log('hasRaffleTrigger2:', elem);
  return !!elem;
}

// RAFFLE API: IS CHECKERS ---------------------------------------------

export function isAllRegBtnsEnabled(options) {
  const regBtn = document.querySelector(options.ALPHABOT_REG_BTN_SEL);
  const regPlus1Btn = getTextContains(options.ALPHABOT_REG_PLUS_1_BTN_SEL, 'button');
  console2.log('regBtn', regBtn);
  console2.log('regPlus1Btn', regPlus1Btn);
  if (regBtn?.disabled) {
    return false;
  }
  if (regPlus1Btn?.disabled) {
    return false;
  }
  if (regBtn || regPlus1Btn) {
    return true;
  }
  return false;
}

// API HELPERS

export function getJoinButton() {
  try {
    return [...[...document.querySelectorAll('button.px-8')].filter((x) => (x.innerText = 'Join'))].filter(
      (x) => x.nextSibling?.innerText === 'Join'
    )[0];
  } catch (e) {
    return null;
  }
}

export function getJoiningButton() {
  try {
    return [
      ...[...document.querySelectorAll('button.px-8')].filter((x) => (x.innerText = 'Joining...')),
    ].filter((x) => x.nextSibling?.innerText === 'Join')[0];
  } catch (e) {
    return null;
  }
}

export function getRegisteringButton() {
  return getJoiningButton();
}

export function hasErrors() {
  return false;
  /*
  return (
    [...document.querySelectorAll('path')].filter(
      (x) =>
        x.getAttribute('d') ===
        'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z'
    ).length > 0
  );
  */
}

// MISC HELPERS

function parseTwitterLinks(prefix) {
  const elems = [
    ...[...document.querySelectorAll('div.MuiPaper-root')].filter((e) =>
      e.innerText.toLowerCase().startsWith(prefix)
    ),
  ];
  const val = elems.length < 1 ? [] : Array.from(elems[0].getElementsByTagName('a'));
  console2.log('parseTwitterLinks:', prefix, val);
  return val;
}
