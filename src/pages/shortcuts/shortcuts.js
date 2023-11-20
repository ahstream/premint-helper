console.info('shortcuts.js begin', window?.location?.href);

import { getStorageItems, getQueryParam, addPendingRequest } from 'hx-lib';
import { initShortcutsPage, mountShortcutsPage } from 'hx-chrome-lib';

import { addRevealAlphabotRafflesRequest } from '../../js/premintHelperLib.js';

initShortcutsPage();

// const VALID_URLS = [/https:\/\/www\.alphabot\.app\/[a-z\-0-9]+/i, /https:\/\/www\.premint\.xyz\//i];
const VALID_URLS = null;

getStorageItems(['options']).then((storage) => {
  mountShortcutsPage(VALID_URLS, [
    {
      cmd: 'close-tabs',
      callback: () => {
        chrome.runtime.sendMessage({ cmd: 'closeTabsButOne', url: storage.options.CLOSE_BUT_ONE_URL });
      },
    },
    {
      cmd: 'close-window',
      callback: () => {
        chrome.runtime.sendMessage({ cmd: 'closeWindow' });
      },
    },
    {
      cmd: 'close-tabs-minimize-window',
      callback: () => {
        chrome.runtime.sendMessage({
          cmd: 'closeTabsButOneMinimizeWindow',
          url: storage.options.CLOSE_BUT_ONE_URL,
        });
      },
    },
    {
      cmd: 'minimize-window',
      callback: () => {
        chrome.runtime.sendMessage({ cmd: 'minimizeWindow' });
      },
    },

    {
      cmd: 'verify-alphabot-raffle',
      callback: async () => {
        const url = getQueryParam(window.location.href, 'url');
        await addPendingRequest(url, { action: 'verifyAlphabotRaffle' });
        window.location.href = url;
      },
    },

    {
      cmd: 'reveal-alphabot-raffles',
      callback: async () => {
        const url = await addRevealAlphabotRafflesRequest();
        return chrome.runtime.sendMessage({ cmd: 'openInSameTab', url });
      },
    },
    {
      cmd: 'update-raffle-results',
      callback: () => {
        return chrome.runtime.sendMessage({
          cmd: 'openInSameTab',
          url: chrome.runtime.getURL('/raffleResults.html#action=update'),
        });
      },
    },
  ]);
});
