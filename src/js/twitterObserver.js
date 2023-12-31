import {
  //trimWallet,
  //walletToAlias,
  //sortWallets,
  reloadOptions,
  getMyTabIdFromExtension,
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
  getStorageItems,
  setStorageData,
  createLogLevelArg,
  daysBetween,
  //isTwitterURL,
  myConsole,
} from 'hx-lib';

import { waitForUser } from './twitterLib.js';

const console2 = myConsole();

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

  await reloadStorage();

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

  return {};
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
    lookupTwitterFollowersHandler();
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

async function lookupTwitterFollowersHandler() {
  await reloadOptions(storage);
  console2.all('lookupTwitterFollowers, storage:', storage);

  if (!storage.options.TWITTER_FETCH_FOLLOWERS_USER) {
    window.alert(
      'It is recommended to set TWITTER_FETCH_FOLLOWERS_USER property on Optins page before fetching follower counts!'
    );
  }

  const urls = getLookupTwitterUrlsOnPage();
  if (!urls.length) {
    window.alert('No Twitter links with unknown follower count found on page!');
    return;
  }

  const max = storage.options.TWITTER_MAX_LOOKUPS;
  const n = urls.length <= max ? urls.length : max;

  if (
    !window.confirm(`Lookup follower counts for ${n} of ${urls.length} non-expired Twitter handles on page?`)
  ) {
    return;
  }

  const useUrls = urls.slice(0, n);
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

  logInfo(`Done getting follower counts for ${useUrls.length} Twitter handles`);
  await saveTwitter();

  chrome.runtime.sendMessage({ cmd: 'focusMyTab' });

  window.alert(`Done getting follower counts for ${useUrls.length} Twitter handles`);
}

function updateTwitterUserLinksOnPage(user, href) {
  console2.log('updateTwitterLinks', href, user);

  if (!user) {
    return console2.trace('skip nullish user', user);
  }

  const hrefLow = href.toLowerCase();
  const elems = [...document.querySelectorAll(`a`)].filter((e) => e.href.toLowerCase().startsWith(hrefLow));
  console2.trace('elems', elems);

  if (elems?.length) {
    console2.info('Update Twitter followers:', user.handle, user.followers);
  }

  for (let elem of elems) {
    //elem.classList.toggle('hx-twitter-link', !user.expired);
    //elem.classList.toggle('hx-twitter-link-expired', user.expired);
    elem.classList.toggle('hx-twitter-link', true);
    elem.classList.toggle('expired', !!user.expired);

    const followers = user.followers || 0;
    elem.dataset.hxFollowersNum = followers;
    elem.dataset.hxFollowers = kFormatter(followers);
    const daysAgo = daysBetween(Date.now(), user.fetchedAt);
    const title = `@${user.handle}\n${followers} followers  ${daysAgo < 1 ? 'today' : daysAgo + ' days ago'}`;

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

function getLookupTwitterUrlsOnPage(all = false) {
  const urls = [...document.querySelectorAll('a')]
    .filter(
      (x) =>
        x.href.match(/http(?:s)?:\/\/(?:www\.)?twitter\.com\/([a-zA-Z0-9_]+)(?:\?.*)*$/) ||
        x.href.match(/http(?:s)?:\/\/(?:www\.)?x\.com\/([a-zA-Z0-9_]+)(?:\?.*)*$/)
    )
    .filter((x) => !x.classList.contains('hx-twitter-link') || all)
    .map((x) => x.href);
  const noDupUrls = noDuplicates(urls);
  console2.trace('urls:', urls);
  console2.trace('noDupUrls:', noDupUrls);
  return noDupUrls;
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

function getTwitterUserByUrl(url, cacheHours) {
  return getTwitterUser(extractTwitterHandle(url), cacheHours);
}

function getTwitterUser(handle, cacheHours) {
  console2.trace('getTwitterUser, handle:', handle);
  if (!handle) {
    console2.trace('Skip invalid handle!');
    return null;
  }

  if (storage.twitterObserver[handle] && storage.twitterObserver[handle].fetchedAt) {
    const liveTo = storage.twitterObserver[handle].fetchedAt + cacheHours * 60 * 60 * 1000;
    console2.log('TTL (hours):', handle, Math.round((liveTo - Date.now()) / (1000 * 60 * 60)));
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

async function reloadStorage(key = null) {
  if (!key) {
    storage = await getStorageItems(['options', 'twitterObserver', 'projectObserver']);
  } else {
    const storageTemp = await getStorageItems([key]);
    storage[key] = storageTemp[key];
  }
  console2.all('reloadStorage:', storage);
}
