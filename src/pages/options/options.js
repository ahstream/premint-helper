console.info('options.js begin', window?.location?.href);

import './options.css';

import { initOptionsPage, mountOptionsPage } from '@ahstream/hx-chrome-lib';

initOptionsPage();

const options = [
  {
    header: 'General Settings',
    hiddenKey: '',
    options: [
      [
        'description',
        'If enabled, a "Auto Join" button is added on raffle pages. Clicking this and Premint Helper will (try to) fulfill all raffle tasks and register for raffle.',
      ],
      ['property', 'ALPHABOT_ENABLE', 'Enable Alphabot raffle automation'],
      ['property', 'PREMINT_ENABLE', 'Enable Premint raffle automation'],
      ['space', 16],

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
        'RAFFLE_OPEN_TWITTER_LINK_DELAY',
        'Pause between opening Twitter raffle tasks',
        '(milliseconds)',
        'Best practice is pause a couple of seconds between opening Twitter task pages.',
      ],
      ['space', 16],

      ['property', 'RAFFLE_FORCE_REGISTER', 'RAFFLE_FORCE_REGISTER', null, 'Lorem'],
      ['property', 'RAFFLE_RETRY_TIMES', 'RAFFLE_RETRY_TIMES', null, 'Lorem'],
      ['property', 'RAFFLE_RETRY_SECS', 'RAFFLE_RETRY_SECS', null, 'Lorem'],
      ['space', 16],

      [
        'property',
        'TWITTER_CLOSE_TASK_PAGE',
        'TWITTER_CLOSE_TASK_PAGE',
        null,
        'If Twitter is rate limiting you for opening too many pages too fast, it might be better to disable this one.',
      ],
      ['property', 'RAFFLE_CLOSE_TASKS_BEFORE_JOIN', 'RAFFLE_CLOSE_TASKS_BEFORE_JOIN', null, 'lorem'],
      ['property', 'RAFFLE_KEEP_ROLED_DISCORD_TASK_OPEN', 'RAFFLE_KEEP_ROLED_DISCORD_TASK_OPEN', null, 'lorem'],
    ],
  },

  {
    header: 'Auto-Start Settings',
    hiddenKey: '',
    options: [
      ['description', ' Lorem ipsum'],
      ['property', 'RAFFLE_CLOSE_TASKS_WHEN_FINISHED', 'RAFFLE_CLOSE_TASKS_WHEN_FINISHED', null, 'lorem'],
      ['property', 'RAFFLE_MINIMIZE_WHEN_FINISHED', 'RAFFLE_MINIMIZE_WHEN_FINISHED', null, 'lorem'],
      // ['property', 'RAFFLE_CLOSE_WHEN_FINISHED', 'RAFFLE_CLOSE_WHEN_FINISHED', null, 'lorem'],
      ['property', 'RAFFLE_CLEANUP_WHEN_FINISHED', 'RAFFLE_CLEANUP_WHEN_FINISHED', null, 'lorem'],
      ['space', 10],
      ['property', 'ALPHABOT_IGNORED_NAMES', 'Ignore Alphabot Teams', null, 'Name of Alphabot teams to ignore when auto-start raffle join'],
    ],
  },

  {
    header: 'Non-Raffle Automation Settings',
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
      [
        'property',
        'TWITTER_AUTO_UPDATE_FOLLOWERS',
        'Auto update Twitter follower count when opening Twitter link',
        '',
        'Premint Helper can update follower count when opening a Twitter link.',
      ],

      [
        'description',
        'Since Twitter is getting more aggresive in rate limiting users it is best practice to use a burner Twitter user account for looking up follower counts. Otherwise you risk your main account have to wait a day before you can enter raffles with it again. Even so, using a burner account will likely hit rate limits on page views per 15 minutes, meaning you might have to wait up to 15 minutes before you can switch from burner to main account again.',
      ],
      ['property', 'TWITTER_FETCH_FOLLOWERS_USER', 'Twitter user for fetching followers', '', ''],
    ],
  },

  {
    header: 'Raffle Result Cloud Storage Settings',
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
    header: 'Raffle Result Page Settings',
    hiddenKey: '',
    options: [
      ['property', 'WALLET_ALIAS', 'Wallet aliases', null, 'Lorem ipsum'],
      ['space', 10],
      ['property', 'ACCOUNT_ALIAS', 'Account aliases', null, 'Lorem ipsum'],
      ['space', 10],
      ['property', 'ALPHABOT_TRIM_NAMES', 'Trim Alphabot team names from raffle name', null, 'Lorem ipsum'],
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

mountOptionsPage(options);
