#!/bin/bash
cd "$(dirname "$0")"
echo "=================================================="
echo "      正在自動同步 AuraWrite 至 GitHub 雲端       "
echo "=================================================="
echo ""

# Stage all files
git add .

# Check if there are changes to commit
if git diff-index --quiet HEAD --; then
  echo "沒有偵測到新的修改，正在與雲端進行同步..."
else
  echo "偵測到新修改，正在提交更新..."
  git commit -m "Auto sync: $(date '+%Y-%m-%d %H:%M:%S')"
fi

echo ""
echo "正在推送上傳至 GitHub..."
git push

echo ""
echo "=================================================="
echo "        同步完成！網頁已在背景自動更新。          "
echo "=================================================="
echo "您可以直接關閉此視窗。"
read -p "按任意鍵結束..." -n 1 -r
