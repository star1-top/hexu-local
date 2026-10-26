# 合序 · 本机版

> 让每一次交接，都有章可循。

合序把带传统 Word 批注的 `.docx` 审阅版，整理成待确认事项、人工复核后的对外候选文件和处理记录。它帮助法务逐条区分内部意见与对外表述；所有建议都要由人确认。

## 五分钟开始试用

下载本仓库的 ZIP 并解压。需要 Python 3.10 或更新版本。macOS / Linux 在解压目录运行：

```sh
sh start-local.sh
```

脚本首次运行会安装 Python 依赖。打开 [本机工作台](http://127.0.0.1:8765)，点击“体验示例”，即可用虚构合同走一遍流程。按 `Ctrl+C` 停止；下次运行同一命令会继续使用本机数据。

Windows 可在 PowerShell 中运行：

```powershell
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m app.server --data-dir .local-data --empty
```

## 能做什么

1. 导入带传统批注的 Word 审阅版，查看批注和对应原文。
2. 人工判断内部、对外或待判断内容，填写业务待办与对外表述。
3. 代录业务回复和虚构证据，复核后导出候选 `.docx`、内部清单和处理记录。

本机版为**单人试用**：无需注册账号，不提供多人实时协作。服务只监听 `127.0.0.1`；合同和处理记录保存在当前目录的 `.local-data/`，不随 Git 上传。应用不连接外部 AI。请只使用虚构或已脱敏文件；程序无法自动识别文件中的真实个人信息。对外候选文件仍须在 Word 中人工检查版式和内容，不代表法律批准或可以直接签署。

支持基础 `.docx` 和最多 10 MB、300 条传统批注。加密文档、宏、现代线程批注、未处理修订及复杂嵌入对象等结构可能被阻断。下载过的文件不会因删除本机记录而自动消失。

## 验证与反馈

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python -m unittest discover -s tests -q
```

本仓库公开提供本机试用源码，暂未选择开源许可证。请勿提交合同、账号资料、密钥或 `.local-data/`。如遇问题，可在 GitHub Issues 中说明操作步骤并使用虚构样本复现。
