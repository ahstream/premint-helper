import { fetchHelper, createLogger } from 'hx-lib';

const debug = createLogger();

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
  debug.log('cloud read result:', result);

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
  debug.log('wins to write', wins);

  const result = await fetchHelper(url, {
    method: 'POST',
    body: JSON.stringify({
      wins,
    }),
  });
  debug.log('cloud write result:', result);

  if (result.error || !result.data) {
    return { error: true, msg: result.msg || 'Invalid data returned from CLOUD_WRITE_WINS_URL' };
  }

  const data = JSON.parse(result.data);
  debug.log('parsed result data:', data);

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
  debug.log('cloud count result:', result);

  if (result.error) {
    return { error: true, msg: result.msg || 'Invalid data returned from CLOUD_COUNT_WINS_URL' };
  }

  return result.data.count;
}
