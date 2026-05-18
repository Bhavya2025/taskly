// ── Taskly AI — Vite dev-server plugin (Groq llama-3.3-70b-versatile) ────────
// Handles /api/ai/* routes during local development.
// Production uses the Vercel serverless functions in /api/ai/.

import {
  callGemini,
  generateSchema, commandSchema,
  buildGeneratePrompt, buildProjectSeedPrompt, buildCommandPrompt,
  sendJson, readJsonBody,
  GEMINI_MODEL,
} from './geminiHelpers.js'

const AI_ROUTE_PREFIX = '/api/ai'

function getApiKey() {
  return process.env.TASKLY_GROQ_API_KEY || ''
}

function attachAiMiddleware(server) {
  server.middlewares.use(async (req, res, next) => {
    // Allow status check via GET
    if (req.method === 'GET' && req.url === '/api/ai/status') {
      sendJson(res, 200, { ok: !!getApiKey(), model: GEMINI_MODEL })
      return
    }

    if (req.method !== 'POST' || !req.url?.startsWith(AI_ROUTE_PREFIX)) {
      next()
      return
    }

    try {
      const body   = await readJsonBody(req)
      const apiKey = getApiKey()

      // ── /api/ai/generate ─────────────────────────────────────────────────
      if (req.url === '/api/ai/generate') {
        const result = await callGemini({
          apiKey,
          schema:     generateSchema,
          userPrompt: buildGeneratePrompt({
            prompt:          String(body.prompt || '').trim(),
            existingColumns: Array.isArray(body.existingColumns) ? body.existingColumns : [],
          }),
        })
        sendJson(res, 200, { ...result, model: GEMINI_MODEL })
        return
      }

      // ── /api/ai/project-seed ─────────────────────────────────────────────
      if (req.url === '/api/ai/project-seed') {
        const result = await callGemini({
          apiKey,
          schema:     generateSchema,
          maxTokens:  4096,
          userPrompt: buildProjectSeedPrompt({
            projectName: String(body.projectName || '').trim(),
            description: String(body.description || '').trim(),
          }),
        })
        sendJson(res, 200, { ...result, model: GEMINI_MODEL })
        return
      }

      // ── /api/ai/command ──────────────────────────────────────────────────
      if (req.url === '/api/ai/command') {
        const result = await callGemini({
          apiKey,
          schema:     commandSchema,
          userPrompt: buildCommandPrompt({
            input:   String(body.input || '').trim(),
            columns: Array.isArray(body.columns) ? body.columns : [],
            tasks:   Array.isArray(body.tasks)   ? body.tasks   : [],
          }),
        })
        sendJson(res, 200, { ...result, model: GEMINI_MODEL })
        return
      }

      // ── /api/ai/status ───────────────────────────────────────────────────
      if (req.url === '/api/ai/status') {
        sendJson(res, 200, { ok: !!apiKey, model: GEMINI_MODEL })
        return
      }

      next()
    } catch (err) {
      console.error('[Taskly AI]', err.message)
      sendJson(res, err.statusCode || 500, {
        error: err.message || 'Taskly AI request failed.',
      })
    }
  })
}

export function createTasklyAiPlugin() {
  return {
    name: 'taskly-ai-server',
    configureServer(server)        { attachAiMiddleware(server) },
    configurePreviewServer(server) { attachAiMiddleware(server) },
  }
}
