console.info('alphabotMainPage.js begin', window?.location?.href);

import '../styles/alphabotPage.css';
import { createObserver } from './observer';
import { waitForUser } from './twitterLib.js';
import { fetchProjects } from './alphabotLib.js';
import {
  createStatusbarButtons,
  addRevealAlphabotRafflesRequest,
  getMyTabIdFromExtension,
  STATUSBAR_DEFAULT_TEXT,
} from './premintHelperLib';

import { getStorageItems, createLogger, sleep, createHashArgs, noDuplicates, dispatch } from '@ahstream/hx-lib';
import { createStatusbar } from '@ahstream/hx-statusbar';

const debug = createLogger();

// DATA ----------------------------------------------------------------------------------

let storage = null;

let pageState = {
  parentTabId: null,
  storageModified: false,
  action: '',
  pendingRequests: [],
  isRegistering: false,
  statusbar: null,
  history: null,
  lastURL: '',
  observer: null,
};

// STARTUP ----------------------------------------------------------------------------

runNow();

async function runNow() {
  storage = await getStorageItems(['runtime', 'options']);
  debug.log('storage', storage);

  if (!storage?.options) {
    console.info('Options missing, exit!');
    return;
  }

  if (!storage.options.ALPHABOT_ENABLE) {
    console.info('Disabled, exit!');
    return;
  }

  pageState.observer = await createObserver();

  window.addEventListener('load', onLoad);
  window.addEventListener('DOMContentLoaded', onLoad);
}

async function onLoad() {
  debug.log('onLoad');

  if (pageState.loaded) {
    debug.log('Page already loaded, ignore onLoad event!');
    return;
  }
  pageState.loaded = true;

  const hashArgs = createHashArgs(window.location.hash);

  pageState = {
    ...pageState,
    ...{
      hashArgs,
      parentTabId: hashArgs.getOne('id'),
      storageModified: false,
      action: hashArgs.getOne('action'),
      pendingRequests: [],
      isRegistering: false,
      statusbar: createStatusbar(STATUSBAR_DEFAULT_TEXT),
      lastURL: window.location.href,
      finishedTabsIds: [],
    },
  };

  debug.log('pageState', pageState);

  runPage();
}

// EVENT HANDLERS ----------------------------------------------------------------------------------

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  debug.log('Received message:', request, sender);

  if (request.cmd === 'switchedToTwitterUser') {
    pageState.switchedToTwitterUser = request;
  }

  if (request.cmd === 'reveal-alphabot-raffles') {
    revealRaffles();
  }

  if (request.cmd === 'onHistoryStateUpdated') {
    debug.log('onHistoryStateUpdated in content page', request);

    const currentURL = window.location.href;
    const lastURL = pageState.lastURL;
    debug.log('currentURL', currentURL);
    debug.log('lastURL', lastURL);
    pageState.lastURL = currentURL;
    if (currentURL.includes('?') && lastURL.includes('?')) {
      debug.log('Only search args changed, do not rerun page!');
    } else if (currentURL !== lastURL) {
      debug.log('Page navigation, reload page!');
      window.location.reload();
    }
  }

  if (request.cmd === 'getMyTabIdAsyncResponse') {
    pageState.myTabId = request.response;
  }

  sendResponse();
  return true;
});

// PAGE FUNCS ----------------------------------------------------------------------------------

async function runPage() {
  debug.log('runPage; pageState:', pageState);

  console.log('pageState.statusbar', pageState.statusbar);
  pageState.statusbar.buttons(
    createStatusbarButtons({
      options: true,
      results: true,
      reveal: revealRafflesEventHandler,
      followers: lookupTwitterEventHandler,
    })
  );

  if (!pageState.action) {
    const request = await dispatch(window.location.href, 5 * 60);
    debug.log('dispatched request:', request);
    pageState.request = request;
    pageState.action = request?.action;
  }

  if (pageState.action === 'shortcut') {
    pageState.isAutoStarted = true;
  }

  if (pageState.action === 'reveal-alphabot-raffles') {
    return revealRaffles({});
  }

  return showMainPage();
}

// MAIN PAGE FUNCS ----------------------------------------------------------------------------------

async function showMainPage() {
  debug.log('showMainPage');

  debug.log('Fix raffles names no wrap');
  [...document.querySelectorAll('h5')].forEach((h) => (h.style.whiteSpace = 'normal'));
}

// LOOKUP TWITTER FUNCS -----------------------------------------------------------------------------------------

async function lookupTwitterEventHandler(event) {
  event.preventDefault();
  event.stopImmediatePropagation();

  if (!storage.options.TWITTER_FETCH_FOLLOWERS_USER) {
    window.alert('It is recommended to set TWITTER_FETCH_FOLLOWERS_USER property on Optins page before fetching follower counts!');
  }

  const links = noDuplicates(getLookupTwitterLinks());
  if (!links.length) {
    window.alert('No Twitter links with unknown follower count found on page!');
    return;
  }

  if (!window.confirm(`Lookup follower count for ${links.length} Twitter links on page?`)) {
    return;
  }

  lookupTwitter();
}

function getLookupTwitterLinks() {
  return [...document.querySelectorAll('a[data-action="option-twitter"]')]
    .filter((x) => !x.classList.contains('twitter-link'))
    .map((x) => cleanTwitterLink(x.href));
}

async function lookupTwitter() {
  debug.log('lookupTwitter');

  const twitterLinks = getLookupTwitterLinks();
  debug.log('twitterLinks', twitterLinks);

  if (!twitterLinks?.length) {
    updateStatusbar(`Already got follower counts for all Twitter links on page`);
    return;
  }
  const links = noDuplicates(twitterLinks);
  debug.log('links', links);

  await getMyTabIdFromExtension(pageState, 5000);
  if (!pageState.myTabId) {
    console.error('Invalid myTabId');
    updateStatusbarError(`Failed getting own page tab id when looking up Twitter followers!`);
    return;
  }

  if (storage.options.TWITTER_FETCH_FOLLOWERS_USER && !(await switchTwitterUserBeforeFetchingFollowers())) {
    return;
  }

  let ct = 0;
  for (const baseUrl of links) {
    ct++;
    updateStatusbar(`Get follower counts for Twitter links on page (${ct}/${links.length})`);
    debug.log(`Get Twitter followers ${ct}/${links.length}: ${baseUrl}`);
    if (await pageState.observer.updateTwitter(baseUrl, pageState.myTabId)) {
      await sleep(2000);
    }
  }

  updateStatusbar(`Done getting follower count for ${links.length} Twitter links`);
  await pageState.observer.saveTwitter();
}

async function switchTwitterUserBeforeFetchingFollowers() {
  if (storage.options.TWITTER_FETCH_FOLLOWERS_USER) {
    updateStatusbar(`Switching to Twitter user @${storage.options.TWITTER_FETCH_FOLLOWERS_USER} on Twitter home page...`);
    const result = await waitForUser(storage.options.TWITTER_FETCH_FOLLOWERS_USER, pageState.myTabId, pageState);

    if (!result || !result.ok) {
      debug.log('Failed switching to Twitter user; result:', result);
      updateStatusbarError(`Failed switching to Twitter user @${storage.options.TWITTER_FETCH_FOLLOWERS_USER}, aborting action`);
      return false;
    }
    updateStatusbar(`Switched to Twitter user ${result.user}`);
  }
  return true;
}

function cleanTwitterLink(href) {
  const url = new URL(href);
  return url.protocol + '//' + url.host + url.pathname;
}

// REVEAL RAFFLES  -----------------------------------------------------------------------------------------

async function revealRafflesEventHandler(event) {
  event.preventDefault();
  event.stopImmediatePropagation();

  if (window.location.search === '') {
    const url = await addRevealAlphabotRafflesRequest();
    window.location.href = url;
  } else {
    return revealRaffles();
  }
}

async function revealRaffles({ pageSize = 16 } = {}) {
  debug.info('Reveal raffles');

  [...document.querySelectorAll('h5')].forEach((h) => (h.style.whiteSpace = 'normal'));

  const numRafflesOnPage = document.querySelectorAll('.MuiGrid-root')?.length;
  updateStatusbar(`Revealing ${numRafflesOnPage || 0} raffles...`);

  const numPages = Math.round(Number(numRafflesOnPage / pageSize)) + 1;
  debug.log('numRafflesOnPage, numPages', numRafflesOnPage, numPages);

  const callback = (pageNum) => {
    updateStatusbar(`Revealing raffles... (page ${pageNum + 1}/${numPages})`);
  };

  const query = document.querySelector('input[placeholder="search"]')?.value || '';

  const projects = await fetchProjects({ pageSize, maxPages: numPages, searchQuery: query, callback });
  debug.log('projects', projects);

  if (!projects?.length) {
    updateStatusbarError(`No raffles to reveal`);
    return;
  }

  await pageState.observer.reloadStorage();

  for (const project of projects) {
    debug.log('project', project);
    pageState.observer.updateProject(project.slug, {
      entryCount: project.entryCount,
      winnerCount: project.winnerCount,
    });
  }

  pageState.observer.saveProjects();

  updateStatusbar(`Revealed ${projects.length} raffles`);
}

// STATUSBAR FUNCS ----------------------------------------------------------------------------------

function updateStatusbar(content, className = null) {
  pageState.statusbar.text(content, className);
}

function updateStatusbarError(content) {
  pageState.statusbar.error(content);
}

// HELPERS ---------------------------------------------------------------------------------------------------
