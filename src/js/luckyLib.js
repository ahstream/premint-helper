import { sleep, fetchHelper, rateLimitHandler, createLogger } from 'hx-lib';
import { normalizeTwitterHandle } from './premintHelperLib.js';

const debug = createLogger();

// DATA ----------------------------------------------------------------------------------

const ACCOUNT_URL = 'https://luckygo.io/profile';

const WINS_BASE_URL = 'https://api.luckygo.io/raffle/list/me?type=won&page={PAGE}&size={SIZE}';

// ACCOUNT -----------------------

export async function getAccount() {
  const result = await fetchHelper(ACCOUNT_URL, {
    credentials: 'same-origin',
  });
  debug.log('getAccount:', result);

  // result.response.headers.forEach((h) => console.log(h));
  console.log('c', result.response.headers.getSetCookie());

  let m = null;
  if (result?.data) {
    m = [...document.body.innerHTML.matchAll(/{"user":{"address":"([a-z0-9]+)"/gim)];
    console.log('m:', m);
  }

  return {
    userId: m?.length === 2 ? m[1] : null,
    userName: null,
  };
}

// WINS ----------------------------------------------------------------------------------

export async function getWins(account, { interval = 1500, max = null, statusLogger } = {}) {
  const result = await fetchWins({ interval, max, statusLogger });
  if (result.error) {
    if (statusLogger) {
      statusLogger.sub(`Error when getting LuckyGo results!`);
    }
    return [];
  }
  return convertWins(result, account);
}

async function fetchWins({ pageLength = 20, interval, max, statusLogger }, checkIfContinueFn = null) {
  debug.log('fetchWins; pageLength:', pageLength);

  const wins = [];
  let pageNum = 0;
  let count = 0;

  while (pageNum >= 0) {
    pageNum++;

    if (statusLogger) {
      statusLogger.main(`Get LuckyGo results page ${count + 1}`);
    }

    const url = WINS_BASE_URL.replace('{PAGE}', pageNum).replace('{SIZE}', pageLength);
    debug.log(`fetchWins page: ${pageNum}, ${url}`);
    const result = await fetchHelper(url, { method: 'GET' }, rateLimitHandler);
    debug.log('result', result);

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
      debug.log('Max wins fetched:', count, '>=', max);
      return wins;
    }

    if (checkIfContinueFn && !checkIfContinueFn(result)) {
      debug.log('checkIfContinueFn() says to stop');
      break;
    }

    debug.log(`sleep ${interval} ms before next fetch`);
    await sleep(interval);
  }

  return wins;
}

function convertWins(wins, account) {
  return wins.map((x) => {
    const provider = 'lucky';

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
    const url = `https://luckygo.io/r/${slug}`;

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

// HTML DOM

/*
// this already implemented in atlasRAfflePage, which one is best?
export function isAllTasksCompleted() {
  const elems = [...document.querySelectorAll('p')].filter((x) => x.innerText.endsWith('TASKS COMPLETED'));
  console.log('elems', elems);
  if (!elems?.length) {
    return false;
  }
  const s = elems[0].innerText.replace('TASKS COMPLETED', '').trim();
  console.log('s', s);

  const tokens = s.split(s, 'OF').map((x) => x.trim());
  console.log('tokens', tokens);

  if (tokens.length === 2 && tokens[0] === tokens[1]) {
    return true;
  }

  return false;
}
*/

// MISC

export function getSelectedWallet() {
  try {
    const elem = document.getElementById('headlessui-listbox-button-:r0:');
    return elem?.innerText || '';
  } catch (e) {
    console.error(e);
    return null;
  }
}
