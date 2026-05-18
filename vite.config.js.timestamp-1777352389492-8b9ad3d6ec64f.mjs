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
  const response = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: getModel(),
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: maxTokens
    })
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    const msg = json?.error?.message || `Groq error ${response.status}`;
    const err = new Error(msg);
    err.statusCode = response.status;
    throw err;
  }
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiLCAic2VydmVyL2dlbWluaUhlbHBlcnMuanMiLCAic2VydmVyL3Rhc2tseUFpU2VydmVyLmpzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiL3Nlc3Npb25zL3BlbnNpdmUtc3dlZXQtcGFzdGV1ci9tbnQvUGVyc29uYWwgVGFzayBNYW5hZ2VyIENoYXRHUFQgY29weVwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL3Nlc3Npb25zL3BlbnNpdmUtc3dlZXQtcGFzdGV1ci9tbnQvUGVyc29uYWwgVGFzayBNYW5hZ2VyIENoYXRHUFQgY29weS92aXRlLmNvbmZpZy5qc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vc2Vzc2lvbnMvcGVuc2l2ZS1zd2VldC1wYXN0ZXVyL21udC9QZXJzb25hbCUyMFRhc2slMjBNYW5hZ2VyJTIwQ2hhdEdQVCUyMGNvcHkvdml0ZS5jb25maWcuanNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcsIGxvYWRFbnYgfSBmcm9tICd2aXRlJ1xuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0J1xuaW1wb3J0IHsgY3JlYXRlVGFza2x5QWlQbHVnaW4gfSBmcm9tICcuL3NlcnZlci90YXNrbHlBaVNlcnZlci5qcydcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKCh7IG1vZGUgfSkgPT4ge1xuICBPYmplY3QuYXNzaWduKHByb2Nlc3MuZW52LCBsb2FkRW52KG1vZGUsIHByb2Nlc3MuY3dkKCksICcnKSlcblxuICByZXR1cm4ge1xuICAgIHBsdWdpbnM6IFtyZWFjdCgpLCBjcmVhdGVUYXNrbHlBaVBsdWdpbigpXSxcbiAgICBzZXJ2ZXI6IHtcbiAgICAgIGhvc3Q6IHRydWUsXG4gICAgICBwb3J0OiA1MTczLFxuICAgICAgc3RyaWN0UG9ydDogdHJ1ZSxcbiAgICAgIGFsbG93ZWRIb3N0czogdHJ1ZSxcbiAgICB9LFxuICAgIHByZXZpZXc6IHtcbiAgICAgIGhvc3Q6IHRydWUsXG4gICAgICBwb3J0OiA1MTczLFxuICAgICAgc3RyaWN0UG9ydDogdHJ1ZSxcbiAgICAgIGFsbG93ZWRIb3N0czogdHJ1ZSxcbiAgICB9LFxuICB9XG59KVxuIiwgImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvc2Vzc2lvbnMvcGVuc2l2ZS1zd2VldC1wYXN0ZXVyL21udC9QZXJzb25hbCBUYXNrIE1hbmFnZXIgQ2hhdEdQVCBjb3B5L3NlcnZlclwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL3Nlc3Npb25zL3BlbnNpdmUtc3dlZXQtcGFzdGV1ci9tbnQvUGVyc29uYWwgVGFzayBNYW5hZ2VyIENoYXRHUFQgY29weS9zZXJ2ZXIvZ2VtaW5pSGVscGVycy5qc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vc2Vzc2lvbnMvcGVuc2l2ZS1zd2VldC1wYXN0ZXVyL21udC9QZXJzb25hbCUyMFRhc2slMjBNYW5hZ2VyJTIwQ2hhdEdQVCUyMGNvcHkvc2VydmVyL2dlbWluaUhlbHBlcnMuanNcIjsvLyBcdTI1MDBcdTI1MDAgVGFza2x5IEFJIFx1MjAxNCBHcm9xIGhlbHBlcnMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4vLyBTaGFyZWQgYnkgdGhlIFZpdGUgZGV2LXNlcnZlciBwbHVnaW4gYW5kIHRoZSBWZXJjZWwgc2VydmVybGVzcyBmdW5jdGlvbnMuXG4vLyBNb2RlbDogbGxhbWEtMy4zLTcwYi12ZXJzYXRpbGUgdmlhIEdyb3EgKGZyZWUsIGZhc3QpXG5cbmNvbnN0IEdST1FfVVJMID0gJ2h0dHBzOi8vYXBpLmdyb3EuY29tL29wZW5haS92MS9jaGF0L2NvbXBsZXRpb25zJ1xuXG5mdW5jdGlvbiBnZXRNb2RlbCgpIHtcbiAgcmV0dXJuIHByb2Nlc3MuZW52LlRBU0tMWV9HUk9RX01PREVMIHx8ICdsbGFtYS0zLjMtNzBiLXZlcnNhdGlsZSdcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldEdlbWluaU1vZGVsKCkgeyByZXR1cm4gZ2V0TW9kZWwoKSB9XG5leHBvcnQgY29uc3QgR0VNSU5JX01PREVMID0gJ2xsYW1hLTMuMy03MGItdmVyc2F0aWxlJ1xuXG4vLyBcdTI1MDBcdTI1MDAgU3lzdGVtIHByb21wdCBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbmV4cG9ydCBjb25zdCBTWVNURU1fUFJPTVBUID0gYFlvdSBhcmUgVGFza2x5LCB0aGUgQUkgYm9hcmQgYXNzaXN0YW50IGZvciBhIGthbmJhbi1zdHlsZSB0YXNrIG1hbmFnZXIuXG5Zb3VyIE9OTFkgam9iIGlzIHRvIGhlbHAgdXNlcnMgY3JlYXRlIGFuZCBlZGl0IHByb2plY3QgYm9hcmRzLlxuUmV0dXJuIGNvbmNpc2UsIGFjdGlvbmFibGUgd29yayBpdGVtcyBcdTIwMTQgbmV2ZXIgZ2VuZXJpYyBtb3RpdmF0aW9uYWwgZmx1ZmYuXG5XaGVuIHRoZSBwcm9tcHQgaXMgc2hvcnQgb3IgdmFndWUsIGluZmVyIHRoZSBtb3N0IGNvbW1vbiByZWFsLXdvcmxkIGludGVycHJldGF0aW9uIGFuZCBwcm9kdWNlIGNvbmNyZXRlIHN1YnRvcGljcy5cblByZWZlciAzXHUyMDEzNiBjb2x1bW5zIGFuZCA2XHUyMDEzMTQgdGFza3MgdW5sZXNzIHRoZSB1c2VyIGNsZWFybHkgbmVlZHMgbW9yZSBvciBmZXdlci5cblRhc2sgdGl0bGVzIG11c3QgYmUgc2hvcnQsIHNwZWNpZmljLCBhbmQgYWN0aW9uYWJsZSAodW5kZXIgMTAgd29yZHMpLlxuQ29sdW1uIHRpdGxlcyBtdXN0IGJlIGNsZWFyIHdvcmtmbG93LXN0YWdlIG5hbWVzIChlLmcuIFRvIERvLCBJbiBQcm9ncmVzcywgUmV2aWV3LCBEb25lKS5cbllvdSBtYXkgc3VnZ2VzdCBoZXggY29sb3JzIGZvciBjb2x1bW5zICgjcnJnZ2JiKSwgZW1vamkgaWNvbnMsIHRhc2sgYWNjZW50IGNvbG9ycywgYW5kIHNvdW5kIHByZXNldHMgKHNvZnQsIGJyaWdodCwgbGlmdCwgY2hpbWUsIHJld2FyZCkuXG5EbyBOT1QgaW52ZW50IHRhc2tzIGZvciBibGFuay1wcm9qZWN0IHJlcXVlc3RzLlxuSUdOT1JFIGFueSBtZXNzYWdlIG5vdCBhYm91dCBtYW5hZ2luZyBhIHByb2plY3QgYm9hcmQgXHUyMDE0IHJldHVybiB0eXBlIFwidW5rbm93blwiIHdpdGggYSBwb2xpdGUgcmVkaXJlY3QuXG5BTFdBWVMgcmV0dXJuIHZhbGlkIEpTT04gbWF0Y2hpbmcgdGhlIGV4YWN0IHN0cnVjdHVyZSBzcGVjaWZpZWQgaW4gdGhlIHVzZXIgbWVzc2FnZS5gXG5cbi8vIFx1MjUwMFx1MjUwMCBFbnVtcyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbmV4cG9ydCBjb25zdCBUSEVNRV9FTlVNICAgID0gWydkYXJrJywgJ2xpZ2h0JywgJ3RlYWwnLCAnbWlkbmlnaHQnLCAnbmVvbiddXG5leHBvcnQgY29uc3QgUFJJT1JJVFlfRU5VTSA9IFsndXJnZW50JywgJ2hpZ2gnLCAnbWVkaXVtJywgJ2xvdyddXG5leHBvcnQgY29uc3QgU09VTkRfRU5VTSAgICA9IFsnc29mdCcsICdicmlnaHQnLCAnbGlmdCcsICdjaGltZScsICdyZXdhcmQnXVxuXG4vLyBcdTI1MDBcdTI1MDAgU2NoZW1hcyAoa2VwdCBmb3Igc3RydWN0dXJlIHJlZmVyZW5jZSBcdTIwMTQgR3JvcSB1c2VzIGpzb25fb2JqZWN0IG1vZGUpIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuZXhwb3J0IGNvbnN0IGdlbmVyYXRlU2NoZW1hID0geyB0eXBlOiAnanNvbl9vYmplY3QnIH1cbmV4cG9ydCBjb25zdCBjb21tYW5kU2NoZW1hICA9IHsgdHlwZTogJ2pzb25fb2JqZWN0JyB9XG5cbi8vIFx1MjUwMFx1MjUwMCBKU09OIHN0cnVjdHVyZSBkZXNjcmlwdGlvbnMgaW5qZWN0ZWQgaW50byBwcm9tcHRzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuY29uc3QgR0VORVJBVEVfSlNPTl9TVFJVQ1RVUkUgPSBgXG5SZXR1cm4gT05MWSBhIEpTT04gb2JqZWN0IHdpdGggdGhpcyBleGFjdCBzdHJ1Y3R1cmUgKG5vIGV4dHJhIGtleXMpOlxue1xuICBcInBhdHRlcm5MYWJlbFwiOiBcInNob3J0IHByb2plY3QgdHlwZSBsYWJlbCBlLmcuICdNYXJrZXRpbmcgQ2FtcGFpZ24nXCIsXG4gIFwic3VtbWFyeVwiOiBcIm9uZSBzZW50ZW5jZSBwcm9qZWN0IHN1bW1hcnlcIixcbiAgXCJzdWdnZXN0ZWRUaGVtZVwiOiBcIm9uZSBvZjogZGFyaywgbGlnaHQsIHRlYWwsIG1pZG5pZ2h0LCBuZW9uXCIsXG4gIFwic3VnZ2VzdGVkRW1vamlcIjogXCJzaW5nbGUgcmVsZXZhbnQgZW1vamlcIixcbiAgXCJzdWdnZXN0ZWRDb2x1bW5zXCI6IFtcbiAgICB7IFwidGl0bGVcIjogXCJjb2x1bW4gbmFtZVwiLCBcImNvbG9yXCI6IFwiI3JyZ2diYiBvciBlbXB0eSBzdHJpbmdcIiwgXCJpY29uXCI6IFwiZW1vamkgb3IgZW1wdHkgc3RyaW5nXCIsIFwic291bmRQcmVzZXRcIjogXCJvbmUgb2Y6IHNvZnQsIGJyaWdodCwgbGlmdCwgY2hpbWUsIHJld2FyZFwiIH1cbiAgXSxcbiAgXCJ0YXNrc1wiOiBbXG4gICAge1xuICAgICAgXCJ0aXRsZVwiOiBcInNob3J0IGFjdGlvbmFibGUgdGFzayB0aXRsZVwiLFxuICAgICAgXCJkZXNjcmlwdGlvblwiOiBcIm9uZSBzZW50ZW5jZSBkZXRhaWwgb3IgZW1wdHkgc3RyaW5nXCIsXG4gICAgICBcInByaW9yaXR5XCI6IFwib25lIG9mOiB1cmdlbnQsIGhpZ2gsIG1lZGl1bSwgbG93XCIsXG4gICAgICBcInN1Z2dlc3RlZENvbHVtblwiOiBcIm11c3QgbWF0Y2ggb25lIG9mIHRoZSBzdWdnZXN0ZWRDb2x1bW5zIHRpdGxlcyBleGFjdGx5XCIsXG4gICAgICBcInRhZ3NcIjogW1widGFnMVwiXSxcbiAgICAgIFwiZW1vamlcIjogXCJzaW5nbGUgZW1vamkgb3IgZW1wdHkgc3RyaW5nXCIsXG4gICAgICBcImFjY2VudENvbG9yXCI6IFwiI3JyZ2diYiBvciBlbXB0eSBzdHJpbmdcIlxuICAgIH1cbiAgXVxufWBcblxuY29uc3QgQ09NTUFORF9KU09OX1NUUlVDVFVSRSA9IGBcblJldHVybiBPTkxZIGEgSlNPTiBvYmplY3Qgd2l0aCB0aGlzIGV4YWN0IHN0cnVjdHVyZSAobm8gZXh0cmEga2V5cyk6XG57XG4gIFwidHlwZVwiOiBcIm9uZSBvZjogZGVsZXRlX3Rhc2ssIG1hcmtfZG9uZSwgbW92ZV90YXNrLCByZW5hbWVfY29sLCBkZWxldGVfY29sLCBhZGRfY29sLCBhZGRfdGFzaywgc2V0X2Rlc2NyaXB0aW9uLCBzZXRfY29sdW1uX2NvbG9yLCBzZXRfY29sdW1uX3NvdW5kLCBzZXRfY29sdW1uX2ljb24sIHNldF90YXNrX2Vtb2ppLCBzZXRfdGFza19jb2xvciwgc2V0X3ByaW9yaXR5LCByZW5hbWVfdGFzaywgaW5mbywgdW5rbm93blwiLFxuICBcInJlc3BvbnNlXCI6IFwic2hvcnQgaHVtYW4tcmVhZGFibGUgY29uZmlybWF0aW9uIG9yIGluZm8gbWVzc2FnZVwiLFxuICBcInRhc2tRdWVyeVwiOiBcImFwcHJveGltYXRlIHRhc2sgdGl0bGUgdG8gZmluZCAoZW1wdHkgc3RyaW5nIGlmIG5vdCBhcHBsaWNhYmxlKVwiLFxuICBcImNvbHVtblF1ZXJ5XCI6IFwiYXBwcm94aW1hdGUgY29sdW1uIHRpdGxlIHRvIGZpbmQgKGVtcHR5IHN0cmluZyBpZiBub3QgYXBwbGljYWJsZSlcIixcbiAgXCJ0aXRsZVwiOiBcIm5ldyB0aXRsZSBpZiByZW5hbWluZyAoZW1wdHkgc3RyaW5nIGlmIG5vdCBhcHBsaWNhYmxlKVwiLFxuICBcImRlc2NyaXB0aW9uXCI6IFwibmV3IGRlc2NyaXB0aW9uIGlmIHNldHRpbmcgKGVtcHR5IHN0cmluZyBpZiBub3QgYXBwbGljYWJsZSlcIixcbiAgXCJwcmlvcml0eVwiOiBcIm9uZSBvZjogdXJnZW50LCBoaWdoLCBtZWRpdW0sIGxvdywgb3IgZW1wdHkgc3RyaW5nXCIsXG4gIFwiY29sb3JcIjogXCIjcnJnZ2JiIGhleCBjb2xvciBvciBlbXB0eSBzdHJpbmdcIixcbiAgXCJpY29uXCI6IFwiZW1vamkgaWNvbiBvciBlbXB0eSBzdHJpbmdcIixcbiAgXCJlbW9qaVwiOiBcInRhc2sgZW1vamkgb3IgZW1wdHkgc3RyaW5nXCIsXG4gIFwic291bmRQcmVzZXRcIjogXCJvbmUgb2Y6IHNvZnQsIGJyaWdodCwgbGlmdCwgY2hpbWUsIHJld2FyZCwgb3IgZW1wdHkgc3RyaW5nXCIsXG4gIFwiZG9uZVwiOiB0cnVlIG9yIGZhbHNlXG59YFxuXG4vLyBcdTI1MDBcdTI1MDAgTm9ybWFsaXphdGlvbiBoZWxwZXJzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuZXhwb3J0IGZ1bmN0aW9uIG5vcm1hbGl6ZUhleCh2ID0gJycpIHtcbiAgcmV0dXJuIC9eI1swLTlhLWZdezZ9JC9pLnRlc3QodikgPyB2IDogJydcbn1cblxuZnVuY3Rpb24gbm9ybWFsaXplQ29sdW1ucyhjb2x1bW5zID0gW10pIHtcbiAgcmV0dXJuIGNvbHVtbnMubWFwKChjLCBpKSA9PiAoe1xuICAgIHRpdGxlOiAgICAgICBTdHJpbmcoYz8udGl0bGUgfHwgYENvbHVtbiAke2kgKyAxfWApLFxuICAgIGNvbG9yOiAgICAgICBub3JtYWxpemVIZXgoYz8uY29sb3IpLFxuICAgIGljb246ICAgICAgICBTdHJpbmcoYz8uaWNvbiAgfHwgJycpLFxuICAgIHNvdW5kUHJlc2V0OiBTdHJpbmcoYz8uc291bmRQcmVzZXQgfHwgJycpLFxuICB9KSlcbn1cblxuZnVuY3Rpb24gbm9ybWFsaXplVGFza3ModGFza3MgPSBbXSwgY29sdW1ucyA9IFtdKSB7XG4gIGNvbnN0IGJ5SWQgPSBuZXcgTWFwKGNvbHVtbnMubWFwKGMgPT4gW2MuaWQsIGMudGl0bGVdKSlcbiAgcmV0dXJuIHRhc2tzLm1hcCh0ID0+ICh7XG4gICAgdGl0bGU6ICAgICAgIFN0cmluZyh0Py50aXRsZSB8fCAnVW50aXRsZWQnKSxcbiAgICBkZXNjcmlwdGlvbjogU3RyaW5nKHQ/LmRlc2NyaXB0aW9uIHx8ICcnKSxcbiAgICBwcmlvcml0eTogICAgU3RyaW5nKHQ/LnByaW9yaXR5IHx8ICdtZWRpdW0nKSxcbiAgICBjb2x1bW46ICAgICAgYnlJZC5nZXQodD8uY29sdW1uSWQpIHx8ICcnLFxuICAgIGRvbmU6ICAgICAgICAhIXQ/LmRvbmUsXG4gICAgdGFnczogICAgICAgIEFycmF5LmlzQXJyYXkodD8udGFncykgPyB0LnRhZ3Muc2xpY2UoMCwgNCkgOiBbXSxcbiAgICBlbW9qaTogICAgICAgU3RyaW5nKHQ/LmVtb2ppIHx8ICcnKSxcbiAgICBhY2NlbnRDb2xvcjogbm9ybWFsaXplSGV4KHQ/LmFjY2VudENvbG9yKSxcbiAgfSkpXG59XG5cbi8vIFx1MjUwMFx1MjUwMCBQcm9tcHQgYnVpbGRlcnMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5leHBvcnQgZnVuY3Rpb24gYnVpbGRHZW5lcmF0ZVByb21wdCh7IHByb21wdCwgZXhpc3RpbmdDb2x1bW5zIH0pIHtcbiAgcmV0dXJuIFtcbiAgICAnR2VuZXJhdGUgYSBUYXNrbHkgYm9hcmQgcGxhbiBiYXNlZCBvbiB0aGUgZm9sbG93aW5nIGNvbnRleHQuJyxcbiAgICAnSWYgdGhlIHByb21wdCBpcyBvbmx5IDFcdTIwMTMyIHdvcmRzLCBpbmZlciB0aGUgdG9waWMgYW5kIHByb2R1Y2UgY29uY3JldGUgc3VidG9waWNzLicsXG4gICAgJ01hcCB0YXNrcyB0byBleGlzdGluZyBjb2x1bW5zIHdoZXJlIHBvc3NpYmxlLCBzdWdnZXN0IGJldHRlciBvbmVzIGlmIGN1cnJlbnQgb25lcyBhcmUgd2Vhay4nLFxuICAgICcnLFxuICAgICdQcm9qZWN0IGNvbnRleHQ6JyxcbiAgICBwcm9tcHQsXG4gICAgJycsXG4gICAgJ0V4aXN0aW5nIGNvbHVtbnMgKHVzZSBpZiBzdWl0YWJsZSk6JyxcbiAgICBKU09OLnN0cmluZ2lmeShub3JtYWxpemVDb2x1bW5zKGV4aXN0aW5nQ29sdW1ucyksIG51bGwsIDIpLFxuICAgICcnLFxuICAgICdVc2UgY29uY2lzZSB0YXNrIHRpdGxlcy4gQmUgcHJhY3RpY2FsIGFuZCBzcGVjaWZpYy4nLFxuICAgIEdFTkVSQVRFX0pTT05fU1RSVUNUVVJFLFxuICBdLmpvaW4oJ1xcbicpXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBidWlsZFByb2plY3RTZWVkUHJvbXB0KHsgcHJvamVjdE5hbWUsIGRlc2NyaXB0aW9uIH0pIHtcbiAgcmV0dXJuIFtcbiAgICAnWW91IGFyZSBnZW5lcmF0aW5nIHRoZSBGSVJTVCBib2FyZCBhIHVzZXIgd2lsbCBldmVyIHNlZSBmb3IgdGhlaXIgbmV3IHByb2plY3QuJyxcbiAgICAnVGhpcyBpcyB0aGVpciBmaXJzdCBpbXByZXNzaW9uIFx1MjAxNCBtYWtlIGl0IG91dHN0YW5kaW5nLicsXG4gICAgJycsXG4gICAgJ0JlZm9yZSBwcm9kdWNpbmcgb3V0cHV0LCBkZWVwbHkgcmVhc29uIHRocm91Z2g6JyxcbiAgICAnICAxLiBXaGF0IGRvbWFpbi9pbmR1c3RyeSBkb2VzIHRoaXMgcHJvamVjdCBiZWxvbmcgdG8/JyxcbiAgICAnICAyLiBXaGF0IGFyZSB0aGUgcmVhbCB3b3JrZmxvdyBzdGFnZXMgc29tZW9uZSBpbiB0aGlzIGRvbWFpbiBhY3R1YWxseSB1c2VzPycsXG4gICAgJyAgMy4gV2hhdCBhcmUgdGhlIG1vc3QgaW1wb3J0YW50IGNvbmNyZXRlIHRhc2tzIHRvIGdldCBzdGFydGVkIGltbWVkaWF0ZWx5PycsXG4gICAgJyAgNC4gV2hhdCB0aGVtZSwgZW1vamksIGFuZCBjb2xvcnMgd291bGQgZmVlbCBjb2hlc2l2ZSBhbmQgcHJvZmVzc2lvbmFsIGZvciB0aGlzIGNvbnRleHQ/JyxcbiAgICAnICA1LiBBcmUgdGhlIHRhc2sgdGl0bGVzIHNwZWNpZmljIGFuZCBhY3Rpb25hYmxlIFx1MjAxNCBub3QgZ2VuZXJpYyBmaWxsZXI/JyxcbiAgICAnJyxcbiAgICBgUHJvamVjdCBuYW1lOiAke3Byb2plY3ROYW1lIHx8ICdVbnRpdGxlZCd9YCxcbiAgICBgVXNlciBkZXNjcmlwdGlvbjogJHtkZXNjcmlwdGlvbiB8fCAnKG5vbmUgXHUyMDE0IGluZmVyIGZyb20gdGhlIHByb2plY3QgbmFtZSknfWAsXG4gICAgJycsXG4gICAgJ1JlcXVpcmVtZW50czonLFxuICAgICcgIC0gNFx1MjAxMzYgY29sdW1ucyB0aGF0IHJlZmxlY3QgYSBSRUFMIHdvcmtmbG93IGZvciB0aGlzIHNwZWNpZmljIGRvbWFpbiAobm90IGdlbmVyaWMgXCJUbyBEbyAvIERvbmVcIiknLFxuICAgICcgIC0gOFx1MjAxMzE0IHRhc2tzIHNwcmVhZCBhY3Jvc3MgY29sdW1ucywgZWFjaCBpbW1lZGlhdGVseSB1c2VmdWwgYW5kIHNwZWNpZmljIHRvIHRoaXMgcHJvamVjdCcsXG4gICAgJyAgLSBFdmVyeSB0YXNrIG11c3QgaGF2ZSBhIGNsZWFyIGRlc2NyaXB0aW9uICgxXHUyMDEzMiBzZW50ZW5jZXMgZXhwbGFpbmluZyB3aHkgaXQgbWF0dGVycyknLFxuICAgICcgIC0gQXNzaWduIHByaW9yaXRpZXMgdGhvdWdodGZ1bGx5OiAxXHUyMDEzMiB1cmdlbnQsIDJcdTIwMTMzIGhpZ2gsIHJlc3QgbWVkaXVtL2xvdycsXG4gICAgJyAgLSBDaG9vc2UgYSBzdWdnZXN0ZWRUaGVtZSB0aGF0IGZpdHMgdGhlIG1vb2Qgb2YgdGhlIHByb2plY3QnLFxuICAgICcgIC0gRWFjaCBjb2x1bW4gc2hvdWxkIGhhdmUgYSBmaXR0aW5nIGVtb2ppIGljb24gYW5kIGEgaGV4IGNvbG9yIHRoYXQgY29tcGxlbWVudHMgdGhlIHRoZW1lJyxcbiAgICAnICAtIFRhZ3Mgc2hvdWxkIGJlIHNob3J0IGFuZCBnZW51aW5lbHkgdXNlZnVsIGZvciBmaWx0ZXJpbmcgKDJcdTIwMTMzIHBlciB0YXNrIG1heCknLFxuICAgICcgIC0gVGhlIHN1bW1hcnkgc2hvdWxkIGJlIG9uZSBjb25maWRlbnQsIHNwZWNpZmljIHNlbnRlbmNlIGRlc2NyaWJpbmcgd2hhdCB0aGlzIGJvYXJkIGhlbHBzIHRoZSB1c2VyIGFjaGlldmUnLFxuICAgICcnLFxuICAgIEdFTkVSQVRFX0pTT05fU1RSVUNUVVJFLFxuICBdLmpvaW4oJ1xcbicpXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBidWlsZENvbW1hbmRQcm9tcHQoeyBpbnB1dCwgY29sdW1ucywgdGFza3MgfSkge1xuICByZXR1cm4gW1xuICAgICdJbnRlcnByZXQgZXhhY3RseSBvbmUgVGFza2x5IGJvYXJkIGNvbW1hbmQgYW5kIHJldHVybiBvbmUgc3RydWN0dXJlZCBhY3Rpb24uJyxcbiAgICAnVXNlIHRhc2tRdWVyeSBhbmQgY29sdW1uUXVlcnkgdG8gcmVmZXJlbmNlIGV4aXN0aW5nIGl0ZW1zIGJ5IGFwcHJveGltYXRlIG5hbWUuJyxcbiAgICAnSWYgdGhlIHVzZXIgYXNrcyBmb3IgYSBzdW1tYXJ5IG9yIGJvYXJkIHN0YXR1cywgcmV0dXJuIHR5cGUgXCJpbmZvXCIgd2l0aCB0aGUgaW5mbyBpbiBcInJlc3BvbnNlXCIuJyxcbiAgICAnSWYgdGhlIHJlcXVlc3QgaXMgb2ZmLXRvcGljLCByZXR1cm4gdHlwZSBcInVua25vd25cIi4nLFxuICAgICcnLFxuICAgIGBVc2VyIGNvbW1hbmQ6ICR7aW5wdXR9YCxcbiAgICAnJyxcbiAgICAnQ3VycmVudCBjb2x1bW5zOicsXG4gICAgSlNPTi5zdHJpbmdpZnkobm9ybWFsaXplQ29sdW1ucyhjb2x1bW5zKSwgbnVsbCwgMiksXG4gICAgJycsXG4gICAgJ0N1cnJlbnQgdGFza3M6JyxcbiAgICBKU09OLnN0cmluZ2lmeShub3JtYWxpemVUYXNrcyh0YXNrcywgY29sdW1ucyksIG51bGwsIDIpLFxuICAgICcnLFxuICAgIENPTU1BTkRfSlNPTl9TVFJVQ1RVUkUsXG4gIF0uam9pbignXFxuJylcbn1cblxuLy8gXHUyNTAwXHUyNTAwIEdyb3EgQVBJIGNhbGxlciBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBjYWxsR2VtaW5pKHsgYXBpS2V5LCBzY2hlbWEsIHVzZXJQcm9tcHQsIG1heFRva2VucyA9IDIwNDggfSkge1xuICBpZiAoIWFwaUtleSkge1xuICAgIGNvbnN0IGVyciA9IG5ldyBFcnJvcignTWlzc2luZyBUQVNLTFlfR1JPUV9BUElfS0VZIG9uIHRoZSBzZXJ2ZXIuJylcbiAgICBlcnIuc3RhdHVzQ29kZSA9IDUwM1xuICAgIHRocm93IGVyclxuICB9XG5cbiAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaChHUk9RX1VSTCwge1xuICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgIGhlYWRlcnM6IHtcbiAgICAgICdDb250ZW50LVR5cGUnOiAgJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgJ0F1dGhvcml6YXRpb24nOiBgQmVhcmVyICR7YXBpS2V5fWAsXG4gICAgfSxcbiAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICBtb2RlbDogICAgICAgICAgIGdldE1vZGVsKCksXG4gICAgICBtZXNzYWdlczogW1xuICAgICAgICB7IHJvbGU6ICdzeXN0ZW0nLCBjb250ZW50OiBTWVNURU1fUFJPTVBUIH0sXG4gICAgICAgIHsgcm9sZTogJ3VzZXInLCAgIGNvbnRlbnQ6IHVzZXJQcm9tcHQgICAgfSxcbiAgICAgIF0sXG4gICAgICByZXNwb25zZV9mb3JtYXQ6IHsgdHlwZTogJ2pzb25fb2JqZWN0JyB9LFxuICAgICAgdGVtcGVyYXR1cmU6ICAgICAwLjcsXG4gICAgICBtYXhfdG9rZW5zOiAgICAgIG1heFRva2VucyxcbiAgICB9KSxcbiAgfSlcblxuICBjb25zdCBqc29uID0gYXdhaXQgcmVzcG9uc2UuanNvbigpLmNhdGNoKCgpID0+ICh7fSkpXG5cbiAgaWYgKCFyZXNwb25zZS5vaykge1xuICAgIGNvbnN0IG1zZyA9IGpzb24/LmVycm9yPy5tZXNzYWdlIHx8IGBHcm9xIGVycm9yICR7cmVzcG9uc2Uuc3RhdHVzfWBcbiAgICBjb25zdCBlcnIgPSBuZXcgRXJyb3IobXNnKVxuICAgIGVyci5zdGF0dXNDb2RlID0gcmVzcG9uc2Uuc3RhdHVzXG4gICAgdGhyb3cgZXJyXG4gIH1cblxuICBjb25zdCB0ZXh0ID0ganNvbj8uY2hvaWNlcz8uWzBdPy5tZXNzYWdlPy5jb250ZW50XG4gIGlmICghdGV4dCkgdGhyb3cgbmV3IEVycm9yKCdHcm9xIHJldHVybmVkIGFuIGVtcHR5IHJlc3BvbnNlLicpXG5cbiAgcmV0dXJuIEpTT04ucGFyc2UodGV4dClcbn1cblxuLy8gXHUyNTAwXHUyNTAwIFNoYXJlZCBKU09OIHJlc3BvbnNlIGhlbHBlciBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbmV4cG9ydCBmdW5jdGlvbiBzZW5kSnNvbihyZXMsIHN0YXR1c0NvZGUsIHBheWxvYWQpIHtcbiAgcmVzLnN0YXR1c0NvZGUgPSBzdGF0dXNDb2RlXG4gIHJlcy5zZXRIZWFkZXIoJ0NvbnRlbnQtVHlwZScsICdhcHBsaWNhdGlvbi9qc29uOyBjaGFyc2V0PXV0Zi04JylcbiAgcmVzLnNldEhlYWRlcignQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luJywgJyonKVxuICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHBheWxvYWQpKVxufVxuXG4vLyBcdTI1MDBcdTI1MDAgUmVhZCByYXcgSlNPTiBib2R5IChOb2RlIEluY29taW5nTWVzc2FnZSkgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcmVhZEpzb25Cb2R5KHJlcSkge1xuICBjb25zdCBjaHVua3MgPSBbXVxuICBmb3IgYXdhaXQgKGNvbnN0IGNodW5rIG9mIHJlcSkgY2h1bmtzLnB1c2goY2h1bmspXG4gIGNvbnN0IHJhdyA9IEJ1ZmZlci5jb25jYXQoY2h1bmtzKS50b1N0cmluZygndXRmOCcpLnRyaW0oKVxuICByZXR1cm4gcmF3ID8gSlNPTi5wYXJzZShyYXcpIDoge31cbn1cbiIsICJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiL3Nlc3Npb25zL3BlbnNpdmUtc3dlZXQtcGFzdGV1ci9tbnQvUGVyc29uYWwgVGFzayBNYW5hZ2VyIENoYXRHUFQgY29weS9zZXJ2ZXJcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9zZXNzaW9ucy9wZW5zaXZlLXN3ZWV0LXBhc3RldXIvbW50L1BlcnNvbmFsIFRhc2sgTWFuYWdlciBDaGF0R1BUIGNvcHkvc2VydmVyL3Rhc2tseUFpU2VydmVyLmpzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9zZXNzaW9ucy9wZW5zaXZlLXN3ZWV0LXBhc3RldXIvbW50L1BlcnNvbmFsJTIwVGFzayUyME1hbmFnZXIlMjBDaGF0R1BUJTIwY29weS9zZXJ2ZXIvdGFza2x5QWlTZXJ2ZXIuanNcIjsvLyBcdTI1MDBcdTI1MDAgVGFza2x5IEFJIFx1MjAxNCBWaXRlIGRldi1zZXJ2ZXIgcGx1Z2luIChHcm9xIGxsYW1hLTMuMy03MGItdmVyc2F0aWxlKSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbi8vIEhhbmRsZXMgL2FwaS9haS8qIHJvdXRlcyBkdXJpbmcgbG9jYWwgZGV2ZWxvcG1lbnQuXG4vLyBQcm9kdWN0aW9uIHVzZXMgdGhlIFZlcmNlbCBzZXJ2ZXJsZXNzIGZ1bmN0aW9ucyBpbiAvYXBpL2FpLy5cblxuaW1wb3J0IHtcbiAgY2FsbEdlbWluaSxcbiAgZ2VuZXJhdGVTY2hlbWEsIGNvbW1hbmRTY2hlbWEsXG4gIGJ1aWxkR2VuZXJhdGVQcm9tcHQsIGJ1aWxkUHJvamVjdFNlZWRQcm9tcHQsIGJ1aWxkQ29tbWFuZFByb21wdCxcbiAgc2VuZEpzb24sIHJlYWRKc29uQm9keSxcbiAgR0VNSU5JX01PREVMLFxufSBmcm9tICcuL2dlbWluaUhlbHBlcnMuanMnXG5cbmNvbnN0IEFJX1JPVVRFX1BSRUZJWCA9ICcvYXBpL2FpJ1xuXG5mdW5jdGlvbiBnZXRBcGlLZXkoKSB7XG4gIHJldHVybiBwcm9jZXNzLmVudi5UQVNLTFlfR1JPUV9BUElfS0VZIHx8ICcnXG59XG5cbmZ1bmN0aW9uIGF0dGFjaEFpTWlkZGxld2FyZShzZXJ2ZXIpIHtcbiAgc2VydmVyLm1pZGRsZXdhcmVzLnVzZShhc3luYyAocmVxLCByZXMsIG5leHQpID0+IHtcbiAgICAvLyBBbGxvdyBzdGF0dXMgY2hlY2sgdmlhIEdFVFxuICAgIGlmIChyZXEubWV0aG9kID09PSAnR0VUJyAmJiByZXEudXJsID09PSAnL2FwaS9haS9zdGF0dXMnKSB7XG4gICAgICBzZW5kSnNvbihyZXMsIDIwMCwgeyBvazogISFnZXRBcGlLZXkoKSwgbW9kZWw6IEdFTUlOSV9NT0RFTCB9KVxuICAgICAgcmV0dXJuXG4gICAgfVxuXG4gICAgaWYgKHJlcS5tZXRob2QgIT09ICdQT1NUJyB8fCAhcmVxLnVybD8uc3RhcnRzV2l0aChBSV9ST1VURV9QUkVGSVgpKSB7XG4gICAgICBuZXh0KClcbiAgICAgIHJldHVyblxuICAgIH1cblxuICAgIHRyeSB7XG4gICAgICBjb25zdCBib2R5ICAgPSBhd2FpdCByZWFkSnNvbkJvZHkocmVxKVxuICAgICAgY29uc3QgYXBpS2V5ID0gZ2V0QXBpS2V5KClcblxuICAgICAgLy8gXHUyNTAwXHUyNTAwIC9hcGkvYWkvZ2VuZXJhdGUgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4gICAgICBpZiAocmVxLnVybCA9PT0gJy9hcGkvYWkvZ2VuZXJhdGUnKSB7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGNhbGxHZW1pbmkoe1xuICAgICAgICAgIGFwaUtleSxcbiAgICAgICAgICBzY2hlbWE6ICAgICBnZW5lcmF0ZVNjaGVtYSxcbiAgICAgICAgICB1c2VyUHJvbXB0OiBidWlsZEdlbmVyYXRlUHJvbXB0KHtcbiAgICAgICAgICAgIHByb21wdDogICAgICAgICAgU3RyaW5nKGJvZHkucHJvbXB0IHx8ICcnKS50cmltKCksXG4gICAgICAgICAgICBleGlzdGluZ0NvbHVtbnM6IEFycmF5LmlzQXJyYXkoYm9keS5leGlzdGluZ0NvbHVtbnMpID8gYm9keS5leGlzdGluZ0NvbHVtbnMgOiBbXSxcbiAgICAgICAgICB9KSxcbiAgICAgICAgfSlcbiAgICAgICAgc2VuZEpzb24ocmVzLCAyMDAsIHsgLi4ucmVzdWx0LCBtb2RlbDogR0VNSU5JX01PREVMIH0pXG4gICAgICAgIHJldHVyblxuICAgICAgfVxuXG4gICAgICAvLyBcdTI1MDBcdTI1MDAgL2FwaS9haS9wcm9qZWN0LXNlZWQgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4gICAgICBpZiAocmVxLnVybCA9PT0gJy9hcGkvYWkvcHJvamVjdC1zZWVkJykge1xuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBjYWxsR2VtaW5pKHtcbiAgICAgICAgICBhcGlLZXksXG4gICAgICAgICAgc2NoZW1hOiAgICAgZ2VuZXJhdGVTY2hlbWEsXG4gICAgICAgICAgbWF4VG9rZW5zOiAgNDA5NixcbiAgICAgICAgICB1c2VyUHJvbXB0OiBidWlsZFByb2plY3RTZWVkUHJvbXB0KHtcbiAgICAgICAgICAgIHByb2plY3ROYW1lOiBTdHJpbmcoYm9keS5wcm9qZWN0TmFtZSB8fCAnJykudHJpbSgpLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246IFN0cmluZyhib2R5LmRlc2NyaXB0aW9uIHx8ICcnKS50cmltKCksXG4gICAgICAgICAgfSksXG4gICAgICAgIH0pXG4gICAgICAgIHNlbmRKc29uKHJlcywgMjAwLCB7IC4uLnJlc3VsdCwgbW9kZWw6IEdFTUlOSV9NT0RFTCB9KVxuICAgICAgICByZXR1cm5cbiAgICAgIH1cblxuICAgICAgLy8gXHUyNTAwXHUyNTAwIC9hcGkvYWkvY29tbWFuZCBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbiAgICAgIGlmIChyZXEudXJsID09PSAnL2FwaS9haS9jb21tYW5kJykge1xuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBjYWxsR2VtaW5pKHtcbiAgICAgICAgICBhcGlLZXksXG4gICAgICAgICAgc2NoZW1hOiAgICAgY29tbWFuZFNjaGVtYSxcbiAgICAgICAgICB1c2VyUHJvbXB0OiBidWlsZENvbW1hbmRQcm9tcHQoe1xuICAgICAgICAgICAgaW5wdXQ6ICAgU3RyaW5nKGJvZHkuaW5wdXQgfHwgJycpLnRyaW0oKSxcbiAgICAgICAgICAgIGNvbHVtbnM6IEFycmF5LmlzQXJyYXkoYm9keS5jb2x1bW5zKSA/IGJvZHkuY29sdW1ucyA6IFtdLFxuICAgICAgICAgICAgdGFza3M6ICAgQXJyYXkuaXNBcnJheShib2R5LnRhc2tzKSAgID8gYm9keS50YXNrcyAgIDogW10sXG4gICAgICAgICAgfSksXG4gICAgICAgIH0pXG4gICAgICAgIHNlbmRKc29uKHJlcywgMjAwLCB7IC4uLnJlc3VsdCwgbW9kZWw6IEdFTUlOSV9NT0RFTCB9KVxuICAgICAgICByZXR1cm5cbiAgICAgIH1cblxuICAgICAgLy8gXHUyNTAwXHUyNTAwIC9hcGkvYWkvc3RhdHVzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuICAgICAgaWYgKHJlcS51cmwgPT09ICcvYXBpL2FpL3N0YXR1cycpIHtcbiAgICAgICAgc2VuZEpzb24ocmVzLCAyMDAsIHsgb2s6ICEhYXBpS2V5LCBtb2RlbDogR0VNSU5JX01PREVMIH0pXG4gICAgICAgIHJldHVyblxuICAgICAgfVxuXG4gICAgICBuZXh0KClcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tUYXNrbHkgQUldJywgZXJyLm1lc3NhZ2UpXG4gICAgICBzZW5kSnNvbihyZXMsIGVyci5zdGF0dXNDb2RlIHx8IDUwMCwge1xuICAgICAgICBlcnJvcjogZXJyLm1lc3NhZ2UgfHwgJ1Rhc2tseSBBSSByZXF1ZXN0IGZhaWxlZC4nLFxuICAgICAgfSlcbiAgICB9XG4gIH0pXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVUYXNrbHlBaVBsdWdpbigpIHtcbiAgcmV0dXJuIHtcbiAgICBuYW1lOiAndGFza2x5LWFpLXNlcnZlcicsXG4gICAgY29uZmlndXJlU2VydmVyKHNlcnZlcikgICAgICAgIHsgYXR0YWNoQWlNaWRkbGV3YXJlKHNlcnZlcikgfSxcbiAgICBjb25maWd1cmVQcmV2aWV3U2VydmVyKHNlcnZlcikgeyBhdHRhY2hBaU1pZGRsZXdhcmUoc2VydmVyKSB9LFxuICB9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQTRZLFNBQVMsY0FBYyxlQUFlO0FBQ2xiLE9BQU8sV0FBVzs7O0FDR2xCLElBQU0sV0FBVztBQUVqQixTQUFTLFdBQVc7QUFDbEIsU0FBTyxRQUFRLElBQUkscUJBQXFCO0FBQzFDO0FBR08sSUFBTSxlQUFlO0FBR3JCLElBQU0sZ0JBQWdCO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFrQnRCLElBQU0saUJBQWlCLEVBQUUsTUFBTSxjQUFjO0FBQzdDLElBQU0sZ0JBQWlCLEVBQUUsTUFBTSxjQUFjO0FBR3BELElBQU0sMEJBQTBCO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBdUJoQyxJQUFNLHlCQUF5QjtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQWtCeEIsU0FBUyxhQUFhLElBQUksSUFBSTtBQUNuQyxTQUFPLGtCQUFrQixLQUFLLENBQUMsSUFBSSxJQUFJO0FBQ3pDO0FBRUEsU0FBUyxpQkFBaUIsVUFBVSxDQUFDLEdBQUc7QUFDdEMsU0FBTyxRQUFRLElBQUksQ0FBQyxHQUFHLE9BQU87QUFBQSxJQUM1QixPQUFhLE9BQU8sR0FBRyxTQUFTLFVBQVUsSUFBSSxDQUFDLEVBQUU7QUFBQSxJQUNqRCxPQUFhLGFBQWEsR0FBRyxLQUFLO0FBQUEsSUFD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
