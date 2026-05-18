import { callGemini, generateSchema, buildProjectSeedPrompt, sendJson, readJsonBody, GEMINI_MODEL } from '../../server/geminiHelpers.js'

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { sendJson(res, 200, {}); return }
  if (req.method !== 'POST')    { sendJson(res, 405, { error: 'Method not allowed' }); return }

  try {
    const body   = await readJsonBody(req)
    const apiKey = process.env.TASKLY_GROQ_API_KEY || ''

    // If no description, skip AI and return empty seed
    if (!String(body.description || '').trim()) {
      sendJson(res, 200, {
        patternLabel: '', summary: '', suggestedTheme: 'dark',
        suggestedEmoji: '📝', suggestedColumns: [], tasks: [], model: '',
      })
      return
    }

    const result = await callGemini({
      apiKey,
      schema:     generateSchema,
      maxTokens:  4096,
      userPrompt: buildProjectSeedPrompt({
        projectName: String(body.projectName || '').trim(),
        description: String(body.description  || '').trim(),
      }),
    })

    sendJson(res, 200, { ...result, model: GEMINI_MODEL })
  } catch (err) {
    console.error('[Taskly /api/ai/project-seed]', err.message)
    sendJson(res, err.statusCode || 500, { error: err.message || 'AI request failed.' })
  }
}
