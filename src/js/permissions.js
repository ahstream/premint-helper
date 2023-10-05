import { getStorageItems, setStorageData } from 'hx-lib';

import CryptoJS from 'crypto-js';

// DATA ----------------------------------------------------------------------------------

// FUNCTIONS ----------------------------------------------------------------------------------

const w = '2fjnk234i6580hjklnvlagjk012948it5g';
// const encrypt = (t) => CryptoJS.AES.encrypt(t, w).toString();
const decrypt = (c) => CryptoJS.AES.decrypt(c, w).toString(CryptoJS.enc.Utf8);
const parseKey = (k) => JSON.parse(JSON.parse(decrypt(k)));

export async function showPermissions() {
  const key = await enterNewKey(await getSubscriptionInfo());
  if (key) {
    await setPermissions(key);
    window.alert(await getSubscriptionInfo());
  }
}

async function getSubscriptionInfo() {
  const p = await getPermissions();
  console.log('p', p);
  return p?.enabled ? `Subscription active until ${new Date(p.enabledTo).toLocaleString()}` : 'No active subscription';
}

async function enterNewKey(prefix) {
  let promptText = `${prefix}\nEnter new subscription key?`;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const key = window.prompt(promptText, '');
    if (!key) {
      return null;
    }
    if (!isValidKey(key)) {
      promptText = `Invalid key! ${prefix}\nEnter new subscription key?`;
      continue;
    }
    return key;
  }
}

function parsePermissions(key) {
  try {
    return parseKey(key);
  } catch (e) {
    return null;
  }
}

export async function getPermissions() {
  const storage = await getStorageItems(['permissions']);
  const permissions = storage.permissions ? parsePermissions(storage.permissions) : { enabled: false };
  if (!permissions) {
    return null;
  }
  permissions.enabledTo = Number(permissions?.enabledTo);

  permissions.enabled = permissions.enabledTo && Date.now() <= permissions.enabledTo;
  console.log('permissions', permissions);

  return permissions;
}

export async function setPermissions(key) {
  const storage = await getStorageItems(['permissions']);
  storage.permissions = key;
  await setStorageData(storage);
  return getPermissions();
}

function isValidKey(key) {
  const permissions = parsePermissions(key);
  return typeof permissions?.enabledTo !== 'undefined';
}
