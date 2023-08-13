console.info('options.js begin', window?.location?.href);

import '../styles/options.scss';
import { createHashArgs, getStorageItems, setStorageData, createLogger } from '@ahstream/hx-utils';

const debug = createLogger();

// DATA ----------------------------------------------------------------------------

const INFO_ICON = chrome.runtime.getURL('images/info.png');

const MIN_TEXT_INPUT_LENGTH = 30;
const DEFAULT_TEXTAREA_ROWS = 3;

let storage;

// OPTIONS ----------------------------------------------------------------------------

/*
  options format:
    ['header', 'text'],
    ['header', 'text', 'hidden'],
    ['subheader', 'text'],
    ['subheader', 'text', 'hidden'],
    ['description', 'text'],
    ['space', 55],
    ['property', 'name', 'text', 'textAfter', 'info'],
    ['checkboxCombo', 'name1', 'text1', 'name2'],
  */

const options = [
  {
    header: 'General',
    hiddenKey: '',
    options: [
      [
        'description',
        'If enabled, a "Auto Join" button is added on raffle pages. Clicking this and Premint Helper will (try to) fulfill all raffle tasks and register for raffle.',
      ],
      ['property', 'ALPHABOT_ENABLE', 'Enable Alphabot raffle automation'],
      ['property', 'PREMINT_ENABLE', 'Enable Premint raffle automation'],
    ],
  },

  {
    header: 'Raffle Automation',
    hiddenKey: '',
    options: [
      [
        'property',
        'RAFFLE_SKIP_DONE_TASKS',
        'Skip raffle tasks already done before',
        null,
        'If Premint Helper have opened a task page before it can be skipped in future raffles.',
      ],
      ['space', 10],

      [
        'property',
        'RAFFLE_SWITCH_TWITTER_USER',
        'Switch to selected Twitter user',
        null,
        'If enabled, Premint Helper will switch to (on raffle page) selected Twitter user before fulfilling Twitter tasks.',
      ],
      ['space', 10],
      [
        'property',
        'RAFFLE_OPEN_TWITTER_LINK_DELAY',
        'Pause between opening Twitter raffle tasks',
        '(milliseconds)',
        'Best practice is pause a couple of seconds between opening Twitter task pages.',
      ],
      ['space', 10],

      [
        'description',
        'Having both these options enabled probably makes for a better experience. If Twitter is rate limiting you for opening too many pages too fast, it might be better to disable first option.',
      ],
      ['property', 'TWITTER_CLOSE_TASK_PAGE', 'Close Twitter task page as soon as task is finished', null, ''],
      ['property', 'RAFFLE_CLOSE_TASK_PAGES', 'Close all opened task pages when all tasks are finished', null, ''],
      ['space', 10],

      ['description', 'lorem...'],
      ['property', 'RAFFLE_RETRY_TIMES', 'RAFFLE_RETRY_TIMES', null, ''],
      ['property', 'RAFFLE_RETRY_SECS', 'RAFFLE_RETRY_SECS', null, ''],
    ],
  },

  {
    header: 'Non-Raffle Automation',
    hiddenKey: '',
    options: [
      [
        'description',
        'You can have Premint Helper automate Discord and Twitter Intent links when you open them yourself. For Discord, this means that when opening an invite link, Premint Helper will try to automate everything needed to join that server, including accepting rules etc. For Twitter, this means that intent links for follow/like/retweet will be automatically clicked.',
      ],
      [
        'property',
        'DISCORD_ENABLE_MANUAL',
        'Automate Discord pages opened manually',
        '',
        // 'If enabled, Premint Helper will auto join Discord invite links and then try to click all buttons that turn up when joining.',
      ],
      [
        'property',
        'TWITTER_ENABLE_MANUAL',
        'Automate Twitter pages opened manually',
        '',
        // 'If enabled, Premint Helper will auto click OK button on Twitter intent pages.',
      ],
    ],
  },

  {
    header: 'Twitter Followers Lookup',
    hiddenKey: '',
    options: [
      [
        'description',
        'Premint Helper can fetch follower counts for Twitter links on Alphabot pages. Best practice is to cache this to avoid fetching it too often from Twitter.',
      ],
      ['property', 'TWITTER_FOLLOWERS_CACHE_HOURS', 'Hours to cache Twitter followers', '', ''],
      [
        'description',
        'Since Twitter is getting more aggresive in rate limiting users it is best practice to use a burner Twitter user account for looking up follower counts. Otherwise you risk your main account have to wait a day before you can enter raffles with it again. Even so, using a burner account will likely hit rate limits on page views per 15 minutes, meaning you might have to wait up to 15 minutes before you can switch from burner to main account again.',
      ],
      ['property', 'TWITTER_FETCH_FOLLOWERS_USER', 'Twitter user for fetching followers', '', ''],

      ['description', 'Premint Helper can update follower count when opening a Twitter link.'],
      ['property', 'TWITTER_AUTO_UPDATE_FOLLOWERS', 'Auto update Twitter follower count when opening Twitter link', '', ''],
    ],
  },

  {
    header: 'Cloud Storage',
    hiddenKey: '',
    options: [
      [
        'description',
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
      ],
      [
        'radioButtons',
        'CLOUD_MODE',
        [
          ['disabled', 'Disable'],
          ['save', 'Save to cloud'],
          ['load', 'Load from cloud'],
        ],
      ],
      ['space', 10],
      ['property', 'CLOUD_TAG', 'Cloud tag'],
    ],
  },
  {
    header: 'Custom Data',
    hiddenKey: '',
    options: [
      [
        'description',
        'Properties below will be used to fill raffle forms if possible. Especially Premint raffles can have custom text fields.',
      ],
      [
        'table',
        [
          ['propertyCell', 'USER_INFO_EMAIL_ADDRESS', 'Email address'],
          ['propertyCell', 'USER_INFO_TWITTER_ALIAS', 'Twitter username'],
          ['propertyCell', 'USER_INFO_DISCORD_ALIAS', 'Discord username'],
          ['propertyCell', 'USER_INFO_ETH_WALLET', 'ETH wallet'],
          ['propertyCell', 'USER_INFO_BTC_WALLET', 'BTC Taproot wallet'],
          ['propertyCell', 'USER_INFO_SOL_WALLET', 'SOL wallet'],
          ['propertyCell', 'USER_INFO_TEZ_WALLET', 'TEZ wallet'],
        ],
      ],
    ],
  },

  {
    header: 'Aliases',
    hiddenKey: '',
    options: [
      [
        'description',
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
      ],
      ['property', 'WALLET_ALIAS', 'Wallet aliases'],
      ['space', 10],
      [
        'description',
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
      ],
      ['property', 'ACCOUNT_ALIAS', 'Account aliases'],
      ['space', 10],
      [
        'description',
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
      ],
      ['property', 'ALPHABOT_TRIM_NAMES', 'Trim Alphabot team names from raffle name'],
    ],
  },
];

// STARTUP ----------------------------------------------------------------------------

runNow();

async function runNow() {
  storage = await getStorageItems(['options']);
  debug.info('storage', storage);

  if (!storage?.options) {
    return debug.info('Options missing, exit!');
  }

  if (window.location.href.toLowerCase().includes('advanced')) {
    let allOptions = [];
    for (const item of Object.entries(storage.options)) {
      allOptions.push(['property', item[0], item[0]]);
    }
    debug.info(allOptions);
    debug.info(options);
    addOptions([
      {
        header: 'All options',
        options: [
          ['description', 'Only modify options in this view if you have been told to do it by Premint Helper developer!'],
          ...allOptions,
        ],
      },
    ]);
  } else {
    addOptions(options);
  }

  document.getElementById('saveBtn').addEventListener('click', () => saveOptions());
  document.getElementById('closeBtn').addEventListener('click', () => window.close());

  runPage();
}

function runPage() {
  debug.info('runPage; options:', storage.options);
}

// LIB FUNCTIONS ------------------------------------------------------------------------------

function addOptions(sectionsArr) {
  debug.info('addOptions', sectionsArr);

  const hashArgs = createHashArgs(window.location.hash);
  debug.info('hashArgs', hashArgs);

  let html = '';

  for (const section of sectionsArr) {
    if (section.hiddenKey && !hashArgs.has('config', section.hiddenKey)) {
      debug.info('Skip hidden config:', section);
      continue;
    }
    html = html + `<div class="section"><span>${section.header}</span></div>`;
    html = html + addOptionsArr(section.options);
  }
  document.getElementById('mount').innerHTML = html;
}

function addOptionsArr(optionsArr) {
  debug.info('addOptionsArr', optionsArr);

  let html = '';

  for (const option of optionsArr) {
    const key = option[0];

    if (key === 'table') {
      html = html + '<table>' + addOptionsArr(option[1]) + '</table>';
      continue;
    }

    if (key === 'subheader') {
      html = html + createSubheader(option[1]);
      continue;
    }

    if (key === 'description') {
      html = html + createDescription(option[1]);
      continue;
    }

    if (key === 'propertyCell') {
      const name = option[1];
      html = html + createPropertyCell(name, storage.options[name], option[2], option[3], option[4]);
      continue;
    }

    if (key === 'property') {
      const name = option[1];
      html = html + createProperty(name, storage.options[name], option[2], option[3], option[4]);
      continue;
    }

    if (key === 'radioButtons') {
      const name = option[1];
      html = html + createRadioButtons(name, storage.options[name], option[2], option[3]);
      continue;
    }

    if (key === 'checkboxCombo') {
      const name1 = option[1];
      const text1 = option[2];
      const name2 = option[3];
      html = html + createCheckboxCombo(name1, storage.options[name1], text1, name2, storage.options[name2]);
      continue;
    }

    if (key === 'space') {
      html = html + createSpace(option[1]);
      continue;
    }

    return html;
  }

  return html;
}

async function saveOptions(closeAfter = false) {
  debug.info('saveOptions', closeAfter);

  const radios = [...document.querySelectorAll('input[type="radio"]')];
  const cbs = [...document.querySelectorAll('input[type="checkbox"]')];
  const texts = [...document.querySelectorAll('input[type="text"]')];
  const textareas = [...document.querySelectorAll('textarea')];

  radios.forEach((r) => {
    if (r.checked) {
      storage.options[r.name] = r.value;
    }
  });

  cbs.forEach((cb) => {
    storage.options[cb.id] = cb.checked;
  });

  texts.forEach((text) => {
    const key = text.id;
    const val = typeof storage.options[key] === 'number' ? Number(text.value) : text.value;
    storage.options[key] = val;
  });

  textareas.forEach((textarea) => {
    const key = textarea.id;
    const val = textarea.value.split('\n').filter((x) => x.length);
    storage.options[key] = val;
  });

  await setStorageData(storage);
  debug.info('options', storage.options);

  document.getElementById('statusText').classList.toggle('visible');
  document.getElementById('statusText').textContent = 'Options saved!';
  if (closeAfter) {
    window.close();
  }
  setTimeout(function () {
    document.getElementById('statusText').classList.toggle('visible');
    document.getElementById('statusText').textContent = '';
  }, 2500);
}

function createSubheader(text) {
  return `<div class="subheader"><span>${text}</span></div>`;
}

function createDescription(text) {
  return `<div class="description"><span>${text}</span></div>`;
}

function createSpace(pixels) {
  return `<div class="space" style="height: ${pixels}px"></div>`;
}

function createRadioButtons(name, val, arr, infoText = null) {
  const infoHTML = infoText ? `<img class="info" src="${INFO_ICON}" title="${infoText}" />` : '';

  const radioHTML = arr.map((item) => {
    const checked = item[0] === val;
    return `<input type="radio" id="${item[0]}" name="${name}" value="${item[0]}" ${checked ? 'checked ' : ''}> <label for="${item[0]}">${
      item[1]
    }</label>`;
  });

  return `<div class="row">
      ${radioHTML.join('\n')}
      ${infoHTML}
    </div>`;
}

function createCheckboxCombo(name, val, text, name2, val2, minLength = MIN_TEXT_INPUT_LENGTH) {
  const labelText = typeof text === 'string' ? text : name;

  const valText = convertStringVal(val2, 'error');
  const valLength = valText.length;
  const length = valLength > minLength ? valLength : minLength;
  const typedLength = typeof val2 === 'number' ? 8 : length;

  return `<div class="row">
      <input type="checkbox" id="${name}" ${val ? 'checked' : ''} />
      <label for="${name}">${labelText}</label>
      <input type="text" id="${name2}" placeholder="" size="${typedLength}" value='${valText}' />
    </div>`;
}

function createProperty(name, val, text, textAfter = null, infoText = null, minLength = MIN_TEXT_INPUT_LENGTH) {
  const labelText = typeof text === 'string' ? text : name;

  const infoHTML = infoText ? `<img class="info" src="${INFO_ICON}" title="${infoText}" />` : '';

  if (typeof val === 'object') {
    if (typeof val.length === 'undefined') {
      debug.info('Skip invalid option:', name, val, text);
      return '';
    }
    let length = val.length > DEFAULT_TEXTAREA_ROWS ? DEFAULT_TEXTAREA_ROWS : Math.max(3, val.length);
    if (length === val.length) {
      length++;
    }
    const valText = valOrDefault(val.join('\n'), '');
    return `<div class="col">
      <label>${labelText}:</label>
      ${infoHTML}
      <textarea cols="100" rows="${length}" id="${name}">${valText}</textarea>
    </div>`;
  }

  if (typeof val === 'boolean') {
    return `<div class="row">
      <input type="checkbox" id="${name}" ${val ? 'checked' : ''} />
      <label for="${name}">${labelText}</label>
      ${infoHTML}
    </div>`;
  }

  const valText = convertStringVal(val, 'error');
  const valLength = valText.length;
  const length = valLength > minLength ? valLength : minLength;
  const typedLength = typeof val === 'number' ? 8 : length;
  const labelAfter = textAfter ? `<label class="labelAfter">${textAfter}</label>` : ``;
  return `<div class="row">
    <label>${labelText}:</label>
    <input type="text" id="${name}" placeholder="" size="${typedLength}" value='${valText}' />
    ${labelAfter}
    ${infoHTML}
  </div>`;
}

function createPropertyCell(name, val, text, textAfter = null, infoText = null, minLength = MIN_TEXT_INPUT_LENGTH) {
  const labelText = typeof text === 'string' ? text : name;

  const infoHTML = infoText ? `<img class="info" src="${INFO_ICON}" title="${infoText}" />` : '';

  if (typeof val === 'object') {
    let length = val.length > DEFAULT_TEXTAREA_ROWS ? DEFAULT_TEXTAREA_ROWS : Math.max(3, val.length);
    if (length === val.length) {
      length++;
    }
    const valText = valOrDefault(val.join('\n'), '');
    return `<tr><td NOWRAP>
      <label>${labelText}:</label>
      ${infoHTML}</td><td NOWRAP>
      <textarea cols="100" rows="${length}" id="${name}">${valText}</textarea>
    </td></tr>`;
  }

  const valText = convertStringVal(val, 'error');
  const valLength = valText.length;
  const length = valLength > minLength ? valLength : minLength;
  const typedLength = typeof val === 'number' ? 8 : length;
  const labelAfter = textAfter ? `<label class="labelAfter">${textAfter}</label>` : ``;
  const width = typedLength * 10 + 40;
  const styleHTML = `style="width:${width}px"`;
  return `<tr><td NOWRAP>
    <label>${labelText}:</label></td><td NOWRAP>
    <input type="text" id="${name}" placeholder="" ${styleHTML} value='${valText}' />
    ${labelAfter}
    ${infoHTML}
    </td></tr>`;
}

function valOrDefault(val, defaultVal) {
  const returnVal = val === undefined || val === null ? defaultVal : val;
  return returnVal;
}

function convertStringVal(val, defaultVal) {
  const newVal = valOrDefault(val, defaultVal);
  return newVal.toString();
}
