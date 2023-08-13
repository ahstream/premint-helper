console.info('help.js begin', window?.location?.href);

import '../styles/help.scss';
import { getStorageData, dynamicSortMultiple, round } from '@ahstream/hx-utils';

// DATA ----------------------------------------------------------------------------------

let storage = null;

// STARTUP ----------------------------------------------------------------------------

runNow();

async function runNow() {
  storage = await getStorageData();
  console.info('storage', storage);
  console.info('storage.size', JSON.stringify(storage).length);
  addStorageSection();
}

function addStorageSection() {
  let results = [];
  for (const key in storage) {
    console.log(key, storage[key]);
    results.push({ key, size: JSON.stringify(storage[key]).length });
  }

  results.sort(dynamicSortMultiple('-size'));

  document.getElementById('mount-storage').innerHTML =
    '<ul class="storage">' +
    results
      .map((x) => {
        return `<li>${x.key}: ${sizeFormatter(x.size)}</li>`;
      })
      .join('') +
    `<li><b>TOTAL: ${sizeFormatter(JSON.stringify(storage).length)}</li>`;
  ('</ul>');
}

function sizeFormatter(bytes) {
  if (bytes >= 1000000) {
    return round(bytes / 1000000, 2) + ' MB';
  } else if (bytes >= 100000) {
    return round(bytes / 1000000, 2) + ' MB';
  } else {
    return round(bytes / 1000, 2) + ' kB';
  }
}
