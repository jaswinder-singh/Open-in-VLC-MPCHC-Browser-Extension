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

document.addEventListener('DOMContentLoaded', function() {
  const mpcCheckbox = document.getElementById('mpcCheckbox');
  const vlcCheckbox = document.getElementById('vlcCheckbox');
  const portInput = document.getElementById('portInput');
  const saveButton = document.getElementById('saveButton');
  const statusButton = document.getElementById('statusButton');
  const alertContainer = document.getElementById('alertContainer');

  // Load settings from chrome.storage and then check server status
  chrome.storage.local.get(['defaultPlayer', 'serverPort'], function(result) {
    const defaultPlayer = result.defaultPlayer || "mpc";
    const serverPort = result.serverPort || 26270;
    portInput.value = serverPort;
    
    if (defaultPlayer === "mpc") {
      mpcCheckbox.checked = true;
      vlcCheckbox.checked = false;
    } else if (defaultPlayer === "vlc") {
      mpcCheckbox.checked = false;
      vlcCheckbox.checked = true;
    }
    
    // Immediately check server status once settings are loaded
    checkServerStatus();
  });

  // Ensure only one checkbox is selected at a time
  mpcCheckbox.addEventListener('change', function() {
    if (mpcCheckbox.checked) {
      vlcCheckbox.checked = false;
    }
  });

  vlcCheckbox.addEventListener('change', function() {
    if (vlcCheckbox.checked) {
      mpcCheckbox.checked = false;
    }
  });

  // Save settings when Save button is clicked
  saveButton.addEventListener('click', function() {
    const selectedPlayer = mpcCheckbox.checked ? "mpc" : (vlcCheckbox.checked ? "vlc" : "");
    const port = parseInt(portInput.value, 10) || 26270;

    chrome.storage.local.set({
      defaultPlayer: selectedPlayer,
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

    chrome.storage.local.get(['serverPort'], function(result) {
      const port = result.serverPort || 26270;
      
      fetch(`http://localhost:${port}/status`)
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
             <div style="margin:8px 0px">Please <a href="https://github.com/jaswinder-singh/Open-in-VLC-MPCHC-Browser-Extension/releases/latest" target="_Blank">download and run windows helper app</a>.</div>
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

    // Auto dismiss after 180 seconds 
    setTimeout(() => {
      if (alertDiv.parentNode) {
        alertDiv.remove();
      }
    }, 180000);
  }
});
