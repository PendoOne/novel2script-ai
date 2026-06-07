// Netlify Serverless Function — wraps Express app
const serverless = require("serverless-http");
const express = require("express");
const OpenAI = require("openai").default;
const yaml = require("js-yaml");
const path = require("path");

const app = express();
app.use(express.json({ limit: "5mb" }));

// ─── Config from Netlify env vars ──────────────────────────────────────
const API_KEY = process.env.API_KEY;
const API_BASE_URL = process.env.API_BASE_URL || "https://api.deepseek.com";
const AI_MODEL = process.env.AI_MODEL || "deepseek-chat";

const client = API_KEY ? new OpenAI({ apiKey: API_KEY, baseURL: API_BASE_URL }) : null;

// ─── Chapter Detection ──────────────────────────────────────────────────
function detectChapters(text) {
  const patterns = [
    /第[零一二三四五六七八九十百千万\d]+章\s*[^\n]*/g,
    /第[零一二三四五六七八九十百千万\d]+节\s*[^\n]*/g,
    /Chapter\s+\d+/gi,
    /CHAPTER\s+[IVXLCDM]+/g,
    /^第[零一二三四五六七八九十百千万\d]+回\s*[^\n]*/gm,
  ];
  for (const pattern of patterns) {
    const matches = [...text.matchAll(pattern)];
    if (matches.length >= 3) return matches.map((m) => ({ title: m[0].trim(), index: m.index }));
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
    chapters.push({ number: i + 1, title: chapterMatches[i].title, content: text.slice(start, end).trim() });
  }
  return chapters;
}

// ─── System Prompt ─────────────────────────────────────────────────────
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

// ─── Robust YAML parser ────────────────────────────────────────────────
function robustParseScript(yamlText) {
  let content = yamlText;
  const m = content.match(/```(?:yaml)?\s*\n([\s\S]*?)\n```/);
  if (m) content = m[1];
  const sm = content.match(/(?:^|\n)(script:[\s\S]*)/);
  if (sm) content = sm[1];
  let parsed = yaml.load(content);
  if (!parsed) throw new Error("YAML 为空");
  if (!parsed.script) {
    if (parsed.scenes || parsed.characters || parsed.meta) parsed = { script: parsed };
    else throw new Error("缺少 script 根节点");
  }
  if (!parsed.script.scenes || !Array.isArray(parsed.script.scenes)) throw new Error("script.scenes 不存在或不是数组");
  return parsed.script;
}

// ─── Helper for SSE ────────────────────────────────────────────────────
function sseSend(res) {
  return (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

// ─── Health ────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", provider: API_BASE_URL, model: AI_MODEL, hasKey: !!API_KEY, timestamp: new Date().toISOString() });
});

// ─── Convert (SSE) ─────────────────────────────────────────────────────
app.post("/api/convert", async (req, res) => {
  const { text, meta } = req.body;
  if (!text || typeof text !== "string" || text.trim().length < 500) {
    return res.status(400).json({ error: "请提供至少 500 字的小说文本。" });
  }
  if (!client) return res.status(500).json({ error: "API Key 未配置" });

  res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive", "X-Accel-Buffering": "no" });
  const send = sseSend(res);

  try {
    send("progress", { phase: "detect", message: "正在检测章节结构..." });
    const chapterMatches = detectChapters(text);
    const chapters = splitChapters(text, chapterMatches);
    send("progress", { phase: "detect", message: `检测到 ${chapters.length} 个章节`, chapters: chapters.map((c) => ({ number: c.number, title: c.title })) });

    send("progress", { phase: "ai", message: `AI (${AI_MODEL}) 正在分析文本并改编剧本...` });
    const systemPrompt = buildSystemPrompt(meta || {});
    const chapterOutline = chapters.map((c) => `### ${c.title}\n${c.content.slice(0, 500)}...（共 ${c.content.length} 字）`).join("\n\n");
    let userMessage = `以下是一部小说的 ${chapters.length} 个章节。请将其改编为剧本 YAML。\n\n${chapterOutline}\n\n请根据上述全部文本内容，生成完整的剧本 YAML。`;

    if (userMessage.length > 200000) {
      send("progress", { phase: "ai", message: "文本较长，智能压缩中..." });
      const compressedChapters = chapters.map((c) => `### ${c.title}\n${c.content.slice(0, 2000)}\n\n...（中间省略）...\n\n${c.content.slice(-2000)}`);
      userMessage = `以下是一部小说的 ${chapters.length} 个章节。请将其改编为剧本 YAML。\n\n${compressedChapters.join("\n\n")}\n\n请根据上述全部文本内容，生成完整的剧本 YAML。`;
    }

    const stream = await client.chat.completions.create({
      model: AI_MODEL, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userMessage }],
      max_tokens: 16384, temperature: 0.4, stream: true,
    });

    let fullResponse = "";
    for await (const chunk of stream) {
      const content = chunk.choices?.[0]?.delta?.content;
      if (content) { fullResponse += content; send("chunk", { text: content }); }
    }

    send("progress", { phase: "parse", message: "正在解析和验证 YAML..." });
    let yamlContent = fullResponse;
    const yamlMatch = fullResponse.match(/```(?:yaml)?\s*\n([\s\S]*?)\n```/);
    if (yamlMatch) yamlContent = yamlMatch[1];
    else { const sm = fullResponse.match(/(?:^|\n)(script:[\s\S]*)/); if (sm) yamlContent = sm[1]; }

    let parsed;
    try {
      parsed = yaml.load(yamlContent);
      if (!parsed) throw new Error("YAML 为空");
      if (!parsed.script) { if (parsed.scenes || parsed.characters) parsed = { script: parsed }; else throw new Error("缺少 script 根节点"); }
    } catch (parseErr) {
      send("warning", { message: "YAML 解析警告：" + parseErr.message });
      parsed = null;
    }

    send("complete", { yaml: yamlContent, parsed: !!parsed, stats: { chapterCount: chapters.length, sceneCount: parsed?.script?.scenes?.length || "未知", characterCount: parsed?.script?.characters?.length || "未知", yamlLength: yamlContent.length } });
    send("done", {});
  } catch (err) {
    console.error("[转换错误]", err);
    send("error", { message: err.message });
    send("done", {});
  } finally { res.end(); }
});

// ─── Analyze ───────────────────────────────────────────────────────────
app.post("/api/analyze", async (req, res) => {
  const { text } = req.body;
  if (!text || text.trim().length < 500) return res.status(400).json({ error: "请提供至少 500 字的小说文本。" });
  if (!client) return res.status(500).json({ error: "API Key 未配置" });

  res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive", "X-Accel-Buffering": "no" });
  const send = sseSend(res);

  try {
    const chapters = splitChapters(text, detectChapters(text));
    const previewText = chapters.map((c) => `### ${c.title}\n${c.content.slice(0, 2000)}${c.content.length > 2000 ? "\n...（已截断）" : ""}`).join("\n\n");

    const systemPrompt = `你是一位专业的小说分析专家。你的任务是从小说文本中提取三类信息，并以 JSON 格式输出。你必须只输出一个 JSON 对象，不要输出任何解释文字：{"characters":[{"id":"中文名","name":"中文名","role":"protagonist|antagonist|supporting|minor","description":"一句话描述","traits":["性格标签"],"first_appearance":"第X章"}],"locations":[{"name":"地点名称","type":"INT|EXT","description":"环境描述","scenes":["相关情节"]}],"conflicts":[{"type":"character_vs_character|character_vs_self|character_vs_society|character_vs_fate","description":"冲突描述","involved_characters":["角色名"],"intensity":"low|medium|high|climax","chapter_range":"第X章-第Y章"}]}`;

    const stream = await client.chat.completions.create({
      model: AI_MODEL, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: `请分析以下小说的剧情要素：\n\n${previewText}` }],
      max_tokens: 8192, temperature: 0.3, stream: true,
    });

    let fullResponse = "";
    for await (const chunk of stream) { const content = chunk.choices?.[0]?.delta?.content; if (content) { fullResponse += content; send("chunk", { text: content }); } }

    let analysis = null;
    try { const jsonMatch = fullResponse.match(/\{[\s\S]*\}/); if (jsonMatch) analysis = JSON.parse(jsonMatch[0]); } catch (_) {}

    send("complete", { analysis, parsed: !!analysis, stats: { chapters: chapters.length, characters: analysis?.characters?.length || 0, locations: analysis?.locations?.length || 0, conflicts: analysis?.conflicts?.length || 0, sourceLength: text.length } });
    send("done", {});
  } catch (err) { send("error", { message: err.message }); send("done", {}); }
  finally { res.end(); }
});

// ─── Optimize Dialogues ────────────────────────────────────────────────
app.post("/api/optimize-dialogues", async (req, res) => {
  const { yaml: yamlContent } = req.body;
  if (!yamlContent || yamlContent.trim().length < 100) return res.status(400).json({ error: "请提供有效的剧本 YAML 内容。" });
  if (!client) return res.status(500).json({ error: "API Key 未配置" });

  let script;
  try { script = robustParseScript(yamlContent); } catch (e) { return res.status(400).json({ error: "YAML 解析失败：" + e.message }); }

  const charNameMap = {};
  if (script.characters) { for (const c of script.characters) { if (c.id && c.name) charNameMap[c.id] = c.name; if (c.name) charNameMap[c.name] = c.name; } }
  function resolveCharName(id) { if (!id) return "未知角色"; if (/[一-鿿]/.test(id)) return id; return charNameMap[id] || id; }

  const allDialogues = [];
  for (const scene of script.scenes) {
    for (const beat of scene.beats || []) {
      if (beat.type === "dialogue" && beat.text) {
        allDialogues.push({ scene_number: scene.scene_number, character: resolveCharName(beat.character || "未知角色"), original_text: beat.text, emotion: beat.emotion || "", subtext: beat.subtext || "" });
      }
    }
  }
  if (allDialogues.length === 0) return res.status(400).json({ error: "剧本中未找到任何对话。" });

  res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive", "X-Accel-Buffering": "no" });
  const send = sseSend(res);

  try {
    const dialogueList = allDialogues.map((d, i) => `[${i}] 角色:${d.character} | 情绪:${d.emotion} | 原文:"${d.original_text}" | 潜台词:${d.subtext}`).join("\n");
    const systemPrompt = `你是一位资深的影视对白编辑。优化剧本对话，使其更生动自然。输出 JSON：{"dialogues":[{"index":0,"character":"角色名","original":"原始对白","optimized":"优化后对白","improvement":"优化说明"}]}。角色名称必须与原剧本中文名完全一致。`;

    const stream = await client.chat.completions.create({
      model: AI_MODEL, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: `优化以下剧本对话：\n\n${dialogueList.slice(0, 8000)}` }],
      max_tokens: 8192, temperature: 0.5, stream: true,
    });

    let fullResponse = "";
    for await (const chunk of stream) { const content = chunk.choices?.[0]?.delta?.content; if (content) { fullResponse += content; send("chunk", { text: content }); } }

    let result = null;
    try { const jsonMatch = fullResponse.match(/\{[\s\S]*\}/); if (jsonMatch) result = JSON.parse(jsonMatch[0]); } catch (_) {}
    send("complete", { dialogues: result?.dialogues || [], summary: result?.summary || "", total_count: allDialogues.length, optimized_count: result?.dialogues?.length || 0 });
    send("done", {});
  } catch (err) { send("error", { message: err.message }); send("done", {}); }
  finally { res.end(); }
});

// ─── Analyze Emotions ──────────────────────────────────────────────────
app.post("/api/analyze-emotions", async (req, res) => {
  const { yaml: yamlContent } = req.body;
  if (!yamlContent || yamlContent.trim().length < 100) return res.status(400).json({ error: "请提供有效的剧本 YAML 内容。" });
  if (!client) return res.status(500).json({ error: "API Key 未配置" });

  let script;
  try { script = robustParseScript(yamlContent); } catch (e) { return res.status(400).json({ error: "YAML 解析失败：" + e.message }); }

  const emoCharNameMap = {};
  if (script.characters) { for (const c of script.characters) { if (c.id && c.name) emoCharNameMap[c.id] = c.name; if (c.name) emoCharNameMap[c.name] = c.name; } }
  function emoResolveName(id) { if (!id) return "未知角色"; if (/[一-鿿]/.test(id)) return id; return emoCharNameMap[id] || id; }

  const sceneEmotions = [];
  for (const scene of script.scenes) {
    const charEmotions = {};
    for (const beat of scene.beats || []) { if (beat.type === "dialogue" && beat.character) { charEmotions[emoResolveName(beat.character)] = beat.emotion || "未标注"; } }
    sceneEmotions.push({ scene_number: scene.scene_number, location: scene.location?.name || "未知", mood: scene.mood || "", character_emotions: charEmotions, emotional_shift: scene.emotional_shift || "" });
  }

  res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive", "X-Accel-Buffering": "no" });
  const send = sseSend(res);

  try {
    const sceneSummary = sceneEmotions.map((s) => { const ce = Object.entries(s.character_emotions).map(([c, e]) => `${c}:${e}`).join(", "); return `场景${s.scene_number} [${s.location}] 氛围:${s.mood} | 角色情绪: ${ce} | 情绪变化:${s.emotional_shift}`; }).join("\n");

    const systemPrompt = `你是影视表演指导专家。分析剧本情绪，输出 JSON：{"emotions":{"角色名":{"scene_1":"情绪"}},"emotion_arcs":{"角色名":{"arc_description":"","key_moments":[]}},"performance_notes":{"角色名":""},"overall_tone":""}。角色名称必须使用原剧本中文名。`;

    const stream = await client.chat.completions.create({
      model: AI_MODEL, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: `分析以下剧本情绪：\n\n${sceneSummary.slice(0, 6000)}` }],
      max_tokens: 8192, temperature: 0.4, stream: true,
    });

    let fullResponse = "";
    for await (const chunk of stream) { const content = chunk.choices?.[0]?.delta?.content; if (content) { fullResponse += content; send("chunk", { text: content }); } }

    let result = null;
    try { const jsonMatch = fullResponse.match(/\{[\s\S]*\}/); if (jsonMatch) result = JSON.parse(jsonMatch[0]); } catch (_) {}
    send("complete", { emotions: result?.emotions || {}, emotion_arcs: result?.emotion_arcs || {}, performance_notes: result?.performance_notes || {}, overall_tone: result?.overall_tone || "" });
    send("done", {});
  } catch (err) { send("error", { message: err.message }); send("done", {}); }
  finally { res.end(); }
});

// ─── Static files ──────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, "../../public")));
app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "../../public/index.html")));

module.exports.handler = serverless(app);
