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
  PREMINT_RETWEET_RE: '(retweet|rt )',
  PREMINT_EMAIL_RE: '(email|e-mail)',
  PREMINT_TWITTER_RE: '',
  PREMINT_DISCORD_RE: '',
  PREMINT_SOL_WALLET_RE: '(solana wallet|solana address|sol address|solana address)',
  PREMINT_ETH_WALLET_RE: '(metamask)',
  PREMINT_TEZ_WALLET_RE: '',

  RAFFLE_SKIP_DONE_TASKS: true,
  RAFFLE_SWITCH_TWITTER_USER: false,
  RAFFLE_CLOSE_TASK_PAGES: true,
  RAFLE_AUTO_SHOW_FOLLOWERS: true,
  RAFLE_AUTO_SHOW_ODDS: true,
  RAFLE_AUTO_SHOW_WINS: true,
  RAFFLE_TRIM_WHITESPACE: true,
  RAFFLE_RETRY_SECS: 12,
  RAFFLE_RETRY_TIMES: 3,

  TWITTER_ENABLE: true,
  TWITTER_FOLLOWERS_CACHE_HOURS: 72,
  TWITTER_FETCH_FOLLOWERS_USER: '',
  TWITTER_AUTO_UPDATE_FOLLOWERS: true,
  TWITTER_CLOSE_TASK_PAGE: true,
  TWITTER_CLOSE_TASK_PAGE_DELAY: 200,

  TWITTER_MAIN_LOOP_RUN_FOR: 60 * 60 * 1000,
  TWITTER_MAIN_LOOP_SLEEP: 100,
  TWITTER_INTENT_BTN_SEL: '[data-testid="confirmationSheetConfirm"]',
  TWITTER_CANCEL_BTN_SEL: '[data-testid="confirmationSheetCancel"]',
  TWITTER_FOLLOWING_SEL: 'div[data-testid$="-unfollow"]',
  TWITTER_LIKED_SEL: 'div[aria-label="Liked"]',
  TWITTER_REPLY_SEL: '[data-testid="reply"]',
  TWITTER_PROFILE_SEL: '[data-testid="UserJoinDate"]',

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
};

export const overrideOptions = {
  TWITTER_RETWEETED_SEL: 'div[aria-label="Reposted"]',
  TWITTER_PARENT_SUGGESTED_DELAY: 2500,

  PREMINT_BTC_WALLET_RE: '(taproot)',

  RAFFLE_OPEN_TWITTER_LINK_DELAY: 2000,
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

  TWITTER_ENABLE_MANUAL: true, // prod default: false

  DISCORD_ENABLE: true, // prod default: false
  DISCORD_ENABLE_MANUAL: true, // prod default: false

  CLOUD_SAVE_URL: 'https://data.mongodb-api.com/app/application-0-pqnjz/endpoint/update_alphabot_winners',
  CLOUD_LOAD_URL: 'https://data.mongodb-api.com/app/application-0-pqnjz/endpoint/get_alphabot_winners',
  CLOUD_HAS_URL: 'https://data.mongodb-api.com/app/application-0-pqnjz/endpoint/count_alphabot_winners',

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

  WALLET_ALIAS: [
    'mint-01: 0x25a6bbd4d8f041b4b14cd703560995a09a74b464',
    'mint-02: 0xc4e7b579d1be3c9e3a2151e54dc4b7124f148fd8',
    'mint-03: 0x5ae900a7bca4b379ad8786c0f75dea50b9778567',
    'mint-04: 0x8c72070aa747f3f314a34bd8bc741fca6713f81c',
    'mint-05: 0x54449c8876b07a928c7a122411c2e74297feabe1',
    'mint-06: 0x6cbd70d32941a6c53eee1d764761b923f7e74f16',
    'mint-07: 0x5999abf4b0dbb7a1ec67e2f33dc9597774ef9598',
    'mint-08: 0xde11a4f9d77c5b1315333d08d445f883ad3ca7ab',
    'mint-09: 0xc275ddf47bac76f59b48b20be84bb41673a2a372',
    'mint-10: 0x85eeb48d2e3c4ae2a3cee6e59048daf64c425612',
    'mint-11: 0x8a40eceba058aacc33cb4fe997f2cffe50355854',
    'mint-12: 0x4646612bf701e3371977191743055505a98282b3',

    'safe-00: 0x9d092b94222d18d7d86aef37f2067ba40a98562d',
    'safe-01: 0x09b2a622c4c2a9ddda223498ef23d037e684d1f9',
    'safe-02: 0xf7a77ca1806594a9df9484cd62da03f7ebdcb5e7',
    'safe-03: 0xd1c18b009eb3b42a92ae81be9f80c9a1e2419b44',
    'safe-04: 0xa6a9314521a7c4cf1fdb6f391252aa24d66a5cd9',
    'safe-05: 0x19c385ffeef1bd9b154c74d8dffcc2bc5bbf9ed4',
    'safe-06: 0x9aa17ac3fca52738f7633227d4556335832d6d93',
    'safe-07: 0xff9e08e6af55729274c5d09ce0ccfd0ca4eec8f6',
    'safe-08: 0x3b1118e2a5e65ce85ec627fba9dce8e2c4a9c3ed',
    'safe-09: 0x4281c8f352ac10fca59ea52fb145b1db1f5ff9d6',
    'safe-10: 0xccbe50f93b953780e66856256dda3a9a01adda84',
    'safe-11: 0x52aa9650541d4a3814f8477925177e37591365b6',
    'safe-12: 0xd5295503f4d1ffb659e6951b9fb9e8e00eb8cdd4',
    'safe-13: 0xe2f58b76ce4e3f989895cd66c6717b04e3df1eaa',
    'safe-14: 0x105d2b6b348899c4b0506138bc797e4967031430',
    'safe-15: 0x35916900bb29ca39f3dcf0caa6d5b5ad9133386e',
    'safe-16: 0xdfd643fe2f6b9c992caab9fbab3862c53798a19f',
    'safe-17: 0xe05da629d2dbd9e237fb71f05574de1133a6bd9f',
    'safe-18: 0xfbb78a2a69b8fcc23b492de9ee48ea12b84f3569',
    'safe-19: 0xaf020eda79b5d26fdbb8cbcd7f24c27c6433bfec',
    'safe-20: 0x0b3f4aa7c53b49b2d6c85837ada904c4658dcfcd',
    'safe-21: 0x6a8d5d34f7fcb8a8987e9cfbb279892653f215ea',
    'safe-22: 0x2c037cd60a4afdce2e643eb12856464f7dc94f0e',
    'safe-23: 0x409ed7313f9143a64c166e921bab544b7fb94675',
    'safe-24: 0x6402ab604ffe8d5e21cf3f4e37063c9415df326e',
    'safe-25: 0xf58b39e0c7ce71030d2d799d695198ce950db0ac',
    'safe-26: 0x980a3444238280bc8abe0e2a7fecbe478d70560b',

    'vault-00: 0x34b8986f8b00716a005dfead60673e4ada606ba9',
    'vault-01: 0x4e7cc4ce5787f1a232dc165ec4963ea6c2e2c399',
    'vault-02: 0xb5cca2bb3c05ad472342b755d56a36bc73e1374c',
    'vault-03: 0xf8fd103627dc98f5de28b22b314dabce700c90c5',
    'vault-04: 0xdedd12948c7f29f31120ed4eed122b9a23645250',

    'foo-01: 0xb7dbaacbfa050b00ca4e4e74ba5c4b44356232a2',
    'foo-02: 0x79ed3957434cea99f790c55e0cc86729f53e4ac5',
    'foo-03: 0x0b2126970a464c66988b5a8e395715a46293812a',
    'foo-04: 0x5ad8edec022f95e90d80742ce0c43b2f8ae67724',
    'foo-05: 0x23e5659a741807c992124d9a511c4526b5e9852e',
    'foo-06: 0xff6b171d593cd6b2f5ebc40d0f09ea532b50291b',
    'foo-07: 0xb7796783fc682843274c8356e0a91a81e0c02256',
    'foo-08: 0xeb9378677235e55271e38540b2286c438931d781',
    'foo-09: 0x52a2d0921f59ad755f94e235e0030dfd40fb9a28',
    'foo-10: 0x17b13eb2e026e5d7f103cc03ab9fbf6fd88606b4',
    'foo-11: 0x09d61103e052d3a08b7405d1915e00575abf4125',
    'foo-12: 0x151451fb2b472c30d28c10e11d36d1e74f1b2554',
    'foo-13: 0x1c960edc0406a4a9dd339c064b7542975e81962f',
    'foo-14: 0xa35176c5c1da0c3b637cc967da1ac512c282edbd',
    'foo-15: 0x45b75eb7742af6f2f592d24bd5081f36d01ab7d1',
    'foo-16: 0x64597985ac6f7aacd020da4c313bba35ace18d67',
    'foo-17: 0x465b57b8a018a764f3885bb604125b9f8caebf09',
    'foo-18: 0x8bb32cb495ad9a69f20640aae2b39f15014fa36d',
    'foo-19: 0x0cceabf0d84990946eb7c972b05c7cebf63454d4',
    'foo-20: 0x8149991747d1e981c846b47d8c8fe73b110b1dd8',
    'foo-21: 0x0bffed370db71c0dbeecc506816031b4d0583e70',
    'foo-22: 0x94e659be5070b10edf6455d3af825df930b3e1ad',
    'foo-23: 0x0de3a0d62898f819d1d386cac3fb758b7bdfb2f3',
    'foo-24: 0xaf7e818258fc0b53082ec05098fee2154982936a',
    'foo-25: 0x5c955f30514481e4dba41c7e2b3b9333711f293f',
    'foo-26: 0x50b0c7f21bbaceb095a7dbf6928e925902cc558b',
    'foo-27: 0x800b939cbbf3e7b195a2765252e2e1ac602d835a',
    'foo-28: 0x0c82220206e2df9ad2a018aaa611fb2004ec7be8',
    'foo-29: 0x39f86a5fc9355658c6f1516dcfb999fd21dd19b4',
    'foo-30: 0xe66a71c49979d4417384fd0d07f059c5bf5a3754',

    'ord-01: bc1p5lcuy4vefprkad77wh3zc6ex4675uzcupjg8596jm6vp5qqkudksan44dj',
    'ord-02: bc1p8kafllptwntzsavc0zn3lp4nkenttygas7m6k364h5f36xn5ptjq3phu3g',
    'ord-03: bc1pmgck57s4aev6k6z8sy60xd4ktav37sy9xdr3r444hzuah9z9uk4q2v6e3j',
    'ord-04: bc1p0q2f7afds686lmlcccud9clhycsa2jan8q87kr3s7gkhvv4tpf4s7wfk2s',
    'ord-05: bc1px3yczer20j56ddn3v2gqn0kp52ue6vl2klqwz9fmwzpc9qf4hchsgwhpyt',
    'ord-06: bc1p9chespkjarvl2qxhranplllcyu9regul50vhxhdegdt7d84wdldqrrazu6',
    'ord-07: bc1p6e4nrvuyzjlstwf3nsj5mq0d0wchek9elw8hw2cn5luzunwetx4sxgf5zg',
    'ord-08: bc1psjg50af5u72s743ckx0w98qzd0x5wutlgg9jrpvnajged6p09vksfjvsuz',
    'ord-09: bc1p6semk65x0zvdcr3vrssrjcunczsm9u4etdmt76yszl3c0setttxqv77zp7',
    'ord-10: bc1p9hwca0m5gepljsk6eqh4jaqqjjnhepcu4tc94wqf0zqswae20rjqvefmy8',
    'ord-11: bc1pyg48776c2wgxykm56wq68h49ewredkgegjv6lkj42zn8v6n228aq32pqsg',
    'ord-12: bc1pgjk5j4dml03smzpe6hpxwnvqqqrdj53cs5hagtq5ehfwpu762yzqcf4rsk',
    'ord-13: bc1pcksrxt576rpcm5v9x8l5wyjpnxuj3kcv6tsqgnt808ke25q4dnfqzeg7ty',
    'ord-14: bc1p2e9r94ef5wh3g2ej0ryw9pxj06d80rssp2lrcnzxjem3zlk88cpsv7u07j',
    'ord-15: bc1pvxvusq8jmycrecu5ypwqwjch3zan7mazm349fjl26nkngzr66cusqm3a4s',
    'ord-16: bc1p8rrr9ar0ualsjqve56uc3zyczkul0mdy94xl7nutzt0lu4kanfkqs9kgr2',
    'ord-17: bc1pmlv49qvk9l0jtf8n37spqgyhqvu24nsn8ty4kpkyqqxxe5nhk5ssm0jfu8',
    'ord-18: bc1p4uu94z4rj6e3jfuqazey4s65tx8ayd5xx9d3l2560t5srxm90urq0w44xt',
    'ord-19: bc1pmlhavezyz23wdlwuzfmm270cfg72vvysjevs63n4hsuama6659fs0sejdj',

    'ord-01-2: bc1p6hj0c8qfd77ggkksapya6cd2l2aurxu25k45r29qfv84ysqytymswksfjc',
    'ord-02-2: bc1pm2s63c2wn5vd436xw0ldru9amzcrwt5gka95pv26fqm0c8z82j3q9g4rn0',
    'ord-03-2: bc1plphegh4a0vgg7dkujz5w90dxmj5f7u3250texzy5z0lt3m6pyt9su8p588',
    'ord-04-2: bc1pn9pychprp3y5r2mfjlf3x2fkd76qd6yyl54ux2ew2sedas8h904qumyls7',
    'ord-05-2: bc1pet5tpz2yp27tm5jx68lufevw5x5jxx3uerxk5awfch9xjdn8wpxsn92u9y',
    'ord-06-2: bc1p5epuj7zzzk6e0wglgqkuul8wjtjzrj3q3lknejxsnpukt5guyn6qu7rpmu',
    'ord-07-2: bc1pceftg9jku2quq5leqjhfeynhjecjert2u5mz8jzuznz600ypv3eqqcww4w',
    'ord-08-2: bc1psy9dwp94sxy4su445yspzaneuy4gllk3rfvajpxf0z3g558syl7q2gdq6h',
    'ord-09-2: bc1pq4ucv0yleq6t3783z3s865v6k35mr6lakmtd4pudt2sch5n8qgyqqun9fr',
    'ord-10-2: bc1przv75czuzhzgdz9us2ua9sy0wxf3z3vpggdchd5j6r3ftj7cpdysnfcfef',
    'ord-11-2: bc1p2pddava44hq2k689z7hmzaew99d6e0fldvlkvnmt3c0rs70m63pqqdj3ky',
    'ord-12-2: bc1pkygzz9us7e9m6fcn80ld0sy9zhlmp6du2xyfjvw2wvglg8mud5asmfk3wl',
    'ord-13-2: bc1pp0evce9gayp8ne54mlalwa62v30znfxxeg07d7cnk5ht9gvxpw2sd8ptzm',
    'ord-14-2: bc1pe20fclay9u7t5xshp44yyhea4kvpchwm6mlse3ylaha875y9j4zsq4w22k',
    'ord-15-2: bc1pvdcn0nsr9csqdqxlwuza3j2ftwj0ujmzpa598345slykyxq89ewqed6mmz',
    'ord-16-2: bc1pvkl9sewr5k4tdpsf7jcwj95wef9xjfhk7ewqpsl9k0tej09nhetq09y7xn',
    'ord-17-2: bc1p93lw3ch2253g069kv974dnq5nvj35qzppm8q5vtm9c4d98anl7xs6v5yh6',
    'ord-18-2: bc1pwqdp3x9c5kks6su87pmmz6dnl2un5d8g0q8sqfn536m8ew26qlzqyq82gk',
    'ord-19-2: bc1pkarqu3hkgtyh7tahhmg537fkwdt56u4k7qftuz6xtqwpf3kpswzswf0vy8',
  ],

  ACCOUNT_ALIAS: [
    '01 hstream: 0x25a6bbd4d8f041b4b14cd703560995a09a74b464',
    '02 zecond: 0xc4e7b579d1be3c9e3a2151e54dc4b7124f148fd8',
    '03 third: 0x5ae900a7bca4b379ad8786c0f75dea50b9778567',
    '04 foo-01: 0xb7dbaacbfa050b00ca4e4e74ba5c4b44356232a2',
    '05 foo-02: 0x79ed3957434cea99f790c55e0cc86729f53e4ac5',
    '06 foo-03: 0x0b2126970a464c66988b5a8e395715a46293812a',
    '07 foo-04: 0x5ad8edec022f95e90d80742ce0c43b2f8ae67724',
    '08 foo-05: 0x23e5659a741807c992124d9a511c4526b5e9852e',
    '09 foo-06: 0xff6b171d593cd6b2f5ebc40d0f09ea532b50291b',
    '10 foo-07: 0xb7796783fc682843274c8356e0a91a81e0c02256',
    '11 foo-08: 0xeb9378677235e55271e38540b2286c438931d781',
    '12 foo-09: 0x52a2d0921f59ad755f94e235e0030dfd40fb9a28',
    '13 foo-10: 0x17b13eb2e026e5d7f103cc03ab9fbf6fd88606b4',
    '14 foo-11: 0x09d61103e052d3a08b7405d1915e00575abf4125',
    '15 foo-12: 0x151451fb2b472c30d28c10e11d36d1e74f1b2554',
    '16 foo-13: 0x1c960edc0406a4a9dd339c064b7542975e81962f',
    '17 foo-14: 0xa35176c5c1da0c3b637cc967da1ac512c282edbd',
    '18 foo-15: 0x45b75eb7742af6f2f592d24bd5081f36d01ab7d1',
    '19 foo-16: 0x64597985ac6f7aacd020da4c313bba35ace18d67',
    '20 foo-17: 0x465b57b8a018a764f3885bb604125b9f8caebf09',
    '21 foo-18: 0x8bb32cb495ad9a69f20640aae2b39f15014fa36d',
    '22 foo-19: 0x0cceabf0d84990946eb7c972b05c7cebf63454d4',
    '23 foo-20: 0x8149991747d1e981c846b47d8c8fe73b110b1dd8',
  ],
};
