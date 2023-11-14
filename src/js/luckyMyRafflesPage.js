console.info('luckyMyRafflesPage.js begin', window?.location?.href);

import { getAccount as getLuckyAccount, getWins as getLuckyWins } from './luckyLib.js';

import { getStorageItems, createLogger, sleep, createHashArgs } from 'hx-lib';

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
    return runWon();
  }

  debug.log('Exit runPage!');
}

async function runWon() {
  debug.log('runWon');

  if (!pageState.parentTabId) {
    debug.log('not run by PH, exit');
    return;
  }

  console.log(getLuckyAccount);

  const account = await getLuckyAccount();
  await sleep(2000);
  const wins = await getLuckyWins(account);
  console.log('wins', wins);
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
