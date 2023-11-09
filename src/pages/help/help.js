console.info('help.js begin', window?.location?.href);

import './help.css';

import { initHelpPage, mountHelpPage } from 'hx-chrome-lib';
import { createStatusbarButtons, STATUSBAR_DEFAULT_TEXT } from '../../js/premintHelperLib.js';
import { createStatusbar } from 'hx-statusbar';

// DATA ----------------------------------------------------------------------------

let pageState = {
  statusbar: null,
};

// STARTUP ----------------------------------------------------------------------------

runNow();

async function runNow() {
  pageState = {
    statusbar: createStatusbar(STATUSBAR_DEFAULT_TEXT),
  };

  pageState.statusbar.buttons(
    createStatusbarButtons({
      options: true,
      results: true,
      reveal: 'disabled',
      followers: 'disabled',
    })
  );

  if (!window.location.href.toLowerCase().includes('=storage')) {
    // document.querySelector('#storage').style.display = 'none';
  }

  initHelpPage();
  mountHelpPage();
}
