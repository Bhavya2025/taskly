import { callGemini, generateSchema, buildGeneratePrompt, sendJson, readJsonBody, GEMINI_MODEL } from '../../server/geminiHelpers.js'

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { sendJson(res, 200, {}); return }
  if (req.method !== 'POST')    { sendJson(res, 405, { error: 'Method not allowed' }); return }

  try {
    const body   = await readJsonBody(req)
    const apiKey = process.env.TASKLY_GROQ_API_KEY || ''

    const result = await callGemini({
      apiKey,
      schema:     generateSchema,
      userPrompt: buildGeneratePrompt({
        prompt:          String(body.prompt || '').trim(),
        existingColumns: Array.isArray(body.existingColumns) ? body.existingColumns : [],
      }),
    })

    sendJson(res, 200, { ...result, model: GEMINI_MODEL })
  } catch (err) {
    console.error('[Taskly /api/ai/generate]', err.message)
    sendJson(res, err.statusCode || 500, { error: err.message || 'AI request failed.' })
  }
}
