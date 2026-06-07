require("dotenv").config();

const express = require("express");
const OpenAI = require("openai").default;
const yaml = require("js-yaml");
const path = require("path");

// ─── 配置 ───────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY;
const API_BASE_URL = process.env.API_BASE_URL || "https://api.deepseek.com";
const AI_MODEL = process.env.AI_MODEL || "deepseek-chat";

if (!API_KEY) {
  console.error("[错误] 请在 .env 文件中设置 API_KEY");
  console.error("DeepSeek: 从 https://platform.deepseek.com/ 获取");
  console.error("其他兼容接口: 设置 API_BASE_URL 和 API_KEY");
  process.exit(1);
}

const client = new OpenAI({
  apiKey: API_KEY,
  baseURL: API_BASE_URL,
});

const app = express();
app.use(express.json({ limit: "5mb" }));
app.use(express.static(path.join(__dirname, "public")));

// ─── 章节检测 ───────────────────────────────────────────────────────────────

function detectChapters(text) {
  const patterns = [
    /第[零一二三四五六七八九十百千万\d]+章\s*[^\n]*/g,
    /第[零一二三四五六七八九十百千万\d]+节\s*[^\n]*/g,
    /Chapter\s+\d+/gi,
    /CHAPTER\s+[IVXLCDM]+/g,
    /^#+\s*第[零一二三四五六七八九十百千万\d]+[章节]/gm,
    /^第[零一二三四五六七八九十百千万\d]+回\s*[^\n]*/gm,
  ];

  for (const pattern of patterns) {
    const matches = [...text.matchAll(pattern)];
    if (matches.length >= 3) {
      return matches.map((m) => ({ title: m[0].trim(), index: m.index }));
    }
  }

  const paragraphs = text.split(/\n{2,}/);
  if (paragraphs.length >= 10) {
    const chunks = [];
    const chunkSize = Math.ceil(paragraphs.length / Math.ceil(paragraphs.length / 50));
    for (let i = 0; i < paragraphs.length; i += chunkSize) {
      chunks.push({ title: `段落 ${Math.floor(i / chunkSize) + 1}`, index: text.indexOf(paragraphs[i]) });
    }
    return chunks;
  }

  return [{ title: "全文", index: 0 }];
}

function splitChapters(text, chapterMatches) {
  const chapters = [];
  for (let i = 0; i < chapterMatches.length; i++) {
    const start = chapterMatches[i].index;
    const end = i < chapterMatches.length - 1 ? chapterMatches[i + 1].index : text.length;
    chapters.push({
      number: i + 1,
      title: chapterMatches[i].title,
      content: text.slice(start, end).trim(),
    });
  }
  return chapters;
}

// ─── 系统提示词 ─────────────────────────────────────────────────────────────

function buildSystemPrompt(meta) {
  return `你是一位资深的影视剧本改编专家，擅长将小说文本改编为标准化的剧本格式。

## 你的任务
根据用户提供的小说文本，将其改编成结构化的 YAML 剧本。你必须严格遵循下述 Schema 格式输出，不得遗漏任何必填字段。

## 改编原则
1. **忠实原著**：保留原著的核心情节、人物性格和重要对话。
2. **剧本化处理**：将小说的内心独白转为潜台词(subtext)或画外音(voiceover)；将环境描写转为场景描述和动作节拍。
3. **节奏把控**：合理分配场景长度，重要情节给足篇幅，过渡情节适度精简。
4. **对话提炼**：从小说叙述中提取和优化对话，使之更符合口语表达。
5. **潜台词挖掘**：分析角色表面话语下的真实意图，填入 subtext 字段。
6. **情绪标注**：为每句对话标注 emotion，帮助演员理解表演方向。

## 输出格式要求
你必须输出一个完整的 YAML 文档，结构如下：

\`\`\`yaml
script:
  meta:
    title: "${meta.title || "未命名剧本"}"
    format: "${meta.format || "tv_series"}"
    original_novel: "${meta.originalNovel || ""}"
    original_author: "${meta.originalAuthor || ""}"
    script_author: "AI 改编助手"
    version: "1.0-draft"
    created_date: "${new Date().toISOString().split("T")[0]}"
    genre: []
    logline: ""
    synopsis: ""

  characters:
    - id: ""
      name: ""
      role: ""
      age: ""
      gender: ""
      occupation: ""
      description: ""
      personality: []
      motivation: ""
      arc: ""
      backstory: ""
      relationships:
        - target: ""
          type: ""
          description: ""

  structure:
    model: "three_act"
    act_count: 3
    acts:
      - act_number: 1
        title: "建置"
        summary: ""
        scene_range: [1, 0]
      - act_number: 2
        title: "对抗"
        summary: ""
        scene_range: [0, 0]
      - act_number: 3
        title: "解决"
        summary: ""
        scene_range: [0, 0]

  scenes:
    - scene_number: 1
      act: 1
      chapter_ref: 1
      location:
        name: ""
        type: "INT"
        description: ""
        props: []
      time: ""
      time_of_day: "evening"
      summary: ""
      mood: ""
      characters_present:
        - id: ""
          status: "present"
      beats:
        - type: "action"
          description: ""
          characters: []
          camera: ""
        - type: "dialogue"
          character: ""
          delivery: "normal"
          emotion: ""
          text: ""
          parenthetical: ""
          target: ""
          subtext: ""
        - type: "transition"
          value: "CUT TO"
      conflict_level: "medium"
      emotional_shift: ""
      key_dialogue: ""
      notes: ""

## 重要注意事项
1. 只输出 YAML 内容，不要输出任何解释、前言或总结文字。
2. YAML 输出必须语法正确，缩进使用 2 个空格。
3. 多行字符串使用 YAML 的 \`|\` 或 \`>\` 语法。
4. 角色 ID 和 name 字段统一使用中文名，保持一致。同一角色在所有场景中使用完全相同的名称。
5. 每个场景至少包含 2 个 beats。
6. 对话的 text 字段必须直接引用或改写自原文。
7. 你改编的场景数量不少于输入章节数 × 2。
8. 如果没有明确的幕结构信息，合理推断三幕结构。
9. 时间、地点信息从原文提取，无法确定的标注为合理推测。
10. conflict_level 和 emotional_shift 基于场景内容合理判断。`;
}

// ─── API 路由 ───────────────────────────────────────────────────────────────

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    provider: API_BASE_URL,
    model: AI_MODEL,
    timestamp: new Date().toISOString(),
  });
});

// 核心转换接口（SSE 流式）
app.post("/api/convert", async (req, res) => {
  const { text, meta } = req.body;

  if (!text || typeof text !== "string" || text.trim().length < 500) {
    return res.status(400).json({
      error: "请提供至少 500 字的小说文本。建议提供 3 个章节以上的内容以获得最佳改编效果。",
    });
  }

  // 设置 SSE 响应头
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  const send = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    // 阶段1：检测章节
    send("progress", { phase: "detect", message: "正在检测章节结构..." });
    const chapterMatches = detectChapters(text);
    const chapters = splitChapters(text, chapterMatches);
    send("progress", {
      phase: "detect",
      message: `检测到 ${chapters.length} 个章节`,
      chapters: chapters.map((c) => ({ number: c.number, title: c.title })),
    });

    // 阶段2：调用 DeepSeek 进行改编
    send("progress", { phase: "ai", message: `AI (${AI_MODEL}) 正在分析文本并改编剧本...` });

    const systemPrompt = buildSystemPrompt(meta || {});

    // 构建章节内容的用户消息
    const chapterOutline = chapters
      .map((c) => `### ${c.title}\n${c.content.slice(0, 500)}...（共 ${c.content.length} 字）`)
      .join("\n\n");

    let userMessage = `以下是一部小说的 ${chapters.length} 个章节。请将其改编为剧本 YAML。

${chapterOutline}

请根据上述全部文本内容，生成完整的剧本 YAML。注意：
- 仔细阅读每个章节，提取所有角色、场景和对话
- 角色需要跨章节追踪，同一角色在不同场景使用相同 ID
- 场景按原文时间顺序排列
- 每章至少改编出 2-3 个场景`;

    // 如果文本太长，智能压缩
    const MAX_EST_TOKENS = 120000;
    if (userMessage.length > MAX_EST_TOKENS * 2) {
      send("progress", {
        phase: "ai",
        message: `文本较长（约 ${Math.round(userMessage.length / 2)} tokens），智能压缩中...`,
      });
      const compressedChapters = chapters.map((c) => {
        const half = Math.floor(c.content.length / 2);
        return `### ${c.title}\n${c.content.slice(0, 2000)}\n\n...（中间省略）...\n\n${c.content.slice(-2000)}`;
      });
      userMessage = `以下是一部小说的 ${chapters.length} 个章节。请将其改编为剧本 YAML。\n\n${compressedChapters.join("\n\n")}\n\n请根据上述全部文本内容，生成完整的剧本 YAML。`;
    }

    // 调用 DeepSeek API（OpenAI 兼容流式）
    const stream = await client.chat.completions.create({
      model: AI_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      max_tokens: 16384,
      temperature: 0.4,
      stream: true,
    });

    let fullResponse = "";

    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta;

      // 跳过 DeepSeek 的 reasoning_content（深度思考内容）
      // 只输出最终的 content
      if (delta?.content) {
        fullResponse += delta.content;
        send("chunk", { text: delta.content });
      }
    }

    // 阶段3：解析和验证 YAML
    send("progress", { phase: "parse", message: "正在解析和验证 YAML..." });

    let yamlContent = fullResponse;
    // 尝试多种方式提取 YAML
    const yamlMatch = fullResponse.match(/```(?:yaml)?\s*\n([\s\S]*?)\n```/);
    if (yamlMatch) {
      yamlContent = yamlMatch[1];
    } else {
      // 尝试找到 script: 开头的 YAML 内容
      const scriptMatch = fullResponse.match(/(?:^|\n)(script:[\s\S]*)/);
      if (scriptMatch) yamlContent = scriptMatch[1];
    }

    let parsed;
    try {
      parsed = yaml.load(yamlContent);
      // 兼容没有 script 根节点的输出
      if (!parsed) throw new Error("YAML 为空");
      if (!parsed.script) {
        // 尝试将顶层内容作为 script
        if (parsed.scenes || parsed.characters || parsed.meta) {
          parsed = { script: parsed };
        } else {
          throw new Error("缺少 script 根节点，且无法自动推断");
        }
      }
    } catch (parseErr) {
      console.error("[YAML 解析错误]", parseErr.message);
      console.error("[YAML 前500字]", yamlContent.slice(0, 500));
      send("warning", {
        message: "YAML 解析警告：" + parseErr.message + "。已保留原始输出，请手动检查格式。",
      });
      parsed = null;
    }

    send("complete", {
      yaml: yamlContent,
      parsed: !!parsed,
      stats: {
        chapterCount: chapters.length,
        sceneCount: parsed?.script?.scenes?.length || "未知",
        characterCount: parsed?.script?.characters?.length || "未知",
        yamlLength: yamlContent.length,
      },
    });

    send("done", {});
  } catch (err) {
    console.error("[转换错误]", err);
    let errMsg = err.message || "转换过程中发生未知错误";
    // 处理常见 API 错误
    if (err.status === 401) errMsg = "API Key 无效，请检查 .env 中的 API_KEY";
    else if (err.status === 402) errMsg = "API 账户余额不足，请充值";
    else if (err.status === 429) errMsg = "API 请求过于频繁，请稍后再试";
    else if (err.code === "ECONNREFUSED") errMsg = `无法连接到 ${API_BASE_URL}，请检查网络和 API_BASE_URL 配置`;
    send("error", {
      message: errMsg,
      detail: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
    send("done", {});
  } finally {
    res.end();
  }
});

// 简易非流式接口
app.post("/api/convert-simple", async (req, res) => {
  const { text, meta } = req.body;

  if (!text || typeof text !== "string" || text.trim().length < 500) {
    return res.status(400).json({ error: "请提供至少 500 字的小说文本。" });
  }

  try {
    const chapters = splitChapters(text, detectChapters(text));
    const systemPrompt = buildSystemPrompt(meta || {});

    const chapterTexts = chapters
      .map((c) => `### ${c.title}\n${c.content.slice(0, 3000)}${c.content.length > 3000 ? "\n...（已截断）" : ""}`)
      .join("\n\n");

    const msg = await client.chat.completions.create({
      model: AI_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `将以下 ${chapters.length} 个章节的小说改编为剧本 YAML：\n\n${chapterTexts}` },
      ],
      max_tokens: 16384,
      temperature: 0.4,
    });

    const fullText = msg.choices?.[0]?.message?.content || "";

    let yamlContent = fullText;
    const m = fullText.match(/```(?:yaml)?\s*\n([\s\S]*?)\n```/);
    if (m) yamlContent = m[1];
    else { const sm = fullText.match(/(?:^|\n)(script:[\s\S]*)/); if (sm) yamlContent = sm[1]; }

    let parsed = null;
    try {
      parsed = yaml.load(yamlContent);
      if (parsed && !parsed.script && (parsed.scenes || parsed.characters)) parsed = { script: parsed };
    } catch (_) {}

    res.json({
      yaml: yamlContent,
      parsed: !!parsed && !!parsed?.script,
      stats: {
        chapterCount: chapters.length,
        sceneCount: parsed?.script?.scenes?.length || "未知",
        characterCount: parsed?.script?.characters?.length || "未知",
      },
    });
  } catch (err) {
    console.error("[转换错误]", err);
    res.status(500).json({ error: err.message });
  }
});

// ─── 剧情分析接口（SSE 流式）─────────────────────────────────────────────────

app.post("/api/analyze", async (req, res) => {
  const { text, meta } = req.body;

  if (!text || typeof text !== "string" || text.trim().length < 500) {
    return res.status(400).json({ error: "请提供至少 500 字的小说文本。" });
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  const send = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const chapters = splitChapters(text, detectChapters(text));
    send("progress", { phase: "chapters", message: `检测到 ${chapters.length} 个章节` });

    const previewText = chapters
      .map((c) => `### ${c.title}\n${c.content.slice(0, 2000)}${c.content.length > 2000 ? "\n...（已截断）" : ""}`)
      .join("\n\n");

    const systemPrompt = `你是一位专业的小说分析专家。你的任务是从小说文本中提取三类信息，并以 JSON 格式输出。

## 输出格式
你必须只输出一个 JSON 对象，不要输出任何解释文字：

{
  "characters": [
    {
      "id": "英文或拼音ID",
      "name": "中文名",
      "role": "protagonist|antagonist|supporting|minor",
      "description": "一句话描述",
      "traits": ["性格标签1", "性格标签2"],
      "first_appearance": "第X章"
    }
  ],
  "locations": [
    {
      "name": "地点名称",
      "type": "INT|EXT|INT/EXT",
      "description": "环境描述",
      "scenes": ["相关情节简述"]
    }
  ],
  "conflicts": [
    {
      "type": "character_vs_character|character_vs_self|character_vs_society|character_vs_fate",
      "description": "冲突描述",
      "involved_characters": ["角色ID"],
      "intensity": "low|medium|high|climax",
      "chapter_range": "第X章-第Y章"
    }
  ]
}

## 分析要求
1. 提取所有有名有姓的角色，包括其性格特征和角色定位。
2. 提取所有主要场景地点，标注内外景类型。
3. 识别核心冲突和次要冲突，标注冲突类型和强度。
4. 每个类别至少提取 3 个条目。
5. JSON 必须语法正确。`;

    const stream = await client.chat.completions.create({
      model: AI_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `请分析以下小说的剧情要素：\n\n${previewText}` },
      ],
      max_tokens: 8192,
      temperature: 0.3,
      stream: true,
    });

    let fullResponse = "";
    for await (const chunk of stream) {
      const content = chunk.choices?.[0]?.delta?.content;
      if (content) {
        fullResponse += content;
        send("chunk", { text: content });
      }
    }

    // 解析 JSON
    let analysis = null;
    try {
      const jsonMatch = fullResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) analysis = JSON.parse(jsonMatch[0]);
    } catch (_) {}

    send("complete", {
      analysis,
      parsed: !!analysis,
      stats: {
        chapters: chapters.length,
        characters: analysis?.characters?.length || 0,
        locations: analysis?.locations?.length || 0,
        conflicts: analysis?.conflicts?.length || 0,
        sourceLength: text.length,
      },
    });
    send("done", {});
  } catch (err) {
    console.error("[分析错误]", err);
    send("error", { message: err.message });
    send("done", {});
  } finally {
    res.end();
  }
});

// ─── Robust YAML Parser ──────────────────────────────────────────────────────

function robustParseScript(yamlText) {
  let content = yamlText;
  // Strip markdown code blocks
  const m = content.match(/```(?:yaml)?\s*\n([\s\S]*?)\n```/);
  if (m) content = m[1];
  // Find script: root
  const sm = content.match(/(?:^|\n)(script:[\s\S]*)/);
  if (sm) content = sm[1];

  let parsed = yaml.load(content);
  if (!parsed) throw new Error("YAML 为空");
  if (!parsed.script) {
    if (parsed.scenes || parsed.characters || parsed.meta) {
      parsed = { script: parsed };
    } else {
      throw new Error("缺少 script 根节点，且无法自动推断");
    }
  }
  if (!parsed.script.scenes || !Array.isArray(parsed.script.scenes)) {
    throw new Error("script.scenes 不存在或不是数组");
  }
  return parsed.script;
}

// ─── 对白优化接口（SSE 流式）─────────────────────────────────────────────────

app.post("/api/optimize-dialogues", async (req, res) => {
  const { yaml: yamlContent } = req.body;

  if (!yamlContent || typeof yamlContent !== "string" || yamlContent.trim().length < 100) {
    return res.status(400).json({ error: "请提供有效的剧本 YAML 内容。" });
  }

  // 先解析 YAML，提取所有对话
  let script;
  try {
    script = robustParseScript(yamlContent);
  } catch (e) {
    return res.status(400).json({ error: "YAML 解析失败：" + e.message });
  }

  // 提取所有对话，并做 ID→中文名映射
  // 构建角色 ID→name 映射表
  const charNameMap = {};
  if (script.characters) {
    for (const c of script.characters) {
      if (c.id && c.name) charNameMap[c.id] = c.name;
      if (c.name) charNameMap[c.name] = c.name;
    }
  }
  function resolveCharName(id) {
    if (!id) return "未知角色";
    if (/[一-鿿]/.test(id)) return id;
    return charNameMap[id] || id;
  }

  const allDialogues = [];
  const sceneMap = {};
  for (const scene of script.scenes) {
    const sceneKey = `场景${scene.scene_number}: ${scene.location?.name || "未知地点"}`;
    const sceneDialogues = [];
    for (const beat of scene.beats || []) {
      if (beat.type === "dialogue" && beat.text) {
        const d = {
          scene_number: scene.scene_number,
          character: resolveCharName(beat.character || "未知角色"),
          original_text: beat.text,
          emotion: beat.emotion || "",
          subtext: beat.subtext || "",
        };
        allDialogues.push(d);
        sceneDialogues.push(d);
      }
    }
    if (sceneDialogues.length > 0) sceneMap[sceneKey] = sceneDialogues;
  }

  if (allDialogues.length === 0) {
    return res.status(400).json({ error: "剧本中未找到任何对话。" });
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  const send = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    send("progress", { phase: "extract", message: `提取到 ${allDialogues.length} 句对话，正在进行 AI 优化...` });

    // 构建对话列表发给 AI
    const dialogueList = allDialogues
      .map((d, i) => `[${i}] 角色:${d.character} | 情绪:${d.emotion} | 原文:"${d.original_text}" | 潜台词:${d.subtext}`)
      .join("\n");

    const systemPrompt = `你是一位资深的影视对白编辑。你的任务是优化剧本中的对话，使其更加生动、自然、富有戏剧张力。

## 优化原则
1. **口语化**：让对话更像真实的人说话，避免书面语。
2. **节奏感**：调整句子长短，制造张弛有度的节奏。
3. **潜台词强化**：好的对白往往是"话中有话"，强化言外之意。
4. **角色差异化**：不同角色应有不同的说话风格（用词习惯、句式长短、语气）。
5. **保留原意**：不改变对话的核心含义和情节推进功能。
6. **适度精简**：删除冗余，让每句对话都有存在的理由。

## 输出格式
你必须只输出 JSON，格式如下：

\`\`\`json
{
  "dialogues": [
    {
      "index": 0,
      "character": "角色ID",
      "original": "原始对白",
      "optimized": "优化后的对白",
      "improvement": "优化说明（一句话）"
    }
  ],
  "summary": "整体优化总结（50字以内）"
}
\`\`\`

请逐句优化，为每句对话输出以上四个字段。
6. **角色名称一致性**：输出的 character 字段必须与原剧本中的角色中文名完全一致，不得改为拼音或英文。`;

    const stream = await client.chat.completions.create({
      model: AI_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `请优化以下剧本对话：\n\n${dialogueList.slice(0, 8000)}` },
      ],
      max_tokens: 8192,
      temperature: 0.5,
      stream: true,
    });

    let fullResponse = "";
    for await (const chunk of stream) {
      const content = chunk.choices?.[0]?.delta?.content;
      if (content) {
        fullResponse += content;
        send("chunk", { text: content });
      }
    }

    // 解析优化结果
    let result = null;
    try {
      const jsonMatch = fullResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) result = JSON.parse(jsonMatch[0]);
    } catch (_) {}

    send("complete", {
      dialogues: result?.dialogues || [],
      summary: result?.summary || "",
      total_count: allDialogues.length,
      optimized_count: result?.dialogues?.length || 0,
    });
    send("done", {});
  } catch (err) {
    console.error("[优化错误]", err);
    send("error", { message: err.message });
    send("done", {});
  } finally {
    res.end();
  }
});

// ─── 情绪分析接口 ────────────────────────────────────────────────────────────

app.post("/api/analyze-emotions", async (req, res) => {
  const { yaml: yamlContent } = req.body;

  if (!yamlContent || typeof yamlContent !== "string" || yamlContent.trim().length < 100) {
    return res.status(400).json({ error: "请提供有效的剧本 YAML 内容。" });
  }

  let script;
  try {
    script = robustParseScript(yamlContent);
  } catch (e) {
    return res.status(400).json({ error: "YAML 解析失败：" + e.message });
  }

  // 构建角色 ID→name 映射表
  const emoCharNameMap = {};
  if (script.characters) {
    for (const c of script.characters) {
      if (c.id && c.name) emoCharNameMap[c.id] = c.name;
      if (c.name) emoCharNameMap[c.name] = c.name;
    }
  }
  function emoResolveName(id) {
    if (!id) return "未知角色";
    if (/[一-鿿]/.test(id)) return id;
    return emoCharNameMap[id] || id;
  }

  // 按场景提取角色及其对话（使用中文名）
  const sceneEmotions = [];
  for (const scene of script.scenes) {
    const charEmotions = {};
    for (const beat of scene.beats || []) {
      if (beat.type === "dialogue" && beat.character) {
        charEmotions[emoResolveName(beat.character)] = beat.emotion || "未标注";
      }
    }
    sceneEmotions.push({
      scene_number: scene.scene_number,
      location: scene.location?.name || "未知",
      mood: scene.mood || "",
      character_emotions: charEmotions,
      emotional_shift: scene.emotional_shift || "",
    });
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  const send = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    send("progress", { phase: "analyze", message: `正在分析 ${sceneEmotions.length} 个场景的情绪脉络...` });

    const sceneSummary = sceneEmotions
      .map((s) => {
        const ce = Object.entries(s.character_emotions)
          .map(([c, e]) => `${c}:${e}`)
          .join(", ");
        return `场景${s.scene_number} [${s.location}] 氛围:${s.mood} | 角色情绪: ${ce} | 情绪变化:${s.emotional_shift}`;
      })
      .join("\n");

    const systemPrompt = `你是一位影视表演指导专家，擅长分析剧本中的情绪走向并为演员提供表演指导。

## 你的任务
分析剧本每场戏中每个角色的情绪状态，输出结构化的情绪标注。

## 输出格式
你必须只输出 JSON：

\`\`\`json
{
  "emotions": {
    "角色ID": {
      "scene_1": "情绪标签",
      "scene_2": "情绪标签"
    }
  },
  "emotion_arcs": {
    "角色ID": {
      "arc_description": "该角色的情绪变化弧线描述",
      "key_moments": ["关键时刻1", "关键时刻2"]
    }
  },
  "performance_notes": {
    "角色ID": "给演员的表演建议"
  },
  "overall_tone": "全剧情绪基调描述"
}
\`\`\`

## 情绪标签参考
紧张 | 克制 | 愤怒 | 悲伤 | 喜悦 | 恐惧 | 轻蔑 | 温柔 | 坚定 | 犹豫 | 绝望 | 释然 | 焦虑 | 兴奋 | 冷漠 | 嘲讽 | 真诚 | 虚伪

## 分析要求
1. 为每个角色在每个场景标注主导情绪（选择最贴切的1-2个标签）。
2. 描述每个角色的情绪弧线——从开始到结束的变化轨迹。
3. 为演员提供2-3句实用的表演指导。
4. **角色名称一致性**：所有输出的角色名称必须使用原剧本中的中文名，不得改为拼音或英文。`;

    const stream = await client.chat.completions.create({
      model: AI_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `请分析以下剧本的情绪：\n\n${sceneSummary.slice(0, 6000)}` },
      ],
      max_tokens: 8192,
      temperature: 0.4,
      stream: true,
    });

    let fullResponse = "";
    for await (const chunk of stream) {
      const content = chunk.choices?.[0]?.delta?.content;
      if (content) {
        fullResponse += content;
        send("chunk", { text: content });
      }
    }

    let result = null;
    try {
      const jsonMatch = fullResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) result = JSON.parse(jsonMatch[0]);
    } catch (_) {}

    send("complete", {
      emotions: result?.emotions || {},
      emotion_arcs: result?.emotion_arcs || {},
      performance_notes: result?.performance_notes || {},
      overall_tone: result?.overall_tone || "",
    });
    send("done", {});
  } catch (err) {
    console.error("[情绪分析错误]", err);
    send("error", { message: err.message });
    send("done", {});
  } finally {
    res.end();
  }
});

// ─── 启动服务 ───────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n🎬  AI 小说转剧本工具已启动`);
  console.log(`📡  地址: http://localhost:${PORT}`);
  console.log(`🤖  模型: ${AI_MODEL}`);
  console.log(`🔗  API: ${API_BASE_URL}`);
  console.log(`📖  打开浏览器访问上述地址即可使用\n`);
});
