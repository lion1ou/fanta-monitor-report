#!/usr/bin/env bash
# 本地构建监控服务（server + admin + sdk）并发布到远端 pm2。
# 只上传运行所需：构建产物、迁移 SQL、ip2region 数据、后台与 SDK 静态文件；
# packages/server/.env 由服务器维护，不随包覆盖；迁移在服务启动时自动应用。

set -euo pipefail
cd "$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"

DEPLOY_HOST="root@59.110.5.43"
REMOTE_DIR="/workspace/fanta-monitor"
PM2_APP_NAME="fanta-monitor"
PORT="${PORT:-5020}"

time="$(date +%Y%m%d%H%M%S)"
PACKAGE="fanta-monitor-$time.tar.gz"
trap 'rm -f "$PACKAGE"' EXIT

echo "========== 部署开始 $time → $DEPLOY_HOST:$REMOTE_DIR (pm2: $PM2_APP_NAME) =========="

echo "安装依赖并构建..."
npm ci
npm run build

for required in packages/server/dist/server.js packages/admin/dist/index.html packages/sdk/dist/fanta-report.umd.js \
  packages/server/data/geo/ip2region_v4.xdb packages/server/data/geo/ip2region_v6.xdb; do
  [ -f "$required" ] || { echo "❌ 缺少 $required（xdb 请先 npm run geo:download -w packages/server）"; exit 1; }
done

echo "打包..."
COPYFILE_DISABLE=1 tar -czf "$PACKAGE" \
  package.json package-lock.json \
  packages/shared/package.json packages/shared/dist \
  packages/server/package.json packages/server/dist packages/server/migrations packages/server/data/geo \
  packages/admin/package.json packages/admin/dist \
  packages/sdk/package.json packages/sdk/dist

echo "上传..."
ssh "$DEPLOY_HOST" "mkdir -p '$REMOTE_DIR'"
scp -O "$PACKAGE" "$DEPLOY_HOST:$REMOTE_DIR/"

echo "远端安装并重启..."
ssh "$DEPLOY_HOST" "bash -se" <<REMOTE
set -euo pipefail
export PATH="/usr/local/bin:\$PATH"
[ -s "\$HOME/.nvm/nvm.sh" ] && . "\$HOME/.nvm/nvm.sh"
cd "$REMOTE_DIR"
[ -f packages/server/.env ] || { echo "❌ 缺少 $REMOTE_DIR/packages/server/.env，请先按 .env.example 创建"; exit 1; }
tar -xzf "$PACKAGE" && rm -f "$PACKAGE"
find . -name '._*' -delete
npm ci --omit=dev
cd packages/server
if pm2 describe "$PM2_APP_NAME" >/dev/null 2>&1; then
  pm2 restart "$PM2_APP_NAME" --update-env
else
  pm2 start dist/server.js --name "$PM2_APP_NAME" --node-args="--env-file=.env"
fi
pm2 save >/dev/null || true
sleep 3
curl -fsS "http://127.0.0.1:$PORT/health" && echo && pm2 describe "$PM2_APP_NAME" | grep -E "status|uptime|restarts"
REMOTE

echo "========== 部署完成 =========="
