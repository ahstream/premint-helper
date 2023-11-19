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
  createLogger,
  createLogLevelArg,
  daysBetween,
  //isTwitterURL,
} from 'hx-lib';

import { waitForUser } from './twitterLib.js';

const debug = createLogger();

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
    console.log(text);
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
  debug.log('createObserver:', ...arguments);

  await reloadStorage();

  if (!storage.twitterObserver) {
    storage.twitterObserver = {};
    pageState.twitterModified = true;
  }

  if (pageState.twitterModified) {
    await setStorageData(storage);
  }

  debug.log('storage:', storage);

  pageState.permissions = permissions;
  pageState.logger = logger;
  pageState.cacheTwitterHours = valIfDefined(
    cacheTwitterHours,
    storage.options.TWITTER_FOLLOWERS_CACHE_HOURS
  );

  debug.log('pageState', pageState);

  const mutationObserver = new MutationObserver(mutationHandler);
  mutationObserver.observe(document, { attributes: true, childList: true, subtree: true });

  return {};
}

async function mutationHandler(mutationList) {
  for (const mutation of mutationList) {
    debug.trace('mutation:', mutation);

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
  debug.log('Received request:', request, sender);

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
    debug.log(
      `Switching to Twitter user @${storage.options.TWITTER_FETCH_FOLLOWERS_USER} on Twitter home page...`
    );
    const result = await waitForUser(
      storage.options.TWITTER_FETCH_FOLLOWERS_USER,
      pageState.myTabId,
      pageState
    );

    if (!result || !result.ok) {
      debug.log('Failed switching to Twitter user; result:', result);
      console.error(
        `Failed switching to Twitter user @${storage.options.TWITTER_FETCH_FOLLOWERS_USER}, aborting action`
      );
      return false;
    }
    debug.log(`Switched to Twitter user ${result.user}`);
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
  debug.log('user:', user);

  updateTwitterUserLinksOnPage(user, profile.url);
}

// MUTATION HANDLING -------------------------------------------------------------

function getTwitterLinksFromMutations(nodes) {
  const elems = [];
  for (const node of nodes) {
    if (!node?.querySelectorAll) {
      continue;
    }
    debug.log('node:', node); // todo trace
    const links = [...node.querySelectorAll('a')].filter(
      (x) =>
        x.href.match(/http(?:s)?:\/\/(?:www\.)?twitter\.com\/([a-zA-Z0-9_]+)(?:\?.*)*$/) ||
        x.href.match(/http(?:s)?:\/\/(?:www\.)?x\.com\/([a-zA-Z0-9_]+)(?:\?.*)*$/)
    );
    debug.log('links:', links); // todo trace
    debug.log('links all:', node.querySelectorAll('a')); // todo trace
    elems.push(...links);
  }
  return elems;
}

function handleTwitterLinkFromMutation(link) {
  debug.log('handleTwitterLink', link); // todo trace

  if (link.classList.contains('hx-twitter-link')) {
    return debug.log('twitter link already processed'); // todo trace
  }

  if (link.dataset && link.dataset.hxObserverDisabled) {
    return debug.trace('Observer disabled, skip!');
  }

  const user = getTwitterUserByUrl(link.href, pageState.cacheTwitterHours);
  debug.log('user', user); // todo trace

  updateTwitterUserLinksOnPage(user, link.href);
}

// TWITTER -------------------------------------------------------------

async function lookupTwitterFollowersHandler() {
  await reloadOptions(storage);
  console.log('lookupTwitterFollowers, storage:', storage);

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
  debug.log('useUrls', useUrls);

  await getMyTabIdFromExtension(pageState, 5000);
  if (!pageState.myTabId) {
    console.error('Invalid myTabId');
    window.alert('Invalid myTabId');
    logError(`Failed getting own page tab id when looking up Twitter followers!`);
    return;
  }

  if (storage.options.TWITTER_FETCH_FOLLOWERS_USER && !(await switchTwitterUserBeforeFetchingFollowers())) {
    return;
  }

  let ct = 0;
  for (const url of useUrls) {
    ct++;
    logInfo(`Getting follower count for Twitter handle (${ct}/${useUrls.length})`);
    debug.log(`Get Twitter followers ${ct}/${useUrls.length}: ${url}`);
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
  debug.log('updateTwitterLinks', href, user);

  if (!user) {
    return debug.log('skip nullish user', user);
  }

  const hrefLow = href.toLowerCase();
  const elems = [...document.querySelectorAll(`a`)].filter((e) => e.href.toLowerCase().startsWith(hrefLow));
  debug.log('elems', elems);

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
  debug.log('urls:', urls);
  debug.log('noDupUrls:', noDupUrls);
  return noDupUrls;
}

async function fetchTwitterUser(baseUrl, myTabId) {
  let user = getTwitterUserByUrl(baseUrl, pageState.cacheTwitterHours);

  if (user && !user.expired) {
    updateTwitterUserLinksOnPage(user, baseUrl);
    return false;
  }

  const url = `${baseUrl}#getProfile=true&id=${myTabId}&${createLogLevelArg()}`;
  debug.log('open url:', url);
  window.open(url);
  const profile = await waitForTwitterProfileResult();
  debug.log('profile', profile);
  if (!profile?.ok) {
    console.warn('invalid profile');
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
  debug.log('getTwitterUser, handle:', handle); // todo trace
  if (!handle) {
    debug.trace('Skip invalid handle!');
    return null;
  }

  if (storage.twitterObserver[handle] && storage.twitterObserver[handle].fetchedAt) {
    const liveTo = storage.twitterObserver[handle].fetchedAt + cacheHours * 60 * 60 * 1000;
    debug.trace('TTL (hours):', Math.round((liveTo - Date.now()) / (1000 * 60 * 60)));
    if (liveTo >= Date.now()) {
      return storage.twitterObserver[handle];
    } else {
      return { ...storage.twitterObserver[handle], expired: true };
    }
  }

  debug.trace('no cached twitter user');
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
    debug.log('no modifications, skip save!');
    return;
  }
  debug.log('start saveStorage timeout...');
  if (pageState.saveTwitterTimeout) {
    clearTimeout(pageState.saveTwitterTimeout);
  }
  pageState.saveTwitterTimeout = setTimeout(function () {
    debug.log('do save storage!');
    setStorageData({ twitterObserver: storage.twitterObserver });
    pageState.twitterModified = false;
  }, 2000);
}

async function reloadStorage(key = null) {
  if (!key) {
    storage = await getStorageItems(['options', 'twitterObserver', 'projectObserver', 'projectWins']);
  } else {
    const storageTemp = await getStorageItems([key]);
    storage[key] = storageTemp[key];
  }
  debug.log('reloadStorage:', storage);
}
