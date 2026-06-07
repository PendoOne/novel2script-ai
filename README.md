# 🎬 AI 小说转剧本工具

> 将小说章节自动转换为结构化 YAML 剧本 — 让每位作者都能成为编剧。

## 功能特性

- **📖 智能章节检测** — 自动识别"第X章"、"Chapter X"等多种章节标记
- **🤖 AI 驱动改编** — 基于 Claude API，将小说叙述转化为专业剧本格式
- **📜 结构化 YAML 输出** — 包含角色、场景、对话、潜台词等完整剧本要素
- **⚡ 实时流式输出** — SSE 流式传输，边生成边查看，无需等待
- **🎨 编剧友好界面** — 深色主题，YAML 语法高亮，操作直观
- **💾 一键导出** — 复制到剪贴板或下载 .yaml 文件

## 快速开始

### 1. 环境要求

- Node.js 18+
- Anthropic API Key（从 [console.anthropic.com](https://console.anthropic.com/) 获取）

### 2. 安装

```bash
# 进入项目目录
cd ai小说转剧本

# 安装依赖
npm install

# 配置 API Key
cp .env.example .env
# 编辑 .env 文件，填入你的 ANTHROPIC_API_KEY
```

### 3. 启动

```bash
npm start
```

打开浏览器访问 `http://localhost:3000`。

### 4. 使用

1. **输入小说文本** — 在左侧文本框粘贴小说内容（3个章节以上效果最佳）
2. **（可选）设置元信息** — 展开元信息设置，填写剧本标题、格式等
3. **检测章节** — 点击「🔍 检测章节」按钮自动分割章节
4. **开始改编** — 点击「🎬 开始改编为剧本」按钮
5. **查看/导出** — 右侧实时显示生成的 YAML 剧本，可复制或下载

## 项目结构

```
ai小说转剧本/
├── server.js              # Express 服务端（Claude API 集成）
├── package.json           # 项目配置
├── .env.example           # 环境变量模板
├── docs/
│   └── yaml-schema.md     # 剧本 YAML Schema 规范文档
├── public/
│   └── index.html         # 前端 SPA 页面
└── README.md              # 本文件
```

## 剧本 YAML Schema

本工具输出的 YAML 剧本遵循一套精心设计的 Schema。详见 [docs/yaml-schema.md](docs/yaml-schema.md)，文档包含：

- 完整的字段定义和类型约束
- 每个字段的设计原因说明
- 完整的改编示例（基于《笑傲江湖》）
- 扩展与自定义指南

### Schema 设计亮点

| 特性 | 说明 |
|------|------|
| **beats 序列** | 保留动作与对话的原始时间顺序，非传统格式的分离式结构 |
| **subtext 潜台词** | 显式标注角色表面话语下的真实意图 |
| **chapter_ref 溯源** | 每个场景可追溯到原著章节 |
| **conflict_level + emotional_shift** | 支持全剧节奏分析和情绪曲线绘制 |
| **引用式角色管理** | 角色在 characters 中统一定义，场景中通过 ID 引用 |

## API 接口

### POST /api/convert

流式转换接口（SSE）。请求体：

```json
{
  "text": "小说原文（至少500字）...",
  "meta": {
    "title": "剧本标题",
    "format": "tv_series",
    "originalNovel": "原著名称",
    "originalAuthor": "原著作者"
  }
}
```

SSE 事件类型：`progress` | `chunk` | `complete` | `error` | `warning` | `done`

### POST /api/convert-simple

非流式转换接口，返回完整 JSON（适合测试和集成）。

### GET /api/health

健康检查。

## 技术栈

- **后端**: Node.js + Express
- **AI**: Anthropic Claude API (@anthropic-ai/sdk)
- **前端**: Vanilla HTML/CSS/JS（零构建依赖）
- **数据格式**: YAML 1.2（js-yaml 解析）

## 使用建议

1. **章节越多效果越好** — 3 个章节是最低要求，5 个以上章节能让 AI 更好理解人物弧线和情节走向
2. **文本质量影响结果** — 原文包含明确对话和环境描写时，改编质量最高
3. **先检测章节** — 点击「检测章节」确保 AI 能正确处理章节边界
4. **YAML 初稿需要打磨** — AI 生成的剧本是高质量的初稿，建议在此基础上进行人工润色
5. **使用 Schema 文档** — 了解 YAML 结构后可以手动编辑，甚至直接按 Schema 从零编写

## License

MIT
