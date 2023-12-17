import {
  sleep,
  fetchHelper,
  rateLimitHandler,
  noDuplicates,
  convertTextToMonthNum,
  myConsole,
  waitForSelector,
  ONE_SECOND,
} from 'hx-lib';

import { normalizeTwitterHandle, normalizeDiscordHandle } from './premintHelperLib.js';

const console2 = myConsole();
console2.log();

// DATA ----------------------------------------------------------------------------------

const ACCOUNT_URL = 'https://www.premint.xyz/profile/';

const WINS_BASE_URL = 'https://www.premint.xyz/collectors/entries/';

// ACCOUNT -----------------------

export async function getAccount() {
  const result = await fetchHelper(ACCOUNT_URL, {});
  console2.log('getAccount:', result);
  const html = result?.data || '';
  const m = html.match(/<i class="fas fa-wallet mr-1 c-base-1-gradient"><\/i>\s*([^\s]+)\s+<\/button>/im);
  console2.trace('m', m);
  const id = m?.length === 2 ? m[1] : null;
  const _id = id.toString ? id.toString().toLowerCase() : null;
  return {
    id: _id,
  };
}

//

// WINS ----------------------------------------------------------------------------------

export async function getWins(account, { interval = 1500, max = null, skip = [], statusLogger = null } = {}) {
  console2.log('getWins', account, interval, max, skip);
  const { wins, lost } = await fetchWins({ interval, max, skip, statusLogger });
  const lastSortKey = skip.length;
  return {
    wins: convertWins(wins, account, lastSortKey),
    lost: lost.map((x) => x.id),
  };
}

async function fetchWins({ interval, max, skip, statusLogger }) {
  console2.info('Fetch wins; max, interval, skip:', max, interval, skip);

  const wins = [];
  const lost = [];
  let count = 0;

  if (statusLogger) {
    statusLogger.mid(`Get Premint entries...`);
  }

  const entries = await fetchEntries();
  await sleep(interval);

  if (entries?.error) {
    console2.error('Failed getting Premint entries. Error:', entries);
    if (statusLogger) {
      statusLogger.sub('Failed getting Premint entries. Error:' + entries.error.toString());
    }
  }

  const maxText = max ? ` (max ${max})` : '';

  for (const entryMetadata of entries) {
    if (statusLogger) {
      statusLogger.mid(`Get Premint results for raffle ${count + 1} of ${entries.length}${maxText}`);
    }

    if (max && count > max) {
      console2.log('Max entries fetched:', count, '>=', max);
      return { wins, lost };
    }

    if (entryMetadata.live) {
      console2.log('Skip live entry', entryMetadata.url);
      continue;
    }

    count++; // count also non-wins, otherwise can be too many fetches!
    console2.log('Fetch count:', count);

    if (skip?.length && skip.find((id) => id === entryMetadata.id)) {
      console2.log('Skip existing entry', entryMetadata.id);
      continue;
    }

    const entry = await fetchEntry(entryMetadata);
    console2.info(`Sleep ${interval} ms before next fetch`);
    await sleep(interval);

    console2.trace('entry', entry);

    if (entry.error) {
      console2.log('skip error entry:', entry);
      continue;
    }

    if (!entry.isWin) {
      lost.push(entry);
      console2.log('lost entry:', entry);
      continue;
    }

    wins.push(entry);
  }

  return { wins, lost };
}

async function fetchEntries() {
  console2.log('fetchEntries');

  const entries = [];

  const result = await fetchHelper(WINS_BASE_URL, { method: 'GET' }, rateLimitHandler);
  console2.log('result', result);

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
  console2.trace('matches', matches);

  for (const entry of matches) {
    console2.trace('entry', entry);
    if (entry.length !== 5) {
      console2.log('ERROR? Entry length != 5');
      continue;
    }
    entries.push({
      id: entry[1],
      slug: entry[1],
      name: entry[2].replaceAll('\n', '').trim(),
      url: `https://www.premint.xyz${entry[1]}`,
      joinDate: parseJoinDate(entry[3].trim()),
      live: entry[4].toLowerCase() === 'unregister',
    });
  }

  await sleep(0);

  return entries;
}

async function fetchEntry(entry) {
  console2.log('fetchEntry:', entry.url);

  const result = await fetchHelper(entry.url, { method: 'GET' }, rateLimitHandler);
  console2.log('result', result);

  if (result.error) {
    return { error: true, result };
  }

  if (result?.ok && !result.data) {
    return { error: true, result };
  }

  const html = result.data;

  const discordUrls = getDiscordUrls(html) || [];

  return {
    isWin: !!html.match(/<div class="heading heading-1">🏆<\/div>/gim),
    twitterHandles: getTwitterHandles(html) || null,
    discordUrls,
    discordUrl: discordUrls[0] || null,
    wallets: getWallets(html) || null,
    isPasswordProtected: !!html.match(/This page is password protected/im),
    mintDate: getMintDate(html),
    raffleDate: getRaffleDate(html),
    joinDate: entry.joinDate,
    mintPrice: getMintPrice(html),
    ...entry,
  };
}

function parseJoinDate(html) {
  const m = html.match(/Joined ([a-z][a-z][a-z])\. ([0-9]+), ([0-9][0-9][0-9][0-9])/i);
  console2.trace('m', m);
  return createDateFromTextMatch(m);
}

function getMintDate(html) {
  const m = html.match(
    /<i class="fas fa-calendar-alt text-muted mr-1"><\/i>\s*([a-z][a-z][a-z])\. ([0-9]+), ([0-9][0-9][0-9][0-9])\s*<\/span>/i
  );
  console2.trace('m', m);
  return createDateFromTextMatch(m);
}

function getMintPrice(html) {
  const m = html.match(
    /<div class="text-uppercase text-sm text-muted">Mint Price<\/div>\s*<span[^>]*>\s*<i class="fab fa-[^>]+><\/i>\s*([^<]*)<\/span>/i
  );
  return m?.trim ? m.trim() : null;
}

function getRaffleDate(html) {
  const m = html.match(
    /This is when the project has said they'd pick winners.">\s*([a-z][a-z][a-z])\. ([0-9]+), ([0-9][0-9][0-9][0-9])/i
  );
  console2.trace('m', m);
  return createDateFromTextMatch(m);
}

function createDateFromTextMatch(matches) {
  if (!matches || matches.length !== 4) {
    return null;
  }
  const month = convertTextToMonthNum(matches[1]);
  const day = matches[2];
  const year = matches[3];
  if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 2020 && year <= 2099) {
    const d = new Date(year, month - 1, day, 0, 0, 0, 0);
    return d.getTime();
  }

  return null;
}

function getTwitterHandles(html) {
  const m1 = [
    ...html.matchAll(
      /<a href="https:\/\/twitter.com\/[^"]+" target="_blank" class="c-base-1">([^<]+)<\/a>/gim
    ),
  ];
  const m2 = [...html.matchAll(/Twitter: https:\/\/twitter\.com\/([a-z0-9-_]+)</gim)];
  console2.trace('m1', m1);
  console2.trace('m2', m2);

  const data = [];

  noDuplicates([...m1, ...m2]).forEach((m) => {
    if (m.length > 1) {
      data.push(m[1]);
    }
  });

  // remove twitter.com/ etc from bad handles!
  const trimmedData = data.map((x) => normalizeTwitterHandle(x));

  return trimmedData.length ? trimmedData : [];
}

function getDiscordUrls(html) {
  const m1 = [
    ...html.matchAll(
      /<a href="https:\/\/discord.gg\/[^"]+" target="_blank" class="c-base-1">([^<]+)<\/a>/gim
    ),
  ];
  const m2 = [];
  console2.trace('m1', m1);
  console2.trace('m2', m2);

  const data = [];

  noDuplicates([...m1, ...m2]).forEach((m) => {
    if (m.length > 1) {
      data.push(m[1]);
    }
  });

  const trimmedData = data.map((x) => (x.startsWith('https://') ? x : 'https://' + x));

  return trimmedData.length ? trimmedData : [];
}

function getWallets(html) {
  const m1 = [
    ...html.matchAll(
      /<span class="text-sm text-uppercase text-muted">Wallet Address<\/span>\s*([^<]*)<\/div>/gim
    ),
  ];
  console2.trace(m1);

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
    const userId = account.id;
    const userName = account.userName;

    const startDate = x.joinDate;
    const endDate = x.raffleDate;
    const pickedDate = x.raffleDate;
    const modifyDate = null;

    const mintDate = x.mintDate;
    const mintTime = null;

    const twitterHandle = x.twitterHandles;
    const twitterHandleGuess = x.twitterHandles?.length ? x.twitterHandles[0] : '';
    const discordUrl = x.discordUrl;
    const websiteUrl = null;

    const wallets = x.wallets || [];

    const hxId = `${provider}-${userId}-${raffleId}`;
    const hxSortKey = mintDate || pickedDate || endDate || startDate || count + lastSortKey;
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
    const wlPrice = x.mintPrice;

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

// RAFFLE API: WAITERS ---------------------------------------------

export async function waitForRafflePageLoaded() {
  console2.info('Wait for raffle page to load');
  // skip waiting for dom elements for now, perhaps need to in future?!
  return true;
}

// RAFFLE API: RAFFLE GETTERS ---------------------------------------------

export function getRaffleTwitterHandle() {
  return '';
}

export function getTwitterHandle({ normalize = true } = {}) {
  try {
    const h = document.querySelector('#step-twitter').querySelector('span').innerText?.trim() || '';
    return !normalize ? h : normalizeTwitterHandle(h.replace('@', ''));
  } catch (e) {
    console2.error('Failed getting Twitter user! Error:', e);
    return '';
  }
}

export function getDiscordHandle({ normalize = true } = {}) {
  try {
    const h = document.querySelector('#step-discord').querySelector('span').innerText?.trim() || '';
    return !normalize ? h : normalizeDiscordHandle(h);
  } catch (e) {
    return '';
  }
}

export function getMustJoinLinks(options, mustHaveRole = false) {
  try {
    const selectors = mustHaveRole
      ? options.PREMINT_JOIN_DISCORD_WITH_ROLE_SEL
      : options.PREMINT_JOIN_DISCORD_SEL;

    const allElems = [...document.querySelectorAll(selectors[0])].filter(
      (el) =>
        el.textContent.trim().toLowerCase().startsWith(selectors[1]) &&
        el.textContent.trim().toLowerCase().includes(selectors[2])
    );
    const validElems = allElems.length ? [allElems[0].querySelector(selectors[3])] : [];
    console2.log('validElems', validElems);
    const elems = validElems;

    const links = validElems.filter((e) => !!e).map((x) => x.href);
    console2.log('links', links);

    return { elems, links };
  } catch (e) {
    return { elems: [], links: [] };
  }
}

export function getMustFollowLinks(options) {
  try {
    const elems = [];
    const links = parseTwitterLinks(options.PREMINT_MUST_FOLLOW_SEL);
    return { elems, links };
  } catch (e) {
    return { elems: [], links: [] };
  }
}

export function getMustLikeLinks(options) {
  try {
    const elems = [];
    const links = parseTwitterLinks(options.PREMINT_MUST_LIKE_SEL);
    return { elems, links };
  } catch (e) {
    return { elems: [], links: [] };
  }
}

export function getMustRetweetLinks(options) {
  try {
    const elems = [];
    const links = parseTwitterLinks(options.PREMINT_MUST_RETWEET_SEL);
    return { elems, links };
  } catch (e) {
    return { elems: [], links: [] };
  }
}

export function getMustLikeAndRetweetLinks(options) {
  try {
    const elems = [];
    const links = parseTwitterLinks(options.PREMINT_MUST_LIKE_AND_RETWEET_SEL);
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
  return await waitForSelector(options.PREMINT_REG_BTN_SEL, maxWait, interval);
}

export function getRegisterButtonSync(options) {
  return document.querySelector(options.PREMINT_REG_BTN_SEL);
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
    return !!document.body.innerHTML.match(
      /<i class="fas fa-check-circle text-success mr-2"><\/i>Registered/i
    );
  } catch (e) {
    return false;
  }
}

export async function hasRaffleTrigger(options) {
  const elem = await waitForSelector(options.PREMINT_MAIN_REGION_SEL, 10 * ONE_SECOND, 50);
  console2.log('hasRaffleTrigger:', elem);
  return !!elem;
}

export async function hasRaffleTrigger2(options) {
  return hasRaffleTrigger(options);
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

export function hasErrors() {
  return false;
}

function parseTwitterLinks(prefix) {
  try {
    console2.log('parseTwitterLinks; prefix', prefix);
    const baseElem = document.querySelector('#step-twitter');
    if (!baseElem) {
      return [];
    }
    const baseElems = baseElem.querySelectorAll('div[class*="text-md"]');
    console2.log('baseElems', baseElems);
    if (!baseElems?.length) {
      return [];
    }
    const elems = [...baseElems].filter((e) => e.innerText.toLowerCase().trim().startsWith(prefix));
    console2.log('elems', elems);
    const arr = elems.length < 1 ? [] : Array.from(elems[0].getElementsByTagName('a')).map((a) => a.href);
    console2.log('arr', arr);
    return noDuplicates(arr);
  } catch (e) {
    console2.error('Failed parsing twitter links. Error:', e);
    return [];
  }
}
