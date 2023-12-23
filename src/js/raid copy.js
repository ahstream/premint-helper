import global from './global.js';
console.log(global);

import {
  myConsole,
  getStorageItems,
  randomInt,
  noDuplicates,
  addPendingRequest,
  // setStorageData,
} from 'hx-lib';

import { raid, isTwitterPage } from './twitterLib';
import { getFirstTwitterStatusLink, getActiveServerName, isDiscordPage } from './discordLib';
import { copyToTheClipboard } from './premintHelperLib';

const console2 = myConsole(global.LOGLEVEL);
console2.log();

// DATA ----------------------------------------------------------------------------------

let storage;
const DEFAULT_RAID_TEXT = 'gm';

// FUNCTIONS ----------------------------------------------------------------------------------

export async function raidTwitterPost({ gotoPost = false } = {}) {
  console.log('raidTwitterPost', gotoPost);
  window.raidStarted = true;

  storage = await getStorageItems(['options']);
  console.log('storage', storage);

  const href = window.location.href.toLowerCase();
  console.log('isDiscordPage(href)', isDiscordPage(href));
  console.log('isTwitterPage(href)', isTwitterPage(href));

  if (isDiscordPage(href)) {
    return raidFromDiscordPage();
  }
  if (isTwitterPage(href)) {
    return raidFromTwitterPage(storage.options, 'twitter', { gotoPost });
  }
}

export async function raidFromDiscordPage() {
  console.log('raid discord');

  const url = getFirstTwitterStatusLink();
  if (!url) {
    return false;
  }
  const team = getActiveServerName();

  await addPendingRequest(url, { action: 'raidFromDiscordPage', team });
  window.open(url, '_blank');

  return true;
}

export async function raidFromTwitterPage(options, source, { team = null, gotoPost = false }) {
  console.log('raidFromTwitterPage', team, gotoPost);

  /*
  storage = await getStorageItems(['options']);
  console.log('storage', storage);
  */

  const raidText = getRaidText(options, team);
  console.log('raidText', raidText);

  if (options.RAID_FROM_TWITTER_PAGE_FULL) {
    return await raidFromTwitterPageFull(options, raidText, gotoPost);
  }
  return await raidFromTwitterPageLite(raidText);
}

async function raidFromTwitterPageLite(raidText) {
  console.log('raidFromTwitterPageLite', raidText);
  copyToTheClipboard(raidText);
}

async function raidFromTwitterPageFull(options, raidText, gotoPost) {
  console.log('raidFromTwitterPageFull', raidText, gotoPost);

  const replyUrl = await raid(options, raidText);
  console.log('Raid new post url:', replyUrl);

  if (!replyUrl) {
    return false;
  }

  await chrome.runtime.sendMessage({
    cmd: 'broadcast',
    request: {
      cmd: 'raidTwitterPostDone',
      fromUrl: window.location.href,
      replyUrl,
    },
  });

  if (gotoPost && replyUrl) {
    window.location.href = replyUrl;
  }

  return true;
}

// HELPERS ----------------------------------------------------------------------------------

function getRaidTeamName(team, arr) {
  const teamLow = team?.toLowerCase();
  for (let item of arr) {
    const tokens = item.split(':');
    if (tokens?.length !== 2) {
      continue;
    }
    const itemTeam = tokens[0].toLowerCase();
    if (itemTeam !== teamLow) {
      continue;
    }
    const itemNames = tokens[1].split(',');
    if (itemNames?.length < 1) {
      continue;
    }
    const randName = getRandomFromArray(itemNames);
    if (randName) {
      return randName;
    }
  }
  return '';
}

function getRandomFromArray(arr) {
  return !arr.length ? null : arr[randomInt(0, arr.length - 1)];
}

function getRaidText(options, team, defaultText = DEFAULT_RAID_TEXT) {
  console.log('getRaidText', team, defaultText);

  const raidTexts = splitCommaDelimitedTexts(options.RAID_TEXTS);
  const raidTeamTexts = splitCommaDelimitedTexts(options.RAID_TEAM_TEXTS);
  const raidEmoji = splitCommaDelimitedTexts(options.RAID_EMOJIS);
  const raidTeamName = team ? getRaidTeamName(team, options.RAID_TEAM_NAMES) : '';
  console.log('raid:', raidTexts, raidTeamTexts, raidEmoji, raidTeamName);

  let text = getRandomFromArray(raidTeamName ? raidTeamTexts : raidTexts);
  if (text === null) {
    return defaultText;
  }
  console.log('text:', text);

  const emojiTextItem = raidEmoji?.length ? getRandomFromArray(raidEmoji) : '';
  const numEmojis = emojiTextItem ? randomInt(options.RAID_MIN_EMOJIS, options.RAID_MAX_EMOJIS) : 0;
  const emojiTextArr = numEmojis ? new Array(numEmojis).fill(emojiTextItem) : [];
  const emojiText = emojiTextArr.join('');
  console.log('raid:', emojiTextItem, numEmojis, emojiTextArr, raidTeamName);

  text = text.replace('{TEAM}', raidTeamName).replace('{EMOJI}', emojiText).replace('  ', ' ').trim();
  console.log('text:', text);

  return text || defaultText;
}

function splitCommaDelimitedTexts(arr) {
  return noDuplicates(
    arr
      .map((x) => x.split(','))
      .flat()
      .map((x) => x.trim())
  );
}
