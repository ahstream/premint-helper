console.info('twitterIntentPage.js begin', window?.location?.href);

import global from './global.js';
console.log(global);

import { switchToUser } from './twitterLib.js';
import {
  getStorageItems,
  sleep,
  createHashArgs,
  waitForSelector,
  millisecondsAhead,
  myConsole,
  ONE_HOUR,
  ONE_MINUTE,
} from 'hx-lib';

import { clickTwitterElem } from './premintHelperLib.js';

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
  storage = await getStorageItems(['options']);
  console2.log('storage', storage);

  if (!storage?.options) {
    console2.info('Options missing, exit!');
    return;
  }

  const hashArgs = createHashArgs(window.location.hash);
  pageState = {
    hashArgs,
    parentTabId: hashArgs.getOne('id'),
  };
  console2.info('PageState:', pageState);

  if (!pageState.parentTabId && !storage.options.TWITTER_ENABLE_MANUAL) {
    console2.info('Disabled forced, exit!');
    return;
  }

  if (pageState.parentTabId && !storage.options.TWITTER_ENABLE) {
    console2.info('Disabled, exit!');
    return;
  }

  window.addEventListener('load', onLoad);
}

function onLoad() {
  console2.log('onLoad');
  runPage();
}

// PAGE FUNCTIONS ----------------------------------------------------------------------------

async function runPage() {
  console2.info('runPage');

  if (window.location.pathname.includes('intent/')) {
    await runMainLoop();
  }

  if (window.location.pathname.includes('/account/access')) {
    window.location.href = 'https://twitter.com/account/access';
    window.location.reload();
    return;
  }

  console2.info('Exit runPage!');
}

async function runMainLoop() {
  console2.info('runMainLoop');

  const user = pageState.hashArgs.getOne('user');
  console2.log('user', user);

  if (user) {
    const result = await switchToUser(storage.options, user, pageState.parentTabId, window.location.href);
    if (result.error) {
      await chrome.runtime.sendMessage({
        cmd: 'sendTo',
        to: pageState.parentTabId,
        request: { cmd: 'switchedToTwitterUser', to: pageState.parentTabId, user, error: result.error },
      });
      console2.error('Cannot switch to Twitter user! User, error:', user, result);
      return;
    }
    console2.info('Twitter user already selected:', user, result);
  }

  const stopTime = millisecondsAhead(storage.options.TWITTER_MAIN_LOOP_RUN_FOR);
  while (Date.now() <= stopTime) {
    if (await runIntentAction()) {
      break;
    }
    await sleep(storage.options.TWITTER_MAIN_LOOP_SLEEP);
  }

  console2.info('Exit runMainLoop!');
}

async function runIntentAction() {
  console2.info('runIntentAction');

  const intentBtn = getIntentButton();
  console2.log('intentBtn', intentBtn);
  if (!intentBtn) {
    return;
  }

  await waitForPageLoaded();
  await sleep(20);
  await sleep(storage.options.TWITTER_DELAY_BEFORE_CLICK_INTENT_BTN, null, 0.5);

  console2.trace('click intentBtn:', intentBtn);
  // clickTwitterElem(storage.options, intentBtn);
  await ensureIntentBtnClicked(intentBtn);
  // intentBtn.click();

  await waitForNoIntentBtn();

  console2.log('checkForAction');

  if (await checkForAction()) {
    console2.log('checkForAction true');
    await finishIntentAction();
    return true;
  } else {
    console2.log('checkForAction false');
    return false;
  }
}

async function ensureIntentBtnClicked(btn, maxWait = ONE_MINUTE, interval = 250) {
  console2.info('ensureIntentBtnClicked', btn);

  const stopTime = millisecondsAhead(maxWait);
  while (Date.now() <= stopTime) {
    await clickTwitterElem(storage.options, btn);
    await sleep(interval);
    if (!getIntentButton()) {
      return;
    }
    await sleep(interval);
  }
  console2.info('Failed ensureIntentBtnClicked', btn);
}

async function waitForNoIntentBtn(maxWait = 10 * ONE_MINUTE, interval = 250) {
  console2.log('waitForNoIntentBtn');
  // eslint-disable-next-line no-constant-condition
  const stopTime = millisecondsAhead(maxWait);
  while (Date.now() <= stopTime) {
    console2.log('waitForNoIntentBtn...');
    if (!getIntentButton()) {
      break;
    }
    await sleep(interval);
  }
  await sleep(100);
  console2.info('Failed waitForNoIntentBtn!');
}

async function waitForPageLoaded() {
  return getIntent().follow ? await waitForProfileLoaded() : await waitForTweetLoaded();
}

async function waitForTweetLoaded(maxWait = ONE_HOUR, interval = 10) {
  console2.trace('waitForTweetLoaded:', storage.options.TWITTER_REPLY_SEL);
  return !!(await waitForSelector(storage.options.TWITTER_REPLY_SEL, maxWait, interval));
}

async function waitForProfileLoaded(maxWait = ONE_HOUR, interval = 10) {
  console2.trace('waitForProfileLoaded:', storage.options.TWITTER_PROFILE_SEL);
  return !!(await waitForSelector(storage.options.TWITTER_PROFILE_SEL, maxWait, interval));
}

async function finishIntentAction() {
  console2.log('finishIntentAction; parentTabId:', pageState.parentTabId);
  if (pageState.parentTabId) {
    console2.log('send finish msg to parentId:', pageState.parentTabId);
    await chrome.runtime.sendMessage({
      cmd: 'finish',
      delay: storage.options.TWITTER_PARENT_SUGGESTED_DELAY,
      to: pageState.parentTabId,
      twitter: true,
    });
  }
  const shouldClose = pageState.parentTabId && storage.options.TWITTER_CLOSE_TASK_PAGE;
  if (shouldClose) {
    console2.info('Close Twitter page after action...');
    await sleep(storage.options.TWITTER_CLOSE_TASK_PAGE_DELAY, null, 0.2);
    window.close();
  }
}

async function checkForAction(maxWait = ONE_HOUR, interval = 100) {
  console2.log('checkForAction');
  let elem;
  let isDone = false;
  const intent = getIntent();
  console2.log('intent:', intent);
  if (intent.follow) {
    console2.trace('Wait for followed selector...', storage.options.TWITTER_FOLLOWING_SEL);
    elem = await waitForSelector(storage.options.TWITTER_FOLLOWING_SEL, maxWait, interval);
    isDone = !!elem;
  } else if (intent.like) {
    console2.trace('Wait for liked selector...', storage.options.TWITTER_LIKED_SEL);
    isDone = !!(await waitForSelector(storage.options.TWITTER_LIKED_SEL, maxWait, interval));
  } else if (intent.retweet) {
    console2.trace('Wait for retweeted selector...', storage.options.TWITTER_RETWEETED_SEL);
    isDone = !!(await waitForSelector(storage.options.TWITTER_RETWEETED_SEL, maxWait, interval));
  }
  console2.log('Exit checkForAction; isDone:', isDone);
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
