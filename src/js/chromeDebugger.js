import {
  sleep,
  randomInt,
  // setStorageData,
} from 'hx-lib';

export const MODIFIERS = {
  none: 0,
  alt: 1,
  ctrl: 2,
  cmd: 4,
  shift: 8,
};

export async function debuggerClickMouse(
  button,
  { x, y, elem = null, modifiers = 0, clickCount = 1, delay = null } = {}
) {
  var rect = elem ? elem.getBoundingClientRect() : null;
  const realX = rect ? randomCoord(rect.left, rect.right) : x;
  const realY = rect ? randomCoord(rect.top, rect.bottom) : y;
  const params = {
    button,
    clickCount,
    x: parseFloat(realX),
    y: parseFloat(realY),
    modifiers,
  };
  delay = delay || randomInt(80, 120);
  console.log('debuggerClickMouse', params, delay);
  chrome.runtime.sendMessage({ cmd: 'debuggerClickMouse', delay, params });
}

export async function debuggerInsertText(text, { elem, delay, delayBlur } = {}) {
  const params = {
    text,
  };
  delay = delay || randomInt(80, 120);
  console.log('debuggerInsertText', params, elem, delay, delayBlur);
  if (elem) {
    elem.focus();
  }
  await chrome.runtime.sendMessage({ cmd: 'debuggerInsertText', delay, params });
  if (elem && delayBlur) {
    await sleep(delayBlur);
    elem.blur();
  }
}

export async function debuggerSendKeyEvent(code, { modifiers = 0, delay } = {}) {
  const params = {
    windowsVirtualKeyCode: code,
    modifiers,
  };
  delay = delay || randomInt(80, 120);
  console.log('debuggerSendKeyEvent', params, delay);
  chrome.runtime.sendMessage({ cmd: 'debuggerSendKeyEvent', delay, params });
}

export async function debuggerSendEnter({ elem, modifiers = 0, delay, delayBlur } = {}) {
  const params = {
    windowsVirtualKeyCode: 13,
    unmodifiedText: '\r',
    text: '\r',
    modifiers,
  };
  delay = delay || randomInt(80, 120);
  console.log('debuggerSendEnter', params, elem, delay, delayBlur);
  if (elem) {
    elem.focus();
  }
  await chrome.runtime.sendMessage({ cmd: 'debuggerSendKeyEvent', delay, params });
  if (elem && delayBlur) {
    await sleep(delayBlur);
    elem.blur();
  }
}

export async function debuggerSendPageDown({ modifiers = 0, delay } = {}) {
  const params = {
    windowsVirtualKeyCode: 34,
    modifiers,
  };
  delay = delay || randomInt(80, 120);
  console.log('debuggerSendPageDown', params, delay);
  chrome.runtime.sendMessage({ cmd: 'debuggerSendKeyEvent', delay, params });
}

export async function debuggerSendPageDownDiscord({ delay } = {}) {
  return debuggerSendPageDown({ modifiers: MODIFIERS.shift, delay });
}

/*

export async function debuggerClickKey(elem, code, delay = null, delayBeforeBlur = null) {
  const clickDelay = delay || randomInt(80, 120);
  console.log('debuggerClickKey', code, delay);
  elem.focus();
  chrome.runtime.sendMessage({ cmd: 'debuggerClickKey', code, delay: clickDelay });
  if (delayBeforeBlur) {
    await sleep(delayBeforeBlur);
    elem.blur();
  }
}

export async function debuggerSendPageDown(delay = null) {
  delay = delay || randomInt(80, 120);
  console.log('debuggerSendPageDown', delay);
  chrome.runtime.sendMessage({ cmd: 'debuggerSendPageDown', delay });
}

export async function debuggerInsertText(elem, text, delay = null, delayBeforeBlur = 1000) {
  const clickDelay = delay || randomInt(80, 120);
  console.log('debuggerClickKey', text, delay);
  elem.focus();
  chrome.runtime.sendMessage({ cmd: 'debuggerInsertText', text, delay: clickDelay });
  await sleep(delayBeforeBlur);
  elem.blur();
}
*/

function randomCoord(min, max) {
  return addNoiseToCoord(randomInt(min, max), max);
}

function addNoiseToCoord(coord, max) {
  const coordWithNoise = coord + randomInt(0, 100) / 100;
  return coordWithNoise <= max ? coordWithNoise : max;
}
