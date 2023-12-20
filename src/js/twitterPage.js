console.info('twitterPage.js begin', window?.location?.href);

import '../styles/twitterPage.css';

import {
  switchToUser,
  isEmptyPage,
  handleLockedTwitterAccount,
  retweet,
  like,
  comment,
  waitForPageLoaded,
} from './twitterLib.js';

import { raidFromTwitterPage } from './raid.js';

import {
  getStorageItems,
  getStorageData,
  dispatch,
  sleep,
  createHashArgs,
  waitForEitherSelector,
  extractTwitterHandle,
  myConsole,
  ONE_MINUTE,
} from 'hx-lib';

import { createStatusbar, notifyRaid } from './premintHelperLib';

// import { createObserver as createTwitterObserver } from './twitterObserver.js';

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

  // window.addEventListener('load', onLoad);
  window.addEventListener('DOMContentLoaded', onLoad);
}

function onLoad() {
  console2.log('onLoad');

  const hashArgs = createHashArgs(window.location.hash);
  pageState = {
    hashArgs,
    parentTabId: hashArgs.getOne('id'),
    statusbar: createStatusbar(storage.options),
  };
  console2.info('PageState:', pageState);
  initEventHandlers();
  runPage();
}

// EVENT HANDLERS

function initEventHandlers() {
  console2.info('Init event handlers');

  chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    console2.info('Received message:', request, sender);

    if (request.cmd === 'raidTwitterPostDone') {
      notifyRaid(request);
    }

    sendResponse();
    return true;
  });
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
    return await handleLockedTwitterAccount({ pageState });
  }

  if (request?.action === 'unlocked') {
    await chrome.runtime.sendMessage({ cmd: 'broadcast', request: { cmd: 'unlockedTwitterAccount' } });
    window.close();
    return;
  }

  if (pageState.action === 'raid') {
    await waitForPageLoaded();
    return raidFromTwitterPage({ team: pageState.request.team, gotoPost: true });
  }

  if (pageState.hashArgs.getOne('retweet')) {
    return runRetweet();
  }

  if (pageState.hashArgs.getOne('like')) {
    return runLike();
  }

  if (pageState.hashArgs.getOne('comment')) {
    return runComment(pageState.hashArgs.getOne('comment'));
  }

  if (pageState.hashArgs.getOne('raid')) {
    return raidFromTwitterPage({ gotoPost: true });
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

async function runRetweet() {
  console2.log('runRetweet');
  const result = await retweet();
  console2.log('result', result);
  return result;
}

async function runLike() {
  console2.log('runLike');
  const result = await like();
  console2.log('result', result);
  return result;
}

async function runComment(text) {
  console2.log('runComment', text);
  const result = await comment(text);
  console2.log('result', result);
  return result;
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
  await sleep(request.duration);
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
