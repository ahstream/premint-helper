import { createLogger, sleep, fetchHelper } from '@ahstream/hx-lib';

const debug = createLogger();

// DATA ----------------------------------------------------------------------------------

export const winnersSortedByNewestURL = `https://www.alphabot.app/api/projects?sort=newest&scope=all&sortDir=-1&showHidden=true&pageSize=16&filter=winners`;
export const winnersSortedByMintingURL = `https://www.alphabot.app/api/projects?sort=minting&scope=all&sortDir=-1&showHidden=true&pageSize=16&filter=winners`;

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

export async function fetchProjects({ pageSize = 16, maxPages = null, all = false, delayMs = 1000, callback = null } = {}) {
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

    const url = `https://www.alphabot.app/api/projects?sort=${sort}&scope=${scope}&sortDir=${sortDir}&showHidden=${hidden}&pageSize=${pageSize}&pageNum=${pageNum}&search=${search}&${filters}&${alphas}`;
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
  return params;
}
