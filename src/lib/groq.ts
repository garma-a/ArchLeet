import Groq from 'groq-sdk';
import { buildSystemPrompt, buildUserPrompt, type EvaluatorPromptInput } from './evaluator-prompt';
import type { EvaluatorResult } from './types';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const PRIMARY_MODEL   = 'llama-3.3-70b-versatile';
const FALLBACK_MODEL  = 'llama-3.1-8b-instant';

export async function evaluateSubmission(
  input: EvaluatorPromptInput,
  retryWithFallback = true
): Promise<EvaluatorResult> {
  const systemPrompt = buildSystemPrompt();
  const userPrompt   = buildUserPrompt(input);

  async function callModel(model: string): Promise<EvaluatorResult> {
    const completion = await groq.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt   },
      ],
      temperature:      0.1,   // Low temperature = consistent grading
      max_tokens:       512,
      response_format:  { type: 'json_object' },
    });

    const raw = completion.choices[0]?.message?.content ?? '{}';

    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error(`AI returned invalid JSON: ${raw.slice(0, 200)}`);
    }

    // Validate the shape
    if (typeof parsed.is_correct !== 'boolean') {
      throw new Error('AI response missing is_correct boolean');
    }
    if (typeof parsed.score !== 'number' || parsed.score < 0 || parsed.score > 100) {
      throw new Error('AI response has invalid score');
    }
    if (typeof parsed.feedback !== 'string') {
      throw new Error('AI response missing feedback string');
    }

    return {
      is_correct: parsed.is_correct,
      score:      Math.round(parsed.score),
      feedback:   parsed.feedback,
    };
  }

  try {
    return await callModel(PRIMARY_MODEL);
  } catch (error) {
    if (retryWithFallback) {
      console.warn('Primary model failed, trying fallback:', error);
      return await callModel(FALLBACK_MODEL);
    }
    throw error;
  }
}
