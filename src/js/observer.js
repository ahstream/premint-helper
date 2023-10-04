import { trimMintAddress, walletToAlias, sortMintAddresses } from './premintHelperLib';
import {
  timestampToLocaleString,
  sleep,
  millisecondsAhead,
  round,
  kFormatter,
  extractTwitterHandle,
  ONE_DAY,
  noDuplicates,
  getStorageItems,
  setStorageData,
  createLogger,
  createLogLevelArg,
} from 'hx-lib';

const debug = createLogger();

// DATA ----------------------------------------------------------------------------------

let storage = null;

// MAIN FUNCS ----------------------------------------------------------------------------------

export async function createObserver({
  permissions,
  cacheTwitterHours,
  cacheProjectMins,
  trimAlphabotWhiteSpace,
  autoFollowers,
  autoOdds,
  autoWins,
} = {}) {
  debug.log('createObserver:', ...arguments);

  let pageState = {
    saveTwitterTimeout: null,
    saveProjectsTimeout: null,
    twitterModified: false,
    projectsModified: false,
    permissions,
  };

  await reloadStorage();

  if (!storage.twitterObserver) {
    storage.twitterObserver = {};
    pageState.twitterModified = true;
  }

  if (!storage.projectObserver) {
    storage.projectObserver = {};
    pageState.projectsModified = true;
  }
  debug.log('storage:', storage);

  if (pageState.projectsModified) {
    debug.log('save storage');
    await setStorageData(storage);
  }

  pageState.cacheTwitterHours =
    typeof cacheTwitterHours === 'undefined' ? storage.options.TWITTER_FOLLOWERS_CACHE_HOURS : cacheTwitterHours;
  pageState.cacheProjectMins = typeof cacheProjectMins === 'undefined' ? storage.options.RAFFLE_ODDS_CACHE_MINS : cacheProjectMins;
  pageState.trimAlphabotWhiteSpace =
    typeof trimAlphabotWhiteSpace === 'undefined' ? storage.options.RAFFLE_TRIM_WHITESPACE : trimAlphabotWhiteSpace;
  pageState.autoFollowers = typeof autoFollowers === 'undefined' ? storage.options.RAFLE_AUTO_SHOW_FOLLOWERS : autoFollowers;
  pageState.autoOdds = typeof autoOdds === 'undefined' ? storage.options.RAFLE_AUTO_SHOW_ODDS : autoOdds;
  pageState.autoWins = typeof autoWins === 'undefined' ? storage.options.RAFLE_AUTO_SHOW_WINS : autoWins;

  if (!pageState.autoFollowers && !pageState.autoOdds && !pageState.autoWins) {
    debug.log('No mutations needed');
    return;
  }

  const mutationObserver = new MutationObserver(mutationHandler);
  mutationObserver.observe(document, { attributes: true, childList: true, subtree: true });

  async function mutationHandler(mutationList) {
    for (const mutation of mutationList) {
      debug.trace('mutation:', mutation);
      if (!mutation?.addedNodes?.length) {
        continue;
      }

      if (pageState.autoFollowers) {
        if (mutation.target.nodeName === 'A' && mutation.target.href?.startsWith('https://twitter.com/')) {
          debug.trace('handle mutation:', mutation);
          handleTwitterLink(mutation.target);
          return;
        }
      }

      if (pageState.autoFollowers) {
        const twitterLinks = getTwitterLinkElems(mutation.addedNodes);
        for (const link of twitterLinks) {
          handleTwitterLink(link);
        }
      }

      if (pageState.autoOdds || pageState.autoWins) {
        const links = getProjectLinkElems(mutation.addedNodes);
        for (const link of links) {
          handleProjectLink(link);
        }
      }

      if (storage.options.ALPHABOT_OPEN_RAFFLE_LINKS_IN_NEW_TAB) {
        const allProjectLinks = getProjectLinkElems(mutation.addedNodes, false, false);
        for (const link of allProjectLinks) {
          link.target = '_blank';
        }
      }
    }
  }

  // EVENTS -------------------------------------------------------------

  chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    if (request.cmd === 'profileResult') {
      debug.log('Received profileResult');
      pageState.twitterProfileResult = request.profile;
    }

    if (request.cmd === 'profileResultMainLoop') {
      debug.log('Received profileResultMainLoop');
      handleProfileResult(request.profile);
      saveTwitter();
    }

    sendResponse();
    return true;
  });

  // TWITTER -------------------------------------------------------------

  function handleTwitterLink(link) {
    if (link.classList.contains('twitter-link')) {
      debug.trace('twitter link already processed');
      return;
    }

    if (link.dataset && link.dataset.hxDisabled) {
      debug.trace('Target mutation observer disabled, skip!');
      return;
    }

    const user = getCachedUserByURL(link.href, pageState.cacheTwitterHours);
    debug.trace('user', user);
    if (user) {
      updateTwitterFollowers(user, link.href);
    }
  }

  function getCachedUserByURL(url, cacheHours) {
    return getCachedUser(extractTwitterHandle(url), cacheHours);
  }

  function getCachedUser(username, cacheHours) {
    debug.trace('getCachedUser, username:', username);
    if (!username) {
      debug.trace('Skip invalid username!');
      return null;
    }

    if (storage.twitterObserver[username] && storage.twitterObserver[username].fetchedAt) {
      const liveTo = storage.twitterObserver[username].fetchedAt + cacheHours * 60 * 60 * 1000;
      debug.trace('TTL (hours):', Math.round((liveTo - Date.now()) / (1000 * 60 * 60)));
      if (liveTo >= Date.now()) {
        return storage.twitterObserver[username];
      } else {
        return { ...storage.twitterObserver[username], expired: true };
      }
    }

    debug.trace('no cached user');
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
    debug.log('updateTwitterFollowers', user, linkHref);
    const linkHrefLow = linkHref.toLowerCase();
    const elems = [...document.querySelectorAll(`a`)].filter((e) => e.href.toLowerCase().startsWith(linkHrefLow));
    debug.log('elems', elems);
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

    document.documentElement.style.setProperty('--raffle-followers-background-color', storage.options.RAFFLE_FOLLOWERS_BACKGROUND_COLOR);
    document.documentElement.style.setProperty('--raffle-followers-color', storage.options.RAFFLE_FOLLOWERS_COLOR);
    document.documentElement.style.setProperty(
      '--raffle-expired-followers-background-color',
      storage.options.RAFFLE_EXPIRED_FOLLOWERS_BACKGROUND_COLOR
    );
    document.documentElement.style.setProperty('--raffle-expired-followers-color', storage.options.RAFFLE_EXPIRED_FOLLOWERS_COLOR);
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
    debug.log('open url:', url);
    window.open(url);
    const profile = await waitForTwitterProfileResult();
    debug.log('profile', profile);
    if (!profile?.ok) {
      console.warn('invalid profile');
      return true;
    }

    handleProfileResult(profile);

    return true;
  }

  function handleProfileResult(profile) {
    if (profile?.error) {
      return;
    }
    const user = createUser(profile.username, profile.follows);
    debug.log('user:', user);
    updateTwitterFollowers(user, profile.url);
  }

  function getTwitter(username, cacheHours = null) {
    let user = getCachedUser(username, cacheHours || pageState.cacheTwitterHours);
    return user?.followers || null;
  }

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

  function getTwitterLinkElems(nodes) {
    const elems = [];
    for (const node of nodes) {
      if (node.nodeName !== 'DIV') {
        continue;
      }
      if (!node.querySelectorAll) {
        continue;
      }
      debug.trace('node:', node);
      const links = node.querySelectorAll('A[data-action="option-twitter"]');
      const link = links.length ? links[links.length - 1] : null;
      if (link) {
        debug.trace('nodename:', node.nodeName);
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
    debug.trace('getCachedProject; slug, cacheMins:', slug, cacheMins);
    if (!slug) {
      debug.log('Skip invalid slug!');
      return null;
    }

    if (storage.projectObserver[slug] && storage.projectObserver[slug].fetchedAt) {
      const liveTo = storage.projectObserver[slug].fetchedAt + cacheMins * 60 * 1000;
      debug.trace('TTL (minutes):', Math.round((liveTo - Date.now()) / (1000 * 60)));
      if (liveTo >= Date.now()) {
        debug.trace('cached result is alive', slug, storage.projectObserver[slug]);
        return storage.projectObserver[slug];
      } else {
        debug.trace('cached result has expired!');
        return { ...storage.projectObserver[slug], expired: true };
      }
    }

    debug.trace('no cached project');
    return null;
  }

  function createProject(slug, project) {
    debug.log('storage:', storage);
    storage.projectObserver[slug] = {
      ...project,
      fetchedAt: Date.now(),
    };
    pageState.projectsModified = true;
    return storage.projectObserver[slug];
  }

  function updateProject(slug, project) {
    debug.trace('updateProject', slug, project);
    createProject(slug, project);
    updateProjectDOM(slug);
  }

  function updateProjectDOM(slug) {
    const elems = [...document.querySelectorAll(`a`)].filter((e) => e.href.endsWith(slug));
    for (const elem of elems) {
      handleProjectLink(elem);
    }
  }

  function getProjectLinkElems(nodes, lastOnly = true, skipNonDivs = true) {
    debug.trace('getProjectLinkElems, nodes:', nodes);
    const elems = [];
    for (const node of nodes) {
      if (skipNonDivs && node.nodeName !== 'DIV') {
        continue;
      }
      if (!node.querySelectorAll) {
        continue;
      }
      debug.trace('node:', node);
      const links = getAllProjectLinkElems(node);
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
      debug.trace('No paragraphs items, skip!', paragraphs);
      return;
    }

    const slug = getProjectSlug(link.href);
    const project = getProject(slug);
    if (project) {
      const p = paragraphs[0];
      debug.trace('p', p);

      const odds = makeRaffleOdds(project.entryCount, project.winnerCount);
      debug.trace('odds', odds);

      p.dataset.hxRevealed = `${project.entryCount || '?'} / ${odds}%`;
      if (!project.expired) {
        p.classList.toggle('hx-revealed', true);
        p.classList.toggle('hx-revealed-expired', false);
      } else {
        p.classList.toggle('hx-revealed', false);
        p.classList.toggle('hx-revealed-expired', true);
      }

      document.documentElement.style.setProperty('--raffle-odds-background-color', storage.options.RAFFLE_ODDS_BACKGROUND_COLOR);
      document.documentElement.style.setProperty('--raffle-odds-color', storage.options.RAFFLE_ODDS_COLOR);
      document.documentElement.style.setProperty(
        '--raffle-expired-odds-background-color',
        storage.options.RAFFLE_EXPIRED_ODDS_BACKGROUND_COLOR
      );
      document.documentElement.style.setProperty('--raffle-expired-odds-color', storage.options.RAFFLE_EXPIRED_ODDS_COLOR);
    }
  }

  function handleWins(link) {
    const parent1 = link?.parentElement;
    const parent2 = parent1?.parentElement;
    const parent3 = parent2?.parentElement;

    const twitterLink = parent3.querySelector('a[data-action="option-twitter"]');
    debug.trace('twitterLink', twitterLink);

    const twitterHandle = extractTwitterHandle(twitterLink?.href);
    const raffleBox = parent2; //  parent2.querySelector('.MuiCardContent-root');

    if (parent3?.querySelector('.hx-already-won')) {
      debug.log('alreadyWon info already shown, ignore!');
      return;
    }

    if (!raffleBox) {
      debug.log('Parent elem is null, skip prev won section!');
      return;
    }

    const div = createPreviousWonSection(twitterHandle, false, pageState.permissions);
    if (div) {
      raffleBox.after(div);
      document.documentElement.style.setProperty('--raffle-wins-background-color', storage.options.RAFFLE_WINS_BACKGROUND_COLOR);
      document.documentElement.style.setProperty('--raffle-wins-color', storage.options.RAFFLE_WINS_COLOR);
    }
  }

  function getAllProjectLinkElems(node) {
    return node.querySelectorAll('A[data-action="project-card-navigate-to"]');
  }

  function handleProjectLink(link) {
    if (pageState.autoOdds) {
      handleOdds(link);
    }
    if (pageState.autoWins) {
      handleWins(link);
    }
  }

  function createPreviousWonSection(twitterHandle, showAll = false, permissions = null) {
    const walletsWon = getPreviousWalletsWon(twitterHandle);
    if (!walletsWon.length) {
      return null;
    }

    const hidden = permissions?.enabled ? '' : '[ PREMIUM FEATURE HIDDEN ]';

    const mintAddresses = sortMintAddresses(walletsWon, storage.options);
    const mintAddress = mintAddresses[0];
    const walletAliasFirst = walletToAlias(mintAddress, storage.options);

    debug.log('walletAliasFirst', walletAliasFirst);
    const walletAliasTextFirst = walletAliasFirst ? ` &nbsp;(${walletAliasFirst})` : '';
    let html = hidden || `${trimMintAddress(mintAddress)}${walletAliasTextFirst}`;
    if (mintAddresses.length > 1) {
      html = `<span class='times-won'>[x${mintAddresses.length}]</span> ` + html;
      if (showAll) {
        mintAddresses.shift();
        for (const addr of mintAddresses) {
          const walletAlias = walletToAlias(addr, storage.options);
          const walletAliasText = walletAlias ? ` (${walletAlias})` : '';
          const mintAddrText = hidden || `${trimMintAddress(addr)}${walletAliasText}`;
          html = html + `<br>${mintAddrText}`;
        }
      }
    }
    const div = document.createElement('div');
    div.classList.add('hx-already-won');
    div.innerHTML = html;
    const text = mintAddresses
      .map((x) => {
        const walletAlias = walletToAlias(x, storage.options);
        const walletAliasText = walletAlias ? ` (${walletAlias})` : '';
        return `${trimMintAddress(x)}${walletAliasText}`;
      })
      .join('\n');
    div.title = `Wallets with previous wins:\n\n` + (hidden || text);

    return div;
  }

  function saveProjects() {
    if (!pageState.projectsModified) {
      debug.log('no modifications, skip save!');
      return;
    }
    debug.log('start saveProjectStorage timeout...');
    if (pageState.saveProjectsTimeout) {
      clearTimeout(pageState.saveProjectsTimeout);
    }
    pageState.saveProjectsTimeout = setTimeout(function () {
      debug.log('do save projectStorage!');
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

// HELPERS FUNCS ----------------------------------------------------------------------------------

function getPreviousWalletsWon(twitterHandle) {
  const elem = storage?.alphabotProjectWinners?.length ? storage.alphabotProjectWinners.find((x) => x.name === twitterHandle) : null;
  if (!elem) {
    return [];
  }
  debug.log('getPreviousWalletsWon; elem:', elem);

  const minMintDate = millisecondsAhead(-(storage.options.ALPHABOT_PREV_WINS_LIFETIME_MINT_DAYS * ONE_DAY));
  const minPickedDate = millisecondsAhead(-(storage.options.ALPHABOT_PREV_WINS_LIFETIME_PICKED_DAYS * ONE_DAY));

  debug.log(
    'getPreviousWalletsWon minMintDate:',
    minMintDate,
    storage.options.ALPHABOT_PREV_WINS_LIFETIME_MINT_DAYS,
    timestampToLocaleString(minMintDate)
  );
  debug.log(
    'getPreviousWalletsWon minPickedDate:',
    minPickedDate,
    storage.options.ALPHABOT_PREV_WINS_LIFETIME_PICKED_DAYS,
    timestampToLocaleString(minPickedDate)
  );

  const wallets = elem.winners
    .filter((winner) => {
      if (winner.mintDate) {
        if (winner.mintDate >= minMintDate) {
          debug.log('getPreviousWalletsWonmintDate still valid, keep:', winner);
          return true;
        }
        debug.log('getPreviousWalletsWonmintDate too early:', winner);
      }
      return winner.picked >= minPickedDate;
    })
    .map((x) => x.mintAddress);
  debug.log('getPreviousWalletsWonwallets', wallets);

  const noDupsWallets = noDuplicates(wallets.map((x) => x.toLowerCase()));
  debug.log('getPreviousWalletsWonnoDupsWallets', noDupsWallets);

  return noDupsWallets;
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

async function reloadStorage(key = null) {
  if (!key) {
    storage = await getStorageItems(['options', 'twitterObserver', 'projectObserver', 'alphabotProjectWinners']);
  } else {
    const storageTemp = await getStorageItems([key]);
    storage[key] = storageTemp[key];
  }
  debug.log('reloadStorage:', storage);
}
