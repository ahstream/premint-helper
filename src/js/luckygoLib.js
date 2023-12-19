import {
  sleep,
  fetchHelper,
  rateLimitHandler,
  myConsole,
  noDuplicates,
  millisecondsAhead,
  waitForTextEquals,
  getTextEquals,
} from 'hx-lib';

import {
  normalizeTwitterHandle,
  normalizeDiscordHandle,
  getMyTabIdFromExtension,
  getFromWebPage,
} from './premintHelperLib.js';

const console2 = myConsole();
console2.log();

// DATA ----------------------------------------------------------------------------------

const SLEEP_LUCKYGO_LIB_FETCH_RAFFLES = 2000;

const ACCOUNT_URL = 'https://luckygo.io/profile';

const WINS_BASE_URL = 'https://api.luckygo.io/raffle/list/me?type=won&page={PAGE}&size={SIZE}';

const RAFFLES_BASE_URL =
  'https://api.luckygo.io/raffle/list?community_type={COMMUNITY_TYPE}&project_type={PROJECT_TYPE}&sort_type={SORT_TYPE}&free_mint={FREE_MINT}&my_partial_guild_ids={MY_PARTIAL_GUILD_IDS}&my_particial_project_ids={MY_PARTIAL_PROJECT_IDS}&key_words={KEY_WORDS}&page={PAGE}&size={SIZE}';

// ACCOUNT -----------------------

export async function getAccount() {
  console2.log('url:', ACCOUNT_URL);
  const result = await fetchHelper(ACCOUNT_URL, {
    credentials: 'same-origin',
  });
  console2.log('getAccount:', result);

  let m = null;
  if (result?.data) {
    m = [...result.data.matchAll(/{"user":{"address":"([a-z0-9]+)"/gim)];
    console2.log('m:', m);
  }

  const address = m?.length === 1 ? m[0][1] : null;
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
  const authKey = await getFromWebPage(`https://luckygo.io/myraffles`, 'getAuth', context.myTabId, context);
  console2.log('authKey', authKey);
  console2.log('context', context);

  if (typeof authKey !== 'string') {
    return null;
  }

  const authKeyTrim = authKey.replace('%20', ' ');

  return authKeyTrim;
}

// RAFFLE -------------------------------------------

export async function getRaffle(url, authKey, options) {
  console.log('getRaffle', url, authKey, options);

  const headers = authKey ? { Authorization: authKey } : {};
  const result = await fetchHelper(url, { method: 'GET', headers, ...options }, rateLimitHandler);
  console.log('result', result);

  if (result.error || !result.data) {
    return { error: true, result };
  }
  const propsData = parsePropsFromSource(result.data);
  console.log('propsData', propsData);

  return convertRaffle(propsData.props?.pageProps?.raffleDetailsInfo?.raffle);
}

// RAFFLES ----------------------------------------------------------------------------------

// https://api.luckygo.io/raffle/list?
/*
community_type=All&
project_type=All&
sort_type=End%20Soon&
free_mint=0&
my_partial_guild_ids=&
my_particial_project_ids=&
key_words=&
page=1&
size=20
*/

export async function getRaffles(authKey, options) {
  const raffles = await fetchRaffles(authKey, options);
  console.log('raffles', raffles);
  return raffles.map((x) => convertRaffle(x));
}

async function fetchRaffles(
  authKey,
  {
    community_type = 'All',
    project_type = 'All',
    sort_type = 'End%20Soon&',
    free_mint = 0,
    my_partial_guild_ids = '',
    my_particial_project_ids = '',
    key_words = '',
    size = 20,
    interval,
    max,
    statusLogger,
  } = {}
) {
  console2.log('fetchRaffles');

  if (statusLogger) {
    statusLogger.mid(`Get LuckyGo raffles...`);
  }

  const raffles = [];
  let page = 0;
  let count = 0;

  while (page >= 0) {
    page++;

    const url = RAFFLES_BASE_URL.replace('{COMMUNITY_TYPE}', community_type)
      .replace('{PROJECT_TYPE}', project_type)
      .replace('{SORT_TYPE}', sort_type)
      .replace('{FREE_MINT}', free_mint)
      .replace('{MY_PARTIAL_GUILD_IDS}', my_partial_guild_ids)
      .replace('{MY_PARTIAL_PROJECT_IDS}', my_particial_project_ids)
      .replace('{KEY_WORDS}', key_words)
      .replace('{PAGE}', page)
      .replace('{SIZE}', size);

    if (statusLogger) {
      statusLogger.mid(`Get LuckyGo raffles page ${page}`);
    }

    console2.log(`fetchRaffles page: ${page}, ${url}`);
    const headers = authKey ? { Authorization: authKey } : {};
    const result = await fetchHelper(url, { method: 'GET', headers }, rateLimitHandler);
    console2.log('result', result);

    if (result.error) {
      if (statusLogger) {
        statusLogger.sub('Failed getting LuckyGo raffles. Error:' + result.error.toString());
      }
      return { error: true, result, raffles };
    }

    if (result?.data?.data?.list && !result.data.data.list.length) {
      return raffles;
    }

    raffles.push(...result.data.data.list);

    if (!result.data.data.has_next) {
      return raffles;
    }

    count += result.data.data.list.length;
    if (max && count > max) {
      console2.log('Max fetched:', count, '>=', max);
      return raffles;
    }

    const delay = interval || SLEEP_LUCKYGO_LIB_FETCH_RAFFLES;

    console2.info(`Sleep ${delay} ms before next fetch`);
    await sleep(delay);
  }

  return raffles;
}

function convertRaffle(obj) {
  console.log('obj', obj);
  return {
    provider: 'luckygo',
    id: obj.id,
    name: obj.name,
    slug: obj.vanity_url,
    url: `https://luckygo.io/r/${obj.vanity_url}`,
    myEntry: obj.my_entry,
    hasEntered: !!obj.my_entry,
    winnerCount: obj.winner_count,
    entryCount: obj.entry_count,
    startDate: obj.start_time,
    endDate: obj.end_time,
    mintDate: obj.project?.mint_date,

    blockchain: obj.project?.blockchain,
    chain: obj.project?.chain,
    remainingSeconds: obj.remaining_seconds,
    status: obj.status,
    active: obj.status === 'ACTIVE',
    whitelistMethod: obj.whitelist_method,
    dtc: undefined,

    collabId: obj.project?.id,
    collabLogo: obj.project?.logo,
    collabBanner: obj.project?.banner,
    collabTwitterUrl: undefined,
    collabTwitterHandle: normalizeTwitterHandle(obj.project?.twitter_screen_name),
    collabDiscordUrl: undefined,

    teamId: obj.campaign?.id,
    teamName: obj.campaign?.name,
    teamLogo: obj.campaign?.logo,
    teamTwitterUrl: obj.campaign?.twitter_link,
  };
}

// WINS ----------------------------------------------------------------------------------

export async function getWins(
  account,
  authKey,
  { interval = 1500, max = null, skip = [], statusLogger = null } = {}
) {
  console2.log('getWins', account, authKey, interval, max, skip);
  const wins = await fetchWins(account, authKey, { interval, max, skip, statusLogger });
  return wins;
}

async function fetchWins(account, authKey, { interval, max, skip, statusLogger }) {
  console2.info('Fetch wins; max, interval, skip:', max, interval, skip);

  const wins = [];
  let count = 0;

  if (statusLogger) {
    statusLogger.mid(`Get LuckyGo entries...`);
  }

  const entries = await fetchEntries(authKey, { interval, max, skip, statusLogger });
  await sleep(interval);

  if (entries?.error) {
    console2.error('Failed getting LuckyGo entries. Error:', entries);
    if (statusLogger) {
      statusLogger.sub('Failed getting LuckyGo entries. Error:' + entries.error.toString());
    }
    return wins;
  }

  const maxText = max ? ` (max ${max})` : '';

  for (const baseEntry of entries) {
    if (statusLogger) {
      statusLogger.mid(`Get LuckyGo results for raffle ${count + 1} of ${entries.length}${maxText}`);
    }
    if (max && count > max) {
      console2.log('Max wins fetched:', count, '>=', max);
      return wins;
    }
    if (baseEntry.live) {
      console2.log('Skip live entry', baseEntry.url);
      continue;
    }
    count++; // count also non-wins, otherwise can be too many fetches!
    console2.log('Fetch count:', count);

    if (skip?.length && skip.find((id) => id === baseEntry.id)) {
      console2.log('Skip existing entry', baseEntry.id);
      continue;
    }

    const entry = await fetchEntry(baseEntry.url, account);
    console2.log('entry', entry);

    console2.info(`Sleep ${interval} ms before next fetch`);
    await sleep(interval);

    // console2.log('entry', entry);

    if (entry.error) {
      console2.log('skip error entry:', entry);
      continue;
    }

    if (!entry.isWin) {
      // console2.log('lost entry:', entry);
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
  console2.log('fetchEntriesMetadata; pageLength:', pageLength);

  const entries = [];
  let pageNum = 0;
  let count = 0;

  while (pageNum >= 0) {
    pageNum++;

    if (statusLogger) {
      statusLogger.mid(`Get LuckyGo entries page ${count + 1}`);
    }

    const url = WINS_BASE_URL.replace('{PAGE}', pageNum).replace('{SIZE}', pageLength);
    console2.log(`fetchWins page: ${pageNum}, ${url}`);
    const headers = { Authorization: authKey };
    console2.log('url', url);
    const result = await fetchHelper(url, { method: 'GET', headers }, rateLimitHandler);
    console2.log('result', result);

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
      console2.log('Max wins fetched:', count, '>=', max);
      return entries;
    }

    if (checkIfContinueFn && !checkIfContinueFn(result)) {
      console2.log('checkIfContinueFn() says to stop');
      break;
    }

    console2.info(`Sleep ${interval} ms before next fetch`);
    await sleep(interval);
  }

  return entries;
}

async function fetchEntry(url, account) {
  console2.log('fetchEntry:', url);

  console2.log('url', url);
  const result = await fetchHelper(url, { method: 'GET' }, rateLimitHandler);
  console2.log('result', result);

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
    console2.log('tokensStart', tokensStart);
    if (!tokensStart?.length === 2) {
      return null;
    }
    const tokensEnd = tokensStart[1].split('</script>');
    console2.log('tokensEnd', tokensEnd);
    if (tokensEnd?.length < 2) {
      return null;
    }
    return JSON.parse(tokensEnd[0]);
  } catch (e) {
    console2.error(e);
    return null;
  }
}

function makeEntry(entries) {
  console2.log('makeEntryUrls', entries);
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
  console2.log('props', baseProps);
  if (!baseProps) {
    return null;
  }
  const user = baseProps.props.user;
  const raffle = baseProps.props.pageProps.raffleDetailsInfo.raffle;

  const provider = 'luckygo';

  const isWin = raffle.my_entry?.is_win || false;

  const raffleId = raffle.id;
  const userId = user.address || raffle.my_entry?.user_id || account.id;
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

// MISC

export function getRaffleTwitterHandle() {
  return matchAny(document.body.innerHTML, /"twitter_screen_name":"([^"]*)/i, null);
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
    console2.error(e);
    return nullVal;
  }
}

function matchAny(html, regexp, nullVal) {
  const m = html.match(regexp);
  return m?.length === 2 ? m[1] : nullVal;
}

// RAFFLE API: WAITERS ---------------------------------------------

export async function waitForRafflePageLoaded(options, maxWait = null) {
  console2.info('Wait for raffle page to load');

  const toWait = typeof maxWait === 'number' ? maxWait : options.LUCKYGO_WAIT_FOR_RAFFLE_PAGE_LOADED;

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
    const elems = [...document.querySelectorAll('div')].filter((x) => x.innerText === 'Twitter');
    if (!elems?.length) {
      return null;
    }
    const h = elems[0].nextElementSibling?.innerText || '';
    return !normalize ? h : normalizeTwitterHandle(h.replace('@', ''));
  } catch (e) {
    return '';
  }
}

export function getTwitterHandle2({ normalize = true } = {}) {
  try {
    const h = matchAny(document.body.innerHTML, /"twitter_screen_name":"([^"]*)/i, null) || '';
    return !normalize ? h : normalizeTwitterHandle(h.replace('@', ''));
  } catch (e) {
    return '';
  }
}

export function getDiscordHandle({ normalize = true } = {}) {
  try {
    const elems = [...document.querySelectorAll('div')].filter((x) => x.innerText === 'Discord');
    if (!elems?.length) {
      return '';
    }
    const h = elems[0].nextElementSibling?.innerText?.trim() || '';
    return !normalize ? h : normalizeDiscordHandle(h);
  } catch (e) {
    return '';
  }
}

export function getDiscordHandle2({ normalize = true } = {}) {
  try {
    const elems = [...document.querySelectorAll('div')].filter((x) => x.innerText === 'Discord');
    if (!elems?.length) {
      return '';
    }
    const h = elems[0].nextElementSibling?.innerText.trim() || '';
    return !normalize ? h : normalizeDiscordHandle(h);
  } catch (e) {
    return '';
  }
}

export function getMustJoinLinks() {
  try {
    const matches = [
      ...document.body.innerHTML.matchAll(/"invite_link":"(https:\/\/discord.gg\/[a-z0-9_-]+)"/gim),
      ...document.body.innerHTML.matchAll(/"invite_link":"(https:\/\/discord.com\/invite\/[a-z0-9_-]+)"/gim),
    ];
    console2.log('matches:', matches);
    const elems = [];
    const links = noDuplicates(matches.map((x) => x[1]));
    console.log('getMustJoinLinks', elems, links);
    return { elems, links };
  } catch (e) {
    return { elems: [], links: [] };
  }
}

export function getMustFollowLinks() {
  try {
    const elems = [];
    const links = getTwitterLinks(
      [...document.querySelectorAll('div')].filter(
        (x) => x.innerText.startsWith('Follow') && x.innerText.endsWith('on Twitter.')
      )
    );
    console.log('getMustFollowLinks', elems, links);
    return { elems, links };
  } catch (e) {
    return { elems: [], links: [] };
  }
}

export function getMustLikeLinks() {
  try {
    const elems = [];
    const links = getTwitterLinks(
      [...document.querySelectorAll('div')].filter(
        (x) => x.innerText.startsWith('Like this') && x.innerText.endsWith('s) .')
      )
    );
    console.log('getMustLikeLinks', elems, links);
    return { elems, links };
  } catch (e) {
    return { elems: [], links: [] };
  }
}

export function getMustRetweetLinks() {
  try {
    const elems = [];
    const links = getTwitterLinks(
      [...document.querySelectorAll('div')].filter(
        (x) => x.innerText.startsWith('Retweet this') && x.innerText.endsWith('s) .')
      )
    );
    console.log('getMustRetweetLinks', elems, links);
    return { elems, links };
  } catch (e) {
    return { elems: [], links: [] };
  }
}

export function getMustLikeAndRetweetLinks() {
  try {
    const elems = [];
    const links = getTwitterLinks(
      [...document.querySelectorAll('div')].filter(
        (x) => x.innerText.startsWith('Like & Retweet') && x.innerText.endsWith('s) .')
      )
    );
    console.log('getMustLikeAndRetweetLinks', elems, links);
    return { elems, links };
  } catch (e) {
    return { elems: [], links: [] };
  }
}

export function getSelectedWallet() {
  try {
    const elems = [...document.querySelectorAll('img')].filter((x) => x.src.includes('Ethereum-fill-brand'));
    if (!elems?.length) {
      return null;
    }
    const elem = elems[0].nextElementSibling;

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

export function getSelectedWallet2() {
  try {
    const elem = document.getElementById('headlessui-listbox-button-:r0:');
    return elem?.innerText || '';
  } catch (e) {
    console2.error(e);
    return '';
  }
}

export function getWonWalletsByThisAccount() {
  return [];
}

export async function getRegisterButton(options, maxWait = 1000, interval = 10) {
  console2.log('getRegisterButton');
  return await waitForTextEquals(options.LUCKYGO_REG_BTN_SEL, 'div', maxWait, interval);
}

export function getRegisterButtonSync(options) {
  return [...document.querySelectorAll('div')].filter((x) => x.innerText === options.LUCKYGO_REG_BTN_SEL)[0];
}

export function getErrors() {
  if (
    [...document.querySelectorAll('p')].filter((x) => x.innerText.includes('Please add mint wallet first'))
      ?.length
  ) {
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
    return !!getTextEquals('Registered successfully.', 'div');
  } catch (e) {
    return false;
  }
}

export async function hasRaffleTrigger(options) {
  return !!getRegisterButtonSync(options);
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

function getTwitterLinks(elems) {
  console2.log('getTwitterLinks, elems', elems);
  if (!elems.length) {
    return [];
  }
  const allLinks = [];
  for (let elem of elems) {
    console2.log('elem', elem);
    const links = [...elem.querySelectorAll('a')]
      .filter(
        (x) =>
          x.href.toLowerCase().startsWith('https://twitter.com/') ||
          x.href.toLowerCase().startsWith('https://x.com/')
      )
      .map((x) => x.href);
    if (links.length) {
      allLinks.push(...links);
    }
  }

  console2.log('getTwitterLinks', allLinks);

  return noDuplicates(allLinks);
}

export function getRegisteringButton() {
  return [...document.querySelectorAll('div')].filter((x) => x.innerText === 'Registering')[0];
}

export function hasErrors() {
  return false;
}
