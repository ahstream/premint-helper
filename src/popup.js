console.info('popup.js begin', window?.location?.href);

import '../styles/popup.scss';

document.getElementById('hx-show-alphabot-results').addEventListener('click', () => {
  chrome.runtime.sendMessage({ cmd: 'openTab', url: chrome.runtime.getURL('/alphabotResults.html'), active: true });
  window.close();
});

/*
document.getElementById('hx-reveal-alphabot-raffles').addEventListener('click', async () => {
  chrome.runtime.sendMessage({ cmd: 'revealAlphabotRaffles' });
  window.close();
});

document.getElementById('hx-update-twitter-followers').addEventListener('click', async () => {
  chrome.runtime.sendMessage({ cmd: 'updateTwitterFollowers' });
  window.close();
});
*/

document.getElementById('hx-help').addEventListener('click', () => {
  chrome.runtime.sendMessage({ cmd: 'openTab', url: chrome.runtime.getURL('/help.html'), active: true });
  window.close();
});

document.getElementById('hx-options').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});
