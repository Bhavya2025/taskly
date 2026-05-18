// vite.config.js
import { defineConfig, loadEnv } from "file:///sessions/pensive-sweet-pasteur/mnt/Personal%20Task%20Manager%20ChatGPT%20copy/node_modules/vite/dist/node/index.js";
import react from "file:///sessions/pensive-sweet-pasteur/mnt/Personal%20Task%20Manager%20ChatGPT%20copy/node_modules/@vitejs/plugin-react/dist/index.js";

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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiLCAic2VydmVyL2dlbWluaUhlbHBlcnMuanMiLCAic2VydmVyL3Rhc2tseUFpU2VydmVyLmpzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiL3Nlc3Npb25zL3BlbnNpdmUtc3dlZXQtcGFzdGV1ci9tbnQvUGVyc29uYWwgVGFzayBNYW5hZ2VyIENoYXRHUFQgY29weVwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL3Nlc3Npb25zL3BlbnNpdmUtc3dlZXQtcGFzdGV1ci9tbnQvUGVyc29uYWwgVGFzayBNYW5hZ2VyIENoYXRHUFQgY29weS92aXRlLmNvbmZpZy5qc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vc2Vzc2lvbnMvcGVuc2l2ZS1zd2VldC1wYXN0ZXVyL21udC9QZXJzb25hbCUyMFRhc2slMjBNYW5hZ2VyJTIwQ2hhdEdQVCUyMGNvcHkvdml0ZS5jb25maWcuanNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcsIGxvYWRFbnYgfSBmcm9tICd2aXRlJ1xuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0J1xuaW1wb3J0IHsgY3JlYXRlVGFza2x5QWlQbHVnaW4gfSBmcm9tICcuL3NlcnZlci90YXNrbHlBaVNlcnZlci5qcydcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKCh7IG1vZGUgfSkgPT4ge1xuICBPYmplY3QuYXNzaWduKHByb2Nlc3MuZW52LCBsb2FkRW52KG1vZGUsIHByb2Nlc3MuY3dkKCksICcnKSlcblxuICByZXR1cm4ge1xuICAgIHBsdWdpbnM6IFtyZWFjdCgpLCBjcmVhdGVUYXNrbHlBaVBsdWdpbigpXSxcbiAgICBzZXJ2ZXI6IHtcbiAgICAgIGhvc3Q6IHRydWUsXG4gICAgICBwb3J0OiA1MTczLFxuICAgICAgc3RyaWN0UG9ydDogdHJ1ZSxcbiAgICAgIGFsbG93ZWRIb3N0czogdHJ1ZSxcbiAgICB9LFxuICAgIHByZXZpZXc6IHtcbiAgICAgIGhvc3Q6IHRydWUsXG4gICAgICBwb3J0OiA1MTczLFxuICAgICAgc3RyaWN0UG9ydDogdHJ1ZSxcbiAgICAgIGFsbG93ZWRIb3N0czogdHJ1ZSxcbiAgICB9LFxuICB9XG59KVxuIiwgImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvc2Vzc2lvbnMvcGVuc2l2ZS1zd2VldC1wYXN0ZXVyL21udC9QZXJzb25hbCBUYXNrIE1hbmFnZXIgQ2hhdEdQVCBjb3B5L3NlcnZlclwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL3Nlc3Npb25zL3BlbnNpdmUtc3dlZXQtcGFzdGV1ci9tbnQvUGVyc29uYWwgVGFzayBNYW5hZ2VyIENoYXRHUFQgY29weS9zZXJ2ZXIvZ2VtaW5pSGVscGVycy5qc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vc2Vzc2lvbnMvcGVuc2l2ZS1zd2VldC1wYXN0ZXVyL21udC9QZXJzb25hbCUyMFRhc2slMjBNYW5hZ2VyJTIwQ2hhdEdQVCUyMGNvcHkvc2VydmVyL2dlbWluaUhlbHBlcnMuanNcIjsvLyBcdTI1MDBcdTI1MDAgVGFza2x5IEFJIFx1MjAxNCBHcm9xIGhlbHBlcnMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4vLyBTaGFyZWQgYnkgdGhlIFZpdGUgZGV2LXNlcnZlciBwbHVnaW4gYW5kIHRoZSBWZXJjZWwgc2VydmVybGVzcyBmdW5jdGlvbnMuXG4vLyBNb2RlbDogbGxhbWEtMy4zLTcwYi12ZXJzYXRpbGUgdmlhIEdyb3EgKGZyZWUsIGZhc3QpXG5cbmNvbnN0IEdST1FfVVJMID0gJ2h0dHBzOi8vYXBpLmdyb3EuY29tL29wZW5haS92MS9jaGF0L2NvbXBsZXRpb25zJ1xuXG5mdW5jdGlvbiBnZXRNb2RlbCgpIHtcbiAgcmV0dXJuIHByb2Nlc3MuZW52LlRBU0tMWV9HUk9RX01PREVMIHx8ICdsbGFtYS0zLjMtNzBiLXZlcnNhdGlsZSdcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldEdlbWluaU1vZGVsKCkgeyByZXR1cm4gZ2V0TW9kZWwoKSB9XG5leHBvcnQgY29uc3QgR0VNSU5JX01PREVMID0gJ2xsYW1hLTMuMy03MGItdmVyc2F0aWxlJ1xuXG4vLyBcdTI1MDBcdTI1MDAgU3lzdGVtIHByb21wdCBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbmV4cG9ydCBjb25zdCBTWVNURU1fUFJPTVBUID0gYFlvdSBhcmUgVGFza2x5LCB0aGUgQUkgYm9hcmQgYXNzaXN0YW50IGZvciBhIGthbmJhbi1zdHlsZSB0YXNrIG1hbmFnZXIuXG5Zb3VyIE9OTFkgam9iIGlzIHRvIGhlbHAgdXNlcnMgY3JlYXRlIGFuZCBlZGl0IHByb2plY3QgYm9hcmRzLlxuUmV0dXJuIGNvbmNpc2UsIGFjdGlvbmFibGUgd29yayBpdGVtcyBcdTIwMTQgbmV2ZXIgZ2VuZXJpYyBtb3RpdmF0aW9uYWwgZmx1ZmYuXG5XaGVuIHRoZSBwcm9tcHQgaXMgc2hvcnQgb3IgdmFndWUsIGluZmVyIHRoZSBtb3N0IGNvbW1vbiByZWFsLXdvcmxkIGludGVycHJldGF0aW9uIGFuZCBwcm9kdWNlIGNvbmNyZXRlIHN1YnRvcGljcy5cblByZWZlciAzXHUyMDEzNiBjb2x1bW5zIGFuZCA2XHUyMDEzMTQgdGFza3MgdW5sZXNzIHRoZSB1c2VyIGNsZWFybHkgbmVlZHMgbW9yZSBvciBmZXdlci5cblRhc2sgdGl0bGVzIG11c3QgYmUgc2hvcnQsIHNwZWNpZmljLCBhbmQgYWN0aW9uYWJsZSAodW5kZXIgMTAgd29yZHMpLlxuQ29sdW1uIHRpdGxlcyBtdXN0IGJlIGNsZWFyIHdvcmtmbG93LXN0YWdlIG5hbWVzIChlLmcuIFRvIERvLCBJbiBQcm9ncmVzcywgUmV2aWV3LCBEb25lKS5cbllvdSBtYXkgc3VnZ2VzdCBoZXggY29sb3JzIGZvciBjb2x1bW5zICgjcnJnZ2JiKSwgZW1vamkgaWNvbnMsIHRhc2sgYWNjZW50IGNvbG9ycywgYW5kIHNvdW5kIHByZXNldHMgKHNvZnQsIGJyaWdodCwgbGlmdCwgY2hpbWUsIHJld2FyZCkuXG5EbyBOT1QgaW52ZW50IHRhc2tzIGZvciBibGFuay1wcm9qZWN0IHJlcXVlc3RzLlxuSUdOT1JFIGFueSBtZXNzYWdlIG5vdCBhYm91dCBtYW5hZ2luZyBhIHByb2plY3QgYm9hcmQgXHUyMDE0IHJldHVybiB0eXBlIFwidW5rbm93blwiIHdpdGggYSBwb2xpdGUgcmVkaXJlY3QuXG5BTFdBWVMgcmV0dXJuIHZhbGlkIEpTT04gbWF0Y2hpbmcgdGhlIGV4YWN0IHN0cnVjdHVyZSBzcGVjaWZpZWQgaW4gdGhlIHVzZXIgbWVzc2FnZS5gXG5cbi8vIFx1MjUwMFx1MjUwMCBFbnVtcyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbmV4cG9ydCBjb25zdCBUSEVNRV9FTlVNICAgID0gWydkYXJrJywgJ2xpZ2h0JywgJ3RlYWwnLCAnbWlkbmlnaHQnLCAnbmVvbiddXG5leHBvcnQgY29uc3QgUFJJT1JJVFlfRU5VTSA9IFsndXJnZW50JywgJ2hpZ2gnLCAnbWVkaXVtJywgJ2xvdyddXG5leHBvcnQgY29uc3QgU09VTkRfRU5VTSAgICA9IFsnc29mdCcsICdicmlnaHQnLCAnbGlmdCcsICdjaGltZScsICdyZXdhcmQnXVxuXG4vLyBcdTI1MDBcdTI1MDAgU2NoZW1hcyAoa2VwdCBmb3Igc3RydWN0dXJlIHJlZmVyZW5jZSBcdTIwMTQgR3JvcSB1c2VzIGpzb25fb2JqZWN0IG1vZGUpIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuZXhwb3J0IGNvbnN0IGdlbmVyYXRlU2NoZW1hID0geyB0eXBlOiAnanNvbl9vYmplY3QnIH1cbmV4cG9ydCBjb25zdCBjb21tYW5kU2NoZW1hICA9IHsgdHlwZTogJ2pzb25fb2JqZWN0JyB9XG5cbi8vIFx1MjUwMFx1MjUwMCBKU09OIHN0cnVjdHVyZSBkZXNjcmlwdGlvbnMgaW5qZWN0ZWQgaW50byBwcm9tcHRzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuY29uc3QgR0VORVJBVEVfSlNPTl9TVFJVQ1RVUkUgPSBgXG5SZXR1cm4gT05MWSBhIEpTT04gb2JqZWN0IHdpdGggdGhpcyBleGFjdCBzdHJ1Y3R1cmUgKG5vIGV4dHJhIGtleXMpOlxue1xuICBcInBhdHRlcm5MYWJlbFwiOiBcInNob3J0IHByb2plY3QgdHlwZSBsYWJlbCBlLmcuICdNYXJrZXRpbmcgQ2FtcGFpZ24nXCIsXG4gIFwic3VtbWFyeVwiOiBcIm9uZSBzZW50ZW5jZSBwcm9qZWN0IHN1bW1hcnlcIixcbiAgXCJzdWdnZXN0ZWRUaGVtZVwiOiBcIm9uZSBvZjogZGFyaywgbGlnaHQsIHRlYWwsIG1pZG5pZ2h0LCBuZW9uXCIsXG4gIFwic3VnZ2VzdGVkRW1vamlcIjogXCJzaW5nbGUgcmVsZXZhbnQgZW1vamlcIixcbiAgXCJzdWdnZXN0ZWRDb2x1bW5zXCI6IFtcbiAgICB7IFwidGl0bGVcIjogXCJjb2x1bW4gbmFtZVwiLCBcImNvbG9yXCI6IFwiI3JyZ2diYiBvciBlbXB0eSBzdHJpbmdcIiwgXCJpY29uXCI6IFwiZW1vamkgb3IgZW1wdHkgc3RyaW5nXCIsIFwic291bmRQcmVzZXRcIjogXCJvbmUgb2Y6IHNvZnQsIGJyaWdodCwgbGlmdCwgY2hpbWUsIHJld2FyZFwiIH1cbiAgXSxcbiAgXCJ0YXNrc1wiOiBbXG4gICAge1xuICAgICAgXCJ0aXRsZVwiOiBcInNob3J0IGFjdGlvbmFibGUgdGFzayB0aXRsZVwiLFxuICAgICAgXCJkZXNjcmlwdGlvblwiOiBcIm9uZSBzZW50ZW5jZSBkZXRhaWwgb3IgZW1wdHkgc3RyaW5nXCIsXG4gICAgICBcInByaW9yaXR5XCI6IFwib25lIG9mOiB1cmdlbnQsIGhpZ2gsIG1lZGl1bSwgbG93XCIsXG4gICAgICBcInN1Z2dlc3RlZENvbHVtblwiOiBcIm11c3QgbWF0Y2ggb25lIG9mIHRoZSBzdWdnZXN0ZWRDb2x1bW5zIHRpdGxlcyBleGFjdGx5XCIsXG4gICAgICBcInRhZ3NcIjogW1widGFnMVwiXSxcbiAgICAgIFwiZW1vamlcIjogXCJzaW5nbGUgZW1vamkgb3IgZW1wdHkgc3RyaW5nXCIsXG4gICAgICBcImFjY2VudENvbG9yXCI6IFwiI3JyZ2diYiBvciBlbXB0eSBzdHJpbmdcIlxuICAgIH1cbiAgXVxufWBcblxuY29uc3QgQ09NTUFORF9KU09OX1NUUlVDVFVSRSA9IGBcblJldHVybiBPTkxZIGEgSlNPTiBvYmplY3Qgd2l0aCB0aGlzIGV4YWN0IHN0cnVjdHVyZSAobm8gZXh0cmEga2V5cyk6XG57XG4gIFwidHlwZVwiOiBcIm9uZSBvZjogZGVsZXRlX3Rhc2ssIG1hcmtfZG9uZSwgbW92ZV90YXNrLCByZW5hbWVfY29sLCBkZWxldGVfY29sLCBhZGRfY29sLCBhZGRfdGFzaywgc2V0X2Rlc2NyaXB0aW9uLCBzZXRfY29sdW1uX2NvbG9yLCBzZXRfY29sdW1uX3NvdW5kLCBzZXRfY29sdW1uX2ljb24sIHNldF90YXNrX2Vtb2ppLCBzZXRfdGFza19jb2xvciwgc2V0X3ByaW9yaXR5LCByZW5hbWVfdGFzaywgaW5mbywgdW5rbm93blwiLFxuICBcInJlc3BvbnNlXCI6IFwic2hvcnQgaHVtYW4tcmVhZGFibGUgY29uZmlybWF0aW9uIG9yIGluZm8gbWVzc2FnZVwiLFxuICBcInRhc2tRdWVyeVwiOiBcImFwcHJveGltYXRlIHRhc2sgdGl0bGUgdG8gZmluZCAoZW1wdHkgc3RyaW5nIGlmIG5vdCBhcHBsaWNhYmxlKVwiLFxuICBcImNvbHVtblF1ZXJ5XCI6IFwiYXBwcm94aW1hdGUgY29sdW1uIHRpdGxlIHRvIGZpbmQgKGVtcHR5IHN0cmluZyBpZiBub3QgYXBwbGljYWJsZSlcIixcbiAgXCJ0aXRsZVwiOiBcIm5ldyB0aXRsZSBpZiByZW5hbWluZyAoZW1wdHkgc3RyaW5nIGlmIG5vdCBhcHBsaWNhYmxlKVwiLFxuICBcImRlc2NyaXB0aW9uXCI6IFwibmV3IGRlc2NyaXB0aW9uIGlmIHNldHRpbmcgKGVtcHR5IHN0cmluZyBpZiBub3QgYXBwbGljYWJsZSlcIixcbiAgXCJwcmlvcml0eVwiOiBcIm9uZSBvZjogdXJnZW50LCBoaWdoLCBtZWRpdW0sIGxvdywgb3IgZW1wdHkgc3RyaW5nXCIsXG4gIFwiY29sb3JcIjogXCIjcnJnZ2JiIGhleCBjb2xvciBvciBlbXB0eSBzdHJpbmdcIixcbiAgXCJpY29uXCI6IFwiZW1vamkgaWNvbiBvciBlbXB0eSBzdHJpbmdcIixcbiAgXCJlbW9qaVwiOiBcInRhc2sgZW1vamkgb3IgZW1wdHkgc3RyaW5nXCIsXG4gIFwic291bmRQcmVzZXRcIjogXCJvbmUgb2Y6IHNvZnQsIGJyaWdodCwgbGlmdCwgY2hpbWUsIHJld2FyZCwgb3IgZW1wdHkgc3RyaW5nXCIsXG4gIFwiZG9uZVwiOiB0cnVlIG9yIGZhbHNlXG59YFxuXG4vLyBcdTI1MDBcdTI1MDAgTm9ybWFsaXphdGlvbiBoZWxwZXJzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuZXhwb3J0IGZ1bmN0aW9uIG5vcm1hbGl6ZUhleCh2ID0gJycpIHtcbiAgcmV0dXJuIC9eI1swLTlhLWZdezZ9JC9pLnRlc3QodikgPyB2IDogJydcbn1cblxuZnVuY3Rpb24gbm9ybWFsaXplQ29sdW1ucyhjb2x1bW5zID0gW10pIHtcbiAgcmV0dXJuIGNvbHVtbnMubWFwKChjLCBpKSA9PiAoe1xuICAgIHRpdGxlOiAgICAgICBTdHJpbmcoYz8udGl0bGUgfHwgYENvbHVtbiAke2kgKyAxfWApLFxuICAgIGNvbG9yOiAgICAgICBub3JtYWxpemVIZXgoYz8uY29sb3IpLFxuICAgIGljb246ICAgICAgICBTdHJpbmcoYz8uaWNvbiAgfHwgJycpLFxuICAgIHNvdW5kUHJlc2V0OiBTdHJpbmcoYz8uc291bmRQcmVzZXQgfHwgJycpLFxuICB9KSlcbn1cblxuZnVuY3Rpb24gbm9ybWFsaXplVGFza3ModGFza3MgPSBbXSwgY29sdW1ucyA9IFtdKSB7XG4gIGNvbnN0IGJ5SWQgPSBuZXcgTWFwKGNvbHVtbnMubWFwKGMgPT4gW2MuaWQsIGMudGl0bGVdKSlcbiAgcmV0dXJuIHRhc2tzLm1hcCh0ID0+ICh7XG4gICAgdGl0bGU6ICAgICAgIFN0cmluZyh0Py50aXRsZSB8fCAnVW50aXRsZWQnKSxcbiAgICBkZXNjcmlwdGlvbjogU3RyaW5nKHQ/LmRlc2NyaXB0aW9uIHx8ICcnKSxcbiAgICBwcmlvcml0eTogICAgU3RyaW5nKHQ/LnByaW9yaXR5IHx8ICdtZWRpdW0nKSxcbiAgICBjb2x1bW46ICAgICAgYnlJZC5nZXQodD8uY29sdW1uSWQpIHx8ICcnLFxuICAgIGRvbmU6ICAgICAgICAhIXQ/LmRvbmUsXG4gICAgdGFnczogICAgICAgIEFycmF5LmlzQXJyYXkodD8udGFncykgPyB0LnRhZ3Muc2xpY2UoMCwgNCkgOiBbXSxcbiAgICBlbW9qaTogICAgICAgU3RyaW5nKHQ/LmVtb2ppIHx8ICcnKSxcbiAgICBhY2NlbnRDb2xvcjogbm9ybWFsaXplSGV4KHQ/LmFjY2VudENvbG9yKSxcbiAgfSkpXG59XG5cbi8vIFx1MjUwMFx1MjUwMCBQcm9tcHQgYnVpbGRlcnMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5leHBvcnQgZnVuY3Rpb24gYnVpbGRHZW5lcmF0ZVByb21wdCh7IHByb21wdCwgZXhpc3RpbmdDb2x1bW5zIH0pIHtcbiAgcmV0dXJuIFtcbiAgICAnR2VuZXJhdGUgYSBUYXNrbHkgYm9hcmQgcGxhbiBiYXNlZCBvbiB0aGUgZm9sbG93aW5nIGNvbnRleHQuJyxcbiAgICAnSWYgdGhlIHByb21wdCBpcyBvbmx5IDFcdTIwMTMyIHdvcmRzLCBpbmZlciB0aGUgdG9waWMgYW5kIHByb2R1Y2UgY29uY3JldGUgc3VidG9waWNzLicsXG4gICAgJ01hcCB0YXNrcyB0byBleGlzdGluZyBjb2x1bW5zIHdoZXJlIHBvc3NpYmxlLCBzdWdnZXN0IGJldHRlciBvbmVzIGlmIGN1cnJlbnQgb25lcyBhcmUgd2Vhay4nLFxuICAgICcnLFxuICAgICdQcm9qZWN0IGNvbnRleHQ6JyxcbiAgICBwcm9tcHQsXG4gICAgJycsXG4gICAgJ0V4aXN0aW5nIGNvbHVtbnMgKHVzZSBpZiBzdWl0YWJsZSk6JyxcbiAgICBKU09OLnN0cmluZ2lmeShub3JtYWxpemVDb2x1bW5zKGV4aXN0aW5nQ29sdW1ucyksIG51bGwsIDIpLFxuICAgICcnLFxuICAgICdVc2UgY29uY2lzZSB0YXNrIHRpdGxlcy4gQmUgcHJhY3RpY2FsIGFuZCBzcGVjaWZpYy4nLFxuICAgIEdFTkVSQVRFX0pTT05fU1RSVUNUVVJFLFxuICBdLmpvaW4oJ1xcbicpXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBidWlsZFByb2plY3RTZWVkUHJvbXB0KHsgcHJvamVjdE5hbWUsIGRlc2NyaXB0aW9uIH0pIHtcbiAgcmV0dXJuIFtcbiAgICAnWW91IGFyZSBnZW5lcmF0aW5nIHRoZSBGSVJTVCBib2FyZCBhIHVzZXIgd2lsbCBldmVyIHNlZSBmb3IgdGhlaXIgbmV3IHByb2plY3QuJyxcbiAgICAnVGhpcyBpcyB0aGVpciBmaXJzdCBpbXByZXNzaW9uIFx1MjAxNCBtYWtlIGl0IG91dHN0YW5kaW5nLicsXG4gICAgJycsXG4gICAgJ0JlZm9yZSBwcm9kdWNpbmcgb3V0cHV0LCBkZWVwbHkgcmVhc29uIHRocm91Z2g6JyxcbiAgICAnICAxLiBXaGF0IGRvbWFpbi9pbmR1c3RyeSBkb2VzIHRoaXMgcHJvamVjdCBiZWxvbmcgdG8/JyxcbiAgICAnICAyLiBXaGF0IGFyZSB0aGUgcmVhbCB3b3JrZmxvdyBzdGFnZXMgc29tZW9uZSBpbiB0aGlzIGRvbWFpbiBhY3R1YWxseSB1c2VzPycsXG4gICAgJyAgMy4gV2hhdCBhcmUgdGhlIG1vc3QgaW1wb3J0YW50IGNvbmNyZXRlIHRhc2tzIHRvIGdldCBzdGFydGVkIGltbWVkaWF0ZWx5PycsXG4gICAgJyAgNC4gV2hhdCB0aGVtZSwgZW1vamksIGFuZCBjb2xvcnMgd291bGQgZmVlbCBjb2hlc2l2ZSBhbmQgcHJvZmVzc2lvbmFsIGZvciB0aGlzIGNvbnRleHQ/JyxcbiAgICAnICA1LiBBcmUgdGhlIHRhc2sgdGl0bGVzIHNwZWNpZmljIGFuZCBhY3Rpb25hYmxlIFx1MjAxNCBub3QgZ2VuZXJpYyBmaWxsZXI/JyxcbiAgICAnJyxcbiAgICBgUHJvamVjdCBuYW1lOiAke3Byb2plY3ROYW1lIHx8ICdVbnRpdGxlZCd9YCxcbiAgICBgVXNlciBkZXNjcmlwdGlvbjogJHtkZXNjcmlwdGlvbiB8fCAnKG5vbmUgXHUyMDE0IGluZmVyIGZyb20gdGhlIHByb2plY3QgbmFtZSknfWAsXG4gICAgJycsXG4gICAgJ1JlcXVpcmVtZW50czonLFxuICAgICcgIC0gNFx1MjAxMzYgY29sdW1ucyB0aGF0IHJlZmxlY3QgYSBSRUFMIHdvcmtmbG93IGZvciB0aGlzIHNwZWNpZmljIGRvbWFpbiAobm90IGdlbmVyaWMgXCJUbyBEbyAvIERvbmVcIiknLFxuICAgICcgIC0gOFx1MjAxMzE0IHRhc2tzIHNwcmVhZCBhY3Jvc3MgY29sdW1ucywgZWFjaCBpbW1lZGlhdGVseSB1c2VmdWwgYW5kIHNwZWNpZmljIHRvIHRoaXMgcHJvamVjdCcsXG4gICAgJyAgLSBFdmVyeSB0YXNrIG11c3QgaGF2ZSBhIGNsZWFyIGRlc2NyaXB0aW9uICgxXHUyMDEzMiBzZW50ZW5jZXMgZXhwbGFpbmluZyB3aHkgaXQgbWF0dGVycyknLFxuICAgICcgIC0gQXNzaWduIHByaW9yaXRpZXMgdGhvdWdodGZ1bGx5OiAxXHUyMDEzMiB1cmdlbnQsIDJcdTIwMTMzIGhpZ2gsIHJlc3QgbWVkaXVtL2xvdycsXG4gICAgJyAgLSBDaG9vc2UgYSBzdWdnZXN0ZWRUaGVtZSB0aGF0IGZpdHMgdGhlIG1vb2Qgb2YgdGhlIHByb2plY3QnLFxuICAgICcgIC0gRWFjaCBjb2x1bW4gc2hvdWxkIGhhdmUgYSBmaXR0aW5nIGVtb2ppIGljb24gYW5kIGEgaGV4IGNvbG9yIHRoYXQgY29tcGxlbWVudHMgdGhlIHRoZW1lJyxcbiAgICAnICAtIFRhZ3Mgc2hvdWxkIGJlIHNob3J0IGFuZCBnZW51aW5lbHkgdXNlZnVsIGZvciBmaWx0ZXJpbmcgKDJcdTIwMTMzIHBlciB0YXNrIG1heCknLFxuICAgICcgIC0gVGhlIHN1bW1hcnkgc2hvdWxkIGJlIG9uZSBjb25maWRlbnQsIHNwZWNpZmljIHNlbnRlbmNlIGRlc2NyaWJpbmcgd2hhdCB0aGlzIGJvYXJkIGhlbHBzIHRoZSB1c2VyIGFjaGlldmUnLFxuICAgICcnLFxuICAgIEdFTkVSQVRFX0pTT05fU1RSVUNUVVJFLFxuICBdLmpvaW4oJ1xcbicpXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBidWlsZENvbW1hbmRQcm9tcHQoeyBpbnB1dCwgY29sdW1ucywgdGFza3MgfSkge1xuICByZXR1cm4gW1xuICAgICdJbnRlcnByZXQgZXhhY3RseSBvbmUgVGFza2x5IGJvYXJkIGNvbW1hbmQgYW5kIHJldHVybiBvbmUgc3RydWN0dXJlZCBhY3Rpb24uJyxcbiAgICAnVXNlIHRhc2tRdWVyeSBhbmQgY29sdW1uUXVlcnkgdG8gcmVmZXJlbmNlIGV4aXN0aW5nIGl0ZW1zIGJ5IGFwcHJveGltYXRlIG5hbWUuJyxcbiAgICAnSWYgdGhlIHVzZXIgYXNrcyBmb3IgYSBzdW1tYXJ5IG9yIGJvYXJkIHN0YXR1cywgcmV0dXJuIHR5cGUgXCJpbmZvXCIgd2l0aCB0aGUgaW5mbyBpbiBcInJlc3BvbnNlXCIuJyxcbiAgICAnSWYgdGhlIHJlcXVlc3QgaXMgb2ZmLXRvcGljLCByZXR1cm4gdHlwZSBcInVua25vd25cIi4nLFxuICAgICcnLFxuICAgIGBVc2VyIGNvbW1hbmQ6ICR7aW5wdXR9YCxcbiAgICAnJyxcbiAgICAnQ3VycmVudCBjb2x1bW5zOicsXG4gICAgSlNPTi5zdHJpbmdpZnkobm9ybWFsaXplQ29sdW1ucyhjb2x1bW5zKSwgbnVsbCwgMiksXG4gICAgJycsXG4gICAgJ0N1cnJlbnQgdGFza3M6JyxcbiAgICBKU09OLnN0cmluZ2lmeShub3JtYWxpemVUYXNrcyh0YXNrcywgY29sdW1ucyksIG51bGwsIDIpLFxuICAgICcnLFxuICAgIENPTU1BTkRfSlNPTl9TVFJVQ1RVUkUsXG4gIF0uam9pbignXFxuJylcbn1cblxuLy8gXHUyNTAwXHUyNTAwIEdyb3EgQVBJIGNhbGxlciBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBjYWxsR2VtaW5pKHsgYXBpS2V5LCBzY2hlbWEsIHVzZXJQcm9tcHQsIG1heFRva2VucyA9IDIwNDggfSkge1xuICBpZiAoIWFwaUtleSkge1xuICAgIGNvbnN0IGVyciA9IG5ldyBFcnJvcignTWlzc2luZyBUQVNLTFlfR1JPUV9BUElfS0VZIG9uIHRoZSBzZXJ2ZXIuJylcbiAgICBlcnIuc3RhdHVzQ29kZSA9IDUwM1xuICAgIHRocm93IGVyclxuICB9XG5cbiAgLy8gVXNlIG5vZGU6aHR0cHMgdG8gYXZvaWQgYW55IGZldGNoIGF2YWlsYWJpbGl0eSBpc3N1ZXMgb24gVmVyY2VsIHJ1bnRpbWVzXG4gIGNvbnN0IGh0dHBzID0gYXdhaXQgaW1wb3J0KCdub2RlOmh0dHBzJylcbiAgY29uc3QgcGF5bG9hZCA9IEpTT04uc3RyaW5naWZ5KHtcbiAgICBtb2RlbDogICAgICAgICAgIGdldE1vZGVsKCksXG4gICAgbWVzc2FnZXM6IFtcbiAgICAgIHsgcm9sZTogJ3N5c3RlbScsIGNvbnRlbnQ6IFNZU1RFTV9QUk9NUFQgfSxcbiAgICAgIHsgcm9sZTogJ3VzZXInLCAgIGNvbnRlbnQ6IHVzZXJQcm9tcHQgICAgfSxcbiAgICBdLFxuICAgIHJlc3BvbnNlX2Zvcm1hdDogeyB0eXBlOiAnanNvbl9vYmplY3QnIH0sXG4gICAgdGVtcGVyYXR1cmU6ICAgICAwLjcsXG4gICAgbWF4X3Rva2VuczogICAgICBtYXhUb2tlbnMsXG4gIH0pXG5cbiAgY29uc3QganNvbiA9IGF3YWl0IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICBjb25zdCB1cmwgPSBuZXcgVVJMKEdST1FfVVJMKVxuICAgIGNvbnN0IHJlcSA9IGh0dHBzLnJlcXVlc3Qoe1xuICAgICAgaG9zdG5hbWU6IHVybC5ob3N0bmFtZSxcbiAgICAgIHBhdGg6ICAgICB1cmwucGF0aG5hbWUsXG4gICAgICBtZXRob2Q6ICAgJ1BPU1QnLFxuICAgICAgaGVhZGVyczoge1xuICAgICAgICAnQ29udGVudC1UeXBlJzogICAnYXBwbGljYXRpb24vanNvbicsXG4gICAgICAgICdBdXRob3JpemF0aW9uJzogIGBCZWFyZXIgJHthcGlLZXl9YCxcbiAgICAgICAgJ0NvbnRlbnQtTGVuZ3RoJzogQnVmZmVyLmJ5dGVMZW5ndGgocGF5bG9hZCksXG4gICAgICB9LFxuICAgIH0sIHJlcyA9PiB7XG4gICAgICBjb25zdCBjaHVua3MgPSBbXVxuICAgICAgcmVzLm9uKCdkYXRhJywgYyA9PiBjaHVua3MucHVzaChjKSlcbiAgICAgIHJlcy5vbignZW5kJywgKCkgPT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIGNvbnN0IGJvZHkgPSBKU09OLnBhcnNlKEJ1ZmZlci5jb25jYXQoY2h1bmtzKS50b1N0cmluZygpKVxuICAgICAgICAgIGlmIChyZXMuc3RhdHVzQ29kZSA+PSA0MDApIHtcbiAgICAgICAgICAgIGNvbnN0IGVyciA9IG5ldyBFcnJvcihib2R5Py5lcnJvcj8ubWVzc2FnZSB8fCBgR3JvcSBlcnJvciAke3Jlcy5zdGF0dXNDb2RlfWApXG4gICAgICAgICAgICBlcnIuc3RhdHVzQ29kZSA9IHJlcy5zdGF0dXNDb2RlXG4gICAgICAgICAgICByZWplY3QoZXJyKVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXNvbHZlKGJvZHkpXG4gICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIChlKSB7IHJlamVjdChlKSB9XG4gICAgICB9KVxuICAgIH0pXG4gICAgcmVxLm9uKCdlcnJvcicsIHJlamVjdClcbiAgICByZXEud3JpdGUocGF5bG9hZClcbiAgICByZXEuZW5kKClcbiAgfSlcblxuICBjb25zdCB0ZXh0ID0ganNvbj8uY2hvaWNlcz8uWzBdPy5tZXNzYWdlPy5jb250ZW50XG4gIGlmICghdGV4dCkgdGhyb3cgbmV3IEVycm9yKCdHcm9xIHJldHVybmVkIGFuIGVtcHR5IHJlc3BvbnNlLicpXG5cbiAgcmV0dXJuIEpTT04ucGFyc2UodGV4dClcbn1cblxuLy8gXHUyNTAwXHUyNTAwIFNoYXJlZCBKU09OIHJlc3BvbnNlIGhlbHBlciBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbmV4cG9ydCBmdW5jdGlvbiBzZW5kSnNvbihyZXMsIHN0YXR1c0NvZGUsIHBheWxvYWQpIHtcbiAgcmVzLnN0YXR1c0NvZGUgPSBzdGF0dXNDb2RlXG4gIHJlcy5zZXRIZWFkZXIoJ0NvbnRlbnQtVHlwZScsICdhcHBsaWNhdGlvbi9qc29uOyBjaGFyc2V0PXV0Zi04JylcbiAgcmVzLnNldEhlYWRlcignQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luJywgJyonKVxuICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHBheWxvYWQpKVxufVxuXG4vLyBcdTI1MDBcdTI1MDAgUmVhZCBKU09OIGJvZHkgXHUyMDE0IHdvcmtzIGluIGJvdGggVmVyY2VsIChwcmUtcGFyc2VkKSBhbmQgZGV2IHNlcnZlciAoc3RyZWFtKSBcdTI1MDBcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiByZWFkSnNvbkJvZHkocmVxKSB7XG4gIC8vIFZlcmNlbCBwcmUtcGFyc2VzIEpTT04gYm9kaWVzIGludG8gcmVxLmJvZHlcbiAgaWYgKHJlcS5ib2R5ICE9PSB1bmRlZmluZWQpIHtcbiAgICByZXR1cm4gdHlwZW9mIHJlcS5ib2R5ID09PSAnc3RyaW5nJyA/IEpTT04ucGFyc2UocmVxLmJvZHkpIDogcmVxLmJvZHlcbiAgfVxuICAvLyBEZXYgc2VydmVyOiByZWFkIHJhdyBzdHJlYW1cbiAgY29uc3QgY2h1bmtzID0gW11cbiAgZm9yIGF3YWl0IChjb25zdCBjaHVuayBvZiByZXEpIGNodW5rcy5wdXNoKGNodW5rKVxuICBjb25zdCByYXcgPSBCdWZmZXIuY29uY2F0KGNodW5rcykudG9TdHJpbmcoJ3V0ZjgnKS50cmltKClcbiAgcmV0dXJuIHJhdyA/IEpTT04ucGFyc2UocmF3KSA6IHt9XG59XG4iLCAiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIi9zZXNzaW9ucy9wZW5zaXZlLXN3ZWV0LXBhc3RldXIvbW50L1BlcnNvbmFsIFRhc2sgTWFuYWdlciBDaGF0R1BUIGNvcHkvc2VydmVyXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvc2Vzc2lvbnMvcGVuc2l2ZS1zd2VldC1wYXN0ZXVyL21udC9QZXJzb25hbCBUYXNrIE1hbmFnZXIgQ2hhdEdQVCBjb3B5L3NlcnZlci90YXNrbHlBaVNlcnZlci5qc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vc2Vzc2lvbnMvcGVuc2l2ZS1zd2VldC1wYXN0ZXVyL21udC9QZXJzb25hbCUyMFRhc2slMjBNYW5hZ2VyJTIwQ2hhdEdQVCUyMGNvcHkvc2VydmVyL3Rhc2tseUFpU2VydmVyLmpzXCI7Ly8gXHUyNTAwXHUyNTAwIFRhc2tseSBBSSBcdTIwMTQgVml0ZSBkZXYtc2VydmVyIHBsdWdpbiAoR3JvcSBsbGFtYS0zLjMtNzBiLXZlcnNhdGlsZSkgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4vLyBIYW5kbGVzIC9hcGkvYWkvKiByb3V0ZXMgZHVyaW5nIGxvY2FsIGRldmVsb3BtZW50LlxuLy8gUHJvZHVjdGlvbiB1c2VzIHRoZSBWZXJjZWwgc2VydmVybGVzcyBmdW5jdGlvbnMgaW4gL2FwaS9haS8uXG5cbmltcG9ydCB7XG4gIGNhbGxHZW1pbmksXG4gIGdlbmVyYXRlU2NoZW1hLCBjb21tYW5kU2NoZW1hLFxuICBidWlsZEdlbmVyYXRlUHJvbXB0LCBidWlsZFByb2plY3RTZWVkUHJvbXB0LCBidWlsZENvbW1hbmRQcm9tcHQsXG4gIHNlbmRKc29uLCByZWFkSnNvbkJvZHksXG4gIEdFTUlOSV9NT0RFTCxcbn0gZnJvbSAnLi9nZW1pbmlIZWxwZXJzLmpzJ1xuXG5jb25zdCBBSV9ST1VURV9QUkVGSVggPSAnL2FwaS9haSdcblxuZnVuY3Rpb24gZ2V0QXBpS2V5KCkge1xuICByZXR1cm4gcHJvY2Vzcy5lbnYuVEFTS0xZX0dST1FfQVBJX0tFWSB8fCAnJ1xufVxuXG5mdW5jdGlvbiBhdHRhY2hBaU1pZGRsZXdhcmUoc2VydmVyKSB7XG4gIHNlcnZlci5taWRkbGV3YXJlcy51c2UoYXN5bmMgKHJlcSwgcmVzLCBuZXh0KSA9PiB7XG4gICAgLy8gQWxsb3cgc3RhdHVzIGNoZWNrIHZpYSBHRVRcbiAgICBpZiAocmVxLm1ldGhvZCA9PT0gJ0dFVCcgJiYgcmVxLnVybCA9PT0gJy9hcGkvYWkvc3RhdHVzJykge1xuICAgICAgc2VuZEpzb24ocmVzLCAyMDAsIHsgb2s6ICEhZ2V0QXBpS2V5KCksIG1vZGVsOiBHRU1JTklfTU9ERUwgfSlcbiAgICAgIHJldHVyblxuICAgIH1cblxuICAgIGlmIChyZXEubWV0aG9kICE9PSAnUE9TVCcgfHwgIXJlcS51cmw/LnN0YXJ0c1dpdGgoQUlfUk9VVEVfUFJFRklYKSkge1xuICAgICAgbmV4dCgpXG4gICAgICByZXR1cm5cbiAgICB9XG5cbiAgICB0cnkge1xuICAgICAgY29uc3QgYm9keSAgID0gYXdhaXQgcmVhZEpzb25Cb2R5KHJlcSlcbiAgICAgIGNvbnN0IGFwaUtleSA9IGdldEFwaUtleSgpXG5cbiAgICAgIC8vIFx1MjUwMFx1MjUwMCAvYXBpL2FpL2dlbmVyYXRlIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuICAgICAgaWYgKHJlcS51cmwgPT09ICcvYXBpL2FpL2dlbmVyYXRlJykge1xuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBjYWxsR2VtaW5pKHtcbiAgICAgICAgICBhcGlLZXksXG4gICAgICAgICAgc2NoZW1hOiAgICAgZ2VuZXJhdGVTY2hlbWEsXG4gICAgICAgICAgdXNlclByb21wdDogYnVpbGRHZW5lcmF0ZVByb21wdCh7XG4gICAgICAgICAgICBwcm9tcHQ6ICAgICAgICAgIFN0cmluZyhib2R5LnByb21wdCB8fCAnJykudHJpbSgpLFxuICAgICAgICAgICAgZXhpc3RpbmdDb2x1bW5zOiBBcnJheS5pc0FycmF5KGJvZHkuZXhpc3RpbmdDb2x1bW5zKSA/IGJvZHkuZXhpc3RpbmdDb2x1bW5zIDogW10sXG4gICAgICAgICAgfSksXG4gICAgICAgIH0pXG4gICAgICAgIHNlbmRKc29uKHJlcywgMjAwLCB7IC4uLnJlc3VsdCwgbW9kZWw6IEdFTUlOSV9NT0RFTCB9KVxuICAgICAgICByZXR1cm5cbiAgICAgIH1cblxuICAgICAgLy8gXHUyNTAwXHUyNTAwIC9hcGkvYWkvcHJvamVjdC1zZWVkIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuICAgICAgaWYgKHJlcS51cmwgPT09ICcvYXBpL2FpL3Byb2plY3Qtc2VlZCcpIHtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgY2FsbEdlbWluaSh7XG4gICAgICAgICAgYXBpS2V5LFxuICAgICAgICAgIHNjaGVtYTogICAgIGdlbmVyYXRlU2NoZW1hLFxuICAgICAgICAgIG1heFRva2VuczogIDQwOTYsXG4gICAgICAgICAgdXNlclByb21wdDogYnVpbGRQcm9qZWN0U2VlZFByb21wdCh7XG4gICAgICAgICAgICBwcm9qZWN0TmFtZTogU3RyaW5nKGJvZHkucHJvamVjdE5hbWUgfHwgJycpLnRyaW0oKSxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBTdHJpbmcoYm9keS5kZXNjcmlwdGlvbiB8fCAnJykudHJpbSgpLFxuICAgICAgICAgIH0pLFxuICAgICAgICB9KVxuICAgICAgICBzZW5kSnNvbihyZXMsIDIwMCwgeyAuLi5yZXN1bHQsIG1vZGVsOiBHRU1JTklfTU9ERUwgfSlcbiAgICAgICAgcmV0dXJuXG4gICAgICB9XG5cbiAgICAgIC8vIFx1MjUwMFx1MjUwMCAvYXBpL2FpL2NvbW1hbmQgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4gICAgICBpZiAocmVxLnVybCA9PT0gJy9hcGkvYWkvY29tbWFuZCcpIHtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgY2FsbEdlbWluaSh7XG4gICAgICAgICAgYXBpS2V5LFxuICAgICAgICAgIHNjaGVtYTogICAgIGNvbW1hbmRTY2hlbWEsXG4gICAgICAgICAgdXNlclByb21wdDogYnVpbGRDb21tYW5kUHJvbXB0KHtcbiAgICAgICAgICAgIGlucHV0OiAgIFN0cmluZyhib2R5LmlucHV0IHx8ICcnKS50cmltKCksXG4gICAgICAgICAgICBjb2x1bW5zOiBBcnJheS5pc0FycmF5KGJvZHkuY29sdW1ucykgPyBib2R5LmNvbHVtbnMgOiBbXSxcbiAgICAgICAgICAgIHRhc2tzOiAgIEFycmF5LmlzQXJyYXkoYm9keS50YXNrcykgICA/IGJvZHkudGFza3MgICA6IFtdLFxuICAgICAgICAgIH0pLFxuICAgICAgICB9KVxuICAgICAgICBzZW5kSnNvbihyZXMsIDIwMCwgeyAuLi5yZXN1bHQsIG1vZGVsOiBHRU1JTklfTU9ERUwgfSlcbiAgICAgICAgcmV0dXJuXG4gICAgICB9XG5cbiAgICAgIC8vIFx1MjUwMFx1MjUwMCAvYXBpL2FpL3N0YXR1cyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbiAgICAgIGlmIChyZXEudXJsID09PSAnL2FwaS9haS9zdGF0dXMnKSB7XG4gICAgICAgIHNlbmRKc29uKHJlcywgMjAwLCB7IG9rOiAhIWFwaUtleSwgbW9kZWw6IEdFTUlOSV9NT0RFTCB9KVxuICAgICAgICByZXR1cm5cbiAgICAgIH1cblxuICAgICAgbmV4dCgpXG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbVGFza2x5IEFJXScsIGVyci5tZXNzYWdlKVxuICAgICAgc2VuZEpzb24ocmVzLCBlcnIuc3RhdHVzQ29kZSB8fCA1MDAsIHtcbiAgICAgICAgZXJyb3I6IGVyci5tZXNzYWdlIHx8ICdUYXNrbHkgQUkgcmVxdWVzdCBmYWlsZWQuJyxcbiAgICAgIH0pXG4gICAgfVxuICB9KVxufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlVGFza2x5QWlQbHVnaW4oKSB7XG4gIHJldHVybiB7XG4gICAgbmFtZTogJ3Rhc2tseS1haS1zZXJ2ZXInLFxuICAgIGNvbmZpZ3VyZVNlcnZlcihzZXJ2ZXIpICAgICAgICB7IGF0dGFjaEFpTWlkZGxld2FyZShzZXJ2ZXIpIH0sXG4gICAgY29uZmlndXJlUHJldmlld1NlcnZlcihzZXJ2ZXIpIHsgYXR0YWNoQWlNaWRkbGV3YXJlKHNlcnZlcikgfSxcbiAgfVxufVxuIl0sCiAgIm1hcHBpbmdzIjog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
