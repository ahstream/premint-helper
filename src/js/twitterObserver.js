import global from './global.js';
console.log('global:', global);

import {
  //trimWallet,
  //walletToAlias,
  //sortWallets,
  reloadOptions,
  getMyTabIdFromExtension,
  normalizeTwitterHandle,
  loadStorage,
} from './premintHelperLib.js';

import {
  //timestampToLocaleString,
  sleep,
  millisecondsAhead,
  //round,
  kFormatter,
  extractTwitterHandle,
  //ONE_DAY,
  noDuplicates,
  setStorageData,
  createLogLevelArg,
  daysBetween,
  //isTwitterURL,
  myConsole,
  pluralize,
} from 'hx-lib';

import { waitForUser } from './twitterLib.js';

const console2 = myConsole(global.LOGLEVEL);

// DATA ----------------------------------------------------------------------------------

let storage = null;

let pageState = {
  saveTwitterTimeout: null,
  permissions: null,
  logger: null,
};

// MAIN FUNCS ----------------------------------------------------------------------------------

function logInfo(text) {
  if (pageState.logger?.info) {
    pageState.logger.info(text);
  } else {
    console2.info(text);
  }
}
function logError(text) {
  if (pageState.logger?.error) {
    pageState.logger.error(text);
  } else {
    logInfo(text);
  }
}

export async function createObserver({ permissions, cacheTwitterHours = 72, logger = null } = {}) {
  console2.trace('createObserver:', ...arguments);

  storage = await loadStorage({ keys: ['options', 'twitterObserver', 'projectObserver'] });
  console2.info('storage', storage);

  if (!storage.twitterObserver) {
    storage.twitterObserver = {};
    pageState.twitterModified = true;
  }

  if (pageState.twitterModified) {
    await setStorageData(storage);
  }

  console2.all('storage:', storage);

  pageState.permissions = permissions;
  pageState.logger = logger;
  pageState.cacheTwitterHours = valIfDefined(
    cacheTwitterHours,
    storage.options.TWITTER_FOLLOWERS_CACHE_HOURS
  );

  console2.info('PageState:', pageState);

  const mutationObserver = new MutationObserver(mutationHandler);
  mutationObserver.observe(document, { attributes: true, childList: true, subtree: true });

  return { getTwitterFollowers };
}

async function mutationHandler(mutationList) {
  for (const mutation of mutationList) {
    console2.all('mutation:', mutation);

    if (!mutation?.addedNodes?.length) {
      continue;
    }

    const links = getTwitterLinksFromMutations(mutation.addedNodes);
    for (const link of links) {
      handleTwitterLinkFromMutation(link);
    }
  }
}

function valIfDefined(val, notDefinedVal) {
  return typeof val !== 'undefined' ? val : notDefinedVal;
}

// EVENTS -------------------------------------------------------------

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  console2.log('Received request:', request, sender);

  if (request.cmd === 'lookupTwitterFollowers') {
    lookupTwitterFollowersHandler(request.scope);
  }

  if (request.cmd === 'switchedToTwitterUser') {
    pageState.switchedToTwitterUser = request;
  }

  if (request.cmd === 'getMyTabIdAsyncResponse') {
    pageState.myTabId = request.response;
  }

  if (request.cmd === 'profileResult') {
    pageState.twitterProfileResult = request.profile;
  }

  if (request.cmd === 'profileResultMainLoop') {
    handleProfileResult(request.profile);
    saveTwitter();
  }

  sendResponse();
  return true;
});

// TWITTER LOOKUP FUNCS -------------------------------------------------------------

async function switchTwitterUserBeforeFetchingFollowers() {
  if (storage.options.TWITTER_FETCH_FOLLOWERS_USER) {
    logInfo(
      `Switching to Twitter user @${storage.options.TWITTER_FETCH_FOLLOWERS_USER} on Twitter home page...`
    );
    const result = await waitForUser(
      storage.options.TWITTER_FETCH_FOLLOWERS_USER,
      pageState.myTabId,
      pageState
    );

    if (!result || !result.ok) {
      logError(`Failed switching to Twitter user @${storage.options.TWITTER_FETCH_FOLLOWERS_USER}`);
      console2.error(
        `Failed switching to Twitter user @${storage.options.TWITTER_FETCH_FOLLOWERS_USER}, aborting action`
      );
      return false;
    }
    console2.log(`Switched to Twitter user ${result.user}`);
  }
  return true;
}

async function waitForTwitterProfileResult(maxWait = 30000, interval = 10) {
  const stopTime = millisecondsAhead(maxWait);

  while (Date.now() <= stopTime) {
    if (pageState.twitterProfileResult) {
      const result = pageState.twitterProfileResult;
      pageState.twitterProfileResult = null;
      return result;
    }
    await sleep(interval);
  }
  return null;
}

function handleProfileResult(profile) {
  if (profile?.error) {
    return;
  }
  const user = createTwitterUser(profile.username, profile.follows);
  console2.trace('user:', user);

  updateTwitterUserLinksOnPage(user, profile.url);
}

// MUTATION HANDLING -------------------------------------------------------------

function getTwitterLinksFromMutations(nodes) {
  const elems = [];
  for (const node of nodes) {
    if (!node?.querySelectorAll) {
      continue;
    }
    console2.all('node:', node);
    const links = [...node.querySelectorAll('a')].filter(
      (x) =>
        x.href.match(/http(?:s)?:\/\/(?:www\.)?twitter\.com\/([a-zA-Z0-9_]+)(?:\?.*)*$/) ||
        x.href.match(/http(?:s)?:\/\/(?:www\.)?x\.com\/([a-zA-Z0-9_]+)(?:\?.*)*$/)
    );
    console2.trace('links:', links);
    elems.push(...links);
  }
  return elems;
}

function handleTwitterLinkFromMutation(link) {
  console2.trace('handleTwitterLink', link);

  if (link.classList.contains('hx-twitter-link')) {
    return console2.trace('twitter link already processed');
  }

  if (link.dataset && link.dataset.hxObserverDisabled) {
    return console2.log('Observer disabled, skip!');
  }

  const user = getTwitterUserByUrl(link.href, pageState.cacheTwitterHours);
  console2.trace('user', user);

  updateTwitterUserLinksOnPage(user, link.href);
}

// TWITTER -------------------------------------------------------------

async function lookupTwitterFollowersHandler(scope) {
  await reloadOptions(storage);
  console2.all('lookupTwitterFollowers, storage:', storage);

  if (!storage.options.TWITTER_FETCH_FOLLOWERS_USER) {
    window.alert(
      'It is recommended to set TWITTER_FETCH_FOLLOWERS_USER property on Optins page before fetching follower counts!'
    );
  }

  const urls = getTwitterUrlsOnPage();
  if (!urls.twitterUrls.length) {
    return window.alert('No Twitter links found on page!');
    // window.alert('No Twitter links with unknown follower count found on page!');
  }

  if (scope === 0 || scope === 1) {
    return lookupTwitterFollowersScope(urls.newUrls, 'new');
  }

  if (scope === 2) {
    return lookupTwitterFollowersScope(urls.expiredUrls, 'expired');
  }

  if (scope === 3) {
    return lookupTwitterFollowersScope(urls.nonExpiredUrls, 'non-expired');
  }
}

async function lookupTwitterFollowersScope(urls, key) {
  const getRealMax = (length) => {
    return length <= storage.options.TWITTER_MAX_LOOKUPS
      ? `${length}`
      : `max ${storage.options.TWITTER_MAX_LOOKUPS} of ${length}`;
  };

  let answer1 = null;

  answer1 = window.confirm(
    `Lookup follower counts for ${getRealMax(urls.length)} ${key} Twitter handles on page?`
  );

  if (!answer1) {
    return;
  }

  const useUrls = urls.splice(0, storage.options.TWITTER_MAX_LOOKUPS);
  console2.log('useUrls', useUrls);

  await getMyTabIdFromExtension(pageState, 5000);
  if (!pageState.myTabId) {
    console2.error('Invalid myTabId');
    logError(`Failed getting own page tab id when looking up Twitter followers!`);
    window.alert('Failed getting own page tab id when looking up Twitter followers!');
    return;
  }

  if (storage.options.TWITTER_FETCH_FOLLOWERS_USER && !(await switchTwitterUserBeforeFetchingFollowers())) {
    return;
  }
  await sleep(2000, null, 0.2);

  let ct = 0;
  for (const url of useUrls) {
    ct++;
    logInfo(`Getting follower count for Twitter handle (${ct}/${useUrls.length})`);
    console2.log(`Get Twitter followers ${ct}/${useUrls.length}: ${url}`);
    if (await fetchTwitterUser(url, pageState.myTabId)) {
      chrome.runtime.sendMessage({ cmd: 'focusMyTab' });
      await sleep(storage.options.TWITTER_LOOKUPS_SLEEP_BETWEEN, null, 0.1);
    }
  }

  logInfo(`Done getting follower counts for ${useUrls.length} ${key} Twitter handles`);
  await saveTwitter();

  chrome.runtime.sendMessage({ cmd: 'focusMyTab' });

  window.alert(`Done getting follower counts for ${useUrls.length} ${key} Twitter handles`);
}

/*
async function lookupTwitterFollowersHandlerOrg(scope) {
  await reloadOptions(storage);
  console2.all('lookupTwitterFollowers, storage:', storage);

  if (!storage.options.TWITTER_FETCH_FOLLOWERS_USER) {
    window.alert(
      'It is recommended to set TWITTER_FETCH_FOLLOWERS_USER property on Optins page before fetching follower counts!'
    );
  }

  const urls = getTwitterUrlsOnPage();
  if (!urls.twitterUrls.length) {
    return window.alert('No Twitter links found on page!');
    // window.alert('No Twitter links with unknown follower count found on page!');
  }

  const getRealMax = (length) => {
    return length <= storage.options.TWITTER_MAX_LOOKUPS
      ? `${length}`
      : `max ${storage.options.TWITTER_MAX_LOOKUPS} of ${length}`;
  };

  let answer1 = null;
  let answer2 = null;

  if (urls.newUrls.length) {
    answer1 = window.confirm(
      `Lookup follower counts for ${getRealMax(urls.newUrls.length)} non-expired Twitter handles on page?`
    );
  }
  if (!answer1 && urls.expiredUrls.length) {
    answer2 = window.confirm(
      `Lookup follower counts for ${getRealMax(urls.expiredUrls.length)} EXPIRED Twitter handles on page?`
    );
  }

  if (!answer1 && !answer2) {
    return;
  }

  const desc = answer1 ? 'non-expired' : 'expired';

  const useUrls = answer1
    ? urls.newUrls.splice(0, storage.options.TWITTER_MAX_LOOKUPS)
    : urls.expiredUrls.splice(0, storage.options.TWITTER_MAX_LOOKUPS);
  console2.log('useUrls', useUrls);

  await getMyTabIdFromExtension(pageState, 5000);
  if (!pageState.myTabId) {
    console2.error('Invalid myTabId');
    logError(`Failed getting own page tab id when looking up Twitter followers!`);
    window.alert('Failed getting own page tab id when looking up Twitter followers!');
    return;
  }

  if (storage.options.TWITTER_FETCH_FOLLOWERS_USER && !(await switchTwitterUserBeforeFetchingFollowers())) {
    return;
  }

  let ct = 0;
  for (const url of useUrls) {
    ct++;
    logInfo(`Getting follower count for Twitter handle (${ct}/${useUrls.length})`);
    console2.log(`Get Twitter followers ${ct}/${useUrls.length}: ${url}`);
    if (await fetchTwitterUser(url, pageState.myTabId)) {
      chrome.runtime.sendMessage({ cmd: 'focusMyTab' });
      await sleep(2000);
    }
  }

  logInfo(`Done getting follower counts for ${useUrls.length} ${desc} Twitter handles`);
  await saveTwitter();

  chrome.runtime.sendMessage({ cmd: 'focusMyTab' });

  window.alert(`Done getting follower counts for ${useUrls.length} ${desc} Twitter handles`);
}
*/

function updateTwitterUserLinksOnPage(user, href) {
  console2.log('updateTwitterUserLinksOnPage', href, user);

  if (!user) {
    return console2.trace('skip nullish user', user);
  }

  user.handle = user.handle || twitterUrlToHandle(href);

  const hrefLow = href.toLowerCase();
  const elems = [...document.querySelectorAll(`a`)].filter((e) => e.href.toLowerCase().startsWith(hrefLow));
  console2.trace('elems', elems);

  if (elems?.length) {
    console2.log('Update Twitter followers:', user.handle, user.followers);
  }

  for (let elem of elems) {
    //elem.classList.toggle('hx-twitter-link', !user.expired);
    //elem.classList.toggle('hx-twitter-link-expired', user.expired);
    elem.classList.toggle('hx-twitter-link', true);
    elem.classList.toggle('expired', !!user.expired);

    const followers = user.followers || 0;
    elem.dataset.hxFollowersNum = followers;
    elem.dataset.hxFollowers = kFormatter(followers, '');
    const daysAgo = daysBetween(Date.now(), user.fetchedAt);
    const title = `@${user.handle}\n${followers} followers ${
      daysAgo < 1 ? 'today' : daysAgo + ' ' + pluralize(daysAgo, 'day', 'days') + ' ago'
    }`;

    elem.title = title;
  }
  // todo move trimAlphabotWhiteSpace elsewhere!

  /*
  if (pageState.trimAlphabotWhiteSpace) {
    [...document.querySelectorAll('h5')].forEach((h) => (h.style.whiteSpace = 'normal'));
  }
  */

  [...document.querySelectorAll('h5')].forEach((h) => (h.style.whiteSpace = 'normal'));
  /*
  document.documentElement.style.setProperty(
    '--raffle-followers-background-color',
    storage.options.RAFFLE_FOLLOWERS_BACKGROUND_COLOR
  );
  document.documentElement.style.setProperty(
    '--raffle-followers-color',
    storage.options.RAFFLE_FOLLOWERS_COLOR
  );
  document.documentElement.style.setProperty(
    '--raffle-expired-followers-background-color',
    storage.options.RAFFLE_EXPIRED_FOLLOWERS_BACKGROUND_COLOR
  );
  document.documentElement.style.setProperty(
    '--raffle-expired-followers-color',
    storage.options.RAFFLE_EXPIRED_FOLLOWERS_COLOR
  );
  */
}

function getTwitterUrlsOnPage(all = false) {
  const twitterLinks = [...document.querySelectorAll('a')].filter(
    (x) =>
      x.href.match(/http(?:s)?:\/\/(?:www\.)?twitter\.com\/([a-zA-Z0-9_]+)(?:\?.*)*$/) ||
      x.href.match(/http(?:s)?:\/\/(?:www\.)?x\.com\/([a-zA-Z0-9_]+)(?:\?.*)*$/)
  );

  const twitterUrls = twitterLinks.map((x) => x.href);

  const newUrls = noDuplicates(
    twitterLinks.filter((x) => !x.classList.contains('hx-twitter-link') || all).map((x) => x.href)
  );

  const expiredUrls = noDuplicates(
    twitterLinks
      .filter((x) => (x.classList.contains('hx-twitter-link') && x.classList.contains('expired')) || all)
      .map((x) => x.href)
  );

  const nonExpiredUrls = noDuplicates(
    twitterLinks
      .filter((x) => (x.classList.contains('hx-twitter-link') && !x.classList.contains('expired')) || all)
      .map((x) => x.href)
  );

  console2.trace('twitterLinks:', twitterLinks);
  console2.trace('twitterUrls:', twitterUrls);
  console2.trace('newUrls:', newUrls);
  console2.trace('expiredUrls:', expiredUrls);
  console2.trace('nonExpiredUrls:', nonExpiredUrls);

  return { twitterUrls, newUrls, expiredUrls, nonExpiredUrls };
}

async function fetchTwitterUser(baseUrl, myTabId) {
  let user = getTwitterUserByUrl(baseUrl, pageState.cacheTwitterHours);

  if (user && !user.expired) {
    updateTwitterUserLinksOnPage(user, baseUrl);
    return false;
  }

  const url = `${baseUrl}#getProfile=true&id=${myTabId}&${createLogLevelArg()}`;
  console2.info('open url:', url);
  window.open(url);
  const profile = await waitForTwitterProfileResult();
  console2.log('profile', profile);
  if (!profile?.ok) {
    console2.warn('invalid profile', profile);
    return false;
  }

  handleProfileResult(profile);

  return true;
}

// TWITTER USER -------------------------------------------------------------

function twitterUrlToHandle(url) {
  return normalizeTwitterHandle(extractTwitterHandle(url));
}

function getTwitterUserByUrl(url, cacheHours) {
  return getTwitterUser(twitterUrlToHandle(url), cacheHours);
}

function getTwitterFollowers(handle) {
  const u = getTwitterUser(handle);
  return u?.followers || -1;
}

function getTwitterUser(handle, cacheHours) {
  console2.trace('getTwitterUser, handle:', handle);
  if (!handle) {
    console2.trace('Skip invalid handle!');
    return null;
  }

  if (storage.twitterObserver[handle] && storage.twitterObserver[handle].fetchedAt) {
    const liveTo = storage.twitterObserver[handle].fetchedAt + cacheHours * 60 * 60 * 1000;
    console2.log(
      'TTL (hours):',
      handle,
      cacheHours,
      liveTo,
      Date.now(),
      Math.round((liveTo - Date.now()) / (1000 * 60 * 60))
    );
    if (liveTo >= Date.now()) {
      return storage.twitterObserver[handle];
    } else {
      return { ...storage.twitterObserver[handle], expired: true };
    }
  }

  console2.trace('no cached twitter user');
  return null;
}

function createTwitterUser(handle, followers) {
  storage.twitterObserver[handle] = {
    handle,
    followers,
    fetchedAt: Date.now(),
  };
  pageState.twitterModified = true;
  return storage.twitterObserver[handle];
}

// HELPERS ----------------------------------------------------------------------------------

function saveTwitter() {
  if (!pageState.twitterModified) {
    console2.trace('no modifications, skip save!');
    return;
  }
  console2.trace('start saveStorage timeout...');
  if (pageState.saveTwitterTimeout) {
    clearTimeout(pageState.saveTwitterTimeout);
  }
  pageState.saveTwitterTimeout = setTimeout(function () {
    console2.trace('do save storage!');
    setStorageData({ twitterObserver: storage.twitterObserver });
    pageState.twitterModified = false;
  }, 2000);
}
