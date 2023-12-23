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
} from 'hx-lib';

import { clickTwitterElem, saveStorage, submitTwitterElem } from './premintHelperLib';

import { debuggerInsertText } from './chromeDebugger';

const console2 = myConsole(global.LOGLEVEL);

// DATA ----------------------------------------------------------------------------------

const ACCOUNT_ACCESS_PERIOD = 60000;

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

  if (
    storage.runtime.lastTwitterAccountAccess &&
    storage.runtime.lastTwitterAccountAccess + ACCOUNT_ACCESS_PERIOD > Date.now()
  ) {
    console2.info('Skip duplicate Twitter account access page load');
    return;
  }

  storage.runtime.lastTwitterAccountAccess = Date.now();
  await saveStorage(storage);

  await chrome.runtime.sendMessage({ cmd: 'broadcast', request: { cmd: 'lockedTwitterAccount' } });

  if (!storage.stats.twitterAccount) {
    storage.stats.twitterAccount = {
      softLocks: [],
      hardLocks: [],
    };
  }

  const btn = await waitForSelector('input[type="submit"]', ONE_SECOND * 10, 250);
  if (btn) {
    storage.stats.twitterAccount.softLocks.push(Date.now());
    await saveStorage(storage);

    await sleep(2000);
    await addPendingRequest('https://twitter.com/', { action: 'unlocked' });
    await sleep(200);
    clickTwitterElem(storage.options, btn);
    await sleep(200);
    return;
  }

  storage.stats.twitterAccount.hardLocks.push(Date.now());
  await saveStorage(storage);
}

async function getBaseForStatusPage(maxWait, interval) {
  await waitForPageLoaded(maxWait, interval);
  const r = document.querySelector('div[role="progressbar"][aria-valuemax="100"]');
  console.log('getBaseForStatusPage', r);
  return r;
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
  //clickTwitterElem(options, btn.retweetBtn);
  await sleep(500);

  /*
  const confirmBtn = await getRetweetOrUnretweetConfirmButton(maxWait, interval);
  console.log('confirmBtn:', confirmBtn);
  if (confirmBtn.unretweetConfirmBtn) {
    return true;
  }
  if (!confirmBtn.retweetConfirmBtn) {
    return false;
  }

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
  // clickTwitterElem(options, confirmBtn.retweetConfirmBtn);
  await sleep(500);
  */

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
  await sleep(500);

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

  debuggerInsertText(elemWithValueSetter, text);
  /*
  elem.textContent = text;
  clickTwitterElem(options, elem);
  elem.dispatchEvent(new Event('input', { bubbles: true }));
  */
  await sleep(1500, 3000);

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
  await sleep(1500, 3000);

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
  if (!(await like(options, maxWait, clearInterval))) {
    console.log('failed raid like');
    return false;
  }
  await sleep(1000, 1500);

  if (!(await retweet(options, maxWait, interval))) {
    console.log('failed raid retweet');
    return false;
  }
  await sleep(1500, 2000);

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
  if (btn[buttonKey2]) {
    return true;
  }

  const stopTime = millisecondsAhead(maxWait);
  while (Date.now() <= stopTime) {
    await clickTwitterElem(options, btn[buttonKey1]);
    await sleep(500);
    btn = await getter(100);
    if (!btn[buttonKey1] || btn[buttonKey2]) {
      return true;
    }
    await submitTwitterElem(options, btn[buttonKey1]);
    await sleep(500);
    btn = await getter(100);
    if (!btn[buttonKey1] || btn[buttonKey2]) {
      return true;
    }
    console2.log('New btn:', btn);
  }
  console2.info('Failed ensureButtonClicked', btn);
  return false;
}
