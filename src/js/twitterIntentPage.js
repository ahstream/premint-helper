console.info('twitterIntentPage.js begin', window?.location?.href);

import { switchToUser } from './twitter.js';
import { getStorageItems, createLogger, sleep, createHashArgs, waitForSelector, millisecondsAhead, ONE_HOUR } from '@ahstream/hx-utils';

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
    debug.info('Options missing, exit!');
    return;
  }

  const hashArgs = createHashArgs(window.location.hash);
  pageState = {
    hashArgs,
    parentTabId: hashArgs.getOne('id'),
  };
  debug.log('pageState', pageState);

  if (!pageState.parentTabId && !storage.options.TWITTER_ENABLE_MANUAL) {
    debug.info('Disabled forced, exit!');
    return;
  }

  if (pageState.parentTabId && !storage.options.TWITTER_ENABLE) {
    debug.info('Disabled, exit!');
    return;
  }

  window.addEventListener('load', onLoad);
}

function onLoad() {
  debug.log('onLoad');
  runPage();
}

// PAGE FUNCTIONS ----------------------------------------------------------------------------

async function runPage() {
  debug.log('runPage');

  if (window.location.pathname.includes('intent/')) {
    await runMainLoop();
  }

  debug.log('Exit runPage!');
}

async function runMainLoop() {
  debug.log('runMainLoop');

  const user = pageState.hashArgs.getOne('user');
  debug.log('user', user);

  if (user) {
    const result = await switchToUser(user, pageState.parentTabId, window.location.href);
    if (result.error) {
      await chrome.runtime.sendMessage({
        cmd: 'sendTo',
        to: pageState.parentTabId,
        request: { cmd: 'switchedToTwitterUser', to: pageState.parentTabId, user, error: result.error },
      });
      debug.log('Cannot switch to Twitter user! User, error:', user, result);
      return;
    }
    debug.log('Twitter user already selected:', user, result);
  }

  const stopTime = millisecondsAhead(storage.options.TWITTER_MAIN_LOOP_RUN_FOR);
  while (Date.now() <= stopTime) {
    if (await runIntentAction()) {
      break;
    }
    await sleep(storage.options.TWITTER_MAIN_LOOP_SLEEP);
  }

  debug.log('Exit runMainLoop!');
}

async function runIntentAction() {
  debug.log('runIntentAction');

  const intentBtn = getIntentButton();
  debug.log('intentBtn', intentBtn);
  if (!intentBtn) {
    return;
  }

  await waitForPageLoaded();
  await sleep(10);

  debug.log('click intentBtn:', intentBtn);
  intentBtn.click();

  await waitForNoIntentBtn();

  if (await checkForAction()) {
    await finishIntentAction();
    return true;
  } else {
    return false;
  }
}

async function waitForNoIntentBtn() {
  debug.log('waitForNoIntentBtn');
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const btn = getIntentButton();
    if (btn) {
      debug.log('waitForNoIntentBtn...');
      // not sure if we really should click here: btn.click();
      await sleep(10);
    } else {
      break;
    }
  }
  await sleep(250);
  debug.log('Exit waitForNoIntentBtn!');
}

async function waitForPageLoaded() {
  return getIntent().follow ? await waitForProfileLoaded() : await waitForTweetLoaded();
}

async function waitForTweetLoaded(maxWait = ONE_HOUR, interval = 10) {
  debug.log('waitForTweetLoaded:', storage.options.TWITTER_REPLY_SEL);
  return !!(await waitForSelector(storage.options.TWITTER_REPLY_SEL, maxWait, interval));
}

async function waitForProfileLoaded(maxWait = ONE_HOUR, interval = 10) {
  debug.log('waitForProfileLoaded:', storage.options.TWITTER_PROFILE_SEL);
  return !!(await waitForSelector(storage.options.TWITTER_PROFILE_SEL, maxWait, interval));
}

async function finishIntentAction() {
  debug.log('finishIntentAction; parentTabId:', pageState.parentTabId);
  if (pageState.parentTabId) {
    debug.log('send finish msg to parentId:', pageState.parentTabId);
    await chrome.runtime.sendMessage({
      cmd: 'finish',
      delay: storage.options.TWITTER_PARENT_SUGGESTED_DELAY,
      to: pageState.parentTabId,
      what: 'twitterIntent',
    });
  }
  const shouldClose = pageState.parentTabId && storage.options.TWITTER_CLOSE_TASK_PAGE;
  if (shouldClose) {
    debug.log('Close Twitter page after action...');
    await sleep(storage.options.TWITTER_CLOSE_TASK_PAGE_DELAY, null, 0.2);
    window.close();
  }
}

async function checkForAction(maxWait = ONE_HOUR, interval = 100) {
  debug.log('checkForAction');
  let elem;
  let isDone = false;
  const intent = getIntent();
  debug.log('intent:', intent);
  if (intent.follow) {
    elem = await waitForSelector(storage.options.TWITTER_FOLLOWING_SEL, maxWait, interval);
    isDone = !!elem;
  } else if (intent.like) {
    isDone = !!(await waitForSelector(storage.options.TWITTER_LIKED_SEL, maxWait, interval));
  } else if (intent.retweet) {
    isDone = !!(await waitForSelector(storage.options.TWITTER_RETWEETED_SEL, maxWait, interval));
  }
  debug.log('Exit checkForAction; isDone:', isDone);
  return isDone;
}

function getIntentButton() {
  return document.querySelector(storage.options.TWITTER_INTENT_BTN_SEL);
}

function getIntent() {
  return {
    follow: window.location.href.includes('intent/user') || window.location.href.includes('intent/follow'),
    like: window.location.href.includes('intent/like'),
    retweet: window.location.href.includes('intent/retweet'),
  };
}
