import global from './global.js';
console.log(global);

import {
  myConsole,
  randomInt,
  noDuplicates,
  addPendingRequest,
  getStorageItems,
  setStorageData,
  sleep,
} from 'hx-lib';

import { raid, isTwitterPage, isTwitterStatusPage } from './twitterLib.js';
import { getFirstTwitterStatusLink, getActiveServerName, isDiscordPage } from './discordLib.js';
import { copyToTheClipboard } from './premintHelperLib.js';
import { debuggerSendPageDownDiscord } from './chromeDebugger.js';

const console2 = myConsole(global.LOGLEVEL);
console2.log();

// DATA ----------------------------------------------------------------------------------

const DEFAULT_RAID_TEXT = 'gm';

// const KEY_CODE_HOME = 36;
//const KEY_CODE_END = 35;

// FUNCTIONS ----------------------------------------------------------------------------------

export async function runRaid() {
  window.raidStarted = true;
  const storage = await getStorageItems(['options']);
  console.log('storage', storage);
  const href = window.location.href.toLowerCase();
  if (isDiscordPage(href)) {
    return raidFromDiscordPage();
  }
  if (isTwitterPage(href)) {
    return raidFromTwitterPage(storage.options);
  }
}

export async function addRaidLink() {
  console.log('addRaidLink');

  const storage = await getStorageItems(['options', 'raid']);
  if (!storage.raid) {
    storage.raid = {};
  }
  if (!storage.raid.addedLinks?.length) {
    storage.raid.addedLinks = [];
  }
  console.log('storage', storage);

  let added = false;
  const href = window.location.href.toLowerCase();
  if (isDiscordPage(href)) {
    added = addDiscordRaidLink(storage);
  } else if (isTwitterPage(href)) {
    added = addTwitterRaidLink(storage);
  } else {
    window.alert('ERROR: Raid link has to be either a Twitter status webpage or a Discord webpage.');
  }
  await setStorageData(storage);
  console.log('addRaidLink, added:', added, href);

  if (added) {
    window.alert(`Link added!\n\n${storage.raid.addedLinks.reverse().join('\n')}`);
  }
}

function addTwitterRaidLink(storage) {
  if (!isTwitterStatusPage(window.location.href)) {
    window.alert('ERROR: Raid link has to be either a Twitter status webpage or a Discord webpage.');
    return false;
  }
  storage.raid.addedLinks.push(window.location.href);
  return true;
}

function addDiscordRaidLink(storage) {
  storage.raid.addedLinks.push(window.location.href);
  return true;
}

export async function showRaidPage() {
  chrome.runtime.sendMessage({
    cmd: 'openTab',
    url: chrome.runtime.getURL('/raid.html'),
    active: true,
  });
}

export async function raidFromDiscordPage() {
  console.log('raidFromDiscordPage');
  //await debuggerSendKeyEvent(KEY_CODE_HOME);
  document.querySelector('ol[class^="scrollerInner"]').scrollIntoView();
  await sleep(500);
  const url = getFirstTwitterStatusLink();
  console.log('url', url);
  if (!url) {
    return false;
  }

  const team = getActiveServerName();
  console.log('team', team);
  await debuggerSendPageDownDiscord();
  //await debuggerSendKeyEvent(KEY_CODE_END);
  await addPendingRequest(url, { action: 'raidFromDiscordPage', team });
  window.open(url, '_blank');
  return true;
}

export async function raidFromTwitterPage(options) {
  console.log('raidFromTwitterPage');
  return raidTweet(options, 'twitter');
}

export async function raidTweet(options, source, team = null) {
  console.log('raidTweet', source, team);
  /*
  storage = await getStorageItems(['options']);
  console.log('storage', storage);
  */
  const raidText = getRaidText(options, team);
  console.log('raidText', raidText);

  if (options.RAID_FROM_TWITTER_PAGE_FULL) {
    return await raidTweetFull(options, raidText, source);
  }
  return await raidTweetLite(raidText);
}

async function raidTweetLite(raidText) {
  console.log('raidTweetLite', raidText);
  copyToTheClipboard(raidText);
}

async function raidTweetFull(options, raidText, source, gotoPost = false) {
  console.log('raidTweetFull', raidText, gotoPost);

  const replyUrl = await raid(options, raidText);
  console.log('Raid new post url:', replyUrl);

  if (!replyUrl) {
    return false;
  }

  const cmd = source === 'discord' ? 'raidFromDiscordDone' : 'raidFromTwitterDone';

  await chrome.runtime.sendMessage({
    cmd: 'broadcast',
    request: {
      cmd,
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
