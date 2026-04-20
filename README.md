# xhs-render-web

`xhs-render-web` 是一个纯前端本地渲染工具，技术栈只有 `HTML + CSS + JavaScript + Canvas`。

- 无 Python 依赖
- 无后端服务
- 可直接双击 `index.html`（`file://`）使用

## 快速开始

1. 双击打开 `index.html`。
2. 点击 `填充示例` 或粘贴/上传你的内容。
3. 点击 `开始渲染`。
4. 右侧查看缩略图并下载 JPEG。

也可以使用：

```bash
cmd /c npm run xhs:web
```

## 输入方式

- 粘贴 JSON 文本
- 上传单个/多个 `.json` 或 `.txt`
- 选择文件夹（自动读取其中 `.json/.txt`）
- 支持宽松 JSON（如 `style xiaoxing_lab, pages [...]` 这种无引号风格）

## 豆包接入与使用步骤

页面左侧控制区新增了 **主题生成 JSON（豆包）** 模块，可把主题直接生成渲染 JSON。

1. 填写 `豆包 API Key`（火山方舟密钥）。
2. 填写 `豆包 Base URL`（默认 `https://ark.cn-beijing.volces.com/api/v3`，一般无需改）。
3. 填写 `豆包 模型/接入点ID`（例如你在方舟控制台创建的 endpoint id）。
4. 输入主题，点击 `根据主题生成 JSON（豆包）`。
5. 生成成功后，JSON 会自动写入原有输入框，直接点击 `开始渲染` 即可出图。

批量生成：

- `主题` 输入框支持多行，一行一个主题（空行会自动忽略）。
- 支持常见前缀自动清洗，例如 `1.`、`- `。
- 单主题生成时，写回输入框的是单个 JSON 对象。
- 多主题生成时，写回输入框的是 JSON 对象数组，可直接一次点击 `开始渲染` 批量出多组图片。

说明：

- `API Key / Base URL / 模型ID` 会自动保存在浏览器 `localStorage`，下次打开页面自动回填。
- 若模型返回内容无法解析，会提示 `返回内容不是合法 JSON`。
- 若 JSON 不符合当前渲染协议，会显示协议校验错误（如 `cover_title` 缺失、`pages` 非法等）。

## JSON 协议（标准 JSON）

```json
{
  "style": "xiaoxing_lab",
  "cover_top_text": "可写进小说里的",
  "cover_title": "虐哭台词",
  "cover_subtitle": "小说素材、干货分享",
  "pages": [
    {
      "type": "list",
      "title": "标题",
      "items": ["条目1", "条目2"]
    },
    {
      "type": "tag",
      "title": "标题",
      "items": ["【标签】内容"]
    },
    {
      "type": "compare",
      "title": "标题",
      "items": [
        { "normal": "普通写法", "better": "优化写法" }
      ]
    }
  ]
}
```

## 样式支持

- `xiaoxing`（兼容 `小星` 等别名）
- `xiaoxing_lab`（小星写作实验室，兼容 `xiaoxingxiezuoshiyanshi` / `小星写作实验室`）
- `rifu`（日富，兼容 `日富` / `日富一日`）
- `banxia`（半夏，兼容 `半夏` / `半夏416`）
- `zhishi`（芝士，兼容 `芝士`）
- `xiangxiang`（香香，兼容 `香香`）
- `tailun`（泰仑，兼容 `泰仑`）
- `xibo`（喜播，兼容 `喜播`）

## file:// 兼容与底图策略

- 优先使用 `embedded-backgrounds.js` 的内嵌 base64 底图。
- 普通样式缺底图时，会回退到内置渐变背景并提示。
- `xiaoxing_lab` 为严格模式：必须使用内嵌底图，不允许兜底背景。
- `rifu` 与 `banxia` 也为严格模式：必须使用指定底图，不允许兜底背景。
- `zhishi` 也为严格模式：必须使用指定底图，不允许兜底背景。
- `xiangxiang` 也为严格模式：必须使用指定底图，不允许兜底背景。
- `tailun` 也为严格模式：必须使用指定底图，不允许兜底背景。
- `xibo` 也为严格模式：必须使用指定底图，不允许兜底背景。

## 替换底图（assets -> base64）

可使用 `scripts/embed-backgrounds.js` 批量将 `assets` 里的图片转为内嵌 base64：

```bash
node scripts/embed-backgrounds.js
```

## 自检命令

```bash
node --check app.js
node --check embedded-backgrounds.js
node --check scripts/embed-backgrounds.js
```
