import { sleep, fetchHelper, rateLimitHandler, createLogger } from 'hx-lib';

const debug = createLogger();

// DATA ----------------------------------------------------------------------------------

const ACCOUNT_URL = 'https://atlas3.io/api/auth/session';

const WINS_BASE_URL = 'https://atlas3.io/api/me/won-giveaways?&page={PAGE}&pageLength={PAGE_LENGTH}';

// ACCOUNT -----------------------

export async function getAccount() {
  const result = await fetchHelper(ACCOUNT_URL, {});
  debug.log('getAccount:', result);
  return {
    userId: result?.data?.user?.id,
    userName: result?.data?.user?.name,
  };
}

// WINS ----------------------------------------------------------------------------------

export async function getWins(account, { interval = 1500, max = null, statusFn } = {}) {
  const result = await fetchWins({ interval, max, statusFn });
  return result.error ? [] : convertWins(result, account);
}

async function fetchWins({ pageLength = 12, interval, max, statusFn }, checkIfContinueFn = null) {
  debug.log('fetchWins; pageLength:', pageLength);

  const wins = [];
  let pageNum = 0;
  let count = 0;

  while (pageNum >= 0) {
    pageNum++;

    if (statusFn) {
      statusFn(`Get Atlas results page ${count}`);
    }

    const url = WINS_BASE_URL.replace('{PAGE}', pageNum).replace('{PAGE_LENGTH}', pageLength);
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
    const provider = 'atlas3';

    const raffleId = x.id;
    const userId = x.entries[0].userId;
    const userName = account?.userName;

    const startDate = x.createdAt ? new Date(x.createdAt).getTime() : null;
    const endDate = x.endsAt ? new Date(x.endsAt).getTime() : null;
    const pickedDate = endDate;
    const modifyDate = null;

    const mintDate = x.collabProject?.mintDate ? new Date(x.endsAt).getTime() : null;
    const mintTime = x.collabProject?.mintTime;

    const twitterHandle = x.collabProject?.twitterUsername;
    const twitterHandleGuess = x.rules.find((r) => r.type === 'TWITTER_FRIENDSHIP')?.twitterFriendshipRule
      ?.username;
    const discordUrl = x.collabProject?.discordInviteUrl;
    const websiteUrl = x.collabProject?.websiteUrl;

    const wallets = x.entries.filter((e) => e.isWinner).map((e) => e.walletAddress);

    const hxId = `${provider}-${userId}-${raffleId}`;
    const hxSortKey = endDate;
    //const hxUpdated = null;

    const id = raffleId;
    const name = x.name;
    const slug = x.slug;

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
