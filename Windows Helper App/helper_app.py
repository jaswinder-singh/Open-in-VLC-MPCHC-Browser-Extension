#!/usr/bin/env python
"""
Open in VLC / MPC-HC Windows Helper
Author: Jaswinder Singh

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License version 3
as published by the Free Software Foundation.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.
"""

# -----------------------------------------------------------------------------
# Imports
# -----------------------------------------------------------------------------
import os
import sys
import json
import threading
import subprocess
import socket
import ctypes
import logging
import time
import atexit

from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs, unquote

import tkinter as tk
from tkinter import ttk, messagebox, filedialog

try:
    from infi.systray import SysTrayIcon
except ImportError:
    sys.exit("Please install infi.systray: pip install infi.systray")

if os.name == "nt":
    import winreg

# -----------------------------------------------------------------------------
# Constants & Global Variables
# -----------------------------------------------------------------------------
APP_VERSION = "1.2.8"
DEFAULT_PORT = 26270

config = {}  # Global configuration dictionary.
httpd = None
settings_window_instance = None

# Setup logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

# -----------------------------------------------------------------------------
# Application Folder & Files
# -----------------------------------------------------------------------------
documents_folder = os.path.join(os.path.expanduser("~"), "Documents")
app_folder = os.path.join(documents_folder, "Open_In_VLC_MPC_Config")
if not os.path.exists(app_folder):
    os.makedirs(app_folder)

CONFIG_FILE = os.path.join(app_folder, "helper_config.json")
LOCK_FILE = os.path.join(app_folder, "app_instance.lock")

# -----------------------------------------------------------------------------
# Icon File
# -----------------------------------------------------------------------------
if getattr(sys, 'frozen', False):
    ICON_FILE = os.path.join(sys._MEIPASS, "Open_In_VLC_MPC_Helper.ico")
else:
    ICON_FILE = os.path.join(os.path.dirname(os.path.abspath(sys.argv[0])), "Open_In_VLC_MPC_Helper.ico")

# -----------------------------------------------------------------------------
# Instance Locking Functions
# -----------------------------------------------------------------------------
def is_process_running(pid):
    """Return True if a process with the given PID is running."""
    try:
        os.kill(pid, 0)
    except OSError:
        return False
    else:
        return True


def bring_settings_window_to_front():
    """Bring the settings window to the front if it exists."""
    if os.name == "nt":
        try:
            hwnd = ctypes.windll.user32.FindWindowW(None, "Settings - Open in VLC / MPC-HC Windows Helper")
            if hwnd:
                ctypes.windll.user32.SetForegroundWindow(hwnd)
        except Exception as e:
            logging.warning("Error bringing settings window to front: %s", e)


def create_instance_lock():
    """Create a lock file to prevent multiple instances from running."""
    if os.path.exists(LOCK_FILE):
        try:
            with open(LOCK_FILE, "r") as f:
                pid = int(f.read().strip())
            if is_process_running(pid):
                bring_settings_window_to_front()
                sys.exit(0)
            else:
                os.remove(LOCK_FILE)
        except Exception as e:
            logging.error("Error reading instance lock file: %s", e)
            try:
                os.remove(LOCK_FILE)
            except Exception:
                pass
    try:
        with open(LOCK_FILE, "w") as f:
            f.write(str(os.getpid()))
    except Exception as e:
        logging.error("Error creating instance lock: %s", e)
        sys.exit(1)


def remove_instance_lock():
    """Remove the instance lock file on exit."""
    if os.path.exists(LOCK_FILE):
        try:
            os.remove(LOCK_FILE)
        except Exception as e:
            logging.error("Error removing instance lock: %s", e)


atexit.register(remove_instance_lock)

# -----------------------------------------------------------------------------
# Configuration File Functions
# -----------------------------------------------------------------------------
def load_config():
    """Load configuration from a JSON file."""
    global config
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r") as f:
                config = json.load(f)
        except Exception as e:
            logging.error("Error loading config: %s", e)
            config = {}
    else:
        config = {}

    # Set default values if not present
    config.setdefault("mpc_path", "")
    config.setdefault("vlc_path", "")
    config.setdefault("port", DEFAULT_PORT)
    config.setdefault("auto_start", True)
    return config


def save_config():
    """Save configuration to a JSON file."""
    try:
        with open(CONFIG_FILE, "w") as f:
            json.dump(config, f, indent=4)
        logging.info("Configuration values saved.")
    except Exception as e:
        logging.error("Error saving config: %s", e)

# -----------------------------------------------------------------------------
# Media Player Path Detection via Windows Registry
# -----------------------------------------------------------------------------
def get_installed_path_current_user(registry_path, value_name):
    try:
        key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, registry_path, 0, winreg.KEY_READ)
        value, _ = winreg.QueryValueEx(key, value_name)
        winreg.CloseKey(key)
        return value
    except Exception:
        return ""


def get_installed_path_local_machine(registry_path, value_name):
    try:
        key = winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, registry_path, 0, winreg.KEY_READ)
        value, _ = winreg.QueryValueEx(key, value_name)
        winreg.CloseKey(key)
        return value
    except Exception:
        return ""


def detect_vlc_install_path():
    """Automatically detect VLC installation path."""
    vlc_paths = [
        get_installed_path_current_user(r"SOFTWARE\VideoLAN\VLC", "InstallDir"),
        get_installed_path_current_user(r"SOFTWARE\WOW6432Node\VideoLAN\VLC", "InstallDir"),
        get_installed_path_local_machine(r"SOFTWARE\VideoLAN\VLC", "InstallDir"),
        get_installed_path_local_machine(r"SOFTWARE\WOW6432Node\VideoLAN\VLC", "InstallDir"),
        r"C:\Program Files\VideoLAN\VLC",
        r"C:\Program Files (x86)\VideoLAN\VLC"
    ]
    for vlc_path in vlc_paths:
        if vlc_path and os.path.exists(os.path.join(vlc_path, "vlc.exe")):
            logging.info("VLC Path Detected: %s", os.path.join(vlc_path, "vlc.exe"))
            return os.path.join(vlc_path, "vlc.exe")
    return ""


def detect_mpc_install_path():
    """Automatically detect MPC-HC installation path."""
    mpc_paths = [
        get_installed_path_current_user(r"SOFTWARE\MPC-HC\MPC-HC", "ExePath"),
        get_installed_path_current_user(r"SOFTWARE\WOW6432Node\MPC-HC\MPC-HC", "ExePath"),
        get_installed_path_local_machine(r"SOFTWARE\MPC-HC\MPC-HC", "ExePath"),
        get_installed_path_local_machine(r"SOFTWARE\WOW6432Node\MPC-HC\MPC-HC", "ExePath"),
        r"C:\Program Files\MPC-HC\mpc-hc64.exe",
        r"C:\Program Files (x86)\MPC-HC\mpc-hc.exe",
        r"C:\Program Files\Media Player Classic - Home Cinema\mpc-hc64.exe",
        r"C:\Program Files (x86)\Media Player Classic - Home Cinema\mpc-hc.exe",
        r"C:\Program Files (x86)\K-Lite Codec Pack\MPC-HC64\mpc-hc64.exe"
    ]
    for mpc_path in mpc_paths:
        if mpc_path and os.path.exists(mpc_path):
            logging.info("MPC Path Detected: %s", mpc_path)
            return mpc_path
    return ""

# -----------------------------------------------------------------------------
# HTTP Server and Request Handling
# -----------------------------------------------------------------------------
class RequestHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            parsed_url = urlparse(self.path)
            if parsed_url.path == '/launch':
                query_params = parse_qs(self.path.split('?', 1)[-1])
                decoded_params = {key: unquote(values[0]) for key, values in query_params.items()}
                player = decoded_params.get("player", "")
                media_url = decoded_params.get("media_url", "")
                if not player or not media_url:
                    self.send_response(400)
                    self.send_no_cache_headers()
                    self.end_headers()
                    self.wfile.write(b'Launch request is missing required parameters')
                    return

                if player.lower() == 'mpc':
                    player_path = config.get("mpc_path")
                elif player.lower() == 'vlc':
                    player_path = config.get("vlc_path")
                else:
                    self.send_response(400)
                    self.send_no_cache_headers()
                    self.end_headers()
                    self.wfile.write(b'Invalid media player specified. Only Media Player Classic and VLC are supported.')
                    return

                if not player_path:
                    self.send_response(400)
                    self.send_no_cache_headers()
                    self.end_headers()
                    self.wfile.write(b'Media player paths are not configured in windows helper app')
                    return

                try:
                    subprocess.Popen([player_path, media_url])
                    self.send_response(200)
                    self.send_no_cache_headers()
                    self.end_headers()
                    self.wfile.write(b'Media player launched')
                except Exception as e:
                    logging.error("Error launching media player: %s", e)
                    self.send_response(500)
                    self.send_no_cache_headers()
                    self.end_headers()
                    self.wfile.write(str(e).encode())

            elif parsed_url.path == '/status':
                response = {
                    'status': 'running',
                    'version': APP_VERSION
                }
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_no_cache_headers()
                self.end_headers()
                self.wfile.write(json.dumps(response).encode())
            else:
                self.send_response(404)
                self.end_headers()
                self.wfile.write(b'Not Found')
        except Exception as e:
            logging.error("Error handling request: %s", e)
            self.send_response(500)
            self.send_no_cache_headers()
            self.end_headers()
            self.wfile.write(str(e).encode())

    def send_no_cache_headers(self):
        """Send headers to prevent caching."""
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")

    def log_message(self, format, *args):
        # Suppress default HTTP server logging to stdout
        return


def start_server(port):
    """Start the HTTP server in a separate thread."""
    global httpd

    def server_loop():
        global httpd
        try:
            httpd = HTTPServer(("", port), RequestHandler)
            logging.info("HTTP server started on port %s", port)
            httpd.serve_forever(poll_interval=0.5)
        except KeyboardInterrupt:
            logging.info("KeyboardInterrupt received in server thread. Shutting down HTTP server.")
            if httpd:
                httpd.shutdown()
        except Exception as e:
            logging.error("HTTP server error: %s", e)

    server_thread = threading.Thread(target=server_loop, daemon=True)
    server_thread.start()


def stop_server():
    """Stop the HTTP server."""
    global httpd
    if httpd:
        httpd.shutdown()
        httpd.server_close()
        logging.info("HTTP server stopped.")
        httpd = None

# -----------------------------------------------------------------------------
# Auto-Start (Windows) Configuration
# -----------------------------------------------------------------------------
def set_auto_start(enabled):
    """Enable or disable auto-start of the helper via Windows registry."""
    if os.name != "nt":
        return
    try:
        run_key = r"Software\Microsoft\Windows\CurrentVersion\Run"
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, run_key, 0, winreg.KEY_ALL_ACCESS) as key:
            if enabled:
                if getattr(sys, 'frozen', False):
                    startup_command = f'"{sys.executable}"'
                else:
                    startup_command = f'"{sys.executable}" "{os.path.abspath(__file__)}"'
                winreg.SetValueEx(key, "Open in VLC / MPC-HC Windows Helper", 0, winreg.REG_SZ, startup_command)
                logging.info("Auto–start with Windows enabled.")
            else:
                try:
                    winreg.DeleteValue(key, "Open in VLC / MPC-HC Windows Helper")
                    logging.info("Auto–start with Windows disabled.")
                except FileNotFoundError:
                    logging.info("Auto–start registry key not found.")
    except Exception as e:
        logging.error("Error setting auto–start with Windows: %s", e)

# -----------------------------------------------------------------------------
# Port Checking Helper
# -----------------------------------------------------------------------------
def is_port_in_use(port):
    """Return True if the specified port is already in use."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.bind(("127.0.0.1", port))
            return False
        except OSError:
            return True

# -----------------------------------------------------------------------------
# UI Helper: Show Error Message
# -----------------------------------------------------------------------------
def show_error_message(title, message):
    temp_root = tk.Tk()
    temp_root.withdraw()
    messagebox.showerror(title, message)
    temp_root.destroy()

# -----------------------------------------------------------------------------
# Settings Window (Tkinter)
# -----------------------------------------------------------------------------
class SettingsWindow(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Settings - Open in VLC / MPC-HC Windows Helper")
        self.resizable(False, False)
        self.protocol("WM_DELETE_WINDOW", self.on_close)
        window_bg_color = "#EFEFEF"
        
        # Apply a frame with padding
        self.main_frame = ttk.Frame(self, padding=15, style="Custom.TFrame")
        self.main_frame.grid(row=0, column=0, sticky="nsew")

        # Apply modern ttk theme if available
        style = ttk.Style(self)

        def get_theme_path():
            """Returns the correct path for the ui_theme folder, supporting PyInstaller."""
            if getattr(sys, 'frozen', False):
                # Running inside PyInstaller bundle (OneFile mode)
                base_path = sys._MEIPASS
            else:
                # Running normally in Python
                base_path = os.path.dirname(os.path.abspath(__file__))
            return os.path.join(base_path, "ui_theme")

        theme_folder = get_theme_path()
        theme_file = os.path.join(theme_folder, "forest-light.tcl")

        if os.path.exists(theme_file):
            try:
                self.tk.call("source", theme_file)
                style.theme_use("forest-light")
            except Exception as e:
                logging.warning("Could not load custom theme, using default. Error: %s", e)
                style.theme_use("clam")
        else:
            print("Theme file not found!")
            style.theme_use("clam")

        self.configure(bg=window_bg_color)

        # Center the window on screen
        app_width = 715
        app_height = 245
        screen_width = self.winfo_screenwidth()
        screen_height = self.winfo_screenheight()
        screen_x_pos = (screen_width / 2) - (app_width / 2)
        screen_y_pos = (screen_height / 2) - (app_height / 2)
        self.geometry(f'{app_width}x{app_height}+{int(screen_x_pos)}+{int(screen_y_pos)}')

        if os.path.exists(ICON_FILE):
            self.iconbitmap(ICON_FILE)

        self.enable_dark_mode_titlebar()

        # Custom styles
        style.configure("Custom.TLabel", background=window_bg_color, font=("Segoe UI", 11))
        style.configure("Custom.TEntry", font=("Segoe UI", 11), padding=(6, 0, 6, 0))
        style.configure("Custom.TCheckbutton", font=("Segoe UI", 10), background=window_bg_color)
        style.map("Custom.TCheckbutton", background=[("active", window_bg_color), ("!active", window_bg_color)])
        style.configure("Custom.TFrame", background=window_bg_color)

        # Variables
        self.var_mpc = tk.StringVar(value=config.get("mpc_path", ""))
        self.var_vlc = tk.StringVar(value=config.get("vlc_path", ""))
        self.var_port = tk.IntVar(value=config.get("port", DEFAULT_PORT))
        self.var_auto = tk.BooleanVar(value=config.get("auto_start", True))

        # MPC-HC Path
        row = 0
        ttk.Label(self.main_frame, text="MPC-HC Path:", style="Custom.TLabel").grid(row=row, column=0, sticky="w", padx=7, pady=6)
        self.entry_mpc = ttk.Entry(self.main_frame, textvariable=self.var_mpc, width=60, style="Custom.TEntry")
        self.entry_mpc.grid(row=row, column=1, padx=7, pady=6)
        ttk.Button(self.main_frame, text="Browse", command=self.browse_mpc, style="TButton").grid(row=row, column=2, padx=7, pady=6)

        # VLC Path
        row += 1
        ttk.Label(self.main_frame, text="VLC Path:", style="Custom.TLabel").grid(row=row, column=0, sticky="w", padx=7, pady=6)
        self.entry_vlc = ttk.Entry(self.main_frame, textvariable=self.var_vlc, width=60, style="Custom.TEntry")
        self.entry_vlc.grid(row=row, column=1, padx=7, pady=6)
        ttk.Button(self.main_frame, text="Browse", command=self.browse_vlc, style="TButton").grid(row=row, column=2, padx=7, pady=6)

        # Port with 5-digit limit
        row += 1
        ttk.Label(self.main_frame, text="Connection Port:", style="Custom.TLabel").grid(row=row, column=0, sticky="w", padx=7, pady=6)
        vcmd = (self.register(self.validate_port), '%P')
        self.entry_port = ttk.Entry(self.main_frame, textvariable=self.var_port, width=6, style="Custom.TEntry",
                                    validate='key', validatecommand=vcmd)
        self.entry_port.grid(row=row, column=1, sticky="w", padx=7, pady=6)

        # Auto-start checkbox
        row += 1
        self.check_auto = ttk.Checkbutton(
            self.main_frame,
            text="Auto-start helper app in background when windows starts.",
            variable=self.var_auto,
            style="Custom.TCheckbutton"
        )
        self.check_auto.grid(row=row, column=0, columnspan=3, sticky="w", padx=7, pady=6)
        self.check_auto.configure(takefocus=0)

        # Buttons
        row += 1
        button_frame = ttk.Frame(self.main_frame, style="Custom.TFrame")
        button_frame.grid(row=row, column=0, columnspan=3, pady=6)
        ttk.Button(button_frame, text="Save Settings", command=self.save_settings, style='Accent.TButton').grid(row=0, column=0, padx=20)
        ttk.Button(button_frame, text="Cancel", command=self.on_close, style='Accent.TButton').grid(row=0, column=1, padx=20)

    def validate_port(self, new_value):
        """Allow only up to 5 digits for the port input."""
        if new_value == "":
            return True
        if new_value.isdigit() and len(new_value) <= 5:
            return True
        return False

    def enable_dark_mode_titlebar(self):
        """Enable dark mode for the title bar (Windows 10/11)."""
        if os.name != "nt":
            return
        try:
            hwnd = ctypes.windll.user32.GetParent(self.winfo_id())
            DWMWA_USE_IMMERSIVE_DARK_MODE = 20
            dark_mode = ctypes.c_int(1)
            ctypes.windll.dwmapi.DwmSetWindowAttribute(hwnd, DWMWA_USE_IMMERSIVE_DARK_MODE, ctypes.byref(dark_mode), ctypes.sizeof(dark_mode))
        except Exception as e:
            logging.warning("Failed to set dark mode titlebar: %s", e)

    def browse_mpc(self):
        initial_dir = None
        current_path = self.var_mpc.get()
        if current_path and os.path.exists(os.path.dirname(current_path)):
            initial_dir = os.path.dirname(current_path)
        path = filedialog.askopenfilename(
            title="Select MPC-HC executable",
            initialdir=initial_dir,
            filetypes=[("Executable", "*.exe")]
        )
        if path:
            self.var_mpc.set(path)

    def browse_vlc(self):
        initial_dir = None
        current_path = self.var_vlc.get()
        if current_path and os.path.exists(os.path.dirname(current_path)):
            initial_dir = os.path.dirname(current_path)
        path = filedialog.askopenfilename(
            title="Select VLC executable",
            initialdir=initial_dir,
            filetypes=[("Executable", "*.exe")]
        )
        if path:
            self.var_vlc.set(path)

    def save_settings(self):
        new_port = self.var_port.get()
        restricted = {80, 443, 21, 22, 8080}
        old_port = config.get("port", DEFAULT_PORT)
        if new_port in restricted:
            messagebox.showerror("Restricted Port Used",
                                 f"Port {new_port} is not allowed.\nPorts 80, 443, 21, 22, and 8080 are restricted.")
            return
        if new_port != old_port and is_port_in_use(new_port):
            messagebox.showerror("Port In Use",
                                 f"Port {new_port} is already in use by another application.\nPlease choose another port.")
            return

        config["mpc_path"] = self.var_mpc.get()
        config["vlc_path"] = self.var_vlc.get()
        config["port"] = new_port
        config["auto_start"] = self.var_auto.get()
        save_config()
        set_auto_start(config["auto_start"])
        if new_port != old_port:
            # Restart server on a different port in a background thread
            def restart_server():
                stop_server()
                start_server(new_port)
            threading.Thread(target=restart_server, daemon=True).start()
        self.destroy()

    def on_close(self):
        global settings_window_instance
        self.destroy()
        self.update_idletasks()  # Ensure it properly cleans up
        settings_window_instance = None  # Reset global instance


def show_settings_window():
    global settings_window_instance
    # Check if instance exists and is valid
    if settings_window_instance:
        try:
            if settings_window_instance.winfo_exists():
                settings_window_instance.lift()
                settings_window_instance.focus_force()
                return
        except tk.TclError:
            settings_window_instance = None  # Reset if invalid
    # Create a new instance if no valid window exists
    settings_window_instance = SettingsWindow()
    settings_window_instance.mainloop()


# -----------------------------------------------------------------------------
# System Tray Integration
# -----------------------------------------------------------------------------
def on_systray_settings(systray):
    show_settings_window()


def on_systray_quit(systray):
    stop_server()
    remove_instance_lock()
    logging.info("Exiting program.")
    os._exit(0)


def start_systray():
    menu_options = (("Open Settings", None, on_systray_settings),)
    tray = SysTrayIcon(ICON_FILE, "Open in VLC / MPC-HC Windows Helper", menu_options, on_quit=on_systray_quit)
    tray.start()

# -----------------------------------------------------------------------------
# Main Program Entry Point
# -----------------------------------------------------------------------------
def main():
    global config
    load_config()
    create_instance_lock()
    start_systray()

    # Auto-detect media player paths if not set
    if not config.get("mpc_path"):
        config["mpc_path"] = detect_mpc_install_path()
        save_config()
    if not config.get("vlc_path"):
        config["vlc_path"] = detect_vlc_install_path()
        save_config()
    if not config.get("port"):
        config["port"] = DEFAULT_PORT
        save_config()

    port = config.get("port", DEFAULT_PORT)
    if is_port_in_use(port):
        logging.error("Port %s is already in use by another application. Please change it in settings/config.", port)
        show_error_message("Port Already In Use",
                           f"Port {port} is already in use by another application.\nPlease change it in settings.")
        show_settings_window()
        port = config.get("port", DEFAULT_PORT)
        if is_port_in_use(port):
            show_error_message("Port Already In Use",
                               f"New port {port} is also in use by another application.\nExiting program. Try again after changing port.")
            sys.exit(1)

    if httpd is None:
        start_server(port)
    set_auto_start(config.get("auto_start", True))
    if not config.get("mpc_path") or not config.get("vlc_path"):
        show_settings_window()

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        stop_server()
        remove_instance_lock()
        logging.info("Exiting program.")
        os._exit(0)


if __name__ == "__main__":
    main()
