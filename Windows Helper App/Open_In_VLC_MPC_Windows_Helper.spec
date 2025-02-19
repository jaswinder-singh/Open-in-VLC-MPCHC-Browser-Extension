# -*- mode: python ; coding: utf-8 -*-


a = Analysis(
    ['helper_app.py'],
    pathex=[],
    binaries=[],
    datas=[('Open_In_VLC_MPC_Helper.ico', '.'), ('ui_theme', 'ui_theme')],
    hiddenimports=[],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='Open_In_VLC_MPC_Windows_Helper',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    version='version.txt',
    icon=['Open_In_VLC_MPC_Helper.ico'],
)
