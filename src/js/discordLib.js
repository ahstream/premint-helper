import global from './global.js';
console.log(global);

import { myConsole } from 'hx-lib';

import { isTwitterStatusPage } from './twitterLib';

const console2 = myConsole(global.LOGLEVEL);
console2.log();

// FUNCS ----------------------------------------------------------------------------------

export function isDiscordPage(url) {
  console.log('url', url);
  // eslint-disable-next-line no-useless-escape
  const m = url.match(/(https?:\/\/)?(www\.)?(discord\.(gg|io|me|li|com))/gi);
  console.log('m', m);
  return !!m;
}

export function getFirstTwitterStatusLink() {
  const hrefs = Array.from(document.querySelector('main').getElementsByTagName('a')).map((x) => x.href);
  console.log('getFirstTwitterStatusLink, hrefs:', hrefs);
  const href = hrefs.find((x) => isTwitterStatusPage(x));
  return href || '';
}

export function getActiveServerName() {
  return (
    document
      .querySelector('div[aria-label$="server actions"]')
      ?.ariaLabel?.replace(', server actions', '')
      ?.trim() || ''
  );
}
