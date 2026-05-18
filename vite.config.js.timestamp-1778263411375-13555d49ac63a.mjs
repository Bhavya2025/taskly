// vite.config.js
import { defineConfig, loadEnv } from "file:///sessions/pensive-sweet-pasteur/mnt/VSC%20Projects--Personal%20Task%20Manager/node_modules/vite/dist/node/index.js";
import react from "file:///sessions/pensive-sweet-pasteur/mnt/VSC%20Projects--Personal%20Task%20Manager/node_modules/@vitejs/plugin-react/dist/index.js";

// server/geminiHelpers.js
var GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
function getModel() {
  return process.env.TASKLY_GROQ_MODEL || "llama-3.3-70b-versatile";
}
var GEMINI_MODEL = "llama-3.3-70b-versatile";
var SYSTEM_PROMPT = `You are Taskly, the AI board assistant for a kanban-style task manager.
Your ONLY job is to help users create and edit project boards.
Return concise, actionable work items \u2014 never generic motivational fluff.
When the prompt is short or vague, infer the most common real-world interpretation and produce concrete subtopics.
Prefer 3\u20136 columns and 6\u201314 tasks unless the user clearly needs more or fewer.
Task titles must be short, specific, and actionable (under 10 words).
Column titles must be clear workflow-stage names (e.g. To Do, In Progress, Review, Done).
You may suggest hex colors for columns (#rrggbb), emoji icons, task accent colors, and sound presets (soft, bright, lift, chime, reward).
Do NOT invent tasks for blank-project requests.
IGNORE any message not about managing a project board \u2014 return type "unknown" with a polite redirect.
ALWAYS return valid JSON matching the exact structure specified in the user message.`;
var generateSchema = { type: "json_object" };
var commandSchema = { type: "json_object" };
var GENERATE_JSON_STRUCTURE = `
Return ONLY a JSON object with this exact structure (no extra keys):
{
  "patternLabel": "short project type label e.g. 'Marketing Campaign'",
  "summary": "one sentence project summary",
  "suggestedTheme": "one of: dark, light, teal, midnight, neon",
  "suggestedEmoji": "single relevant emoji",
  "suggestedColumns": [
    { "title": "column name", "color": "#rrggbb or empty string", "icon": "emoji or empty string", "soundPreset": "one of: soft, bright, lift, chime, reward" }
  ],
  "tasks": [
    {
      "title": "short actionable task title",
      "description": "one sentence detail or empty string",
      "priority": "one of: urgent, high, medium, low",
      "suggestedColumn": "must match one of the suggestedColumns titles exactly",
      "tags": ["tag1"],
      "emoji": "single emoji or empty string",
      "accentColor": "#rrggbb or empty string"
    }
  ]
}`;
var COMMAND_JSON_STRUCTURE = `
Return ONLY a JSON object with this exact structure (no extra keys):
{
  "type": "one of: delete_task, mark_done, move_task, rename_col, delete_col, add_col, add_task, set_description, set_column_color, set_column_sound, set_column_icon, set_task_emoji, set_task_color, set_priority, rename_task, info, unknown",
  "response": "short human-readable confirmation or info message",
  "taskQuery": "approximate task title to find (empty string if not applicable)",
  "columnQuery": "approximate column title to find (empty string if not applicable)",
  "title": "new title if renaming (empty string if not applicable)",
  "description": "new description if setting (empty string if not applicable)",
  "priority": "one of: urgent, high, medium, low, or empty string",
  "color": "#rrggbb hex color or empty string",
  "icon": "emoji icon or empty string",
  "emoji": "task emoji or empty string",
  "soundPreset": "one of: soft, bright, lift, chime, reward, or empty string",
  "done": true or false
}`;
function normalizeHex(v = "") {
  return /^#[0-9a-f]{6}$/i.test(v) ? v : "";
}
function normalizeColumns(columns = []) {
  return columns.map((c, i) => ({
    title: String(c?.title || `Column ${i + 1}`),
    color: normalizeHex(c?.color),
    icon: String(c?.icon || ""),
    soundPreset: String(c?.soundPreset || "")
  }));
}
function normalizeTasks(tasks = [], columns = []) {
  const byId = new Map(columns.map((c) => [c.id, c.title]));
  return tasks.map((t) => ({
    title: String(t?.title || "Untitled"),
    description: String(t?.description || ""),
    priority: String(t?.priority || "medium"),
    column: byId.get(t?.columnId) || "",
    done: !!t?.done,
    tags: Array.isArray(t?.tags) ? t.tags.slice(0, 4) : [],
    emoji: String(t?.emoji || ""),
    accentColor: normalizeHex(t?.accentColor)
  }));
}
function buildGeneratePrompt({ prompt, existingColumns }) {
  return [
    "Generate a Taskly board plan based on the following context.",
    "If the prompt is only 1\u20132 words, infer the topic and produce concrete subtopics.",
    "Map tasks to existing columns where possible, suggest better ones if current ones are weak.",
    "",
    "Project context:",
    prompt,
    "",
    "Existing columns (use if suitable):",
    JSON.stringify(normalizeColumns(existingColumns), null, 2),
    "",
    "Use concise task titles. Be practical and specific.",
    GENERATE_JSON_STRUCTURE
  ].join("\n");
}
function buildProjectSeedPrompt({ projectName, description }) {
  return [
    "You are generating the FIRST board a user will ever see for their new project.",
    "This is their first impression \u2014 make it outstanding.",
    "",
    "Before producing output, deeply reason through:",
    "  1. What domain/industry does this project belong to?",
    "  2. What are the real workflow stages someone in this domain actually uses?",
    "  3. What are the most important concrete tasks to get started immediately?",
    "  4. What theme, emoji, and colors would feel cohesive and professional for this context?",
    "  5. Are the task titles specific and actionable \u2014 not generic filler?",
    "",
    `Project name: ${projectName || "Untitled"}`,
    `User description: ${description || "(none \u2014 infer from the project name)"}`,
    "",
    "Requirements:",
    '  - 4\u20136 columns that reflect a REAL workflow for this specific domain (not generic "To Do / Done")',
    "  - 8\u201314 tasks spread across columns, each immediately useful and specific to this project",
    "  - Every task must have a clear description (1\u20132 sentences explaining why it matters)",
    "  - Assign priorities thoughtfully: 1\u20132 urgent, 2\u20133 high, rest medium/low",
    "  - Choose a suggestedTheme that fits the mood of the project",
    "  - Each column should have a fitting emoji icon and a hex color that complements the theme",
    "  - Tags should be short and genuinely useful for filtering (2\u20133 per task max)",
    "  - The summary should be one confident, specific sentence describing what this board helps the user achieve",
    "",
    GENERATE_JSON_STRUCTURE
  ].join("\n");
}
function buildCommandPrompt({ input, columns, tasks }) {
  return [
    "Interpret exactly one Taskly board command and return one structured action.",
    "Use taskQuery and columnQuery to reference existing items by approximate name.",
    'If the user asks for a summary or board status, return type "info" with the info in "response".',
    'If the request is off-topic, return type "unknown".',
    "",
    `User command: ${input}`,
    "",
    "Current columns:",
    JSON.stringify(normalizeColumns(columns), null, 2),
    "",
    "Current tasks:",
    JSON.stringify(normalizeTasks(tasks, columns), null, 2),
    "",
    COMMAND_JSON_STRUCTURE
  ].join("\n");
}
async function callGemini({ apiKey, schema, userPrompt, maxTokens = 2048 }) {
  if (!apiKey) {
    const err = new Error("Missing TASKLY_GROQ_API_KEY on the server.");
    err.statusCode = 503;
    throw err;
  }
  const https = await import("node:https");
  const payload = JSON.stringify({
    model: getModel(),
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt }
    ],
    response_format: { type: "json_object" },
    temperature: 0.7,
    max_tokens: maxTokens
  });
  const json = await new Promise((resolve, reject) => {
    const url = new URL(GROQ_URL);
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "Content-Length": Buffer.byteLength(payload)
      }
    }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString());
          if (res.statusCode >= 400) {
            const err = new Error(body?.error?.message || `Groq error ${res.statusCode}`);
            err.statusCode = res.statusCode;
            reject(err);
          } else {
            resolve(body);
          }
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
  const text = json?.choices?.[0]?.message?.content;
  if (!text) throw new Error("Groq returned an empty response.");
  return JSON.parse(text);
}
function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.end(JSON.stringify(payload));
}
async function readJsonBody(req) {
  if (req.body !== void 0) {
    return typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  return raw ? JSON.parse(raw) : {};
}

// server/tasklyAiServer.js
var AI_ROUTE_PREFIX = "/api/ai";
function getApiKey() {
  return process.env.TASKLY_GROQ_API_KEY || "";
}
function attachAiMiddleware(server) {
  server.middlewares.use(async (req, res, next) => {
    if (req.method === "GET" && req.url === "/api/ai/status") {
      sendJson(res, 200, { ok: !!getApiKey(), model: GEMINI_MODEL });
      return;
    }
    if (req.method !== "POST" || !req.url?.startsWith(AI_ROUTE_PREFIX)) {
      next();
      return;
    }
    try {
      const body = await readJsonBody(req);
      const apiKey = getApiKey();
      if (req.url === "/api/ai/generate") {
        const result = await callGemini({
          apiKey,
          schema: generateSchema,
          userPrompt: buildGeneratePrompt({
            prompt: String(body.prompt || "").trim(),
            existingColumns: Array.isArray(body.existingColumns) ? body.existingColumns : []
          })
        });
        sendJson(res, 200, { ...result, model: GEMINI_MODEL });
        return;
      }
      if (req.url === "/api/ai/project-seed") {
        const result = await callGemini({
          apiKey,
          schema: generateSchema,
          maxTokens: 4096,
          userPrompt: buildProjectSeedPrompt({
            projectName: String(body.projectName || "").trim(),
            description: String(body.description || "").trim()
          })
        });
        sendJson(res, 200, { ...result, model: GEMINI_MODEL });
        return;
      }
      if (req.url === "/api/ai/command") {
        const result = await callGemini({
          apiKey,
          schema: commandSchema,
          userPrompt: buildCommandPrompt({
            input: String(body.input || "").trim(),
            columns: Array.isArray(body.columns) ? body.columns : [],
            tasks: Array.isArray(body.tasks) ? body.tasks : []
          })
        });
        sendJson(res, 200, { ...result, model: GEMINI_MODEL });
        return;
      }
      if (req.url === "/api/ai/status") {
        sendJson(res, 200, { ok: !!apiKey, model: GEMINI_MODEL });
        return;
      }
      next();
    } catch (err) {
      console.error("[Taskly AI]", err.message);
      sendJson(res, err.statusCode || 500, {
        error: err.message || "Taskly AI request failed."
      });
    }
  });
}
function createTasklyAiPlugin() {
  return {
    name: "taskly-ai-server",
    configureServer(server) {
      attachAiMiddleware(server);
    },
    configurePreviewServer(server) {
      attachAiMiddleware(server);
    }
  };
}

// vite.config.js
var vite_config_default = defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), ""));
  return {
    plugins: [react(), createTasklyAiPlugin()],
    server: {
      host: true,
      port: 5173,
      strictPort: true,
      allowedHosts: true
    },
    preview: {
      host: true,
      port: 5173,
      strictPort: true,
      allowedHosts: true
    }
  };
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiLCAic2VydmVyL2dlbWluaUhlbHBlcnMuanMiLCAic2VydmVyL3Rhc2tseUFpU2VydmVyLmpzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiL3Nlc3Npb25zL3BlbnNpdmUtc3dlZXQtcGFzdGV1ci9tbnQvVlNDIFByb2plY3RzLS1QZXJzb25hbCBUYXNrIE1hbmFnZXJcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9zZXNzaW9ucy9wZW5zaXZlLXN3ZWV0LXBhc3RldXIvbW50L1ZTQyBQcm9qZWN0cy0tUGVyc29uYWwgVGFzayBNYW5hZ2VyL3ZpdGUuY29uZmlnLmpzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9zZXNzaW9ucy9wZW5zaXZlLXN3ZWV0LXBhc3RldXIvbW50L1ZTQyUyMFByb2plY3RzLS1QZXJzb25hbCUyMFRhc2slMjBNYW5hZ2VyL3ZpdGUuY29uZmlnLmpzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnLCBsb2FkRW52IH0gZnJvbSAndml0ZSdcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCdcbmltcG9ydCB7IGNyZWF0ZVRhc2tseUFpUGx1Z2luIH0gZnJvbSAnLi9zZXJ2ZXIvdGFza2x5QWlTZXJ2ZXIuanMnXG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZygoeyBtb2RlIH0pID0+IHtcbiAgT2JqZWN0LmFzc2lnbihwcm9jZXNzLmVudiwgbG9hZEVudihtb2RlLCBwcm9jZXNzLmN3ZCgpLCAnJykpXG5cbiAgcmV0dXJuIHtcbiAgICBwbHVnaW5zOiBbcmVhY3QoKSwgY3JlYXRlVGFza2x5QWlQbHVnaW4oKV0sXG4gICAgc2VydmVyOiB7XG4gICAgICBob3N0OiB0cnVlLFxuICAgICAgcG9ydDogNTE3MyxcbiAgICAgIHN0cmljdFBvcnQ6IHRydWUsXG4gICAgICBhbGxvd2VkSG9zdHM6IHRydWUsXG4gICAgfSxcbiAgICBwcmV2aWV3OiB7XG4gICAgICBob3N0OiB0cnVlLFxuICAgICAgcG9ydDogNTE3MyxcbiAgICAgIHN0cmljdFBvcnQ6IHRydWUsXG4gICAgICBhbGxvd2VkSG9zdHM6IHRydWUsXG4gICAgfSxcbiAgfVxufSlcbiIsICJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiL3Nlc3Npb25zL3BlbnNpdmUtc3dlZXQtcGFzdGV1ci9tbnQvVlNDIFByb2plY3RzLS1QZXJzb25hbCBUYXNrIE1hbmFnZXIvc2VydmVyXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvc2Vzc2lvbnMvcGVuc2l2ZS1zd2VldC1wYXN0ZXVyL21udC9WU0MgUHJvamVjdHMtLVBlcnNvbmFsIFRhc2sgTWFuYWdlci9zZXJ2ZXIvZ2VtaW5pSGVscGVycy5qc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vc2Vzc2lvbnMvcGVuc2l2ZS1zd2VldC1wYXN0ZXVyL21udC9WU0MlMjBQcm9qZWN0cy0tUGVyc29uYWwlMjBUYXNrJTIwTWFuYWdlci9zZXJ2ZXIvZ2VtaW5pSGVscGVycy5qc1wiOy8vIFx1MjUwMFx1MjUwMCBUYXNrbHkgQUkgXHUyMDE0IEdyb3EgaGVscGVycyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbi8vIFNoYXJlZCBieSB0aGUgVml0ZSBkZXYtc2VydmVyIHBsdWdpbiBhbmQgdGhlIFZlcmNlbCBzZXJ2ZXJsZXNzIGZ1bmN0aW9ucy5cbi8vIE1vZGVsOiBsbGFtYS0zLjMtNzBiLXZlcnNhdGlsZSB2aWEgR3JvcSAoZnJlZSwgZmFzdClcblxuY29uc3QgR1JPUV9VUkwgPSAnaHR0cHM6Ly9hcGkuZ3JvcS5jb20vb3BlbmFpL3YxL2NoYXQvY29tcGxldGlvbnMnXG5cbmZ1bmN0aW9uIGdldE1vZGVsKCkge1xuICByZXR1cm4gcHJvY2Vzcy5lbnYuVEFTS0xZX0dST1FfTU9ERUwgfHwgJ2xsYW1hLTMuMy03MGItdmVyc2F0aWxlJ1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0R2VtaW5pTW9kZWwoKSB7IHJldHVybiBnZXRNb2RlbCgpIH1cbmV4cG9ydCBjb25zdCBHRU1JTklfTU9ERUwgPSAnbGxhbWEtMy4zLTcwYi12ZXJzYXRpbGUnXG5cbi8vIFx1MjUwMFx1MjUwMCBTeXN0ZW0gcHJvbXB0IFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuZXhwb3J0IGNvbnN0IFNZU1RFTV9QUk9NUFQgPSBgWW91IGFyZSBUYXNrbHksIHRoZSBBSSBib2FyZCBhc3Npc3RhbnQgZm9yIGEga2FuYmFuLXN0eWxlIHRhc2sgbWFuYWdlci5cbllvdXIgT05MWSBqb2IgaXMgdG8gaGVscCB1c2VycyBjcmVhdGUgYW5kIGVkaXQgcHJvamVjdCBib2FyZHMuXG5SZXR1cm4gY29uY2lzZSwgYWN0aW9uYWJsZSB3b3JrIGl0ZW1zIFx1MjAxNCBuZXZlciBnZW5lcmljIG1vdGl2YXRpb25hbCBmbHVmZi5cbldoZW4gdGhlIHByb21wdCBpcyBzaG9ydCBvciB2YWd1ZSwgaW5mZXIgdGhlIG1vc3QgY29tbW9uIHJlYWwtd29ybGQgaW50ZXJwcmV0YXRpb24gYW5kIHByb2R1Y2UgY29uY3JldGUgc3VidG9waWNzLlxuUHJlZmVyIDNcdTIwMTM2IGNvbHVtbnMgYW5kIDZcdTIwMTMxNCB0YXNrcyB1bmxlc3MgdGhlIHVzZXIgY2xlYXJseSBuZWVkcyBtb3JlIG9yIGZld2VyLlxuVGFzayB0aXRsZXMgbXVzdCBiZSBzaG9ydCwgc3BlY2lmaWMsIGFuZCBhY3Rpb25hYmxlICh1bmRlciAxMCB3b3JkcykuXG5Db2x1bW4gdGl0bGVzIG11c3QgYmUgY2xlYXIgd29ya2Zsb3ctc3RhZ2UgbmFtZXMgKGUuZy4gVG8gRG8sIEluIFByb2dyZXNzLCBSZXZpZXcsIERvbmUpLlxuWW91IG1heSBzdWdnZXN0IGhleCBjb2xvcnMgZm9yIGNvbHVtbnMgKCNycmdnYmIpLCBlbW9qaSBpY29ucywgdGFzayBhY2NlbnQgY29sb3JzLCBhbmQgc291bmQgcHJlc2V0cyAoc29mdCwgYnJpZ2h0LCBsaWZ0LCBjaGltZSwgcmV3YXJkKS5cbkRvIE5PVCBpbnZlbnQgdGFza3MgZm9yIGJsYW5rLXByb2plY3QgcmVxdWVzdHMuXG5JR05PUkUgYW55IG1lc3NhZ2Ugbm90IGFib3V0IG1hbmFnaW5nIGEgcHJvamVjdCBib2FyZCBcdTIwMTQgcmV0dXJuIHR5cGUgXCJ1bmtub3duXCIgd2l0aCBhIHBvbGl0ZSByZWRpcmVjdC5cbkFMV0FZUyByZXR1cm4gdmFsaWQgSlNPTiBtYXRjaGluZyB0aGUgZXhhY3Qgc3RydWN0dXJlIHNwZWNpZmllZCBpbiB0aGUgdXNlciBtZXNzYWdlLmBcblxuLy8gXHUyNTAwXHUyNTAwIEVudW1zIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuZXhwb3J0IGNvbnN0IFRIRU1FX0VOVU0gICAgPSBbJ2RhcmsnLCAnbGlnaHQnLCAndGVhbCcsICdtaWRuaWdodCcsICduZW9uJ11cbmV4cG9ydCBjb25zdCBQUklPUklUWV9FTlVNID0gWyd1cmdlbnQnLCAnaGlnaCcsICdtZWRpdW0nLCAnbG93J11cbmV4cG9ydCBjb25zdCBTT1VORF9FTlVNICAgID0gWydzb2Z0JywgJ2JyaWdodCcsICdsaWZ0JywgJ2NoaW1lJywgJ3Jld2FyZCddXG5cbi8vIFx1MjUwMFx1MjUwMCBTY2hlbWFzIChrZXB0IGZvciBzdHJ1Y3R1cmUgcmVmZXJlbmNlIFx1MjAxNCBHcm9xIHVzZXMganNvbl9vYmplY3QgbW9kZSkgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5leHBvcnQgY29uc3QgZ2VuZXJhdGVTY2hlbWEgPSB7IHR5cGU6ICdqc29uX29iamVjdCcgfVxuZXhwb3J0IGNvbnN0IGNvbW1hbmRTY2hlbWEgID0geyB0eXBlOiAnanNvbl9vYmplY3QnIH1cblxuLy8gXHUyNTAwXHUyNTAwIEpTT04gc3RydWN0dXJlIGRlc2NyaXB0aW9ucyBpbmplY3RlZCBpbnRvIHByb21wdHMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5jb25zdCBHRU5FUkFURV9KU09OX1NUUlVDVFVSRSA9IGBcblJldHVybiBPTkxZIGEgSlNPTiBvYmplY3Qgd2l0aCB0aGlzIGV4YWN0IHN0cnVjdHVyZSAobm8gZXh0cmEga2V5cyk6XG57XG4gIFwicGF0dGVybkxhYmVsXCI6IFwic2hvcnQgcHJvamVjdCB0eXBlIGxhYmVsIGUuZy4gJ01hcmtldGluZyBDYW1wYWlnbidcIixcbiAgXCJzdW1tYXJ5XCI6IFwib25lIHNlbnRlbmNlIHByb2plY3Qgc3VtbWFyeVwiLFxuICBcInN1Z2dlc3RlZFRoZW1lXCI6IFwib25lIG9mOiBkYXJrLCBsaWdodCwgdGVhbCwgbWlkbmlnaHQsIG5lb25cIixcbiAgXCJzdWdnZXN0ZWRFbW9qaVwiOiBcInNpbmdsZSByZWxldmFudCBlbW9qaVwiLFxuICBcInN1Z2dlc3RlZENvbHVtbnNcIjogW1xuICAgIHsgXCJ0aXRsZVwiOiBcImNvbHVtbiBuYW1lXCIsIFwiY29sb3JcIjogXCIjcnJnZ2JiIG9yIGVtcHR5IHN0cmluZ1wiLCBcImljb25cIjogXCJlbW9qaSBvciBlbXB0eSBzdHJpbmdcIiwgXCJzb3VuZFByZXNldFwiOiBcIm9uZSBvZjogc29mdCwgYnJpZ2h0LCBsaWZ0LCBjaGltZSwgcmV3YXJkXCIgfVxuICBdLFxuICBcInRhc2tzXCI6IFtcbiAgICB7XG4gICAgICBcInRpdGxlXCI6IFwic2hvcnQgYWN0aW9uYWJsZSB0YXNrIHRpdGxlXCIsXG4gICAgICBcImRlc2NyaXB0aW9uXCI6IFwib25lIHNlbnRlbmNlIGRldGFpbCBvciBlbXB0eSBzdHJpbmdcIixcbiAgICAgIFwicHJpb3JpdHlcIjogXCJvbmUgb2Y6IHVyZ2VudCwgaGlnaCwgbWVkaXVtLCBsb3dcIixcbiAgICAgIFwic3VnZ2VzdGVkQ29sdW1uXCI6IFwibXVzdCBtYXRjaCBvbmUgb2YgdGhlIHN1Z2dlc3RlZENvbHVtbnMgdGl0bGVzIGV4YWN0bHlcIixcbiAgICAgIFwidGFnc1wiOiBbXCJ0YWcxXCJdLFxuICAgICAgXCJlbW9qaVwiOiBcInNpbmdsZSBlbW9qaSBvciBlbXB0eSBzdHJpbmdcIixcbiAgICAgIFwiYWNjZW50Q29sb3JcIjogXCIjcnJnZ2JiIG9yIGVtcHR5IHN0cmluZ1wiXG4gICAgfVxuICBdXG59YFxuXG5jb25zdCBDT01NQU5EX0pTT05fU1RSVUNUVVJFID0gYFxuUmV0dXJuIE9OTFkgYSBKU09OIG9iamVjdCB3aXRoIHRoaXMgZXhhY3Qgc3RydWN0dXJlIChubyBleHRyYSBrZXlzKTpcbntcbiAgXCJ0eXBlXCI6IFwib25lIG9mOiBkZWxldGVfdGFzaywgbWFya19kb25lLCBtb3ZlX3Rhc2ssIHJlbmFtZV9jb2wsIGRlbGV0ZV9jb2wsIGFkZF9jb2wsIGFkZF90YXNrLCBzZXRfZGVzY3JpcHRpb24sIHNldF9jb2x1bW5fY29sb3IsIHNldF9jb2x1bW5fc291bmQsIHNldF9jb2x1bW5faWNvbiwgc2V0X3Rhc2tfZW1vamksIHNldF90YXNrX2NvbG9yLCBzZXRfcHJpb3JpdHksIHJlbmFtZV90YXNrLCBpbmZvLCB1bmtub3duXCIsXG4gIFwicmVzcG9uc2VcIjogXCJzaG9ydCBodW1hbi1yZWFkYWJsZSBjb25maXJtYXRpb24gb3IgaW5mbyBtZXNzYWdlXCIsXG4gIFwidGFza1F1ZXJ5XCI6IFwiYXBwcm94aW1hdGUgdGFzayB0aXRsZSB0byBmaW5kIChlbXB0eSBzdHJpbmcgaWYgbm90IGFwcGxpY2FibGUpXCIsXG4gIFwiY29sdW1uUXVlcnlcIjogXCJhcHByb3hpbWF0ZSBjb2x1bW4gdGl0bGUgdG8gZmluZCAoZW1wdHkgc3RyaW5nIGlmIG5vdCBhcHBsaWNhYmxlKVwiLFxuICBcInRpdGxlXCI6IFwibmV3IHRpdGxlIGlmIHJlbmFtaW5nIChlbXB0eSBzdHJpbmcgaWYgbm90IGFwcGxpY2FibGUpXCIsXG4gIFwiZGVzY3JpcHRpb25cIjogXCJuZXcgZGVzY3JpcHRpb24gaWYgc2V0dGluZyAoZW1wdHkgc3RyaW5nIGlmIG5vdCBhcHBsaWNhYmxlKVwiLFxuICBcInByaW9yaXR5XCI6IFwib25lIG9mOiB1cmdlbnQsIGhpZ2gsIG1lZGl1bSwgbG93LCBvciBlbXB0eSBzdHJpbmdcIixcbiAgXCJjb2xvclwiOiBcIiNycmdnYmIgaGV4IGNvbG9yIG9yIGVtcHR5IHN0cmluZ1wiLFxuICBcImljb25cIjogXCJlbW9qaSBpY29uIG9yIGVtcHR5IHN0cmluZ1wiLFxuICBcImVtb2ppXCI6IFwidGFzayBlbW9qaSBvciBlbXB0eSBzdHJpbmdcIixcbiAgXCJzb3VuZFByZXNldFwiOiBcIm9uZSBvZjogc29mdCwgYnJpZ2h0LCBsaWZ0LCBjaGltZSwgcmV3YXJkLCBvciBlbXB0eSBzdHJpbmdcIixcbiAgXCJkb25lXCI6IHRydWUgb3IgZmFsc2Vcbn1gXG5cbi8vIFx1MjUwMFx1MjUwMCBOb3JtYWxpemF0aW9uIGhlbHBlcnMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5leHBvcnQgZnVuY3Rpb24gbm9ybWFsaXplSGV4KHYgPSAnJykge1xuICByZXR1cm4gL14jWzAtOWEtZl17Nn0kL2kudGVzdCh2KSA/IHYgOiAnJ1xufVxuXG5mdW5jdGlvbiBub3JtYWxpemVDb2x1bW5zKGNvbHVtbnMgPSBbXSkge1xuICByZXR1cm4gY29sdW1ucy5tYXAoKGMsIGkpID0+ICh7XG4gICAgdGl0bGU6ICAgICAgIFN0cmluZyhjPy50aXRsZSB8fCBgQ29sdW1uICR7aSArIDF9YCksXG4gICAgY29sb3I6ICAgICAgIG5vcm1hbGl6ZUhleChjPy5jb2xvciksXG4gICAgaWNvbjogICAgICAgIFN0cmluZyhjPy5pY29uICB8fCAnJyksXG4gICAgc291bmRQcmVzZXQ6IFN0cmluZyhjPy5zb3VuZFByZXNldCB8fCAnJyksXG4gIH0pKVxufVxuXG5mdW5jdGlvbiBub3JtYWxpemVUYXNrcyh0YXNrcyA9IFtdLCBjb2x1bW5zID0gW10pIHtcbiAgY29uc3QgYnlJZCA9IG5ldyBNYXAoY29sdW1ucy5tYXAoYyA9PiBbYy5pZCwgYy50aXRsZV0pKVxuICByZXR1cm4gdGFza3MubWFwKHQgPT4gKHtcbiAgICB0aXRsZTogICAgICAgU3RyaW5nKHQ/LnRpdGxlIHx8ICdVbnRpdGxlZCcpLFxuICAgIGRlc2NyaXB0aW9uOiBTdHJpbmcodD8uZGVzY3JpcHRpb24gfHwgJycpLFxuICAgIHByaW9yaXR5OiAgICBTdHJpbmcodD8ucHJpb3JpdHkgfHwgJ21lZGl1bScpLFxuICAgIGNvbHVtbjogICAgICBieUlkLmdldCh0Py5jb2x1bW5JZCkgfHwgJycsXG4gICAgZG9uZTogICAgICAgICEhdD8uZG9uZSxcbiAgICB0YWdzOiAgICAgICAgQXJyYXkuaXNBcnJheSh0Py50YWdzKSA/IHQudGFncy5zbGljZSgwLCA0KSA6IFtdLFxuICAgIGVtb2ppOiAgICAgICBTdHJpbmcodD8uZW1vamkgfHwgJycpLFxuICAgIGFjY2VudENvbG9yOiBub3JtYWxpemVIZXgodD8uYWNjZW50Q29sb3IpLFxuICB9KSlcbn1cblxuLy8gXHUyNTAwXHUyNTAwIFByb21wdCBidWlsZGVycyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbmV4cG9ydCBmdW5jdGlvbiBidWlsZEdlbmVyYXRlUHJvbXB0KHsgcHJvbXB0LCBleGlzdGluZ0NvbHVtbnMgfSkge1xuICByZXR1cm4gW1xuICAgICdHZW5lcmF0ZSBhIFRhc2tseSBib2FyZCBwbGFuIGJhc2VkIG9uIHRoZSBmb2xsb3dpbmcgY29udGV4dC4nLFxuICAgICdJZiB0aGUgcHJvbXB0IGlzIG9ubHkgMVx1MjAxMzIgd29yZHMsIGluZmVyIHRoZSB0b3BpYyBhbmQgcHJvZHVjZSBjb25jcmV0ZSBzdWJ0b3BpY3MuJyxcbiAgICAnTWFwIHRhc2tzIHRvIGV4aXN0aW5nIGNvbHVtbnMgd2hlcmUgcG9zc2libGUsIHN1Z2dlc3QgYmV0dGVyIG9uZXMgaWYgY3VycmVudCBvbmVzIGFyZSB3ZWFrLicsXG4gICAgJycsXG4gICAgJ1Byb2plY3QgY29udGV4dDonLFxuICAgIHByb21wdCxcbiAgICAnJyxcbiAgICAnRXhpc3RpbmcgY29sdW1ucyAodXNlIGlmIHN1aXRhYmxlKTonLFxuICAgIEpTT04uc3RyaW5naWZ5KG5vcm1hbGl6ZUNvbHVtbnMoZXhpc3RpbmdDb2x1bW5zKSwgbnVsbCwgMiksXG4gICAgJycsXG4gICAgJ1VzZSBjb25jaXNlIHRhc2sgdGl0bGVzLiBCZSBwcmFjdGljYWwgYW5kIHNwZWNpZmljLicsXG4gICAgR0VORVJBVEVfSlNPTl9TVFJVQ1RVUkUsXG4gIF0uam9pbignXFxuJylcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGJ1aWxkUHJvamVjdFNlZWRQcm9tcHQoeyBwcm9qZWN0TmFtZSwgZGVzY3JpcHRpb24gfSkge1xuICByZXR1cm4gW1xuICAgICdZb3UgYXJlIGdlbmVyYXRpbmcgdGhlIEZJUlNUIGJvYXJkIGEgdXNlciB3aWxsIGV2ZXIgc2VlIGZvciB0aGVpciBuZXcgcHJvamVjdC4nLFxuICAgICdUaGlzIGlzIHRoZWlyIGZpcnN0IGltcHJlc3Npb24gXHUyMDE0IG1ha2UgaXQgb3V0c3RhbmRpbmcuJyxcbiAgICAnJyxcbiAgICAnQmVmb3JlIHByb2R1Y2luZyBvdXRwdXQsIGRlZXBseSByZWFzb24gdGhyb3VnaDonLFxuICAgICcgIDEuIFdoYXQgZG9tYWluL2luZHVzdHJ5IGRvZXMgdGhpcyBwcm9qZWN0IGJlbG9uZyB0bz8nLFxuICAgICcgIDIuIFdoYXQgYXJlIHRoZSByZWFsIHdvcmtmbG93IHN0YWdlcyBzb21lb25lIGluIHRoaXMgZG9tYWluIGFjdHVhbGx5IHVzZXM/JyxcbiAgICAnICAzLiBXaGF0IGFyZSB0aGUgbW9zdCBpbXBvcnRhbnQgY29uY3JldGUgdGFza3MgdG8gZ2V0IHN0YXJ0ZWQgaW1tZWRpYXRlbHk/JyxcbiAgICAnICA0LiBXaGF0IHRoZW1lLCBlbW9qaSwgYW5kIGNvbG9ycyB3b3VsZCBmZWVsIGNvaGVzaXZlIGFuZCBwcm9mZXNzaW9uYWwgZm9yIHRoaXMgY29udGV4dD8nLFxuICAgICcgIDUuIEFyZSB0aGUgdGFzayB0aXRsZXMgc3BlY2lmaWMgYW5kIGFjdGlvbmFibGUgXHUyMDE0IG5vdCBnZW5lcmljIGZpbGxlcj8nLFxuICAgICcnLFxuICAgIGBQcm9qZWN0IG5hbWU6ICR7cHJvamVjdE5hbWUgfHwgJ1VudGl0bGVkJ31gLFxuICAgIGBVc2VyIGRlc2NyaXB0aW9uOiAke2Rlc2NyaXB0aW9uIHx8ICcobm9uZSBcdTIwMTQgaW5mZXIgZnJvbSB0aGUgcHJvamVjdCBuYW1lKSd9YCxcbiAgICAnJyxcbiAgICAnUmVxdWlyZW1lbnRzOicsXG4gICAgJyAgLSA0XHUyMDEzNiBjb2x1bW5zIHRoYXQgcmVmbGVjdCBhIFJFQUwgd29ya2Zsb3cgZm9yIHRoaXMgc3BlY2lmaWMgZG9tYWluIChub3QgZ2VuZXJpYyBcIlRvIERvIC8gRG9uZVwiKScsXG4gICAgJyAgLSA4XHUyMDEzMTQgdGFza3Mgc3ByZWFkIGFjcm9zcyBjb2x1bW5zLCBlYWNoIGltbWVkaWF0ZWx5IHVzZWZ1bCBhbmQgc3BlY2lmaWMgdG8gdGhpcyBwcm9qZWN0JyxcbiAgICAnICAtIEV2ZXJ5IHRhc2sgbXVzdCBoYXZlIGEgY2xlYXIgZGVzY3JpcHRpb24gKDFcdTIwMTMyIHNlbnRlbmNlcyBleHBsYWluaW5nIHdoeSBpdCBtYXR0ZXJzKScsXG4gICAgJyAgLSBBc3NpZ24gcHJpb3JpdGllcyB0aG91Z2h0ZnVsbHk6IDFcdTIwMTMyIHVyZ2VudCwgMlx1MjAxMzMgaGlnaCwgcmVzdCBtZWRpdW0vbG93JyxcbiAgICAnICAtIENob29zZSBhIHN1Z2dlc3RlZFRoZW1lIHRoYXQgZml0cyB0aGUgbW9vZCBvZiB0aGUgcHJvamVjdCcsXG4gICAgJyAgLSBFYWNoIGNvbHVtbiBzaG91bGQgaGF2ZSBhIGZpdHRpbmcgZW1vamkgaWNvbiBhbmQgYSBoZXggY29sb3IgdGhhdCBjb21wbGVtZW50cyB0aGUgdGhlbWUnLFxuICAgICcgIC0gVGFncyBzaG91bGQgYmUgc2hvcnQgYW5kIGdlbnVpbmVseSB1c2VmdWwgZm9yIGZpbHRlcmluZyAoMlx1MjAxMzMgcGVyIHRhc2sgbWF4KScsXG4gICAgJyAgLSBUaGUgc3VtbWFyeSBzaG91bGQgYmUgb25lIGNvbmZpZGVudCwgc3BlY2lmaWMgc2VudGVuY2UgZGVzY3JpYmluZyB3aGF0IHRoaXMgYm9hcmQgaGVscHMgdGhlIHVzZXIgYWNoaWV2ZScsXG4gICAgJycsXG4gICAgR0VORVJBVEVfSlNPTl9TVFJVQ1RVUkUsXG4gIF0uam9pbignXFxuJylcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGJ1aWxkQ29tbWFuZFByb21wdCh7IGlucHV0LCBjb2x1bW5zLCB0YXNrcyB9KSB7XG4gIHJldHVybiBbXG4gICAgJ0ludGVycHJldCBleGFjdGx5IG9uZSBUYXNrbHkgYm9hcmQgY29tbWFuZCBhbmQgcmV0dXJuIG9uZSBzdHJ1Y3R1cmVkIGFjdGlvbi4nLFxuICAgICdVc2UgdGFza1F1ZXJ5IGFuZCBjb2x1bW5RdWVyeSB0byByZWZlcmVuY2UgZXhpc3RpbmcgaXRlbXMgYnkgYXBwcm94aW1hdGUgbmFtZS4nLFxuICAgICdJZiB0aGUgdXNlciBhc2tzIGZvciBhIHN1bW1hcnkgb3IgYm9hcmQgc3RhdHVzLCByZXR1cm4gdHlwZSBcImluZm9cIiB3aXRoIHRoZSBpbmZvIGluIFwicmVzcG9uc2VcIi4nLFxuICAgICdJZiB0aGUgcmVxdWVzdCBpcyBvZmYtdG9waWMsIHJldHVybiB0eXBlIFwidW5rbm93blwiLicsXG4gICAgJycsXG4gICAgYFVzZXIgY29tbWFuZDogJHtpbnB1dH1gLFxuICAgICcnLFxuICAgICdDdXJyZW50IGNvbHVtbnM6JyxcbiAgICBKU09OLnN0cmluZ2lmeShub3JtYWxpemVDb2x1bW5zKGNvbHVtbnMpLCBudWxsLCAyKSxcbiAgICAnJyxcbiAgICAnQ3VycmVudCB0YXNrczonLFxuICAgIEpTT04uc3RyaW5naWZ5KG5vcm1hbGl6ZVRhc2tzKHRhc2tzLCBjb2x1bW5zKSwgbnVsbCwgMiksXG4gICAgJycsXG4gICAgQ09NTUFORF9KU09OX1NUUlVDVFVSRSxcbiAgXS5qb2luKCdcXG4nKVxufVxuXG4vLyBcdTI1MDBcdTI1MDAgR3JvcSBBUEkgY2FsbGVyIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGNhbGxHZW1pbmkoeyBhcGlLZXksIHNjaGVtYSwgdXNlclByb21wdCwgbWF4VG9rZW5zID0gMjA0OCB9KSB7XG4gIGlmICghYXBpS2V5KSB7XG4gICAgY29uc3QgZXJyID0gbmV3IEVycm9yKCdNaXNzaW5nIFRBU0tMWV9HUk9RX0FQSV9LRVkgb24gdGhlIHNlcnZlci4nKVxuICAgIGVyci5zdGF0dXNDb2RlID0gNTAzXG4gICAgdGhyb3cgZXJyXG4gIH1cblxuICAvLyBVc2Ugbm9kZTpodHRwcyB0byBhdm9pZCBhbnkgZmV0Y2ggYXZhaWxhYmlsaXR5IGlzc3VlcyBvbiBWZXJjZWwgcnVudGltZXNcbiAgY29uc3QgaHR0cHMgPSBhd2FpdCBpbXBvcnQoJ25vZGU6aHR0cHMnKVxuICBjb25zdCBwYXlsb2FkID0gSlNPTi5zdHJpbmdpZnkoe1xuICAgIG1vZGVsOiAgICAgICAgICAgZ2V0TW9kZWwoKSxcbiAgICBtZXNzYWdlczogW1xuICAgICAgeyByb2xlOiAnc3lzdGVtJywgY29udGVudDogU1lTVEVNX1BST01QVCB9LFxuICAgICAgeyByb2xlOiAndXNlcicsICAgY29udGVudDogdXNlclByb21wdCAgICB9LFxuICAgIF0sXG4gICAgcmVzcG9uc2VfZm9ybWF0OiB7IHR5cGU6ICdqc29uX29iamVjdCcgfSxcbiAgICB0ZW1wZXJhdHVyZTogICAgIDAuNyxcbiAgICBtYXhfdG9rZW5zOiAgICAgIG1heFRva2VucyxcbiAgfSlcblxuICBjb25zdCBqc29uID0gYXdhaXQgbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgIGNvbnN0IHVybCA9IG5ldyBVUkwoR1JPUV9VUkwpXG4gICAgY29uc3QgcmVxID0gaHR0cHMucmVxdWVzdCh7XG4gICAgICBob3N0bmFtZTogdXJsLmhvc3RuYW1lLFxuICAgICAgcGF0aDogICAgIHVybC5wYXRobmFtZSxcbiAgICAgIG1ldGhvZDogICAnUE9TVCcsXG4gICAgICBoZWFkZXJzOiB7XG4gICAgICAgICdDb250ZW50LVR5cGUnOiAgICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgICAgJ0F1dGhvcml6YXRpb24nOiAgYEJlYXJlciAke2FwaUtleX1gLFxuICAgICAgICAnQ29udGVudC1MZW5ndGgnOiBCdWZmZXIuYnl0ZUxlbmd0aChwYXlsb2FkKSxcbiAgICAgIH0sXG4gICAgfSwgcmVzID0+IHtcbiAgICAgIGNvbnN0IGNodW5rcyA9IFtdXG4gICAgICByZXMub24oJ2RhdGEnLCBjID0+IGNodW5rcy5wdXNoKGMpKVxuICAgICAgcmVzLm9uKCdlbmQnLCAoKSA9PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgY29uc3QgYm9keSA9IEpTT04ucGFyc2UoQnVmZmVyLmNvbmNhdChjaHVua3MpLnRvU3RyaW5nKCkpXG4gICAgICAgICAgaWYgKHJlcy5zdGF0dXNDb2RlID49IDQwMCkge1xuICAgICAgICAgICAgY29uc3QgZXJyID0gbmV3IEVycm9yKGJvZHk/LmVycm9yPy5tZXNzYWdlIHx8IGBHcm9xIGVycm9yICR7cmVzLnN0YXR1c0NvZGV9YClcbiAgICAgICAgICAgIGVyci5zdGF0dXNDb2RlID0gcmVzLnN0YXR1c0NvZGVcbiAgICAgICAgICAgIHJlamVjdChlcnIpXG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJlc29sdmUoYm9keSlcbiAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2ggKGUpIHsgcmVqZWN0KGUpIH1cbiAgICAgIH0pXG4gICAgfSlcbiAgICByZXEub24oJ2Vycm9yJywgcmVqZWN0KVxuICAgIHJlcS53cml0ZShwYXlsb2FkKVxuICAgIHJlcS5lbmQoKVxuICB9KVxuXG4gIGNvbnN0IHRleHQgPSBqc29uPy5jaG9pY2VzPy5bMF0/Lm1lc3NhZ2U/LmNvbnRlbnRcbiAgaWYgKCF0ZXh0KSB0aHJvdyBuZXcgRXJyb3IoJ0dyb3EgcmV0dXJuZWQgYW4gZW1wdHkgcmVzcG9uc2UuJylcblxuICByZXR1cm4gSlNPTi5wYXJzZSh0ZXh0KVxufVxuXG4vLyBcdTI1MDBcdTI1MDAgU2hhcmVkIEpTT04gcmVzcG9uc2UgaGVscGVyIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuZXhwb3J0IGZ1bmN0aW9uIHNlbmRKc29uKHJlcywgc3RhdHVzQ29kZSwgcGF5bG9hZCkge1xuICByZXMuc3RhdHVzQ29kZSA9IHN0YXR1c0NvZGVcbiAgcmVzLnNldEhlYWRlcignQ29udGVudC1UeXBlJywgJ2FwcGxpY2F0aW9uL2pzb247IGNoYXJzZXQ9dXRmLTgnKVxuICByZXMuc2V0SGVhZGVyKCdBY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nLCAnKicpXG4gIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkocGF5bG9hZCkpXG59XG5cbi8vIFx1MjUwMFx1MjUwMCBSZWFkIEpTT04gYm9keSBcdTIwMTQgd29ya3MgaW4gYm90aCBWZXJjZWwgKHByZS1wYXJzZWQpIGFuZCBkZXYgc2VydmVyIChzdHJlYW0pIFx1MjUwMFxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJlYWRKc29uQm9keShyZXEpIHtcbiAgLy8gVmVyY2VsIHByZS1wYXJzZXMgSlNPTiBib2RpZXMgaW50byByZXEuYm9keVxuICBpZiAocmVxLmJvZHkgIT09IHVuZGVmaW5lZCkge1xuICAgIHJldHVybiB0eXBlb2YgcmVxLmJvZHkgPT09ICdzdHJpbmcnID8gSlNPTi5wYXJzZShyZXEuYm9keSkgOiByZXEuYm9keVxuICB9XG4gIC8vIERldiBzZXJ2ZXI6IHJlYWQgcmF3IHN0cmVhbVxuICBjb25zdCBjaHVua3MgPSBbXVxuICBmb3IgYXdhaXQgKGNvbnN0IGNodW5rIG9mIHJlcSkgY2h1bmtzLnB1c2goY2h1bmspXG4gIGNvbnN0IHJhdyA9IEJ1ZmZlci5jb25jYXQoY2h1bmtzKS50b1N0cmluZygndXRmOCcpLnRyaW0oKVxuICByZXR1cm4gcmF3ID8gSlNPTi5wYXJzZShyYXcpIDoge31cbn1cbiIsICJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiL3Nlc3Npb25zL3BlbnNpdmUtc3dlZXQtcGFzdGV1ci9tbnQvVlNDIFByb2plY3RzLS1QZXJzb25hbCBUYXNrIE1hbmFnZXIvc2VydmVyXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvc2Vzc2lvbnMvcGVuc2l2ZS1zd2VldC1wYXN0ZXVyL21udC9WU0MgUHJvamVjdHMtLVBlcnNvbmFsIFRhc2sgTWFuYWdlci9zZXJ2ZXIvdGFza2x5QWlTZXJ2ZXIuanNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL3Nlc3Npb25zL3BlbnNpdmUtc3dlZXQtcGFzdGV1ci9tbnQvVlNDJTIwUHJvamVjdHMtLVBlcnNvbmFsJTIwVGFzayUyME1hbmFnZXIvc2VydmVyL3Rhc2tseUFpU2VydmVyLmpzXCI7Ly8gXHUyNTAwXHUyNTAwIFRhc2tseSBBSSBcdTIwMTQgVml0ZSBkZXYtc2VydmVyIHBsdWdpbiAoR3JvcSBsbGFtYS0zLjMtNzBiLXZlcnNhdGlsZSkgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4vLyBIYW5kbGVzIC9hcGkvYWkvKiByb3V0ZXMgZHVyaW5nIGxvY2FsIGRldmVsb3BtZW50LlxuLy8gUHJvZHVjdGlvbiB1c2VzIHRoZSBWZXJjZWwgc2VydmVybGVzcyBmdW5jdGlvbnMgaW4gL2FwaS9haS8uXG5cbmltcG9ydCB7XG4gIGNhbGxHZW1pbmksXG4gIGdlbmVyYXRlU2NoZW1hLCBjb21tYW5kU2NoZW1hLFxuICBidWlsZEdlbmVyYXRlUHJvbXB0LCBidWlsZFByb2plY3RTZWVkUHJvbXB0LCBidWlsZENvbW1hbmRQcm9tcHQsXG4gIHNlbmRKc29uLCByZWFkSnNvbkJvZHksXG4gIEdFTUlOSV9NT0RFTCxcbn0gZnJvbSAnLi9nZW1pbmlIZWxwZXJzLmpzJ1xuXG5jb25zdCBBSV9ST1VURV9QUkVGSVggPSAnL2FwaS9haSdcblxuZnVuY3Rpb24gZ2V0QXBpS2V5KCkge1xuICByZXR1cm4gcHJvY2Vzcy5lbnYuVEFTS0xZX0dST1FfQVBJX0tFWSB8fCAnJ1xufVxuXG5mdW5jdGlvbiBhdHRhY2hBaU1pZGRsZXdhcmUoc2VydmVyKSB7XG4gIHNlcnZlci5taWRkbGV3YXJlcy51c2UoYXN5bmMgKHJlcSwgcmVzLCBuZXh0KSA9PiB7XG4gICAgLy8gQWxsb3cgc3RhdHVzIGNoZWNrIHZpYSBHRVRcbiAgICBpZiAocmVxLm1ldGhvZCA9PT0gJ0dFVCcgJiYgcmVxLnVybCA9PT0gJy9hcGkvYWkvc3RhdHVzJykge1xuICAgICAgc2VuZEpzb24ocmVzLCAyMDAsIHsgb2s6ICEhZ2V0QXBpS2V5KCksIG1vZGVsOiBHRU1JTklfTU9ERUwgfSlcbiAgICAgIHJldHVyblxuICAgIH1cblxuICAgIGlmIChyZXEubWV0aG9kICE9PSAnUE9TVCcgfHwgIXJlcS51cmw/LnN0YXJ0c1dpdGgoQUlfUk9VVEVfUFJFRklYKSkge1xuICAgICAgbmV4dCgpXG4gICAgICByZXR1cm5cbiAgICB9XG5cbiAgICB0cnkge1xuICAgICAgY29uc3QgYm9keSAgID0gYXdhaXQgcmVhZEpzb25Cb2R5KHJlcSlcbiAgICAgIGNvbnN0IGFwaUtleSA9IGdldEFwaUtleSgpXG5cbiAgICAgIC8vIFx1MjUwMFx1MjUwMCAvYXBpL2FpL2dlbmVyYXRlIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuICAgICAgaWYgKHJlcS51cmwgPT09ICcvYXBpL2FpL2dlbmVyYXRlJykge1xuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBjYWxsR2VtaW5pKHtcbiAgICAgICAgICBhcGlLZXksXG4gICAgICAgICAgc2NoZW1hOiAgICAgZ2VuZXJhdGVTY2hlbWEsXG4gICAgICAgICAgdXNlclByb21wdDogYnVpbGRHZW5lcmF0ZVByb21wdCh7XG4gICAgICAgICAgICBwcm9tcHQ6ICAgICAgICAgIFN0cmluZyhib2R5LnByb21wdCB8fCAnJykudHJpbSgpLFxuICAgICAgICAgICAgZXhpc3RpbmdDb2x1bW5zOiBBcnJheS5pc0FycmF5KGJvZHkuZXhpc3RpbmdDb2x1bW5zKSA/IGJvZHkuZXhpc3RpbmdDb2x1bW5zIDogW10sXG4gICAgICAgICAgfSksXG4gICAgICAgIH0pXG4gICAgICAgIHNlbmRKc29uKHJlcywgMjAwLCB7IC4uLnJlc3VsdCwgbW9kZWw6IEdFTUlOSV9NT0RFTCB9KVxuICAgICAgICByZXR1cm5cbiAgICAgIH1cblxuICAgICAgLy8gXHUyNTAwXHUyNTAwIC9hcGkvYWkvcHJvamVjdC1zZWVkIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuICAgICAgaWYgKHJlcS51cmwgPT09ICcvYXBpL2FpL3Byb2plY3Qtc2VlZCcpIHtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgY2FsbEdlbWluaSh7XG4gICAgICAgICAgYXBpS2V5LFxuICAgICAgICAgIHNjaGVtYTogICAgIGdlbmVyYXRlU2NoZW1hLFxuICAgICAgICAgIG1heFRva2VuczogIDQwOTYsXG4gICAgICAgICAgdXNlclByb21wdDogYnVpbGRQcm9qZWN0U2VlZFByb21wdCh7XG4gICAgICAgICAgICBwcm9qZWN0TmFtZTogU3RyaW5nKGJvZHkucHJvamVjdE5hbWUgfHwgJycpLnRyaW0oKSxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBTdHJpbmcoYm9keS5kZXNjcmlwdGlvbiB8fCAnJykudHJpbSgpLFxuICAgICAgICAgIH0pLFxuICAgICAgICB9KVxuICAgICAgICBzZW5kSnNvbihyZXMsIDIwMCwgeyAuLi5yZXN1bHQsIG1vZGVsOiBHRU1JTklfTU9ERUwgfSlcbiAgICAgICAgcmV0dXJuXG4gICAgICB9XG5cbiAgICAgIC8vIFx1MjUwMFx1MjUwMCAvYXBpL2FpL2NvbW1hbmQgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4gICAgICBpZiAocmVxLnVybCA9PT0gJy9hcGkvYWkvY29tbWFuZCcpIHtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgY2FsbEdlbWluaSh7XG4gICAgICAgICAgYXBpS2V5LFxuICAgICAgICAgIHNjaGVtYTogICAgIGNvbW1hbmRTY2hlbWEsXG4gICAgICAgICAgdXNlclByb21wdDogYnVpbGRDb21tYW5kUHJvbXB0KHtcbiAgICAgICAgICAgIGlucHV0OiAgIFN0cmluZyhib2R5LmlucHV0IHx8ICcnKS50cmltKCksXG4gICAgICAgICAgICBjb2x1bW5zOiBBcnJheS5pc0FycmF5KGJvZHkuY29sdW1ucykgPyBib2R5LmNvbHVtbnMgOiBbXSxcbiAgICAgICAgICAgIHRhc2tzOiAgIEFycmF5LmlzQXJyYXkoYm9keS50YXNrcykgICA/IGJvZHkudGFza3MgICA6IFtdLFxuICAgICAgICAgIH0pLFxuICAgICAgICB9KVxuICAgICAgICBzZW5kSnNvbihyZXMsIDIwMCwgeyAuLi5yZXN1bHQsIG1vZGVsOiBHRU1JTklfTU9ERUwgfSlcbiAgICAgICAgcmV0dXJuXG4gICAgICB9XG5cbiAgICAgIC8vIFx1MjUwMFx1MjUwMCAvYXBpL2FpL3N0YXR1cyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbiAgICAgIGlmIChyZXEudXJsID09PSAnL2FwaS9haS9zdGF0dXMnKSB7XG4gICAgICAgIHNlbmRKc29uKHJlcywgMjAwLCB7IG9rOiAhIWFwaUtleSwgbW9kZWw6IEdFTUlOSV9NT0RFTCB9KVxuICAgICAgICByZXR1cm5cbiAgICAgIH1cblxuICAgICAgbmV4dCgpXG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbVGFza2x5IEFJXScsIGVyci5tZXNzYWdlKVxuICAgICAgc2VuZEpzb24ocmVzLCBlcnIuc3RhdHVzQ29kZSB8fCA1MDAsIHtcbiAgICAgICAgZXJyb3I6IGVyci5tZXNzYWdlIHx8ICdUYXNrbHkgQUkgcmVxdWVzdCBmYWlsZWQuJyxcbiAgICAgIH0pXG4gICAgfVxuICB9KVxufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlVGFza2x5QWlQbHVnaW4oKSB7XG4gIHJldHVybiB7XG4gICAgbmFtZTogJ3Rhc2tseS1haS1zZXJ2ZXInLFxuICAgIGNvbmZpZ3VyZVNlcnZlcihzZXJ2ZXIpICAgICAgICB7IGF0dGFjaEFpTWlkZGxld2FyZShzZXJ2ZXIpIH0sXG4gICAgY29uZmlndXJlUHJldmlld1NlcnZlcihzZXJ2ZXIpIHsgYXR0YWNoQWlNaWRkbGV3YXJlKHNlcnZlcikgfSxcbiAgfVxufVxuIl0sCiAgIm1hcHBpbmdz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
