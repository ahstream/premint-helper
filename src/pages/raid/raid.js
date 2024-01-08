/* eslint-disable no-unused-vars */
console.info('raid.js begin', window?.location?.href);

import './raid.scss';

import global from '../../js/global.js';
console.log('global:', global);

import { createStatusbar } from '../../js/premintHelperLib.js';

import {} from '../../js/chromeDebugger.js';

import { createHashArgs, getStorageData, getStorageItems, setStorageData } from 'hx-lib';

import { getPermissions } from '../../js/permissions.js';

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

  // TEST 1
  document.getElementById('hx-test1').addEventListener('click', async (event) => {});

  addRaidLinks();
}

// MAIN FUNCS -----------------------------------------------------

async function addRaidLinks() {
  const storage = await getStorageItems(['options', 'raid']);
  if (!storage.raid) {
    storage.raid = {};
  }
  if (!storage.raid.addedLinks?.length) {
    storage.raid.addedLinks = [];
  }
  console.log('storage', storage);

  document.getElementById('raid-links').innerHTML = `<h3>Raid links</h3>${storage.raid.addedLinks.join(
    '<br>'
  )}`;
}

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
