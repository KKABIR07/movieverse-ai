import { requireSession } from '@/lib/db/auth';
import { getGroqClient, GROQ_MODEL, AI_SYSTEM_PROMPT } from '@/lib/server/groq';
import { HttpError } from '@/lib/server/errors';
import { json, readJson, withHandler } from '@/lib/server/http';
import { aiRecommendSchema } from '@/lib/server/validation';

export const POST = withHandler('ai.recommend', async (req) => {
  await requireSession(req);
  const groq = getGroqClient();
  if (!groq) throw new HttpError(503, 'AI assistant is not configured.', { code: 'AI_NOT_CONFIGURED' });

  const { messages } = await readJson(req, aiRecommendSchema);

  let completion;
  try {
    completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      // Server owns the system prompt; clients can only send user/assistant turns.
      messages: [{ role: 'system', content: AI_SYSTEM_PROMPT }, ...messages],
      max_tokens: 512,
      // gpt-oss models reason before answering; keep it short so the 512-token budget goes to the reply.
      ...(GROQ_MODEL.startsWith('openai/gpt-oss') ? { reasoning_effort: 'low' as const } : {}),
      temperature: 0.75,
    });
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status === 429) {
      throw new HttpError(429, 'The AI assistant is busy. Please try again in a moment.', {
        code: 'AI_RATE_LIMITED',
        headers: { 'Retry-After': '20' },
        cause: err,
      });
    }
    throw new HttpError(502, 'The AI assistant is unavailable right now.', { code: 'AI_UPSTREAM', cause: err });
  }

  const reply = completion.choices[0]?.message?.content?.trim() || 'Sorry, I could not generate a response.';
  return json({ reply });
});
