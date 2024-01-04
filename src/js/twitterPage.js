console.info('twitterPage.js begin', window?.location?.href);

import '../styles/twitterPage.css';

import global from './global.js';
console.log(global);

import { switchToUser, isEmptyPage, handleAccountAccess, waitForPageLoaded } from './twitterLib.js';
import { debuggerDetach } from './premintHelperLib.js';

import { raidTweet } from './raidLib.js';

import {
  getStorageData,
  dispatch,
  sleep,
  createHashArgs,
  waitForEitherSelector,
  extractTwitterHandle,
  myConsole,
  ONE_MINUTE,
} from 'hx-lib';

import { createStatusbar, focusMyTab, copyToTheClipboard, loadStorage } from './premintHelperLib';

// import { createObserver as createTwitterObserver } from './twitterObserver.js';

const console2 = myConsole(global.LOGLEVEL);

// DATA ----------------------------------------------------------------------------------

let storage;

let pageState = {
  hashArgs: null,
  parentTabId: null,
};

// STARTUP ----------------------------------------------------------------------------

runNow();

async function runNow() {
  await reloadStorage();

  if (!storage?.options) {
    return console2.info('Options missing, exit!');
  }

  // window.addEventListener('load', onLoad);
  window.addEventListener('DOMContentLoaded', onLoad);
}

function onLoad() {
  console2.log('onLoad');

  const hashArgs = createHashArgs(window.location.hash);
  pageState = {
    hashArgs,
    parentTabId: hashArgs.getOne('id'),
    statusbar: createStatusbar(storage.options, { buttons: { raid: true, twitter: false } }),
  };
  console2.info('PageState:', pageState);
  initEventHandlers();
  runPage();
}

async function reloadStorage() {
  storage = await loadStorage({
    keys: ['options', 'stats', 'runtime'],
    ensure: [
      { key: 'stats', val: {} },
      { key: 'runtime', val: {} },
    ],
  });
  console2.info('storage', storage);
}

// EVENT HANDLERS

function initEventHandlers() {
  console2.info('Init event handlers');

  chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    console2.info('Received message:', request, sender);

    if (request.cmd === 'raidFromTwitterDone') {
      await notifyRaidInTwitter(request);
    }

    sendResponse();
    return true;
  });
}

async function notifyRaidInTwitter(request) {
  console.log('notifyRaidInTwitter start');

  if (!window.raidStarted) {
    console.log('Ignore raid result');
    return;
  }
  await debuggerDetach(storage.options);
  window.raidStarted = false;
  focusMyTab();
  let r = false;
  while (!r) {
    r = window.confirm(
      `Done raiding ${request.fromUrl}.\n\nRetweeted post URL is copied to clipboard after closing this dialog.`
    );
    console.log('r', r);
    if (r) {
      await copyToTheClipboard(request.replyUrl);
      break;
    }
    await sleep(1000);
  }
  console.log('notifyRaidInTwitter done');
  // window.close();
}

// PAGE FUNCTIONS ----------------------------------------------------------------------------

async function runPage() {
  console2.info('runPage');

  const request1 = await dispatch(window.location.href.replace('x.com', 'twitter.com'), 5 * 60, true);
  const request2 = await dispatch(window.location.href.replace('twitter.com', 'x.com'), 5 * 60, true);
  const request = request1 || request2;
  console2.info('Dispatched request:', request);
  pageState.request = request;
  pageState.action = request?.action;

  if (window.location.href.includes('/account/access')) {
    return await runAccountAccess();
  }

  if (request?.action === 'unlocked') {
    return await runUnlocked();
  }

  if (pageState.action === 'raidFromDiscordPage') {
    return await runRaidFromDiscord();
  }

  if (pageState.hashArgs.getOne('switchToUser')) {
    return await runSwitchToUser();
  }

  if (pageState.hashArgs.getOne('getProfile')) {
    return await runGetProfile();
  }

  if (window.location.pathname === '/home') {
    return await runHomePage();
  }

  if (window.location.pathname === '/') {
    return await runHomePage();
  }

  await runMainLoop();

  console2.info('Exit runPage!');
}

async function runAccountAccess() {
  await reloadStorage();
  await handleAccountAccess(storage, { pageState });
}

async function runUnlocked() {
  await chrome.runtime.sendMessage({ cmd: 'broadcast', request: { cmd: 'unlockedTwitterAccount' } });
  await sleep(1200, 1500);
  window.close();
}

async function runRaidFromDiscord() {
  await waitForPageLoaded();
  await raidTweet(storage.options, 'discord', pageState.request.team);
  await sleep(2000, 4000);
  //window.close();
}

async function runSwitchToUser() {
  console2.log('runSwitchToUser');

  const user = pageState.hashArgs.getOne('switchToUser');
  console2.log('user', user);

  if (user) {
    const result = await switchToUser(storage.options, user, pageState.parentTabId);
    if (result.error) {
      await chrome.runtime.sendMessage({
        cmd: 'sendTo',
        to: pageState.parentTabId,
        request: { cmd: 'switchedToTwitterUser', user, error: result.error },
      });
      console2.error('Cannot switch to Twitter user! User, error:', user, result);
      return;
    }
    console2.info('Twitter user already selected:', user, result);
    await chrome.runtime.sendMessage({
      cmd: 'sendTo',
      to: pageState.parentTabId,
      request: { cmd: 'switchedToTwitterUser', user, ok: true },
    });
    await sleep(1200, 1500);
    window.close();
  } else {
    await chrome.runtime.sendMessage({
      cmd: 'sendTo',
      to: pageState.parentTabId,
      request: { cmd: 'switchedToTwitterUser', user, error: 'noUser' },
    });
  }
}

async function runHomePage() {
  console2.info('runHomePage');

  const request = pageState.request; // await dispatch(window.location.href, 60, true);
  //const request2 = await dispatch(urlWithoutArgs(window.location.href), 60, true);
  //const request = request1?.action ? request1 : request2;

  console2.log('request:', request);

  if (request?.action === 'switchedUser') {
    if (request.redirectTo) {
      console2.info('Redirect to:', request.redirectTo);
      window.location.href = request.redirectTo;
      return;
    }
    await chrome.runtime.sendMessage({
      cmd: 'sendTo',
      to: request.parentTabId,
      request: { cmd: 'switchedToTwitterUser', user: request.user, ok: true },
    });
    await sleep(1200, 1500);
    window.close();
    return;
  }
}

async function runGetProfile() {
  console2.info('runGetProfile');

  const profile = await getUserProfile();
  console2.log('profile', profile);

  await chrome.runtime.sendMessage({
    cmd: 'sendTo',
    to: pageState.parentTabId,
    request: { cmd: 'profileResult', profile },
  });
  await sleep(storage.options.TWITTER_LOOKUPS_SLEEP_BETWEEN, null, 0.1);
  window.close();
}

async function runMainLoop() {
  console2.info('runMainLoop');

  console.log(await getStorageData());

  const request = pageState.request; // await dispatch(window.location.href, 60, true);
  console.log('request', request);

  if (request?.action === 'visit') {
    await visitPage(request);
    return;
  }

  if (storage.options.TWITTER_AUTO_UPDATE_FOLLOWERS) {
    const profile = await getUserProfile(ONE_MINUTE, 250);
    console2.log('profile', profile);
    if (profile) {
      await chrome.runtime.sendMessage({ cmd: 'profileResultMainLoop', profile });
    }
  }
}

async function visitPage(request) {
  await sleep(request.duration, null, 0.2);
  window.close();
}

async function getUserProfile(maxWait = 10 * 1000, interval = 10) {
  const selectors = ['[data-testid="emptyState"]', '[data-testid="UserProfileSchema-test"]'];

  const elem = await waitForEitherSelector(selectors, maxWait, interval);
  console2.log('elem:', elem);

  if (elem && (await isEmptyPage(10, 10))) {
    return {
      error: 'empty',
    };
  }

  if (!elem || !elem.innerText) {
    return {
      error: 'noProfile',
    };
  }

  const obj = parseJSON(elem.innerText);
  if (!obj) {
    return {
      error: 'noJSON',
    };
  }

  const username = extractTwitterHandle(window.location.href);

  const result = {
    ok: true,
    username,
    dateCreated: obj.dateCreated,
    additionalName: obj.author?.additionalName,
    description: obj.author?.description,
    givenName: obj.author?.givenName,
    identifier: obj.author?.identifier,
    url: obj.author?.url,
  };

  obj.author?.interactionStatistic.forEach((o) => {
    if (o.name.toLowerCase() === 'follows') {
      result.follows = o.userInteractionCount;
    }
    if (o.name.toLowerCase() === 'friends') {
      result.friends = o.userInteractionCount;
    }
    if (o.name.toLowerCase() === 'tweets') {
      result.tweets = o.userInteractionCount;
    }
  });

  return result;
}

function parseJSON(str) {
  try {
    return JSON.parse(str);
  } catch (e) {
    return undefined;
  }
}

// MISC HELPERS -------------------------------------
