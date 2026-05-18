import { callGemini, commandSchema, buildCommandPrompt, sendJson, readJsonBody, GEMINI_MODEL } from '../../server/geminiHelpers.js'

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { sendJson(res, 200, {}); return }
  if (req.method !== 'POST')    { sendJson(res, 405, { error: 'Method not allowed' }); return }

  try {
    const body   = await readJsonBody(req)
    const apiKey = process.env.TASKLY_GROQ_API_KEY || ''

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
  } catch (err) {
    console.error('[Taskly /api/ai/command]', err.message)
    sendJson(res, err.statusCode || 500, { error: err.message || 'AI request failed.' })
  }
}
