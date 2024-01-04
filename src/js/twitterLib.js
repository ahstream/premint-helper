import global from './global.js';
console.log(global);

import {
  ONE_DAY,
  ONE_SECOND,
  sleep,
  waitForSelector,
  millisecondsAhead,
  addPendingRequest,
  createLogLevelArg,
  myConsole,
  stripEmojis,
  waitForEitherSelector,
  ONE_MINUTE,
} from 'hx-lib';

import { clickTwitterElem, saveStorage, submitTwitterElem } from './premintHelperLib';

import { debuggerInsertText } from './chromeDebugger';

const console2 = myConsole(global.LOGLEVEL);

// DATA ----------------------------------------------------------------------------------

const ACCOUNT_ACCESS_PERIOD = 60000;

const LIKE_BTN_SEL = 'div[data-testid="like"]';
const UNLIKE_BTN_SEL = 'div[data-testid="unlike"]';

const RETWEET_BTN_SEL = 'div[data-testid="retweet"]';
const UNRETWEET_BTN_SEL = 'div[data-testid="unretweet"]';

const RETWEET_CONFIRM_BTN_SEL = 'div[data-testid="retweetConfirm"]';
const UNRETWEET_CONFIRM_BTN_SEL = 'div[data-testid="unretweetConfirm"]';

// IS ----------------------------------------------------------------------------------

export async function isEmptyPage(maxWait, interval) {
  const elem = await waitForSelector('[data-testid="emptyState"]', maxWait, interval);
  console2.log('isEmptyPage, elem:', elem);
  return !!elem;
}

export function isTwitterStatusPage(url) {
  // eslint-disable-next-line no-useless-escape
  return !!url.match(/[(?:https?:\/\/(?:twitter|x)\.com)](\/(?:#!\/)?(\w+)\/status(es)?\/(\d+))/i);
}

export function isTwitterPage(url) {
  // eslint-disable-next-line no-useless-escape
  return !!url.match(/(https?:\/\/)?(www\.)?(twitter|x)\.com/gi);
}

// FUNCS ----------------------------------------------------------------------------------

export async function switchToUser(options, handleIn, parentTabId, redirectTo = null) {
  console2.info('switchToUser:', handleIn, parentTabId, redirectTo);

  const handle = handleIn.replace('@', '');

  const profileBtn = await waitForSelector('a[data-testid="AppTabBar_Profile_Link" i]', 30 * 1000, 25);
  console2.log('profileBtn', profileBtn);
  if (!profileBtn) {
    console2.error('Missing profileBtn!');
    return { error: 'noProfileButton' };
  }

  console2.log('profileBtn?.href', profileBtn?.href);

  if (profileBtn?.href?.endsWith && profileBtn?.href.toLowerCase().endsWith(handle.toLowerCase())) {
    console2.info('Twitter user already selected!');
    return { ok: true };
  }

  const menuBtn = await waitForSelector('div[aria-label="Account menu" i]', 30 * 1000, 25);
  if (!menuBtn) {
    console2.error('Missing menuBtn!');
    return { error: 'noMenuButton' };
  }
  console2.log('click menuBtn:', menuBtn);
  clickTwitterElem(options, menuBtn);
  await sleep(50);

  const addAccountBtn = await waitForSelector(
    `a[data-testid="AccountSwitcher_AddAccount_Button" i]`,
    10 * 1000,
    25
  );
  if (!addAccountBtn) {
    console2.error('Missing addAccountBtn!');
    return { error: 'noAccountButton' };
  }

  const switchBtn = await waitForSelector(`div[aria-label="Switch to @${handle}" i]`, 5000, 10);
  if (!switchBtn) {
    console2.error('Missing switchBtn!');
    return { error: 'noSwitchButton' };
  }

  if (parentTabId) {
    await addPendingRequest('https://twitter.com/home', {
      action: 'switchedUser',
      parentTabId,
      redirectTo,
      user: handle,
    });
    clickTwitterElem(options, switchBtn);
    // Page will be reloaded, stay in forever-ish sleep to wait for reload...
    await sleep(ONE_DAY);
  } else {
    setTimeout(() => {
      clickTwitterElem(options, switchBtn);
    }, 1);
    return { ok: true };
  }
}

export async function waitForUser(handleIn, myTabId, context, maxWait = 20000, interval = 100) {
  console2.log('waitForUser:', handleIn, maxWait, interval);

  const handle = handleIn.replace('@', '');

  const url = `https://twitter.com/home#id=${myTabId}&switchToUser=${handle}&${createLogLevelArg()}`;
  console2.info('open url', url);
  window.open(url, '_blank');
  // chrome.runtime.sendMessage({ cmd: 'openTab', url });

  const stopTime = millisecondsAhead(maxWait);

  while (Date.now() <= stopTime) {
    if (context.switchedToTwitterUser) {
      return context.switchedToTwitterUser;
    }
    await sleep(interval);
  }
  return null;
}

export async function handleAccountAccess(storage) {
  console2.info('handleAccountAccess');

  if (!storage.stats.twitterAccount) {
    storage.stats.twitterAccount = {
      softLocks: [],
      hardLocks: [],
    };
  }

  const now = Date.now();

  const softBtnSelector = 'input[type="submit"]';
  const hardBtnSelector = 'iframe[id="arkose_iframe"]'; // 'button[data-theme="home.verifyButton"]';

  const elem = await waitForEitherSelector([softBtnSelector, hardBtnSelector], 30 * ONE_SECOND, 500);
  console.log('elem', elem);

  const softBtn = await waitForSelector(softBtnSelector, 100, 100);
  console.log('softBtn', softBtn);

  const hardBtn = await waitForSelector(hardBtnSelector, 100, 100);
  console.log('hardBtn', hardBtn);

  if (
    softBtn &&
    storage.runtime.lastTwitterAccountAccessSoft &&
    storage.runtime.lastTwitterAccountAccessSoft + ACCOUNT_ACCESS_PERIOD > now
  ) {
    return console2.info('Skip duplicate Twitter SOFT account access page load');
  }
  if (softBtn) {
    storage.runtime.lastTwitterAccountAccessSoft = now;
    storage.stats.twitterAccount.softLocks.push(now);
  }

  if (
    hardBtn &&
    storage.runtime.lastTwitterAccountAccessHard &&
    storage.runtime.lastTwitterAccountAccessHard + ACCOUNT_ACCESS_PERIOD > now
  ) {
    return console2.info('Skip duplicate Twitter HARD account access page load');
  }
  if (hardBtn) {
    storage.runtime.lastTwitterAccountAccessHard = now;
    storage.stats.twitterAccount.hardLocks.push(now);
  }

  await saveStorage(storage);

  if (softBtn) {
    await sleep(2000);
    await addPendingRequest('https://twitter.com/', { action: 'unlocked' });
    await sleep(200);
    clickTwitterElem(storage.options, softBtn);
    await sleep(200);
    return;
  }

  await chrome.runtime.sendMessage({ cmd: 'broadcast', request: { cmd: 'lockedTwitterAccount' } });
}

async function getBaseForStatusPage(maxWait, interval) {
  await waitForPageLoaded(maxWait, interval);
  const r = document.querySelector('div[role="progressbar"][aria-valuemax="100"]');
  console.log('getBaseForStatusPage', r);
  return r;
}

async function getBaseForStatusPost(maxWait, interval) {
  try {
    await waitForPageLoaded(maxWait, interval);
    const r = document.querySelector('div[role="progressbar"][aria-valuemax="100"]');
    console.log('getBaseForStatusPage r', r);
    const b = r.parentNode.parentNode.parentNode;
    console.log('getBaseForStatusPage b', b);
    return b;
  } catch (e) {
    console.error(e);
    return null;
  }
}

export async function getLikeOrUnlikeButton(maxWait = 20000, interval = 250) {
  console.log('getLikeOrUnlikeButton:', maxWait, interval);

  const base = await getBaseForStatusPage(maxWait, interval);
  if (!base) {
    return {};
  }

  const parent = base.parentNode?.parentNode?.parentNode;

  const stopTime = millisecondsAhead(maxWait);
  while (Date.now() <= stopTime) {
    console.log('base, parent:', base, parent);
    const likeBtn = parent.querySelector('div[data-testid="like"]');
    console.log('likeBtn:', likeBtn);
    if (likeBtn) {
      return { likeBtn };
    }
    const unlikeBtn = parent.querySelector('div[data-testid="unlike"]');
    console.log('unlikeBtn:', unlikeBtn);
    if (unlikeBtn) {
      return { unlikeBtn };
    }
    await sleep(interval);
  }
  console.log('fail getLikeOrUnlikeButton');
  return {};
}

export async function getUnlikeButton(maxWait = 20000, interval = 250) {
  console2.log('getUnlikeButton:', maxWait, interval);

  const base = await getBaseForStatusPage(maxWait, interval);
  if (!base) {
    return null;
  }

  const parent = base.parentNode?.parentNode?.parentNode;

  const stopTime = millisecondsAhead(maxWait);
  while (Date.now() <= stopTime) {
    console.log('base, parent:', base, parent);
    const unlikeBtn = parent.querySelector('div[data-testid="unlike"]');
    console.log('unlikeBtn:', unlikeBtn);
    if (unlikeBtn) {
      return unlikeBtn;
    }
    await sleep(interval);
  }
  console.log('fail getUnlikeButton');
  return null;
}

export async function getRetweetOrUnretweetButton(maxWait = 20000, interval = 250) {
  console2.log('getRetweetOrUnretweetButton:', maxWait, interval);

  const base = await getBaseForStatusPage(maxWait, interval);
  if (!base) {
    return {};
  }

  const parent = base.parentNode?.parentNode?.parentNode;

  const stopTime = millisecondsAhead(maxWait);
  while (Date.now() <= stopTime) {
    console.log('base, parent:', base, parent);
    const retweetBtn = parent.querySelector('div[data-testid="retweet"]');
    console.log('retweetBtn:', retweetBtn);
    if (retweetBtn) {
      return { retweetBtn };
    }
    const unretweetBtn = parent.querySelector('div[data-testid="unretweet"]');
    console.log('unretweetBtn:', unretweetBtn);
    if (unretweetBtn) {
      return { unretweetBtn };
    }
    await sleep(interval);
  }
  console.log('fail getRetweetOrUnretweetButton');
  return {};
}

export async function getUnretweetButton(maxWait = 20000, interval = 250) {
  console2.log('getUnretweetButton:', maxWait, interval);

  const base = await getBaseForStatusPage(maxWait, interval);
  if (!base) {
    return null;
  }

  const parent = base.parentNode?.parentNode?.parentNode;

  const stopTime = millisecondsAhead(maxWait);
  while (Date.now() <= stopTime) {
    console.log('base, parent:', base, parent);
    const unretweetBtn = parent.querySelector('div[data-testid="unretweet"]');
    console.log('unretweetBtn:', unretweetBtn);
    if (unretweetBtn) {
      return unretweetBtn;
    }
    await sleep(interval);
  }
  console.log('fail getUnretweetButton');
  return null;
}

export async function getRetweetOrUnretweetConfirmButton(maxWait = 20000, interval = 250) {
  console2.log('getRetweetOrUnretweetConfirmButton:', maxWait, interval);

  const stopTime = millisecondsAhead(maxWait);
  while (Date.now() <= stopTime) {
    const retweetConfirmBtn = document.querySelector('div[data-testid="retweetConfirm"]');
    console.log('retweetConfirmBtn:', retweetConfirmBtn);
    if (retweetConfirmBtn) {
      return { retweetConfirmBtn };
    }
    const unretweetConfirmBtn = document.querySelector('div[data-testid="unretweetConfirm"]');
    console.log('unretweetConfirmBtn:', unretweetConfirmBtn);
    if (unretweetConfirmBtn) {
      return { unretweetConfirmBtn };
    }
    await sleep(interval);
  }
  console.log('fail getRetweetOrUnretweetConfirmButton');
  return {};
}

export async function retweet(options, maxWait = 20000, interval = 250) {
  const btn = await getRetweetOrUnretweetButton(maxWait, interval);
  console.log('btn:', btn);
  if (btn.unretweetBtn) {
    return true;
  }
  if (!btn.retweetBtn) {
    return false;
  }

  /*
  if (
    !(await ensureButtonClicked(
      options,
      btn,
      'retweetBtn',
      'unretweetBtn',
      getRetweetOrUnretweetButton,
      maxWait
    ))
  ) {
    console.log('failed retweetBtn');
    return false;
  }
  */
  clickTwitterElem(options, btn.retweetBtn);
  await sleep(200);

  const confirmBtn = await getRetweetOrUnretweetConfirmButton(maxWait, interval);
  console.log('confirmBtn:', confirmBtn);
  if (confirmBtn.unretweetConfirmBtn) {
    return true;
  }
  if (!confirmBtn.retweetConfirmBtn) {
    return false;
  }

  /*
  if (
    !(await ensureButtonClicked(
      options,
      confirmBtn,
      'retweetConfirmBtn',
      'unretweetConfirmBtn',
      getRetweetOrUnretweetConfirmButton,
      maxWait
    ))
  ) {
    console.log('failed confirmBtn');
    return false;
  }
  */
  clickTwitterElem(options, confirmBtn.retweetConfirmBtn);
  await sleep(500);

  const unretweetBtn = await getUnretweetButton(5000, 10);
  console.log('unretweetBtn:', unretweetBtn);
  if (!unretweetBtn) {
    return false;
  }

  return true;
}

export async function like(options, maxWait = 20000, interval = 250) {
  const btn = await getLikeOrUnlikeButton(maxWait, interval);
  console.log('btn:', btn);
  if (btn.unlikeBtn) {
    return true;
  }
  if (!btn.likeBtn) {
    return false;
  }

  // ensureLikeButtonClicked(options, btn, maxWait);
  if (!(await ensureButtonClicked(options, btn, 'likeBtn', 'unlikeBtn', getLikeOrUnlikeButton, maxWait))) {
    console.log('failed likeBtn');
    return false;
  }
  //clickTwitterElem(options, btn.likeBtn);
  await sleep(200);

  const unlikeBtn = await getUnlikeButton(5000, 10);
  console.log('unlikeBtn:', unlikeBtn);
  if (!unlikeBtn) {
    return false;
  }

  return true;
}

export async function waitForPost(text, maxWait = 20000, interval = 250) {
  console2.log('waitForPost:', text, maxWait, interval);

  const searchFor = text.trim();

  const stopTime = millisecondsAhead(maxWait);
  while (Date.now() <= stopTime) {
    const elems = [...document.querySelectorAll('div[data-testid="tweetText"]')].filter(
      (x) => x.textContent.trim() === searchFor
    );
    const elems2 = [...document.querySelectorAll('div[data-testid="tweetText"]')].map((x) => x.textContent);
    if (elems?.length) {
      return elems[0];
    }
    console.log('text, elems, elems2', searchFor, elems, elems2);
    await sleep(interval);
  }
  return null;
}

export async function comment(options, text, maxWait = 20000, interval = 250) {
  const base = await waitForSelector(
    '.public-DraftStyleDefault-block.public-DraftStyleDefault-ltr',
    maxWait,
    interval
  );
  console.log('base', base);
  if (!base) {
    return '';
  }

  const elems = base.getElementsByTagName('span');
  console.log('elems', elems);
  if (!elems || !elems.length) {
    return '';
  }

  const elem = elems[0];
  console.log('elem', elem);

  base.focus();
  const elemWithValueSetter = elem.parentNode.parentNode.parentNode.parentNode;
  console.log('elemWithValueSetter', elemWithValueSetter);

  debuggerInsertText(text, { elem: elemWithValueSetter });
  /*
  elem.textContent = text;
  clickTwitterElem(options, elem);
  elem.dispatchEvent(new Event('input', { bubbles: true }));
  */
  await sleep(500, 1000);

  const btn = await getReplyButton(maxWait, interval);
  console.log('btn', btn);
  if (!btn.replyBtn) {
    return '';
  }

  if (!(await ensureButtonClicked(options, btn, 'replyBtn', null, getReplyButton, maxWait))) {
    console.log('failed replyBtn');
    return false;
  }
  //clickTwitterElem(options, replyBtn);
  await sleep(500, 1000);

  const textNoEmojis = stripEmojis(text, false).trim();
  console2.log('textNoEmojis:', textNoEmojis, textNoEmojis.length);

  const post = await waitForPost(textNoEmojis, maxWait, interval);
  console.log('post', post);
  if (!post) {
    return '';
  }

  try {
    console2.log('textNoEmojis:', textNoEmojis);

    const e1 = [...document.querySelectorAll('div[data-testid="tweetText"]')];
    console.log('e1', e1);
    console.log(
      'e1.textContent',
      e1.map((x) => x.textContent)
    );
    const e2 = e1.filter((x) => x.textContent.trim() === textNoEmojis);
    console.log('e2', e2);
    const e3 = e2[0];
    console.log('e3', e3);
    const e4 = e3.parentNode.parentNode;
    console.log('e4', e4);
    const e5 = [...e4.querySelectorAll('a')];
    console.log('e5', e5);
    const e6 = e5.filter((x) => x.getElementsByTagName('time').length);
    console.log('e6', e6);
    const e7 = e6[0];
    console.log('e7', e7);
    const e8 = e7.href;
    console.log('e8', e8);

    const url = e8;
    console.log('url', url);

    /*
    const url = [
      ...[...document.querySelectorAll('div[data-testid="tweetText"]')]
        .filter((x) => x.textContent.trim() === textNoEmojis)[0]
        .parentNode.parentNode.querySelectorAll('a'),
    ].filter((x) => x.getElementsByTagName('time').length)[0].href;
*/
    return url;
  } catch (e) {
    console.log('error:', e);
    return '';
  }
}

async function getReplyButton(maxWait, interval) {
  console.log('getReplyButton:', maxWait, interval);
  const replyBtn = await waitForSelector(
    'div[data-testid="tweetButtonInline"]:not([aria-disabled="true"])',
    maxWait,
    interval
  );
  return {
    replyBtn,
  };
}

export async function raid(options, text, maxWait = 20000, interval = 250) {
  if (!(await like2(options))) {
    console.log('failed raid like');
    return '';
  }

  if (!(await retweet2(options))) {
    console.log('failed raid retweet');
    return '';
  }
  await sleep(1000, 1500);

  const url = await comment2(options, text, maxWait, interval);
  if (!url) {
    console.log('failed raid comment');
    return '';
  }

  return url;
}

export async function raidOrg(options, text, maxWait = 20000, interval = 250) {
  if (!(await like(options, maxWait, interval))) {
    console.log('failed raid like');
    return false;
  }
  await sleep(1000, 1500);

  if (!(await retweet(options, maxWait, interval))) {
    console.log('failed raid retweet');
    return false;
  }
  await sleep(1000, 1500);

  const url = await comment(options, text, maxWait, interval);
  if (!url) {
    console.log('failed raid comment');
    return '';
  }

  return url;
}

export async function waitForPageLoaded(maxWait = 20000, interval = 200) {
  await sleep(50);
  const stopTime = millisecondsAhead(maxWait);
  while (Date.now() <= stopTime) {
    const elem = document.querySelector('div[role="progressbar"][aria-valuemax="100"]');
    console.log('elem:', elem);
    if (elem && !elem.ariaLabel) {
      return true;
    }
    console.log('waitForPageLoaded');
    await sleep(interval);
  }
  return false;
}

/*
async function ensureLikeButtonClicked(options, btn, maxWait) {
  console2.info('ensureLikeButtonClicked', btn, maxWait);

  const stopTime = millisecondsAhead(maxWait);
  while (Date.now() <= stopTime) {
    await clickTwitterElem(options, btn.likeBtn);
    await sleep(500);
    btn = await getLikeOrUnlikeButton(100);
    if (!btn.likeBtn) {
      return;
    }
    await submitTwitterElem(options, btn.likeBtn);
    await sleep(500);
    btn = await getLikeOrUnlikeButton(100);
    if (!btn.likeBtn) {
      return;
    }
    console2.log('New btn:', btn);
  }
  console2.info('Failed ensureBtnClicked', btn);
}
*/

async function ensureButtonClicked(options, btn, buttonKey1, buttonKey2, getter, maxWait) {
  console2.log('ensureButtonClicked:', btn, buttonKey1, buttonKey2);

  if (btn[buttonKey2]) {
    return true;
  }

  const stopTime = millisecondsAhead(maxWait);
  while (Date.now() <= stopTime) {
    await clickTwitterElem(options, btn[buttonKey1]);
    await sleep(100);
    btn = await getter(100);
    console2.log('btn after click:', btn);
    if (!btn[buttonKey1] || btn[buttonKey2]) {
      return true;
    }
    await submitTwitterElem(options, btn[buttonKey1]);
    await sleep(100);
    btn = await getter(100);
    if (!btn[buttonKey1] || btn[buttonKey2]) {
      return true;
    }
    console2.log('New btn:', btn);
  }
  console2.info('Failed ensureButtonClicked', btn);
  return false;
}

// NEW ---------------------------------------------------

async function like2(options) {
  let likeBtns = await getLikeButtons();
  console.log('likeBtns:', likeBtns);
  if (likeBtns.unlikeBtn) {
    return true; // already liked!
  }
  if (!likeBtns.likeBtn) {
    return false; // missing like btn!
  }
  await clickTwitterElem(options, likeBtns.likeBtn);
  await sleep(500);

  likeBtns = await getLikeButtons();
  console.log('likeBtns:', likeBtns);
  if (likeBtns.unlikeBtn) {
    return true;
  }

  return false;
}

export async function getLikeButtons(maxWait = 1000, interval = 100) {
  console2.log('getLikeButtons:', maxWait, interval);
  const base = await getBaseForStatusPost(maxWait, interval);
  if (!base) {
    return { ok: false };
  }
  const eitherBtn = await waitForEitherSelector([LIKE_BTN_SEL, UNLIKE_BTN_SEL], ONE_SECOND, 100, base);
  const likeBtn = await waitForSelector(LIKE_BTN_SEL, 1, 1, base);
  const unlikeBtn = await waitForSelector(UNLIKE_BTN_SEL, 1, 1, base);
  return {
    ok: !!eitherBtn,
    likeBtn,
    unlikeBtn,
  };
}

export async function retweet2(options) {
  let repostBtns = await getRepostButtons();
  console.log('repostBtns:', repostBtns);
  if (repostBtns.unretweetBtn) {
    return true; // already retweeted!
  }
  if (!repostBtns.retweetBtn) {
    return false; // missing retweet btn!
  }

  const r1 = await clickRepostButton(options);
  if (!r1.ok) {
    return false;
  }
  const r2 = await clickRepostConfirmButton(options, 5000, 100);
  if (!r2.ok) {
    return false;
  }

  await waitForSelector(UNRETWEET_BTN_SEL, 5 * ONE_SECOND, 100);

  repostBtns = await getRepostButtons();
  console.log('repostBtns:', repostBtns);
  if (repostBtns.unretweetBtn) {
    return true;
  }

  return false;
}

export async function getRepostButtons(maxWait = 1000, interval = 100) {
  console2.log('getRepostButtons:', maxWait, interval);
  const base = await getBaseForStatusPost(maxWait, interval);
  if (!base) {
    return { ok: false };
  }
  const eitherBtn = await waitForEitherSelector([RETWEET_BTN_SEL, UNRETWEET_BTN_SEL], ONE_SECOND, 100, base);
  const retweetBtn = await waitForSelector(RETWEET_BTN_SEL, 1, 1, base);
  const unretweetBtn = await waitForSelector(UNRETWEET_BTN_SEL, 1, 1, base);
  return {
    ok: !!eitherBtn,
    retweetBtn,
    unretweetBtn,
  };
}

export async function getRepostConfirmButtons(maxWait = 1000, interval = 100) {
  console2.log('getRepostConfirmButtons:', maxWait, interval);
  const eitherBtn = await waitForEitherSelector(
    [RETWEET_CONFIRM_BTN_SEL, UNRETWEET_CONFIRM_BTN_SEL],
    maxWait,
    interval
  );
  const retweetConfirmBtn = await waitForSelector(RETWEET_CONFIRM_BTN_SEL, 1, 1);
  const unretweetConfirmBtn = await waitForSelector(UNRETWEET_CONFIRM_BTN_SEL, 1, 1);

  return {
    ok: !!eitherBtn,
    retweetConfirmBtn,
    unretweetConfirmBtn,
  };
}

async function clickRepostButton(options, maxWait = 2500, interval = 250) {
  const repostBtns = await getRepostButtons();
  console.log('repostBtns:', repostBtns);
  const btn = repostBtns.retweetBtn || repostBtns.unretweetBtn;
  if (!btn) {
    return { ok: false };
  }
  console.log('btn:', btn);
  console.log('ariaExpanded:', btn.ariaExpanded);
  await clickTwitterElem(options, btn);

  const stopTime = millisecondsAhead(maxWait);
  while (Date.now() <= stopTime) {
    if (btn.ariaExpanded === 'true') {
      console.log('ariaExpanded:', btn.ariaExpanded);
      return { ok: true };
    }
    await sleep(interval);
  }
  if (btn.ariaExpanded === 'true') {
    console.log('ariaExpanded final:', btn.ariaExpanded);
    return { ok: true };
  }
  console.log('ariaExpanded final:', btn.ariaExpanded);
  return { ok: false };
}

async function clickRepostConfirmButton(options, maxWait = 2500, interval = 250) {
  let repostConfirmBtns = await getRepostConfirmButtons(maxWait, interval);
  console.log('repostConfirmBtns:', repostConfirmBtns);
  const btn = repostConfirmBtns.retweetConfirmBtn || repostConfirmBtns.unretweetConfirmBtn;
  if (!btn) {
    return { ok: false };
  }
  console.log('btn:', btn);
  console.log('ariaExpanded:', btn.ariaExpanded);
  await sleep(30, 50);
  await clickTwitterElem(options, btn);
  await sleep(100, 150);

  const stopTime = millisecondsAhead(maxWait);
  while (Date.now() <= stopTime) {
    repostConfirmBtns = await getRepostConfirmButtons(1, 1);
    console.log('repostConfirmBtns:', repostConfirmBtns);
    if (repostConfirmBtns.retweetConfirmBtn || repostConfirmBtns.unretweetConfirmBtn) {
      await sleep(interval);
      continue;
    }
    return { ok: true };
    /*
    if (btn.ariaExpanded === 'true') {
      console.log('ariaExpanded:', btn.ariaExpanded);
      await sleep(interval);
      continue;
    }
    break;
    */
  }
  repostConfirmBtns = await getRepostConfirmButtons(1, 1);
  console.log('repostConfirmBtns:', repostConfirmBtns);
  if (repostConfirmBtns.retweetConfirmBtn || repostConfirmBtns.unretweetConfirmBtn) {
    return { ok: false };
  }
  return { ok: true };
  /*
  if (btn.ariaExpanded === 'true') {
    console.log('ariaExpanded final:', btn.ariaExpanded);
    return { ok: false };
  }
  console.log('ariaExpanded final:', btn.ariaExpanded);
  return { ok: true };
  */
}

export async function comment2(options, text, maxWait = 20000, interval = 250) {
  const base = await waitForSelector(
    '.public-DraftStyleDefault-block.public-DraftStyleDefault-ltr',
    maxWait,
    interval
  );
  console.log('base', base);
  if (!base) {
    return '';
  }

  const elems = base.getElementsByTagName('span');
  console.log('elems', elems);
  if (!elems || !elems.length) {
    return '';
  }

  const elem = elems[0];
  console.log('elem', elem);

  base.focus();
  const elemWithValueSetter = elem.parentNode.parentNode.parentNode.parentNode;
  console.log('elemWithValueSetter', elemWithValueSetter);

  debuggerInsertText(text, { elem: elemWithValueSetter });
  /*
  elem.textContent = text;
  clickTwitterElem(options, elem);
  elem.dispatchEvent(new Event('input', { bubbles: true }));
  */
  await sleep(500, 1000);

  /*
  const btn = await getReplyButton(maxWait, interval);
  console.log('btn', btn);
  if (!btn.replyBtn) {
    return '';
  }
  */

  const r3 = await clickReplyButton(options, ONE_MINUTE, 250);
  if (!r3.ok) {
    console.log('failed clickReplyButton');
    return '';
  }
  await sleep(500, 1000);

  const textNoEmojis = stripEmojis(text, false).trim();
  console2.log('textNoEmojis:', textNoEmojis, textNoEmojis.length);

  const post = await waitForPost(textNoEmojis, maxWait, interval);
  console.log('post', post);
  if (!post) {
    return '';
  }

  try {
    console2.log('textNoEmojis:', textNoEmojis);

    const e1 = [...document.querySelectorAll('div[data-testid="tweetText"]')];
    console.log('e1', e1);
    console.log(
      'e1.textContent',
      e1.map((x) => x.textContent)
    );
    const e2 = e1.filter((x) => x.textContent.trim() === textNoEmojis);
    console.log('e2', e2);
    const e3 = e2[0];
    console.log('e3', e3);
    const e4 = e3.parentNode.parentNode;
    console.log('e4', e4);
    const e5 = [...e4.querySelectorAll('a')];
    console.log('e5', e5);
    const e6 = e5.filter((x) => x.getElementsByTagName('time').length);
    console.log('e6', e6);
    const e7 = e6[0];
    console.log('e7', e7);
    const e8 = e7.href;
    console.log('e8', e8);

    const url = e8;
    console.log('url', url);

    /*
    const url = [
      ...[...document.querySelectorAll('div[data-testid="tweetText"]')]
        .filter((x) => x.textContent.trim() === textNoEmojis)[0]
        .parentNode.parentNode.querySelectorAll('a'),
    ].filter((x) => x.getElementsByTagName('time').length)[0].href;
*/
    return url;
  } catch (e) {
    console.log('error:', e);
    return '';
  }
}

async function clickReplyButton(options, maxWait = 2500, interval = 250) {
  let replyBtn = await getReplyButton(maxWait, interval);
  console.log('replyBtn:', replyBtn);
  let btn = replyBtn?.replyBtn;
  if (!btn) {
    return { ok: false };
  }
  await clickTwitterElem(options, btn);
  await sleep(500);

  const stopTime = millisecondsAhead(maxWait);
  while (Date.now() <= stopTime) {
    replyBtn = await getReplyButton(10, 10);
    console.log('replyBtn 2:', replyBtn);
    btn = replyBtn?.replyBtn;
    if (!btn || btn?.ariaDisabled === 'true') {
      return { ok: true };
    }
    await sleep(interval);
  }

  replyBtn = await getReplyButton(10, 10);
  console.log('replyBtn 3:', replyBtn);
  btn = replyBtn?.replyBtn;
  if (!btn || btn?.ariaDisabled === 'true') {
    return { ok: true };
  }

  return { ok: false };
}
