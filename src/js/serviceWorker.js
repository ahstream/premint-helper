console.info('serviceWorker.js begin');

import global from './global.js';
console.log('global:', global);

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
  try {
    const r = await chrome.debugger.attach({ tabId }, '1.2');
    console.log('debugger attached:', tabId, r);
  } catch (e) {
    console.log(e);
  }
}

async function detachDebugger(tabId) {
  console.log('detachDebugger', tabId);
  await chrome.debugger.detach({ tabId });
}

/*
async function attachDebugger(tabId) {
  if (pageState?.attached && pageState?.attached[tabId]) {
    console.log('debugger already attached');
  } else {
    pageState.attached = pageState.attached || {};
    const r = await chrome.debugger.attach({ tabId }, '1.2');
    console.log('debugger attached:', r);
    pageState.attached[tabId] = true;
  }
}

async function detachDebugger(tabId) {
  console.log('detachDebugger', tabId);
  pageState.attached = pageState.attached || {};
  pageState.attached[tabId] = false;
  await chrome.debugger.detach({ tabId });
}
*/

async function messageHandler(request, sender, sendResponse) {
  switch (request.cmd) {
    /*
  await chrome.runtime.sendMessage({
    cmd: 'sentFromWebPage',
    request: { to: pageState.parentTabId, key: 'getAuth', val },
  });
  */

    case 'debuggerDetach':
      await debuggerDetach(sender.tab.id);
      break;

    case 'debuggerClickMouse':
      await debuggerClickMouse(request, sender.tab.id);
      break;

    case 'debuggerInsertText':
      await debuggerInsertText(request, sender.tab.id);
      break;

    case 'debuggerSendKeyEvent':
      await debuggerSendKeyEvent(request, sender.tab.id);
      break;

    /*
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
*/

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

// DEBUGGER SEND HELPERS

async function debuggerDetach(tabId) {
  await detachDebugger(tabId);
}

async function debuggerClickMouse(request, tabId) {
  await attachDebugger(tabId);

  const eventName = 'Input.dispatchMouseEvent';
  const params = {
    /*
    button: request.button || 'left',
    clickCount: request.clickCount || 1,
    x: parseFloat(request.x),
    y: parseFloat(request.y),
    */
    ...request.params,
  };

  const r1 = await chrome.debugger.sendCommand({ tabId }, eventName, { type: 'mousePressed', ...params });
  console.log('r1', r1, request);
  await sleep(request.delay || 80);

  const r2 = await chrome.debugger.sendCommand({ tabId }, eventName, { type: 'mouseReleased', ...params });
  console.log('r2', r2, request);
  await sleep(request.delay || 80);

  //await detachDebugger(tabId);
}

async function debuggerInsertText(request, tabId) {
  await attachDebugger(tabId);

  const eventName = 'Input.insertText';
  const params = {
    ...request.params,
  };

  const r1 = await chrome.debugger.sendCommand({ tabId }, eventName, { ...params });
  console.log('r1', r1, request);
  //await detachDebugger(tabId);
  await sleep(request.delay || 80);
}

async function debuggerSendKeyEvent(request, tabId) {
  await attachDebugger(tabId);

  const eventName = 'Input.dispatchKeyEvent';
  const params = {
    ...request.params,
  };

  const r1 = await chrome.debugger.sendCommand({ tabId }, eventName, { type: 'rawKeyDown', ...params });
  console.log('r1', r1, request);
  await sleep(request.delay || 5);

  const r2 = await chrome.debugger.sendCommand({ tabId }, eventName, { type: 'char', ...params });
  console.log('r2', r2, request);
  await sleep(request.delay || 5);

  const r3 = await chrome.debugger.sendCommand({ tabId }, eventName, { type: 'keyUp', ...params });
  console.log('r3', r3, request);
  //await detachDebugger(tabId);
  await sleep(request.delay || 5);
}
