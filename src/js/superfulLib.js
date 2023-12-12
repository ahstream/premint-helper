import { myConsole, noDuplicates } from 'hx-lib';
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

// RAFFLE GETTERS

export function getMustJoinLinks() {
  try {
    return noDuplicates(
      [
        ...[...document.querySelectorAll('div')]
          .filter((x) => x.innerText.startsWith('Join') && x.innerText.endsWith('Discord'))[1]
          .querySelectorAll('a'),
      ]
        .filter((x) => x.href.includes('discord.'))
        .map((x) => x.href)
    );
  } catch (e) {
    return [];
  }
}

export function getMustFollowLinks() {
  try {
    const elems = [
      ...[...document.querySelectorAll('div')]
        .filter((x) => x.innerText.startsWith('Follow') && x.innerText.endsWith('On Twitter'))[1]
        .querySelectorAll('a'),
    ].filter((x) => x.href.includes('twitter.com'));
    const links = noDuplicates(elems.map((x) => x.href));
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
    ].filter((x) => x.href.includes('twitter.com'));
    const links = noDuplicates(elems.map((x) => x.href));
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
    ].filter((x) => x.href.includes('twitter.com'));
    const links = noDuplicates(elems.map((x) => x.href));
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
    ].filter((x) => x.href.includes('twitter.com'));
    const links = noDuplicates(elems.map((x) => x.href));
    return { elems, links };
  } catch (e) {
    return { elems: [], links: [] };
  }
}

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

export function getRaffleTwitterHandle({ normalize = true } = {}) {
  try {
    const h = [...[...document.querySelectorAll('div')].filter((x) => x.innerText === 'Twitter')][0]
      .nextSibling?.innerText;
    return !normalize ? h : normalizeTwitterHandle(h.replace('@'));
  } catch (e) {
    return '';
  }
}

export function getRaffleDiscordHandle({ normalize = true } = {}) {
  try {
    const h = [...[...document.querySelectorAll('div')].filter((x) => x.innerText === 'Discord')][0]
      .nextSibling?.innerText;
    return !normalize ? h : normalizeDiscordHandle(h);
  } catch (e) {
    return '';
  }
}

export function getSelectedWallet() {
  return null;
  /*
  try {
    const elems = [...document.querySelectorAll('img')].filter((x) => x.src.includes('Ethereum-fill-brand'));
    if (!elems?.length) {
      return null;
    }
    const elem = elems[0].nextElementSibling;

    const shortWallet = elem?.innerText || '';
    const longWallet = '';
    const tokens = shortWallet.split('...');
    const shortPrefix = tokens.length >= 2 ? tokens[0] : '';
    const shortSuffix = tokens.length >= 2 ? tokens[1] : '';

    return { shortWallet, longWallet, shortPrefix, shortSuffix };
  } catch (e) {
    console2.error(e);
    return null;
  }
    */
}

export function getErrors() {
  return [];
}

// HAS GETTERS

export function hasJoinedRaffle() {
  try {
    const elems = [...document.querySelectorAll('p.font-bold.text-sm.text-center')].filter(
      (x) => x.innerText === 'Deregister yourself'
    );
    //console.log('hasJoinedRaffle elems', elems);
    return elems.length > 0;
    // return !!(document.body.innerText.match(/*You have joined the raffle*/));
  } catch (e) {
    return false;
  }
}

export function hasErrors() {
  return (
    [...document.querySelectorAll('path')].filter(
      (x) =>
        x.getAttribute('d') ===
        'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z'
    ).length > 0
  );
}

export async function hasRaffleTrigger() {
  return !!getJoinButton();
}

export async function hasRaffleTrigger2() {
  return hasRaffleTrigger();
}

// HELPERS
