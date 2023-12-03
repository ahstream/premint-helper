import { fetchHelper, myConsole } from 'hx-lib';

const console2 = myConsole();

// DATA ----------------------------------------------------------------------------------

// FUNCTIONS ----------------------------------------------------------------------------------

export async function readWins(fromTimestamp, options) {
  const url = options.CLOUD_READ_WINS_URL;
  const tag = options.CLOUD_TAG;

  if (!url) {
    return { error: true, msg: 'Missing CLOUD_WRITE_WINS_URL' };
  }
  if (!tag) {
    return { error: true, msg: 'Missing CLOUD_TAG' };
  }

  const result = await fetchHelper(url, {
    method: 'POST',
    body: JSON.stringify({
      hxTag: tag,
      timestamp: fromTimestamp,
    }),
  });
  console2.log('cloud read result:', result);

  if (result.error) {
    return { error: true, msg: result.msg || 'Invalid data returned from CLOUD_READ_WINS_URL' };
  }

  return result.data;
}

export async function writeWins(wins, options) {
  const url = options.CLOUD_WRITE_WINS_URL;
  const tag = options.CLOUD_TAG;

  if (!wins?.length) {
    return { ok: true, count: 0 };
  }
  if (!url) {
    return { error: true, msg: 'Missing CLOUD_WRITE_WINS_URL' };
  }
  if (!tag) {
    return { error: true, msg: 'Missing CLOUD_TAG' };
  }

  wins.forEach((win) => (win.hxTag = tag));
  console2.log('wins to write', wins);

  const result = await fetchHelper(url, {
    method: 'POST',
    body: JSON.stringify({
      wins,
    }),
  });
  console2.log('cloud write result:', result);

  if (result.error || !result.data) {
    return { error: true, msg: result.msg || 'Invalid data returned from CLOUD_WRITE_WINS_URL' };
  }

  const data = JSON.parse(result.data);
  console2.log('parsed result data:', data);

  if (!data.ok) {
    return { error: true, msg: `Invalid response when saving to cloud: ${data.msg}` };
  }

  return { ...data, count: data.length };
}

export async function countWins(provider, userId, options) {
  const url = options.CLOUD_COUNT_WINS_URL;
  const tag = options.CLOUD_TAG;

  if (!url) {
    return { error: true, msg: 'Missing CLOUD_COUNT_WINS_URL' };
  }
  if (!tag) {
    return { error: true, msg: 'Missing CLOUD_TAG' };
  }

  const result = await fetchHelper(url, {
    method: 'POST',
    body: JSON.stringify({
      hxTag: tag,
      provider,
      userId,
    }),
  });
  console2.log('cloud count result:', result);

  if (result.error) {
    return { error: true, msg: result.msg || 'Invalid data returned from CLOUD_COUNT_WINS_URL' };
  }

  return result.data.count;
}

export async function readProjectWins(options) {
  const url = options.CLOUD_READ_PROJECT_WINS_URL;
  const tag = options.CLOUD_TAG;

  if (!url) {
    return { error: true, msg: 'Missing CLOUD_READ_PROJECT_WINS_URL' };
  }
  if (!tag) {
    return { error: true, msg: 'Missing CLOUD_TAG' };
  }

  const result = await fetchHelper(url, {
    method: 'POST',
    body: JSON.stringify({
      hxTag: tag,
    }),
  });
  console2.log('cloud read project wins result:', result);

  if (result.error || !result.data?.length || !result.data[0].wins) {
    return { error: true, msg: result.msg || 'Invalid data returned from CLOUD_READ_PROJECT_WINS_URL' };
  }

  if (result.data.length > 1) {
    console.warn('Result array > expected 1', result);
  }

  return result.data[0].wins;
}

export async function writeProjectWins(wins, options) {
  const url = options.CLOUD_WRITE_PROJECT_WINS_URL;
  const tag = options.CLOUD_TAG;

  if (!wins) {
    return { ok: true };
  }
  if (!url) {
    return { error: true, msg: 'Missing CLOUD_WRITE_PROJECT_WINS_URL' };
  }
  if (!tag) {
    return { error: true, msg: 'Missing CLOUD_TAG' };
  }

  console2.log('project wins to write', wins);

  const result = await fetchHelper(url, {
    method: 'POST',
    body: JSON.stringify({
      hxTag: tag,
      wins,
    }),
  });
  console2.log('cloud write project wins result:', result);

  if (result.error || !result.data) {
    return { error: true, msg: result.msg || 'Invalid data returned from CLOUD_WRITE_PROJECT_WINS_URL' };
  }

  const data = JSON.parse(result.data);
  console2.log('parsed result data:', data);

  if (!data.ok) {
    return { error: true, msg: `Invalid response when saving to cloud: ${data.msg}` };
  }

  return { ...data };
}

export async function readProjectWins2(fromTimestamp, options) {
  const url = options.CLOUD_READ_PROJECT_WINS_URL2;
  const tag = options.CLOUD_TAG;

  if (!url) {
    return { error: true, msg: 'Missing CLOUD_READ_PROJECT_WINS_URL2' };
  }
  if (!tag) {
    return { error: true, msg: 'Missing CLOUD_TAG' };
  }

  const result = await fetchHelper(url, {
    method: 'POST',
    body: JSON.stringify({
      hxTag: tag,
      timestamp: fromTimestamp,
    }),
  });
  console2.log('cloud read project wins result:', result);

  if (result.error) {
    return { error: true, msg: result.msg || 'Invalid data returned from CLOUD_READ_PROJECT_WINS_URL2' };
  }

  return result.data;
}

export async function writeProjectWins2(wins, options) {
  const url = options.CLOUD_WRITE_PROJECT_WINS_URL2;
  const tag = options.CLOUD_TAG;

  if (!wins?.length) {
    return { ok: true, count: 0 };
  }
  if (!url) {
    return { error: true, msg: 'Missing CLOUD_WRITE_PROJECT_WINS_URL2' };
  }
  if (!tag) {
    return { error: true, msg: 'Missing CLOUD_TAG' };
  }

  wins.forEach((win) => (win.hxTag = tag));
  console2.log('wins to write', wins);

  const result = await fetchHelper(url, {
    method: 'POST',
    body: JSON.stringify({
      wins,
    }),
  });
  console2.log('cloud write result:', result);

  if (result.error || !result.data) {
    return { error: true, msg: result.msg || 'Invalid data returned from CLOUD_WRITE_WINS_URL' };
  }

  const data = JSON.parse(result.data);
  console2.log('parsed result data:', data);

  if (!data.ok) {
    return { error: true, msg: `Invalid response when writing to cloud: ${data.msg}` };
  }

  return { ...data, count: data.length };
}

export async function countProjectWins2(options) {
  const url = options.CLOUD_COUNT_PROJECT_WINS_URL2;
  const tag = options.CLOUD_TAG;

  if (!url) {
    return { error: true, msg: 'Missing CLOUD_COUNT_PROJECT_WINS_URL2' };
  }
  if (!tag) {
    return { error: true, msg: 'Missing CLOUD_TAG' };
  }

  const result = await fetchHelper(url, {
    method: 'POST',
    body: JSON.stringify({
      hxTag: tag,
    }),
  });
  console2.log('cloud count result:', result);

  if (result.error) {
    return { error: true, msg: result.msg || 'Invalid data returned from CLOUD_COUNT_PROJECT_WINS_URL2' };
  }

  return result.data.count;
}
