import {
  ONE_DAY,
  ONE_SECOND,
  sleep,
  waitForSelector,
  millisecondsAhead,
  addPendingRequest,
  createLogLevelArg,
  myConsole,
} from 'hx-lib';

const console2 = myConsole();

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

export async function isEmptyPage(maxWait, interval) {
  const elem = await waitForSelector('[data-testid="emptyState"]', maxWait, interval);
  console2.log('isEmptyPage, elem:', elem);
  return !!elem;
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
