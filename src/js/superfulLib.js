import global from './global.js';
console.log('global:', global);

import { sleep, fetchHelper, rateLimitHandler, myConsole, noDuplicates, millisecondsAhead } from 'hx-lib';

import {
  normalizeTwitterHandle,
  normalizeDiscordHandle,
  getMyTabIdFromExtension,
  getFromWebPage,
} from './premintHelperLib.js';

const console2 = myConsole(global.LOGLEVEL);
console2.log();

// DATA ----------------------------------------------------------------------------------

const SLEEP_SUPERFUL_LIB_FETCH_RAFFLES = 2000;

const ACCOUNT_URL = 'https://www.superful.xyz/superful-api/v1/account/settings';

// https://www.superful.xyz/superful-api/v1/project/event/submissions?page=1&page_size=10&status=accepted
const WINS_BASE_URL =
  'https://www.superful.xyz/superful-api/v1/project/event/submissions?page={PAGE}&page_size={PAGE_SIZE}&status={STATUS}';

const RAFFLES_BASE_URL = 'https://www.superful.xyz/superful-api/v1/project/events';

// ACCOUNT -----------------------

export async function getAccount(authKey, options = {}) {
  console2.log('url:', ACCOUNT_URL);
  const headers = authKey ? { Authorization: authKey } : {};
  const result = await fetchHelper(ACCOUNT_URL, { method: 'GET', headers, ...options }, rateLimitHandler);
  console2.log('getAccount:', result);

  const address = result?.data?.address;
  const _id = address?.toString ? address.toString().toLowerCase() : null;

  return {
    id: _id,
    address,
  };
}

// AUTH -------------------------------------------

export async function getAuth(context) {
  if (!context.myTabId) {
    await getMyTabIdFromExtension(context, 5000);
  }
  if (!context.myTabId) {
    console2.error('Invalid myTabId');
    return null;
  }
  const authKey = await getFromWebPage(`https://www.superful.xyz/about`, 'getAuth', context.myTabId, context);
  console2.log('authKey', authKey);
  console2.log('context', context);

  if (typeof authKey !== 'string') {
    return null;
  }

  const authKeyTrim = authKey.replace('%20', ' ');

  return authKeyTrim;
}

// RAFFLE -------------------------------------------

// RAFFLES ----------------------------------------------------------------------------------

export async function getRaffles(authKey, options) {
  const raffles = await fetchRaffles(authKey, options);
  console.log('raffles', raffles);
  return raffles.length ? raffles.map((x) => convertRaffle(x)) : [];
}

async function fetchRaffles(authKey, { search_text = '', page_size = 12, interval, max, statusLogger } = {}) {
  console2.log('fetchRaffles');

  if (statusLogger) {
    statusLogger.mid(`Get Superful raffles...`);
  }

  const raffles = [];
  let page = 0;

  while (page >= 0) {
    page++;

    const url = RAFFLES_BASE_URL;

    if (statusLogger) {
      statusLogger.mid(`Get Superful raffles page ${page}`);
    }

    console2.log(`fetchRaffles page: ${page}, ${url}`);
    const headers = authKey ? { Authorization: authKey } : {};
    const result = await fetchHelper(
      url,
      {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          page,
          page_size,
          search_text,
        }),
        credentials: 'include',
      },
      rateLimitHandler
    );
    console2.log('result', result);

    if (result.error) {
      if (statusLogger) {
        statusLogger.sub('Failed getting Superful raffles. Error:' + result.error.toString());
      }
      return { error: true, result, raffles };
    }

    raffles.push(...result.data.results);

    if (result?.data?.pagination?.page_count <= page) {
      return raffles;
    }

    if (max && raffles.length > max) {
      console2.log('Max fetched:', raffles.length, '>=', max);
      return raffles;
    }

    const delay = interval || SLEEP_SUPERFUL_LIB_FETCH_RAFFLES;

    console2.info(`Sleep ${delay} ms before next fetch`);
    await sleep(delay);
  }

  return raffles;
}

function makeDate(endDateStr, endTimeStr) {
  try {
    if (typeof endDateStr !== 'string' || typeof endTimeStr !== 'string') {
      return null;
    }
    const d = new Date(endDateStr + ' ' + endTimeStr).getTime();
    return d;
  } catch (e) {
    return null;
  }
}

function convertRaffle(obj) {
  console.log('obj', obj);
  return {
    provider: 'superful',
    id: obj.id,
    name: obj.name,
    slug: obj.slug,
    url: `https://www.superful.xyz/${obj.slug}`,
    myEntry: undefined,
    hasEntered: !!obj.joined,
    winRate: obj.win_rate,
    winnerCount: obj.spots,
    entryCount: Math.floor(obj.spots / (1 / obj.win_rate)),
    startDate: undefined,
    endDate: makeDate(obj.end_date, obj.end_time),
    mintDate: obj.collab?.mint_date,
    mintTime: obj.collab?.mint_time,
    mintPrice: obj.collab?.mint_price,
    supply: obj.collab?.total_supply,

    blockchain: obj.project?.blockchain,
    chain: obj.project?.blockchain,
    remainingSeconds: undefined,
    status: undefined,
    active: undefined,
    whitelistMethod: obj.allowlist_method,
    dtc: obj.allowlist_method?.toLowerCase() === 'dtc',

    collabId: obj.collab?.project_name,
    collabLogo: obj.collab?.logo_url,
    collabBanner: obj.collab?.banner_url,
    collabTwitterUrl: undefined,
    collabTwitterHandle: normalizeTwitterHandle(obj.collab?.twitter_handler),
    collabDiscordUrl: undefined,
    collabName: obj.collab?.project_name,

    teamId: obj.project?.name,
    teamName: obj.project?.name,
    teamLogo: obj.project?.logo_url,
    teamBanner: obj.project?.banner_url,
    teamTwitterUrl: undefined,
  };
}

// WINS ----------------------------------------------------------------------------------

export async function getWins(account, authKey, { interval, max, sortBy, checkIfContinueFn, statusLogger }) {
  const result = await fetchWins(authKey, { interval, max, sortBy, checkIfContinueFn, statusLogger });
  if (result.error) {
    if (statusLogger) {
      statusLogger.sub(`Error when getting Superful results!`);
    }
    return [];
  }
  return convertWins(result, account);
}

async function fetchWins(
  authKey,
  { interval, max, pageLength = 10, checkIfContinueFn = null, statusLogger }
) {
  console2.info('Fetch wins; pageLength:', pageLength);

  const wins = [];
  let pageNum = 0;
  let count = 0;

  while (pageNum >= 0) {
    if (statusLogger) {
      statusLogger.mid(`Get Superful results page ${count + 1}`);
    }
    const url = WINS_BASE_URL.replace('{PAGE}', pageNum)
      .replace('{PAGE_SIZE}', pageLength)
      .replace('{STATUS}', 'accepted');
    console2.info(`fetchWins page: ${pageNum}, ${url}`);
    const headers = authKey ? { Authorization: authKey } : {};
    const result = await fetchHelper(url, { method: 'GET', headers }, rateLimitHandler);
    console2.log('result', result);

    if (result.error) {
      return { error: true, result, wins };
    }

    if (result?.ok && !result.data?.results?.length) {
      return wins;
    }

    wins.push(...result.data.results);

    if (result?.data.pagination?.page_count && result?.data.pagination?.page_count === pageNum) {
      return wins;
    }

    count += result.data.results.length;
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

function convertWins(wins, account) {
  console2.trace('wins', wins);
  return wins.map((x) => {
    console2.trace('x', x);
    const provider = 'superful';

    const raffleId = x.id;
    const userId = account.id;
    const userName = account?.userName;

    const startDate = undefined;
    const endDate = makeDate(x.event_end_date, x.event_end_time);
    const pickedDate = undefined;
    const modifyDate = undefined;
    const joinDate = x.joined_at;

    const mintDate = makeDate(
      firstDefined(x.mint_date, x.collab_info?.mint_date),
      firstDefined(x.mint_time, x.collab_info?.mint_time)
    );
    const mintTime = undefined;

    const twitterHandle = normalizeTwitterHandle(x.collab_info?.twitter_handler);
    const twitterHandleGuess = twitterHandle;
    const twitterBannerImage = undefined;
    const discordUrl = x.collab_info?.discord_invite_code;
    const websiteUrl = undefined;

    const wallets = x.mint_address ? [x.mint_address] : [];

    const hxId = `${provider}-${userId}-${raffleId}`;
    const hxSortKey = mintDate || endDate || joinDate;
    //const hxUpdated = null;

    const id = raffleId;
    const name = x.event_name;
    const slug = x.event_slug;
    const url = 'https://www.superful.xyz/' + x.event_slug;

    const teamName = x.project_name;
    const teamId = x.project_name;
    const blockchain = x.collab_info?.blockchain;
    const dtc = x.event_allowlist_method?.toLowerCase() === 'dtc';
    const wlMethod = x.event_allowlist_method;
    const entryCount = undefined;
    const winnerCount = undefined;
    const maxWinners = null;

    const supply = firstDefined(x.total_supply, x.collab_info?.total_supply);
    const mintPrice = firstDefined(x.mint_price, x.collab_info?.mint_price);
    const pubPrice = undefined;
    const wlPrice = mintPrice;

    const dataId = undefined;
    const type = x.event_type;

    const status = x.status;
    const collabId = undefined;
    const collabName = x.collab_info?.project_name;

    return {
      obj: x,

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
      joinDate,

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
      wlMethod,
    };
  });
}

function firstDefined(val1, val2) {
  let r = val2;
  if (typeof val1 !== 'undefined' && val1 !== null) {
    r = val1;
  }
  console.log('firstDefined', val1, val2, r);
  return r;
}

// RAFFLE API: WAITERS ---------------------------------------------
export async function waitForRafflePageLoaded(options, maxWait = null) {
  console2.info('Wait for raffle page to load');

  const toWait = typeof maxWait === 'number' ? maxWait : options.SUPERFUL_WAIT_FOR_RAFFLE_PAGE_LOADED;

  const stopTime = millisecondsAhead(toWait);
  while (Date.now() <= stopTime) {
    if (hasRegistered()) {
      return true;
    }
    const du = getDiscordHandle();
    const tu = getTwitterHandle();
    console2.log('du, tu:', du, tu);
    if (du || tu) {
      console2.info('Raffle page has loaded!');
      await sleep(1000);
      return true;
    }
    await sleep(1000);
  }

  console2.warn('Raffle page has NOT loaded!');
  return false;
}

// RAFFLE API: RAFFLE GETTERS ---------------------------------------------

export function getRaffleTwitterHandle() {
  return '';
}

export function getTwitterHandle({ normalize = true } = {}) {
  try {
    const h = [...[...document.querySelectorAll('div')].filter((x) => x.innerText === 'Twitter')][0]
      .nextSibling?.innerText;
    return !normalize ? h : normalizeTwitterHandle(h.replace('@', ''));
  } catch (e) {
    return '';
  }
}

export function getDiscordHandle({ normalize = true } = {}) {
  try {
    const h = [...[...document.querySelectorAll('div')].filter((x) => x.innerText === 'Discord')][0]
      .nextSibling?.innerText;
    return !normalize ? h : normalizeDiscordHandle(h);
  } catch (e) {
    return '';
  }
}

export function getMustJoinLinks() {
  try {
    const elems = [
      ...[...document.querySelectorAll('div')]
        .filter((x) => x.innerText.startsWith('Join') && x.innerText.endsWith('Discord'))[1]
        .querySelectorAll('a'),
    ]
      .filter((x) => x.href.includes('discord.'))
      .flat();
    const links = noDuplicates(elems.map((x) => x.href));
    console.log('getMustJoinLinks', elems, links);
    return { elems, links };
  } catch (e) {
    return { elems: [], links: [] };
  }
}

export function getMustFollowLinks() {
  try {
    const elems = [
      ...[...document.querySelectorAll('div')]
        .filter((x) => x.innerText.startsWith('Follow') && x.innerText.endsWith('On Twitter'))[1]
        .querySelectorAll('a'),
    ]
      .filter((x) => x.href.includes('twitter.com'))
      .flat();
    const links = noDuplicates(elems.map((x) => x.href));
    console.log('getMustFollowLinks', elems, links);
    return { elems, links };
  } catch (e) {
    return { elems: [], links: [] };
  }
}

export function getMustLikeLinks() {
  try {
    const elems = [
      ...[...document.querySelectorAll('div')]
        .filter(
          (x) =>
            x.innerText.startsWith('Must Like') &&
            !x.innerText.startsWith('Must Like & Retweet') &&
            x.innerText.endsWith('This Tweet')
        )[1]
        .querySelectorAll('a'),
    ]
      .filter((x) => x.href.includes('twitter.com'))
      .flat();
    const links = noDuplicates(elems.map((x) => x.href));
    console.log('getMustLikeLinks', elems, links);
    return { elems, links };
  } catch (e) {
    return { elems: [], links: [] };
  }
}

export function getMustRetweetLinks() {
  try {
    const elems = [
      ...[...document.querySelectorAll('div')]
        .filter(
          (x) =>
            x.innerText.startsWith('Must Retweet') &&
            !x.innerText.startsWith('Must Like & Retweet') &&
            x.innerText.endsWith('This Tweet')
        )[1]
        .querySelectorAll('a'),
    ]
      .filter((x) => x.href.includes('twitter.com'))
      .flat();
    const links = noDuplicates(elems.map((x) => x.href));
    console.log('getMustRetweetLinks', elems, links);
    return { elems, links };
  } catch (e) {
    return { elems: [], links: [] };
  }
}

export function getMustLikeAndRetweetLinks() {
  try {
    const elems = [
      ...[...document.querySelectorAll('div')]
        .filter((x) => x.innerText.startsWith('Must Like & Retweet') && x.innerText.endsWith('This Tweet'))[1]
        .querySelectorAll('a'),
    ]
      .filter((x) => x.href.includes('twitter.com'))
      .flat();
    const links = noDuplicates(elems.map((x) => x.href));
    console.log('getMustLikeAndRetweetLinks', elems, links);
    return { elems, links };
  } catch (e) {
    return { elems: [], links: [] };
  }
}

export function getSelectedWallet() {
  return null;
}

export function getWonWalletsByThisAccount() {
  return [];
}

export async function getRegisterButton(options, maxWait = 1000, interval = 10) {
  const stopTime = millisecondsAhead(maxWait);
  while (Date.now() <= stopTime) {
    const btn = getJoinButton();
    if (btn) {
      console2.log('getRegisterButton:', btn);
      return btn;
    }
    await sleep(interval);
  }
}

export function getRegisterButtonSync() {
  return getJoinButton();
}

export function getErrors() {
  return [];
}

export function getTeamName() {
  return '';
}

// RAFFLE API: HAS CHECKERS ---------------------------------------------

export function hasRegistered() {
  try {
    const elems = [...document.querySelectorAll('p.font-bold.text-sm.text-center')].filter(
      (x) => x.innerText.toLowerCase() === 'deregister yourself'
    );
    //console.log('hasJoinedRaffle elems', elems);
    if (elems.length > 0) {
      return true;
    }

    if (document.body.innerText.match(/.*Congratulations.*/i)) {
      return true;
    }

    return false;

    // return !!(document.body.innerText.match(/*You have joined the raffle*/));
  } catch (e) {
    return false;
  }
}

export async function hasRaffleTrigger() {
  return !!getJoinButton();
}

export async function hasRaffleTrigger2() {
  return hasRaffleTrigger();
}

// RAFFLE API: IS CHECKERS ---------------------------------------------

export function isAllRegBtnsEnabled(options) {
  const regBtn = getRegisterButtonSync(options);
  // console2.log('regBtn', regBtn);
  if (regBtn?.disabled) {
    return false;
  }
  return !!regBtn;
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
