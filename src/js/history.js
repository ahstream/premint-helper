import { getSearchParam } from '@ahstream/hx-lib';

export async function createHistory() {
  let hxhistory = null;
  let isModified = false;

  const load = async () => {
    // console.log('load history');
    const storage = await chrome.storage.local.get(['hxhistory']);
    hxhistory = storage.hxhistory || {};
    // console.log('loaded history:', hxhistory);
  };

  const _add = async (user, target, intent, key, val) => {
    // console.log('add history:', user, target, intent, key, val);

    if (!user || !target || !intent || !key) {
      // console.log('missing input!');
      return false;
    }

    if (!hxhistory) {
      await load();
    }
    if (!hxhistory[user]) {
      hxhistory[user] = {};
    }
    if (!hxhistory[user][target]) {
      hxhistory[user][target] = {};
    }
    if (!hxhistory[user][target][intent]) {
      hxhistory[user][target][intent] = {};
    }
    hxhistory[user][target][intent][key] = val;
    isModified = true;

    return true;
  };

  const save = async () => {
    if (isModified) {
      // console.log('save history!');
      await chrome.storage.local.set({ hxhistory });
      isModified = false;
      return;
    }
  };

  const get = () => {
    return hxhistory;
  };

  return {
    save,
    get,
    add: async (user, url) => {
      if (!hxhistory) {
        await load();
      }
      const intention = getIntention(url);
      // console.log('intention', intention);
      return await _add(user, intention.target, intention.intent, intention.key, Date.now());
    },
    has: async (user, url) => {
      if (!hxhistory) {
        await load();
      }
      const intention = getIntention(url);
      if (!hxhistory[user]) {
        return false;
      }
      if (!hxhistory[user][intention.target]) {
        return false;
      }
      if (!hxhistory[user][intention.target][intention.intent]) {
        return false;
      }
      if (!hxhistory[user][intention.target][intention.intent][intention.key]) {
        return false;
      }
      return true;
    },
  };
}

function getIntention(url) {
  let target = '';
  let intent = '';
  let key = '';
  if (!url.includes('https://twitter.com/')) {
    target = 'discord';
    intent = 'join';
    key = sluggifyUrl(url);
  } else if (url.includes('/intent/user')) {
    target = 'twitter';
    intent = 'follow';
    key = getSearchParam(url, 'screen_name');
  } else if (url.includes('/intent/like')) {
    target = 'twitter';
    intent = 'like';
    key = getSearchParam(url, 'tweet_id');
  } else if (url.includes('/intent/retweet')) {
    target = 'twitter';
    intent = 'retweet';
    key = getSearchParam(url, 'tweet_id');
  }

  return { target, intent, key };
}

function sluggifyUrl(url) {
  return url
    .replace('https://twitter.com/user/status/', '')
    .replace('https://twitter.com/', '')
    .replace('https://discord.gg/', '')
    .replace('https://discord.com/invite/', '');
}
