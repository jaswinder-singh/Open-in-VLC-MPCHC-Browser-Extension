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

document.addEventListener('DOMContentLoaded', function() {
  const mpc_checkbox = document.getElementById('mpc_checkbox');
  const vlc_checkbox = document.getElementById('vlc_checkbox');
  const app_connection_port = document.getElementById('app_connection_port');
  const saveButton = document.getElementById('saveButton');
  const statusButton = document.getElementById('statusButton');
  const alertContainer = document.getElementById('alertContainer');

  // Load settings from browser.storage and then check server status
  browser.storage.local.get(['defaultMediaPlayer', 'serverPort'], function(result) {
    const defaultMediaPlayer = result.defaultMediaPlayer || "vlc";
    const serverPort = result.serverPort || 26270;
    app_connection_port.value = serverPort;
    
    if (defaultMediaPlayer === "mpc") {
      mpc_checkbox.checked = true;
      vlc_checkbox.checked = false;
    } else if (defaultMediaPlayer === "vlc") {
      mpc_checkbox.checked = false;
      vlc_checkbox.checked = true;
    }
    
    // Immediately check server status once settings are loaded
    checkServerStatus();
  });

  // Ensure only one checkbox is selected at a time
  mpc_checkbox.addEventListener('change', function() {
    if (mpc_checkbox.checked) {
      vlc_checkbox.checked = false;
    }
  });

  vlc_checkbox.addEventListener('change', function() {
    if (vlc_checkbox.checked) {
      mpc_checkbox.checked = false;
    }
  });

  // Save settings when Save button is clicked
  saveButton.addEventListener('click', function() {
    const selectedPlayer = mpc_checkbox.checked ? "mpc" : (vlc_checkbox.checked ? "vlc" : "");
    const port = parseInt(app_connection_port.value, 10) || 26270;

    browser.storage.local.set({
      defaultMediaPlayer: selectedPlayer,
      serverPort: port
    }, function() {
      showAlert("<strong>Settings saved successfully!</strong>", "success");
    });
  });

  // Check server status when Status button is clicked
  statusButton.addEventListener('click', function() {
    checkServerStatus();
  });

  // Function to clear alerts
  function clearAlerts() {
    alertContainer.innerHTML = "";
  }

  // Function to check server status and display alerts
  function checkServerStatus() {
    clearAlerts();
    
    // Show a placeholder alert indicating status check is in progress
    const placeholderAlert = document.createElement("div");
    placeholderAlert.className = "alert alert-info";
    placeholderAlert.innerHTML = `<span><strong>Checking windows helper app connection&hellip;</strong></span>`;
    alertContainer.appendChild(placeholderAlert);

    browser.storage.local.get(['serverPort'], function(result) {
      const port = result.serverPort || 26270;
      
      fetch(`http://localhost:${port}/status`, {cache: "no-store"})
        .then(response => {
          if (!response.ok) {
            throw new Error(`Windows helper app error ${response.status}`);
          }
          return response.json();
        })
        .then(data => {
          placeholderAlert.remove();
          showAlert(`<strong>Windows helper app v${data.version} is connected.</strong>`, "success");
        })
        .catch(error => {
          placeholderAlert.remove();
          showAlert(
            `<strong>Windows helper app is not running.</strong>
             <div style="margin:8px 0px">For this extension to work, you will need to install and run a small native windows application which is used to launch VLC / MPC-HC.</div>
             <div style="margin:8px 0px">Please <a href="https://github.com/jaswinder-singh/Open-in-VLC-MPCHC-Browser-Extension/releases/latest" target="_Blank" title="Click here to download helper app">download and run windows helper app</a>.</div>
             <div>If helper app is already running on your computer, make sure port number entered below matches the port used in helper app settings.</div>`, 
            "danger"
          );
        });
    });
  }

  // Function to display alerts with automatic icon insertion.
  function showAlert(message, type) {
    clearAlerts();
    const alertDiv = document.createElement("div");
    alertDiv.className = `alert alert-${type}`;

    // Define icons based on the alert type
    let iconHTML = "";
    if (type === "success") {
      iconHTML = '<img src="images/checkmark.svg" width="16" class="alert-icon noselect" draggable="false">';
    } else if (type === "danger") {
      iconHTML = '<img src="images/error.svg" width="16" class="alert-icon noselect" draggable="false">';
    }

    // Create a container that holds both icon and message text
    const contentContainer = document.createElement("span");
    if (iconHTML) {
      contentContainer.innerHTML += iconHTML;
    }
    contentContainer.innerHTML += message;
    alertDiv.appendChild(contentContainer);

    // Create close button
    const closeBtn = document.createElement("span");
    closeBtn.className = "close-btn";
    closeBtn.textContent = "×";
    closeBtn.onclick = function() {
      alertDiv.remove();
    };
    alertDiv.appendChild(closeBtn);

    alertContainer.appendChild(alertDiv);

    // Auto dismiss after 240 seconds 
    setTimeout(() => {
      if (alertDiv.parentNode) {
        alertDiv.remove();
      }
    }, 240000);
  }
});
