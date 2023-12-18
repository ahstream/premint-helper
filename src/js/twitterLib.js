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

import { clickElement } from './premintHelperLib';

const console2 = myConsole();

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

export async function switchToUser(handleIn, parentTabId, redirectTo = null) {
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
  menuBtn.click();
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
    switchBtn.click();
    // Page will be reloaded, stay in forever-ish sleep to wait for reload...
    await sleep(ONE_DAY);
  } else {
    setTimeout(() => {
      switchBtn.click();
    }, 1);
    return { ok: true };
  }
}

export async function waitForUser(handleIn, myTabId, context, maxWait = 20000, interval = 10) {
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

export async function handleLockedTwitterAccount() {
  console2.info('handleLockedTwitterAccount');

  await chrome.runtime.sendMessage({ cmd: 'broadcast', request: { cmd: 'lockedTwitterAccount' } });

  const btn = await waitForSelector('input[type="submit"]', ONE_SECOND * 30, 250);
  if (btn) {
    await sleep(2000);
    await addPendingRequest('https://twitter.com/', { action: 'unlocked' });
    btn.click();
    return;
  }
}

async function getBaseForStatusPage(maxWait, interval) {
  const r = await waitForSelector('div[role="progressbar"]', maxWait, interval);
  console.log('getBaseForStatusPage', r);
  return r;
}

export async function getLikeOrUnlikeButton(maxWait = 20000, interval = 10) {
  console.log('getLikeOrUnlikeButton:', maxWait, interval);

  const base = await getBaseForStatusPage(maxWait, interval);
  if (!base) {
    return {};
  }

  const parent = base.parentNode?.parentNode?.parentNode;
  console.log('parent:', parent);

  const stopTime = millisecondsAhead(maxWait);
  while (Date.now() <= stopTime) {
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

export async function getUnlikeButton(maxWait = 20000, interval = 10) {
  console2.log('getUnlikeButton:', maxWait, interval);

  const base = await getBaseForStatusPage(maxWait, interval);
  if (!base) {
    return null;
  }

  const parent = base.parentNode?.parentNode?.parentNode;
  console.log('parent:', parent);

  const stopTime = millisecondsAhead(maxWait);
  while (Date.now() <= stopTime) {
    const unlikeBtn = parent.querySelector('div[data-testid="unlike"]');
    if (unlikeBtn) {
      return unlikeBtn;
    }
    await sleep(interval);
  }
  console.log('fail getUnlikeButton');
  return null;
}

export async function getRetweetOrUnretweetButton(maxWait = 20000, interval = 10) {
  console2.log('getRetweetOrUnretweetButton:', maxWait, interval);

  const base = await getBaseForStatusPage(maxWait, interval);
  if (!base) {
    return {};
  }

  const parent = base.parentNode?.parentNode?.parentNode;
  console.log('parent:', parent);

  const stopTime = millisecondsAhead(maxWait);
  while (Date.now() <= stopTime) {
    const retweetBtn = parent.querySelector('div[data-testid="retweet"]');
    if (retweetBtn) {
      return { retweetBtn };
    }
    const unretweetBtn = parent.querySelector('div[data-testid="unretweet"]');
    if (unretweetBtn) {
      return { unretweetBtn };
    }
    await sleep(interval);
  }
  console.log('fail getRetweetOrUnretweetButton');
  return {};
}

export async function getUnretweetButton(maxWait = 20000, interval = 10) {
  console2.log('getUnretweetButton:', maxWait, interval);

  const base = await getBaseForStatusPage(maxWait, interval);
  if (!base) {
    return null;
  }

  const parent = base.parentNode?.parentNode?.parentNode;
  console.log('parent:', parent);

  const stopTime = millisecondsAhead(maxWait);
  while (Date.now() <= stopTime) {
    const unretweetBtn = parent.querySelector('div[data-testid="unretweet"]');
    if (unretweetBtn) {
      return unretweetBtn;
    }
    await sleep(interval);
  }
  console.log('fail getUnretweetButton');
  return null;
}

export async function getRetweetOrUnretweetConfirmButton(maxWait = 20000, interval = 10) {
  console2.log('getRetweetOrUnretweetConfirmButton:', maxWait, interval);

  const stopTime = millisecondsAhead(maxWait);
  while (Date.now() <= stopTime) {
    const retweetConfirmBtn = document.querySelector('div[data-testid="retweetConfirm"]');
    if (retweetConfirmBtn) {
      return { retweetConfirmBtn };
    }
    const unretweetConfirmBtn = document.querySelector('div[data-testid="unretweetConfirm"]');
    if (unretweetConfirmBtn) {
      return { unretweetConfirmBtn };
    }
    await sleep(interval);
  }
  console.log('fail getRetweetOrUnretweetConfirmButton');
  return {};
}

export async function retweet(maxWait = 20000, interval = 10, { real = false, simulate = true } = {}) {
  const btn = await getRetweetOrUnretweetButton(maxWait, interval);
  if (btn.unretweetBtn) {
    return true;
  }
  if (!btn.retweetBtn) {
    return false;
  }
  clickElement(btn.retweetBtn, { real, simulate });
  await sleep(500);

  const confirmBtn = await getRetweetOrUnretweetConfirmButton(maxWait, interval);
  if (confirmBtn.unretweetConfirmBtn) {
    return true;
  }
  if (!confirmBtn.retweetConfirmBtn) {
    return false;
  }
  clickElement(confirmBtn.retweetConfirmBtn, { real, simulate });
  await sleep(500);

  const unretweetBtn = await getUnretweetButton(5000, 10);
  if (!unretweetBtn) {
    return false;
  }

  return true;
}

export async function like(maxWait = 20000, interval = 10, { real = false, simulate = true } = {}) {
  const btn = await getLikeOrUnlikeButton(maxWait, interval);
  if (btn.unlikeBtn) {
    return true;
  }
  if (!btn.likeBtn) {
    return false;
  }
  clickElement(btn.likeBtn, { real, simulate });
  await sleep(500);

  const unlikeBtn = await getUnlikeButton(5000, 10);
  if (!unlikeBtn) {
    return false;
  }

  return true;
}

export async function waitForPost(text, maxWait = 20000, interval = 10) {
  console2.log('waitForPost:', text, maxWait, interval);

  const stopTime = millisecondsAhead(maxWait);
  while (Date.now() <= stopTime) {
    const elems = [...document.querySelectorAll('div[data-testid="tweetText"]')].filter(
      (x) => x.textContent === text
    );
    const elems2 = [...document.querySelectorAll('div[data-testid="tweetText"]')].map((x) => x.textContent);
    if (elems?.length) {
      return elems[0];
    }
    console.log('elems2', elems2);
    await sleep(interval);
  }
  return null;
}

export async function comment(text, maxWait = 20000, interval = 10, { real = false, simulate = true } = {}) {
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

  elem.textContent = text;
  elem.click();
  elem.dispatchEvent(new Event('input', { bubbles: true }));
  await sleep(1500, 3000);

  const replyBtn = await waitForSelector('div[data-testid="tweetButtonInline"]', maxWait, interval);
  console.log('replyBtn', replyBtn);
  if (!replyBtn) {
    return '';
  }
  clickElement(replyBtn, { real, simulate });
  await sleep(1000, 1500);

  const textNoEmojis = stripEmojis(text, false);
  console2.log('textNoEmojis:', textNoEmojis);

  const post = await waitForPost(textNoEmojis, maxWait, interval);
  console.log('post', post);
  if (!post) {
    return '';
  }

  try {
    const url = [
      ...[...document.querySelectorAll('div[data-testid="tweetText"]')]
        .filter((x) => x.textContent === textNoEmojis)[0]
        .parentNode.parentNode.querySelectorAll('a'),
    ].filter((x) => x.getElementsByTagName('time').length)[0].href;
    return url;
  } catch (e) {
    console.log('error:', e);
    return '';
  }
}

export async function raid(text, maxWait = 20000, interval = 10, { real = false, simulate = true } = {}) {
  if (!(await like(maxWait, interval, { real, simulate }))) {
    console.log('failed raid like');
    return false;
  }
  if (!(await retweet(maxWait, interval, { real, simulate }))) {
    console.log('failed raid retweet');
    return false;
  }
  const url = await comment(text, maxWait, interval, { real, simulate });
  if (!url) {
    console.log('failed raid comment');
  }
  return url;
}
