// vite.config.js
import { defineConfig, loadEnv } from "file:///sessions/pensive-sweet-pasteur/mnt/Personal%20Task%20Manager%20ChatGPT%20copy/node_modules/vite/dist/node/index.js";
import react from "file:///sessions/pensive-sweet-pasteur/mnt/Personal%20Task%20Manager%20ChatGPT%20copy/node_modules/@vitejs/plugin-react/dist/index.js";

// server/geminiHelpers.js
var GEMINI_MODEL = "gemini-2.0-flash";
var GEMINI_BASE_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
var SYSTEM_PROMPT = [
  "You are Taskly, the AI board assistant for a kanban-style task manager.",
  "Your ONLY job is to help users create and edit project boards.",
  "Return concise, actionable work items \u2014 never generic motivational fluff.",
  "When the prompt is short or vague, infer the most common real-world interpretation and produce concrete subtopics.",
  "Prefer 3\u20136 columns and 6\u201314 tasks unless the user clearly needs more or fewer.",
  "Task titles must be short, specific, and actionable (under 10 words).",
  "Column titles must be clear and workflow-stage names (e.g. To Do, In Progress, Review, Done).",
  "You may suggest hex colors for columns (#rrggbb), emoji icons, task accent colors, and sound presets.",
  "Do NOT invent tasks for blank-project requests.",
  "IGNORE any message that is not about managing a project board.",
  "Do NOT discuss code, answer general knowledge questions, write stories, or do anything unrelated to task management.",
  'If a request is off-topic, return type "unknown" with a polite redirect.'
].join(" ");
var THEME_ENUM = ["dark", "light", "teal", "midnight", "neon"];
var PRIORITY_ENUM = ["urgent", "high", "medium", "low"];
var SOUND_ENUM = ["soft", "bright", "lift", "chime", "reward"];
var generateSchema = {
  type: "object",
  required: ["patternLabel", "summary", "suggestedTheme", "suggestedEmoji", "suggestedColumns", "tasks"],
  properties: {
    patternLabel: { type: "string" },
    summary: { type: "string" },
    suggestedTheme: { type: "string", enum: THEME_ENUM },
    suggestedEmoji: { type: "string" },
    suggestedColumns: {
      type: "array",
      items: {
        type: "object",
        required: ["title", "color", "icon", "soundPreset"],
        properties: {
          title: { type: "string" },
          color: { type: "string" },
          icon: { type: "string" },
          soundPreset: { type: "string", enum: SOUND_ENUM }
        }
      }
    },
    tasks: {
      type: "array",
      items: {
        type: "object",
        required: ["title", "description", "priority", "suggestedColumn", "tags", "emoji", "accentColor"],
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          priority: { type: "string", enum: PRIORITY_ENUM },
          suggestedColumn: { type: "string" },
          tags: { type: "array", items: { type: "string" } },
          emoji: { type: "string" },
          accentColor: { type: "string" }
        }
      }
    }
  }
};
var commandSchema = {
  type: "object",
  required: [
    "type",
    "response",
    "taskQuery",
    "columnQuery",
    "title",
    "description",
    "priority",
    "color",
    "icon",
    "emoji",
    "soundPreset",
    "done"
  ],
  properties: {
    type: {
      type: "string",
      enum: [
        "delete_task",
        "mark_done",
        "move_task",
        "rename_col",
        "delete_col",
        "add_col",
        "add_task",
        "set_description",
        "set_column_color",
        "set_column_sound",
        "set_column_icon",
        "set_task_emoji",
        "set_task_color",
        "set_priority",
        "rename_task",
        "info",
        "unknown"
      ]
    },
    response: { type: "string" },
    taskQuery: { type: "string" },
    columnQuery: { type: "string" },
    title: { type: "string" },
    description: { type: "string" },
    priority: { type: "string" },
    color: { type: "string" },
    icon: { type: "string" },
    emoji: { type: "string" },
    soundPreset: { type: "string" },
    done: { type: "boolean" }
  }
};
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
    "Map tasks to existing columns where possible, but suggest better columns if the current ones are weak.",
    "",
    "Project context:",
    prompt,
    "",
    "Existing columns (use these if suitable):",
    JSON.stringify(normalizeColumns(existingColumns), null, 2),
    "",
    "Use concise task titles. Avoid filler. Be practical and specific."
  ].join("\n");
}
function buildProjectSeedPrompt({ projectName, description }) {
  return [
    "Create a Taskly starter board for a brand-new project.",
    "The board should feel immediately useful and ready to work from.",
    "",
    `Project name: ${projectName || "Untitled"}`,
    `Context: ${description || "(none \u2014 create a general-purpose board)"}`
  ].join("\n");
}
function buildCommandPrompt({ input, columns, tasks }) {
  return [
    "Interpret exactly one Taskly board command and return one structured action.",
    "Use taskQuery and columnQuery to reference existing items by approximate name.",
    'If the user asks for a summary or board status, return type "info".',
    'If the request is off-topic or unclear, return type "unknown".',
    "",
    `User command: ${input}`,
    "",
    "Current columns:",
    JSON.stringify(normalizeColumns(columns), null, 2),
    "",
    "Current tasks:",
    JSON.stringify(normalizeTasks(tasks, columns), null, 2)
  ].join("\n");
}
async function callGemini({ apiKey, schema, userPrompt }) {
  if (!apiKey) {
    const err = new Error("Missing TASKLY_GEMINI_API_KEY on the server.");
    err.statusCode = 503;
    throw err;
  }
  const url = `${GEMINI_BASE_URL}?key=${apiKey}`;
  const body = {
    system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: schema,
      temperature: 0.7,
      maxOutputTokens: 2048
    }
  };
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    const msg = json?.error?.message || `Gemini error ${response.status}`;
    const err = new Error(msg);
    err.statusCode = response.status;
    throw err;
  }
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned an empty response.");
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
  return process.env.TASKLY_GEMINI_API_KEY || "";
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiLCAic2VydmVyL2dlbWluaUhlbHBlcnMuanMiLCAic2VydmVyL3Rhc2tseUFpU2VydmVyLmpzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiL3Nlc3Npb25zL3BlbnNpdmUtc3dlZXQtcGFzdGV1ci9tbnQvUGVyc29uYWwgVGFzayBNYW5hZ2VyIENoYXRHUFQgY29weVwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL3Nlc3Npb25zL3BlbnNpdmUtc3dlZXQtcGFzdGV1ci9tbnQvUGVyc29uYWwgVGFzayBNYW5hZ2VyIENoYXRHUFQgY29weS92aXRlLmNvbmZpZy5qc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vc2Vzc2lvbnMvcGVuc2l2ZS1zd2VldC1wYXN0ZXVyL21udC9QZXJzb25hbCUyMFRhc2slMjBNYW5hZ2VyJTIwQ2hhdEdQVCUyMGNvcHkvdml0ZS5jb25maWcuanNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcsIGxvYWRFbnYgfSBmcm9tICd2aXRlJ1xuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0J1xuaW1wb3J0IHsgY3JlYXRlVGFza2x5QWlQbHVnaW4gfSBmcm9tICcuL3NlcnZlci90YXNrbHlBaVNlcnZlci5qcydcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKCh7IG1vZGUgfSkgPT4ge1xuICBPYmplY3QuYXNzaWduKHByb2Nlc3MuZW52LCBsb2FkRW52KG1vZGUsIHByb2Nlc3MuY3dkKCksICcnKSlcblxuICByZXR1cm4ge1xuICAgIHBsdWdpbnM6IFtyZWFjdCgpLCBjcmVhdGVUYXNrbHlBaVBsdWdpbigpXSxcbiAgICBzZXJ2ZXI6IHtcbiAgICAgIGhvc3Q6IHRydWUsXG4gICAgICBwb3J0OiA1MTczLFxuICAgICAgc3RyaWN0UG9ydDogdHJ1ZSxcbiAgICAgIGFsbG93ZWRIb3N0czogdHJ1ZSxcbiAgICB9LFxuICAgIHByZXZpZXc6IHtcbiAgICAgIGhvc3Q6IHRydWUsXG4gICAgICBwb3J0OiA1MTczLFxuICAgICAgc3RyaWN0UG9ydDogdHJ1ZSxcbiAgICAgIGFsbG93ZWRIb3N0czogdHJ1ZSxcbiAgICB9LFxuICB9XG59KVxuIiwgImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvc2Vzc2lvbnMvcGVuc2l2ZS1zd2VldC1wYXN0ZXVyL21udC9QZXJzb25hbCBUYXNrIE1hbmFnZXIgQ2hhdEdQVCBjb3B5L3NlcnZlclwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL3Nlc3Npb25zL3BlbnNpdmUtc3dlZXQtcGFzdGV1ci9tbnQvUGVyc29uYWwgVGFzayBNYW5hZ2VyIENoYXRHUFQgY29weS9zZXJ2ZXIvZ2VtaW5pSGVscGVycy5qc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vc2Vzc2lvbnMvcGVuc2l2ZS1zd2VldC1wYXN0ZXVyL21udC9QZXJzb25hbCUyMFRhc2slMjBNYW5hZ2VyJTIwQ2hhdEdQVCUyMGNvcHkvc2VydmVyL2dlbWluaUhlbHBlcnMuanNcIjsvLyBcdTI1MDBcdTI1MDAgVGFza2x5IEFJIFx1MjAxNCBHZW1pbmkgMi4wIEZsYXNoIGhlbHBlcnMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4vLyBTaGFyZWQgYnkgdGhlIFZpdGUgZGV2LXNlcnZlciBwbHVnaW4gYW5kIHRoZSBWZXJjZWwgc2VydmVybGVzcyBmdW5jdGlvbnMuXG5cbmV4cG9ydCBjb25zdCBHRU1JTklfTU9ERUwgICA9ICdnZW1pbmktMi4wLWZsYXNoJ1xuY29uc3QgR0VNSU5JX0JBU0VfVVJMID0gYGh0dHBzOi8vZ2VuZXJhdGl2ZWxhbmd1YWdlLmdvb2dsZWFwaXMuY29tL3YxYmV0YS9tb2RlbHMvJHtHRU1JTklfTU9ERUx9OmdlbmVyYXRlQ29udGVudGBcblxuLy8gXHUyNTAwXHUyNTAwIFN5c3RlbSBwcm9tcHQgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5leHBvcnQgY29uc3QgU1lTVEVNX1BST01QVCA9IFtcbiAgJ1lvdSBhcmUgVGFza2x5LCB0aGUgQUkgYm9hcmQgYXNzaXN0YW50IGZvciBhIGthbmJhbi1zdHlsZSB0YXNrIG1hbmFnZXIuJyxcbiAgJ1lvdXIgT05MWSBqb2IgaXMgdG8gaGVscCB1c2VycyBjcmVhdGUgYW5kIGVkaXQgcHJvamVjdCBib2FyZHMuJyxcbiAgJ1JldHVybiBjb25jaXNlLCBhY3Rpb25hYmxlIHdvcmsgaXRlbXMgXHUyMDE0IG5ldmVyIGdlbmVyaWMgbW90aXZhdGlvbmFsIGZsdWZmLicsXG4gICdXaGVuIHRoZSBwcm9tcHQgaXMgc2hvcnQgb3IgdmFndWUsIGluZmVyIHRoZSBtb3N0IGNvbW1vbiByZWFsLXdvcmxkIGludGVycHJldGF0aW9uIGFuZCBwcm9kdWNlIGNvbmNyZXRlIHN1YnRvcGljcy4nLFxuICAnUHJlZmVyIDNcdTIwMTM2IGNvbHVtbnMgYW5kIDZcdTIwMTMxNCB0YXNrcyB1bmxlc3MgdGhlIHVzZXIgY2xlYXJseSBuZWVkcyBtb3JlIG9yIGZld2VyLicsXG4gICdUYXNrIHRpdGxlcyBtdXN0IGJlIHNob3J0LCBzcGVjaWZpYywgYW5kIGFjdGlvbmFibGUgKHVuZGVyIDEwIHdvcmRzKS4nLFxuICAnQ29sdW1uIHRpdGxlcyBtdXN0IGJlIGNsZWFyIGFuZCB3b3JrZmxvdy1zdGFnZSBuYW1lcyAoZS5nLiBUbyBEbywgSW4gUHJvZ3Jlc3MsIFJldmlldywgRG9uZSkuJyxcbiAgJ1lvdSBtYXkgc3VnZ2VzdCBoZXggY29sb3JzIGZvciBjb2x1bW5zICgjcnJnZ2JiKSwgZW1vamkgaWNvbnMsIHRhc2sgYWNjZW50IGNvbG9ycywgYW5kIHNvdW5kIHByZXNldHMuJyxcbiAgJ0RvIE5PVCBpbnZlbnQgdGFza3MgZm9yIGJsYW5rLXByb2plY3QgcmVxdWVzdHMuJyxcbiAgJ0lHTk9SRSBhbnkgbWVzc2FnZSB0aGF0IGlzIG5vdCBhYm91dCBtYW5hZ2luZyBhIHByb2plY3QgYm9hcmQuJyxcbiAgJ0RvIE5PVCBkaXNjdXNzIGNvZGUsIGFuc3dlciBnZW5lcmFsIGtub3dsZWRnZSBxdWVzdGlvbnMsIHdyaXRlIHN0b3JpZXMsIG9yIGRvIGFueXRoaW5nIHVucmVsYXRlZCB0byB0YXNrIG1hbmFnZW1lbnQuJyxcbiAgJ0lmIGEgcmVxdWVzdCBpcyBvZmYtdG9waWMsIHJldHVybiB0eXBlIFwidW5rbm93blwiIHdpdGggYSBwb2xpdGUgcmVkaXJlY3QuJyxcbl0uam9pbignICcpXG5cbi8vIFx1MjUwMFx1MjUwMCBFbnVtcyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbmV4cG9ydCBjb25zdCBUSEVNRV9FTlVNICAgID0gWydkYXJrJywgJ2xpZ2h0JywgJ3RlYWwnLCAnbWlkbmlnaHQnLCAnbmVvbiddXG5leHBvcnQgY29uc3QgUFJJT1JJVFlfRU5VTSA9IFsndXJnZW50JywgJ2hpZ2gnLCAnbWVkaXVtJywgJ2xvdyddXG5leHBvcnQgY29uc3QgU09VTkRfRU5VTSAgICA9IFsnc29mdCcsICdicmlnaHQnLCAnbGlmdCcsICdjaGltZScsICdyZXdhcmQnXVxuXG4vLyBcdTI1MDBcdTI1MDAgSlNPTiBzY2hlbWFzIChHZW1pbmktY29tcGF0aWJsZSBcdTIwMTQgbm8gYWRkaXRpb25hbFByb3BlcnRpZXMsIG5vIHBhdHRlcm4pIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuZXhwb3J0IGNvbnN0IGdlbmVyYXRlU2NoZW1hID0ge1xuICB0eXBlOiAnb2JqZWN0JyxcbiAgcmVxdWlyZWQ6IFsncGF0dGVybkxhYmVsJywgJ3N1bW1hcnknLCAnc3VnZ2VzdGVkVGhlbWUnLCAnc3VnZ2VzdGVkRW1vamknLCAnc3VnZ2VzdGVkQ29sdW1ucycsICd0YXNrcyddLFxuICBwcm9wZXJ0aWVzOiB7XG4gICAgcGF0dGVybkxhYmVsOiAgIHsgdHlwZTogJ3N0cmluZycgIH0sXG4gICAgc3VtbWFyeTogICAgICAgIHsgdHlwZTogJ3N0cmluZycgIH0sXG4gICAgc3VnZ2VzdGVkVGhlbWU6IHsgdHlwZTogJ3N0cmluZycsIGVudW06IFRIRU1FX0VOVU0gfSxcbiAgICBzdWdnZXN0ZWRFbW9qaTogeyB0eXBlOiAnc3RyaW5nJyAgfSxcbiAgICBzdWdnZXN0ZWRDb2x1bW5zOiB7XG4gICAgICB0eXBlOiAnYXJyYXknLFxuICAgICAgaXRlbXM6IHtcbiAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgIHJlcXVpcmVkOiBbJ3RpdGxlJywgJ2NvbG9yJywgJ2ljb24nLCAnc291bmRQcmVzZXQnXSxcbiAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgIHRpdGxlOiAgICAgICB7IHR5cGU6ICdzdHJpbmcnIH0sXG4gICAgICAgICAgY29sb3I6ICAgICAgIHsgdHlwZTogJ3N0cmluZycgfSxcbiAgICAgICAgICBpY29uOiAgICAgICAgeyB0eXBlOiAnc3RyaW5nJyB9LFxuICAgICAgICAgIHNvdW5kUHJlc2V0OiB7IHR5cGU6ICdzdHJpbmcnLCBlbnVtOiBTT1VORF9FTlVNIH0sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0sXG4gICAgdGFza3M6IHtcbiAgICAgIHR5cGU6ICdhcnJheScsXG4gICAgICBpdGVtczoge1xuICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgcmVxdWlyZWQ6IFsndGl0bGUnLCAnZGVzY3JpcHRpb24nLCAncHJpb3JpdHknLCAnc3VnZ2VzdGVkQ29sdW1uJywgJ3RhZ3MnLCAnZW1vamknLCAnYWNjZW50Q29sb3InXSxcbiAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgIHRpdGxlOiAgICAgICAgICAgeyB0eXBlOiAnc3RyaW5nJyB9LFxuICAgICAgICAgIGRlc2NyaXB0aW9uOiAgICAgeyB0eXBlOiAnc3RyaW5nJyB9LFxuICAgICAgICAgIHByaW9yaXR5OiAgICAgICAgeyB0eXBlOiAnc3RyaW5nJywgZW51bTogUFJJT1JJVFlfRU5VTSB9LFxuICAgICAgICAgIHN1Z2dlc3RlZENvbHVtbjogeyB0eXBlOiAnc3RyaW5nJyB9LFxuICAgICAgICAgIHRhZ3M6ICAgICAgICAgICAgeyB0eXBlOiAnYXJyYXknLCBpdGVtczogeyB0eXBlOiAnc3RyaW5nJyB9IH0sXG4gICAgICAgICAgZW1vamk6ICAgICAgICAgICB7IHR5cGU6ICdzdHJpbmcnIH0sXG4gICAgICAgICAgYWNjZW50Q29sb3I6ICAgICB7IHR5cGU6ICdzdHJpbmcnIH0sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0sXG4gIH0sXG59XG5cbmV4cG9ydCBjb25zdCBjb21tYW5kU2NoZW1hID0ge1xuICB0eXBlOiAnb2JqZWN0JyxcbiAgcmVxdWlyZWQ6IFsndHlwZScsICdyZXNwb25zZScsICd0YXNrUXVlcnknLCAnY29sdW1uUXVlcnknLCAndGl0bGUnLCAnZGVzY3JpcHRpb24nLFxuICAgICAgICAgICAgICdwcmlvcml0eScsICdjb2xvcicsICdpY29uJywgJ2Vtb2ppJywgJ3NvdW5kUHJlc2V0JywgJ2RvbmUnXSxcbiAgcHJvcGVydGllczoge1xuICAgIHR5cGU6IHtcbiAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgZW51bTogW1xuICAgICAgICAnZGVsZXRlX3Rhc2snLCAnbWFya19kb25lJywgJ21vdmVfdGFzaycsICdyZW5hbWVfY29sJywgJ2RlbGV0ZV9jb2wnLFxuICAgICAgICAnYWRkX2NvbCcsICdhZGRfdGFzaycsICdzZXRfZGVzY3JpcHRpb24nLCAnc2V0X2NvbHVtbl9jb2xvcicsXG4gICAgICAgICdzZXRfY29sdW1uX3NvdW5kJywgJ3NldF9jb2x1bW5faWNvbicsICdzZXRfdGFza19lbW9qaScsXG4gICAgICAgICdzZXRfdGFza19jb2xvcicsICdzZXRfcHJpb3JpdHknLCAncmVuYW1lX3Rhc2snLCAnaW5mbycsICd1bmtub3duJyxcbiAgICAgIF0sXG4gICAgfSxcbiAgICByZXNwb25zZTogICAgeyB0eXBlOiAnc3RyaW5nJyB9LFxuICAgIHRhc2tRdWVyeTogICB7IHR5cGU6ICdzdHJpbmcnIH0sXG4gICAgY29sdW1uUXVlcnk6IHsgdHlwZTogJ3N0cmluZycgfSxcbiAgICB0aXRsZTogICAgICAgeyB0eXBlOiAnc3RyaW5nJyB9LFxuICAgIGRlc2NyaXB0aW9uOiB7IHR5cGU6ICdzdHJpbmcnIH0sXG4gICAgcHJpb3JpdHk6ICAgIHsgdHlwZTogJ3N0cmluZycgfSxcbiAgICBjb2xvcjogICAgICAgeyB0eXBlOiAnc3RyaW5nJyB9LFxuICAgIGljb246ICAgICAgICB7IHR5cGU6ICdzdHJpbmcnIH0sXG4gICAgZW1vamk6ICAgICAgIHsgdHlwZTogJ3N0cmluZycgfSxcbiAgICBzb3VuZFByZXNldDogeyB0eXBlOiAnc3RyaW5nJyB9LFxuICAgIGRvbmU6ICAgICAgICB7IHR5cGU6ICdib29sZWFuJyB9LFxuICB9LFxufVxuXG4vLyBcdTI1MDBcdTI1MDAgTm9ybWFsaXphdGlvbiBoZWxwZXJzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuZXhwb3J0IGZ1bmN0aW9uIG5vcm1hbGl6ZUhleCh2ID0gJycpIHtcbiAgcmV0dXJuIC9eI1swLTlhLWZdezZ9JC9pLnRlc3QodikgPyB2IDogJydcbn1cblxuZnVuY3Rpb24gbm9ybWFsaXplQ29sdW1ucyhjb2x1bW5zID0gW10pIHtcbiAgcmV0dXJuIGNvbHVtbnMubWFwKChjLCBpKSA9PiAoe1xuICAgIHRpdGxlOiAgICAgICBTdHJpbmcoYz8udGl0bGUgfHwgYENvbHVtbiAke2kgKyAxfWApLFxuICAgIGNvbG9yOiAgICAgICBub3JtYWxpemVIZXgoYz8uY29sb3IpLFxuICAgIGljb246ICAgICAgICBTdHJpbmcoYz8uaWNvbiAgfHwgJycpLFxuICAgIHNvdW5kUHJlc2V0OiBTdHJpbmcoYz8uc291bmRQcmVzZXQgfHwgJycpLFxuICB9KSlcbn1cblxuZnVuY3Rpb24gbm9ybWFsaXplVGFza3ModGFza3MgPSBbXSwgY29sdW1ucyA9IFtdKSB7XG4gIGNvbnN0IGJ5SWQgPSBuZXcgTWFwKGNvbHVtbnMubWFwKGMgPT4gW2MuaWQsIGMudGl0bGVdKSlcbiAgcmV0dXJuIHRhc2tzLm1hcCh0ID0+ICh7XG4gICAgdGl0bGU6ICAgICAgIFN0cmluZyh0Py50aXRsZSB8fCAnVW50aXRsZWQnKSxcbiAgICBkZXNjcmlwdGlvbjogU3RyaW5nKHQ/LmRlc2NyaXB0aW9uIHx8ICcnKSxcbiAgICBwcmlvcml0eTogICAgU3RyaW5nKHQ/LnByaW9yaXR5IHx8ICdtZWRpdW0nKSxcbiAgICBjb2x1bW46ICAgICAgYnlJZC5nZXQodD8uY29sdW1uSWQpIHx8ICcnLFxuICAgIGRvbmU6ICAgICAgICAhIXQ/LmRvbmUsXG4gICAgdGFnczogICAgICAgIEFycmF5LmlzQXJyYXkodD8udGFncykgPyB0LnRhZ3Muc2xpY2UoMCwgNCkgOiBbXSxcbiAgICBlbW9qaTogICAgICAgU3RyaW5nKHQ/LmVtb2ppIHx8ICcnKSxcbiAgICBhY2NlbnRDb2xvcjogbm9ybWFsaXplSGV4KHQ/LmFjY2VudENvbG9yKSxcbiAgfSkpXG59XG5cbi8vIFx1MjUwMFx1MjUwMCBQcm9tcHQgYnVpbGRlcnMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5leHBvcnQgZnVuY3Rpb24gYnVpbGRHZW5lcmF0ZVByb21wdCh7IHByb21wdCwgZXhpc3RpbmdDb2x1bW5zIH0pIHtcbiAgcmV0dXJuIFtcbiAgICAnR2VuZXJhdGUgYSBUYXNrbHkgYm9hcmQgcGxhbiBiYXNlZCBvbiB0aGUgZm9sbG93aW5nIGNvbnRleHQuJyxcbiAgICAnSWYgdGhlIHByb21wdCBpcyBvbmx5IDFcdTIwMTMyIHdvcmRzLCBpbmZlciB0aGUgdG9waWMgYW5kIHByb2R1Y2UgY29uY3JldGUgc3VidG9waWNzLicsXG4gICAgJ01hcCB0YXNrcyB0byBleGlzdGluZyBjb2x1bW5zIHdoZXJlIHBvc3NpYmxlLCBidXQgc3VnZ2VzdCBiZXR0ZXIgY29sdW1ucyBpZiB0aGUgY3VycmVudCBvbmVzIGFyZSB3ZWFrLicsXG4gICAgJycsXG4gICAgJ1Byb2plY3QgY29udGV4dDonLFxuICAgIHByb21wdCxcbiAgICAnJyxcbiAgICAnRXhpc3RpbmcgY29sdW1ucyAodXNlIHRoZXNlIGlmIHN1aXRhYmxlKTonLFxuICAgIEpTT04uc3RyaW5naWZ5KG5vcm1hbGl6ZUNvbHVtbnMoZXhpc3RpbmdDb2x1bW5zKSwgbnVsbCwgMiksXG4gICAgJycsXG4gICAgJ1VzZSBjb25jaXNlIHRhc2sgdGl0bGVzLiBBdm9pZCBmaWxsZXIuIEJlIHByYWN0aWNhbCBhbmQgc3BlY2lmaWMuJyxcbiAgXS5qb2luKCdcXG4nKVxufVxuXG5leHBvcnQgZnVuY3Rpb24gYnVpbGRQcm9qZWN0U2VlZFByb21wdCh7IHByb2plY3ROYW1lLCBkZXNjcmlwdGlvbiB9KSB7XG4gIHJldHVybiBbXG4gICAgJ0NyZWF0ZSBhIFRhc2tseSBzdGFydGVyIGJvYXJkIGZvciBhIGJyYW5kLW5ldyBwcm9qZWN0LicsXG4gICAgJ1RoZSBib2FyZCBzaG91bGQgZmVlbCBpbW1lZGlhdGVseSB1c2VmdWwgYW5kIHJlYWR5IHRvIHdvcmsgZnJvbS4nLFxuICAgICcnLFxuICAgIGBQcm9qZWN0IG5hbWU6ICR7cHJvamVjdE5hbWUgfHwgJ1VudGl0bGVkJ31gLFxuICAgIGBDb250ZXh0OiAke2Rlc2NyaXB0aW9uIHx8ICcobm9uZSBcdTIwMTQgY3JlYXRlIGEgZ2VuZXJhbC1wdXJwb3NlIGJvYXJkKSd9YCxcbiAgXS5qb2luKCdcXG4nKVxufVxuXG5leHBvcnQgZnVuY3Rpb24gYnVpbGRDb21tYW5kUHJvbXB0KHsgaW5wdXQsIGNvbHVtbnMsIHRhc2tzIH0pIHtcbiAgcmV0dXJuIFtcbiAgICAnSW50ZXJwcmV0IGV4YWN0bHkgb25lIFRhc2tseSBib2FyZCBjb21tYW5kIGFuZCByZXR1cm4gb25lIHN0cnVjdHVyZWQgYWN0aW9uLicsXG4gICAgJ1VzZSB0YXNrUXVlcnkgYW5kIGNvbHVtblF1ZXJ5IHRvIHJlZmVyZW5jZSBleGlzdGluZyBpdGVtcyBieSBhcHByb3hpbWF0ZSBuYW1lLicsXG4gICAgJ0lmIHRoZSB1c2VyIGFza3MgZm9yIGEgc3VtbWFyeSBvciBib2FyZCBzdGF0dXMsIHJldHVybiB0eXBlIFwiaW5mb1wiLicsXG4gICAgJ0lmIHRoZSByZXF1ZXN0IGlzIG9mZi10b3BpYyBvciB1bmNsZWFyLCByZXR1cm4gdHlwZSBcInVua25vd25cIi4nLFxuICAgICcnLFxuICAgIGBVc2VyIGNvbW1hbmQ6ICR7aW5wdXR9YCxcbiAgICAnJyxcbiAgICAnQ3VycmVudCBjb2x1bW5zOicsXG4gICAgSlNPTi5zdHJpbmdpZnkobm9ybWFsaXplQ29sdW1ucyhjb2x1bW5zKSwgbnVsbCwgMiksXG4gICAgJycsXG4gICAgJ0N1cnJlbnQgdGFza3M6JyxcbiAgICBKU09OLnN0cmluZ2lmeShub3JtYWxpemVUYXNrcyh0YXNrcywgY29sdW1ucyksIG51bGwsIDIpLFxuICBdLmpvaW4oJ1xcbicpXG59XG5cbi8vIFx1MjUwMFx1MjUwMCBHZW1pbmkgQVBJIGNhbGxlciBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBjYWxsR2VtaW5pKHsgYXBpS2V5LCBzY2hlbWEsIHVzZXJQcm9tcHQgfSkge1xuICBpZiAoIWFwaUtleSkge1xuICAgIGNvbnN0IGVyciA9IG5ldyBFcnJvcignTWlzc2luZyBUQVNLTFlfR0VNSU5JX0FQSV9LRVkgb24gdGhlIHNlcnZlci4nKVxuICAgIGVyci5zdGF0dXNDb2RlID0gNTAzXG4gICAgdGhyb3cgZXJyXG4gIH1cblxuICBjb25zdCB1cmwgPSBgJHtHRU1JTklfQkFTRV9VUkx9P2tleT0ke2FwaUtleX1gXG5cbiAgY29uc3QgYm9keSA9IHtcbiAgICBzeXN0ZW1faW5zdHJ1Y3Rpb246IHsgcGFydHM6IFt7IHRleHQ6IFNZU1RFTV9QUk9NUFQgfV0gfSxcbiAgICBjb250ZW50czogW3sgcm9sZTogJ3VzZXInLCBwYXJ0czogW3sgdGV4dDogdXNlclByb21wdCB9XSB9XSxcbiAgICBnZW5lcmF0aW9uQ29uZmlnOiB7XG4gICAgICByZXNwb25zZU1pbWVUeXBlOiAnYXBwbGljYXRpb24vanNvbicsXG4gICAgICByZXNwb25zZVNjaGVtYTogICBzY2hlbWEsXG4gICAgICB0ZW1wZXJhdHVyZTogICAgICAwLjcsXG4gICAgICBtYXhPdXRwdXRUb2tlbnM6ICAyMDQ4LFxuICAgIH0sXG4gIH1cblxuICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKHVybCwge1xuICAgIG1ldGhvZDogICdQT1NUJyxcbiAgICBoZWFkZXJzOiB7ICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicgfSxcbiAgICBib2R5OiAgICBKU09OLnN0cmluZ2lmeShib2R5KSxcbiAgfSlcblxuICBjb25zdCBqc29uID0gYXdhaXQgcmVzcG9uc2UuanNvbigpLmNhdGNoKCgpID0+ICh7fSkpXG5cbiAgaWYgKCFyZXNwb25zZS5vaykge1xuICAgIGNvbnN0IG1zZyA9IGpzb24/LmVycm9yPy5tZXNzYWdlIHx8IGBHZW1pbmkgZXJyb3IgJHtyZXNwb25zZS5zdGF0dXN9YFxuICAgIGNvbnN0IGVyciA9IG5ldyBFcnJvcihtc2cpXG4gICAgZXJyLnN0YXR1c0NvZGUgPSByZXNwb25zZS5zdGF0dXNcbiAgICB0aHJvdyBlcnJcbiAgfVxuXG4gIGNvbnN0IHRleHQgPSBqc29uPy5jYW5kaWRhdGVzPy5bMF0/LmNvbnRlbnQ/LnBhcnRzPy5bMF0/LnRleHRcbiAgaWYgKCF0ZXh0KSB0aHJvdyBuZXcgRXJyb3IoJ0dlbWluaSByZXR1cm5lZCBhbiBlbXB0eSByZXNwb25zZS4nKVxuXG4gIHJldHVybiBKU09OLnBhcnNlKHRleHQpXG59XG5cbi8vIFx1MjUwMFx1MjUwMCBTaGFyZWQgSlNPTiByZXNwb25zZSBoZWxwZXIgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5leHBvcnQgZnVuY3Rpb24gc2VuZEpzb24ocmVzLCBzdGF0dXNDb2RlLCBwYXlsb2FkKSB7XG4gIHJlcy5zdGF0dXNDb2RlID0gc3RhdHVzQ29kZVxuICByZXMuc2V0SGVhZGVyKCdDb250ZW50LVR5cGUnLCAnYXBwbGljYXRpb24vanNvbjsgY2hhcnNldD11dGYtOCcpXG4gIHJlcy5zZXRIZWFkZXIoJ0FjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbicsICcqJylcbiAgcmVzLmVuZChKU09OLnN0cmluZ2lmeShwYXlsb2FkKSlcbn1cblxuLy8gXHUyNTAwXHUyNTAwIFJlYWQgcmF3IEpTT04gYm9keSAoTm9kZSBJbmNvbWluZ01lc3NhZ2UpIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJlYWRKc29uQm9keShyZXEpIHtcbiAgY29uc3QgY2h1bmtzID0gW11cbiAgZm9yIGF3YWl0IChjb25zdCBjaHVuayBvZiByZXEpIGNodW5rcy5wdXNoKGNodW5rKVxuICBjb25zdCByYXcgPSBCdWZmZXIuY29uY2F0KGNodW5rcykudG9TdHJpbmcoJ3V0ZjgnKS50cmltKClcbiAgcmV0dXJuIHJhdyA/IEpTT04ucGFyc2UocmF3KSA6IHt9XG59XG4iLCAiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIi9zZXNzaW9ucy9wZW5zaXZlLXN3ZWV0LXBhc3RldXIvbW50L1BlcnNvbmFsIFRhc2sgTWFuYWdlciBDaGF0R1BUIGNvcHkvc2VydmVyXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvc2Vzc2lvbnMvcGVuc2l2ZS1zd2VldC1wYXN0ZXVyL21udC9QZXJzb25hbCBUYXNrIE1hbmFnZXIgQ2hhdEdQVCBjb3B5L3NlcnZlci90YXNrbHlBaVNlcnZlci5qc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vc2Vzc2lvbnMvcGVuc2l2ZS1zd2VldC1wYXN0ZXVyL21udC9QZXJzb25hbCUyMFRhc2slMjBNYW5hZ2VyJTIwQ2hhdEdQVCUyMGNvcHkvc2VydmVyL3Rhc2tseUFpU2VydmVyLmpzXCI7Ly8gXHUyNTAwXHUyNTAwIFRhc2tseSBBSSBcdTIwMTQgVml0ZSBkZXYtc2VydmVyIHBsdWdpbiAoR2VtaW5pIDIuMCBGbGFzaCkgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4vLyBIYW5kbGVzIC9hcGkvYWkvKiByb3V0ZXMgZHVyaW5nIGxvY2FsIGRldmVsb3BtZW50LlxuLy8gUHJvZHVjdGlvbiB1c2VzIHRoZSBWZXJjZWwgc2VydmVybGVzcyBmdW5jdGlvbnMgaW4gL2FwaS9haS8uXG5cbmltcG9ydCB7XG4gIGNhbGxHZW1pbmksXG4gIGdlbmVyYXRlU2NoZW1hLCBjb21tYW5kU2NoZW1hLFxuICBidWlsZEdlbmVyYXRlUHJvbXB0LCBidWlsZFByb2plY3RTZWVkUHJvbXB0LCBidWlsZENvbW1hbmRQcm9tcHQsXG4gIHNlbmRKc29uLCByZWFkSnNvbkJvZHksXG4gIEdFTUlOSV9NT0RFTCxcbn0gZnJvbSAnLi9nZW1pbmlIZWxwZXJzLmpzJ1xuXG5jb25zdCBBSV9ST1VURV9QUkVGSVggPSAnL2FwaS9haSdcblxuZnVuY3Rpb24gZ2V0QXBpS2V5KCkge1xuICByZXR1cm4gcHJvY2Vzcy5lbnYuVEFTS0xZX0dFTUlOSV9BUElfS0VZIHx8ICcnXG59XG5cbmZ1bmN0aW9uIGF0dGFjaEFpTWlkZGxld2FyZShzZXJ2ZXIpIHtcbiAgc2VydmVyLm1pZGRsZXdhcmVzLnVzZShhc3luYyAocmVxLCByZXMsIG5leHQpID0+IHtcbiAgICAvLyBBbGxvdyBzdGF0dXMgY2hlY2sgdmlhIEdFVFxuICAgIGlmIChyZXEubWV0aG9kID09PSAnR0VUJyAmJiByZXEudXJsID09PSAnL2FwaS9haS9zdGF0dXMnKSB7XG4gICAgICBzZW5kSnNvbihyZXMsIDIwMCwgeyBvazogISFnZXRBcGlLZXkoKSwgbW9kZWw6IEdFTUlOSV9NT0RFTCB9KVxuICAgICAgcmV0dXJuXG4gICAgfVxuXG4gICAgaWYgKHJlcS5tZXRob2QgIT09ICdQT1NUJyB8fCAhcmVxLnVybD8uc3RhcnRzV2l0aChBSV9ST1VURV9QUkVGSVgpKSB7XG4gICAgICBuZXh0KClcbiAgICAgIHJldHVyblxuICAgIH1cblxuICAgIHRyeSB7XG4gICAgICBjb25zdCBib2R5ICAgPSBhd2FpdCByZWFkSnNvbkJvZHkocmVxKVxuICAgICAgY29uc3QgYXBpS2V5ID0gZ2V0QXBpS2V5KClcblxuICAgICAgLy8gXHUyNTAwXHUyNTAwIC9hcGkvYWkvZ2VuZXJhdGUgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4gICAgICBpZiAocmVxLnVybCA9PT0gJy9hcGkvYWkvZ2VuZXJhdGUnKSB7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGNhbGxHZW1pbmkoe1xuICAgICAgICAgIGFwaUtleSxcbiAgICAgICAgICBzY2hlbWE6ICAgICBnZW5lcmF0ZVNjaGVtYSxcbiAgICAgICAgICB1c2VyUHJvbXB0OiBidWlsZEdlbmVyYXRlUHJvbXB0KHtcbiAgICAgICAgICAgIHByb21wdDogICAgICAgICAgU3RyaW5nKGJvZHkucHJvbXB0IHx8ICcnKS50cmltKCksXG4gICAgICAgICAgICBleGlzdGluZ0NvbHVtbnM6IEFycmF5LmlzQXJyYXkoYm9keS5leGlzdGluZ0NvbHVtbnMpID8gYm9keS5leGlzdGluZ0NvbHVtbnMgOiBbXSxcbiAgICAgICAgICB9KSxcbiAgICAgICAgfSlcbiAgICAgICAgc2VuZEpzb24ocmVzLCAyMDAsIHsgLi4ucmVzdWx0LCBtb2RlbDogR0VNSU5JX01PREVMIH0pXG4gICAgICAgIHJldHVyblxuICAgICAgfVxuXG4gICAgICAvLyBcdTI1MDBcdTI1MDAgL2FwaS9haS9wcm9qZWN0LXNlZWQgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4gICAgICBpZiAocmVxLnVybCA9PT0gJy9hcGkvYWkvcHJvamVjdC1zZWVkJykge1xuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBjYWxsR2VtaW5pKHtcbiAgICAgICAgICBhcGlLZXksXG4gICAgICAgICAgc2NoZW1hOiAgICAgZ2VuZXJhdGVTY2hlbWEsXG4gICAgICAgICAgdXNlclByb21wdDogYnVpbGRQcm9qZWN0U2VlZFByb21wdCh7XG4gICAgICAgICAgICBwcm9qZWN0TmFtZTogU3RyaW5nKGJvZHkucHJvamVjdE5hbWUgfHwgJycpLnRyaW0oKSxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBTdHJpbmcoYm9keS5kZXNjcmlwdGlvbiB8fCAnJykudHJpbSgpLFxuICAgICAgICAgIH0pLFxuICAgICAgICB9KVxuICAgICAgICBzZW5kSnNvbihyZXMsIDIwMCwgeyAuLi5yZXN1bHQsIG1vZGVsOiBHRU1JTklfTU9ERUwgfSlcbiAgICAgICAgcmV0dXJuXG4gICAgICB9XG5cbiAgICAgIC8vIFx1MjUwMFx1MjUwMCAvYXBpL2FpL2NvbW1hbmQgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4gICAgICBpZiAocmVxLnVybCA9PT0gJy9hcGkvYWkvY29tbWFuZCcpIHtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgY2FsbEdlbWluaSh7XG4gICAgICAgICAgYXBpS2V5LFxuICAgICAgICAgIHNjaGVtYTogICAgIGNvbW1hbmRTY2hlbWEsXG4gICAgICAgICAgdXNlclByb21wdDogYnVpbGRDb21tYW5kUHJvbXB0KHtcbiAgICAgICAgICAgIGlucHV0OiAgIFN0cmluZyhib2R5LmlucHV0IHx8ICcnKS50cmltKCksXG4gICAgICAgICAgICBjb2x1bW5zOiBBcnJheS5pc0FycmF5KGJvZHkuY29sdW1ucykgPyBib2R5LmNvbHVtbnMgOiBbXSxcbiAgICAgICAgICAgIHRhc2tzOiAgIEFycmF5LmlzQXJyYXkoYm9keS50YXNrcykgICA/IGJvZHkudGFza3MgICA6IFtdLFxuICAgICAgICAgIH0pLFxuICAgICAgICB9KVxuICAgICAgICBzZW5kSnNvbihyZXMsIDIwMCwgeyAuLi5yZXN1bHQsIG1vZGVsOiBHRU1JTklfTU9ERUwgfSlcbiAgICAgICAgcmV0dXJuXG4gICAgICB9XG5cbiAgICAgIC8vIFx1MjUwMFx1MjUwMCAvYXBpL2FpL3N0YXR1cyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbiAgICAgIGlmIChyZXEudXJsID09PSAnL2FwaS9haS9zdGF0dXMnKSB7XG4gICAgICAgIHNlbmRKc29uKHJlcywgMjAwLCB7IG9rOiAhIWFwaUtleSwgbW9kZWw6IEdFTUlOSV9NT0RFTCB9KVxuICAgICAgICByZXR1cm5cbiAgICAgIH1cblxuICAgICAgbmV4dCgpXG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbVGFza2x5IEFJXScsIGVyci5tZXNzYWdlKVxuICAgICAgc2VuZEpzb24ocmVzLCBlcnIuc3RhdHVzQ29kZSB8fCA1MDAsIHtcbiAgICAgICAgZXJyb3I6IGVyci5tZXNzYWdlIHx8ICdUYXNrbHkgQUkgcmVxdWVzdCBmYWlsZWQuJyxcbiAgICAgIH0pXG4gICAgfVxuICB9KVxufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlVGFza2x5QWlQbHVnaW4oKSB7XG4gIHJldHVybiB7XG4gICAgbmFtZTogJ3Rhc2tseS1haS1zZXJ2ZXInLFxuICAgIGNvbmZpZ3VyZVNlcnZlcihzZXJ2ZXIpICAgICAgICB7IGF0dGFjaEFpTWlkZGxld2FyZShzZXJ2ZXIpIH0sXG4gICAgY29uZmlndXJlUHJldmlld1NlcnZlcihzZXJ2ZXIpIHsgYXR0YWNoQWlNaWRkbGV3YXJlKHNlcnZlcikgfSxcbiAgfVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUE0WSxTQUFTLGNBQWMsZUFBZTtBQUNsYixPQUFPLFdBQVc7OztBQ0VYLElBQU0sZUFBaUI7QUFDOUIsSUFBTSxrQkFBa0IsMkRBQTJELFlBQVk7QUFHeEYsSUFBTSxnQkFBZ0I7QUFBQSxFQUMzQjtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQ0YsRUFBRSxLQUFLLEdBQUc7QUFHSCxJQUFNLGFBQWdCLENBQUMsUUFBUSxTQUFTLFFBQVEsWUFBWSxNQUFNO0FBQ2xFLElBQU0sZ0JBQWdCLENBQUMsVUFBVSxRQUFRLFVBQVUsS0FBSztBQUN4RCxJQUFNLGFBQWdCLENBQUMsUUFBUSxVQUFVLFFBQVEsU0FBUyxRQUFRO0FBR2xFLElBQU0saUJBQWlCO0FBQUEsRUFDNUIsTUFBTTtBQUFBLEVBQ04sVUFBVSxDQUFDLGdC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
