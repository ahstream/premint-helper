import { myConsole, noDuplicates, sleep, millisecondsAhead } from 'hx-lib';

import { normalizeTwitterHandle, normalizeDiscordHandle } from './premintHelperLib.js';

const console2 = myConsole();
console2.log();

// DATA ----------------------------------------------------------------------------------

//const ACCOUNT_URL = 'https://luckygo.io/profile';

//const WINS_BASE_URL = 'https://api.luckygo.io/raffle/list/me?type=won&page={PAGE}&size={SIZE}';

//const RAFFLES_BASE_URL =
//  'https://api.luckygo.io/raffle/list?community_type={COMMUNITY_TYPE}&project_type={PROJECT_TYPE}&sort_type={SORT_TYPE}&free_mint={FREE_MINT}&my_partial_guild_ids={MY_PARTIAL_GUILD_IDS}&my_particial_project_ids={MY_PARTIAL_PROJECT_IDS}&key_words={KEY_WORDS}&page={PAGE}&size={SIZE}';

// ACCOUNT -----------------------

// AUTH -------------------------------------------

// RAFFLE -------------------------------------------

// RAFFLES ----------------------------------------------------------------------------------

// WINS ----------------------------------------------------------------------------------

// RAFFLE API: WAITERS ---------------------------------------------

export async function waitForRafflePageLoaded(options, maxWait = null) {
  console2.info('Wait for raffle page to load');

  const toWait = typeof maxWait === 'number' ? maxWait : options.SUPERFUL_WAIT_FOR_RAFFLE_PAGE_LOADED;

  const stopTime = millisecondsAhead(toWait);
  while (Date.now() <= stopTime) {
    if (hasRegistered()) {
      return true;
    }
    const du = getDiscordHandle();
    const tu = getTwitterHandle();
    console2.log('du, tu:', du, tu);
    if (du || tu) {
      console2.info('Raffle page has loaded!');
      await sleep(1000);
      return true;
    }
    await sleep(1000);
  }

  console2.warn('Raffle page has NOT loaded!');
  return false;
}

// RAFFLE API: RAFFLE GETTERS ---------------------------------------------

export function getTwitterHandle({ normalize = true } = {}) {
  try {
    const h = [...[...document.querySelectorAll('div')].filter((x) => x.innerText === 'Twitter')][0]
      .nextSibling?.innerText;
    return !normalize ? h : normalizeTwitterHandle(h.replace('@', ''));
  } catch (e) {
    return '';
  }
}

export function getDiscordHandle({ normalize = true } = {}) {
  try {
    const h = [...[...document.querySelectorAll('div')].filter((x) => x.innerText === 'Discord')][0]
      .nextSibling?.innerText;
    return !normalize ? h : normalizeDiscordHandle(h);
  } catch (e) {
    return '';
  }
}

export function getMustJoinLinks() {
  try {
    const elems = [
      ...[...document.querySelectorAll('div')]
        .filter((x) => x.innerText.startsWith('Join') && x.innerText.endsWith('Discord'))[1]
        .querySelectorAll('a'),
    ]
      .filter((x) => x.href.includes('discord.'))
      .flat();
    const links = noDuplicates(elems.map((x) => x.href));
    console.log('getMustJoinLinks', elems, links);
    return { elems, links };
  } catch (e) {
    return { elems: [], links: [] };
  }
}

export function getMustFollowLinks() {
  try {
    const elems = [
      ...[...document.querySelectorAll('div')]
        .filter((x) => x.innerText.startsWith('Follow') && x.innerText.endsWith('On Twitter'))[1]
        .querySelectorAll('a'),
    ]
      .filter((x) => x.href.includes('twitter.com'))
      .flat();
    const links = noDuplicates(elems.map((x) => x.href));
    console.log('getMustFollowLinks', elems, links);
    return { elems, links };
  } catch (e) {
    return { elems: [], links: [] };
  }
}

export function getMustLikeLinks() {
  try {
    const elems = [
      ...[...document.querySelectorAll('div')]
        .filter(
          (x) =>
            x.innerText.startsWith('Must Like') &&
            !x.innerText.startsWith('Must Like & Retweet') &&
            x.innerText.endsWith('This Tweet')
        )[1]
        .querySelectorAll('a'),
    ]
      .filter((x) => x.href.includes('twitter.com'))
      .flat();
    const links = noDuplicates(elems.map((x) => x.href));
    console.log('getMustLikeLinks', elems, links);
    return { elems, links };
  } catch (e) {
    return { elems: [], links: [] };
  }
}

export function getMustRetweetLinks() {
  try {
    const elems = [
      ...[...document.querySelectorAll('div')]
        .filter(
          (x) =>
            x.innerText.startsWith('Must Retweet') &&
            !x.innerText.startsWith('Must Like & Retweet') &&
            x.innerText.endsWith('This Tweet')
        )[1]
        .querySelectorAll('a'),
    ]
      .filter((x) => x.href.includes('twitter.com'))
      .flat();
    const links = noDuplicates(elems.map((x) => x.href));
    console.log('getMustRetweetLinks', elems, links);
    return { elems, links };
  } catch (e) {
    return { elems: [], links: [] };
  }
}

export function getMustLikeAndRetweetLinks() {
  try {
    const elems = [
      ...[...document.querySelectorAll('div')]
        .filter((x) => x.innerText.startsWith('Must Like & Retweet') && x.innerText.endsWith('This Tweet'))[1]
        .querySelectorAll('a'),
    ]
      .filter((x) => x.href.includes('twitter.com'))
      .flat();
    const links = noDuplicates(elems.map((x) => x.href));
    console.log('getMustLikeAndRetweetLinks', elems, links);
    return { elems, links };
  } catch (e) {
    return { elems: [], links: [] };
  }
}

export function getSelectedWallet() {
  return null;
}

export function getWonWalletsByThisAccount() {
  return [];
}

export async function getRegisterButton(options, maxWait = 1000, interval = 10) {
  const stopTime = millisecondsAhead(maxWait);
  while (Date.now() <= stopTime) {
    const btn = getJoinButton();
    if (btn) {
      console2.log('getRegisterButton:', btn);
      return btn;
    }
    await sleep(interval);
  }
}

export function getRegisterButtonSync() {
  return getJoinButton();
}

export function getErrors() {
  return [];
}

export function getTeamName() {
  return '';
}

// RAFFLE API: HAS CHECKERS ---------------------------------------------

export function hasRegistered() {
  try {
    const elems = [...document.querySelectorAll('p.font-bold.text-sm.text-center')].filter(
      (x) => x.innerText === 'Deregister yourself'
    );
    //console.log('hasJoinedRaffle elems', elems);
    if (elems.length > 0) {
      return true;
    }

    if (document.body.innerText.match(/.*Congratulations.*/i)) {
      return true;
    }

    return false;

    // return !!(document.body.innerText.match(/*You have joined the raffle*/));
  } catch (e) {
    return false;
  }
}

export async function hasRaffleTrigger() {
  return !!getJoinButton();
}

export async function hasRaffleTrigger2() {
  return hasRaffleTrigger();
}

// RAFFLE API: IS CHECKERS ---------------------------------------------

export function isAllRegBtnsEnabled(options) {
  const regBtn = getRegisterButtonSync(options);
  // console2.log('regBtn', regBtn);
  if (regBtn?.disabled) {
    return false;
  }
  return !!regBtn;
}

// API HELPERS

export function getJoinButton() {
  try {
    return [...[...document.querySelectorAll('button.px-8')].filter((x) => (x.innerText = 'Join'))].filter(
      (x) => x.nextSibling?.innerText === 'Join'
    )[0];
  } catch (e) {
    return null;
  }
}

export function getJoiningButton() {
  try {
    return [
      ...[...document.querySelectorAll('button.px-8')].filter((x) => (x.innerText = 'Joining...')),
    ].filter((x) => x.nextSibling?.innerText === 'Join')[0];
  } catch (e) {
    return null;
  }
}

export function getRegisteringButton() {
  return getJoiningButton();
}

export function hasErrors() {
  return false;
  /*
  return (
    [...document.querySelectorAll('path')].filter(
      (x) =>
        x.getAttribute('d') ===
        'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z'
    ).length > 0
  );
  */
}
