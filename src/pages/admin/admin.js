console.info('admin.js begin', window?.location?.href);

import './admin.scss';

import {
  optimizeStorage,
  createStatusbarButtons,
  getMyTabIdFromExtension,
  STATUSBAR_DEFAULT_TEXT,
} from '../../js/premintHelperLib.js';

import { createHashArgs, myConsole, getStorageData, setStorageData } from 'hx-lib';

import { getPermissions } from '../../js/permissions.js';
import { getCalendar, getCalendars } from '../../js/alphabotLib.js';

import { createStatusbar } from 'hx-statusbar';

const console2 = myConsole();

// DATA ------------------------------

let pageState = {};

// STARTUP ------------------------------

runNow();

async function runNow() {
  runPage();
}

async function runPage() {
  console2.log('runPage');

  const hashArgs = createHashArgs(window.location.hash);
  const permissions = await getPermissions();
  pageState = {
    ...pageState,
    hashArgs,
    statusbar: createStatusbar(STATUSBAR_DEFAULT_TEXT),
    permissions,
  };

  console2.info('PageState:', pageState);
  resetSubStatus();

  pageState.statusbar.buttons(
    createStatusbarButtons({
      options: true,
      results: 'disabled',
      reveal: 'disabled',
      followers: 'disabled',
    })
  );

  updateMainStatus('');

  await chrome.runtime.sendMessage({ cmd: 'ping' });

  document.getElementById('hx-optimize-storage').addEventListener('click', () => optimizeStorageHandler());
  document.getElementById('hx-get-alphabot-calendar').addEventListener('click', () => getAlphabotCalendar());
}

async function getAlphabotCalendar() {
  const x = await getMyTabIdFromExtension(pageState, 5000);
  console.log('x', x);
  const result = await getCalendar(new Date());
  console.log('result', result);
  const result2 = await getCalendars(new Date(), 1, 2);
  console.log('result2', result2);
}

async function optimizeStorageHandler() {
  if (!window.confirm('Do you want to optimize browser storage?')) {
    return console2.log('no');
  }

  console2.info('Old storage:', await getStorageData());
  const newStorage = await optimizeStorage();
  console2.info('New storage:', newStorage);

  await setStorageData(newStorage);

  updateSubStatus('Storage optimized!');
}

// WINS FUNCS -----------------------------------------------------

// MISC HELPERS -----------------------------------------------------

// STATUS FUNCS -----------------------------------------------------

function updateMainStatus(text) {
  console2.log('updateMainStatus', text);

  const elem = document.getElementById('hx-status-main');
  if (elem) {
    elem.innerText = text;
  }
}

function resetSubStatus() {
  document.getElementById('hx-status').replaceChildren();
}

function updateSubStatus(html, reuseLast = false) {
  console2.log('updateSubStatus', html);

  const elem = document.getElementById('hx-status');
  if (!elem) {
    console2.error('Missing status element in HTML!');
    return false;
  }
  let item;
  let isReused = false;
  if (reuseLast) {
    const items = Array.from(elem.getElementsByTagName('LI'));
    if (items.length) {
      item = items[items.length - 1];
      isReused = true;
    }
  }
  if (isReused) {
    item.innerHTML = html;
  } else {
    item = document.createElement('LI');
    item.innerHTML = html;
    elem.appendChild(item);
  }
}
