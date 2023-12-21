import { trimWallet, walletToAlias, sortWallets, loadStorage } from './premintHelperLib';
import {
  sleep,
  millisecondsAhead,
  round,
  kFormatter,
  extractTwitterHandle,
  setStorageData,
  createLogLevelArg,
  isTwitterURL,
  myConsole,
  noDuplicates,
} from 'hx-lib';

const console2 = myConsole();

// DATA ----------------------------------------------------------------------------------

let storage = null;

// MAIN FUNCS ----------------------------------------------------------------------------------

// [...document.querySelectorAll('a')].map(x => x.href).filter(x => x.match(/http(?:s)?:\/\/(?:www\.)?twitter\.com\/([a-zA-Z0-9_]+)$/))

export async function createObserver({
  permissions,
  cacheTwitterHours,
  cacheProjectMins,
  trimAlphabotWhiteSpace,
  autoFollowers,
  autoOdds,
  autoWins,
} = {}) {
  console2.trace('createObserver:', ...arguments);

  let pageState = {
    saveTwitterTimeout: null,
    saveProjectsTimeout: null,
    twitterModified: false,
    projectsModified: false,
    permissions,
  };

  await reloadStorage();

  pageState.cacheTwitterHours =
    typeof cacheTwitterHours === 'undefined'
      ? storage.options.TWITTER_FOLLOWERS_CACHE_HOURS
      : cacheTwitterHours;
  pageState.cacheProjectMins =
    typeof cacheProjectMins === 'undefined' ? storage.options.RAFFLE_ODDS_CACHE_MINS : cacheProjectMins;
  pageState.trimAlphabotWhiteSpace =
    typeof trimAlphabotWhiteSpace === 'undefined'
      ? storage.options.RAFFLE_TRIM_WHITESPACE
      : trimAlphabotWhiteSpace;
  pageState.autoFollowers =
    typeof autoFollowers === 'undefined' ? storage.options.RAFLE_AUTO_SHOW_FOLLOWERS : autoFollowers;
  pageState.autoOdds = typeof autoOdds === 'undefined' ? storage.options.RAFLE_AUTO_SHOW_ODDS : autoOdds;
  pageState.autoWins = typeof autoWins === 'undefined' ? storage.options.RAFLE_AUTO_SHOW_WINS : autoWins;

  console2.info('PageState:', pageState);

  if (!pageState.autoFollowers && !pageState.autoOdds && !pageState.autoWins) {
    console2.info('No mutations needed');
    return;
  }

  const mutationObserver = new MutationObserver(mutationHandler);
  mutationObserver.observe(document, { attributes: true, childList: true, subtree: true });

  async function mutationHandler(mutationList) {
    for (const mutation of mutationList) {
      console2.all('mutation:', mutation);
      if (!mutation?.addedNodes?.length) {
        continue;
      }

      if (pageState.autoWins) {
        console2.trace('getRafflesPageWinElems 1...');
        const elems = getRafflesPageWinElems(mutation.addedNodes);
        for (const elem of elems) {
          handleRafflesPageWin(elem);
        }
      }

      if (pageState.autoFollowers) {
        if (mutation.target.nodeName === 'A' && isTwitterURL(mutation.target.href)) {
          console2.trace('handle mutation:', mutation);
          handleTwitterLink(mutation.target);
          return;
        }
      }

      if (pageState.autoFollowers) {
        console2.trace('getTwitterLinkElems...');
        const twitterLinks = getTwitterLinkElems(mutation.addedNodes);
        for (const link of twitterLinks) {
          handleTwitterLink(link);
        }
      }

      if (pageState.autoOdds || pageState.autoWins) {
        console2.trace('getAlphabotProjectLinkElems 1...');
        const links = getAlphabotProjectLinkElems(mutation.addedNodes);
        for (const link of links) {
          handleProjectLink(link);
        }
      }

      if (storage.options.ALPHABOT_OPEN_RAFFLE_LINKS_IN_NEW_TAB) {
        console2.trace('getAlphabotProjectLinkElems 2...');
        const allProjectLinks = getAlphabotProjectLinkElems(mutation.addedNodes, false, false);
        for (const link of allProjectLinks) {
          link.target = '_blank';
        }
      }
    }
  }

  // EVENTS -------------------------------------------------------------

  chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    if (request.cmd === 'profileResult') {
      console2.log('Received profileResult', request);
      pageState.twitterProfileResult = request.profile;
    }

    if (request.cmd === 'profileResultMainLoop') {
      console2.log('Received profileResultMainLoop', request);
      handleProfileResult(request.profile);
      saveTwitter();
    }

    sendResponse();
    return true;
  });

  // TWITTER -------------------------------------------------------------

  function handleTwitterLink(link) {
    if (link.classList.contains('twitter-link')) {
      console2.trace('twitter link already processed');
      return;
    }

    if (link.dataset && link.dataset.hxDisabled) {
      console2.trace('Target mutation observer disabled, skip!');
      return;
    }

    const user = getCachedUserByURL(link.href, pageState.cacheTwitterHours);
    console2.trace('user', user);
    if (user) {
      updateTwitterFollowers(user, link.href);
    }
  }

  function getCachedUserByURL(url, cacheHours) {
    return getCachedUser(extractTwitterHandle(url), cacheHours);
  }

  function getCachedUser(username, cacheHours) {
    console2.trace('getCachedUser, username:', username);
    if (!username) {
      console2.trace('Skip invalid username!');
      return null;
    }

    if (storage.twitterObserver[username] && storage.twitterObserver[username].fetchedAt) {
      const liveTo = storage.twitterObserver[username].fetchedAt + cacheHours * 60 * 60 * 1000;
      console2.log('TTL (hours):', username, Math.round((liveTo - Date.now()) / (1000 * 60 * 60)));
      if (liveTo >= Date.now()) {
        return storage.twitterObserver[username];
      } else {
        return { ...storage.twitterObserver[username], expired: true };
      }
    }

    console2.trace('no cached user');
    return null;
  }

  function createUser(username, followers) {
    storage.twitterObserver[username] = {
      followers,
      fetchedAt: Date.now(),
    };
    pageState.twitterModified = true;
    return storage.twitterObserver[username];
  }

  function updateTwitterFollowers(user, linkHref) {
    console2.log('updateTwitterFollowers', user, linkHref);
    const linkHrefLow = linkHref.toLowerCase();
    const elems = [...document.querySelectorAll(`a`)].filter((e) =>
      e.href.toLowerCase().startsWith(linkHrefLow)
    );
    console2.trace('elems', elems);
    for (let elem of elems) {
      const followers = user.followers || 0;
      elem.dataset.hxFollowersNum = followers;
      elem.dataset.hxFollowers = kFormatter(followers);
      if (!user.expired) {
        elem.classList.toggle('twitter-link', true);
        elem.classList.toggle('twitter-link-expired', false);
      } else {
        elem.classList.toggle('twitter-link', false);
        elem.classList.toggle('twitter-link-expired', true);
      }
    }
    if (pageState.trimAlphabotWhiteSpace) {
      [...document.querySelectorAll('h5')].forEach((h) => (h.style.whiteSpace = 'normal'));
    }

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

  async function updateTwitter(baseUrl, myTabId) {
    let user = getCachedUserByURL(baseUrl, pageState.cacheTwitterHours);

    if (user && !user.expired) {
      updateTwitterFollowers(user, baseUrl);
      return false;
    }

    const url = `${baseUrl}#getProfile=true&id=${myTabId}&${createLogLevelArg()}`;
    console2.log('open url:', url);
    window.open(url);
    const profile = await waitForTwitterProfileResult();
    console2.log('profile', profile);
    if (!profile?.ok) {
      console2.warn('invalid profile');
      return false;
    }

    handleProfileResult(profile);

    return true;
  }

  function handleProfileResult(profile) {
    if (profile?.error) {
      return;
    }
    const user = createUser(profile.username, profile.follows);
    console2.trace('user:', user);
    updateTwitterFollowers(user, profile.url);
  }

  function getTwitter(username, cacheHours = null) {
    let user = getCachedUser(username, cacheHours || pageState.cacheTwitterHours);
    return user?.followers || null;
  }

  function saveTwitter() {
    if (!pageState.twitterModified) {
      console2.log('no modifications, skip save!');
      return;
    }
    console2.log('start saveStorage timeout...');
    if (pageState.saveTwitterTimeout) {
      clearTimeout(pageState.saveTwitterTimeout);
    }
    pageState.saveTwitterTimeout = setTimeout(function () {
      console2.log('do save storage!');
      setStorageData({ twitterObserver: storage.twitterObserver });
      pageState.twitterModified = false;
    }, 2000);
  }

  function getTwitterLinkElems(nodes) {
    const elems = [];
    for (const node of nodes) {
      if (node.nodeName !== 'DIV') {
        continue;
      }
      if (!node.querySelectorAll) {
        continue;
      }
      console2.trace('node:', node);
      const links = node.querySelectorAll('A[data-action="option-twitter"]');
      const link = links.length ? links[links.length - 1] : null;
      if (link) {
        console2.trace('nodename:', node.nodeName);
        elems.push(link);
      }
    }
    return elems;
  }

  // PROJECT -------------------------------------------------------------

  function getProject(slug) {
    let project = getCachedProject(slug, pageState.cacheProjectMins);
    return project;
  }

  function getProjectSlug(href) {
    if (typeof href !== 'string') {
      return '';
    }
    return new URL(href).pathname.replace('/', '');
  }

  function getCachedProject(slug, cacheMins) {
    console2.trace('getCachedProject; slug, cacheMins:', slug, cacheMins);
    if (!slug) {
      console2.log('Skip invalid slug!', slug);
      return null;
    }

    if (storage.projectObserver[slug] && storage.projectObserver[slug].fetchedAt) {
      const liveTo = storage.projectObserver[slug].fetchedAt + cacheMins * 60 * 1000;
      console2.trace('TTL (minutes):', slug, Math.round((liveTo - Date.now()) / (1000 * 60)));
      if (liveTo >= Date.now()) {
        console2.trace('cached result is alive', slug, storage.projectObserver[slug]);
        return storage.projectObserver[slug];
      } else {
        console2.trace('cached result has expired!');
        return { ...storage.projectObserver[slug], expired: true };
      }
    }

    console2.trace('no cached project');
    return null;
  }

  function createProject(slug, project) {
    console2.all('storage:', storage);
    storage.projectObserver[slug] = {
      ...project,
      fetchedAt: Date.now(),
    };
    pageState.projectsModified = true;
    return storage.projectObserver[slug];
  }

  function updateProject(slug, project) {
    console2.trace('updateProject', slug, project);
    createProject(slug, project);
    updateProjectDOM(slug);
  }

  function updateProjectDOM(slug) {
    const elems = [...document.querySelectorAll(`a`)].filter((e) => e.href.endsWith(slug));
    for (const elem of elems) {
      handleProjectLink(elem);
    }
  }

  function getAlphabotProjectLinkElems(nodes, lastOnly = true, skipNonDivs = true) {
    console2.trace('getProjectLinkElems, nodes:', nodes);
    const elems = [];
    for (const node of nodes) {
      if (skipNonDivs && node.nodeName !== 'DIV') {
        continue;
      }
      if (!node.querySelectorAll) {
        continue;
      }
      console2.all('node:', node);
      const links = getAllAlphabotProjectLinkElems(node);
      if (!links.length) {
        continue;
      }
      if (!lastOnly) {
        elems.push(...links);
      } else {
        elems.push(links[links.length - 1]);
      }
    }
    return elems;
  }

  function handleOdds(link) {
    const paragraphs = link.getElementsByTagName('p');
    if (!paragraphs.length) {
      console2.trace('No paragraphs items, skip!', paragraphs);
      return;
    }

    const slug = getProjectSlug(link.href);
    const project = getProject(slug);
    if (project) {
      const p = paragraphs[0];
      console2.trace('p', p);

      const odds = makeRaffleOdds(project.entryCount, project.winnerCount);
      console2.trace('odds', odds);

      p.dataset.hxRevealed = `${project.entryCount || '?'} / ${odds}%`;
      if (!project.expired) {
        p.classList.toggle('hx-revealed', true);
        p.classList.toggle('hx-revealed-expired', false);
      } else {
        p.classList.toggle('hx-revealed', false);
        p.classList.toggle('hx-revealed-expired', true);
      }

      /*
      document.documentElement.style.setProperty(
        '--raffle-odds-background-color',
        storage.options.RAFFLE_ODDS_BACKGROUND_COLOR
      );
      document.documentElement.style.setProperty('--raffle-odds-color', storage.options.RAFFLE_ODDS_COLOR);
      document.documentElement.style.setProperty(
        '--raffle-expired-odds-background-color',
        storage.options.RAFFLE_EXPIRED_ODDS_BACKGROUND_COLOR
      );
      document.documentElement.style.setProperty(
        '--raffle-expired-odds-color',
        storage.options.RAFFLE_EXPIRED_ODDS_COLOR
      );
      */
    }
  }

  function handleWins(link) {
    console2.trace('handleWins', link);

    const parent1 = link?.parentElement;
    const parent2 = parent1?.parentElement;
    console2.trace('parent1', parent1);
    console2.trace('parent2', parent2);

    const twitterLink = parent1.querySelector('a[data-action="option-twitter"]');
    console2.trace('twitterLink', twitterLink);

    if (parent2?.querySelector('.hx-already-won')) {
      console2.trace('alreadyWon info already shown, ignore!');
      return;
    }

    const raffleBox = parent1; //  parent2.querySelector('.MuiCardContent-root');
    console2.trace('raffleBox', raffleBox);

    if (!raffleBox) {
      console2.log('Parent elem is null, skip prev won section!');
      return;
    }

    const twitterHandle = extractTwitterHandle(twitterLink?.href);
    console2.trace('twitterHandle', twitterHandle);

    /*
    const div = createPreviousWonSection(twitterHandle, false);
    console2.trace('div', div);
    if (div) {
      raffleBox.append(div);
      document.documentElement.style.setProperty(
        '--raffle-wins-background-color',
        storage.options.RAFFLE_WINS_BACKGROUND_COLOR
      );
      document.documentElement.style.setProperty('--raffle-wins-color', storage.options.RAFFLE_WINS_COLOR);
    }
    */

    const div2 = createPreviousWonSection(twitterHandle, false);
    console2.trace('div2', div2);
    if (div2) {
      raffleBox.append(div2);
      document.documentElement.style.setProperty(
        '--raffle-wins-background-color',
        storage.options.RAFFLE_WINS_BACKGROUND_COLOR
      );
      document.documentElement.style.setProperty('--raffle-wins-color', storage.options.RAFFLE_WINS_COLOR);
    }
  }

  function getAllAlphabotProjectLinkElems(node) {
    return node.querySelectorAll('A[data-action="project-card-navigate-to"]');
  }

  function handleProjectLink(link) {
    console2.trace('handleProjectLink, link:', link);
    if (pageState.autoOdds) {
      handleOdds(link);
    }
    if (pageState.autoWins) {
      handleWins(link);
    }
  }

  function createPreviousWonSection(twitterHandle, showAll = false) {
    console2.log('createPreviousWonSection', twitterHandle, showAll);
    const walletsWon = getPreviousWalletsWon(twitterHandle);
    if (!walletsWon.length) {
      return null;
    }

    const hidden = ''; // todo pageState.permissions?.enabled ? '' : '[ PREMIUM FEATURE HIDDEN ]';
    console2.trace('hidden', hidden);

    const wallets = sortWallets(walletsWon, storage.options);
    const wallet = wallets[0];
    const walletAliasFirst = walletToAlias(wallet, storage.options);

    console2.trace('walletAliasFirst', walletAliasFirst);
    const walletAliasTextFirst = walletAliasFirst ? ` &nbsp;(${walletAliasFirst})` : '';
    let html = hidden || `${trimWallet(wallet)}${walletAliasTextFirst}`;
    if (wallets.length > 1) {
      html = `<span class='times-won'>[x${wallets.length}]</span> ` + html;
      if (showAll) {
        wallets.shift();
        for (const addr of wallets) {
          const walletAlias = walletToAlias(addr, storage.options);
          const walletAliasText = walletAlias ? ` (${walletAlias})` : '';
          const mintAddrText = hidden || `${trimWallet(addr)}${walletAliasText}`;
          html = html + `<br>${mintAddrText}`;
        }
      }
    }
    const div = document.createElement('div');
    div.classList.add('hx-already-won');
    div.innerHTML = html;
    const text = wallets
      .map((x) => {
        const walletAlias = walletToAlias(x, storage.options);
        const walletAliasText = walletAlias ? ` (${walletAlias})` : '';
        return `${trimWallet(x)}${walletAliasText}`;
      })
      .join('\n');
    div.title = `Wallets with previous wins:\n\n` + (hidden || text);

    return div;
  }

  function saveProjects() {
    if (!pageState.projectsModified) {
      console2.trace('no modifications, skip save!');
      return;
    }
    console2.log('start saveProjectStorage timeout...');
    if (pageState.saveProjectsTimeout) {
      clearTimeout(pageState.saveProjectsTimeout);
    }
    pageState.saveProjectsTimeout = setTimeout(function () {
      console2.log('do save projectStorage!');
      setStorageData({ projectObserver: storage.projectObserver });
      pageState.projectsModified = false;
    }, 2000);
  }

  return {
    getTwitter,
    updateTwitter,
    saveTwitter,
    updateProject,
    saveProjects,
    reloadStorage,
    createPreviousWonSection,
  };
}

// RAFFLES PAGE

function getRafflesPageWinElems(nodes) {
  console2.trace('getRafflesPageWinElems, nodes:', nodes);
  const elems = [];
  //console.log('nodes', nodes);
  for (const node of nodes) {
    if (!node.querySelectorAll) {
      continue;
    }
    const items = node.querySelectorAll('span.wins-id');
    if (!items.length) {
      continue;
    }
    elems.push(...items);
  }
  return elems;
}

function handleRafflesPageWin(elem) {
  console2.trace('handleRafflesPageWin', elem);

  const twitterHandle = elem.dataset.twitterHandle;
  console2.trace('twitterHandle', twitterHandle);

  const winMap = createPreviousWonMap(twitterHandle, false);
  console2.trace('winMap', winMap);

  if (!winMap.ok) {
    return;
  }

  elem.dataset.wins = winMap.wins;
  elem.classList.toggle('win', winMap.wins > 0);
  elem.title = winMap.title || 'error';
}

function createPreviousWonMap(twitterHandle, showAll = false) {
  console2.log('createPreviousWonMap', twitterHandle, showAll);
  const walletsWon = getPreviousWalletsWon(twitterHandle);
  if (!walletsWon.length) {
    return {};
  }

  const hidden = ''; // todo pageState.permissions?.enabled ? '' : '[ PREMIUM FEATURE HIDDEN ]';
  console2.trace('hidden', hidden);

  const wallets = sortWallets(walletsWon, storage.options);
  const wallet = wallets[0];
  const walletAliasFirst = walletToAlias(wallet, storage.options);

  console2.trace('walletAliasFirst', walletAliasFirst);
  const walletAliasTextFirst = walletAliasFirst ? ` (${walletAliasFirst})` : '';
  let htmltext = hidden || `${trimWallet(wallet)}${walletAliasTextFirst}`;
  if (wallets.length > 1) {
    htmltext = `[x${wallets.length}] ` + htmltext;
    if (showAll) {
      wallets.shift();
      for (const addr of wallets) {
        const walletAlias = walletToAlias(addr, storage.options);
        const walletAliasText = walletAlias ? ` (${walletAlias})` : '';
        const mintAddrText = hidden || `${trimWallet(addr)}${walletAliasText}`;
        htmltext = htmltext + `\n${mintAddrText}`;
      }
    }
  }

  const text = wallets
    .map((x) => {
      const walletAlias = walletToAlias(x, storage.options);
      const walletAliasText = walletAlias ? ` (${walletAlias})` : '';
      return `${trimWallet(x)}${walletAliasText}`;
    })
    .join('\n');
  const title = `Wallets with previous wins:\n\n` + (hidden || text);

  return { ok: true, htmltext, title, wins: walletsWon.length };
}

// HELPERS FUNCS ----------------------------------------------------------------------------------

/*
export function getPreviousWalletsWon(twitterHandle) {
  console2.trace('getPreviousWalletsWon:', twitterHandle);
  if (!twitterHandle || typeof twitterHandle !== 'string') {
    console2.trace('return []');
    return [];
  }

  const wallets = storage?.allProjectWins ? storage.allProjectWins[twitterHandle.toLowerCase()] || [] : [];

  if (wallets.length) {
    console2.info(`Previous won wallet for ${twitterHandle}:`, wallets);
  }

  return wallets;
}
*/

export function getPreviousWalletsWon(twitterHandle) {
  console2.trace('getPreviousWalletsWon:', twitterHandle);
  if (!twitterHandle || typeof twitterHandle !== 'string') {
    console2.trace('return []');
    return [];
  }

  const handleLow = twitterHandle.toLowerCase();
  console2.log('handleLow:', handleLow);

  if (!storage.allProjectWinsMap[handleLow]) {
    return [];
  }

  const wallets = noDuplicates(storage.allProjectWinsMap[handleLow].wallets.map((x) => x.wallet));
  console2.log('wallets:', wallets);
  if (wallets.length) {
    console2.info(`Previous won wallet for ${twitterHandle}:`, wallets);
  }

  return wallets;
}

function makeRaffleOdds(entries, winners) {
  if (typeof entries !== 'number') {
    return '?';
  }
  if (entries < 1) {
    return 100;
  }
  const pct = (winners / entries) * 100;
  if (pct < 1) {
    return round(pct, 2);
  } else {
    return round(pct, 0);
  }
}

async function reloadStorage() {
  storage = await loadStorage({
    keys: [
      'options',
      'twitterObserver',
      'projectObserver',
      'allProjectWins',
      'allProjectWins2',
      'allProjectWinsMap',
    ],
    ensure: [
      { key: 'twitterObserver', val: {} },
      { key: 'projectObserver', val: {} },
      { key: 'allProjectWins', val: {} },
      { key: 'allProjectWins2', val: {} },
      { key: 'allProjectWinsMap', val: {} },
    ],
  });
  console2.info('storage:', storage);
}
