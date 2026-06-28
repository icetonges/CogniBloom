import { NextRequest, NextResponse } from 'next/server'
import { chatWithFallback } from '@/lib/ai/fallback'
import { DEFAULT_MODEL_ID } from '@/lib/ai/models'
import type { ChatMessage } from '@/lib/ai/providers/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 45

/**
 * GET /api/investment/tip?date=YYYY-MM-DD
 *
 * Returns one teen-friendly daily investing tip that is FACTUALLY GROUNDED in an
 * authoritative knowledge base (SEC / Investor.gov / FINRA / CFA Institute). The
 * model only rewrites the supplied facts into ~200 friendly words — it is told not
 * to invent numbers, promise returns, or recommend specific stocks. Source links
 * are returned from the knowledge base itself (never from the model), so citations
 * are always correct. If the model call fails, a factual fallback assembled
 * directly from the knowledge base is returned, so the endpoint always works.
 *
 * The topic rotates deterministically by calendar day, so each day is "fresh" but
 * stable within the day.
 */

interface Source { label: string; url: string }
interface KbEntry {
  topic: string
  technical: { title: string; facts: string }
  bias: { name: string; facts: string; fix: string }
  sources: Source[]
}

// ── Authoritative knowledge base (facts only — no opinions, no invented stats) ──
const KB: KbEntry[] = [
  {
    topic: 'Diversification',
    technical: {
      title: 'Don’t put all your eggs in one basket',
      facts:
        'The SEC explains diversification as spreading money across different investments to reduce risk. Owning only four or five stocks is NOT diversified — the SEC says you generally need at least a dozen carefully chosen stocks across different industries to be truly diversified. A low-cost index ETF holds hundreds of companies at once, which is an easy way for a beginner to diversify.',
    },
    bias: {
      name: 'Familiarity bias',
      facts:
        'Investors often over-buy companies they already know or use, ignoring everything else. Familiar does not mean diversified or safe.',
      fix: 'Before buying, ask: “Am I picking this because the business is strong, or just because I recognize the name?” Spread your bets.',
    },
    sources: [
      { label: 'SEC / Investor.gov — Diversification', url: 'https://www.investor.gov/introduction-investing/investing-basics/glossary/diversification' },
      { label: 'SEC — Beginners’ Guide to Asset Allocation', url: 'https://www.sec.gov/about/reports-publications/investorpubsassetallocationhtm' },
    ],
  },
  {
    topic: 'Dollar-cost averaging',
    technical: {
      title: 'Investing the same amount on a schedule',
      facts:
        'The SEC defines dollar-cost averaging as investing equal amounts at regular intervals regardless of price. Because you buy more shares when prices are low and fewer when prices are high, it removes the pressure of trying to “time” the market. Your $5-a-day habit is dollar-cost averaging in action.',
    },
    bias: {
      name: 'Timing temptation',
      facts:
        'Many beginners wait for the “perfect” moment to buy and end up doing nothing, or they pile in after a price has already jumped.',
      fix: 'Stick to your fixed schedule. Consistency beats trying to guess the bottom.',
    },
    sources: [
      { label: 'SEC / Investor.gov — Dollar-Cost Averaging', url: 'https://www.investor.gov/introduction-investing/investing-basics/glossary/dollar-cost-averaging' },
    ],
  },
  {
    topic: 'Anchoring bias',
    technical: {
      title: 'A stock’s price is set by the business, not by what you paid',
      facts:
        'A share price reflects what buyers and sellers think a business is worth today. The price you happened to pay has no effect on where the price goes next.',
    },
    bias: {
      name: 'Anchoring',
      facts:
        'The CFA Institute describes anchoring as fixating on a specific number — like your purchase price or a past high — instead of staying flexible. Example: refusing to sell a weak stock “until it gets back to what I paid.”',
      fix: 'Judge a holding by the business and its future, not by your purchase price. Ask: “If I had cash today, would I still buy this?”',
    },
    sources: [
      { label: 'CFA Institute — The Behavioral Biases of Individuals', url: 'https://www.cfainstitute.org/insights/professional-learning/refresher-readings/2026/the-behavioral-biases-of-individuals' },
    ],
  },
  {
    topic: 'Loss aversion',
    technical: {
      title: 'Why a 20% drop feels worse than a 20% gain feels good',
      facts:
        'A diversified, long-term portfolio will still have down days, weeks and months — that is normal market behavior, not a sign you did something wrong.',
    },
    bias: {
      name: 'Loss aversion',
      facts:
        'The CFA Institute notes that people dislike losses more than they enjoy equal gains. This can make investors panic-sell good companies the moment they dip, locking in a loss.',
      fix: 'Decide in advance what would actually change your view of the business. If nothing has changed, a dip is not a reason to sell.',
    },
    sources: [
      { label: 'CFA Institute — The Behavioral Biases of Individuals', url: 'https://www.cfainstitute.org/insights/professional-learning/refresher-readings/2026/the-behavioral-biases-of-individuals' },
    ],
  },
  {
    topic: 'Herding & hype',
    technical: {
      title: 'Popular is not the same as good',
      facts:
        'A stock can rise simply because lots of people are buying it, not because the underlying business improved. Prices driven by excitement can fall just as fast.',
    },
    bias: {
      name: 'Herding',
      facts:
        'The CFA Institute describes herding as following the crowd into whatever is popular. Chasing hype or meme stocks is one of the most common ways beginners lose money.',
      fix: 'Before buying something “everyone” is buying, write one sentence on why the BUSINESS is worth owning. If you can’t, it’s hype.',
    },
    sources: [
      { label: 'CFA Institute — The Herding Mentality', url: 'https://blogs.cfainstitute.org/investor/2015/08/06/the-herding-mentality-behavioral-finance-and-investor-biases/' },
    ],
  },
  {
    topic: 'Reading a stock chart',
    technical: {
      title: 'What a price chart can and cannot tell you',
      facts:
        'A price chart shows where a stock has traded over time — useful context like the 52-week high and low. A chart shows the past; it cannot predict the future. The SEC reminds investors that past performance does not guarantee future results.',
    },
    bias: {
      name: 'Recency bias',
      facts:
        'The CFA Institute describes recency/availability bias as over-weighting whatever happened most recently — assuming a stock that just went up will keep going up.',
      fix: 'Zoom out. Look at a 1-year and 5-year view, not just today’s line, and remember recent moves don’t set the future.',
    },
    sources: [
      { label: 'SEC — Beginners’ Guide to Asset Allocation', url: 'https://www.sec.gov/about/reports-publications/investorpubsassetallocationhtm' },
      { label: 'CFA Institute — Behavioral Biases', url: 'https://www.cfainstitute.org/insights/professional-learning/refresher-readings/2026/the-behavioral-biases-of-individuals' },
    ],
  },
  {
    topic: 'Market trend vs. timing',
    technical: {
      title: 'Time IN the market beats timing the market',
      facts:
        'Market trends move up and down, and even experts cannot reliably predict short-term moves. The SEC encourages a long-term plan and staying invested rather than jumping in and out based on headlines.',
    },
    bias: {
      name: 'Overconfidence',
      facts:
        'The CFA Institute lists overconfidence as overestimating your own ability to predict prices, which leads to over-trading.',
      fix: 'Assume you cannot out-guess the market short-term. A steady $5-a-day plan needs no predictions.',
    },
    sources: [
      { label: 'SEC / Investor.gov — Asset Allocation', url: 'https://www.investor.gov/introduction-investing/getting-started/asset-allocation' },
    ],
  },
  {
    topic: 'Reading the numbers: revenue & profit',
    technical: {
      title: 'Does the business actually make money?',
      facts:
        'Revenue is the total money a company brings in from sales. Net income (profit) is what is left after all costs. A healthy business usually grows revenue over time and earns a profit. Some young companies are not yet profitable — that is higher risk.',
    },
    bias: {
      name: 'Story over substance',
      facts:
        'Exciting stories can hide weak finances. A great-sounding product does not guarantee a profitable business.',
      fix: 'Pair every story with one number: is revenue growing, and does the company make a profit?',
    },
    sources: [
      { label: 'SEC / Investor.gov — Investing Basics Glossary', url: 'https://www.investor.gov/introduction-investing/investing-basics/glossary' },
    ],
  },
  {
    topic: 'The P/E ratio',
    technical: {
      title: 'Price compared with earnings',
      facts:
        'The price-to-earnings (P/E) ratio compares a stock’s price to its profit per share. A high P/E means investors expect lots of future growth — and the price can fall hard if that growth slows. P/E is only useful when comparing similar companies, and some companies have no P/E because they have no profit yet.',
    },
    bias: {
      name: 'Anchoring on “cheap” vs “expensive”',
      facts:
        'A low P/E is not automatically a bargain, and a high P/E is not automatically bad — the number needs context.',
      fix: 'Compare a company’s P/E with similar companies, not with a random target in your head.',
    },
    sources: [
      { label: 'SEC / Investor.gov — Investing Basics Glossary', url: 'https://www.investor.gov/introduction-investing/investing-basics/glossary' },
    ],
  },
  {
    topic: 'Risk and time horizon',
    technical: {
      title: 'How long until you need the money?',
      facts:
        'The SEC explains that the right mix of investments depends on your time horizon and risk tolerance. Money you won’t need for years can handle more ups and downs; money you need soon should take less risk.',
    },
    bias: {
      name: 'Emotional risk-taking',
      facts:
        'Feelings of fear or excitement can push investors to take more risk than they truly want.',
      fix: 'Know your honest comfort level. If a 20% drop would make you panic, size your risk so you can stay calm.',
    },
    sources: [
      { label: 'SEC / Investor.gov — Asset Allocation', url: 'https://www.investor.gov/introduction-investing/getting-started/asset-allocation' },
    ],
  },
  {
    topic: 'Fees matter',
    technical: {
      title: 'Small costs add up over time',
      facts:
        'FINRA and the SEC stress that fees and expenses reduce your returns over time. A fund with a lower expense ratio keeps more money working for you. Even a 1% yearly fee can add up to a large amount over many years.',
    },
    bias: {
      name: 'Ignoring the small print',
      facts:
        'Beginners often focus only on price moves and forget about costs, which quietly shrink returns.',
      fix: 'Check the expense ratio of any ETF or fund before buying. Lower is usually better for long-term investors.',
    },
    sources: [
      { label: 'SEC / Investor.gov — Understanding Fees', url: 'https://www.investor.gov/introduction-investing/getting-started/understanding-fees' },
      { label: 'FINRA — Investors', url: 'https://www.finra.org/investors' },
    ],
  },
  {
    topic: 'Compounding',
    technical: {
      title: 'Earnings that earn more earnings',
      facts:
        'Compounding is when the returns you earn start earning returns of their own. The SEC notes that the earlier and more consistently you invest, the more time compounding has to work. This is why a small daily habit can grow meaningfully over many years.',
    },
    bias: {
      name: 'Impatience',
      facts:
        'Compounding is slow at first, which tempts beginners to quit before it gets powerful.',
      fix: 'Think in years, not days. The boring, consistent investor often wins.',
    },
    sources: [
      { label: 'SEC / Investor.gov — Compound Interest', url: 'https://www.investor.gov/introduction-investing/investing-basics/glossary/compound-interest' },
    ],
  },
  {
    topic: 'Confirmation bias',
    technical: {
      title: 'Look for reasons you might be WRONG',
      facts:
        'Good research includes the risks, not just the positives. Strong investors can explain what could go wrong with a company, not only why they like it.',
    },
    bias: {
      name: 'Confirmation bias',
      facts:
        'The CFA Institute describes confirmation bias as seeking only information that supports what you already believe, and ignoring the rest.',
      fix: 'For every stock, write one real risk and check more than one source before deciding.',
    },
    sources: [
      { label: 'CFA Institute — Behavioral Biases', url: 'https://www.cfainstitute.org/insights/professional-learning/refresher-readings/2026/the-behavioral-biases-of-individuals' },
    ],
  },
  {
    topic: 'Index funds & ETFs',
    technical: {
      title: 'Owning a slice of many companies at once',
      facts:
        'An index fund or ETF holds a basket of many companies, so one bad pick has less impact. The SEC describes index funds as a low-cost, diversified way for beginners to invest, because they spread money across a whole market instead of a single bet.',
    },
    bias: {
      name: 'Excitement bias',
      facts:
        'Single “hot” stocks feel more exciting than a broad fund, even though the fund is usually less risky for a beginner.',
      fix: 'It is okay to be boring. A diversified ETF can be the core, with small experiments around it.',
    },
    sources: [
      { label: 'SEC / Investor.gov — Exchange-Traded Funds (ETFs)', url: 'https://www.investor.gov/introduction-investing/investing-basics/investment-products/mutual-funds-and-exchange-traded-2' },
    ],
  },
]

function dayIndex(dateStr: string): number {
  // Stable ordinal day number from a YYYY-MM-DD string.
  const ms = Date.parse(dateStr + 'T00:00:00Z')
  if (Number.isNaN(ms)) return 0
  const day = Math.floor(ms / 86_400_000)
  return ((day % KB.length) + KB.length) % KB.length
}

function easternDateString(): string {
  // App standard: New York time (see project memory).
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function fallbackMarkdown(e: KbEntry): string {
  return [
    `### 📊 Technical Insight — ${e.technical.title}`,
    e.technical.facts,
    ``,
    `### 🧠 Beating a Bias — ${e.bias.name}`,
    `${e.bias.facts} **Try this:** ${e.bias.fix}`,
  ].join('\n')
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const date = url.searchParams.get('date') || easternDateString()
  const entry = KB[dayIndex(date)]

  const grounding = [
    `TOPIC: ${entry.topic}`,
    ``,
    `TECHNICAL FACTS (authoritative):`,
    `- Title: ${entry.technical.title}`,
    `- ${entry.technical.facts}`,
    ``,
    `BEHAVIORAL BIAS (authoritative):`,
    `- Name: ${entry.bias.name}`,
    `- ${entry.bias.facts}`,
    `- How to beat it: ${entry.bias.fix}`,
  ].join('\n')

  const system =
    'You are a calm, encouraging financial-literacy coach for a teenager who invests $5 a day to learn. ' +
    'Write a SHORT daily tip of about 180–220 words in Markdown, using ONLY the facts provided to you. ' +
    'Structure it in exactly two sections with these headings: ' +
    '"### 📊 Technical Insight" and "### 🧠 Beating a Bias". ' +
    'Rules you must follow: do NOT invent numbers, statistics, percentages, or dates that are not in the facts; ' +
    'do NOT promise or imply any returns; do NOT recommend or name any specific stock, ticker, or fund to buy; ' +
    'do NOT give personalized financial advice. Keep language simple, warm, and teen-friendly. ' +
    'End with one short encouraging sentence. Do not add a disclaimer or a sources list — those are shown separately.'

  const messages: ChatMessage[] = [
    { role: 'system', content: system },
    { role: 'user', content: `Write today’s tip from these facts only:\n\n${grounding}` },
  ]

  try {
    const r = await chatWithFallback({ messages, temperature: 0.6, maxTokens: 700 }, DEFAULT_MODEL_ID)
    const markdown = (r.content || '').trim() || fallbackMarkdown(entry)
    return NextResponse.json({
      date,
      topic: entry.topic,
      biasName: entry.bias.name,
      markdown,
      sources: entry.sources,
      generated: true,
    })
  } catch (err) {
    console.error('[GET /api/investment/tip]', err)
    // Always return something factual, assembled directly from the knowledge base.
    return NextResponse.json({
      date,
      topic: entry.topic,
      biasName: entry.bias.name,
      markdown: fallbackMarkdown(entry),
      sources: entry.sources,
      generated: false,
    })
  }
}
