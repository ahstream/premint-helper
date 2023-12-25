console.info('options.js begin', window?.location?.href);

import './options.css';

import global from '../../js/global.js';
console.log(global);

import { initOptionsPage, mountOptionsPage } from 'hx-chrome-lib';

import { createStatusbar, loadStorage } from '../../js/premintHelperLib.js';

// DATA ----------------------------------------------------------------------------

let storage = {};

const options = [
  // Alphabot.app Raffles
  {
    header: 'Alphabot.app Raffles',
    hiddenKey: '',
    options: [
      ['property', 'ALPHABOT_ENABLE', 'Enable raffle automation on alphabot.app website'],
      ['property', 'ALPHABOT_ENABLE_TWITTER_TASKS', 'Enable Twitter tasks'],
      ['property', 'ALPHABOT_ENABLE_RESULTS', 'Enable fetch of results'],
      ['property', 'ALPHABOT_RESULTS_MAX_FETCH_WINS', 'Max new results to fetch'],
      ['property', 'ALPHABOT_ENABLE_RAFFLE_LIST', 'ALPHABOT_ENABLE_RAFFLE_LIST'],
    ],
  },

  // Premint.xyz Raffles
  {
    header: 'Premint.xyz Raffles',
    hiddenKey: '',
    options: [
      ['property', 'PREMINT_ENABLE', 'Enable raffle automation on premint.xyz website'],
      ['property', 'PREMINT_ENABLE_TWITTER_TASKS', 'Enable Twitter tasks'],
      ['property', 'PREMINT_ENABLE_DISCORD_TASKS', 'Enable Discord tasks'],
      ['property', 'PREMINT_ENABLE_RESULTS', 'Enable fetch of results'],
      ['property', 'PREMINT_RESULTS_MAX_FETCH_WINS', 'Max new results to fetch'],
    ],
  },

  // Superful.xyz Raffles
  {
    header: 'Superful.xyz Raffles',
    hiddenKey: '',
    options: [
      ['property', 'SUPERFUL_ENABLE', 'Enable raffle automation on superful.xyz.io website'],
      ['property', 'SUPERFUL_ENABLE_TWITTER_TASKS', 'Enable Twitter tasks'],
      ['property', 'SUPERFUL_ENABLE_DISCORD_TASKS', 'Enable Discord tasks'],
      ['property', 'SUPERFUL_ENABLE_RESULTS', 'Enable fetch of results'],
      ['property', 'SUPERFUL_RESULTS_MAX_FETCH_WINS', 'Max new results to fetch'],
      ['property', 'SUPERFUL_ENABLE_RAFFLE_LIST', 'SUPERFUL_ENABLE_RAFFLE_LIST'],
    ],
  },

  // LuckyGo.io Raffles
  {
    header: 'LuckyGo.io Raffles',
    hiddenKey: '',
    options: [
      ['property', 'LUCKYGO_ENABLE', 'Enable raffle automation on luckygo.io website'],
      ['property', 'LUCKYGO_ENABLE_TWITTER_TASKS', 'Enable Twitter tasks'],
      ['property', 'LUCKYGO_ENABLE_DISCORD_TASKS', 'Enable Discord tasks'],
      ['property', 'LUCKYGO_ENABLE_RESULTS', 'Enable fetch of results'],
      ['property', 'LUCKYGO_RESULTS_MAX_FETCH_WINS', 'Max new results to fetch'],
      ['property', 'LUCKYGO_ENABLE_RAFFLE_LIST', 'LUCKYGO_ENABLE_RAFFLE_LIST'],
    ],
  },

  // Atlas3.io Raffles
  {
    header: 'Atlas3.io Raffles',
    hiddenKey: '',
    options: [
      ['property', 'ATLAS_ENABLE', 'Enable raffle automation on atlas3.io website'],
      ['property', 'ATLAS_ENABLE_TWITTER_TASKS', 'Enable Twitter tasks'],
      ['property', 'ATLAS_ENABLE_DISCORD_TASKS', 'Enable Discord tasks'],
      ['property', 'ATLAS_ENABLE_RESULTS', 'Enable fetch of results'],
      ['property', 'ATLAS_RESULTS_MAX_FETCH_WINS', 'Max new results to fetch'],
      ['property', 'ATLAS_SKIP_REQS_IF_READY', 'Skip task requirements if ready to register'],
    ],
  },

  // Raffle Behaviour
  {
    header: 'Raffle Behaviour',
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
        'If enabled, Premint Helper will switch to selected Twitter user on Twitter page before fulfilling Twitter tasks.',
      ],

      ['space', 22],

      [
        'property',
        'TWITTER_QUEUE_TASK_LINKS',
        'Open next Twitter task when previous one has finished',
        null,
        'If disabled, all Twitter tasks will be opened at once (with configured delay below)',
      ],
      [
        'property',
        'RAFFLE_OPEN_AT_ONCE_TWITTER_LINK_DELAY',
        'Delay between Twitter tasks if not waiting for previous task to finish  (milliseconds)',
        '',
        'This need to be long enough to avoid bot behaviour.',
      ],

      ['space', 22],

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

      ['space', 22],

      [
        'property',
        'TWITTER_CLOSE_TASK_PAGE',
        'Close Twitter page when task is finished',
        null,
        'If Twitter is rate limiting you for opening too many pages too fast, it might be better to disable this one.',
      ],
      ['property', 'RAFFLE_CLOSE_TASKS_BEFORE_JOIN', 'Close all task pages before joining raffle', null, ''],
      [
        'property',
        'RAFFLE_CLOSE_TASKS_WHEN_FINISHED',
        'Close all task pages when raffle is joined',
        null,
        '',
      ],

      ['space', 22],

      [
        'property',
        'RAFFLE_KEEP_ROLED_DISCORD_TASK_OPEN',
        'Do not close Discord pages that have role requirement ',
        null,
        'When raffle has Discord role requirement it is often needed to verify in server before getting that role. Keeping Discord task pages open in these cases makes it more convenient.',
      ],
    ],
  },

  // Discord
  {
    header: 'Discord',
    hiddenKey: '',
    options: [
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
    ],
  },

  // Twitter
  {
    header: 'Twitter',
    hiddenKey: '',
    options: [
      [
        'property',
        'TWITTER_ENABLE_MANUAL',
        'Automate manually opened Twitter pages',
        '',
        'If enabled, Premint Helper will auto click OK button on Twitter intent pages.',
      ],
      ['space', 10],
      [
        'property',
        'TWITTER_MAX_LOOKUPS',
        'Max Twitter follower lookups per time',
        '',
        'Each lookup request will only lookup this many Twitter accounts to avoid bot detection',
      ],
      ['space', 10],
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

  // Cloud
  {
    header: 'Cloud',
    hiddenKey: '',
    options: [
      [
        'description',
        'If joining raffles with multiple users you can collect results for all by using cloud storage. Set the same "Cloud tag" on all instances of Premint Helper. On main account, choose "Load from cloud", on other accounts choose "Save to cloud"',
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

  // Aliases
  {
    header: 'Aliases',
    hiddenKey: '',
    options: [
      ['property', 'WALLET_ALIAS', 'Wallet aliases', null, 'Use aliases for wallet addresses'],
      ['space', 20],
      ['property', 'ACCOUNT_ALIAS', 'Account aliases', null, 'Use aliases for account addresses'],
      /*
      ['space', 20],
      [
        'property',
        'ALPHABOT_TRIM_NAMES',
        'Remove Alphabot team names from raffle name',
        null,
        'Raffles often have team names included in them. Removing these makes results page easier to overview.',
      ],
      ['space', 10],
      */
    ],
  },

  // Custom Data
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

  // Results Page
  {
    header: 'Results Page',
    hiddenKey: '',
    options: [
      [
        'property',
        'RESULTS_DAYS_TO_KEEP_MINTED_WINS',
        'Show this many previous days of results',
        '',
        'Default behaviour is that wins with a set mint date will not be shown when date has passed. If drop have multiple day phases, it would not be shown after first day has passed. Use this setting to prevent that.',
      ],
      [
        'property',
        'RESULTS_PREV_WINS_LIFETIME_MINT_DAYS',
        'RESULTS_PREV_WINS_LIFETIME_MINT_DAYS',
        '',
        'RESULTS_PREV_WINS_LIFETIME_MINT_DAYS',
      ],
      [
        'property',
        'RESULTS_PREV_WINS_LIFETIME_PICKED_DAYS',
        'RESULTS_PREV_WINS_LIFETIME_PICKED_DAYS',
        '',
        'RESULTS_PREV_WINS_LIFETIME_PICKED_DAYS',
      ],
      [
        'property',
        'ALPHABOT_CALENDAR_BACK_MONTHS',
        'ALPHABOT_CALENDAR_BACK_MONTHS',
        '',
        'ALPHABOT_CALENDAR_BACK_MONTHS',
      ],
      [
        'property',
        'ALPHABOT_CALENDAR_FORWARD_MONTHS',
        'ALPHABOT_CALENDAR_FORWARD_MONTHS',
        '',
        'ALPHABOT_CALENDAR_FORWARD_MONTHS',
      ],
    ],
  },

  // Raffles Page
  {
    header: 'Raffles Page',
    hiddenKey: '',
    options: [
      ['property', 'RAFFLE_LIST_MAX_DAYS_OLD', 'RAFFLE_LIST_MAX_DAYS_OLD', '', ''],
      ['property', 'RAFFLE_LIST_MAX_ITEMS', 'RAFFLE_LIST_MAX_ITEMS', '', ''],
      ['property', 'RAFFLE_LIST_SKIP_DUPS', 'RAFFLE_LIST_SKIP_DUPS', '', ''],
      ['property', 'RAFFLE_LIST_SKIP_SEARCH_DUPS', 'RAFFLE_LIST_SKIP_SEARCH_DUPS', '', ''],

      ['space', 10],
      ['property', 'RAFFLE_LIST_FETCH_LUCKYGO_RAFFLES', 'RAFFLE_LIST_FETCH_LUCKYGO_RAFFLES', '', ''],

      ['description', 'Default config'],
      ['property', 'RAFFLE_LIST_FILTER_MINUTES', 'RAFFLE_LIST_FILTER_MINUTES', '', ''],
      ['property', 'RAFFLE_LIST_FILTER_PCT', 'RAFFLE_LIST_FILTER_PCT', '', ''],
      ['property', 'RAFFLE_LIST_FILTER_REQ_DISCORD', 'RAFFLE_LIST_FILTER_REQ_DISCORD', '', ''],
      ['property', 'RAFFLE_LIST_FILTER_REQ_FOLLOW', 'RAFFLE_LIST_FILTER_REQ_FOLLOW', '', ''],
      ['property', 'RAFFLE_LIST_FILTER_REQ_LIKE', 'RAFFLE_LIST_FILTER_REQ_LIKE', '', ''],
      ['property', 'RAFFLE_LIST_FILTER_REQ_RETWEET', 'RAFFLE_LIST_FILTER_REQ_RETWEET', '', ''],
      ['property', 'RAFFLE_LIST_FILTER_EASY', 'RAFFLE_LIST_FILTER_EASY', '', ''],
      ['space', 10],

      ['description', 'Easy config'],
      ['property', 'RAFFLE_LIST_FILTER_MINUTES_EASY', 'RAFFLE_LIST_FILTER_MINUTES_EASY', '', ''],
      ['property', 'RAFFLE_LIST_FILTER_PCT_EASY', 'RAFFLE_LIST_FILTER_PCT_EASY', '', ''],
      ['property', 'RAFFLE_LIST_FILTER_REQ_DISCORD_EASY', 'RAFFLE_LIST_FILTER_REQ_DISCORD_EASY', '', ''],
      ['property', 'RAFFLE_LIST_FILTER_REQ_FOLLOW_EASY', 'RAFFLE_LIST_FILTER_REQ_FOLLOW_EASY', '', ''],
      ['property', 'RAFFLE_LIST_FILTER_REQ_LIKE_EASY', 'RAFFLE_LIST_FILTER_REQ_LIKE_EASY', '', ''],
      ['property', 'RAFFLE_LIST_FILTER_REQ_RETWEET_EASY', 'RAFFLE_LIST_FILTER_REQ_RETWEET_EASY', '', ''],
      ['space', 10],

      ['space', 10],
      ['property', 'RAFFLE_LIST_SEARCH_QUERY', 'RAFFLE_LIST_SEARCH_QUERY', '', 'RAFFLE_LIST_SEARCH_QUERY'],

      ['space', 10],
      ['description', 'RAFFLE_LIST_MY_TEAMS config'],
      ['property', 'RAFFLE_LIST_MY_TEAMS', 'RAFFLE_LIST_MY_TEAMS', '', 'RAFFLE_LIST_MY_TEAMS'],

      ['space', 10],
      ['description', 'Search terms'],
      ['property', 'RAFFLE_LIST_SEARCH_TOP', 'RAFFLE_LIST_SEARCH_TOP', '', 'RAFFLE_LIST_SEARCH_TOP'],
      ['property', 'RAFFLE_LIST_SEARCH_GREAT', 'RAFFLE_LIST_SEARCH_GREAT', '', 'RAFFLE_LIST_SEARCH_GREAT'],
      ['property', 'RAFFLE_LIST_SEARCH_GOOD', 'RAFFLE_LIST_SEARCH_GOOD', '', 'RAFFLE_LIST_SEARCH_GOOD'],
      ['property', 'RAFFLE_LIST_SEARCH_EARLY', 'RAFFLE_LIST_SEARCH_EARLY', '', 'RAFFLE_LIST_SEARCH_EARLY'],
    ],
  },

  // External automation
  {
    header: 'External automation',
    hiddenKey: '',
    options: [
      [
        'description',
        'These are only applicable when using Shortcuts to automate raffle joins. Minimize options makes it much easier to see which raffles need manual operation (captchas etc). See help page for more info.',
      ],
      ['property', 'RAFFLE_MINIMIZE_WHEN_FINISHED', 'Minimize browser window when finished', null, ''],
      [
        'property',
        'RAFFLE_CLEANUP_WHEN_FINISHED',
        'Close all tabs except raffle tab when finished',
        null,
        '',
      ],
      ['space', 10],
      [
        'property',
        'ALPHABOT_IGNORED_NAMES',
        'Ignore Alphabot Teams',
        null,
        'Name of Alphabot teams to ignore when auto-start raffle join. Typically you may want to ignore raffles from teams that require an NFT you do not have.',
      ],
      ['space', 10],

      ['property', 'IS_MAIN_ACCOUNT', 'IS_MAIN_ACCOUNT', null, 'IS_MAIN_ACCOUNT'],

      ['property', 'IS_FIRST_SUB_ACCOUNT', 'IS_FIRST_SUB_ACCOUNT', null, 'IS_FIRST_SUB_ACCOUNT'],
    ],
  },

  // Raid
  {
    header: 'Raid',
    hiddenKey: '',
    options: [
      ['description', 'LOREM'],

      [
        'property',
        'RAID_FROM_TWITTER_PAGE_FULL',
        'RAID_FROM_TWITTER_PAGE_FULL',
        '',
        'RAID_FROM_TWITTER_PAGE_FULL',
      ],
      [
        'property',
        'RAID_FROM_DISCORD_PAGE_FULL',
        'RAID_FROM_DISCORD_PAGE_FULL',
        '',
        'RAID_FROM_DISCORD_PAGE_FULL',
      ],
      ['space', 10],
      ['property', 'RAID_MIN_EMOJIS', 'RAID_MIN_EMOJIS', '', 'RAID_MIN_EMOJIS'],
      ['property', 'RAID_MAX_EMOJIS', 'RAID_MAX_EMOJIS', '', 'RAID_MAX_EMOJIS'],
      ['property', 'RAID_EMOJIS', 'RAID_EMOJIS', null, ''],
      ['space', 10],

      ['property', 'RAID_TEXTS', 'RAID_TEXTS', null, ''],
      ['property', 'RAID_TEAM_TEXTS', 'RAID_TEAM_TEXTS', null, ''],
      ['property', 'RAID_TEAM_NAMES', 'RAID_TEAM_NAMES', null, ''],
    ],
  },

  // Misc
  {
    header: 'Misc',
    hiddenKey: '',
    options: [
      ['description', 'LOREM'],

      ['property', 'DEFAULT_LOCALE', 'DEFAULT_LOCALE', '', 'DEFAULT_LOCALE'],

      ['space', 10],

      ['property', 'STATUSBAR_HIDE_TIME_SHORT', 'STATUSBAR_HIDE_TIME_SHORT', '', 'STATUSBAR_HIDE_TIME_SHORT'],
      ['property', 'STATUSBAR_HIDE_TIME_LONG', 'STATUSBAR_HIDE_TIME_LONG', '', 'STATUSBAR_HIDE_TIME_LONG'],

      ['space', 10],
      [
        'property',
        'CLICK_TWITTER_ELEM_DEBUGGER',
        'CLICK_TWITTER_ELEM_DEBUGGER',
        '',
        'CLICK_TWITTER_ELEM_DEBUGGER',
      ],
      [
        'property',
        'CLICK_TWITTER_ELEM_SIMULATE',
        'CLICK_TWITTER_ELEM_SIMULATE',
        '',
        'CLICK_TWITTER_ELEM_SIMULATE',
      ],
    ],
  },
];

// STARTUP ----------------------------------------------------------------------------

runNow();

async function runNow() {
  storage = await loadStorage({ keys: ['options'] });
  console.info('storage', storage);

  createStatusbar(storage.options);
  initOptionsPage();
  mountOptionsPage(options);
}
