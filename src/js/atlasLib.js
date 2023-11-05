import { sleep, fetchHelper, rateLimitHandler, createLogger } from 'hx-lib';

const debug = createLogger();

// DATA ----------------------------------------------------------------------------------

const WINS_BASE_URL = 'https://atlas3.io/api/me/won-giveaways?&page={PAGE}&pageLength={PAGE_LENGTH}';

// FUNCTIONS ----------------------------------------------------------------------------------

export async function getWins() {
  const result = await fetchWins();
  return result.error ? [] : convertWins(result);
}

async function fetchWins({ pageLength = 12, interval = 1500 } = {}, checkIfContinueFn = null) {
  debug.log('fetchWins; pageLength:', pageLength);

  const wins = [];
  let pageNum = 0;

  while (pageNum >= 0) {
    pageNum++;

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

    if (checkIfContinueFn && !checkIfContinueFn(result)) {
      debug.log('checkIfContinueFn() says to stop');
      break;
    }

    debug.log(`sleep ${interval} ms before next fetch`);
    await sleep(interval);
  }

  return wins;
}

function convertWins(wins) {
  return wins.map((x) => {
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
