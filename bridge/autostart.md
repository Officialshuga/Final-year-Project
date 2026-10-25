# Run the bridge automatically when the scan-station PC starts

## Windows (recommended: Task Scheduler)
1. Create `start_bridge.bat` in the `bridge` folder:
   ```bat
   @echo off
   cd /d %~dp0
   call venv\Scripts\activate
   python bridge.py
   ```
2. Open **Task Scheduler** → **Create Task**.
   - General: name "GVU Fingerprint Bridge"; check **Run whether user is logged on or not**.
   - Triggers: **New → At startup**.
   - Actions: **New → Start a program →** browse to `start_bridge.bat`.
   - Settings: tick **Restart the task if it fails** (every 1 min, 3 times).
3. Save. The bridge now starts on boot and restarts if it crashes.

> Alternative: put a shortcut to `start_bridge.bat` in the Startup folder
> (`shell:startup`) for a simpler per-user autostart.

## Windows (as a service, optional)
Use [NSSM](https://nssm.cc/):
```
nssm install GVUBridge "C:\path\bridge\venv\Scripts\python.exe" "C:\path\bridge\bridge.py"
nssm start GVUBridge
```

## Linux (systemd)
Create `/etc/systemd/system/gvu-bridge.service`:
```ini
[Unit]
Description=GVU Fingerprint Bridge
After=network.target

[Service]
WorkingDirectory=/opt/gvu/bridge
ExecStart=/opt/gvu/bridge/venv/bin/python bridge.py
Restart=always
User=kiosk

[Install]
WantedBy=multi-user.target
```
Then:
```
sudo systemctl enable gvu-bridge
sudo systemctl start gvu-bridge
```
