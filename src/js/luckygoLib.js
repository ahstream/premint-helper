import { sleep, fetchHelper, rateLimitHandler, createLogger } from 'hx-lib';
import { normalizeTwitterHandle } from './premintHelperLib.js';

const debug = createLogger();

// DATA ----------------------------------------------------------------------------------

const ACCOUNT_URL = 'https://luckygo.io/profile';

const WINS_BASE_URL = 'https://api.luckygo.io/raffle/list/me?type=won&page={PAGE}&size={SIZE}';

// ACCOUNT -----------------------

export async function getAccount() {
  debug.log('url:', ACCOUNT_URL);
  const result = await fetchHelper(ACCOUNT_URL, {
    credentials: 'same-origin',
  });
  debug.log('getAccount:', result);

  let m = null;
  if (result?.data) {
    m = [...result.data.matchAll(/{"user":{"address":"([a-z0-9]+)"/gim)];
    console.log('m:', m);
  }

  const address = m?.length === 1 ? m[0][1] : null;

  return {
    id: address,
    address,
    userId: null,
    userName: null,
  };
}

// WINS ----------------------------------------------------------------------------------

export async function getWins(
  account,
  authKey,
  { interval = 1500, max = null, skip = [], statusLogger = null } = {}
) {
  debug.log('getWins', account, authKey, interval, max, skip);
  const wins = await fetchWins(account, authKey, { interval, max, skip, statusLogger });
  return wins;
}

async function fetchWins(account, authKey, { interval, max, skip, statusLogger }) {
  debug.log('fetchWins; max, interval, skip:', max, interval, skip);

  const wins = [];
  let count = 0;

  if (statusLogger) {
    statusLogger.main(`Get LuckyGo entries...`);
  }

  const entries = await fetchEntries(authKey, { interval, max, skip, statusLogger });
  await sleep(interval);

  if (entries?.error) {
    console.error('Failed getting LuckyGo entries. Error:', entries);
    if (statusLogger) {
      statusLogger.sub('Failed getting LuckyGo entries. Error:' + entries.error.toString());
    }
    return wins;
  }

  const maxText = max ? ` (max ${max})` : '';

  for (const baseEntry of entries) {
    if (statusLogger) {
      statusLogger.main(`Get LuckyGo results for raffle ${count + 1} of ${entries.length}${maxText}`);
    }
    if (max && count > max) {
      debug.log('Max wins fetched:', count, '>=', max);
      return wins;
    }
    if (baseEntry.live) {
      debug.log('Skip live entry', baseEntry.url);
      continue;
    }
    count++; // count also non-wins, otherwise can be too many fetches!
    debug.log('Fetch count:', count);

    if (skip?.length && skip.find((id) => id === baseEntry.id)) {
      debug.log('Skip existing entry', baseEntry.id);
      continue;
    }

    const entry = await fetchEntry(baseEntry.url, account);
    debug.log('entry', entry);

    debug.log(`sleep ${interval} ms before next fetch`);
    await sleep(interval);

    // debug.log('entry', entry);

    if (entry.error) {
      debug.log('skip error entry:', entry);
      continue;
    }

    if (!entry.isWin) {
      // debug.log('lost entry:', entry);
      continue;
    }

    wins.push(entry);
  }

  return wins;
}

async function fetchEntries(
  authKey,
  { pageLength = 20, interval, max, statusLogger },
  checkIfContinueFn = null
) {
  debug.log('fetchEntriesMetadata; pageLength:', pageLength);

  const entries = [];
  let pageNum = 0;
  let count = 0;

  while (pageNum >= 0) {
    pageNum++;

    if (statusLogger) {
      statusLogger.main(`Get LuckyGo entries page ${count + 1}`);
    }

    const url = WINS_BASE_URL.replace('{PAGE}', pageNum).replace('{SIZE}', pageLength);
    debug.log(`fetchWins page: ${pageNum}, ${url}`);
    const headers = { Authorization: authKey };
    debug.log('url', url);
    const result = await fetchHelper(url, { method: 'GET', headers }, rateLimitHandler);
    debug.log('result', result);

    if (result.error) {
      return { error: true, result, wins: entries };
    }

    if (result?.data?.data?.list && !result.data.data.list.length) {
      return entries;
    }

    entries.push(...makeEntry(result.data.data.list));

    if (result.data.data.list.length < pageLength) {
      return entries;
    }

    count += result.data.data.list.length;
    if (max && count > max) {
      debug.log('Max wins fetched:', count, '>=', max);
      return entries;
    }

    if (checkIfContinueFn && !checkIfContinueFn(result)) {
      debug.log('checkIfContinueFn() says to stop');
      break;
    }

    debug.log(`sleep ${interval} ms before next fetch`);
    await sleep(interval);
  }

  return entries;
}

async function fetchEntry(url, account) {
  debug.log('fetchEntry:', url);

  debug.log('url', url);
  const result = await fetchHelper(url, { method: 'GET' }, rateLimitHandler);
  debug.log('result', result);

  if (result.error) {
    return { error: true, result };
  }

  if (result?.ok && !result.data) {
    return { error: true, result };
  }

  const html = result.data;

  const win = convertWin(html, account);
  if (!win) {
    return { error: true, win };
  }
  return win;

  /*
  const raffleId = x.id;
  const startDate = x.start_time || null;
  const endDate = x.end_time || null;
  const mintDate = x.project?.mint_date || null;
  const id = raffleId;
  const name = x.name;
  const slug = x.vanity_url;
  const url = `https://luckygo.io/r/${slug}`;
  const teamName = x.campaign?.name;
  const teamId = x.campaign?.id;
  const blockchain = x.project?.blockchain;
  const entryCount = x.entryCount || null;
  const winnerCount = x.winnerCount || null;
  const type = x.type;
  const status = x.status;
  const collabId = x.project?.id;
  const collabName = null;
  */
}

function parsePropsFromSource(html) {
  try {
    const tokensStart = html.split('script id="__NEXT_DATA__" type="application/json">');
    console.log('tokensStart', tokensStart);
    if (!tokensStart?.length === 2) {
      return null;
    }
    const tokensEnd = tokensStart[1].split('</script>');
    console.log('tokensEnd', tokensEnd);
    if (tokensEnd?.length < 2) {
      return null;
    }
    return JSON.parse(tokensEnd[0]);
  } catch (e) {
    console.error(e);
    return null;
  }
}

function makeEntry(entries) {
  debug.log('makeEntryUrls', entries);
  return entries.map((x) => {
    return {
      id: x.id,
      live: x.live,
      url: `https://luckygo.io/r/${x.vanity_url}`,
    };
  });
}

function convertWin(html, account) {
  const baseProps = parsePropsFromSource(html);
  console.log('props', baseProps);
  if (!baseProps) {
    return null;
  }
  const user = baseProps.props.user;
  const raffle = baseProps.props.pageProps.raffleDetailsInfo.raffle;

  const provider = 'luckygo';

  const isWin = raffle.my_entry?.is_win || false;

  const raffleId = raffle.id;
  const userId = user.address || raffle.my_entry?.user_id || account.userId;
  const userName = user.twitter_username || user.discord_username || null;

  const startDate = makeDate(raffle.start_time, null);
  const endDate = makeDate(raffle.end_time, null);
  const pickedDate = endDate;
  const mintDate = makeDate(raffle.project?.mint_time, null);
  const mintTime = null;

  const twitterHandle = normalizeTwitterHandle(raffle.project?.twitter_screen_name);
  const twitterHandleGuess = twitterHandle;
  const discordUrl = null;
  const websiteUrl = null;

  const wallets = raffle.my_entry?.mint_wallet ? [raffle.my_entry.mint_wallet] : [];

  const hxId = `${provider}-${userId}-${raffleId}`;
  const hxSortKey = mintDate || endDate;

  const id = raffleId;
  const name = raffle.name;
  const slug = raffle.vanity_url;
  const url = `https://luckygo.io/r/${slug}`;

  const teamName = raffle.campaign?.name || null;
  const teamId = raffle.campaign?.id || null;

  const blockchain = raffle.project?.blockchain || null;
  const dtc = null;
  const entryCount = raffle.entry_count || null;
  const winnerCount = raffle.winner_count || null;
  const maxWinners = null;

  const supply = raffle.project?.supply_count || null;
  const pubPrice = raffle.project?.public_price ?? null;
  const wlPrice = raffle.project?.whitelist_price ?? null;

  const type = raffle.type;
  const status = raffle.status;

  const collabId = raffle.project?.id;
  const collabName = raffle.project?.name;

  //custom
  const createDate = makeDate(raffle.create_time, null);
  const modifyDate = makeDate(raffle.update_time, null);
  const providerUserId = raffle.my_entry?.user_id;

  return {
    hxId,
    hxSortKey,

    provider,
    userId,
    userName,

    isWin,

    id,
    name,
    slug,
    url,

    startDate,
    endDate,
    pickedDate,
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

    type,

    status,
    collabId,
    collabName,

    // custom props
    createDate,
    modifyDate,
    providerUserId,
  };
}

/*
function convertEntryMetadata(entries) {
  return entries.map((x) => {
    console.log('convert entry:', x);

    const provider = 'luckygo';

    const raffleId = x.id;
    const startDate = x.start_time || null;
    const endDate = x.end_time || null;
    const mintDate = x.project?.mint_date || null;
    const id = raffleId;
    const name = x.name;
    const slug = x.vanity_url;
    const url = `https://luckygo.io/r/${slug}`;
    const teamName = x.campaign?.name;
    const teamId = x.campaign?.id;
    const blockchain = x.project?.blockchain;
    const entryCount = x.entryCount || null;
    const winnerCount = x.winnerCount || null;
    const type = x.type;
    const status = x.status;
    const collabId = x.project?.id;
    const collabName = null;

    return {
      provider,
      id,
      name,
      slug,
      url,
      startDate,
      endDate,
      mintDate,
      teamName,
      teamId,
      blockchain,
      entryCount,
      winnerCount,
      type,
      status,
      collabId,
      collabName,
      // custom props
      myEntryId: x.myEntry?.id,
      whitelistMethod: x.whitelist_method,
    };
  });
}
*/

/*
function convertWins(wins, account) {
  return wins.map((x) => {
    console.log('convert win:', x);
    const provider = 'luckygo';

    const raffleId = x.id;
    const userId = x.userId || account.userId;
    const userName = x.discordUsername || x.discordUsername || null;

    const accountUserId = account.userId;

    const startDate = makeDate(x.startDate, null);
    const endDate = makeDate(x.endDate, null);
    const pickedDate = endDate;
    const modifyDate = makeDate(x.modifyDate, null);
    const mintDate = makeDate(x.mintDate, null);
    const mintTime = null;

    const twitterHandle = normalizeTwitterHandle(x.twitterHandle);
    const twitterHandleGuess = twitterHandle;
    const discordUrl = null;
    const websiteUrl = null;

    const wallets = x.mintWallet ? [x.mintWallet] : [];

    const hxId = `${provider}-${userId}-${raffleId}`;
    const hxSortKey = mintDate || endDate;
    //const hxUpdated = null;

    const id = raffleId;
    const name = x.name;
    const slug = x.slug;
    const url = `https://luckygo.io/r/${slug}`;

    const teamName = x.teamId;
    const teamId = x.teamId;

    const blockchain = x.blockchain || x.project?.blockchain || null;
    const dtc = null;
    const entryCount = x.entryCount || null;
    const winnerCount = x.winnerCount || x.winner_count || null;
    const maxWinners = null;

    const supply = x.supply || null;
    const pubPrice = x.pubPrice || null;
    const wlPrice = x.wlPrice || null;
    const mintPrice = null;

    const dataId = null;
    const type = x.type;
    const status = x.status;

    const collabId = x.project?.id;
    const collabName = null;

    return {
      hxId,
      hxSortKey,
      //hxUpdated,

      provider,
      userId,
      userName,

      accountUserId,

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

      // custom props
      myEntryId: x.myEntry?.id,
      whitelistMethod: x.whitelist_method,
      has_won_mint_wallets: x.has_won_mint_wallets,
    };
  });
}
*/

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

export function getRaffleTwitterHandle() {
  return matchAny(document.body.innerHTML, /"twitter_screen_name":"([^"]*)/i, null);
}

export function getSelectedWallet() {
  try {
    const elem = document.getElementById('headlessui-listbox-button-:r0:');
    return elem?.innerText || '';
  } catch (e) {
    console.error(e);
    return null;
  }
}

export function isAutomateTwitterTasksSelected() {
  return !!document.querySelector('.automateBg.justify-end');
}

// HELPERS

function makeDate(val, nullVal) {
  try {
    if (typeof val === 'number') {
      return new Date(val).getTime();
    } else if (typeof val === 'string') {
      return new Date(Number(val)).getTime();
    } else {
      return nullVal;
    }
  } catch (e) {
    console.error(e);
    return nullVal;
  }
}

/*
function stringToArray(s, nullVal) {
  try {
    return JSON.parse(s);
  } catch (e) {
    console.error(e);
    return nullVal;
  }
}

function matchNum(html, regexp, nullVal) {
  try {
    const val = matchAny(html, regexp, nullVal);
    return typeof val === 'string' ? Number(val) : nullVal;
  } catch (e) {
    console.error(e);
    return nullVal;
  }
}
*/

function matchAny(html, regexp, nullVal) {
  const m = html.match(regexp);
  return m?.length === 2 ? m[1] : nullVal;
}
