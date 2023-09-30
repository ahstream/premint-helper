import { getStorageItems, setStorageData } from 'hx-lib';

// DATA ----------------------------------------------------------------------------------

// FUNCTIONS ----------------------------------------------------------------------------------

export async function showPermissions() {
  const p = await getPermissions();
  if (p.enabled) {
    window.alert(`Subscription active until ${new Date(p.enabledTo).toLocaleString()}`);
    return;
  }

  let promptText = 'No active subscription. Enter subscription key:';
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const key = window.prompt(promptText, '');
    if (!key) {
      return;
    }
    if (!isValidSubscriptionKey(key)) {
      promptText = 'Invalid key. Enter new subscription key:';
      continue;
    }
    await setPermissions(key);
    return showPermissions();
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
