import { sleep, fetchHelper, rateLimitHandler, extractTwitterHandle, myConsole } from 'hx-lib';

import { normalizeTwitterHandle } from './premintHelperLib.js';

const console2 = myConsole();

// DATA ----------------------------------------------------------------------------------

const ACCOUNT_URL = 'https://www.alphabot.app/api/auth/session';

const WINS_BASE_URL =
  'https://www.alphabot.app/api/projects?sort={SORT_BY}&scope=all&sortDir=-1&showHidden=true&pageSize={PAGE_SIZE}&pageNum={PAGE_NUM}&filter=winners';

const CALENDAR_URL =
  'https://www.alphabot.app/api/projectData?calendar=true&startDate={START_DATE}&endDate={END_DATE}&selectedMonth={SELECTED_MONTH}';

export const winnersSortedByNewestURL = `https://www.alphabot.app/api/projects?sort=newest&scope=all&sortDir=-1&showHidden=true&pageSize=16&filter=winners`;
export const winnersSortedByMintingURL = `https://www.alphabot.app/api/projects?sort=minting&scope=all&sortDir=-1&showHidden=true&pageSize=16&filter=winners`;

// FUNCTIONS ----------------------------------------------------------------------------------

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

// ACCOUNT -----------------------

export async function getAccount() {
  const result = await fetchHelper(ACCOUNT_URL, {});
  console2.log('getAccount:', result);
  const id = result?.data?._id;
  return {
    id,
    address: null,
    userId: id,
    userName:
      result?.data?.user?.name ||
      result?.data?.connections?.find((x) => x.provider === 'discord')?.name ||
      result?.data?.ensName ||
      '',
  };
}

export async function getUserId() {
  const result = await fetchHelper(ACCOUNT_URL, {});
  console2.log('fetchAccountAddress:', result);
  return result?.data?._id;
}

// obsolete, replace with getAccount()
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
      statusLogger.main(`Get Alphabot results page ${count + 1}`);
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
    const userId = account?.userId;
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
