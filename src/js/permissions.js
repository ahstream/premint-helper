import { getStorageItems, setStorageData } from 'hx-lib';

// DATA ----------------------------------------------------------------------------------

// FUNCTIONS ----------------------------------------------------------------------------------

export async function showPermissions() {
  const key = await enterNewKey(await getSubscriptionInfo());
  if (key) {
    await setPermissions(key);
    window.alert(await getSubscriptionInfo());
  }
}

async function getSubscriptionInfo() {
  const p = await getPermissions();
  return p.enabled ? `Subscription active until ${new Date(p.enabledTo).toLocaleString()}` : 'No active subscription';
}

async function enterNewKey(prefix) {
  let promptText = `${prefix}\nEnter new subscription key?`;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const key = window.prompt(promptText, '');
    if (!key) {
      return null;
    }
    if (!isValidSubscriptionKey(key)) {
      promptText = `Invalid key! ${prefix}\nEnter new subscription key?`;
      continue;
    }
    return key;
  }
}

export async function getPermissions() {
  const storage = await getStorageItems(['permissions']);
  const permissionsString = storage?.permissions || '{}';
  console.log('permissionsString', permissionsString);
  const permissions = JSON.parse(permissionsString);

  permissions.enabled = permissions.enabledTo && Date.now() <= permissions.enabledTo;
  console.log('permissions', permissions);

  return permissions;
}

export async function setPermissions(keyTo) {
  const timestamp = parseInt(keyTo, 10) || 0;
  const now = Date.now();
  const maxToAdd = 1000 * 60 * 60 * 24 * 30;
  const enabledToNew = Math.min(now + maxToAdd, timestamp);
  console.log('timestamp', timestamp);
  console.log('now', now);
  console.log('maxToAdd', maxToAdd);
  console.log('enabledToNew', enabledToNew);
  console.log('now + maxToAdd', now + maxToAdd);
  console.log('now + timestamp', now + timestamp);
  console.log('enabledToNew', enabledToNew);

  const storage = await getStorageItems(['permissions']);
  const permissionsString = storage?.permissions || '{}';
  console.log('permissionsString', permissionsString);
  const permissions = JSON.parse(permissionsString);

  permissions.enabledTo = enabledToNew;
  permissions.enabledToText = new Date(enabledToNew).toLocaleString();
  permissions.enabled = permissions.enabledTo && Date.now() <= permissions.enabledTo;
  console.log('permissions', permissions);

  storage.permissions = JSON.stringify(permissions);

  await setStorageData(storage);
  console.log('storage', storage);

  return permissions;
}

function isValidSubscriptionKey(key) {
  const timestamp = parseInt(key, 10) || 0;
  return !!timestamp;
}
