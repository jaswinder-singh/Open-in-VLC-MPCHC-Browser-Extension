/*!
 * Open in VLC / MPC-HC Browser Extension
 * Author: Jaswinder Singh
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License version 3
 * as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */


// Ensure browser API is available for all browsers
if (typeof browser === "undefined") {
  var browser = chrome;
}

// Helper function to map the stored value to a display name.
function getMediaPlayerDisplayName(player) {
  if (player === "vlc") {
    return "VLC";
  } else if (player === "mpc") {
    return "Media Player Classic (MPC-HC)";
  } else {
    // Fallback: capitalize the first letter.
    return player.charAt(0).toUpperCase() + player.slice(1);
  }
}

// Create the context menu when the extension is installed or updated.
browser.runtime.onInstalled.addListener(() => {
  browser.storage.local.get(['defaultMediaPlayer'], (result) => {
    const defaultMediaPlayer = result.defaultMediaPlayer || "vlc"; // Default value if none is set.
    const playerDisplayName = getMediaPlayerDisplayName(defaultMediaPlayer);
    browser.contextMenus.create({
      id: "viewInLocalMediaPlayer",
      title: "Open in " + playerDisplayName,
      contexts: ["link", "audio", "video"],
      targetUrlPatterns: [
        // supported video formats
        "*://*/*.avi",
        "*://*/*.mid",
        "*://*/*.webm",
        "*://*/*.mpg",
        "*://*/*.mp2",
        "*://*/*.mpeg",
        "*://*/*.mpe",
        "*://*/*.mpv",
        "*://*/*.ogg",
        "*://*/*.mp4",
        "*://*/*.m4p",
        "*://*/*.m4v",
        "*://*/*.avi",
        "*://*/*.wmv",
        "*://*/*.mov",
        "*://*/*.flv",
        "*://*/*.ogv",
        "*://*/*.3gp",
        "*://*/*.mkv",

        // supported audio formats
        "*://*/*.aac",
        "*://*/*.mp3",
        "*://*/*.wav",
        "*://*/*.weba",
        "*://*/*.flac",
        "*://*/*.m4a"
      ]
    });
  });
});

// Listen for changes in the default player and update the context menu title accordingly.
browser.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.defaultMediaPlayer) {
    const newPlayer = changes.defaultMediaPlayer.newValue || "vlc";
    const playerDisplayName = getMediaPlayerDisplayName(newPlayer);
    browser.contextMenus.update("viewInLocalMediaPlayer", { title: "Open in " + playerDisplayName });
  }
});

// Handle clicks on the context menu.
browser.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "viewInLocalMediaPlayer") {
    const mediaURL = info.srcUrl || info.linkUrl;;
    
    browser.storage.local.get(['defaultMediaPlayer', 'serverPort'], (result) => {
      const defaultMediaPlayer = result.defaultMediaPlayer || "vlc";
	  const playerDisplayName = getMediaPlayerDisplayName(defaultMediaPlayer);
      const port = result.serverPort || 26270;
      const launchUrl = `http://localhost:${port}/launch?player=${defaultMediaPlayer}&media_url=${encodeURIComponent(mediaURL)}`;
      
      console.log(playerDisplayName + " launched with URL: " + launchUrl);

      fetch(launchUrl, {cache: "no-store"})
        .then(response => {
          if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
          }
          return response.text();
        })
        .then(text => {
          console.log("Launch attempt successful: Enjoy your media!");
          /*
          browser.notifications.create({
            type: 'basic',
            iconUrl: 'images/icon.png',
            title: 'Enjoy your media!',
            message: 'Media player launched successfully.'
          });
          */
        })
        .catch(error => {
          let errorMessage = error.message === "Failed to fetch" || "NetworkError when attempting to fetch resource." ? "Windows helper app is not connected. Please open settings page of this extension to check/configure helper app connection." : error.message;

          console.log("Launch attempt failed: " + error);
          browser.notifications.create({
            type: 'basic',
            iconUrl: 'images/icon.png',
            title: 'Media player launch failed!',
            message: errorMessage
          });
        });
    });
  }
});
