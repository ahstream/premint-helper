console.info('popup.js begin', window?.location?.href);

import './popup.css';

import { initPopupPage, mountPopupPage } from '@ahstream/hx-chrome-lib';

initPopupPage();

mountPopupPage([
  {
    id: 'hx-show-alphabot-results',
    callback: () => {
      console.log('callback');
      chrome.runtime.sendMessage({ cmd: 'openTab', url: chrome.runtime.getURL('/alphabotResults.html'), active: true });
    },
  },
]);
