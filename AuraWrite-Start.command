#!/bin/bash
cd "$(dirname "$0")"
echo "=================================================="
echo "    正在啟動 AuraWrite 寫作伺服器 (區域網路同步版)    "
echo "=================================================="

# Kill any existing python servers on ports 8000 or 8001
lsof -ti:8000,8001 | xargs kill -9 2>/dev/null

# Start python servers in background
python3 server.py 8001 &
PID_8001=$!
python3 server.py 8000 &
PID_8000=$!

IP_ADDR=$(ipconfig getifaddr en0 || ipconfig getifaddr en1 || ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -n 1)
if [ -z "$IP_ADDR" ]; then
  IP_ADDR="您的電腦IP"
fi

echo "AuraWrite 伺服器已成功在背景啟動！"
echo "--------------------------------------------------"
echo "👉 電腦主程式連結 (Port 8001): http://localhost:8001"
echo "👉 手機主程式連結 (同 Wi-Fi): http://$IP_ADDR:8001"
echo "👉 手機舊文章資料匯出 (Port 8000): http://$IP_ADDR:8000"
echo "--------------------------------------------------"
echo "請保持此 Terminal 視窗開啟。若要關閉伺服器，直接關閉此視窗即可。"

# Wait for both processes
wait $PID_8001 $PID_8000
