console.info('serviceWorker.js begin');

import { defaultOptions, overrideOptions } from '../config/config';
import { initStorageWithOptions, fetchHelper } from 'hx-lib';
import { defaultMessageHandler } from 'hx-chrome-lib';
import { addRevealAlphabotRafflesRequest, isAlphabotURL } from './premintHelperLib.js';

const customStorage = { runtime: { pendingRequests: [] }, pendingPremintReg: {} };

chrome.runtime.onInstalled.addListener(() => {
  initStorageWithOptions(defaultOptions, overrideOptions, customStorage);
  console.info('Extension successfully installed!');
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

  if (messageHandler) {
    messageHandler(request, sender, sendResponse);
  } else {
    sendResponse();
  }
});

// MAIN FUNCTIONS

function messageHandler(request, sender, sendResponse) {
  switch (request.cmd) {
    /*
  await chrome.runtime.sendMessage({
    cmd: 'sentFromWebPage',
    request: { to: pageState.parentTabId, key: 'getAuth', val },
  });
  */

    case 'lookupTwitterFollowersFromMenu':
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        const currTab = tabs[0];
        if (currTab && currTab.id) {
          chrome.tabs.sendMessage(currTab.id, { cmd: 'lookupTwitterFollowers' });
        }
      });
      break;

    case 'lookupTwitterFollowersFromBtn':
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        const currTab = tabs[0];
        if (currTab && currTab.id) {
          chrome.tabs.sendMessage(currTab.id, { cmd: 'lookupTwitterFollowers' });
        }
      });
      break;

    case 'closeRaffleWhenFinished2':
      chrome.tabs.query({}, (tabs) => {
        console.log('tabs', tabs);
        if (tabs.length < 2) {
          chrome.tabs.create({ url: `chrome://extensions/?url=${request.url}`, active: true });
        }
        chrome.tabs.remove(sender.tab.id, () => console.log('close tab', sender.tab));
      });
      break;

    case 'closeRaffleWhenFinished':
      chrome.tabs.query({}, (tabs) => {
        console.log('tabs', tabs);
        if (tabs.length < 2) {
          chrome.tabs.create({ url: `chrome://extensions/?url=${request.url}`, active: true });
        }
        chrome.tabs.remove(sender.tab.id, () => console.log('close tab', sender.tab));
      });
      break;
    case 'cleanupRaffleWhenFinished':
      chrome.tabs.query({}, (tabs) => {
        console.log('tabs', tabs);
        tabs.forEach((tab) => {
          if (tab.id !== sender.tab.id) {
            chrome.tabs.remove(tab.id, () => console.log('close tab', tab));
          }
        });
      });
      break;
    case 'getMyTabIdAsync':
      console.log('sender.tab.id:', sender.tab.id);
      chrome.tabs.sendMessage(sender.tab.id, { cmd: 'getMyTabIdAsyncResponse', response: sender.tab.id });
      sendResponse(sender.tab.id);
      return;
    case 'revealAlphabotRaffles':
      revealAlphabotRaffles();
      break;
    case 'finish':
      chrome.tabs.sendMessage(Number(request.to), {
        ...request,
        url: sender.url,
        senderTabId: sender.tab.id,
      });
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
        chrome.tabs.sendMessage(sender.tab.id, {
          cmd: 'fetchResult',
          result,
          context: request.context || {},
        });
      });
      break;
    default:
      console.error('Received unexpected message!', request, sender);
      break;
  }

  sendResponse();
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
