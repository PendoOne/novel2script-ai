// Netlify Function — 纯 fetch 实现，零外部 SDK 依赖
const API_KEY = process.env.API_KEY || "";
const API_BASE = process.env.API_BASE_URL || "https://api.deepseek.com";
const AI_MODEL = process.env.AI_MODEL || "deepseek-chat";

function json(res, data, status) { res.statusCode = status || 200; res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(data)); }

// ─── Chapter detection ──────────────────────────────────────────────────
function detectChapters(text) {
  const pats = [/第[零一二三四五六七八九十百千万\d]+章\s*[^\n]*/g, /第[零一二三四五六七八九十百千万\d]+节\s*[^\n]*/g, /Chapter\s+\d+/gi, /^第[零一二三四五六七八九十百千万\d]+回\s*[^\n]*/gm];
  for (const p of pats) { const m = [...text.matchAll(p)]; if (m.length >= 3) return m.map(x => ({ title: x[0].trim(), index: x.index })); }
  const pgs = text.split(/\n{2,}/); if (pgs.length >= 10) { const cs = Math.ceil(pgs.length / Math.ceil(pgs.length / 50)); const r = []; for (let i = 0; i < pgs.length; i += cs) r.push({ title: `段落 ${Math.floor(i / cs) + 1}`, index: text.indexOf(pgs[i]) }); return r; }
  return [{ title: "全文", index: 0 }];
}
function splitChapters(text, matches) {
  const r = []; for (let i = 0; i < matches.length; i++) { const s = matches[i].index, e = i < matches.length - 1 ? matches[i + 1].index : text.length; r.push({ number: i + 1, title: matches[i].title, content: text.slice(s, e).trim() }); } return r;
}

// ─── DeepSeek API call (streaming) ──────────────────────────────────────
async function deepseekStream(systemPrompt, userMessage, maxTokens, temp, res) {
  res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
  const send = (ev, d) => res.write(`event: ${ev}\ndata: ${JSON.stringify(d)}\n\n`);
  try {
    const r = await fetch(API_BASE + "/v1/chat/completions", {
      method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + API_KEY },
      body: JSON.stringify({ model: AI_MODEL, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userMessage }], max_tokens: maxTokens, temperature: temp, stream: true })
    });
    if (!r.ok) { const e = await r.text(); send("error", { message: "API 错误 " + r.status + ": " + e.slice(0, 200) }); send("done", {}); res.end(); return; }
    const reader = r.body.getReader(); const dec = new TextDecoder(); let buf = "", full = "";
    while (true) { const { done, value } = await reader.read(); if (done) break; buf += dec.decode(value, { stream: true }); const lines = buf.split("\n"); buf = lines.pop(); for (const l of lines) { if (!l.startsWith("data: ")) continue; if (l === "data: [DONE]") continue; try { const j = JSON.parse(l.slice(6)); const c = j.choices?.[0]?.delta?.content; if (c) { full += c; send("chunk", { text: c }); } } catch (_) {} } }
    return full;
  } catch (e) { send("error", { message: e.message }); send("done", {}); res.end(); return null; }
}

// ─── Prompts ────────────────────────────────────────────────────────────
function buildScriptPrompt(meta) {
  return `你是一位资深的影视剧本改编专家。将小说文本改编为 YAML 剧本。只输出 YAML，不要任何解释。

输出格式：
\`\`\`yaml
script:
  meta:
    title: "${meta.title || "未命名剧本"}"
    format: "${meta.format || "tv_series"}"
  characters:
    - id: "中文名"
      name: "中文名"
      role: "protagonist"
      description: ""
  scenes:
    - scene_number: 1
      chapter_ref: 1
      location: {name: "", type: "INT", description: ""}
      time: ""; time_of_day: "evening"; summary: ""; mood: ""
      characters_present: [{id: "", status: "present"}]
      beats:
        - {type: "action", description: "", characters: []}
        - {type: "dialogue", character: "", emotion: "", text: "", subtext: ""}
        - {type: "transition", value: "CUT TO"}
      conflict_level: "medium"
\`\`\`

规则：角色ID和name统一用中文名。每章至少2-3个场景。YAML 缩进2空格。`;
}

// ─── Router ─────────────────────────────────────────────────────────────
exports.handler = async function (event, context) {
  const path = event.path.replace("/.netlify/functions/api", "").replace("/api", "") || "/";
  const method = event.httpMethod;

  // Health
  if (path === "/health" || path === "/api/health") {
    return { statusCode: 200, body: JSON.stringify({ status: "ok", model: AI_MODEL, hasKey: !!API_KEY, ts: new Date().toISOString() }) };
  }

  // Static fallback
  if (method === "GET") {
    try { const fs = require("fs"); const p = require("path"); const fp = p.join(__dirname, "../../public", path === "/" ? "index.html" : path); if (fs.existsSync(fp)) return { statusCode: 200, headers: { "Content-Type": fp.endsWith(".html") ? "text/html" : "application/octet-stream" }, body: fs.readFileSync(fp, "utf-8") }; } catch (_) {}
    try { const fs = require("fs"); const p = require("path"); const fp = p.join(__dirname, "../../public/index.html"); if (fs.existsSync(fp)) return { statusCode: 200, headers: { "Content-Type": "text/html" }, body: fs.readFileSync(fp, "utf-8") }; } catch (_) {}
    return { statusCode: 200, body: "Novel2Script AI" };
  }

  if (!API_KEY) return { statusCode: 500, body: JSON.stringify({ error: "API Key 未配置" }) };

  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch (_) { }

  // ─── /api/convert ──────────────────────────────────────────────────
  if ((path === "/convert" || path === "/api/convert") && method === "POST") {
    const text = body.text || "";
    if (text.trim().length < 500) return { statusCode: 400, body: JSON.stringify({ error: "请提供至少 500 字的小说文本。" }) };

    return new Promise(async (resolve) => {
      const res = { writeHead: () => {}, setHeader: () => {}, write: () => {}, end: () => {} };
      let _body = ""; res.writeHead = (code, headers) => { _body += ""; };
      res.setHeader = () => {};
      res.write = (chunk) => { _body += chunk; };
      res.end = (chunk) => { if (chunk) _body += chunk; resolve({ statusCode: 200, headers: { "Content-Type": "text/event-stream" }, body: _body }); };

      const chs = splitChapters(text, detectChapters(text));
      const send = (ev, d) => { res.write(`event: ${ev}\ndata: ${JSON.stringify(d)}\n\n`); };
      send("progress", { phase: "detect", message: `检测到 ${chs.length} 个章节`, chapters: chs.map(c => ({ number: c.number, title: c.title })) });

      const sp = buildScriptPrompt(body.meta || {});
      let um = chs.map(c => `### ${c.title}\n${c.content.slice(0, 1500)}${c.content.length > 1500 ? "\n...(已截断)" : ""}`).join("\n\n");
      um = `以下是一部小说的 ${chs.length} 个章节。请将其改编为剧本 YAML：\n\n${um}`;
      if (um.length > 180000) { um = chs.map(c => `### ${c.title}\n${c.content.slice(0, 800)}\n...(省略)...\n${c.content.slice(-800)}`).join("\n\n"); um = `以下是一部小说的 ${chs.length} 个章节。请将其改编为剧本 YAML：\n\n${um}`; }

      send("progress", { phase: "ai", message: `AI (${AI_MODEL}) 正在改编...` });
      try {
        const r = await fetch(API_BASE + "/v1/chat/completions", {
          method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + API_KEY },
          body: JSON.stringify({ model: AI_MODEL, messages: [{ role: "system", content: sp }, { role: "user", content: um }], max_tokens: 6000, temperature: 0.4, stream: true })
        });
        if (!r.ok) { const e = await r.text(); send("error", { message: "API " + r.status + ": " + e.slice(0, 200) }); send("done", {}); res.end(); return; }
        const reader = r.body.getReader(); const dec = new TextDecoder(); let buf = "", full = "";
        while (true) { const { done, value } = await reader.read(); if (done) break; buf += dec.decode(value, { stream: true }); const lines = buf.split("\n"); buf = lines.pop(); for (const l of lines) { if (!l.startsWith("data: ") || l === "data: [DONE]") continue; try { const j = JSON.parse(l.slice(6)); const c = j.choices?.[0]?.delta?.content; if (c) { full += c; send("chunk", { text: c }); } } catch (_) {} } }
        send("progress", { phase: "parse", message: "解析中..." });
        // Count scenes and characters from YAML output
        const sceneCount = (full.match(/\n\s*- scene_number:/g) || []).length || (full.match(/\n  - scene_number:/g) || []).length || "未知";
        const charCount = (full.match(/\n\s*- id:\s*"?([^"\n]+)"?\s*\n\s*name:/g) || []).length || (full.match(/\n  - id:\s*"?([^"\n]+)"?\s*\n\s*name:/g) || []).length || "未知";
        send("complete", { yaml: full, parsed: true, stats: { chapterCount: chs.length, sceneCount, characterCount: charCount, yamlLength: full.length } });
      } catch (e) { send("error", { message: e.message }); }
      send("done", {}); res.end();
    });
  }

  // ─── /api/analyze ──────────────────────────────────────────────────
  if ((path === "/analyze" || path === "/api/analyze") && method === "POST") {
    const text = body.text || "";
    if (text.trim().length < 500) return { statusCode: 400, body: JSON.stringify({ error: "请提供至少 500 字的小说文本。" }) };

    return new Promise(async (resolve) => {
      let _body = ""; const res = { write: (c) => { _body += c; }, end: (c) => { if (c) _body += c; resolve({ statusCode: 200, headers: { "Content-Type": "text/event-stream" }, body: _body }); }, writeHead: () => {}, setHeader: () => {} };
      const send = (ev, d) => res.write(`event: ${ev}\ndata: ${JSON.stringify(d)}\n\n`);
      const chs = splitChapters(text, detectChapters(text));
      const pv = chs.map(c => `### ${c.title}\n${c.content.slice(0, 1500)}`).join("\n\n");
      const sp = `你是小说分析专家。只输出JSON：{"characters":[{"id":"中文名","name":"中文名","role":"protagonist|antagonist|supporting|minor","description":"","traits":[],"first_appearance":""}],"locations":[{"name":"","type":"INT|EXT","description":""}],"conflicts":[{"type":"","description":"","involved_characters":[],"intensity":"low|medium|high|climax","chapter_range":""}]}`;
      try {
        send("progress", { phase: "ai", message: "AI 分析中..." });
        const r = await fetch(API_BASE + "/v1/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + API_KEY }, body: JSON.stringify({ model: AI_MODEL, messages: [{ role: "system", content: sp }, { role: "user", content: "分析以下小说：" + pv.slice(0, 8000) }], max_tokens: 4000, temperature: 0.3, stream: true }) });
        if (!r.ok) { send("error", { message: "API " + r.status }); send("done", {}); res.end(); return; }
        const reader = r.body.getReader(); const dec = new TextDecoder(); let buf = "", full = "";
        while (true) { const { done, value } = await reader.read(); if (done) break; buf += dec.decode(value, { stream: true }); const lines = buf.split("\n"); buf = lines.pop(); for (const l of lines) { if (!l.startsWith("data: ") || l === "data: [DONE]") continue; try { const j = JSON.parse(l.slice(6)); const c = j.choices?.[0]?.delta?.content; if (c) { full += c; send("chunk", { text: c }); } } catch (_) {} } }
        let analysis = null; try { const m = full.match(/\{[\s\S]*\}/); if (m) analysis = JSON.parse(m[0]); } catch (_) {}
        send("complete", { analysis, parsed: !!analysis, stats: { chapters: chs.length, characters: analysis?.characters?.length || 0, locations: analysis?.locations?.length || 0, conflicts: analysis?.conflicts?.length || 0 } });
      } catch (e) { send("error", { message: e.message }); }
      send("done", {}); res.end();
    });
  }

  // ─── /api/optimize-dialogues ───────────────────────────────────────
  if ((path === "/optimize-dialogues" || path === "/api/optimize-dialogues") && method === "POST") {
    const yt = body.yaml || "";
    if (yt.trim().length < 100) return { statusCode: 400, body: JSON.stringify({ error: "请提供 YAML 内容" }) };

    // Extract dialogues from YAML text with simple regex
    const dials = [];
    const sceneBlocks = yt.split(/\n\s*- scene_number:/);
    let sn = 0;
    for (const block of sceneBlocks) { sn++; const dm = block.matchAll(/\n\s*character:\s*"?([^"\n]+)"?[\s\S]*?\n\s*text:\s*"([^"]+)"/g); for (const m of dm) { dials.push({ scene_number: sn, character: m[1].trim(), original_text: m[2] }); } }

    if (dials.length === 0) return { statusCode: 400, body: JSON.stringify({ error: "未找到对话" }) };

    return new Promise(async (resolve) => {
      let _body = ""; const res = { write: (c) => { _body += c; }, end: (c) => { if (c) _body += c; resolve({ statusCode: 200, headers: { "Content-Type": "text/event-stream" }, body: _body }); }, writeHead: () => {}, setHeader: () => {} };
      const send = (ev, d) => res.write(`event: ${ev}\ndata: ${JSON.stringify(d)}\n\n`);
      send("progress", { phase: "extract", message: `提取到 ${dials.length} 句对话` });
      const dl = dials.map((d, i) => `[${i}] ${d.character}: "${d.original_text}"`).join("\n");
      try {
        const sp = "你是影视对白编辑。优化对话。输出JSON：{\"dialogues\":[{\"index\":0,\"character\":\"角色名\",\"original\":\"原对白\",\"optimized\":\"优化后\",\"improvement\":\"说明\"}]}。角色名必须用中文。";
        const r = await fetch(API_BASE + "/v1/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + API_KEY }, body: JSON.stringify({ model: AI_MODEL, messages: [{ role: "system", content: sp }, { role: "user", content: "优化：" + dl.slice(0, 6000) }], max_tokens: 4000, temperature: 0.5, stream: true }) });
        if (!r.ok) { send("error", { message: "API " + r.status }); send("done", {}); res.end(); return; }
        const reader = r.body.getReader(); const dec = new TextDecoder(); let buf = "", full = "";
        while (true) { const { done, value } = await reader.read(); if (done) break; buf += dec.decode(value, { stream: true }); const lines = buf.split("\n"); buf = lines.pop(); for (const l of lines) { if (!l.startsWith("data: ") || l === "data: [DONE]") continue; try { const j = JSON.parse(l.slice(6)); const c = j.choices?.[0]?.delta?.content; if (c) { full += c; send("chunk", { text: c }); } } catch (_) {} } }
        let result = null; try { const m = full.match(/\{[\s\S]*\}/); if (m) result = JSON.parse(m[0]); } catch (_) {}
        send("complete", { dialogues: result?.dialogues || [], summary: result?.summary || "", total_count: dials.length, optimized_count: result?.dialogues?.length || 0 });
      } catch (e) { send("error", { message: e.message }); }
      send("done", {}); res.end();
    });
  }

  // ─── /api/analyze-emotions ─────────────────────────────────────────
  if ((path === "/analyze-emotions" || path === "/api/analyze-emotions") && method === "POST") {
    const yt = body.yaml || "";
    if (yt.trim().length < 100) return { statusCode: 400, body: JSON.stringify({ error: "请提供 YAML 内容" }) };

    // Extract scene emotions
    const scenes = [];
    const sceneBlocks = yt.split(/\n\s*- scene_number:/);
    let sn2 = 0;
    for (const block of sceneBlocks) { sn2++; const locM = block.match(/location:\s*\n\s*name:\s*"?([^"\n]+)"?/); const moodM = block.match(/mood:\s*"?([^"\n]+)"?/); const emos = []; const dm2 = block.matchAll(/\n\s*character:\s*"?([^"\n]+)"?[\s\S]*?\n\s*emotion:\s*"?([^"\n]+)"?/g); for (const m of dm2) { emos.push(m[1].trim() + ":" + m[2].trim()); } scenes.push(`场景${sn2}[${locM?.[1]||"?"}] 氛围:${moodM?.[1]||""} | ${emos.join(", ")}`); }

    return new Promise(async (resolve) => {
      let _body = ""; const res = { write: (c) => { _body += c; }, end: (c) => { if (c) _body += c; resolve({ statusCode: 200, headers: { "Content-Type": "text/event-stream" }, body: _body }); }, writeHead: () => {}, setHeader: () => {} };
      const send = (ev, d) => res.write(`event: ${ev}\ndata: ${JSON.stringify(d)}\n\n`);
      send("progress", { phase: "analyze", message: `分析 ${scenes.length} 个场景` });
      try {
        const sp = "你是表演指导。分析情绪。输出JSON：{\"emotions\":{\"角色名\":{\"scene_1\":\"情绪\"}},\"emotion_arcs\":{\"角色名\":{\"arc_description\":\"\",\"key_moments\":[]}},\"performance_notes\":{\"角色名\":\"\"},\"overall_tone\":\"\"}。角色名必须用中文。";
        const r = await fetch(API_BASE + "/v1/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + API_KEY }, body: JSON.stringify({ model: AI_MODEL, messages: [{ role: "system", content: sp }, { role: "user", content: "分析情绪：" + scenes.join("\n").slice(0, 5000) }], max_tokens: 4000, temperature: 0.4, stream: true }) });
        if (!r.ok) { send("error", { message: "API " + r.status }); send("done", {}); res.end(); return; }
        const reader = r.body.getReader(); const dec = new TextDecoder(); let buf = "", full = "";
        while (true) { const { done, value } = await reader.read(); if (done) break; buf += dec.decode(value, { stream: true }); const lines = buf.split("\n"); buf = lines.pop(); for (const l of lines) { if (!l.startsWith("data: ") || l === "data: [DONE]") continue; try { const j = JSON.parse(l.slice(6)); const c = j.choices?.[0]?.delta?.content; if (c) { full += c; send("chunk", { text: c }); } } catch (_) {} } }
        let result = null; try { const m = full.match(/\{[\s\S]*\}/); if (m) result = JSON.parse(m[0]); } catch (_) {}
        send("complete", { emotions: result?.emotions || {}, emotion_arcs: result?.emotion_arcs || {}, performance_notes: result?.performance_notes || {}, overall_tone: result?.overall_tone || "" });
      } catch (e) { send("error", { message: e.message }); }
      send("done", {}); res.end();
    });
  }

  return { statusCode: 404, body: JSON.stringify({ error: "Not found" }) };
};
