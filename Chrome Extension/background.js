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

// Helper function to map the stored value to a display name.
function getPlayerDisplayName(player) {
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
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['defaultPlayer'], (result) => {
    const defaultPlayer = result.defaultPlayer || "vlc"; // Default value if none is set.
    const playerDisplayName = getPlayerDisplayName(defaultPlayer);
    chrome.contextMenus.create({
      id: "viewInLocalMediaPlayer",
      title: "Open in " + playerDisplayName,
      contexts: ["link"],
      targetUrlPatterns: [
        "*://*/*.mp4",
        "*://*/*.webm",
        "*://*/*.ogg",
        "*://*/*.mkv",
        "*://*/*.avi",
        "*://*/*.mov",
        "*://*/*.flv",
        "*://*/*.wmv"
      ]
    });
  });
});

// Listen for changes in the default player and update the context menu title accordingly.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.defaultPlayer) {
    const newPlayer = changes.defaultPlayer.newValue || "vlc";
    const playerDisplayName = getPlayerDisplayName(newPlayer);
    chrome.contextMenus.update("viewInLocalMediaPlayer", { title: "Open in " + playerDisplayName });
  }
});

// Handle clicks on the context menu.
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "viewInLocalMediaPlayer") {
    const videoUrl = info.linkUrl;
    
    chrome.storage.local.get(['defaultPlayer', 'serverPort'], (result) => {
      const defaultPlayer = result.defaultPlayer || "vlc";
	  const playerDisplayName = getPlayerDisplayName(defaultPlayer);
      const port = result.serverPort || 26270;
      const launchUrl = `http://localhost:${port}/launch?player=${defaultPlayer}&video_url=${encodeURIComponent(videoUrl)}`;
      
      console.log(playerDisplayName + " launched with URL: " + launchUrl);

      fetch(launchUrl)
        .then(response => {
          if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
          }
          return response.text();
        })
        .then(text => {
          console.log("Launch attempt successful: Enjoy your video!");
          /*
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icon.png',
            title: 'Enjoy your video!',
            message: 'Media player launched successfully.'
          });
          */
        })
        .catch(error => {
          console.log("Launch attempt failed: " + error);
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icon.png',
            title: 'Error',
            message: error.message
          });
        });
    });
  }
});
