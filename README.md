# TextBench

一组仅在浏览器本地运行的开发者文本工具：

- JSON 格式化：格式化、压缩、转义/反转义、面板搜索、复制、语法错误定位和层级折叠
- 文本 Diff：左右并排比较任意文本或代码，支持两侧独立搜索
- URL Encoder / Decoder：支持 URL Component 与完整 URL 的编码和解码
- Base64 Encoder / Decoder：支持 UTF-8、Standard Base64 与 Base64URL
- 时间戳转换：本地日期与秒/毫秒时间戳双向转换
- 字数统计：统计总字符、非空字符、汉字、单词和行数

## 本地开发

```bash
npm install
npm run dev
```

生产构建：

```bash
npm run build
npm run preview
```

## 发布到 GitHub Pages

项目已包含 `.github/workflows/deploy.yml`。创建 GitHub 仓库并推送到 `main` 分支后，在仓库的 **Settings → Pages → Build and deployment** 中将 Source 设置为 **GitHub Actions**。后续推送会自动构建和发布。

所有输入内容都只保存在当前页面内存中，不会上传或写入浏览器存储。
