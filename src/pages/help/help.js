console.info('help.js begin', window?.location?.href);

import './help.css';

import { initHelpPage, mountHelpPage } from '@ahstream/hx-chrome-lib';
import { createStatusbarButtons, STATUSBAR_DEFAULT_TEXT } from '../../js/premintHelperLib.js';
import { createStatusbar } from '@ahstream/hx-statusbar';

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

  initHelpPage();
  mountHelpPage();
}
