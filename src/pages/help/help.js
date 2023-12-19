console.info('help.js begin', window?.location?.href);

import './help.css';

import { initHelpPage, mountHelpPage } from 'hx-chrome-lib';

import { createStatusbar, loadStorage } from '../../js/premintHelperLib.js';

// DATA ----------------------------------------------------------------------------

let storage = {};

// STARTUP ----------------------------------------------------------------------------

runNow();

async function runNow() {
  if (!window.location.href.toLowerCase().includes('=storage')) {
    // document.querySelector('#storage').style.display = 'none';
  }

  storage = await loadStorage({}, null, ['options'], []);
  createStatusbar(storage.options);

  initHelpPage();
  mountHelpPage();
}
