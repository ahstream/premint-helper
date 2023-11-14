console.info('popup.js begin', window?.location?.href);

import './popup.css';

import { initPopupPage, mountPopupPage } from 'hx-chrome-lib';
import { showPermissions } from '../../js/permissions';

initPopupPage();

mountPopupPage([
  {
    id: 'hx-perm-show',
    callback: async () => {
      await showPermissions();
      window.close();
    },
  },
  /*
  {
    id: 'hx-show-alphabot-results',
    callback: () => {
      console.log('callback');
      chrome.runtime.sendMessage({
        cmd: 'openTab',
        url: chrome.runtime.getURL('/alphabotResults.html'),
        active: true,
      });
    },
  },
  */
  {
    id: 'hx-show-raffle-results',
    callback: () => {
      console.log('callback');
      chrome.runtime.sendMessage({
        cmd: 'openTab',
        url: chrome.runtime.getURL('/raffleResults.html'),
        active: true,
      });
    },
  },
]);
