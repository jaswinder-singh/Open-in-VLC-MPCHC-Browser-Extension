pyinstaller --onefile --noconsole --icon=Open_In_VLC_MPC_Helper.ico --name="Open_In_VLC_MPC_Windows_Helper" --version-file=version.txt --add-data "Open_In_VLC_MPC_Helper.ico;." --add-data "ui_theme;ui_theme" helper_app.py