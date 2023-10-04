import { ONE_DAY, sleep, waitForSelector, millisecondsAhead, addPendingRequest, createLogger, createLogLevelArg } from 'hx-lib';

const debug = createLogger();

// FUNCS ----------------------------------------------------------------------------------

export async function switchToUser(handleIn, parentTabId, redirectTo = null) {
  debug.log('switchToUser:', handleIn, parentTabId, redirectTo);

  const handle = handleIn.replace('@', '');

  const profileBtn = await waitForSelector('a[data-testid="AppTabBar_Profile_Link"]', 30 * 1000, 25);
  if (!profileBtn) {
    console.error('Missing profileBtn!');
    return { error: 'noProfileButton' };
  }

  debug.log('profileBtn:', profileBtn);

  if (profileBtn.href === `https://twitter.com/${handle}`) {
    debug.log('Twitter user already selected!');
    return { ok: true };
  }

  const menuBtn = await waitForSelector('div[aria-label="Account menu"]', 30 * 1000, 25);
  if (!menuBtn) {
    console.error('Missing menuBtn!');
    return { error: 'noMenuButton' };
  }
  debug.log('click menuBtn:', menuBtn);
  menuBtn.click();
  await sleep(50);

  const addAccountBtn = await waitForSelector(`a[data-testid="AccountSwitcher_AddAccount_Button"]`, 10 * 1000, 25);
  if (!addAccountBtn) {
    console.error('Missing addAccountBtn!');
    return { error: 'noAccountButton' };
  }

  const switchBtn = await waitForSelector(`div[aria-label="Switch to @${handle}"]`, 5000, 10);
  if (!switchBtn) {
    console.error('Missing switchBtn!');
    return { error: 'noSwitchButton' };
  }

  if (parentTabId) {
    await addPendingRequest('https://twitter.com/home', { action: 'switchedUser', parentTabId, redirectTo, user: handle });
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
  debug.log('waitForUser:', handleIn, maxWait, interval);

  const handle = handleIn.replace('@', '');

  const url = `https://twitter.com/home#id=${myTabId}&switchToUser=${handle}&${createLogLevelArg()}`;
  debug.log('url', url);
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

export async function isEmptyPage(maxWait, interval) {
  const elem = await waitForSelector('[data-testid="emptyState"]', maxWait, interval);
  debug.log('isEmptyPage, elem:', elem);
  return !!elem;
}

export async function handleLockedTwitterAccount() {
  debug.log('handleLockedTwitterAccount');
  await chrome.runtime.sendMessage({ cmd: 'broadcast', request: { cmd: 'lockedTwitterAccount' } });
}