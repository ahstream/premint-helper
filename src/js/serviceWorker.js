console.info('serviceWorker.js begin');

import { addRevealAlphabotRafflesRequest, isAlphabotURL } from './premintHelper.js';
import { defaultOptions, overrideOptions } from '../config/config';
import { getStorageData, setStorageData, defaultMessageHandler, fetchHelper } from '@ahstream/hx-utils';

chrome.runtime.onInstalled.addListener(() => {
  initOptions(defaultOptions, overrideOptions).then(() => {
    console.info('Extension successfully installed!');
  });
});

chrome.webNavigation.onHistoryStateUpdated.addListener(function (data) {
  handleAlphabotNavigation(data);
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.info('Received message; request, sender:', request, sender);

  const defaultResult = defaultMessageHandler(request, sender);
  if (defaultResult?.ok) {
    console.log('Handled in messageHandler');
    if (defaultResult.response !== undefined) {
      sendResponse(defaultResult.response);
    }
    return;
  }

  switch (request.cmd) {
    case 'getMyTabIdAsync':
      console.log('sender.tab.id:', sender.tab.id);
      chrome.tabs.sendMessage(sender.tab.id, { cmd: 'getMyTabIdAsyncResponse', response: sender.tab.id });
      sendResponse(sender.tab.id);
      return;
    case 'revealAlphabotRaffles':
      revealAlphabotRaffles();
      break;
    case 'finish':
      chrome.tabs.sendMessage(Number(request.to), { ...request, url: sender.url, senderTabId: sender.tab.id });
      break;
    case 'profileResultMainLoop':
      chrome.tabs.query({}, (tabs) =>
        tabs.forEach((tab) => {
          chrome.tabs.sendMessage(tab.id, { cmd: 'profileResultMainLoop', profile: request.profile });
        })
      );
      break;
    case 'fetch':
      fetchHelper(request.request.url, request.request.options).then((result) => {
        chrome.tabs.sendMessage(sender.tab.id, { cmd: 'fetchResult', result, context: request.context || {} });
      });
      break;
    default:
      console.error('Received unexpected message!', request, sender);
      break;
  }

  sendResponse();
});

// MAIN FUNCTIONS

export async function initOptions(defaultOptions = {}, overrideOptions = {}) {
  const storage = await getStorageData();
  storage.options = storage.options || {};
  const finalOptions = { ...defaultOptions, ...storage.options, ...overrideOptions };
  console.log('storages:', {
    storage,
    defaultOptions,
    currentOptions: storage.options,
    overrideOptions,
    finalOptions,
  });
  storage.options = finalOptions;
  await setStorageData({ options: finalOptions, runtime: { pendingRequests: [] }, pendingPremintReg: {} });
}

function handleAlphabotNavigation(data) {
  if (!isAlphabotURL(data.url)) {
    return;
  }
  if (data.frameId === 0) {
    chrome.tabs.get(data.tabId, function (tab) {
      if (tab.url === data.url) {
        try {
          chrome.tabs.sendMessage(tab.id, { cmd: 'onHistoryStateUpdated' });
        } catch (e) {
          // do nothing
        }
      }
    });
  }
}

async function revealAlphabotRaffles() {
  console.log('revealAlphabotRaffles');
  chrome.tabs.query({}, async (tabs) => {
    for (let tab of tabs) {
      if (tab.active) {
        const url = await addRevealAlphabotRafflesRequest();
        if (tab.url.includes('alphabot.app/')) {
          chrome.tabs.update(undefined, { url });
        } else {
          chrome.tabs.create({ url, active: true });
        }
        return;
      }
    }
  });
}
