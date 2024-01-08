console.info('help.js begin', window?.location?.href);

import './help.css';

import global from '../../js/global.js';
console.log('global:', global);

import { initHelpPage, mountHelpPage } from 'hx-chrome-lib';

import { createStatusbar, loadStorage } from '../../js/premintHelperLib.js';
import { dynamicSortMultiple } from 'hx-lib';

// DATA ----------------------------------------------------------------------------

let storage = {};

// STARTUP ----------------------------------------------------------------------------

runNow();

async function runNow() {
  if (!window.location.href.toLowerCase().includes('=storage')) {
    // document.querySelector('#storage').style.display = 'none';
  }

  // storage = await loadStorage({ keys: ['options', 'stats'] });
  storage = await loadStorage();
  console.info('storage', storage);
  window.premint = storage;

  createStatusbar(storage.options);

  initHelpPage();
  mountHelpPage();

  addTwitterLockInfo();
}

function addTwitterLockInfo() {
  const softLocks = storage.stats.twitterAccount?.softLocks || [];
  const hardLocks = storage.stats.twitterAccount?.hardLocks || [];

  const getDateStr = (t) =>
    storage.options.DEFAULT_LOCALE
      ? new Date(t).toLocaleString(storage.options.DEFAULT_LOCALE)
      : new Date(t).toLocaleString();

  const allLocks = [
    ...softLocks.map((timestamp) => {
      return { timestamp, type: 'Soft' };
    }),
    ...hardLocks.map((timestamp) => {
      return { timestamp, type: 'Hard' };
    }),
  ];
  allLocks.sort(dynamicSortMultiple('-timestamp', 'type'));

  document.getElementById('mount-twitter-locks').innerHTML = `<br>
  ${!allLocks.length ? ' None' : allLocks.map((x) => `${getDateStr(x.timestamp)} (${x.type})`).join('<br>')}
    `;
}
