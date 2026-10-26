#!/bin/sh
# Local single-user trial. No account, cloud deployment or external AI key.
set -eu
cd "$(dirname "$0")"

if ! command -v python3 >/dev/null 2>&1; then
  echo '请先安装 Python 3.10 或更新版本。' >&2
  exit 1
fi

if [ ! -x .venv/bin/python ]; then
  python3 -m venv .venv
fi
if ! .venv/bin/python -c 'import lxml' >/dev/null 2>&1; then
  .venv/bin/python -m pip install -r requirements.txt
fi

export TOKENHUB_API_KEY=
export HEXU_AI_MONTHLY_CALLS=0
echo '合序本机版即将启动。请打开 http://127.0.0.1:8765'
echo '文件保存在本目录的 .local-data/；按 Ctrl+C 停止。'
exec .venv/bin/python -m app.server --data-dir .local-data --empty
