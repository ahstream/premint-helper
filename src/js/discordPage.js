console.info('discordPage.js begin', window?.location?.href);

import {
  sleep,
  createHashArgs,
  waitForTextContains,
  addToDate,
  simulateClick,
  millisecondsAhead,
  ONE_MINUTE,
  getLastTokenizedItem,
  getFirstTokenizedItem,
  getStorageItems,
  setStorageData,
  myConsole,
} from 'hx-lib';

const console2 = myConsole();

// DATA ----------------------------------------------------------------------------------

let storage = null;
let parentTabId = null;

// STARTUP ----------------------------------------------------------------------------

runNow();

async function runNow() {
  storage = await getStorageItems(['runtime', 'options']);
  console2.log('storage', storage);

  if (!storage?.options) {
    console2.info('Options missing, exit!');
    return;
  }

  if (!storage.options.DISCORD_ENABLE && storage.options.DISCORD_ENABLE_MANUAL) {
    console2.info('Disabled, exit!');
    return;
  }

  const hashArgs = createHashArgs(window.location.hash);
  parentTabId = hashArgs.getOne('id');
  console2.log('parentTabId', parentTabId);

  window.addEventListener('load', onLoad);
}

function onLoad() {
  console2.log('onLoad');
  runPage();
}

// EVENT HANDLERS ----------------------------------------------------------------------------------

window.addEventListener('beforeunload', function () {
  console2.log('beforeunload');
  if (parentTabId) {
    chrome.runtime.sendMessage({ cmd: 'finish', delay: 500, to: parentTabId, isDiscord: true });
  }
});

chrome.runtime.onMessage.addListener(async (request, sender) => {
  console2.info('Received message:', request, sender);
});

// PAGE FUNCS ----------------------------------------------------------------------------------

async function runPage() {
  console2.log('runPage');

  const href = window.location.href;
  if (href.includes('discord.com/invite/')) {
    await joinDiscord();
    await runMainLoop();
  } else if (href.includes('discord.com/app/') || href.includes('discord.com/channels/')) {
    await runMainLoop();
  } else {
    await runMainLoop();
  }
}

// JOIN DISCORD -----------------------------------------------------------------------------------------

async function joinDiscord() {
  console2.info('Join Discord');

  const isDispatched = !!parentTabId;
  const isPendingJoin = isPendingDiscordJoin();
  const isFromRaffle = isDispatched || isPendingJoin;

  console2.log('isDispatched, isPendingJoin, isFromRaffle:', isDispatched, isPendingJoin, isFromRaffle);

  if (isFromRaffle && !storage.options.DISCORD_ENABLE) {
    console2.info('Discord Join automation disabled!');
    await chrome.runtime.sendMessage({ cmd: 'finish', delay: 0, to: parentTabId, isDiscord: true });
    return false;
  }

  if (!isFromRaffle && !storage.options.DISCORD_ENABLE_MANUAL) {
    console2.info('Forced Discord Join disabled!');
    return false;
  }

  if (isFromRaffle && storage.options.DISCORD_SKIP_JOINED && parentTabId) {
    await sleep(2000);
    if (isDiscordServerAlreadyJoined()) {
      console2.info('Discord server already joined! Close this window...');
      await chrome.runtime.sendMessage({ cmd: 'finish', delay: 0, to: parentTabId, isDiscord: true });
      await sleep(storage.options.DISCORD_CLOSE_JOINED_DELAY, null, 0.5);
      window.close();
    }
  }

  if (isFromRaffle) {
    storage.runtime.pendingDiscordJoin = JSON.stringify(new Date());
    storage.runtime.pendingDiscordUrl = window.location.href;
    await setStorageData({ runtime: storage.runtime });
  }

  const joinBtn = await getJoinButton();
  if (!joinBtn) {
    console2.log('No Discord join button!');
    if (parentTabId) {
      await chrome.runtime.sendMessage({ cmd: 'finish', delay: 0, to: parentTabId, isDiscord: true });
    }
    return false;
  }
  console2.log('joinBtn:', joinBtn);

  await sleep(storage.options.DISCORD_JOIN_DELAY, null, 0.5);
  await clickDiscordElement(joinBtn, 40, 5);

  if (isFromRaffle) {
    storage.runtime.pendingDiscordJoin = JSON.stringify(new Date());
    storage.runtime.pendingDiscordUrl = window.location.href;
    await setStorageData({ runtime: storage.runtime });
    await sleep(1000);
    if (await runCaptcha()) {
      return false;
    }
    return true;
  }

  if (await runCaptcha()) {
    return false;
  }

  console2.info('Done with joinDiscord');

  if (isFromRaffle) {
    console2.log('send finish msg to parent');
    await chrome.runtime.sendMessage({ cmd: 'finish', delay: 0, to: parentTabId, isDiscord: true });
  }
}

async function getJoinButton(waitMs = ONE_MINUTE * 10, interval = 250) {
  return await waitForTextContains(
    storage.options.DISCORD_JOIN_BTN_TEXT,
    storage.options.DISCORD_JOIN_BTN_SEL,
    waitMs,
    interval
  );
}

// MAIN LOOP -----------------------------------------------------------------------------------------

function clickElement(elem) {
  elem.click();
  simulateClick(elem);
}

async function runMainLoop() {
  console2.log('runMainLoop');

  const joinBtn = await getJoinButton(500, 10);
  console2.log('joinBtn:', joinBtn);
  if (joinBtn) {
    console2.log('click joinBtn:', joinBtn);
    clickElement(joinBtn);
  }

  const isDispatched = !!parentTabId;
  const isPendingJoin = isPendingDiscordJoin();
  const isFromRaffle = isDispatched || isPendingJoin;

  let sleepFor = storage.options.DISCORD_MAIN_LOOP_SLEEP;

  if (isFromRaffle && !storage.options.DISCORD_ENABLE && parentTabId) {
    console2.info('Discord Complete automation disabled!');
    await chrome.runtime.sendMessage({ cmd: 'finish', delay: 0, to: parentTabId, isDiscord: true });
    return false;
  }

  if (!isFromRaffle && !storage.options.DISCORD_ENABLE_MANUAL) {
    console2.info('Forced Discord Complete disabled!');
    return false;
  }

  const stopTime = millisecondsAhead(storage.options.DISCORD_MAIN_LOOP_RUN_FOR);
  while (Date.now() <= stopTime) {
    if (joinBtn) {
      console2.log('click joinBtn:', joinBtn);
      clickElement(joinBtn);
    }
    if (await runCaptcha()) {
      return;
    }
    await runWhatsNew();
    await runMaybeLater();
    await runComplete();
    if (await tryToVerify()) {
      break;
    }
    await runContinue();
    if (await runAccept()) {
      break;
    }
    sleepFor = sleepFor + 2;
    console2.log(`Waiting for elems for msec:`, sleepFor);
    await sleep(sleepFor, null, 0.1);
  }
  console2.log('Exit runMainLoop!');
}

async function runCaptcha() {
  if (hasCaptcha()) {
    if (parentTabId) {
      console2.log('hasCaptcha, send finish msg to parentTabId!', parentTabId);
      chrome.runtime.sendMessage({ cmd: 'finish', status: 'captcha', to: parentTabId, isDiscord: true });
    } else {
      console2.log('hasCaptcha but no parentTabId!');
    }
    return true;
  }
  return false;
}

async function runWhatsNew() {
  const whatsNewElems = [...document.querySelectorAll('div[role="dialog"]')].filter((e) =>
    e.innerText.toLowerCase().startsWith("what's new")
  );
  if (whatsNewElems.length) {
    console2.log('whatsNewElems:', whatsNewElems);
    const whatsNewBtn = whatsNewElems[0].querySelector('button');
    console2.log('whatsNewBtn:', whatsNewBtn);
    if (whatsNewBtn) {
      await sleep(300, null, 0.2);
      await clickDiscordElement(whatsNewBtn, 10, 3, true);
    }
  }
}

async function runMaybeLater() {
  const maybeLaterElems = [...document.querySelectorAll('button')].filter((e) =>
    e.innerText.toLowerCase().startsWith('maybe later')
  );
  if (maybeLaterElems.length) {
    console2.log('maybeLaterElems:', maybeLaterElems);
    await sleep(300, null, 0.2);
    await clickDiscordElement(maybeLaterElems[maybeLaterElems.length - 1], 10, 3, true);
  }
}

async function runComplete() {
  const submitBtns = [...document.querySelectorAll('button[type="submit"]')].filter(
    (el) => el.textContent.trim().toLowerCase() === 'submit'
  );
  if (submitBtns.length) {
    console2.log('submitBtns:', submitBtns);
    await sleep(storage.options.DISCORD_COMPLETE_DELAY, null, 1.0);
    await clickDiscordElement(submitBtns[submitBtns.length - 1], 10, 3, true);
    return;
  }

  const completeBtns = [...document.querySelectorAll('div')].filter(
    (el) => el.textContent.trim().toLowerCase() === storage.options.DISCORD_COMPLETE_BTN_SEL.toLowerCase()
  );
  if (completeBtns.length) {
    console2.log('completeButtons:', completeBtns);
    await sleep(storage.options.DISCORD_COMPLETE_DELAY, null, 1.0);
    await clickDiscordElement(completeBtns[completeBtns.length - 1], 10, 3, true);
    return;
  }
}

async function tryToVerify(isEnabled = false) {
  if (!isEnabled) {
    return false;
  }
  const channelNames = ['verify-here'];
  const emojiDataNames = ['✅'];
  for (const channelName of channelNames) {
    if (tryToVerifyChannel(channelName)) {
      for (const emojiDataName of emojiDataNames) {
        if (tryToVerifyMessage(emojiDataName)) {
          return true;
        }
      }
    }
  }
  return false;
}

async function tryToVerifyChannel(channelName) {
  const elem = document.querySelector(`a[aria-label*="${channelName}"]`);
  if (elem) {
    await sleep(1000, 2000);
    console2.log('tryToVerifyChannel, elem:', elem);
    elem.click();
    return true;
  }
  return false;
}

async function tryToVerifyMessage(emojiDataName) {
  const elem = document.querySelector(`img[data-name="${emojiDataName}"]`);
  if (elem) {
    await sleep(1500, 3000);
    console2.log('tryToVerifyMessage, elem:', elem);
    elem.click();
    return true;
  }
  return false;
}

async function runContinue() {
  const continueBtns = [...document.querySelectorAll('div')].filter(
    (el) => el.textContent.trim().toLowerCase() === storage.options.DISCORD_CONTINUE_BTN_SEL.toLowerCase()
  );
  if (continueBtns.length) {
    console2.log('continueButtons:', continueBtns);
    await sleep(storage.options.DISCORD_CONTINUE_DELAY, null, 0.5);
    await clickDiscordElement(continueBtns[continueBtns.length - 1], 10, 3);
  }
}

async function runAccept() {
  const acceptCheckboxDivs = [...document.querySelectorAll('div')].filter(
    (el) => el.textContent.trim().toLowerCase() === storage.options.DISCORD_ACCEPT_CHECKBOX_SEL.toLowerCase()
  );

  if (acceptCheckboxDivs.length) {
    console2.log('acceptCheckboxDivs:', acceptCheckboxDivs);
    await sleep(storage.options.DISCORD_ACCEPT_CHECKBOX_DELAY, null, 0.5);
    await clickDiscordElement(acceptCheckboxDivs[acceptCheckboxDivs.length - 1], 10, 3);
    await sleep(storage.options.DISCORD_ACCEPT_RULES__DELAY, null, 0.5);
    const submitButtons = [...document.querySelectorAll('div')].filter(
      (el) => el.textContent.trim().toLowerCase() === storage.options.DISCORD_ACCEPT_RULES_SEL.toLowerCase()
    );
    console2.log('submitButtons:', submitButtons);
    if (submitButtons.length) {
      if (submitButtons.length > 1) {
        await clickDiscordElement(submitButtons[1], 10, 3);
      } else {
        await clickDiscordElement(submitButtons[0], 10, 3);
      }
    }
    return true;
  }
  return false;
}

// HELPERS ---------------------------------------------------------------------------------------------------

let internalDiscordStorage = null;

function getDiscordStorage() {
  if (internalDiscordStorage) {
    return internalDiscordStorage;
  }

  if (window.localStorage) {
    internalDiscordStorage = window.localStorage;
    return internalDiscordStorage;
  }

  var getLocalStoragePropertyDescriptor = () => {
    const iframe = document.createElement('iframe');
    document.head.append(iframe);
    const pd = Object.getOwnPropertyDescriptor(iframe.contentWindow, 'localStorage');
    iframe.remove();
    return pd;
  };

  Object.defineProperty(window, 'localStorage', getLocalStoragePropertyDescriptor());
  internalDiscordStorage = getLocalStoragePropertyDescriptor().get.call(window);

  return internalDiscordStorage;
}

function isDiscordServerAlreadyJoined() {
  const discordStorage = getDiscordStorage();
  const obj = JSON.parse(discordStorage.getItem('SelectedGuildStore'));
  const serverId = getDiscordServerId();
  console2.log('Check if server id is found in discordStorage:', serverId);
  console2.log('selectedGuildTimestampMillis:', obj._state.selectedGuildTimestampMillis);
  if (serverId && obj._state.selectedGuildTimestampMillis[serverId]) {
    console2.log('Server found in discordStorage!');
    return true;
  }
  console2.log('Server NOT found in discordStorage!');
  return false;
}

function getDiscordServerId() {
  // OLD: [...document.querySelectorAll("div")].filter(x => x.style.getPropertyValue('background-image').includes('https://cdn.discordapp.com/icons/'))[0].style.getPropertyValue('background-image')
  const elems = [...document.querySelectorAll('div')].filter((x) =>
    x.style.getPropertyValue('background-image').includes('https://cdn.discordapp.com/icons/')
  );
  if (!elems.length) {
    return null;
  }
  console2.log('elems', elems);
  const bgImage = elems[0].style.getPropertyValue('background-image');
  console2.log('bgImage', bgImage);
  const item1 = getLastTokenizedItem(bgImage, 'icons/');
  console2.log('item1', item1);
  const serverId = getFirstTokenizedItem(item1, '/');
  console2.log('serverId', serverId);

  return serverId;
}

function isPendingDiscordJoin() {
  console2.log('isPendingDiscordJoin:', storage.runtime?.pendingDiscordJoin);
  if (!storage.runtime?.pendingDiscordJoin) {
    console2.log('NO pendingDiscordJoin');
    return false;
  }
  const pendingDate = new Date(JSON.parse(storage.runtime?.pendingDiscordJoin));
  const toDate = addToDate(pendingDate, { ms: storage.options.DISCORD_MAX_PENDING_JOIN });
  const nowDate = new Date();
  const isPending = toDate > nowDate;

  console2.log('isPending, pendingDate, toDate, nowDate:', isPending, pendingDate, toDate, nowDate);

  return isPending;
}

function hasCaptcha() {
  const elems = [...document.getElementsByTagName('iframe')]
    .map((x) => x.src)
    .filter((x) => x.includes('captcha'));
  if (elems.length) {
    console2.log('DETECTED CAPTCHA:', elems);
    return true;
  }
  return false;
}

async function clickDiscordElement(elem, dx, dy, simulateToo = false) {
  elem.click();
  if (simulateToo) {
    await sleep(300);
    await simulateClick(elem, dx, dy);
  }
}
