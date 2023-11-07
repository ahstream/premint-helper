import { sleep, fetchHelper, rateLimitHandler, createLogger, noDuplicates } from 'hx-lib';

const debug = createLogger();

// DATA ----------------------------------------------------------------------------------

const ACCOUNT_URL = 'https://www.premint.xyz/profile/';

const WINS_BASE_URL = 'https://www.premint.xyz/collectors/entries/';

// ACCOUNT -----------------------

export async function getAccount() {
  const result = await fetchHelper(ACCOUNT_URL, {});
  debug.log('getAccount:', result);
  const html = result?.data || '';
  const m = html.match(/<i class="fas fa-wallet mr-1 c-base-1-gradient"><\/i>\s*([^\s]+)\s+<\/button>/im);
  debug.log('m', m);
  return {
    userId: m?.length === 2 ? m[1] : null,
    userName: null,
  };
}

//

// WINS ----------------------------------------------------------------------------------

export async function getWins(account, { interval = 1500, max = null, skip = [], statusFn = null } = {}) {
  debug.log('getWins', account, interval, max, skip);
  const { wins, lost } = await fetchWins({ interval, max, skip, statusFn });
  const lastSortKey = skip.length;
  return {
    wins: convertWins(wins, account, lastSortKey),
    lost: lost.map((x) => x.id),
  };
}

async function fetchWins({ interval, max, skip, statusFn }) {
  debug.log('fetchWins; max, interval, skip:', max, interval, skip);

  const wins = [];
  const lost = [];
  let count = 0;

  if (statusFn) {
    statusFn(`Get Premint entries`);
  }

  const entries = await fetchEntries();
  await sleep(interval);

  const maxText = max ? ` (max ${max})` : '';

  for (const entryMetadata of entries) {
    if (statusFn) {
      statusFn(`Get Premint results for raffle ${count + 1} of ${entries.length}${maxText}`);
    }

    if (max && count > max) {
      debug.log('Max entries fetched:', count, '>=', max);
      return { wins, lost };
    }

    if (entryMetadata.live) {
      debug.log('Skip live entry', entryMetadata.url);
      continue;
    }

    count++; // count also non-wins, otherwise can be too many fetches!
    debug.log('Fetch count:', count);

    if (skip?.length && skip.find((id) => id === entryMetadata.id)) {
      debug.log('Skip existing entry', entryMetadata.id);
      continue;
    }

    const entry = await fetchEntry(entryMetadata);
    debug.log(`sleep ${interval} ms before next fetch`);
    await sleep(interval);

    debug.log('entry', entry);

    if (entry.error) {
      debug.log('skip error entry:', entry);
      continue;
    }

    if (!entry.isWin) {
      lost.push(entry);
      debug.log('lost entry:', entry);
      continue;
    }

    wins.push(entry);
  }

  return { wins, lost };
}

async function fetchEntries() {
  debug.log('fetchEntries');

  const entries = [];

  const result = await fetchHelper(WINS_BASE_URL, { method: 'GET' }, rateLimitHandler);
  debug.log('result', result);

  if (result.error) {
    return { error: true, result, entries };
  }

  if (result?.ok && !result.data) {
    return entries;
  }

  const matches = [
    ...result.data.matchAll(
      /<div class="card-body text-truncate">[^<]*<a href="([^"]+)[^>]*>([^<]*)<\/a>[^<]*<div[^>]*>([^<]*)<\/div>[^<]*<span[^>]*>[^<]*<a href="\/collectors\/entries\/[0-9]+\/(hide|unregister)/gim
    ),
  ];
  debug.log('matches', matches);

  for (const entry of matches) {
    //console.log('entry', entry);
    if (entry.length !== 5) {
      debug.log('ERROR? Entry length != 5');
      continue;
    }
    entries.push({
      id: entry[1],
      slug: entry[1],
      name: entry[2].replaceAll('\n', '').trim(),
      url: `https://www.premint.xyz${entry[1]}`,
      joinDate: entry[3].trim(),
      live: entry[4].toLowerCase() === 'unregister',
    });
  }

  await sleep(0);

  return entries;
}

async function fetchEntry(entry) {
  debug.log('fetchEntry:', entry.url);

  const result = await fetchHelper(entry.url, { method: 'GET' }, rateLimitHandler);
  debug.log('result', result);

  if (result.error) {
    return { error: true, result };
  }

  if (result?.ok && !result.data) {
    return { error: true, result };
  }

  const isWinMatch = result.data.match(/<div class="heading heading-1">🏆<\/div>/gim);
  debug.log('isWinMatch', isWinMatch);

  const html = result.data;

  return {
    isWin: !!html.match(/<div class="heading heading-1">🏆<\/div>/gim),
    twitterHandles: getTwitterHandles(html) || null,
    wallets: getWallets(html) || null,
    isPasswordProtected: !!html.match(/This page is password protected/im),
    ...entry,
  };
}

function getTwitterHandles(html) {
  const m1 = [
    ...html.matchAll(
      /<a href="https:\/\/twitter.com\/[^"]+" target="_blank" class="c-base-1">([^<]+)<\/a>/gim
    ),
  ];
  const m2 = [...html.matchAll(/Twitter: https:\/\/twitter\.com\/([a-z0-9-_]+)</gim)];
  console.log('m1', m1);
  console.log('m2', m2);

  const data = [];

  noDuplicates([...m1, ...m2]).forEach((m) => {
    if (m.length > 1) {
      data.push(m[1]);
    }
  });

  return data.length ? data : null;
}

function getWallets(html) {
  const m1 = [
    ...html.matchAll(
      /<span class="text-sm text-uppercase text-muted">Wallet Address<\/span>\s*([^<]*)<\/div>/gim
    ),
  ];
  console.log(m1);

  const data = [];

  noDuplicates(m1).forEach((m) => {
    if (m.length > 1) {
      data.push(m[1].trim());
    }
  });

  return data.length ? data : null;
}

function convertWins(wins, account, lastSortKey) {
  let count = 0;
  return wins.reverse().map((x) => {
    count++;

    const provider = 'premint';

    const raffleId = x.id;
    const userId = account.userId;
    const userName = account.userName;

    const startDate = null;
    const endDate = null;
    const pickedDate = null;
    const modifyDate = null;

    const mintDate = null;
    const mintTime = null;

    const twitterHandle = x.twitterHandles;
    const twitterHandleGuess = x.twitterHandles?.length ? x.twitterHandles[0] : '';
    const discordUrl = null;
    const websiteUrl = null;

    const wallets = x.wallets || [];

    const hxId = `${provider}-${userId}-${raffleId}`;
    const hxSortKey = count + lastSortKey;
    //const hxUpdated = null;

    const id = raffleId;
    const name = x.name;
    const slug = x.slug;
    const url = 'https://www.premint.xyz' + slug;

    const teamName = null;
    const teamId = null;
    const blockchain = null;
    const dtc = null;
    const entryCount = null;
    const winnerCount = null;
    const maxWinners = null;

    const supply = null;
    const mintPrice = null;
    const pubPrice = null;
    const wlPrice = null;

    const dataId = null;
    const type = null;

    const status = null;
    const collabId = null;
    const collabName = null;

    const comment = 'join date: ' + x.joinDate;

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

      comment,
    };
  });
}
