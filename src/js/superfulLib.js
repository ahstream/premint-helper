import { sleep, fetchHelper, rateLimitHandler, myConsole, noDuplicates, millisecondsAhead } from 'hx-lib';

import {
  normalizeTwitterHandle,
  normalizeDiscordHandle,
  getMyTabIdFromExtension,
  getFromWebPage,
} from './premintHelperLib.js';

const console2 = myConsole();
console2.log();

// DATA ----------------------------------------------------------------------------------

const SLEEP_SUPERFUL_LIB_FETCH_RAFFLES = 2000;

//const ACCOUNT_URL = 'https://luckygo.io/profile';

//const WINS_BASE_URL = 'https://api.luckygo.io/raffle/list/me?type=won&page={PAGE}&size={SIZE}';

const RAFFLES_BASE_URL = 'https://www.superful.xyz/superful-api/v1/project/events';

// ACCOUNT -----------------------

// AUTH -------------------------------------------

export async function getAuth(context) {
  if (!context.myTabId) {
    await getMyTabIdFromExtension(context, 5000);
  }
  if (!context.myTabId) {
    console2.error('Invalid myTabId');
    return null;
  }
  const authKey = await getFromWebPage(
    `https://www.superful.xyz/settings`,
    'getAuth',
    context.myTabId,
    context
  );
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
  return raffles.map((x) => convertRaffle(x));
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

function makeDate(endDate, endTime) {
  try {
    return new Date(endDate + ' ' + endTime).getTime();
  } catch (e) {
    console.error(e);
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
