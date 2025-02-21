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
  // Ensure browser API is available for all browsers
  if (typeof browser === "undefined") {
    var browser = chrome;
  }

  const mpc_checkbox = document.getElementById('mpc_checkbox');
  const vlc_checkbox = document.getElementById('vlc_checkbox');
  const app_connection_port = document.getElementById('app_connection_port');
  const saveButton = document.getElementById('saveButton');
  const statusButton = document.getElementById('statusButton');
  const alertContainer = document.getElementById('alertContainer');

  // Function to safely clear alerts
  function clearAlerts() {
    while (alertContainer.firstChild) {
      alertContainer.removeChild(alertContainer.firstChild);
    }
  }

  // Function to show icons in alerts
  function getAlertIcon(type) {
    // Define icons based on the alert type
    let alert_icon = "";
    if (type === "success") {
      alert_icon = document.createElement("img");
      alert_icon.src = "images/checkmark.svg";
      alert_icon.width = 16;
      alert_icon.className = "alert-icon noselect";
      alert_icon.draggable = false;
    } else if (type === "danger") {
      alert_icon = document.createElement("img");
      alert_icon.src = "images/error.svg";
      alert_icon.width = 16;
      alert_icon.className = "alert-icon noselect";
      alert_icon.draggable = false;
    }
    return alert_icon;
  }

  // Function to display alerts using safe DOM methods.
  // The content parameter should be a DOM element.
  function showAlertElement(content, type) {
    clearAlerts();
    const alertDiv = document.createElement("div");
    alertDiv.className = `alert alert-${type}`;
	const contentContainer = document.createElement("span");

    contentContainer.appendChild(content);
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

    // Auto-dismiss after 240 seconds
    setTimeout(() => {
      if (alertDiv.parentNode) {
        alertDiv.remove();
      }
    }, 240000);
  }

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
      // Build a message element with <strong> formatting
      const msg = document.createElement("span");
      const strongElem = document.createElement("strong");
      strongElem.textContent = "Settings saved successfully!";
      msg.appendChild(strongElem);
      showAlertElement(msg, "success");
    });
  });

  // Check server status when Status button is clicked
  statusButton.addEventListener('click', function() {
    checkServerStatus();
  });

  // Function to check server status and display alerts
  function checkServerStatus() {
    clearAlerts();
    
    // Create a placeholder alert indicating that a status check is in progress
    const placeholderAlert = document.createElement("div");
    placeholderAlert.className = "alert alert-info";
    
    const placeholderContent = document.createElement("span");
    const strongElem = document.createElement("strong");
    strongElem.textContent = "Checking windows helper app connection…";
    placeholderContent.appendChild(strongElem);
    placeholderAlert.appendChild(placeholderContent);
    
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
          const msg = document.createElement("span");

          const alert_icon_element = getAlertIcon("success");
          msg.appendChild(alert_icon_element);

          const strongElem = document.createElement("strong");
          strongElem.textContent = `Windows helper app v${data.version} is connected.`;
          msg.appendChild(strongElem);
          showAlertElement(msg, "success");
        })
        .catch(error => {
          placeholderAlert.remove();
          // Build a safe DOM structure for the error message
          const messageContainer = document.createElement("div");

          const alert_icon_element = getAlertIcon("danger");
          messageContainer.appendChild(alert_icon_element);

          const strongText = document.createElement("strong");
          strongText.textContent = "Windows helper app is not running.";
          messageContainer.appendChild(strongText);

          const desc1 = document.createElement("div");
          desc1.style.cssText = "margin:6px 0px";
          desc1.textContent = "For this extension to work, you will need to install and run a small native Windows application which is used to launch VLC / MPC-HC.";
          messageContainer.appendChild(desc1);

          const desc2 = document.createElement("div");
          desc2.style.cssText = "margin:6px 0px";
          desc2.textContent = "Please ";
          const link = document.createElement("a");
          link.href = "https://github.com/jaswinder-singh/Open-in-VLC-MPCHC-Browser-Extension/releases/latest";
          link.target = "_blank";
          link.title = "Click here to download helper app";
          link.textContent = "download and run Windows helper app";
          desc2.appendChild(link);
          messageContainer.appendChild(desc2);

          const desc3 = document.createElement("div");
          desc3.textContent = "If the helper app is already running, make sure the port number entered below matches the port used in helper app settings.";
          messageContainer.appendChild(desc3);

          showAlertElement(messageContainer, "danger");
        });
    });
  }
});