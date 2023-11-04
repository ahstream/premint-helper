import { createLogger, sleep, fetchHelper, rateLimitHandler } from 'hx-lib';

const debug = createLogger();

// DATA ----------------------------------------------------------------------------------

export const winnersSortedByNewestURL = `https://www.alphabot.app/api/projects?sort=newest&scope=all&sortDir=-1&showHidden=true&pageSize=16&filter=winners`;
export const winnersSortedByMintingURL = `https://www.alphabot.app/api/projects?sort=minting&scope=all&sortDir=-1&showHidden=true&pageSize=16&filter=winners`;

const WINNERS_BASE_URL = 'https://atlas3.io/api/me/won-giveaways?&page={PAGE}&pageLength={PAGE_LENGTH}';

// FUNCTIONS ----------------------------------------------------------------------------------

export async function fetchAccountAddress() {
  const result = await fetchHelper('https://www.alphabot.app/api/auth/session', {});
  debug.log('fetchAccountAddress:', result);
  return result?.data?.address;
}

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

// RESULTS -----------------------

// FUNCTIONS ----------------------------------------------------------------------------------

export async function getWinners() {
  const result = await fetchWinners();
  return result.error ? [] : convertWinners(result);
}

async function fetchWinners({ pageLength = 12, interval = 1500 } = {}, checkIfContinueFn = null) {
  debug.log('fetchWinners; pageLength:', pageLength);

  const winners = [];
  let pageNum = 0;

  while (pageNum >= 0) {
    pageNum++;

    const url = WINNERS_BASE_URL.replace('{PAGE}', pageNum).replace('{PAGE_LENGTH}', pageLength);
    debug.log(`fetchWinners page: ${pageNum}, ${url}`);
    const result = await fetchHelper(url, { method: 'GET' }, rateLimitHandler);
    debug.log('result', result);

    if (result.error) {
      return { error: true, result, winners };
    }

    if (result?.ok && !result.data?.giveaways?.length) {
      return winners;
    }

    winners.push(...result.data.giveaways);

    if (result.data.giveaways.length < pageLength) {
      return winners;
    }

    if (checkIfContinueFn && !checkIfContinueFn(result)) {
      debug.log('checkIfContinueFn() says to stop');
      break;
    }

    debug.log(`sleep ${interval} ms before next fetch`);
    await sleep(interval);
  }

  return winners;
}

function convertWinners(winners) {
  return winners.map((x) => {
    const provider = 'atlas3';

    const raffleId = x.id;
    const userId = x.entries[0].userId;
    const createdAt = x.createdAt ? new Date(x.createdAt).getTime() : null;
    const endsAt = x.endsAt ? new Date(x.endsAt).getTime() : null;

    const twitterHandleGuess = x.rules.find((r) => r.type === 'TWITTER_FRIENDSHIP')?.twitterFriendshipRule
      .username;

    return {
      hxId: `${provider}-${userId}-${raffleId}`,
      hxSortKey: endsAt,
      hxUpdated: null,
      hxAccount: userId,

      provider,
      userId,

      id: raffleId,
      name: x.name,
      slug: x.slug,
      updated: null, // ab
      picked: null, // ab

      startDate: createdAt,
      endDate: endsAt,
      pickedDate: endsAt, // atlas

      mintDate: x.collabProject?.mintDate ? new Date(x.endsAt).getTime() : null,
      mintDateHasTime: false,
      mintTime: x.collabProject?.mintTime, // atlas

      twitterHandle: x.collabProject?.twitterUsername,
      twitterHandleGuess,
      discordUrl: x.collabProject?.discordInviteUrl,
      websiteUrl: x.collabProject?.websiteUrl, // atlas

      mintAddress: null, // ab
      wallets: x.entries.filter((e) => e.isWinner).map((e) => e.walletAddress), // atlas

      teamName: x.project?.name,
      teamId: x.projectId,
      blockchain: x.network,
      dtc: null, // ab
      entryCount: x.entryCount,
      winnerCount: Math.min(x.entryCount, x.maxWinners),
      maxWinners: x.maxWinners, // atlas

      supply: x.collabProject?.supply,
      pubPrice: null,
      wlPrice: null,
      mintPrice: x.collabProject?.mintPrice, // atlas

      dataId: null, // ab
      type: x.type,

      status: x.status, // atlas
      collabProjectId: x.collabProjectId, // atlas
      collabName: x.collabProject?.name, // atlas
      collabSlug: x.collabProject?.slug, // atlas
    };
  });
}
