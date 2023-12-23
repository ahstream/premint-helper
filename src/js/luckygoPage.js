console.info('luckygoPage.js begin', window?.location?.href);

import global from './global.js';
console.log(global);

import { getStorageItems, myConsole, sleep, createHashArgs, dispatch } from 'hx-lib';
import { getCookie } from './premintHelperLib';
// import { getRaffles } from './luckygoLib.js';

const console2 = myConsole(global.LOGLEVEL);

// DATA ----------------------------------------------------------------------------------

let storage;

let pageState = {
  hashArgs: null,
  parentTabId: null,
};

// STARTUP ----------------------------------------------------------------------------

runNow();

async function runNow() {
  storage = await getStorageItems(['options']);
  console2.log('storage', storage);

  if (!storage?.options) {
    return console2.info('Options missing, exit!');
  }

  const hashArgs = createHashArgs(window.location.hash);
  pageState = {
    hashArgs,
    parentTabId: hashArgs.getOne('id'),
  };
  console2.info('PageState:', pageState);

  // window.addEventListener('load', onLoad);
  window.addEventListener('DOMContentLoaded', onLoad);
  //setTimeout(onLoad, 1000);
}

function onLoad() {
  console2.log('onLoad');
  runPage();
}

// PAGE FUNCTIONS ----------------------------------------------------------------------------

async function runPage() {
  console2.log('runPage');

  // console.log(await getRaffles());

  if (window.location.href.includes('/myraffles')) {
    return runMyRafflesPage();
  }

  console2.log('Exit runPage!');
}

async function runMyRafflesPage() {
  console2.log('runGetAuthKey');

  if (!pageState.action) {
    const request = await dispatch(window.location.href, 300);
    console2.info('Dispatched request:', request);
    pageState.request = request;
    pageState.action = request?.action;
    pageState.parentTabId = request?.tabId;
  }

  if (pageState.action === 'getAuth') {
    return getAuth();
  }

  console2.log('not dispatched, exit');
  return;
}

async function getAuth() {
  const val = getCookie('Authorization');
  console2.log('getAuth, val:', val);

  await chrome.runtime.sendMessage({
    cmd: 'sendTo',
    to: pageState.parentTabId,
    request: { cmd: 'getAuth', val },
  });
  await sleep(1200, 1500);
  window.close();
}
