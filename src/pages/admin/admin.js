/* eslint-disable no-unused-vars */
console.info('admin.js begin', window?.location?.href);

import './admin.scss';

import global from '../../js/global.js';
console.log('global:', global);

import {
  optimizeStorage,
  resetStorage,
  getMyTabIdFromExtension,
  createStatusbar,
} from '../../js/premintHelperLib.js';

import {
  debuggerClickMouse,
  debuggerSendKeyEvent,
  debuggerInsertText,
  debuggerSendPageDown,
} from '../../js/chromeDebugger';

import { createHashArgs, getStorageData, setStorageData, sleep } from 'hx-lib';

import { getPermissions } from '../../js/permissions.js';
import { getCalendar, getCalendars } from '../../js/alphabotLib.js';

import { simulateKeyPress } from '../../js/domLib.js';

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

  // TEST 1

  document.getElementById('hx-test1').addEventListener('click', async (event) => {
    console.log('click1:', event.isTrusted, event);
    await debuggerSendPageDown();
    await sleep(3000);
    await debuggerInsertText('xssdsd', { elem: document.getElementById('text') });
  });

  document.getElementById('hx-test1').addEventListener('mousedown', (event) => {
    console.log('mousedown1:', event.isTrusted, event);
  });

  document.getElementById('hx-test1').addEventListener('mouseup', (event) => {
    console.log('mouseup1:', event.isTrusted, event);
  });

  // TEST 2

  document.getElementById('hx-test2').addEventListener('click', (event) => {
    console.log('click2:', event.isTrusted, event);
    window.alert('hx-test2 clicked');
  });

  document.getElementById('hx-test2').addEventListener('mousedown', (event) => {
    console.log('mousedown2:', event.isTrusted, event);
  });

  document.getElementById('hx-test2').addEventListener('mouseup', (event) => {
    console.log('mouseup2:', event.isTrusted, event);
  });

  // TEST 3

  document.getElementById('hx-test3').addEventListener('click', async () => {
    console.log('click3:', event.isTrusted, event);
    await debuggerClickMouse('left', { elem: document.getElementById('hx-test2') });
    // debuggerClickMouse(elem);
    await debuggerInsertText('foobar 🔥 123', { elem: document.getElementById('text') });
  });

  // TEXT

  document.getElementById('text').addEventListener('click', (event) => {
    console.log('text click:', event);
  });
  document.getElementById('text').addEventListener('mouseDown', (event) => {
    console.log('text mouseDown:', event);
  });
  document.getElementById('text').addEventListener('mouseUp', (event) => {
    console.log('text mouseUp:', event);
  });
  document.getElementById('text').addEventListener('change', (event) => {
    console.log('text change:', event);
  });
  document.getElementById('text').addEventListener('focus', (event) => {
    console.log('text focus:', event);
  });
  document.getElementById('text').addEventListener('blur', (event) => {
    console.log('text blur:', event);
  });
  document.getElementById('text').addEventListener('keyDown', (event) => {
    console.log('text keyDown:', event);
  });
  document.getElementById('text').addEventListener('keyUp', (event) => {
    console.log('text keyUp:', event);
  });
  document.getElementById('text').addEventListener('input', (event) => {
    console.log('text input:', event);
  });

  /*
  document.getElementById('main').addEventListener('mouseup', (event) => {
    console.log('mouseup event.isTrusted, event:', event.isTrusted, event);
  });
  document.getElementById('main').addEventListener('mousedown', (event) => {
    console.log('mousedown event.isTrusted, event:', event.isTrusted, event);
  });
  */

  setTimeout(() => {
    console.log('foo');
    simulateKeyPress('a', {}, document.getElementById('text'));
  }, 1000);
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
