# README

Helper to leave multiple Discord servers in one go with Google Chrome (might work in Firefox too).

Do this:

1. Create "Leave Discord" bookmarklet at https://mrcoles.com/bookmarklet/ with contents of leaveDiscordServers.js file.

2. Go to Discord and click bookmarklet. Wait a few seconds for GUI to appear.

3. If things don't work, make sure to configure devtools to use mobile device mode (there is less strict security for discord authentication token there) and then retry 2 again. See info at https://developer.chrome.com/docs/devtools/device-mode/

4. Check all servers you want to leave and click buttons at bottom.

It will take 3-5 seconds for each server. Time to wait between each leave is configured at top of script file (DEFAULT_PAUSE_BETWEEN_DISCORD_REQUESTS_MS). Good practice is to use at least 3000 ms to not get rate limited. Go to top to see progress (left servers are removed from GUI).

If things don't work as expected, see console logging in DevTools.
