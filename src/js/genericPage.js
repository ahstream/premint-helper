console.info('genericPage.js begin', window?.location?.href);

import '../styles/genericPage.css';

import global from './global.js';
console.log(global);

import { createObserver as createTwitterObserver } from './twitterObserver.js';

// DATA ----------------------------------------------------------------------------------

let pageState = {};

// STARTUP ----------------------------------------------------------------------------

runNow();

async function runNow() {
  (pageState.twitterObserver = await createTwitterObserver({
    permissions: null,
    logger: {},
  })),
    console.log('pageState', pageState);

  // window.addEventListener('load', onLoad);
  //window.addEventListener('DOMContentLoaded', onLoad);
}
