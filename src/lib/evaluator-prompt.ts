// ============================================================
// ARCHLEET — AI Evaluator Prompt Builder
// This prompt is NEVER sent to the client.
// It is only used server-side in the queue processor.
// ============================================================

export interface EvaluatorPromptInput {
  problemTitle:       string;
  problemDescription: string;
  problemFiles:       Array<{ filename: string; language: string; content: string }>;
  rubricText:         string;
  exampleCorrectAnswer?: string | null;
  userAnswer:         string;
  passingScore:       number;
}

export function buildSystemPrompt(): string {
  return `You are an expert software architect and engineering mentor. 
Your sole job is to evaluate student answers to code architecture challenges.

CRITICAL RULES:
1. You MUST respond with ONLY valid JSON. No preamble, no markdown, no explanation outside the JSON.
2. The JSON schema is EXACTLY: { "is_correct": boolean, "score": number, "feedback": string }
3. "score" is an integer from 0 to 100.
4. "is_correct" is true if and only if score >= PASSING_SCORE (provided in the user message).
5. "feedback" is a markdown string, 2–5 sentences. Be specific about what the student got right or wrong.
6. You MUST be strict. A student who identifies the wrong pattern or principle scores 0–30.
7. You MUST be fair. Correct answers do not need to match the rubric word-for-word. Credit unconventional but valid approaches.
8. If the student's answer is too vague (e.g., "use better OOP"), score it 10–20 and explain why.
9. Do NOT be lenient to compensate for the student's frustration. Your grading must be consistent.

GRADING RUBRIC SCALE:
- 0–20:  Student identified nothing meaningful or completely missed the point.
- 21–40: Student identified the general area (e.g., "this code is tightly coupled") but no specifics.
- 41–60: Student identified the correct principle/pattern but explained the fix incorrectly or incompletely.
- 61–69: Student was close but missed a key element of the solution (just below passing).
- 70–85: Student correctly identified the problem and proposed a valid fix. Passes.
- 86–100: Student correctly identified the problem, proposed an excellent fix, AND noted secondary issues.`;
}

export function buildUserPrompt(input: EvaluatorPromptInput): string {
  const filesSection = input.problemFiles
    .map(f => `### File: ${f.filename}\n\`\`\`${f.language}\n${f.content}\n\`\`\``)
    .join('\n\n');

  const exampleSection = input.exampleCorrectAnswer
    ? `\n\n## EXAMPLE OF A CORRECT ANSWER (for your reference only, not shown to student)\n${input.exampleCorrectAnswer}`
    : '';

  return `## PROBLEM TITLE
${input.problemTitle}

## PROBLEM DESCRIPTION
${input.problemDescription}

## THE BAD CODE FILES (what the student was given to analyze)
${filesSection}

## GRADING RUBRIC (HIDDEN from student — use this to evaluate)
${input.rubricText}
${exampleSection}

## STUDENT'S ANSWER
${input.userAnswer}

## PASSING SCORE THRESHOLD
A score of ${input.passingScore} or above = is_correct: true

## YOUR TASK
Evaluate the student's answer against the rubric. Respond ONLY with valid JSON matching this exact schema:
{"is_correct": boolean, "score": number, "feedback": string}`;
}
