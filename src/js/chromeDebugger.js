import {
  sleep,
  randomInt,
  // setStorageData,
} from 'hx-lib';

export async function debuggerClickMouse(elem, delay = null) {
  var rect = elem.getBoundingClientRect();
  const x = randomCoord(rect.left, rect.right);
  const y = randomCoord(rect.top, rect.bottom);
  const clickDelay = delay || randomInt(80, 120);
  console.log('debuggerClickMouse', x, y, delay, elem);
  chrome.runtime.sendMessage({ cmd: 'debuggerClickMouse', x, y, delay: clickDelay });
}

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

export async function debuggerClickEnter(elem, delay = null, delayBeforeBlur = null) {
  const clickDelay = delay || randomInt(80, 120);
  console.log('debuggerClickEnter', delay);
  elem.focus();
  chrome.runtime.sendMessage({ cmd: 'debuggerClickEnter', delay: clickDelay });
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

function randomCoord(min, max) {
  return addNoiseToCoord(randomInt(min, max), max);
}

function addNoiseToCoord(coord, max) {
  const coordWithNoise = coord + randomInt(0, 100) / 100;
  return coordWithNoise <= max ? coordWithNoise : max;
}
