console.info('premintPage.js begin', window?.location?.href);

import '../styles/premintPage.css';
import {
  JOIN_BUTTON_TEXT,
  JOIN_BUTTON_IN_PROGRESS_TEXT,
  JOIN_BUTTON_TITLE,
  STATUSBAR_DEFAULT_TEXT,
  createStatusbarButtons,
  exitActionMain,
  getMyTabIdFromExtension,
  makeTwitterFollowIntentUrl,
} from './premintHelperLib';
import { createHistory } from './history';
import {
  getStorageItems,
  setStorageData,
  sleep,
  createHashArgs,
  waitForSelector,
  millisecondsAhead,
  noDuplicates,
  addToDate,
  getLastTokenizedItem,
  getSearchParam,
  ONE_SECOND,
  ONE_MINUTE,
  dispatch,
  normalizePendingLink,
  createLogger,
  createLogLevelArg,
} from '@ahstream/hx-lib';
import { createStatusbar } from '@ahstream/hx-statusbar';

const debug = createLogger();

// DATA ----------------------------------------------------------------------------------

let storage = null;

let pageState = {
  parentTabId: null,
  storageModified: false,
  action: '',
  pendingRequests: [],
  statusbar: null,
  history: null,
  lastURL: '',
  observer: null,
};

// STARTUP ----------------------------------------------------------------------------

runNow();

async function runNow() {
  storage = await getStorageItems(['runtime', 'options', 'pendingPremintReg']);
  debug.log('storage', storage);

  if (!storage?.options) {
    debug.info('Options missing, exit!');
    return;
  }

  if (!storage.options.PREMINT_ENABLE) {
    debug.info('Disabled, exit!');
    return;
  }

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
      history: await createHistory(),
      lastURL: window.location.href,
      finishedTabsIds: [],
    },
  };

  debug.log('pageState', pageState);

  showPage();
}

// EVENT HANDLERS ----------------------------------------------------------------------------------

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  debug.log('Received message:', request, sender);

  if (request.cmd === 'switchedToTwitterUser') {
    if (request.error) {
      pageState.abort = true;
      updateStatusbarError(`Cannot switch to Twitter user ${request.user}! Error msg: ${request.error}`);
      exitAction('abort');
    }
  }

  if (request.cmd === 'finish') {
    finish(request);
  }

  if (request.cmd === 'getMyTabIdAsyncResponse') {
    pageState.myTabId = request.response;
  }

  sendResponse();
  return true;
});

// PAGE FUNCS ----------------------------------------------------------------------------------

async function showPage(runPage = false) {
  debug.log('showPage; runPage, pageState:', runPage, pageState);

  if (!pageState.action) {
    const request = await dispatch(window.location.href, 300);
    debug.log('dispatched request:', request);
    pageState.request = request;
    pageState.action = request?.action;
  }

  if (pageState.action === 'shortcut') {
    pageState.isAutoStarted = true;
  }

  await showRafflePage(runPage || pageState.action === 'shortcut');
}

// RAFFLE FUNCS -----------------------------------------------------------------------------------------

async function showRafflePage(runPage) {
  debug.log('showRafflePage', runPage);

  if (!storage.options.PREMINT_ENABLE) {
    return exitAction('premintDisabled');
  }

  pageState.statusbar.buttons(
    createStatusbarButtons({
      options: true,
      results: true,
      reveal: 'disabled',
      followers: 'disabled',
    })
  );

  await waitForRafflePageLoaded();

  loadPageWithCustomContent();

  if (hasRegistered()) {
    return exitAction('registered');
  }

  if (isPendingReg()) {
    await waitForRegistered();
  }

  await addQuickRegButton();

  if (await handleErrors()) {
    return;
  }

  waitForRegisteredMainLoop();

  if (runPage) {
    runRafflePage();
  }
}

async function waitForRafflePageLoaded() {
  // skip waiting for dom elemetns for now, perhaps need to in future?!
  return true;
}

async function runRafflePage() {
  debug.log('runRafflePage');

  const triggerElem = await waitForSelector(storage.options.PREMINT_MAIN_REGION_SEL, 10 * ONE_SECOND, 50);
  debug.log('runRafflePage; triggerElem:', triggerElem);
  if (!triggerElem) {
    return exitAction('noRaffleTrigger');
  }

  await sleep(100);

  joinRaffle();
}

async function joinRaffle() {
  debug.log('joinRaffle');

  updateStatusbarRunning('Fulfilling raffle tasks...');
  startQuickRegBtn();

  const reqs = getRequirements();
  debug.log('reqs', reqs);

  const discordLinks = storage.options.RAFFLE_SKIP_DONE_TASKS
    ? await removeDoneLinks(reqs.discordUser, reqs.discordLinks)
    : reqs.discordLinks;
  const twitterLinks = storage.options.RAFFLE_SKIP_DONE_TASKS
    ? await removeDoneLinks(reqs.twitterUser, reqs.twitterLinks)
    : reqs.twitterLinks;

  const reqLinks = [...discordLinks, ...twitterLinks];
  debug.log('reqLinks', reqLinks);

  if (discordLinks.length) {
    storage.runtime.pendingDiscordJoin = JSON.stringify(new Date());
    await setStorageData(storage);
  }

  await getMyTabIdFromExtension(pageState, 5000);
  if (!pageState.myTabId) {
    console.error('Invalid myTabId');
    updateStatusbarError(`Failed getting own page tab id! Reload page and try again.`);
    return;
  }

  reqLinks.forEach((link) => pageState.pendingRequests.push(normalizePendingLink(link)));
  debug.log('pageState.pendingRequests:', pageState.pendingRequests);

  for (let i = 0; i < reqLinks.length; i++) {
    const reqLink = reqLinks[i];
    const url =
      reqLink +
      `#id=${pageState.myTabId}&user=${storage.options.RAFFLE_SWITCH_TWITTER_USER ? reqs.twitterUser : ''}&${createLogLevelArg()}`;
    debug.log('Open URL:', url);

    const isTwitter = reqLink.includes('twitter.com');
    const user = isTwitter ? reqs.twitterUser : reqs.discordUser;

    await pageState.history.add(user, reqLink);

    if (storage.options.PREMINT_OPEN_IN_FOREGROUND) {
      window.open(url, '_blank');
    } else {
      chrome.runtime.sendMessage({ cmd: 'openTab', url });
    }
    if (i + 1 < reqLinks.length) {
      const delayMs = Math.round(
        isTwitter ? storage.options.RAFFLE_OPEN_TWITTER_LINK_DELAY : storage.options.RAFFLE_OPEN_TWITTER_LINK_DELAY / 2
      );
      await sleep(delayMs, null, 0.2);
    }
  }

  await pageState.history.save();

  await sleep(50, 100);

  if (reqLinks.length === 0) {
    return registerRaffle();
  }

  waitForRegistered();
}

// REGISTER ----------------------------------------------------------------------------------

async function registerRaffle() {
  debug.info('Register raffle');

  pageState.pause = false;

  updateStatusbarRunning('Joining raffle...');
  chrome.runtime.sendMessage({ cmd: 'focusMyTab' });

  const regBtn = await getRegisterButton();
  if (!regBtn) {
    return exitAction('noRaffleRegisterBtn');
  }
  debug.log('registerRaffle; regBtn:', regBtn);

  if (hasCaptcha()) {
    return exitAction('raffleCaptcha');
  }

  if (regBtn && !regBtn.disabled) {
    await setPendingReg();
    debug.log('Click register button:', regBtn);
    regBtn.click();
    pageState.isRegistering = true;
  }

  await waitForRegistered();
}

async function waitForRegistered(maxWait = 1 * ONE_MINUTE, interval = 100) {
  debug.info('Wait for registered...');

  const stopTime = millisecondsAhead(maxWait);

  while (Date.now() <= stopTime) {
    if (await handleErrors()) {
      return;
    }

    if (hasCaptcha()) {
      return exitAction('raffleCaptcha');
    }

    if (hasRegistered()) {
      return exitAction('registered');
    }

    await sleep(interval);
  }

  if (!pageState.pause) {
    exitAction('notRegisterProperly');
  }
  pageState.pause = false;

  debug.log('Stop waiting for registered!');
}

async function waitForRegisteredMainLoop(maxWait = 300 * ONE_MINUTE, interval = 1000) {
  debug.log('Wait for registered main loop...');

  const stopTime = millisecondsAhead(maxWait);

  while (Date.now() <= stopTime) {
    if (hasRegistered()) {
      return exitAction('registered');
    }
    if (hasCaptcha()) {
      if (!pageState.hasReportedCaptchaPresence) {
        pageState.hasReportedCaptchaPresence = true;
        exitAction('raffleCaptcha');
      }
    }
    await sleep(interval);
  }

  debug.log('Stop waiting for registered in main loop');
}

async function handleErrors() {
  const errors = getErrors();
  if (errors?.length) {
    await sleep(1000);
    debug.log('Has errors:', errors);
    if (hasCaptcha()) {
      exitAction('raffleCaptcha');
      return true;
    }
    exitAction('unspecifiedRaffleError');
    return true;
  }
  return false;
}

async function getRegisterButton(maxWait = 1000, interval = 10) {
  return await waitForSelector(storage.options.PREMINT_REG_BTN_SEL, maxWait, interval);
}

// FINISH ----------------------------------------------------------------------------------

async function finish(request) {
  debug.log('finish; request:', request);

  if (pageState.abort) {
    return exitAction('abort');
  }
  if (request.status === 'captcha') {
    return exitAction('discordCaptcha');
  }

  pageState.finishedTabsIds.push(request.senderTabId);

  const normalizedUrl = normalizePendingLink(request.url);
  const prevLength = pageState.pendingRequests.length;

  debug.log('finish; url:', request.url);
  debug.log('finish; normalizedUrl:', normalizedUrl);

  debug.log('finish; pendingRequests A:', pageState.pendingRequests.length, pageState.pendingRequests);
  pageState.pendingRequests = pageState.pendingRequests.filter((item) => item !== normalizedUrl);
  debug.log('finish; pendingRequests B:', pageState.pendingRequests.length, pageState.pendingRequests);

  if (pageState.pendingRequests.length === 0 && prevLength > 0 && storage.options.RAFFLE_CLOSE_TASKS_BEFORE_JOIN) {
    debug.log('Finished all required links, register raffle!');
    await sleep(request.delay ?? 500);
    chrome.runtime.sendMessage({ cmd: 'closeTabs', tabIds: pageState.finishedTabsIds });
    return registerRaffle();
  }

  debug.log('Not all required links finished yet! Still left:', pageState.pendingRequests);

  if (pageState.hasDiscordCaptcha) {
    debug.log('Discord captcha present, focus raffle tab!');
    chrome.runtime.sendMessage({ cmd: 'focusMyTab' });
  }
}

// EXIT ACTIONS -------------------------------------------------------------------

function exitAction(result, options = {}) {
  const context = {
    updateStatusbar,
    updateStatusbarError,
    updateStatusbarInfo,
    updateStatusbarOk,
    removeQuickRegBtn,
    resetQuickRegBtn,
    pageState,
    options: storage.options,
  };
  exitActionMain(result, context, options);
}

// RAFFLE STATE CHECKERS -------------------------------------------------------------------

function hasRegistered() {
  return document.body.innerHTML.match(/<i class="fas fa-check-circle text-success mr-2"><\/i>Registered/i);
}

function hasCaptcha() {
  // document.querySelector('.recaptcha-checkbox-checked')
  // document.querySelector('.recaptcha-checkbox-borderAnimation')
  // const elem = document.querySelector('iframe[title="reCAPTCHA"]');
  const elem = document.querySelector('iframe[src*="hcaptcha.com"]');
  return elem && typeof elem?.disabled === 'boolean' && elem.disabled === false;
}

function getErrors() {
  const elems = [...document.querySelectorAll('.alert-danger')];
  if (elems?.length) {
    return ['unspecifiedRaffleError'];
  }
  return [];
}

// GUI -----------------------------------------------------------------------------------------

async function addQuickRegButton() {
  debug.log('addQuickRegButton');

  const quickRegBtn = getQuickRegBtn();
  debug.log('quickRegBtn', quickRegBtn);

  if (quickRegBtn) {
    return debug.log('quickRegBtn already present, do nothing');
  }

  const regBtn = await getRegisterButton();
  if (!regBtn) {
    return;
  }
  debug.log('regBtn', regBtn);

  const regDiv = regBtn.parentElement;
  debug.log('regDiv', regDiv);

  const btn = document.createElement('button');
  btn.id = 'ph-quick-reg';
  btn.innerHTML = JOIN_BUTTON_TEXT;
  btn.title = JOIN_BUTTON_TITLE;
  btn.className = 'btn btn-styled btn-success btn-shadow btn-xl btn-block premintButton';
  btn.addEventListener('click', quickRegClickHandler);

  regBtn.before(btn);
}

function getQuickRegBtn() {
  return document.querySelector('[id="ph-quick-reg"]');
}

function setQuickRegButton(text, className = null) {
  const btn = getQuickRegBtn();
  if (btn) {
    btn.innerHTML = text;
  }
  if (btn && className) {
    btn.classList.add(className);
  }
}

function resetQuickRegBtn() {
  const btn = getQuickRegBtn();
  if (btn) {
    setQuickRegButton(JOIN_BUTTON_TEXT);
    btn.disabled = false;
  }
}

function removeQuickRegBtn() {
  const btn = getQuickRegBtn();
  if (btn) {
    btn.remove();
  }
}

function startQuickRegBtn() {
  const btn = getQuickRegBtn();
  if (btn) {
    setQuickRegButton(JOIN_BUTTON_IN_PROGRESS_TEXT);
    btn.disabled = true;
  }
}

function quickRegClickHandler(event) {
  event.preventDefault();
  event.stopImmediatePropagation();
  joinRaffle();
}

// RAFFLE LINKS ----------------------------------------------------------------------------------

function getRequirements() {
  const twitterUser = getTwitterUser();
  const discordUser = getDiscordUser();

  const mustFollowLinks = getMustFollowLinks();
  const mustLikeLinks = getMustLikeLinks();
  const mustRetweetLinks = getMustRetweetLinks();
  const mustLikeAndRetweetLinks = getMustLikeAndRetweetLinks();
  const mustJoinLinks = getMustJoinLinks();

  const twitterLinks = noDuplicates(mustFollowLinks, mustLikeLinks, mustRetweetLinks, mustLikeAndRetweetLinks);
  const discordLinks = noDuplicates(mustJoinLinks);

  const result = {
    twitterUser,
    discordUser,
    mustFollowLinks,
    mustLikeLinks,
    mustRetweetLinks,
    mustLikeAndRetweetLinks,
    mustJoinLinks,
    twitterLinks,
    discordLinks,
    links: [...twitterLinks, ...discordLinks],
  };

  return result;
}

function getMustFollowLinks() {
  return parseMustFollowLinks().map((x) => makeTwitterFollowIntentUrl(x));
}

function getMustLikeAndRetweetLinks() {
  const links = parseMustLikeAndRetweetLinks();
  return [...links.map((x) => makeTwitterLikeIntentUrl(x)), ...links.map((x) => makeTwitterRetweetIntentUrl(x))];
}

function getMustRetweetLinks() {
  return parseMustRetweetLinks().map((x) => makeTwitterRetweetIntentUrl(x));
}

function getMustLikeLinks() {
  return parseMustLikeLinks().map((x) => makeTwitterLikeIntentUrl(x));
}

function getMustJoinLinks() {
  return parseMustJoinLinks();
}

function parseMustLikeLinks() {
  return parseTwitterLinks(storage.options.PREMINT_MUST_LIKE_SEL);
}

function parseMustRetweetLinks() {
  return parseTwitterLinks(storage.options.PREMINT_MUST_RETWEET_SEL);
}

function parseMustLikeAndRetweetLinks() {
  return parseTwitterLinks(storage.options.PREMINT_MUST_LIKE_AND_RETWEET_SEL);
}

function parseMustFollowLinks() {
  return parseTwitterLinks(storage.options.PREMINT_MUST_FOLLOW_SEL);
}

function parseTwitterLinks(prefix) {
  try {
    debug.log('parseTwitterLinks; prefix', prefix);
    const baseElem = document.querySelector('#step-twitter');
    if (!baseElem) {
      return [];
    }
    const baseElems = baseElem.querySelectorAll('div[class*="text-md"]');
    debug.log('baseElems', baseElems);
    if (!baseElems?.length) {
      return [];
    }
    const elems = [...baseElems].filter((e) => e.innerText.toLowerCase().trim().startsWith(prefix));
    debug.log('elems', elems);
    const arr = elems.length < 1 ? [] : Array.from(elems[0].getElementsByTagName('a')).map((a) => a.href);
    debug.log('arr', arr);
    return noDuplicates(arr);
  } catch (e) {
    console.error('Failed parsing twitter links. Error:', e);
    return [];
  }
}

function parseMustJoinLinks() {
  /*
  return [...document.querySelectorAll('p.MuiTypography-root')]
    .filter((e) => e.innerText.toLowerCase().includes('join') && e.innerText.toLowerCase().includes('discord'))
    .map((e) => e.getElementsByTagName('a'))
    .map((e) => Array.from(e))
    .flat()
    .map((e) => e.href);
    */
  debug.log('parseMustJoinLinks');
  const selectors = storage.options.PREMINT_JOIN_DISCORD_SEL;
  const allElems = [...document.querySelectorAll(selectors[0])].filter(
    (el) => el.textContent.trim().toLowerCase().startsWith(selectors[1]) && el.textContent.trim().toLowerCase().includes(selectors[2])
  );
  debug.log('selectors', selectors);
  debug.log('allElems', allElems);
  debug.log('allElems[0]', allElems[0]);
  const validElems = allElems.length ? [allElems[0].querySelector(selectors[3])] : [];
  debug.log('validElems', validElems);
  const links = validElems.filter((e) => !!e).map((x) => x.href);
  debug.log('links', links);
  return links;
}

async function removeDoneLinks(user, links) {
  const validLinks = [];
  for (const link of links) {
    if (await pageState.history.has(user, link)) {
      continue;
    }
    validLinks.push(link);
  }
  return validLinks;
}

// HELPERS ---------------------------------------------------------------------------------------------------

// PENDING REG ----------------------------------------------------------------------------------

async function setPendingReg() {
  const url = normalizePendingLink(window.location.href);
  storage.pendingPremintReg[url] = JSON.stringify(new Date());
  debug.log('storage.pendingPremintReg set:', storage.pendingPremintReg, url);
  await setStorageData({ pendingPremintReg: storage.pendingPremintReg });
}

function isPendingReg() {
  debug.log('isPendingReg');
  const url = normalizePendingLink(window.location.href);
  if (!storage.pendingPremintReg[url]) {
    debug.log('No pending register!');
    return false;
  }
  const pendingDate = new Date(JSON.parse(storage.pendingPremintReg[url]));
  const toDate = addToDate(pendingDate, { seconds: storage.options.PREMINT_PENDING_REG_FOR_SECS });
  const nowDate = new Date();
  const isPending = toDate > nowDate;

  debug.log('pendingDate, toDate, nowDate, isPending:', pendingDate, toDate, nowDate, isPending);

  if (!isPending) {
    delete storage.pendingPremintReg[url];
    setStorageData({ pendingPremintReg: storage.pendingPremintReg });
  }

  return isPending;
}

// CUSTOM CONTENT ----------------------------------------------------------------------------------

async function loadPageWithCustomContent() {
  debug.log('loadPageWithCustomContent...');
  if (!storage.options.PREMINT_ENABLE) {
    debug.log('Premint automation disabled, do nothing!');
    return;
  }
  fillPremintCustomField();
}

function fillPremintCustomField() {
  debug.log('fillPremintCustomField');

  const premintData = getPremintData();

  if (premintData.customFieldText) {
    // This one need to be first since it should override all others!
    return setPremintCustomField(premintData.customFieldText);
  }

  if (premintData.customFieldIsEmail && storage.options.USER_INFO_EMAIL_ADDRESS) {
    return setPremintCustomField(storage.options.USER_INFO_EMAIL_ADDRESS);
  }

  if (premintData.customFieldIsTwitter && storage.options.USER_INFO_TWITTER_ALIAS) {
    return setPremintCustomField(storage.options.USER_INFO_TWITTER_ALIAS);
  }

  if (premintData.customFieldIsDiscord && storage.options.USER_INFO_DISCORD_ALIAS) {
    return setPremintCustomField(storage.options.USER_INFO_DISCORD_ALIAS);
  }

  if (premintData.customFieldIsEthWallet && storage.options.USER_INFO_ETH_WALLET) {
    return setPremintCustomField(storage.options.USER_INFO_ETH_WALLET);
  }

  if (premintData.customFieldIsSolWallet && storage.options.USER_INFO_SOL_WALLET) {
    return setPremintCustomField(storage.options.USER_INFO_SOL_WALLET);
  }

  if (premintData.customFieldIsTezWallet && storage.options.USER_INFO_TEZ_WALLET) {
    return setPremintCustomField(storage.options.USER_INFO_TEZ_WALLET);
  }

  if (premintData.customFieldIsBtcWallet && storage.options.USER_INFO_BTC_WALLET) {
    return setPremintCustomField(storage.options.USER_INFO_BTC_WALLET);
  }
}

function getPremintData() {
  let customFieldText = storage.runtime?.customFieldText;
  if (!customFieldText) {
    // If custom field value is not already set, use value found on premint page!
    customFieldText = document.querySelector(storage.options.PREMINT_CUSTOM_FIELD_SEL)?.value ?? '';
  }
  const customFieldProperties = getPremintCustomFieldProperties();
  debug.log('customFieldProperties', customFieldProperties);
  return { customFieldText, ...customFieldProperties };
}

function getPremintCustomFieldProperties() {
  const customFieldLabel = document.querySelector(storage.options.PREMINT_CUSTOM_FIELD_LABEL_SEL)?.textContent.trim();
  debug.log('customFieldLabel', customFieldLabel);
  if (customFieldLabel) {
    return {
      customFieldLabel: customFieldLabel,
      customFieldIsRetweetLink: customFieldLabel.search(new RegExp(storage.options.PREMINT_RETWEET_RE, 'i')) > -1,
      customFieldIsEmail: customFieldLabel.search(new RegExp(storage.options.PREMINT_EMAIL_RE, 'i')) > -1,
      customFieldIsTwitter: customFieldLabel.search(new RegExp(storage.options.PREMINT_TWITTER_RE, 'i')) > -1,
      customFieldIsDiscord: customFieldLabel.search(new RegExp(storage.options.PREMINT_DISCORD_RE, 'i')) > -1,
      customFieldIsSolWallet: customFieldLabel.search(new RegExp(storage.options.PREMINT_SOL_WALLET_RE, 'i')) > -1,
      customFieldIsEthWallet: customFieldLabel.search(new RegExp(storage.options.PREMINT_ETH_WALLET_RE, 'i')) > -1,
      customFieldIsTezWallet: customFieldLabel.search(new RegExp(storage.options.PREMINT_TEZ_WALLET_RE, 'i')) > -1,
      customFieldIsBtcWallet: customFieldLabel.search(new RegExp(storage.options.PREMINT_BTC_WALLET_RE, 'i')) > -1,
    };
  }
  return {};
}

function setPremintCustomField(text) {
  debug.log('setPremintCustomField', text);
  if (typeof text !== 'string') {
    debug.log('Custom field value not a string!');
    return;
  }
  const elem = document.querySelector(storage.options.PREMINT_CUSTOM_FIELD_SEL);
  if (elem) {
    elem.value = text;
  }
}

// TWITTER HELPERS ----------------------------------------------------------------------------------

function getTweetId(url) {
  return getSearchParam(url, 'tweet_id') || getLastTokenizedItem(url, '/').trim();
}

function makeTwitterLikeIntentUrl(url) {
  return url.includes('/intent/like') ? url : `https://twitter.com/intent/like?tweet_id=${getTweetId(url)}`;
}

function makeTwitterRetweetIntentUrl(url) {
  return url.includes('/intent/like') ? url : `https://twitter.com/intent/retweet?tweet_id=${getTweetId(url)}`;
}

// STATUSBAR FUNCS ----------------------------------------------------------------------------------

function updateStatusbar(content, className = null) {
  pageState.statusbar.text(content, className);
}

function updateStatusbarOk(content) {
  pageState.statusbar.ok(content);
}

function updateStatusbarError(content) {
  pageState.statusbar.error(content);
}

function updateStatusbarInfo(content) {
  pageState.statusbar.info(content);
}

function updateStatusbarRunning(content) {
  pageState.statusbar.text(content, 'running');
}

// MISC HELPERS ----------------------------------------------------------------------------------

function getTwitterUser() {
  try {
    return document.querySelector('#step-twitter').querySelector('span').innerText?.trim();
  } catch (e) {
    console.error('Failed getting Twitter user! Error:', e);
    return null;
  }
}

function getDiscordUser() {
  try {
    return document.querySelector('#step-discord').querySelector('span').innerText?.trim();
  } catch (e) {
    console.error('Failed getting Twitter user! Error:', e);
    return null;
  }
}
