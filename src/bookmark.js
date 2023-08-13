console.info('bookmark.js begin', window?.location?.href);

import { addRevealAlphabotRafflesRequest } from './premintHelper.js';
import { addPendingRequest, getStorageItems } from '@ahstream/hx-utils';

// DATA ----------------------------------------------------------------------------------

const VALID_URLS_RE = [/https:\/\/www\.alphabot\.app\/[a-z\-0-9]+/i, /https:\/\/www\.premint\.xyz\//i];

// STARTUP ----------------------------------------------------------------------------

run();

async function run() {
  const params = new URL(window.location.href).searchParams;

  const cmd = params.get('cmd') || null;
  const url = params.get('url') || null;

  console.info('Run bookmark:', cmd, url, window?.location?.href);

  let storage = null;

  if (cmd === 'close-tabs') {
    storage = await getStorageItems(['options']);
    return chrome.runtime.sendMessage({ cmd: 'closeTabsButOne', url: storage.options.CLOSE_BUT_ONE_URL });
  }

  if (cmd === 'close-window') {
    return chrome.runtime.sendMessage({ cmd: 'closeWindow' });
  }

  if (cmd === 'close-tabs-minimize-window') {
    storage = await getStorageItems(['options']);
    return chrome.runtime.sendMessage({ cmd: 'closeTabsButOneMinimizeWindow', url: storage.options.CLOSE_BUT_ONE_URL });
  }

  if (cmd === 'minimize-window') {
    return chrome.runtime.sendMessage({ cmd: 'minimizeWindow' });
  }

  if (cmd === 'reveal-alphabot-raffles') {
    const url = await addRevealAlphabotRafflesRequest();
    return chrome.runtime.sendMessage({ cmd: 'openInSameTab', url });
  }

  if (cmd === 'show-alphabot-results') {
    return chrome.runtime.sendMessage({ cmd: 'openInSameTab', url: chrome.runtime.getURL('/alphabotResults.html') });
  }

  if (cmd === 'update-alphabot-results') {
    return chrome.runtime.sendMessage({ cmd: 'openInSameTab', url: chrome.runtime.getURL('/alphabotResults.html#action=update') });
  }

  if (!url) {
    console.error('Missing cmd and url:', window?.location?.href);
    return;
  }

  if (isValidUrl(url)) {
    console.info('Dispatch pendingUrl:', url);
    await addPendingRequest(url, { action: 'bookmark' });
  }

  window.location.href = url;
}

function isValidUrl(url) {
  for (let re of VALID_URLS_RE) {
    if (url.match(re)) return true;
  }
  return false;
}
