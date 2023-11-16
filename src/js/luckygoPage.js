console.info('luckygoPage.js begin', window?.location?.href);

import { getStorageItems, createLogger, sleep, createHashArgs, dispatch } from 'hx-lib';
import { getCookie } from './premintHelperLib';

const debug = createLogger();

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
  debug.log('storage', storage);

  if (!storage?.options) {
    return debug.info('Options missing, exit!');
  }

  const hashArgs = createHashArgs(window.location.hash);
  pageState = {
    hashArgs,
    parentTabId: hashArgs.getOne('id'),
  };
  debug.log('pageState', pageState);

  // window.addEventListener('load', onLoad);
  window.addEventListener('DOMContentLoaded', onLoad);
}

function onLoad() {
  debug.log('onLoad');
  runPage();
}

// PAGE FUNCTIONS ----------------------------------------------------------------------------

async function runPage() {
  debug.log('runPage');

  if (window.location.href.includes('/myraffles')) {
    return runMyRafflesPage();
  }

  debug.log('Exit runPage!');
}

async function runMyRafflesPage() {
  debug.log('runGetAuthKey');

  if (!pageState.action) {
    const request = await dispatch(window.location.href, 300);
    debug.log('dispatched request:', request);
    pageState.request = request;
    pageState.action = request?.action;
    pageState.parentTabId = request?.tabId;
  }

  if (pageState.action === 'getAuth') {
    return getAuth();
  }

  debug.log('not dispatched, exit');
  return;
}

async function getAuth() {
  const val = getCookie('Authorization');
  debug.log('getAuth, val:', val);

  await chrome.runtime.sendMessage({
    cmd: 'sendTo',
    to: pageState.parentTabId,
    request: { cmd: 'getAuth', val },
  });
  await sleep(1);
  window.close();
}

/*
async function runGetProfile() {
  debug.log('runGetProfile');

  const profile = await getUserProfile();
  debug.log('profile', profile);

  await chrome.runtime.sendMessage({
    cmd: 'sendTo',
    to: pageState.parentTabId,
    request: { cmd: 'profileResult', profile },
  });
  await sleep(1);
  window.close();
}

async function runMainLoop() {
  debug.log('runMainLoop');

  if (storage.options.TWITTER_AUTO_UPDATE_FOLLOWERS) {
    const profile = await getUserProfile(ONE_MINUTE, 250);
    debug.log('profile', profile);
    if (profile) {
      await chrome.runtime.sendMessage({ cmd: 'profileResultMainLoop', profile });
    }
  }
}

async function getUserProfile(maxWait = 10 * 1000, interval = 10) {
  const selectors = ['[data-testid="emptyState"]', '[data-testid="UserProfileSchema-test"]'];

  const elem = await waitForEitherSelector(selectors, maxWait, interval);
  debug.log('elem:', elem);

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
*/
