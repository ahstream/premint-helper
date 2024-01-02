import {
  sleep,
  randomInt,
  // setStorageData,
} from 'hx-lib';

export const ENTER = 13;
export const PAGEDOWN = 34;

export async function simulateKeyPress(
  key,
  options = { altKey: false, ctrlKey: false, metaKey: false, shiftKey: false },
  elem = null,
  delay = null
) {
  const dispatchOnElem = elem || document;
  console.log('dispatchOnElem', dispatchOnElem);
  dispatchOnElem.dispatchEvent(new KeyboardEvent('keyDown', { key, ...options }));
  await sleep(delay || randomInt(80, 120));
  dispatchOnElem.dispatchEvent(new InputEvent({ data: key }));
  await sleep(delay || randomInt(80, 120));
  dispatchOnElem.dispatchEvent(new KeyboardEvent('keyUp', { key, ...options }));
  await sleep(delay || randomInt(80, 120));
  return true;
}
