import { createLogger, sleep, fetchHelper, rateLimitHandler, extractTwitterHandle } from 'hx-lib';

const debug = createLogger();

// DATA ----------------------------------------------------------------------------------

const ACCOUNT_URL = 'https://www.alphabot.app/api/auth/session';

const WINS_BASE_URL =
  'https://www.alphabot.app/api/projects?sort={SORT_BY}&scope=all&sortDir=-1&showHidden=true&pageSize={PAGE_SIZE}&pageNum={PAGE_NUM}&filter=winners';

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
  callback = null,
} = {}) {
  debug.log('fetchProjects', pageSize, maxPages, all, delayMs);

  const params = getAlphabotFilterParams();
  debug.log('params:', params);

  const alphas = all ? '' : params.alphas.map((a) => `alpha=${a}`).join('&');
  const filters = params.filters.map((a) => `filter=${a}`).join('&') || 'filter=unregistered';
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
      debug.log('Max result!', maxPages, pageNum);
      return projects;
    }

    if (callback) {
      callback(pageNum);
    }

    const url = `https://www.alphabot.app/api/projects?sort=${sort}&scope=${scope}&sortDir=${sortDir}&showHidden=${hidden}&pageSize=${pageSize}&pageNum=${pageNum}&search=${search}&${filters}&${reqFilters}&${alphas}`;
    debug.log('url:', url);

    const result = await fetchHelper(url);
    debug.log('result', result);

    if (result.error || !result.data) {
      console.error(result);
      return null;
    }

    if (result.data.length === 0) {
      return projects;
    }

    projects.push(...result.data);
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
  debug.log('params', params);

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
  debug.log('getAccount:', result);
  return {
    userId: result?.data?._id,
    userName:
      result?.data?.user?.name ||
      result?.data?.connections?.find((x) => x.provider === 'discord')?.name ||
      result?.data?.ensName ||
      '',
  };
}

export async function getUserId() {
  const result = await fetchHelper(ACCOUNT_URL, {});
  debug.log('fetchAccountAddress:', result);
  return result?.data?._id;
}

// obsolete, replace with getAccount()
export async function fetchAccountAddress() {
  const result = await fetchHelper(ACCOUNT_URL, {});
  debug.log('fetchAccountAddress:', result);
  return result?.data?.address;
}

// WINS -----------------------

export async function getWinsByNewest(
  account,
  { interval = 1500, max = null, lastPickedDate = null, statusFn = null } = {}
) {
  const checkIfContinueFn = !lastPickedDate
    ? null
    : (partResult) => {
        if (!partResult?.data?.length) {
          console.log('do not continue (!length)');
          return false;
        }
        const picked = partResult.data[0].picked;
        console.log('picked, lastPickedDate:', picked, lastPickedDate);
        if (!picked && picked < lastPickedDate) {
          console.log('do not continue (picked < lastPickedDate)');
          return false;
        }
        return true;
      };
  return getWins(account, { interval, max, lastPickedDate, sortBy: 'newest', checkIfContinueFn, statusFn });
}

export async function getWinsByMinting(account, { interval = 1500, max = null, lastPickedDate = null } = {}) {
  return getWins(account, { interval, max, lastPickedDate, sortBy: 'minting' });
}

async function getWins(account, { interval, max, lastPickedDate, sortBy, checkIfContinueFn, statusFn }) {
  const result = await fetchWins({ interval, max, lastPickedDate, sortBy, checkIfContinueFn, statusFn });
  return result.error ? [] : convertWins(result, account);
}

async function fetchWins({ interval, max, sortBy, pageLength = 16, checkIfContinueFn = null, statusFn }) {
  debug.log('fetchWins; pageLength:', pageLength);

  const wins = [];
  let pageNum = 0;
  let count = 0;

  while (pageNum >= 0) {
    if (statusFn) {
      statusFn(`Get Alphabot results page ${count + 1}`);
    }
    const url = WINS_BASE_URL.replace('{PAGE_NUM}', pageNum)
      .replace('{PAGE_SIZE}', pageLength)
      .replace('{SORT_BY}', sortBy);
    debug.log(`fetchWins page: ${pageNum}, ${url}`);
    const result = await fetchHelper(url, { method: 'GET' }, rateLimitHandler);
    debug.log('result', result);

    if (result.error) {
      return { error: true, result, wins };
    }

    if (result?.ok && !result.data?.length) {
      return wins;
    }

    wins.push(...result.data);

    count += result.data.length;
    if (max && count > max) {
      debug.log('Max wins fetched:', count, '>=', max);
      return wins;
    }

    if (checkIfContinueFn && !checkIfContinueFn(result)) {
      debug.log('checkIfContinueFn() says to stop');
      return wins;
    }

    debug.log(`sleep ${interval} ms before next fetch`);
    await sleep(interval);

    pageNum++;
  }

  return wins;
}

function convertWins(wins, account) {
  debug.log('wins', wins);
  return wins.map((x) => {
    debug.log('win', x);
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

    const twitterHandle = extractTwitterHandle(x.twitterUrl);
    const twitterHandleGuess = twitterHandle;
    const discordUrl = x.discordUrl;
    const websiteUrl = 'todo';

    const wallets = x.entry?.mintAddress ? [x.entry.mintAddress] : [];

    const hxId = `${provider}-${userId}-${raffleId}`;
    const hxSortKey = mintDate || pickedDate;
    //const hxUpdated = null;

    const id = raffleId;
    const name = x.name;
    const slug = x.slug;

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

      startDate,
      endDate,
      pickedDate,
      modifyDate,
      mintDate,
      mintTime,

      twitterHandle,
      twitterHandleGuess,
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
