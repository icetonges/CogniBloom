/**
 * RAGAS-inspired RAG evaluation metrics.
 *
 * Computes lightweight LLM-judged scores after each tutor exchange:
 *   faithfulness     — are the response claims grounded in the retrieved context?
 *   answerRelevancy  — does the response actually address the student's question?
 *   contextPrecision — is the retrieved context relevant to the question?
 *
 * All scoring is done by Gemini Flash-Lite (cheapest model) via a single
 * structured JSON request per metric so the evaluation adds minimal latency.
 * Failures are swallowed — evaluation is always non-blocking.
 */

import { GoogleGenerativeAI } from '@google/generative-ai'
import { db } from '@/lib/db'
import type { RagNote, RagChunk } from './rag'

interface RagEvalInput {
  userId: string
  sessionId: string
  query: string
  response: string
  context: string
  notesUsed: RagNote[]
  chunksUsed: RagChunk[]
  hydeUsed: boolean
}

interface EvalScores {
  faithfulness: number | null
  answerRelevancy: number | null
  contextPrecision: number | null
}

// ─── LLM judge ───────────────────────────────────────────────────────────────

async function judgeWithGemini(prompt: string): Promise<number | null> {
  try {
    const apiKey = process.env['GOOGLE_API_KEY'] ?? process.env['GEMINI_API_KEY']
    if (!apiKey) return null

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' })

    const result = await model.generateContent(prompt)
    const text = result.response.text().trim()

    // Extract a float 0–1 from the response
    const match = text.match(/\b(0(\.\d+)?|1(\.0+)?)\b/)
    if (!match) return null
    const score = parseFloat(match[0])
    return isNaN(score) ? null : Math.max(0, Math.min(1, score))
  } catch {
    return null
  }
}

// ─── Metric implementations ───────────────────────────────────────────────────

/**
 * Faithfulness: fraction of response claims that can be attributed to the context.
 * Score 1 = fully grounded, 0 = hallucinated.
 */
async function scoreFaithfulness(
  response: string,
  context: string
): Promise<number | null> {
  if (!context.trim()) return null
  const prompt = `You are an objective evaluator assessing whether an AI response is grounded in the provided context.

Context:
${context.slice(0, 2000)}

Response:
${response.slice(0, 1000)}

Task: Score how much of the response is directly supported by the context.
- 1.0 = all claims are grounded in the context
- 0.5 = about half the claims are grounded
- 0.0 = none of the claims are grounded / pure hallucination

Reply with ONLY a decimal number between 0 and 1. No explanation.`

  return judgeWithGemini(prompt)
}

/**
 * Answer relevancy: how well the response addresses the student's question.
 * Score 1 = fully answers the question, 0 = completely off-topic.
 */
async function scoreAnswerRelevancy(
  query: string,
  response: string
): Promise<number | null> {
  const prompt = `You are an objective evaluator assessing whether an AI response answers a student's question.

Question: ${query.slice(0, 500)}

Response:
${response.slice(0, 1000)}

Task: Score how directly and completely the response answers the question.
- 1.0 = directly and completely answers the question
- 0.5 = partially answers the question
- 0.0 = does not address the question at all

Reply with ONLY a decimal number between 0 and 1. No explanation.`

  return judgeWithGemini(prompt)
}

/**
 * Context precision: how relevant the retrieved context is to the question.
 * Score 1 = all retrieved context is relevant, 0 = retrieved context is noise.
 */
async function scoreContextPrecision(
  query: string,
  context: string
): Promise<number | null> {
  if (!context.trim()) return null
  const prompt = `You are an objective evaluator assessing the quality of retrieved context for a student's question.

Question: ${query.slice(0, 500)}

Retrieved context:
${context.slice(0, 2000)}

Task: Score how relevant and useful the retrieved context is for answering the question.
- 1.0 = the context is highly relevant and useful
- 0.5 = the context is somewhat relevant but contains noise
- 0.0 = the context is completely irrelevant to the question

Reply with ONLY a decimal number between 0 and 1. No explanation.`

  return judgeWithGemini(prompt)
}

// ─── Main evaluation entry point ──────────────────────────────────────────────

/**
 * Run all RAG quality metrics and persist results to the DB.
 * Designed to be called inside `after()` — non-blocking, never throws.
 */
export async function evaluateRagResponse(input: RagEvalInput): Promise<void> {
  try {
    const ragUsed = input.context.trim().length > 0

    let scores: EvalScores = {
      faithfulness: null,
      answerRelevancy: null,
      contextPrecision: null,
    }

    if (ragUsed) {
      // Run all three metrics in parallel
      const [faithfulness, answerRelevancy, contextPrecision] = await Promise.all([
        scoreFaithfulness(input.response, input.context),
        scoreAnswerRelevancy(input.query, input.response),
        scoreContextPrecision(input.query, input.context),
      ])
      scores = { faithfulness, answerRelevancy, contextPrecision }
    } else {
      // No context — only measure answer relevancy
      scores.answerRelevancy = await scoreAnswerRelevancy(input.query, input.response)
    }

    await db.ragEvaluation.create({
      data: {
        userId: input.userId,
        sessionId: input.sessionId,
        query: input.query,
        response: input.response.slice(0, 2000), // cap stored size
        faithfulness: scores.faithfulness,
        answerRelevancy: scores.answerRelevancy,
        contextPrecision: scores.contextPrecision,
        ragUsed,
        notesRetrieved: input.notesUsed.length,
        chunksRetrieved: input.chunksUsed.length,
        hydeUsed: input.hydeUsed,
      },
    })
  } catch {
    // Evaluation is always non-blocking — never surface errors to the user
  }
}
