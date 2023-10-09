export const defaultOptions = {
  ALPHABOT_ENABLE: true,
  ALPHABOT_OPEN_IN_FOREGROUND: true,
  ALPHABOT_PREV_WINS_LIFETIME_MINT_DAYS: 30,
  ALPHABOT_PREV_WINS_LIFETIME_PICKED_DAYS: 180,
  ALPHABOT_IGNORED_NAMES: [],
  ALPHABOT_RESULTS_DAYS_TO_KEEP_MINTED_WINS: 2,
  ALPHABOT_RESULTS_FETCH_MINE_PICKED_LAST_DAYS: 180,
  ALPHABOT_WAIT_FOR_REGISTERED_SEC: 120,
  ALPHABOT_FETCH_RESULTS_DELAY: 1500,
  ALPHABOT_REG_BTN_SEL: '[data-action="view-project-register" i]',
  ALPHABOT_REG_PLUS_1_BTN_SEL: 'Register +1',
  ALPHABOT_REVEAL_RAFFLES_URL: 'https://www.alphabot.app/?filters=unregistered&scope=community&sortDir=1&sortBy=ending',
  ALPHABOT_OPEN_RAFFLE_LINKS_IN_NEW_TAB: true,
  ALPHABOT_WAIT_FOR_RAFFLE_PAGE_LOADED: 30000,

  PREMINT_ENABLE: true,
  PREMINT_OPEN_IN_FOREGROUND: true,
  PREMINT_PENDING_REG_FOR_SECS: 30,

  PREMINT_MAIN_REGION_SEL: '[id="footer" i]',
  PREMINT_REG_BTN_SEL: '[id="register-submit" i]',
  PREMINT_CUSTOM_FIELD_LABEL_SEL: 'label[for="id_custom_field" i]',
  PREMINT_CUSTOM_FIELD_SEL: '[id="id_custom_field" i]',
  PREMINT_MUST_LIKE_SEL: 'must like',
  PREMINT_MUST_RETWEET_SEL: 'must retweet',
  PREMINT_MUST_LIKE_AND_RETWEET_SEL: 'must like & retweet',
  PREMINT_MUST_FOLLOW_SEL: 'follow',
  PREMINT_JOIN_DISCORD_SEL: ['div', 'join the', 'discord', 'a'],
  PREMINT_JOIN_DISCORD_WITH_ROLE_SEL: ['div', 'join the', 'discord and have', 'a'],
  PREMINT_RETWEET_RE: '(retweet|rt )',
  PREMINT_EMAIL_RE: '(email|e-mail)',
  PREMINT_TWITTER_RE: '',
  PREMINT_DISCORD_RE: '',
  PREMINT_SOL_WALLET_RE: '(solana wallet|solana address|sol address|solana address)',
  PREMINT_ETH_WALLET_RE: '(metamask)',
  PREMINT_TEZ_WALLET_RE: '',

  RAFFLE_SKIP_DONE_TASKS: true,
  RAFFLE_SWITCH_TWITTER_USER: false,
  RAFLE_AUTO_SHOW_FOLLOWERS: true,
  RAFLE_AUTO_SHOW_ODDS: true,
  RAFLE_AUTO_SHOW_WINS: true,
  RAFFLE_TRIM_WHITESPACE: true,
  RAFFLE_FORCE_REGISTER: true,
  RAFFLE_RETRY_SECS: 12,
  RAFFLE_RETRY_TIMES: 3,

  TWITTER_ENABLE: true,
  TWITTER_FOLLOWERS_CACHE_HOURS: 72,
  TWITTER_FETCH_FOLLOWERS_USER: '',
  TWITTER_AUTO_UPDATE_FOLLOWERS: true,

  TWITTER_MAIN_LOOP_RUN_FOR: 60 * 60 * 1000,
  TWITTER_MAIN_LOOP_SLEEP: 100,
  TWITTER_INTENT_BTN_SEL: '[data-testid="confirmationSheetConfirm"]',
  TWITTER_CANCEL_BTN_SEL: '[data-testid="confirmationSheetCancel"]',
  TWITTER_FOLLOWING_SEL: 'div[data-testid$="-unfollow"]',
  TWITTER_REPLY_SEL: '[data-testid="reply"]',
  TWITTER_PROFILE_SEL: '[data-testid="UserJoinDate"]',

  TWITTER_OPEN_LINKS_IN_SEQUENCE: true,

  DISCORD_SKIP_JOINED: true,

  DISCORD_MAX_PENDING_JOIN: 30000,
  DISCORD_MAIN_LOOP_RUN_FOR: 60 * 1000,
  DISCORD_MAIN_LOOP_SLEEP: 200,
  DISCORD_JOIN_DELAY: 252,
  DISCORD_CLOSE_JOINED_DELAY: 1250,
  DISCORD_COMPLETE_DELAY: 102,
  DISCORD_CONTINUE_DELAY: 50,
  DISCORD_ACCEPT_CHECKBOX_DELAY: 100,
  DISCORD_ACCEPT_RULES_DELAY: 101,
  DISCORD_JOIN_BTN_SEL: '[type="button" i]',
  DISCORD_JOIN_BTN_TEXT: 'Accept Invite',
  DISCORD_COMPLETE_BTN_SEL: 'Complete',
  DISCORD_CONTINUE_BTN_SEL: 'Continue to Discord',
  DISCORD_ACCEPT_CHECKBOX_SEL: 'I have read and agree to the rules',
  DISCORD_ACCEPT_RULES_SEL: 'Submit',

  CLOUD_MODE: 'save',
  CLOUD_TAG: 'hxdev1234',

  USER_INFO_EMAIL_ADDRESS: '',
  USER_INFO_TWITTER_ALIAS: '',
  USER_INFO_DISCORD_ALIAS: '',
  USER_INFO_SOL_WALLET: '',
  USER_INFO_ETH_WALLET: '',
  USER_INFO_BTC_WALLET: '',
  USER_INFO_TEZ_WALLET: '',

  CLOSE_BUT_ONE_URL: 'chrome://extensions/',

  // Close tab/page settings

  TWITTER_CLOSE_TASK_PAGE: true,
  RAFFLE_KEEP_ROLED_DISCORD_TASK_OPEN: true,
  RAFFLE_CLOSE_TASKS_BEFORE_JOIN: true,
  RAFFLE_CLOSE_TASKS_WHEN_FINISHED: true,
  // for autostarted only:
  RAFFLE_MINIMIZE_WHEN_FINISHED: false,
  RAFFLE_CLEANUP_WHEN_FINISHED: false,
  RAFFLE_CLOSE_WHEN_FINISHED: false,

  TWITTER_ENABLE_MANUAL: false,

  DISCORD_ENABLE: false,
  DISCORD_ENABLE_MANUAL: false,

  TWITTER_RETWEETED_SEL: 'div[aria-label$="Reposted"]',
  TWITTER_LIKED_SEL: 'div[aria-label$="Liked"]',

  PREMINT_BTC_WALLET_RE: '(taproot)',

  RAFFLE_ODDS_CACHE_MINS: 120,

  RAFFLE_ODDS_COLOR: 'black',
  RAFFLE_ODDS_BACKGROUND_COLOR: 'cyan',
  RAFFLE_FOLLOWERS_COLOR: 'black',
  RAFFLE_FOLLOWERS_BACKGROUND_COLOR: 'cyan',
  RAFFLE_WINS_COLOR: 'black',
  RAFFLE_WINS_BACKGROUND_COLOR: 'yellow',
  RAFFLE_EXPIRED_ODDS_COLOR: 'white',
  RAFFLE_EXPIRED_ODDS_BACKGROUND_COLOR: '#850404',
  RAFFLE_EXPIRED_FOLLOWERS_COLOR: 'white',
  RAFFLE_EXPIRED_FOLLOWERS_BACKGROUND_COLOR: '#850404',

  WALLET_ALIAS: [
    'hot-1: ETH_ADDRESS',
    'hot-2: ETH_ADDRESS',
    'warm-1: ETH_ADDRESS',
    'warm-2: ETH_ADDRESS',
    'btc-1: BTC_ADDRESS',
    'btc-2: BTC_ADDRESS',
  ],

  ACCOUNT_ALIAS: ['Main: ETH_ADDRESS', 'Alt-1: ETH_ADDRESS', 'Alt-2: ETH_ADDRESS'],

  ALPHABOT_TRIM_NAMES: [
    'Vee Friends Alpha',
    'Alpha King',
    'Alphazillanft',
    'WOA',
    'FMC',
    'Dres',
    'Sloth Friends',
    'WOW Alpha',
    'NFTSensei',
  ],
};

export const overrideOptions = {
  RAFFLE_OPEN_TWITTER_LINK_DELAY: 400,
  TWITTER_CLOSE_TASK_PAGE_DELAY: 1500,
  TWITTER_PARENT_SUGGESTED_DELAY: 500,

  CLOUD_SAVE_URL: 'https://data.mongodb-api.com/app/application-0-pqnjz/endpoint/update_alphabot_winners',
  CLOUD_LOAD_URL: 'https://data.mongodb-api.com/app/application-0-pqnjz/endpoint/get_alphabot_winners',
  CLOUD_HAS_URL: 'https://data.mongodb-api.com/app/application-0-pqnjz/endpoint/count_alphabot_winners',
};
