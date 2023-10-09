console.info('options.js begin', window?.location?.href);

import './options.css';

import { initOptionsPage, mountOptionsPage } from 'hx-chrome-lib';
import { createStatusbarButtons, STATUSBAR_DEFAULT_TEXT } from '../../js/premintHelperLib.js';
import { createStatusbar } from 'hx-statusbar';

// DATA ----------------------------------------------------------------------------

let pageState = {
  statusbar: null,
};

const options = [
  {
    header: 'General Settings',
    hiddenKey: '',
    options: [
      ['property', 'ALPHABOT_ENABLE', 'Enable raffle automation on Alphabot.app pages'],
      ['property', 'PREMINT_ENABLE', 'Enable raffle automation on Premint.xyz pages'],
      /*
      [
        'description',
        'You can have Premint Helper automate Discord and Twitter Intent links when you open them yourself. For Discord, this means that when opening an invite link, Premint Helper will try to automate everything needed to join that server, including accepting rules etc. For Twitter, this means that intent links for follow/like/retweet will be automatically clicked.',
      ],
      */
      ['space', 10],
      [
        'property',
        'DISCORD_ENABLE_MANUAL',
        'Automate manually opened Discord pages',
        '',
        'If enabled, Premint Helper will auto join Discord invite links and then try to click all buttons that turn up while joining server.',
      ],
      [
        'property',
        'TWITTER_ENABLE_MANUAL',
        'Automate manually opened Twitter pages',
        '',
        'If enabled, Premint Helper will auto click OK button on Twitter intent pages.',
      ],
    ],
  },

  {
    header: 'Raffle Settings',
    hiddenKey: '',
    options: [
      [
        'property',
        'RAFFLE_SKIP_DONE_TASKS',
        'Skip raffle tasks already done before',
        null,
        'If Premint Helper have opened a task page before it can be skipped in future raffles.',
      ],
      [
        'property',
        'RAFFLE_SWITCH_TWITTER_USER',
        'Switch to selected Twitter user',
        null,
        'If enabled, Premint Helper will switch to (on raffle page) selected Twitter user before fulfilling Twitter tasks.',
      ],
      [
        'property',
        'TWITTER_OPEN_LINKS_IN_SEQUENCE',
        'Fulfill Twitter tasks one at a time',
        null,
        'If disabled, all Twitter tasks will be opened at once (with configured delay between)',
      ],
      [
        'property',
        'RAFFLE_OPEN_TWITTER_LINK_DELAY',
        'Delay before opening next Twitter task (milliseconds)',
        '',
        'If fulfilling Twitter tasks one at a time you can set this short (500 ms), otherwise need to be longer (2500 ms) to avoid bot behaviour.',
      ],

      ['space', 15],
      [
        'property',
        'RAFFLE_FORCE_REGISTER',
        'Force join raffle if possible',
        null,
        'Alphabot can be buggy and show performed Twitter tasks as failed. This option will continue to click register button if this happens.',
      ],
      [
        'property',
        'RAFFLE_RETRY_TIMES',
        'Retry raffle join if failed',
        null,
        'If raffle join fails despite tasks being fulfilled, retry this many times',
      ],
      ['property', 'RAFFLE_RETRY_SECS', 'Wait between retries (seconds)', null, ''],

      ['space', 15],
      [
        'property',
        'TWITTER_CLOSE_TASK_PAGE',
        'Close Twitter page when task is finished',
        null,
        'If Twitter is rate limiting you for opening too many pages too fast, it might be better to disable this one.',
      ],
      ['property', 'RAFFLE_CLOSE_TASKS_BEFORE_JOIN', 'Close all task pages before joining raffle', null, ''],
      ['property', 'RAFFLE_CLOSE_TASKS_WHEN_FINISHED', 'Close all task pages when raffle is joined', null, ''],
      [
        'property',
        'RAFFLE_KEEP_ROLED_DISCORD_TASK_OPEN',
        'Do not close Discord pages that have role requirement ',
        null,
        'When raffle has Discord role requirement it is often needed to verify in server before getting that role. Keeping Discord task pages open in these cases makes it more convenient.',
      ],
    ],
  },

  {
    header: 'Auto-Start Settings',
    hiddenKey: '',
    options: [
      [
        'description',
        'These are only applicable when using Shortcuts to automate raffle joins. Minimize options makes it much easier to see which raffles need manual operation (captchas etc). See help page for more info.',
      ],
      ['property', 'RAFFLE_MINIMIZE_WHEN_FINISHED', 'Minimize raffle window when finished', null, ''],
      ['property', 'RAFFLE_CLEANUP_WHEN_FINISHED', 'Close all tabs except raffle tab + minimize window when finished', null, ''],
      ['space', 10],
      [
        'property',
        'ALPHABOT_IGNORED_NAMES',
        'Ignore Alphabot Teams',
        null,
        'Name of Alphabot teams to ignore when auto-start raffle join. Typically you may want to ignore raffles from teams that require an NFT you do not have.',
      ],
    ],
  },

  {
    header: 'Twitter Lookup Settings',
    hiddenKey: '',
    options: [
      [
        'property',
        'TWITTER_FOLLOWERS_CACHE_HOURS',
        'Hours to cache Twitter followers',
        '',
        'Premint Helper can fetch follower counts for Twitter links on Alphabot pages. Best practice is to cache this to avoid fetching it too often from Twitter.',
      ],
      ['space', 10],
      [
        'property',
        'TWITTER_AUTO_UPDATE_FOLLOWERS',
        'Auto update Twitter follower count when opening Twitter links',
        '',
        'Update follower count on Alphabot pages when opening Twitter links.',
      ],
      ['space', 10],
      [
        'description',
        'Since Twitter is getting more aggresive in rate limiting users it is good practice to use a burner Twitter user account for looking up follower counts. Otherwise you risk your main account have to wait a day before you can enter raffles with it again. Even so, using a burner account will likely hit rate limits on page views per 15 minutes, meaning you might have to wait up to 15 minutes before you can switch from burner to main account again.',
      ],
      ['property', 'TWITTER_FETCH_FOLLOWERS_USER', 'Twitter user for fetching followers', '', ''],
    ],
  },

  {
    header: 'Alphabot Result Settings',
    hiddenKey: '',
    options: [
      [
        'description',
        'If joining Alphabot raffles on multiple accounts you can collect results for all on Alphabot results page by using cloud storage. Set the same "Cloud tag" on all instances of Premint Helper. On main account, choose "Load from cloud", on other accounts choose "Save to cloud"',
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
      ['space', 20],
      ['property', 'WALLET_ALIAS', 'Wallet aliases', null, 'Use aliases for wallet addresses'],
      ['space', 20],
      ['property', 'ACCOUNT_ALIAS', 'Account aliases', null, 'Use aliases for account addresses'],
      ['space', 20],
      [
        'property',
        'ALPHABOT_TRIM_NAMES',
        'Remove Alphabot team names from raffle name',
        null,
        'Raffles often have team names included in them. Removing these makes results page easier to overview.',
      ],
      ['space', 10],
    ],
  },

  {
    header: 'Custom Data Settings',
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
];

// STARTUP ----------------------------------------------------------------------------

runNow();

async function runNow() {
  pageState = {
    statusbar: createStatusbar(STATUSBAR_DEFAULT_TEXT),
  };

  pageState.statusbar.buttons(
    createStatusbarButtons({
      options: 'disabled',
      results: true,
      reveal: 'disabled',
      followers: 'disabled',
    })
  );

  initOptionsPage();
  mountOptionsPage(options);
}
