console.info('admin.js begin', window?.location?.href);

import './admin.scss';

import {
  optimizeStorage,
  resetStorage,
  getMyTabIdFromExtension,
  createStatusbar,
} from '../../js/premintHelperLib.js';

import { createHashArgs, getStorageData, setStorageData } from 'hx-lib';

import { getPermissions } from '../../js/permissions.js';
import { getCalendar, getCalendars } from '../../js/alphabotLib.js';

// DATA ------------------------------

let storage = {};
let pageState = {};

// STARTUP ------------------------------

runNow();

async function runNow() {
  runPage();
}

async function runPage() {
  console.log('runPage');

  storage = await getStorageData();
  console.log('storage', storage);

  const hashArgs = createHashArgs(window.location.hash);
  const permissions = await getPermissions();
  pageState = {
    ...pageState,
    hashArgs,
    statusbar: createStatusbar(storage.options),
    permissions,
  };

  console.info('PageState:', pageState);
  resetSubStatus();

  updateMainStatus('');

  await chrome.runtime.sendMessage({ cmd: 'ping' });

  document.getElementById('hx-optimize-storage').addEventListener('click', () => optimizeStorageHandler());
  document.getElementById('hx-reset-storage').addEventListener('click', () => resetStorageHandler());
  document.getElementById('hx-get-alphabot-calendar').addEventListener('click', () => getAlphabotCalendar());

  document.getElementById('hx-event-click1').addEventListener('click', (event) => {
    console.log('click1 event.isTrusted, event:', event.isTrusted, event);
    /*
    const elem = document.getElementById('hx-event-click2');
    elem.click();
    simulateClick(elem);

    var changeEvent = new Event('click', { bubbles: true });
    elem.dispatchEvent(changeEvent);
    */
    const elem2 = document.getElementById('hx-event-click2');
    var rect = elem2.getBoundingClientRect();
    console.log(rect);
    console.log('elem2:', elem2);

    chrome.runtime.sendMessage({ cmd: 'debugger', x: rect.left + 5, y: rect.top + 5 });
  });

  document.getElementById('hx-event-click2').addEventListener('click', (event) => {
    console.log('click2 event.isTrusted, event:', event.isTrusted, event);
  });

  document.getElementById('hx-event-click2').addEventListener('mousedown', (event) => {
    console.log('mousedown event.isTrusted, event:', event.isTrusted, event);
  });

  document.getElementById('hx-event-click2').addEventListener('mouseup', (event) => {
    console.log('mouseup event.isTrusted, event:', event.isTrusted, event);
  });

  /*
  document.getElementById('main').addEventListener('mouseup', (event) => {
    console.log('mouseup event.isTrusted, event:', event.isTrusted, event);
  });
  document.getElementById('main').addEventListener('mousedown', (event) => {
    console.log('mousedown event.isTrusted, event:', event.isTrusted, event);
  });
  */
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
    return console.log('no');
  }

  console.info('Old storage:', await getStorageData());
  const newStorage = await optimizeStorage();
  console.info('New storage:', newStorage);

  await setStorageData(newStorage);

  updateSubStatus('Storage optimized!');
}

async function resetStorageHandler() {
  if (!window.confirm('Do you want to reset browser storage?')) {
    return console.log('no');
  }

  console.info('Old storage:', await getStorageData());
  const resettedStorage = await resetStorage();
  console.info('Resetted storage:', resettedStorage);

  chrome.storage.local.clear();
  console.info('Storage after clear:', await getStorageData());

  await setStorageData(resettedStorage);
  console.info('Storage after reset:', await getStorageData());

  updateSubStatus('Storage reset!');
}

// WINS FUNCS -----------------------------------------------------

// MISC HELPERS -----------------------------------------------------

// STATUS FUNCS -----------------------------------------------------

function updateMainStatus(text) {
  console.log('updateMainStatus', text);

  const elem = document.getElementById('hx-status-main');
  if (elem) {
    elem.innerText = text;
  }
}

function resetSubStatus() {
  document.getElementById('hx-status').replaceChildren();
}

function updateSubStatus(html, reuseLast = false) {
  console.log('updateSubStatus', html);

  const elem = document.getElementById('hx-status');
  if (!elem) {
    console.error('Missing status element in HTML!');
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
