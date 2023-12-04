console.info('alphabotMainPage.js begin', window?.location?.href);

import '../styles/alphabotPage.css';
import { createObserver } from './observerGeneric.js';
import { createObserver as createTwitterObserver } from './twitterObserver.js';
import { fetchProjects } from './alphabotLib.js';
import {
  createStatusbarButtons,
  addRevealAlphabotRafflesRequest,
  lookupTwitterFollowersClickEventHandler,
  STATUSBAR_DEFAULT_TEXT,
} from './premintHelperLib';

import { getStorageItems, createHashArgs, dispatch, myConsole, sleep } from 'hx-lib';
import { createStatusbar } from 'hx-statusbar';
import { getPermissions } from './permissions';

const console2 = myConsole();

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
  twitterObserver: null,
};

// STARTUP ----------------------------------------------------------------------------

runNow();

async function runNow() {
  pageState.observer = await createObserver({ permissions: null, autoFollowers: false });
  pageState.twitterObserver = await createTwitterObserver({
    permissions: null,
    logger: { info: updateStatusbar, error: updateStatusbarError },
  });
  pageState.permissions = await getPermissions();

  window.addEventListener('load', onLoad);
  window.addEventListener('DOMContentLoaded', onLoad);
  //setTimeout(onLoad, 1000);

  storage = await getStorageItems(['runtime', 'options']);
  console2.log('storage', storage);

  if (!storage?.options) {
    console2.info('Options missing, exit!');
    return;
  }

  if (!storage.options.ALPHABOT_ENABLE) {
    console2.info('Disabled, exit!');
    return;
  }

  // pageState.observer = await createObserver({ permissions: pageState.permissions, autoFollowers: false });

  pageState.initialized = true;
}

async function onLoad() {
  console2.log('onLoad');

  if (pageState.loaded) {
    console2.log('Page already loaded, ignore onLoad event!');
    return;
  }
  pageState.loaded = true;

  while (!pageState.initialized) {
    console2.info('Wait for initialized...');
    await sleep(200);
  }

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

  console2.info('PageState:', pageState);

  runPage();
}

// EVENT HANDLERS ----------------------------------------------------------------------------------

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  console2.info('Received message:', request, sender);

  if (request.cmd === 'switchedToTwitterUser') {
    pageState.switchedToTwitterUser = request;
  }

  if (request.cmd === 'reveal-alphabot-raffles') {
    revealRaffles();
  }

  if (request.cmd === 'onHistoryStateUpdated') {
    console2.log('onHistoryStateUpdated in content page', request);

    const currentURL = window.location.href;
    const lastURL = pageState.lastURL;
    console2.trace('currentURL', currentURL);
    console2.trace('lastURL', lastURL);
    pageState.lastURL = currentURL;
    if (currentURL.includes('?') && lastURL.includes('?')) {
      console2.trace('Only search args changed, do not rerun page!');
    } else if (lastURL && currentURL !== lastURL) {
      console2.info('Page navigation, reload page!');
      window.location.reload();
    } else {
      console2.trace('No new navigation, skip reload');
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
  console2.info('Run page');
  console2.info('PageState', pageState);

  pageState.statusbar.buttons(
    createStatusbarButtons({
      options: true,
      results: true,
      reveal: revealRafflesEventHandler,
      followers: lookupTwitterFollowersClickEventHandler,
    })
  );
  console2.log('statusbar', pageState.statusbar);

  if (!pageState.action) {
    const request = await dispatch(window.location.href, 5 * 60);
    console2.info('Dispatched request:', request);
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
  console2.info('Show main page');

  console2.info('Fix raffles name wrap');

  [...document.querySelectorAll('h5')].forEach((h) => (h.style.whiteSpace = 'normal'));
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
  console2.info('Reveal raffles');

  [...document.querySelectorAll('h5')].forEach((h) => (h.style.whiteSpace = 'normal'));

  const numRafflesOnPage = document.querySelectorAll('.MuiGrid-root')?.length;
  updateStatusbar(`Revealing ${numRafflesOnPage || 0} raffles...`);

  const numPages = Math.round(Number(numRafflesOnPage / pageSize)) + 1;
  console2.log('numRafflesOnPage, numPages', numRafflesOnPage, numPages);

  const loggerFn = (pageNum) => {
    updateStatusbar(`Revealing raffles... (page ${pageNum + 1}/${numPages})`);
  };

  await pageState.observer.reloadStorage();

  const updateProjects = (ps) => {
    for (const project of ps) {
      console2.trace('project', project);
      pageState.observer.updateProject(project.slug, {
        entryCount: project.entryCount,
        winnerCount: project.winnerCount,
      });
    }
  };

  const processResultFn = updateProjects;

  const query = document.querySelector('input[placeholder="search"]')?.value || '';

  const projects = await fetchProjects({
    pageSize,
    maxPages: numPages,
    searchQuery: query,
    loggerFn,
    processResultFn,
  });
  console2.log('projects', projects);

  if (!projects?.length) {
    updateStatusbarError(`No raffles to reveal`);
    return;
  }

  if (!processResultFn) {
    updateProjects(projects);
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
