const DEFAULT_PAUSE_BETWEEN_DISCORD_REQUESTS_MS = '3000';

run();

async function run() {
  return showGui();
}

async function getServerInfo(serverId, dataOnly = true) {
  const result = await discordGetRequest(`https://discord.com/api/v9/guilds/${serverId}`, 30);
  console.log('result', result);
  return dataOnly ? result?.data ?? null : result;
}

async function showGui(doSort = false) {
  let servers = window.hxDiscordServers;

  if (!servers) {
    servers = await getMyServers();
  }
  console.log('servers', servers);

  window.hxDiscordServers = servers;
  console.log('window.hxDiscordServers', window.hxDiscordServers);

  if (!servers.length) {
    window.alert('No servers found! Remember to run in mobile device mode!');
  }

  if (document.getElementById('hx-leave-discord')) {
    document.getElementById('hx-leave-discord').remove();
  }

  const div = document.createElement('div');
  div.id = 'hx-leave-discord';
  div.style.backgroundColor = '#b0edb4';
  div.style.position = 'absolute';
  div.style.padding = '20px';
  div.style.margin = '20px';
  div.style.zIndex = '999999';
  div.style.height = '90%';
  div.style.overflow = 'scroll';

  const btnLeave = document.createElement('button');
  btnLeave.innerText = 'Leave by Checked';
  btnLeave.style.padding = '10px';
  btnLeave.style.marginRight = '20px';
  btnLeave.addEventListener('click', leaveServersHandler);

  const btnLeaveIds = document.createElement('button');
  btnLeaveIds.innerText = 'Leave by Id';
  btnLeaveIds.style.padding = '10px';
  btnLeaveIds.style.marginRight = '20px';
  btnLeaveIds.addEventListener('click', leaveServerIdsHandler);

  const btnSort = document.createElement('button');
  btnSort.innerText = 'Sort';
  btnSort.style.padding = '10px';
  btnSort.style.marginRight = '20px';
  btnSort.addEventListener('click', () => showGui(true));

  const btnInvert = document.createElement('button');
  btnInvert.innerText = 'Invert';
  btnInvert.style.padding = '10px';
  btnInvert.style.marginRight = '20px';
  btnInvert.addEventListener('click', () => {
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    console.log('checkboxes', checkboxes);
    checkboxes.forEach((cb) => {
      cb.checked = !cb.checked;
    });
  });

  const btnClose = document.createElement('button');
  btnClose.innerText = 'Close';
  btnClose.style.padding = '10px';
  btnClose.addEventListener('click', () => {
    document.querySelector('#hx-leave-discord').remove();
  });

  div.append(btnLeave);
  div.append(btnLeaveIds);
  div.append(btnInvert);
  div.append(btnSort);
  div.append(btnClose);

  const span2 = document.createElement('span');
  span2.innerHTML = '<br><br><b>Discord Server Id:s</b>';
  div.append(span2);

  const div2 = document.createElement('div');

  const textarea = document.createElement('textarea');
  textarea.id = 'server-ids';
  textarea.cols = 70;
  textarea.rows = 3;
  div2.append(textarea);

  const span3 = document.createElement('span');
  span3.id = 'leaving-status';
  span3.innerHTML = '<br><br><b>Status</b>: Waiting...<br>';
  div2.append(span3);

  div.append(div2);

  const header = document.createElement('span');
  header.id = 'hx-header';
  if (doSort) {
    header.innerHTML = `<br><b>${servers.length} Discord Servers (days ago used)</b></span><br><br>`;
  } else {
    header.innerHTML = `<br><b>${servers.length} Discord Servers</b></span><br><br>`;
  }
  div.append(header);

  if (document.getElementById('hx-servers')) {
    document.getElementById('hx-servers').remove();
  }

  const divContent = document.createElement('div');
  divContent.id = 'hx-servers';

  const useServers = doSort ? sortServersByActivity(servers).reverse() : servers;

  useServers.forEach((server) => {
    const span = document.createElement('span');
    const daysAgo = !server.sortKey2
      ? null
      : Math.floor((Date.now() - server.sortKey2) / (24 * 60 * 60 * 1000));
    const name = server.name + (daysAgo !== null ? ' (' + daysAgo + ')' : '');
    span.innerHTML = `<input type="checkbox" value="${server.id}" id="${server.id}" style="margin-bottom: 10px;"><label for="${server.id}">${name}</label><br>`;
    divContent.append(span);
  });
  divContent.append(document.createElement('br'));

  div.append(divContent);

  document.body.append(div);
}

function sortServersByActivity(servers) {
  const SelectedGuildStore = getStorageItem('SelectedGuildStore');
  console.log('SelectedGuildStore', SelectedGuildStore);
  const timestamps = SelectedGuildStore['_state'].selectedGuildTimestampMillis;
  console.log('timestamps', timestamps);

  const servers2 = servers.map((x) => {
    return {
      ...x,
      sortKey2: timestamps[x.id] ?? 0,
    };
  });
  console.log('servers2', servers2);
  console.log(
    'servers2',
    servers2.map((x) => x.sortKey2)
  );
  console.log(
    'servers2',
    servers2.map((x) => typeof x.sortKey2)
  );
  const servers3 = servers2.sort((a, b) => a.sortKey2 - b.sortKey2);
  console.log('servers3', servers3);

  return servers3;
}

async function sortGuiByServerDate() {
  const divContent = document.getElementById('hx-servers');
  divContent.innerHTML = '';

  const servers = window.hxDiscordServers;

  const data = [];
  for (let server of servers) {
    document.getElementById('hx-header').innerHTML = `<br><b>Fetching create date for Discord server ${
      data.length + 1
    } of ${servers.length}</b></span><br><br>`;
    const info = await getServerInfo(server.id);
    console.log('info', info);
    info.sortKey = Number(info.id);
    data.push(info);
    await sleep(2000);
    if (data.length > 500) {
      break;
    }
  }
  console.log('data', data);
  data.sort((a, b) => a.sortKey <= b.sortKey);
  console.log('data2', data);

  document.getElementById(
    'hx-header'
  ).innerHTML = `<br><b>${servers.length} Discord Servers sorted by creation date</b></span><br><br>`;

  for (let server of data) {
    const span = document.createElement('span');
    span.innerHTML = `<input type="checkbox" value="${server.id}" id="${server.id}" style="margin-bottom: 10px;"><label for="${server.id}">${server.name}</label> (${server.sortKey})<br>`;
    divContent.append(span);
  }
  divContent.append(document.createElement('br'));
}

function updateLeavingStatus(content) {
  console.log('updateLeavingStatus', content);
  const elem = document.getElementById('leaving-status');
  console.log('elem', elem);
  elem.innerHTML = `<br><br><b>Status</b>: ${content}<br>`;
}

async function leaveServersHandler() {
  console.log('leaveServersHandler');
  const checkboxes = document.querySelectorAll('input[type="checkbox"]:checked');
  console.log('checkboxes', checkboxes);
  if (!window.confirm(`DO YOU WANT TO LEAVE ${checkboxes.length} SERVERS?`)) {
    return;
  }

  const ids = [];

  const serverIdsElem = document.getElementById('server-ids');
  let j = 0;
  let idsLeftStr = '';
  for (let cb of checkboxes) {
    if (!cb.checked) {
      continue;
    }
    const id = cb.id;
    j++;
    updateLeavingStatus(`Leaving server ${j}/${checkboxes.length}: ${id}`);
    console.log(`Leaving server ${j}/${checkboxes.length}: ${id}`);
    await discordApiLeaveServer(id);
    idsLeftStr = idsLeftStr + (!idsLeftStr ? id : `,${id}`);
    serverIdsElem.value = idsLeftStr;
    ids.push(id);
    cb.remove();
    const label = document.querySelector(`label[for="${id}"]`);
    console.log('label', label);
    if (label) {
      label.remove();
    }
    await sleep(DEFAULT_PAUSE_BETWEEN_DISCORD_REQUESTS_MS);
  }

  const servers = await getMyServers();
  console.log('servers', servers);

  document.getElementById(
    'hx-header'
  ).innerHTML = `<br><b>${servers.length} Discord Servers</b></span><br><br>`;

  window.alert(`Finished leaving ${checkboxes.length} servers!`);

  console.log([...checkboxes].map((cb) => cb.id));
  console.log('ids', ids);

  updateLeftServerIdsGui(ids);
}

async function leaveServerIdsHandler() {
  console.log('leaveServerIdsHandler');

  const ids = [...new Set(document.getElementById('server-ids').value.split(','))];
  console.log('ids', ids);

  const existingIds = [];
  const servers = await getMyServers();
  ids.forEach((id) => {
    if (servers.some((x) => x.id === id)) {
      existingIds.push(id);
    }
  });
  console.log('existingIds', existingIds);

  if (!existingIds.length) {
    window.alert('No servers to leave!');
    return;
  }

  if (
    !window.confirm(`YOU WERE JOINED TO ${existingIds.length} OF THOSE SERVERS? DO YOU WANT TO LEAVE THESE?`)
  ) {
    return;
  }

  const serverIdsElem = document.getElementById('server-ids');

  let j = 0;
  let idsLeftStr = '';
  for (let id of existingIds) {
    j++;
    updateLeavingStatus(`Leaving server ${j}/${existingIds.length}: ${id}`);
    console.log(`Leaving server ${j}/${existingIds.length}: ${id}`);
    await discordApiLeaveServer(id);
    idsLeftStr = idsLeftStr + (!idsLeftStr ? id : `,${id}`);
    serverIdsElem.value = idsLeftStr;
    await sleep(DEFAULT_PAUSE_BETWEEN_DISCORD_REQUESTS_MS);
  }

  const serversAfter = await getMyServers();
  console.log('serversAfter', serversAfter);

  document.getElementById(
    'hx-header'
  ).innerHTML = `<br><b>${serversAfter.length} Discord Servers</b></span><br><br>`;

  window.alert(`Finished leaving ${existingIds.length} servers!`);

  console.log('existingIds', existingIds);
  updateLeftServerIdsGui(existingIds);
}

function updateLeftServerIdsGui(ids) {
  document.getElementById('server-ids').value = ids.join(',');
}

async function doFetch(url, options) {
  try {
    console.debug('fetch:', url, options);
    var response = await fetch(url, options);
    const data = response.headers.get('content-type')?.includes('application/json')
      ? await response.json()
      : await response.text();
    return { data, response, error: response.ok ? 0 : response.status };
  } catch (e) {
    console.error('doFetch error:', e);
    return { data: null, response: e.response, e };
  }
}

function getResponseRateLimits(headers) {
  if (!headers) {
    return {};
  }
  const convertNum = (val) => (val !== null ? Number(val) : null);
  const rateLimits = {};
  rateLimits.RetryAfter = convertNum(headers.get('Retry-After'));
  rateLimits.XRateLimitLimit = convertNum(headers.get('X-RateLimit-Limit'));
  rateLimits.XRateLimitRemaining = convertNum(headers.get('X-RateLimit-Remaining'));
  rateLimits.XRateLimitReset = convertNum(headers.get('X-RateLimit-Reset'));
  rateLimits.XRateLimitResetAfter = convertNum(headers.get('X-RateLimit-Reset-After'));
  rateLimits.XRateLimitBucket = headers.get('X-RateLimit-Bucket');
  rateLimits.XRateLimitScope = headers.get('X-RateLimit-Scope');

  return rateLimits;
}

async function waitForRateLimits(rateLimits, thresholdMs = 1010) {
  console.debug('rateLimits', rateLimits);
  if (!rateLimits) {
    return;
  }
  if (rateLimits.RetryAfter) {
    const multiplier = rateLimits.RetryAfter > 100 ? 1 : 1000;
    const msecs = rateLimits.RetryAfter * multiplier;
    console.warn('RateLimited! RetryAfter (ms):', msecs, rateLimits);
    await sleep(msecs + thresholdMs);
    return;
  }
  if (rateLimits.XRateLimitRemaining === 1) {
    console.debug(
      'Almost RateLimited, wait for reset! XRateLimitResetAfter (sec):',
      rateLimits.XRateLimitResetAfter,
      rateLimits
    );
    await sleep(rateLimits.XRateLimitResetAfter * 1000 + 50);
    return;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function addToDate(date, { days = null, hours = null, minutes = null, seconds = null }) {
  const newDate = new Date(date);
  const secondsToAdd =
    (days ? days * 24 * 60 * 60 : 0) +
    (hours ? hours * 60 * 60 : 0) +
    (minutes ? minutes * 60 : 0) +
    (seconds ?? 0);
  newDate.setSeconds(newDate.getSeconds() + secondsToAdd);
  return newDate;
}

function discordStorageRestore() {
  if (window.localStorage) {
    return;
  }
  var getLocalStoragePropertyDescriptor = () => {
    const iframe = document.createElement('iframe');
    document.head.append(iframe);
    const pd = Object.getOwnPropertyDescriptor(iframe.contentWindow, 'localStorage');
    iframe.remove();
    return pd;
  };
  Object.defineProperty(window, 'localStorage', getLocalStoragePropertyDescriptor());
  const localStorage = getLocalStoragePropertyDescriptor().get.call(window);

  console.log('localStorage', localStorage);
}

function discordStorageAuthToken() {
  discordStorageRestore();
  return window.localStorage.getItem('token')?.replaceAll('"', '');
}

function getStorageItem(key) {
  discordStorageRestore();
  return JSON.parse(window.localStorage.getItem(key));
}

async function discordRequest(url, method, postData = {}) {
  await waitForRateLimits(window._discordRateLimits);
  const headers = {
    Accept: 'application/json, text/plain, */*',
    'Content-Type': 'application/json',
    authorization: await discordStorageAuthToken(),
  };
  const options = !postData ? { method, headers } : { method, headers, body: JSON.stringify(postData) };
  const result = await doFetch(url, options);
  window._discordRateLimits = getResponseRateLimits(result.response?.headers);
  return result;
}

async function discordRequestRetryWrapper(
  url,
  method,
  maxRetrySeconds,
  postData = null,
  sleepWhenErrorMs = 1010
) {
  if (!maxRetrySeconds) {
    return await discordRequest(url, method, postData);
  }

  var retryToDate = addToDate(new Date(), { seconds: maxRetrySeconds });
  let result = {};

  while (true) {
    result = await discordRequest(url, method, postData);
    console.debug('Result:', result);

    if (result.response?.ok) {
      return result;
    } else if (result.data?.code === 50001) {
      console.warn('Missing Access, server probably deleted? Skip!', result);
      return { error: true, ...result };
    } else if (result.response.status >= 400 && result.response.status < 500) {
      if (result.response.status === 429) {
        console.debug('429 retry');
      } else {
        return { error: true, ...result };
      }
    } else {
      console.debug('Result not ok, retry:', result);
      await sleep(sleepWhenErrorMs);
    }

    if (retryToDate < new Date()) {
      return { error: true, ...result };
    }

    console.debug('Retry...');
  }
}

async function discordGetRequest(url, maxRetrySeconds = 60) {
  return await discordRequestRetryWrapper(url, 'GET', maxRetrySeconds);
}

async function discordPostRequest(url, postData, maxRetrySeconds = 60) {
  return await discordRequestRetryWrapper(url, 'POST', maxRetrySeconds, postData);
}

async function discordPutRequest(url, postData, maxRetrySeconds = 0) {
  return await discordRequestRetryWrapper(url, 'PUT', maxRetrySeconds, postData);
}

async function discordDeleteRequest(url, postData, maxRetrySeconds = 0) {
  return await discordRequestRetryWrapper(url, 'DELETE', maxRetrySeconds, postData);
}

async function discordApiLeaveServer(serverId, dataOnly = false, maxRetrySeconds = 0) {
  const result = await discordDeleteRequest(
    `https://discord.com/api/v9/users/@me/guilds/${serverId}`,
    { lurking: false },
    maxRetrySeconds
  );
  return dataOnly ? result?.data ?? null : result;
}

async function discordApiGuilds(dataOnly = false, maxRetrySeconds = 90) {
  const result = await discordGetRequest(`https://discord.com/api/v9/users/@me/guilds`, maxRetrySeconds);
  return dataOnly ? result?.data ?? null : result;
}

function parseRequestJsonData(result) {
  if (!result || result.error) {
    console.log(`Error:`, result);
    return null;
  }
  if (!result.data || typeof result.data !== 'object') {
    console.log('Error, result is not proper json:', result);
    return null;
  }
  return result.data;
}

function parseRequestJson(result) {
  if (!result || typeof result !== 'object') {
    console.log('Error, result is not proper json:', result);
    return null;
  }
  return result;
}

async function getMyServers(inFolderNames = null) {
  const resultData = parseRequestJsonData(await discordApiGuilds());
  if (resultData === null || !resultData) {
    return [];
  }

  const servers = resultData;
  return servers;
}
