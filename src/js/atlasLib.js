import global from './global.js';
console.log('global:', global);

import {
  sleep,
  fetchHelper,
  rateLimitHandler,
  myConsole,
  noDuplicates,
  millisecondsAhead,
  waitForTextEquals,
  extractTwitterHandle,
  waitForSelector,
  ONE_SECOND,
} from 'hx-lib';

import { normalizeTwitterHandle, normalizeDiscordHandle } from './premintHelperLib.js';

const console2 = myConsole(global.LOGLEVEL);
console2.log();

// DATA ----------------------------------------------------------------------------------

const ACCOUNT_URL = 'https://atlas3.io/api/auth/session';

const WINS_BASE_URL = 'https://atlas3.io/api/me/won-giveaways?&page={PAGE}&pageLength={PAGE_LENGTH}';

// ACCOUNT -----------------------

export async function getAccount() {
  const result = await fetchHelper(ACCOUNT_URL, {});
  console2.log('getAccount:', result);
  const id = result?.data?.user?.id;
  const _id = id?.toString ? id.toString().toLowerCase() : null;
  return {
    id: _id,
    userName: result?.data?.user?.name || undefined,
  };
}

// WINS ----------------------------------------------------------------------------------

export async function getWins(account, { interval = 1500, max = null, statusLogger } = {}) {
  const result = await fetchWins({ interval, max, statusLogger });
  if (result.error) {
    if (statusLogger) {
      statusLogger.sub(`Error when getting Atlas results!`);
    }
    return [];
  }
  return convertWins(result, account);
}

async function fetchWins({ pageLength = 12, interval, max, statusLogger }, checkIfContinueFn = null) {
  console2.info('Fetch wins; pageLength:', pageLength);

  const wins = [];
  let pageNum = 0;
  let count = 0;

  while (pageNum >= 0) {
    pageNum++;

    if (statusLogger) {
      statusLogger.mid(`Get Atlas results page ${count + 1}`);
    }

    const url = WINS_BASE_URL.replace('{PAGE}', pageNum).replace('{PAGE_LENGTH}', pageLength);
    console2.info(`fetchWins page: ${pageNum}, ${url}`);
    const result = await fetchHelper(url, { method: 'GET' }, rateLimitHandler);
    console2.log('result', result);

    if (result.error) {
      return { error: true, result, wins };
    }

    if (result?.ok && !result.data?.giveaways?.length) {
      return wins;
    }

    wins.push(...result.data.giveaways);

    if (result.data.giveaways.length < pageLength) {
      return wins;
    }

    count += result.data.giveaways.length;
    if (max && count > max) {
      console2.log('Max wins fetched:', count, '>=', max);
      return wins;
    }

    if (checkIfContinueFn && !checkIfContinueFn(result)) {
      console2.log('checkIfContinueFn() says to stop');
      break;
    }

    console2.info(`Sleep ${interval} ms before next fetch`);
    await sleep(interval);
  }

  return wins;
}

function convertWins(wins, account) {
  return wins.map((x) => {
    const provider = 'atlas';

    const raffleId = x.id;
    const userId = x.entries[0].userId;
    const userName = account?.userName;

    const startDate = x.createdAt ? new Date(x.createdAt).getTime() : null;
    const endDate = x.endsAt ? new Date(x.endsAt).getTime() : null;
    const pickedDate = endDate;
    const modifyDate = null;

    const mintDate = x.collabProject?.mintDate ? new Date(x.endsAt).getTime() : null;
    const mintTime = x.collabProject?.mintTime;

    const twitterHandle = normalizeTwitterHandle(x.collabProject?.twitterUsername);
    const twitterHandleGuess = normalizeTwitterHandle(
      x.rules.find((r) => r.type === 'TWITTER_FRIENDSHIP')?.twitterFriendshipRule?.username
    );
    const discordUrl = x.collabProject?.discordInviteUrl;
    const websiteUrl = x.collabProject?.websiteUrl;

    const wallets = x.entries.filter((e) => e.isWinner).map((e) => e.walletAddress);

    const hxId = `${provider}-${userId}-${raffleId}`;
    const hxSortKey = endDate;
    //const hxUpdated = null;

    const id = raffleId;
    const name = x.name;
    const slug = x.slug;
    const url = `https://atlas3.io/project/${x.project?.slug}/giveaway/${slug}`;

    const teamName = x.project?.name;
    const teamId = x.projectId;
    const blockchain = x.network;
    const dtc = null;
    const entryCount = x.entryCount;
    const winnerCount = Math.min(x.entryCount, x.maxWinners);
    const maxWinners = x.maxWinners;

    const supply = x.collabProject?.supply;
    const mintPrice = x.collabProject?.mintPrice;
    const pubPrice = null;
    const wlPrice = mintPrice;

    const dataId = null;
    const type = x.type;

    const status = x.status;
    const collabId = x.collabProjectId;
    const collabName = x.collabProject?.name;

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

// MISC

export function getRaffleTwitterHandle(options) {
  const mustFollowLinks = getMustFollowLinks(options);
  console2.log('mustFollowLinks', mustFollowLinks);
  if (!mustFollowLinks?.length) {
    return null;
  }
  const twitterHandle = extractTwitterHandle(mustFollowLinks[0]);
  if (!twitterHandle) {
    return null;
  }
  console2.log('twitterHandle', twitterHandle);

  return twitterHandle;
}

// HELPERS

function countOccurances(str, regexp) {
  return ((str || '').match(regexp) || []).length;
}
// RAFFLE API: WAITERS ---------------------------------------------

export async function waitForRafflePageLoaded(options, maxWait = null) {
  console2.info('Wait for raffle page to load');

  const toWait = typeof maxWait === 'number' ? maxWait : options.ATLAS_WAIT_FOR_RAFFLE_PAGE_LOADED;

  const stopTime = millisecondsAhead(toWait);
  while (Date.now() <= stopTime) {
    if (hasRegistered()) {
      return true;
    }
    const du = getDiscordHandle(options);
    const tu = getTwitterHandle(options);
    console2.log('du, tu:', du, tu);
    if (du || tu) {
      await sleep(1000);
      console2.info('Raffle page has loaded!');
      return true;
    }
    await sleep(1000);
  }

  console2.warn('Raffle page has NOT loaded!');
  return false;
}

// RAFFLE API: RAFFLE GETTERS ---------------------------------------------

export function getTwitterHandle(options, { normalize = true } = {}) {
  try {
    const elems = parseTaskTexts(options, options.ATLAS_TWITTER_USER_SEL);
    console2.log('getTwitterUser elems', elems);
    if (!elems?.length) {
      return null;
    }
    const h = elems[0].innerText.replace(options.ATLAS_TWITTER_USER_SEL, '').trim();
    return !normalize ? h : normalizeTwitterHandle(h.replace('@', ''));
  } catch (e) {
    console.info(e);
    return '';
  }
}

export function getDiscordHandle(options, { normalize = true } = {}) {
  try {
    const elems = parseTaskTexts(options, options.ATLAS_DISCORD_USER_SEL);
    console2.log('getDiscordUser elems', elems);
    if (!elems?.length) {
      return null;
    }
    const h = elems[0]?.innerText?.replace(options.ATLAS_DISCORD_USER_SEL, '')?.trim() || '';
    return !normalize ? h : normalizeDiscordHandle(h);
  } catch (e) {
    console.info(e);
    return '';
  }
}

export function getMustJoinLinks(options, mustHaveRole = false) {
  if (mustHaveRole) {
    return { elems: null, links: [] };
  }
  const elems = [];
  const links = parseTaskLinks(options, options.ATLAS_JOIN_DISCORD_SEL);
  console.log('getMustJoinLinks', elems, links);
  return { elems, links };
}

export function getMustFollowLinks(options) {
  const elems = [];
  const links = parseTaskLinks(options, options.ATLAS_MUST_FOLLOW_SEL);
  console.log('getMustFollowLinks', elems, links);
  return { elems, links };
}

export function getMustLikeLinks(options) {
  const elems = [];
  const links = parseTaskLinks(options, options.ATLAS_MUST_LIKE_SEL);
  console.log('getMustLikeLinks', elems, links);
  return { elems, links };
}

export function getMustRetweetLinks(options) {
  const elems = [];
  const links = parseTaskLinks(options, options.ATLAS_MUST_RETWEET_SEL);
  console.log('getMustRetweetLinks', elems, links);
  return { elems, links };
}

export function getMustLikeAndRetweetLinks(options) {
  const elems = [];
  const links = parseTaskLinks(options, options.ATLAS_MUST_LIKE_AND_RETWEET_SEL);
  console.log('getMustLikeAndRetweetLinks', elems, links);
  return { elems, links };
}

export function getSelectedWallet() {
  try {
    const elem = document.getElementById('headlessui-listbox-button-:r0:');
    if (elem?.innerText) {
      return null;
    }

    const shortWallet = elem?.innerText || '';
    const longWallet = '';
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
  return [];
}

export async function getRegisterButton(options, maxWait = 1000, interval = 10) {
  console2.log('getRegisterButton');
  return await waitForTextEquals(options.ATLAS_REG_BTN_SEL, 'button', maxWait, interval);
}

export function getRegisterButtonSync(options) {
  return [...document.querySelectorAll('button')].filter((x) => x.innerText === options.ATLAS_REG_BTN_SEL)[0];
}

export function getErrors() {
  const elems = [...document.querySelectorAll('.alert-danger')];
  if (elems?.length) {
    return ['unspecifiedRaffleError'];
  }
  return [];
}

export function getTeamName() {
  return '';
}

// RAFFLE API: HAS CHECKERS ---------------------------------------------

export function hasRegistered() {
  try {
    return !!document.body.innerHTML.match(/REGISTERED SUCCESSFULLY - /i);
  } catch (e) {
    return false;
  }
}

export async function hasRaffleTrigger(options) {
  const elem = await waitForSelector(options.ATLAS_MAIN_REGION_SEL, 10 * ONE_SECOND, 50);
  return !!elem;
}

export async function hasRaffleTrigger2(options) {
  return hasRaffleTrigger(options);
}

export function hasErrors() {
  return !!document.querySelector('div.text-white.bg-red-500');
}

// RAFFLE API: IS CHECKERS ---------------------------------------------

export function isAllRegBtnsEnabled(options) {
  const regBtn = getRegisterButtonSync(options);
  console2.log('regBtn', regBtn);
  if (regBtn?.disabled) {
    return false;
  }
  return !!regBtn;
}

// HTML DOM

/*
// this already implemented in atlasRAfflePage, which one is best?
export function isAllTasksCompleted() {
  const elems = [...document.querySelectorAll('p')].filter((x) => x.innerText.endsWith('TASKS COMPLETED'));
  console2.log('elems', elems);
  if (!elems?.length) {
    return false;
  }
  const s = elems[0].innerText.replace('TASKS COMPLETED', '').trim();
  console2.log('s', s);

  const tokens = s.split(s, 'OF').map((x) => x.trim());
  console2.log('tokens', tokens);

  if (tokens.length === 2 && tokens[0] === tokens[1]) {
    return true;
  }

  return false;
}
*/

// API HELPERS

function parseTaskTexts(options, prefix) {
  console2.log('parseTaskText; prefix:', prefix);
  try {
    const baseElems = getMainTaskElements(options);
    if (!baseElems?.length) {
      return [];
    }
    const mainElems = baseElems.filter((e) => e.innerText.trim().startsWith(prefix));
    console2.log('elems', mainElems);
    return mainElems;
  } catch (e) {
    console2.error('Failed parsing task texts. Error:', e);
    return [];
  }
}

function parseTaskLinks(options, prefix) {
  console2.log('parseTaskLinks; prefix:', prefix);
  try {
    const baseElems = getMainTaskElements(options);
    if (!baseElems?.length) {
      return [];
    }
    const mainElems = baseElems.filter((e) => e.innerText.toLowerCase().trim().startsWith(prefix));
    console2.log('elems', mainElems);

    const arr = mainElems.map((x) => x.getElementsByTagName('a')).map((x) => Array.from(x));
    console2.log('arr', arr);
    const noDups = noDuplicates(arr.flat().map((x) => x.href));
    console2.log('noDups', noDups);
    const badLinks = noDups.filter((x) => isCorruptTaskLink(x));
    const useLinks = noDups.filter((x) => !isCorruptTaskLink(x));
    console2.log('badLinks, useLinks', badLinks, useLinks);
    // return noDuplicates(arr);
    return useLinks;
  } catch (e) {
    console2.error('Failed parsing task links. Error:', e);
    return [];
  }
}

function getMainTaskElements(options) {
  console2.log('getMainTaskElements');
  const mainElems = [...document.querySelectorAll('p')].filter(
    (x) => x.innerText === options.ATLAS_MAIN_REGION_SEL
  );
  if (!mainElems) {
    return [];
  }
  const baseElems = document.querySelectorAll('div.flex.py-5');
  console2.log('baseElems', baseElems);
  if (!baseElems?.length) {
    return [];
  }
  return [...baseElems];
}

function isCorruptTaskLink(s) {
  // eslint-disable-next-line no-useless-escape
  const n = countOccurances(s, /https\:\/\//gi);
  console2.log('isCorruptTaskLink', s, n, n > 1);
  return n > 1;
  // return s.includes('https://twitter.com/any/status/');
}
