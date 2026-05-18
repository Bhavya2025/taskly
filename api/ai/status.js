import { sendJson, GEMINI_MODEL } from '../../server/geminiHelpers.js'

export default function handler(req, res) {
  sendJson(res, 200, {
    ok:    !!process.env.TASKLY_GROQ_API_KEY,
    model: GEMINI_MODEL,
  })
}
