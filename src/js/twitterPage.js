console.info('twitterPage.js begin', window?.location?.href);

import { switchToUser, isEmptyPage, handleLockedTwitterAccount } from './twitterLib.js';

import {
  getStorageItems,
  dispatch,
  sleep,
  createHashArgs,
  waitForEitherSelector,
  extractTwitterHandle,
  myConsole,
  ONE_MINUTE,
} from 'hx-lib';

import { createObserver as createTwitterObserver } from './twitterObserver.js';

const console2 = myConsole();

// DATA ----------------------------------------------------------------------------------

let storage;

let pageState = {
  hashArgs: null,
  parentTabId: null,
};

// STARTUP ----------------------------------------------------------------------------

runNow();

async function runNow() {
  storage = await getStorageItems(['options']);
  console2.log('storage', storage);

  if (!storage?.options) {
    return console2.info('Options missing, exit!');
  }

  const hashArgs = createHashArgs(window.location.hash);
  pageState = {
    hashArgs,
    parentTabId: hashArgs.getOne('id'),
    twitterObserver: await createTwitterObserver({
      permissions: pageState.permissions,
      logger: {},
    }),
  };

  console2.log('pageState', pageState);

  // window.addEventListener('load', onLoad);
  window.addEventListener('DOMContentLoaded', onLoad);
}

function onLoad() {
  console2.log('onLoad');
  runPage();
}

// PAGE FUNCTIONS ----------------------------------------------------------------------------

async function runPage() {
  console2.info('runPage');

  if (window.location.href.endsWith('/account/access')) {
    return await handleLockedTwitterAccount({ pageState });
  }

  if (pageState.hashArgs.getOne('switchToUser')) {
    return runSwitchToUser();
  }

  if (pageState.hashArgs.getOne('getProfile')) {
    return runGetProfile();
  }

  if (window.location.pathname === '/home') {
    return runHomePage();
  }

  if (window.location.pathname === '/') {
    return runHomePage();
  }

  await runMainLoop();

  console2.info('Exit runPage!');
}

async function runSwitchToUser() {
  console2.log('runSwitchToUser');

  const user = pageState.hashArgs.getOne('switchToUser');
  console2.log('user', user);

  if (user) {
    const result = await switchToUser(user, pageState.parentTabId);
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

  const request = await dispatch(window.location.href, 60, true);
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
    window.close();
    return;
  }

  if (request?.action === 'unlocked') {
    await chrome.runtime.sendMessage({ cmd: 'broadcast', request: { cmd: 'unlockedTwitterAccount' } });
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
  await sleep(1);
  window.close();
}

async function runMainLoop() {
  console2.info('runMainLoop');

  if (storage.options.TWITTER_AUTO_UPDATE_FOLLOWERS) {
    const profile = await getUserProfile(ONE_MINUTE, 250);
    console2.log('profile', profile);
    if (profile) {
      await chrome.runtime.sendMessage({ cmd: 'profileResultMainLoop', profile });
    }
  }
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
