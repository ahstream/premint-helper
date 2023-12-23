console.info('serviceWorker.js begin');

import global from './global.js';
console.log(global);

import { defaultOptions, overrideOptions } from '../config/config';
import { initStorageWithOptions, fetchHelper, sleep } from 'hx-lib';
import { defaultMessageHandler } from 'hx-chrome-lib';
import {
  addRevealAlphabotRafflesRequest,
  isAlphabotURL,
  isClosableInternalWebPage,
} from './premintHelperLib.js';

const customStorage = { runtime: { pendingRequests: [] }, pendingPremintReg: {} };

const pageState = {};

chrome.runtime.onInstalled.addListener(() => {
  initStorageWithOptions(defaultOptions, overrideOptions, customStorage);
  console.info('Extension successfully installed!');
});

chrome.webNavigation.onHistoryStateUpdated.addListener(function (data) {
  handleAlphabotNavigation(data);
});

chrome.debugger.onDetach.addListener(function (event) {
  console.info('onDetach', event);
  if (pageState?.attached && pageState.attached[event.tabId]) {
    pageState.attached[event.tabId] = false;
  }
});

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  console.info('Received message:', request, sender);

  const defaultResult = defaultMessageHandler(request, sender);
  if (defaultResult?.ok) {
    //console.log('Handled in messageHandler');
    if (defaultResult.response !== undefined) {
      sendResponse(defaultResult.response);
    }
    return;
  }

  if (messageHandler) {
    await messageHandler(request, sender, sendResponse);
  } else {
    sendResponse();
  }
});

// MAIN FUNCTIONS

async function attachDebugger(tabId) {
  if (pageState?.attached && pageState?.attached[tabId]) {
    console.log('debugger already attached');
  } else {
    pageState.attached = pageState.attached || {};
    await chrome.debugger.attach({ tabId: tabId }, '1.2');
    pageState.attached[tabId] = true;
  }
}

async function messageHandler(request, sender, sendResponse) {
  let r1 = null;
  let r2 = null;
  let r3 = null;
  switch (request.cmd) {
    /*
  await chrome.runtime.sendMessage({
    cmd: 'sentFromWebPage',
    request: { to: pageState.parentTabId, key: 'getAuth', val },
  });
  */

    case 'debuggerClickMouse':
      await attachDebugger(sender.tab.id);
      r1 = await chrome.debugger.sendCommand({ tabId: sender.tab.id }, 'Input.dispatchMouseEvent', {
        type: 'mousePressed',
        button: 'left',
        clickCount: 1,
        x: parseFloat(request.x),
        y: parseFloat(request.y),
      });
      console.log('r1', r1, request);
      await sleep(request.delay || 5);
      r2 = await chrome.debugger.sendCommand({ tabId: sender.tab.id }, 'Input.dispatchMouseEvent', {
        type: 'mouseReleased',
        button: 'left',
        clickCount: 1,
        x: parseFloat(request.x),
        y: parseFloat(request.y),
      });
      console.log('r2', r2, request);
      break;

    case 'debuggerInsertText':
      await attachDebugger(sender.tab.id);
      r1 = await chrome.debugger.sendCommand({ tabId: sender.tab.id }, 'Input.insertText', {
        text: request.text,
      });
      console.log('r1', r1, request);
      await sleep(request.delay || 5);
      break;

    case 'debuggerClickEnter':
      await attachDebugger(sender.tab.id);

      r1 = await chrome.debugger.sendCommand({ tabId: sender.tab.id }, 'Input.dispatchKeyEvent', {
        type: 'rawKeyDown',
        windowsVirtualKeyCode: 13,
        unmodifiedText: '\r',
        text: '\r',
      });
      console.log('r1', r1, request);
      await sleep(request.delay || 5);

      r2 = await chrome.debugger.sendCommand({ tabId: sender.tab.id }, 'Input.dispatchKeyEvent', {
        type: 'char',
        windowsVirtualKeyCode: 13,
        unmodifiedText: '\r',
        text: '\r',
      });
      console.log('r2', r2, request);
      await sleep(request.delay || 5);

      r3 = await chrome.debugger.sendCommand({ tabId: sender.tab.id }, 'Input.dispatchKeyEvent', {
        type: 'keyUp',
        windowsVirtualKeyCode: 13,
        unmodifiedText: '\r',
        text: '\r',
      });
      console.log('r3', r3, request);

      break;

    case 'debuggerClickKey':
      await attachDebugger(sender.tab.id);
      r1 = await chrome.debugger.sendCommand({ tabId: sender.tab.id }, 'Input.dispatchKeyEvent', {
        type: 'keyDown',
        code: request.code,
      });
      console.log('r1', r1, request);
      await sleep(request.delay || 5);
      r2 = await chrome.debugger.sendCommand({ tabId: sender.tab.id }, 'Input.dispatchKeyEvent', {
        type: 'keyUp',
        code: request.code,
      });
      console.log('r2', r2, request);
      break;

    case 'ping':
      console.log('sender.tab:', sender.tab);
      chrome.tabs.sendMessage(sender.tab.id, { cmd: 'pong' });
      break;

    case 'cleanupInternalWebPages':
      chrome.tabs.query({}, function (tabs) {
        tabs.forEach((tab) => {
          if (!tab || !tab.url || tab.id === sender.tab.id) {
            return;
          }
          if (isClosableInternalWebPage(tab.url)) {
            chrome.tabs.remove(tab.id, () => console.info('Close tab:', tab));
            return;
          }
          if (tab.url === sender.tab.url) {
            chrome.tabs.remove(tab.id, () => console.info('Close tab:', tab));
            return;
          }
        });
      });
      break;

    case 'lookupTwitterFollowersFromMenu':
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        const currTab = tabs[0];
        if (currTab && currTab.id) {
          chrome.tabs.sendMessage(currTab.id, { cmd: 'lookupTwitterFollowers', scope: 0 });
        }
      });
      break;

    case 'lookupTwitterFollowersFromBtn':
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        const currTab = tabs[0];
        if (currTab && currTab.id) {
          chrome.tabs.sendMessage(currTab.id, { cmd: 'lookupTwitterFollowers', scope: request.scope });
        }
      });
      break;

    case 'closeRaffleWhenFinished2':
      chrome.tabs.query({}, (tabs) => {
        //console.log('tabs', tabs);
        if (tabs.length < 2) {
          chrome.tabs.create({ url: `chrome://extensions/?url=${request.url}`, active: true });
        }
        chrome.tabs.remove(sender.tab.id, () => console.info('Close tab:', sender.tab));
      });
      break;

    case 'closeRaffleWhenFinished':
      chrome.tabs.query({}, (tabs) => {
        //console.log('tabs', tabs);
        if (tabs.length < 2) {
          chrome.tabs.create({ url: `chrome://extensions/?url=${request.url}`, active: true });
        }
        chrome.tabs.remove(sender.tab.id, () => console.info('Close tab:', sender.tab));
      });
      break;
    case 'cleanupRaffleWhenFinished':
      chrome.tabs.query({}, (tabs) => {
        //console.log('tabs', tabs);
        tabs.forEach((tab) => {
          if (tab.id !== sender.tab.id) {
            chrome.tabs.remove(tab.id, () => console.info('Close tab:', tab));
          }
        });
      });
      break;
    case 'getMyTabIdAsync':
      console.log('sender.tab:', sender.tab);
      chrome.tabs.sendMessage(sender.tab.id, { cmd: 'getMyTabIdAsyncResponse', response: sender.tab.id });
      sendResponse(sender.tab.id);
      return false;
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
      console.error('Received unexpected message:', request, sender);
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
