# 码文 · Code for Word

[English](./README.md) | **中文**

<p align="center">
  <img src="docs/demo.gif" alt="码文演示" width="100%" />
</p>

**把高亮代码贴进 Word**——颜色、外框、页边距和可选的说明栏按设置保留。这是主功能。需要写论文或公文时，再切到可选的**文本模式**；打开后默认停在代码模式。

## 怎么用

### 1）网页版（不用安装）

**打开网页版：** https://l00plegend.github.io/code-for-word/

源码镜像：[Gitee · loopisme/code-for-word](https://gitee.com/loopisme/code-for-word)（与 GitHub 同步；网页版只维护上述一个地址，避免双站过期/挂掉）

- 粘贴 → 调选项 → **下载 DOCX**（网页上最稳）
- 也可以点 **复制到 Word**，但浏览器粘贴效果不稳定；要高质量粘贴请用 Windows 桌面版

### 2）Windows 桌面版（粘贴效果最好）

1. 下载安装包 `CodeForWord-Setup-*.exe`（国内优先 Gitee）：
   - **Gitee Releases（国内）：** https://gitee.com/loopisme/code-for-word/releases
   - GitHub Releases：https://github.com/L00PLeGeNd/code-for-word/releases/latest
2. 安装后从开始菜单打开 **码文**
3. 粘贴 → **复制到 Word** → 到 Word / WPS 里 `Ctrl+V`（粘贴选项尽量选 **保留源格式**）

若出现 SmartScreen「未知发布者」，点 **更多信息 → 仍要运行**（目前安装包未做代码签名）。

关掉窗口会进系统托盘，不会退出。

**Word 与 WPS：** 桌面粘贴优先按 Microsoft Word 调。WPS 一般也能用；若说明栏文字被裁切，可改用 **下载 DOCX**，或先关掉行下划线再粘贴。

## 模式

打开后停在 **代码**。文本模式和翻译要自己打开。

### 代码模式（默认）

语法高亮、字体字号、行号、页边距、代码边距、外框、下划线和框内说明栏。桌面版以 RTF 复制到 Word，颜色和边框按设置保留。

### 文本 / 论文模式（可选）

点 **文本** 后整理散文排版——贴代码不必开这一模式：

- 正文默认宋体小四、西文 Times New Roman、1.5 倍行距、首行缩进 2 字、两端对齐
- 标题用黑体：一级三号，二级四号，三级小四
- 编号可选学术 `1 / 1.1`、学位论文「第1章」、公文「一、（一）」、或保持原样
- 列表、图表题注、参考文献、公式、正文中的代码块、Markdown / Excel 表格
- 可清理 OCR 全角字符和多余空格，以及一部分 LaTeX 标记

翻译默认关闭。打开后可选免费引擎或你自己的接口；文字会发到对应服务，不会在未打开时送出。

## 开发

```bash
git clone https://github.com/L00PLeGeNd/code-for-word.git
cd code-for-word
npm install
npm run dev   # Vite + Electron 壳
npm test      # vitest
npm run dist:win
```

## 许可证

MIT
