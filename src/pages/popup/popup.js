console.info('popup.js begin', window?.location?.href);

import './popup.css';

import { initPopupPage, mountPopupPage } from 'hx-chrome-lib';
import { setPermissions, showPermissions } from '../../js/permissions';

initPopupPage();

mountPopupPage([
  {
    id: 'hx-perm-show',
    callback: async () => {
      await showPermissions();
      window.close();
    },
  },
  {
    id: 'hx-perm-set',
    callback: async () => {
      const p2 = await setPermissions(Date.now() + 1000 * 10);
      console.log('p2', p2);
      window.alert(JSON.stringify(p2));
    },
  },
  {
    id: 'hx-show-alphabot-results',
    callback: () => {
      console.log('callback');
      chrome.runtime.sendMessage({ cmd: 'openTab', url: chrome.runtime.getURL('/alphabotResults.html'), active: true });
    },
  },
]);
