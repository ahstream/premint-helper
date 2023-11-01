console.info('alphabotRafflePage.js begin', window?.location?.href);

import '../styles/alphabotPage.css';

import {
  JOIN_BUTTON_TEXT,
  JOIN_BUTTON_IN_PROGRESS_TEXT,
  JOIN_BUTTON_TITLE,
  clickElement,
} from './premintHelperLib';

import {
  ONE_SECOND,
  sleep,
  waitForSelector,
  createLogger,
  extractTwitterHandle,
  getElementByText,
  millisecondsAhead,
  getTextContains,
  waitForTextContains,
  isTwitterURL,
} from 'hx-lib';

import { createObserver as createRaffleObserver, getPreviousWalletsWon } from './observer';

import { initRafflePage } from './rafflePage';

const debug = createLogger();

// DATA ----------------------------------------------------------------------------

const config = {
  name: 'ALPHABOT',
  enableForceRegister: true,
  storageKeys: ['runtime', 'options'],
  createObserver,
  waitForRafflePageLoaded,
  forceRegister,
  hasRegistered,
  hasCaptcha,
  hasWalletConnectDialog,
  hasAlreadyWon,
  hasDoingItTooOften,
  hasRaffleTrigger,
  hasRaffleTrigger2,
  isIgnored,
  getRegisterButton,
  isAllRegBtnsEnabled,
  addQuickRegButton,
  isPendingReg,
  setPendingReg,
  getTwitterUser,
  getDiscordUser,
  getAlphaName,
  getRaffleTwitterHandle,
  parseMustLikeLinks,
  parseMustRetweetLinks,
  parseMustLikeAndRetweetLinks,
  parseMustFollowLinks,
  parseMustJoinLinks,
  getErrors,
  handleSimpleErrors,
  handleComplexErrors,
  loadRafflePageWithCustomContent,
  addPreviouslyWonWallets,
  getWonWalletsByThisAccount,
  getWonWalletsByAllAccounts,
  getSelectedWallet,
  JOIN_BUTTON_TEXT,
  JOIN_BUTTON_TITLE,
  JOIN_BUTTON_IN_PROGRESS_TEXT,
};

// STARTUP ----------------------------------------------------------------------------

runNow();

function runNow() {
  initRafflePage(config);
}

// OBSERVER ----------------------------------------------

async function createObserver() {
  return await createRaffleObserver();
}

// WAIT FOR LOADED ----------------------------------------------

async function waitForRafflePageLoaded(storage) {
  debug.log('waitForRafflePageLoaded');

  const stopTime = millisecondsAhead(storage.options.ALPHABOT_WAIT_FOR_RAFFLE_PAGE_LOADED);
  while (Date.now() <= stopTime) {
    if (document.querySelector('[data-action="view-project-register"]')) {
      debug.log('Raffle page has loaded!');
      return true;
    }
    if (document.querySelector('[data-action="view-project-cancel-registration"]')) {
      debug.log('Raffle page has loaded!');
      return true;
    }
    await sleep(1000);
  }

  debug.log('Raffle page has NOT loaded!');
  return false;
}

// REGISTER

function forceRegister(storage) {
  const regBtn = getRegisterButtonSync(storage, true);
  debug.log('forceRegister; regBtn:', regBtn);
  if (!regBtn) {
    debug.log('!regBtn');
    return null;
  }
  if (regBtn?.disabled) {
    debug.log('regBtn?.disable');
    return null;
  }

  const errors = getErrors();
  debug.log('errors:', errors);
  if (errors.discord) {
    debug.log('Do not force register when discord errors!');
    return null;
  }

  if (hasDoingItTooOften()) {
    debug.log('hasDoingItTooOften');
    return null;
  }

  if (!isAllRegBtnsEnabled(storage)) {
    debug.log('!isAllRegBtnsEnabled');
    return null;
  }

  clickElement(regBtn);
  // pageState.isRegistering = true;
  return regBtn;
}

// REGISTER BTN FUNCS ----------------------------------------------

async function getRegisterButton(storage, maxWait = 1000, interval = 10) {
  const regPlus1Btn = await waitForTextContains(
    storage.options.ALPHABOT_REG_PLUS_1_BTN_SEL,
    'button',
    maxWait,
    interval
  );
  if (regPlus1Btn) {
    return regPlus1Btn;
  }
  return await waitForSelector(storage.options.ALPHABOT_REG_BTN_SEL, 60 * ONE_SECOND, 100);
}

function getRegisterButtonSync(storage, mustHaveAllBtns = false) {
  debug.log('getRegisterButtonSync; mustHaveAllBtns:', mustHaveAllBtns);
  const regPlus1Btn = getTextContains(storage.options.ALPHABOT_REG_PLUS_1_BTN_SEL, 'button');
  if (regPlus1Btn) {
    if (mustHaveAllBtns) {
      return document.querySelector(storage.options.ALPHABOT_REG_BTN_SEL) ? regPlus1Btn : null;
    }
    return regPlus1Btn;
  }
  return document.querySelector(storage.options.ALPHABOT_REG_BTN_SEL);
}

function isAllRegBtnsEnabled(storage) {
  const regBtn = document.querySelector(storage.options.ALPHABOT_REG_BTN_SEL);
  const regPlus1Btn = getTextContains(storage.options.ALPHABOT_REG_PLUS_1_BTN_SEL, 'button');
  console.log('regBtn', regBtn);
  console.log('regPlus1Btn', regPlus1Btn);
  if (regBtn?.disabled) {
    return false;
  }
  if (regPlus1Btn?.disabled) {
    return false;
  }
  if (regBtn || regPlus1Btn) {
    return true;
  }
  return false;
}

async function addQuickRegButton(storage, clickHandler) {
  const regBtnContainer = await waitForSelector(
    '[data-action="view-project-register"]',
    60 * ONE_SECOND,
    100
  );
  debug.log('regBtn', regBtnContainer);
  if (!regBtnContainer) {
    return;
  }

  const btn = document.createElement('button');
  btn.id = 'ph-quick-reg';
  btn.innerHTML = JOIN_BUTTON_TEXT;
  btn.title = JOIN_BUTTON_TITLE;
  btn.className = 'alphabotButton';
  btn.addEventListener('click', clickHandler);

  const tasksElem = getElementByText('Tasks', 'h5', { contains: true });
  debug.log('tasksElem', tasksElem);
  if (tasksElem) {
    tasksElem.after(btn);
  } else {
    regBtnContainer.after(btn);
  }
}

// RAFFLE STATE CHECKERS -------------------------------------------------------------------

function hasRegistered() {
  const elems = [...document.querySelectorAll('h5')].filter(
    (e) =>
      e.innerText === 'Registered successfully' || e.innerText === 'Your wallet was submitted successfully'
  );
  const result = elems.length > 0;
  return result;
}

function hasCaptcha() {
  // document.querySelector('.recaptcha-checkbox-checked')
  // document.querySelector('.recaptcha-checkbox-borderAnimation')
  // const elem = document.querySelector('iframe[title="reCAPTCHA"]');
  const elem = document.querySelector('iframe[src*="hcaptcha.com"]');

  if (!elem) {
    return false;
  }

  if (typeof elem?.disabled === 'boolean' && elem.disabled === false) {
    // debug.log('Has captcha:', elem);
    return true;
  }

  const parent = elem.parentElement?.parentElement;
  if (!parent) {
    return false;
  }

  if (parent.ariaHidden === 'true') {
    return false;
  }

  // debug.log('Has captcha:', elem, parent);

  return true;
}

function hasWalletConnectDialog() {
  const elem = document.querySelector('#WEB3_CONNECT_MODAL_ID');
  return !!elem;
}

function hasAlreadyWon() {
  const elem = [...document.querySelectorAll('div#notistack-snackbar.SnackbarItem-message')].filter((e) =>
    e.innerText.startsWith('You won a raffle for this project from the same team already')
  );
  const result = elem.length > 0;
  return result;
}

function hasDoingItTooOften() {
  const elem = [...document.querySelectorAll('div#notistack-snackbar.SnackbarItem-message')].filter((e) =>
    e.innerText.startsWith('You are doing that too often. Please try again in 5 minutes')
  );
  const result = elem.length > 0;
  return result;
}

async function hasRaffleTrigger() {
  const elem = await waitForTextContains('mint wallet', '.MuiAlert-message', 10 * ONE_SECOND, 50);
  debug.log('hasRaffleTrigger:', elem);
  return !!elem;
}

async function hasRaffleTrigger2(storage) {
  const elem = await waitForSelector(storage.options.ALPHABOT_REG_BTN_SEL, 60 * ONE_SECOND, 100);
  debug.log('hasRaffleTrigger2:', elem);
  return !!elem;
}

function isIgnored(pageState, storage) {
  const teamName = getAlphaName();
  let ignored =
    pageState.isAutoStarted && // only ignore auto started raffles!
    storage.options.ALPHABOT_IGNORED_NAMES.length &&
    teamName &&
    storage.options.ALPHABOT_IGNORED_NAMES.includes(teamName);
  console.log('isIgnored; teamName, ignored:', teamName, ignored);
  return ignored;
}

// PENDING REG --------------------------------

function isPendingReg() {
  return false; // do nothing
}

async function setPendingReg() {
  return false; // do nothing
}

// PAGE GETTERS -------------------------------------

function getTwitterUser() {
  const elems = [...document.querySelectorAll('div.MuiSelect-select[role="button"]')].filter((e) =>
    e.innerText.startsWith('@')
  );
  return elems?.length === 1 ? elems[0].innerText.replace('@', '') : null;
}

function getDiscordUser() {
  const elems = [...document.querySelectorAll('div.MuiBox-root')].filter((e) =>
    e.innerText.toLowerCase().startsWith('discord:')
  );
  if (!elems || !elems.length) {
    return null;
  }
  const elem = elems[0].querySelector('div[role="button"]');
  return elem ? elem.innerText : null;
}

function getAlphaName() {
  // /from\\n\\n([a-z0-9 ]*)\\n\\non/i
  const elem = document.querySelector(
    '.MuiChip-root.MuiChip-filled.MuiChip-sizeSmall.MuiChip-colorSecondary.MuiChip-filledSecondary'
  );
  return elem?.innerText || '';
}

function getRaffleTwitterHandle() {
  const twitterLink = document.querySelector('a[data-action="option-twitter"]');
  if (!twitterLink) {
    return null;
  }
  debug.log('twitterLink', twitterLink);

  const twitterHandle = extractTwitterHandle(twitterLink?.href);
  if (!twitterHandle) {
    return null;
  }
  debug.log('twitterHandle', twitterHandle);

  return twitterHandle;
}

// PARSE TASK LINKS -------------------------------------

function parseMustLikeLinks() {
  return parseTwitterLinks('like\n');
}

function parseMustRetweetLinks() {
  return parseTwitterLinks('retweet\n');
}

function parseMustLikeAndRetweetLinks() {
  return parseTwitterLinks('like & retweet');
}

function parseMustFollowLinks() {
  const val = [...document.querySelectorAll('a')]
    .filter((elem) => isTwitterURL(elem.href) && elem.href.toLowerCase().includes('intent/user?'))
    .map((e) => e.href);
  console.log('parseMustFollowLinks:', val);
  return val;
}

function parseTwitterLinks(prefix) {
  const elems = [
    ...[...document.querySelectorAll('div.MuiPaper-root')].filter((e) =>
      e.innerText.toLowerCase().startsWith(prefix)
    ),
  ];
  const val = elems.length < 1 ? [] : Array.from(elems[0].getElementsByTagName('a')).map((a) => a.href);
  console.log('parseTwitterLinks:', prefix, val);
  return val;
}

function parseMustJoinLinks(storage, mustHaveRole = false) {
  let elems;
  if (mustHaveRole) {
    elems = [...document.querySelectorAll('p.MuiTypography-root')].filter(
      (e) =>
        e.innerText.toLowerCase().includes('join') &&
        e.innerText.toLowerCase().includes('discord') &&
        e.innerText.toLowerCase().includes('have role')
    );
  } else {
    elems = [...document.querySelectorAll('p.MuiTypography-root')].filter(
      (e) => e.innerText.toLowerCase().includes('join') && e.innerText.toLowerCase().includes('discord')
    );
  }
  const val = elems
    .map((e) => e.getElementsByTagName('a'))
    .map((e) => Array.from(e))
    .flat()
    .map((e) => e.href);
  console.log('parseMustJoinLinks:', mustHaveRole, elems, val);
  return val;
}

// WON WALLETS

function addPreviouslyWonWallets(pageState) {
  const twitterLink = document.querySelector('a[data-action="option-twitter"]');
  if (!twitterLink) {
    return;
  }
  debug.log('twitterLink', twitterLink);

  const twitterHandle = extractTwitterHandle(twitterLink?.href);
  if (!twitterHandle) {
    return;
  }
  debug.log('twitterHandle', twitterHandle);

  const section = pageState.observer.createPreviousWonSection(twitterHandle, true, pageState.permissions);
  if (!section) {
    return;
  }
  debug.log('section', section);

  const tasksElem = getElementByText('Tasks', 'h5', { contains: true });
  if (!tasksElem) {
    console.error('Missing Tasks elem!');
    return;
  }
  debug.log('tasksElem', tasksElem);
  tasksElem.after(section);
}

function getWonWalletsByThisAccount() {
  try {
    const elems = [
      ...[...document.querySelectorAll('div.MuiBox-root')].filter(
        (x) => x.innerText.toLowerCase() === 'you won'
      ),
    ];
    if (!elems?.length) {
      return [];
    }
    return [...elems[0].nextElementSibling.querySelectorAll('p')]
      .filter((x) => x.innerText.includes('...'))
      .map((x) => x.innerText);
  } catch (e) {
    console.error(e);
    return [];
  }
}

function getWonWalletsByAllAccounts() {
  return getPreviousWalletsWon(getRaffleTwitterHandle());
}

function getSelectedWallet() {
  try {
    const elems = [...document.querySelectorAll('div.MuiAlert-message')].filter((x) =>
      x.innerText.toLowerCase().includes(' mint wallet:\n')
    );
    // console.log('elems', elems);
    //const elems = [...document.querySelectorAll('svg[aria-label^="Select a wallet address"]')];
    if (!elems?.length) {
      return null;
    }
    const elem = elems[0].querySelector('div[role="button"]');
    if (!elem) {
      return null;
    }

    const shortWallet = elem?.innerText || '';
    const longWallet = elem.nextSibling?.value || '';

    return { shortWallet, longWallet };
    /*
    console.log('elem', elem);
    console.log('elem?.nextSibling', elem?.nextSibling);
    console.log('elem?.nextSibling?.value', elem?.nextSibling?.value);
    return elem?.nextSibling?.value || null;
    */
    // return elems[0].previousElementSibling.querySelector('div[role="button"]').parentElement.innerText;
  } catch (e) {
    console.error(e);
    return null;
  }
}

// ERROR HANDLING

function getErrors() {
  const elems = [...document.querySelectorAll('.MuiAlert-standardError')].map((x) =>
    x.innerText.toLowerCase()
  );
  return {
    texts: elems,
    twitter: elems.some((x) => x.includes('follow') || x.includes('like') || x.includes('retweet')),
    discord: elems.some((x) => x.includes('join')),
    discordRoled: elems.some((x) => x.includes('join') && x.includes('have role')),
  };
}

async function handleSimpleErrors() {
  return false; // do nothing
}

async function handleComplexErrors(pageState, storage, context) {
  const errors = getErrors();

  if (errors.texts.length) {
    await sleep(1000);
    debug.log('Has errors:', errors);

    if (hasCaptcha()) {
      //return exitAction('raffleCaptcha');
      context.handleRaffleCaptcha();
      return true;
    }

    if (pageState.hasDiscordCaptcha) {
      context.handleDiscordCaptcha();
      return true;
    }

    if (pageState.hasHadRaffleError) {
      context.exitAction('raffleUnknownError');
      return true;
    }

    pageState.hasHadRaffleError = true;

    if (!errors.twitter) {
      context.exitAction('raffleUnknownError');
      return true;
    }

    const retries = pageState.request?.retries
      ? pageState.request?.retries - 1
      : storage.options.RAFFLE_RETRY_TIMES;

    if (!retries && pageState.request?.retries) {
      // Have retried before but have no retries left, try one last time without retries!
      context.waitAndTryRegisterOneLastTime();
      return true;
    }

    if (!retries) {
      context.exitAction('raffleUnknownError');
      return true;
    }

    context.exitAction('raffleUnknownErrorWillRetry', {
      retrySecs: storage.options.RAFFLE_RETRY_SECS,
      retries,
    });

    debug.log('retry in secs; times:', storage.options.RAFFLE_RETRY_SECS, retries);

    await context.waitAndTryRegisterBeforeRetry(retries);

    return true;
  }

  return false;
}

// CUSTOM CONTENT ----------------------------------------------------------------------------------

function loadRafflePageWithCustomContent() {
  return false; // do nothing
}
