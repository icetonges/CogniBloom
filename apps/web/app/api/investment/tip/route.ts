import { NextRequest, NextResponse } from 'next/server'
import { chatWithFallback } from '@/lib/ai/fallback'
import { DEFAULT_MODEL_ID } from '@/lib/ai/models'
import type { ChatMessage } from '@/lib/ai/providers/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 60

/**
 * GET /api/investment/tip?date=YYYY-MM-DD&n=<nonce>
 *
 * One inspiring, story-led daily read written in the voice of a best-selling teen
 * finance author. THREE sections (a true story, a technical insight, and beating a
 * bias), each ~100–200 words → ~300–500 words total.
 *
 * Every fact is GROUNDED in an authoritative knowledge base (SEC / Investor.gov,
 * Federal Reserve, CFA Institute, Nobel Prize, Britannica, Goldman Sachs, NYT).
 * The model only retells the supplied facts — never invents numbers, dates, or
 * quotes, never promises returns, never names a stock to buy. Source links come
 * from the knowledge base (not the model), so citations are always correct.
 *
 * Robustness:
 *  - A large output-token budget so "thinking" models still finish the full answer.
 *  - A completeness guard: if the model output is missing a section or too short,
 *    we retry on a proven model, then fall back to a complete factual version.
 *  - A random "creative angle" + a per-request nonce so "New wording" truly differs.
 *  - no-store caching so each request hits the model fresh.
 *
 * The story rotates deterministically by calendar day — fresh daily, stable within
 * the day.
 */

interface Source { label: string; url: string }
interface KbEntry {
  topic: string
  basics: { title: string; facts: string }
  story: { title: string; facts: string }
  technical: { title: string; facts: string }
  bias: { name: string; facts: string; fix: string }
  sources: Source[]
}

// ── Authoritative knowledge base (verified facts only — no invented quotes/numbers) ──
const KB: KbEntry[] = [
  {
    topic: 'Greedy when others are fearful',
    basics: {
      title: 'What is a stock?',
      facts:
        'A stock is a share of ownership in a real company. Buy one share and you literally become a part-owner of that business, sharing in its success — or its setbacks. Companies sell stock to raise money to grow, and investors buy it hoping the business becomes more valuable over time or pays out a slice of profits called a dividend.',
    },
    story: {
      title: 'Warren Buffett buys while others panic (2008)',
      facts:
        'In October 2008, during the worst of the global financial crisis after Lehman Brothers collapsed, the legendary investor Warren Buffett published a famous New York Times opinion piece titled “Buy American. I Am.” While most people were terrified and selling, Buffett said he was buying U.S. stocks. He shared his simple rule: “Be fearful when others are greedy, and be greedy when others are fearful.” His idea: fear can push prices below what good businesses are really worth, and patient long-term investors who buy quality during a panic have often been rewarded over time. He did not promise fast gains — he warned headlines would stay scary in the near term.',
    },
    technical: {
      title: 'A share is a piece of a real business',
      facts:
        'A stock is part-ownership of an actual company, not just a number on a screen. Buying solid businesses and holding for years has historically rewarded patience more than jumping in and out trying to guess the perfect moment.',
    },
    bias: {
      name: 'Herding',
      facts:
        'The CFA Institute describes herding as following the crowd into whatever is popular. In 2008 the crowd was selling in fear; Buffett did the opposite by focusing on value.',
      fix: 'Before joining a stampede — in OR out — ask whether the business itself justifies it.',
    },
    sources: [
      { label: 'SEC / Investor.gov — Investing Basics Glossary (Investment 101)', url: 'https://www.investor.gov/introduction-investing/investing-basics/glossary' },
      { label: 'CNBC — Buffett’s NYT Op-Ed “Buy American. I Am.”', url: 'https://www.cnbc.com/2008/10/16/warren-buffetts-ny-times-oped-buy-american-i-am.html' },
      { label: 'The New York Times — “Buy American. I Am.” (Buffett, 2008)', url: 'https://www.nytimes.com/2008/10/17/opinion/17buffett.html' },
      { label: 'CFA Institute — The Herding Mentality', url: 'https://blogs.cfainstitute.org/investor/2015/08/06/the-herding-mentality-behavioral-finance-and-investor-biases/' },
    ],
  },
  {
    topic: 'When hype meets reality',
    basics: {
      title: 'Stocks vs. ETFs',
      facts:
        'A single stock is just one company, so its ups and downs hit you fully. An ETF (exchange-traded fund) bundles many companies into one investment that trades like a stock, giving a beginner instant diversification. Own a broad ETF and one company stumbling will not sink your whole plan.',
    },
    story: {
      title: 'The Dot-Com Bubble bursts (2000)',
      facts:
        'In the late 1990s, internet “dot-com” stocks soared as investors got swept up in excitement. The tech-heavy Nasdaq index rose about 600% from 1995 and peaked around 5,048 on March 10, 2000. Then reality set in. Many of these companies had thrilling stories but little or no profit. The Nasdaq fell about 78% by October 2002, and famous names like Pets.com went bankrupt. The investors who chased the hype without ever checking whether the companies actually made money were the ones who lost the most.',
    },
    technical: {
      title: 'A rising chart is not proof of a healthy business',
      facts:
        'A price going up does not mean a company earns money. The SEC reminds investors that past performance does not guarantee future results. Always check whether revenue and profit are real, not just the excitement.',
    },
    bias: {
      name: 'Herding & hype',
      facts:
        'Buying something just because everyone else is buying it. The CFA Institute calls this herding — and it is one of the most common ways beginners lose money.',
      fix: 'Write one sentence on why the business is worth owning. If you can’t, it’s hype.',
    },
    sources: [
      { label: 'SEC / Investor.gov — Exchange-Traded Funds (Investment 101)', url: 'https://www.investor.gov/introduction-investing/investing-basics/investment-products/mutual-funds-and-exchange-traded-2' },
      { label: 'Goldman Sachs — The 2000 Dot-Com Bubble', url: 'https://www.goldmansachs.com/our-firm/history/moments/2000-dot-com-bubble' },
      { label: 'SEC — Beginners’ Guide to Asset Allocation', url: 'https://www.sec.gov/about/reports-publications/investorpubsassetallocationhtm' },
      { label: 'CFA Institute — The Herding Mentality', url: 'https://blogs.cfainstitute.org/investor/2015/08/06/the-herding-mentality-behavioral-finance-and-investor-biases/' },
    ],
  },
  {
    topic: 'Why spreading risk matters',
    basics: {
      title: 'Risk, reward, and your emotions',
      facts:
        'Every investment trades risk for potential reward: bigger possible gains usually come with bigger swings and bigger possible losses. A smart young investor only invests money they will not need soon — and notices how risk makes them FEEL. Managing that emotion is just as important as the math.',
    },
    story: {
      title: 'Lehman Brothers and the 2008 crisis',
      facts:
        'On September 15, 2008, the 158-year-old investment bank Lehman Brothers filed for bankruptcy — the largest in U.S. history, with more than $600 billion in assets. Lehman had taken on enormous risk tied to subprime home loans. Its collapse set off a global financial panic. Federal Reserve Chair Ben Bernanke and other officials worked through that weekend but could not save it. The episode showed how too much risk and borrowed money concentrated in one place can topple even a giant firm — a powerful lesson in why spreading your risk matters.',
    },
    technical: {
      title: 'Don’t put all your eggs in one basket',
      facts:
        'The SEC explains diversification as spreading money across different investments so that one failure does not sink everything. A low-cost index ETF holds many companies at once, an easy way for a beginner to diversify.',
    },
    bias: {
      name: 'Overconfidence',
      facts:
        'The CFA Institute lists overconfidence as overestimating how safe or certain something is. Before 2008, many believed house prices could only go up.',
      fix: 'For every investment, force yourself to answer: “What could go wrong here?”',
    },
    sources: [
      { label: 'SEC / Investor.gov — Asset Allocation (Investment 101)', url: 'https://www.investor.gov/introduction-investing/getting-started/asset-allocation' },
      { label: 'Federal Reserve — Bernanke: Lessons from the Failure of Lehman Brothers', url: 'https://www.federalreserve.gov/newsevents/testimony/bernanke20100420a.htm' },
      { label: 'SEC / Investor.gov — Diversification', url: 'https://www.investor.gov/introduction-investing/investing-basics/glossary/diversification' },
      { label: 'SEC — Beginners’ Guide to Asset Allocation', url: 'https://www.sec.gov/about/reports-publications/investorpubsassetallocationhtm' },
    ],
  },
  {
    topic: 'Markets can run on emotion',
    basics: {
      title: 'What makes prices move?',
      facts:
        'A stock price changes with supply and demand — how many people want to buy versus sell. That is driven by company news, the wider economy, and crowd emotion. In the short run, feelings can move prices as much as facts, which is why prices sometimes swing for no obvious reason.',
    },
    story: {
      title: 'Greenspan warns of “irrational exuberance” (1996)',
      facts:
        'On December 5, 1996, Federal Reserve Chairman Alan Greenspan gave a speech asking how anyone can tell when “irrational exuberance” has pushed asset prices too high. The phrase became instantly famous as a warning that markets can be driven by emotion, not just facts. Here’s the twist: stocks kept climbing for several more years before the dot-com crash finally came. Even the most powerful central banker in the world could not predict the exact moment the bubble would pop.',
    },
    technical: {
      title: 'Nobody can reliably time the market',
      facts:
        'If even experts cannot call the top or bottom, a beginner shouldn’t try. A steady, scheduled plan beats guessing — which is exactly what your $5-a-day habit does.',
    },
    bias: {
      name: 'Recency bias',
      facts:
        'The CFA Institute describes recency bias as assuming whatever happened lately will keep happening — like believing a rising stock must keep rising.',
      fix: 'Zoom out to a 1-year and 5-year view; recent moves don’t decide the future.',
    },
    sources: [
      { label: 'SEC — Beginners’ Guide to Investing (Investment 101)', url: 'https://www.sec.gov/about/reports-publications/investorpubsassetallocationhtm' },
      { label: 'Federal Reserve — Greenspan Speech, Dec 5 1996', url: 'https://www.federalreserve.gov/boarddocs/speeches/1996/19961205.htm' },
      { label: 'SEC / Investor.gov — Asset Allocation', url: 'https://www.investor.gov/introduction-investing/getting-started/asset-allocation' },
      { label: 'CFA Institute — The Behavioral Biases of Individuals', url: 'https://www.cfainstitute.org/insights/professional-learning/refresher-readings/2026/the-behavioral-biases-of-individuals' },
    ],
  },
  {
    topic: 'Learning from history',
    basics: {
      title: 'Your time horizon',
      facts:
        'Your time horizon is how long until you need the money. The longer it is, the more short-term ups and downs you can ride out, because you have years to recover. Money you will need soon belongs in safer places. Matching your risk to your time horizon is a core investing skill.',
    },
    story: {
      title: 'Ben Bernanke: the Depression scholar who fought a crisis',
      facts:
        'Ben Bernanke spent his career studying the Great Depression, showing in a famous 1983 paper how failing banks made that disaster far worse. So when he became Federal Reserve Chair (2006–2014) and the 2008 crisis struck, he used those exact lessons to act fast and help keep the banking system from collapsing. In 2022 he shared the Nobel Prize in Economic Sciences for research on banks and financial crises. His story is proof that studying the past can pay off enormously when history rhymes.',
    },
    technical: {
      title: 'Markets have recovered over the long run',
      facts:
        'Economies and markets have historically recovered from crises over time, which has rewarded patient, diversified, long-term investors rather than those who panic-sold at the bottom.',
    },
    bias: {
      name: 'Loss aversion',
      facts:
        'The CFA Institute notes that people dislike losses more than they enjoy equal gains, which can trigger panic-selling at the worst possible moment.',
      fix: 'Decide in advance what would truly change your view of a business — and ignore the noise in between.',
    },
    sources: [
      { label: 'SEC / Investor.gov — Asset Allocation (Investment 101)', url: 'https://www.investor.gov/introduction-investing/getting-started/asset-allocation' },
      { label: 'NobelPrize.org — Ben Bernanke, 2022', url: 'https://www.nobelprize.org/prizes/economic-sciences/2022/bernanke/biographical/' },
      { label: 'Britannica Money — Ben Bernanke', url: 'https://www.britannica.com/money/Ben-Bernanke' },
      { label: 'Federal Reserve — Bernanke on the Lehman Failure', url: 'https://www.federalreserve.gov/newsevents/testimony/bernanke20100420a.htm' },
    ],
  },
  {
    topic: 'Scary drops are often temporary',
    basics: {
      title: 'Volatility and staying calm',
      facts:
        'Volatility means prices swing up and down, sometimes sharply. It is completely normal, not a sign something is broken. The real skill is emotional: not letting fear during drops or excitement during rallies make your decisions for you. Calm, consistent investors usually beat panicky ones.',
    },
    story: {
      title: 'Black Monday (1987): the biggest one-day crash',
      facts:
        'On Monday, October 19, 1987, the Dow Jones Industrial Average fell 22.6% in a single day — still the largest one-day percentage drop in U.S. stock market history. It was genuinely terrifying for everyone watching. Yet markets recovered most of those losses within two trading sessions, and U.S. stocks surpassed their pre-crash highs less than two years later. The lesson for a young investor: a dramatic crash can feel like the end of the world while it’s happening, but for diversified, long-term investors it has often turned out to be temporary.',
    },
    technical: {
      title: 'Big swings (volatility) are normal',
      facts:
        'Sharp ups and downs are a normal part of investing. For long-term investors, staying invested through the swings has historically mattered more than reacting to any single scary day.',
    },
    bias: {
      name: 'Loss aversion',
      facts:
        'Panic-selling during a crash locks in a loss. The fear of losing feels overwhelming exactly when prices are lowest.',
      fix: 'If nothing about the actual businesses changed, a crash alone is not a reason to sell.',
    },
    sources: [
      { label: 'SEC / Investor.gov — Investing Basics Glossary (Investment 101)', url: 'https://www.investor.gov/introduction-investing/investing-basics/glossary' },
      { label: 'Federal Reserve History — Stock Market Crash of 1987', url: 'https://www.federalreservehistory.org/essays/stock-market-crash-of-1987' },
      { label: 'Britannica — Black Monday (1987)', url: 'https://www.britannica.com/topic/Black-Monday-1987' },
      { label: 'CFA Institute — The Behavioral Biases of Individuals', url: 'https://www.cfainstitute.org/insights/professional-learning/refresher-readings/2026/the-behavioral-biases-of-individuals' },
    ],
  },
  {
    topic: 'Boring can be brilliant',
    basics: {
      title: 'Fees and the expense ratio',
      facts:
        'Funds charge fees, and the expense ratio is the yearly cost shown as a percentage of your money. It sounds tiny, but because fees compound over many years, the gap between a cheap and an expensive fund can be huge. Lower-cost funds keep more of your money working for you.',
    },
    story: {
      title: 'Jack Bogle invents the index fund (1976)',
      facts:
        'John “Jack” Bogle founded Vanguard in 1974, and in 1976 he launched the first index mutual fund for everyday people. Critics mocked it as “Bogle’s Folly” and even called it un-American to “settle” for matching the market instead of trying to beat it. But Bogle’s idea was simple and powerful: most investors do better owning a broad, low-cost slice of the whole market than paying high fees to chase winners. Decades later, index funds are one of the most popular ways in the world to invest.',
    },
    technical: {
      title: 'Diversification + low fees',
      facts:
        'An index fund spreads your money across many companies at once, at low cost. The SEC notes that fees quietly reduce your returns over time, so lower-cost funds keep more money working for you.',
    },
    bias: {
      name: 'Excitement bias',
      facts:
        'A single “hot” stock feels thrilling, while a broad index fund feels boring — even though the boring option is usually less risky for a beginner.',
      fix: 'It’s okay to be boring. A low-cost, diversified index can be your steady core.',
    },
    sources: [
      { label: 'SEC / Investor.gov — Understanding Fees (Investment 101)', url: 'https://www.investor.gov/introduction-investing/getting-started/understanding-fees' },
      { label: 'Britannica Money — John Bogle', url: 'https://www.britannica.com/money/John-Bogle' },
      { label: 'Vanguard — Indexing since 1976', url: 'https://corporate.vanguard.com/content/corporatesite/us/en/corp/articles/50-years-50-facts-indexing-since-1976.html' },
      { label: 'SEC / Investor.gov — Understanding Fees', url: 'https://www.investor.gov/introduction-investing/getting-started/understanding-fees' },
    ],
  },
  {
    topic: 'Invest in what you understand',
    basics: {
      title: 'Revenue vs. profit',
      facts:
        'Revenue is all the money a company brings in from sales. Profit, or net income, is what is left after it pays its costs. A healthy business usually grows its revenue AND earns a profit. Knowing the difference helps you tell an exciting story apart from a genuinely strong business.',
    },
    story: {
      title: 'Peter Lynch: invest in what you know',
      facts:
        'Peter Lynch ran Fidelity’s Magellan Fund from 1977 to 1990 and averaged roughly a 29% annual return — one of the greatest records ever. His famous idea was that ordinary people can spot great companies in everyday life: at the mall, the grocery store, the places they love, sometimes before Wall Street notices. But Lynch was very clear that noticing a popular product is only step one. After that, you still have to study whether the business behind it is actually healthy and growing before you invest a cent.',
    },
    technical: {
      title: 'Understand how the business makes money',
      facts:
        'Before buying, know what a company does, how it earns money, and whether its revenue and profit are growing. A great product is not the same as a great investment.',
    },
    bias: {
      name: 'Confirmation bias',
      facts:
        'The CFA Institute describes confirmation bias as looking only for information that supports what you already believe — like loving a product and skipping the homework.',
      fix: 'Liking the product isn’t enough: check the numbers and write down one real risk.',
    },
    sources: [
      { label: 'SEC / Investor.gov — Investing Basics Glossary (Investment 101)', url: 'https://www.investor.gov/introduction-investing/investing-basics/glossary' },
      { label: 'Investopedia — Peter Lynch', url: 'https://www.investopedia.com/terms/p/peterlynch.asp' },
      { label: 'SEC / Investor.gov — Investing Basics Glossary', url: 'https://www.investor.gov/introduction-investing/investing-basics/glossary' },
      { label: 'SEC / Investor.gov — Asset Allocation', url: 'https://www.investor.gov/introduction-investing/getting-started/asset-allocation' },
    ],
  },
  {
    topic: 'Price is not the same as value',
    basics: {
      title: 'Price vs. value',
      facts:
        'Price is what you pay; value is what a business is actually worth. They are not always the same, because emotion can push price above or below value. Great investors try to buy when price is below value, and they never confuse a falling price with a bad business.',
    },
    story: {
      title: 'Benjamin Graham and “Mr. Market”',
      facts:
        'Benjamin Graham is often called the father of value investing — and he was Warren Buffett’s teacher. In his classic 1949 book “The Intelligent Investor,” Graham imagined the stock market as a moody business partner he nicknamed “Mr. Market,” who shows up every single day shouting prices: sometimes wildly too high, sometimes far too low. Graham’s genius advice was that you don’t have to react to Mr. Market’s mood swings. Decide for yourself what a business is truly worth, and let his panic or excitement work for you, not against you.',
    },
    technical: {
      title: 'Judge the business, not your purchase price',
      facts:
        'The price you happened to pay has no effect on where a stock goes next. What matters is the value of the business and its future, not the number you paid.',
    },
    bias: {
      name: 'Anchoring',
      facts:
        'The CFA Institute describes anchoring as fixating on a specific number — like your purchase price — for example refusing to sell a weak stock “until it gets back to what I paid.”',
      fix: 'Ask: “If I had cash today, would I still buy this?” — not “what did I pay?”',
    },
    sources: [
      { label: 'SEC / Investor.gov — Investing Basics Glossary (Investment 101)', url: 'https://www.investor.gov/introduction-investing/investing-basics/glossary' },
      { label: 'Investopedia — Benjamin Graham', url: 'https://www.investopedia.com/terms/b/bengraham.asp' },
      { label: 'CFA Institute — The Behavioral Biases of Individuals', url: 'https://www.cfainstitute.org/insights/professional-learning/refresher-readings/2026/the-behavioral-biases-of-individuals' },
      { label: 'SEC / Investor.gov — Investing Basics Glossary', url: 'https://www.investor.gov/introduction-investing/investing-basics/glossary' },
    ],
  },
  {
    topic: 'Start small, start early',
    basics: {
      title: 'Compounding and starting early',
      facts:
        'Compounding is when your earnings start earning their own earnings, snowballing over time. The earlier and more consistently you invest, the more powerful it becomes. Time is a young investor’s single biggest advantage — even small amounts, like a few dollars a day, can grow remarkably over many years.',
    },
    story: {
      title: 'Warren Buffett bought his first stock at age 11',
      facts:
        'Warren Buffett bought his very first stock when he was just 11 years old — and later joked that he had actually started too late! The stock dropped before it recovered, which taught him patience early on. Buffett built his enormous wealth largely by starting young and letting compounding — when your earnings start earning their own earnings — work for decades. He describes wealth-building like a snowball: small amounts, rolled forward consistently over a long time, can grow into something huge.',
    },
    technical: {
      title: 'The quiet power of compounding',
      facts:
        'The SEC explains that the earlier and more consistently you invest, the more time compounding has to work. A $5-a-day habit looks tiny today but has many years to grow.',
    },
    bias: {
      name: 'Impatience',
      facts:
        'Compounding is slow at the start, which tempts beginners to give up right before it becomes powerful.',
      fix: 'Think in years, not days. The steady, patient investor often wins.',
    },
    sources: [
      { label: 'SEC / Investor.gov — Compound Interest (Investment 101)', url: 'https://www.investor.gov/introduction-investing/investing-basics/glossary/compound-interest' },
      { label: 'Investopedia — Warren Buffett', url: 'https://www.investopedia.com/terms/w/warrenbuffett.asp' },
      { label: 'SEC / Investor.gov — Compound Interest', url: 'https://www.investor.gov/introduction-investing/investing-basics/glossary/compound-interest' },
      { label: 'SEC — Beginners’ Guide to Asset Allocation', url: 'https://www.sec.gov/about/reports-publications/investorpubsassetallocationhtm' },
    ],
  },
]

const ANGLES = [
  'Open the story with a vivid, cinematic scene the reader can picture.',
  'Open with a surprising question that hooks the reader instantly.',
  'Open by putting the teen reader right in the moment ("Picture this: you are...").',
  'Open with a bold one-line hook, then unfold the story.',
  'Frame the story like the trailer for a movie.',
  'Start from the lesson, then reveal the true story behind it.',
]

function dayIndex(dateStr: string): number {
  const ms = Date.parse(dateStr + 'T00:00:00Z')
  if (Number.isNaN(ms)) return 0
  const day = Math.floor(ms / 86_400_000)
  return ((day % KB.length) + KB.length) % KB.length
}

function easternDateString(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
}

function fallbackMarkdown(e: KbEntry): string {
  return [
    `### 🎓 Investment 101 — ${e.basics.title}`,
    e.basics.facts,
    ``,
    `### 📖 The Story — ${e.story.title}`,
    e.story.facts,
    ``,
    `### 📊 Technical Insight — ${e.technical.title}`,
    e.technical.facts,
    ``,
    `### 🧠 Beating a Bias — ${e.bias.name}`,
    `${e.bias.facts} **Try this:** ${e.bias.fix}`,
  ].join('\n')
}

// Did the model actually return all three sections at a sensible length?
function isComplete(md: string): boolean {
  if (!md) return false
  const has101 = /🎓|investment 101/i.test(md)
  const hasStory = /📖|the story/i.test(md)
  const hasTech = /📊|technical insight/i.test(md)
  const hasBias = /🧠|beating a bias/i.test(md)
  const words = md.trim().split(/\s+/).length
  return has101 && hasStory && hasTech && hasBias && words >= 340
}

function buildMessages(entry: KbEntry, angle: string): ChatMessage[] {
  const grounding = [
    `THEME: ${entry.topic}`,
    ``,
    `INVESTMENT 101 BASICS (authoritative — teach this clearly and simply):`,
    `- Title: ${entry.basics.title}`,
    `- ${entry.basics.facts}`,
    ``,
    `TRUE STORY (authoritative facts — do not change names, numbers, dates, or quotes):`,
    `- Title: ${entry.story.title}`,
    `- ${entry.story.facts}`,
    ``,
    `TECHNICAL INSIGHT (authoritative):`,
    `- Title: ${entry.technical.title}`,
    `- ${entry.technical.facts}`,
    ``,
    `BEHAVIORAL BIAS (authoritative):`,
    `- Name: ${entry.bias.name}`,
    `- ${entry.bias.facts}`,
    `- How to beat it: ${entry.bias.fix}`,
  ].join('\n')

  const system =
    'You are both a best-selling teen finance author and a professional investment tutor. You make money, investing, and financial psychology genuinely exciting for teenagers — vivid, warm, and inspiring like the best young-adult nonfiction — while patiently building their financial IQ (knowledge) and EQ (emotional self-control). ' +
    'Write today’s daily read in Markdown with EXACTLY four sections, using ONLY the facts provided to you. Write about 200 words for Investment 101 and 100–200 words for each of the other three (about 500–800 words total). ' +
    'Use these exact headings in this order: "### 🎓 Investment 101", "### 📖 The Story", "### 📊 Technical Insight", and "### 🧠 Beating a Bias". ' +
    'In Investment 101, teach the core concept clearly like a great tutor — define it simply, give a relatable teen example, and add one short note on the EMOTIONAL side (EQ) of handling it well. ' +
    'In The Story, bring the real person or event to life and pull out the lesson for a young $5-a-day investor. ' +
    'Rules you must follow strictly: do NOT invent or change any numbers, dates, names, or quotes — use only what is given; ' +
    'do NOT promise or imply any returns; do NOT recommend or name a specific stock, ticker, or fund to buy; ' +
    'do NOT encourage day trading, options, leverage, crypto speculation, or hype-chasing; do NOT give personalized financial advice. ' +
    'Keep it teen-friendly and encouraging. End the final section with one short, inspiring sentence. ' +
    'Do not add a disclaimer or a sources list — those are shown separately. Write the full three sections; do not stop early.'

  return [
    { role: 'system', content: system },
    { role: 'user', content: `Creative angle for THIS retelling (keep it fresh and different from other days): ${angle}\n\nWrite today’s four-section read (about 200 words for Investment 101, 100–200 words for the others) from these facts only:\n\n${grounding}` },
  ]
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const date = url.searchParams.get('date') || easternDateString()
  const entry = KB[dayIndex(date)]
  const angle = ANGLES[Math.floor(Math.random() * ANGLES.length)]

  const noStore = { headers: { 'Cache-Control': 'no-store, max-age=0' } }
  let markdown = ''
  let generated = false

  try {
    // Generous output budget so "thinking" models still finish all three sections.
    const r1 = await chatWithFallback({ messages: buildMessages(entry, angle), temperature: 0.85, maxTokens: 8000 }, DEFAULT_MODEL_ID)
    markdown = (r1.content || '').trim()
    generated = isComplete(markdown)

    if (!generated) {
      // Retry once on a proven, reliable model with a different angle.
      const angle2 = ANGLES[Math.floor(Math.random() * ANGLES.length)]
      const r2 = await chatWithFallback({ messages: buildMessages(entry, angle2), temperature: 0.8, maxTokens: 8000 }, 'gemini-2.5-flash')
      const md2 = (r2.content || '').trim()
      if (isComplete(md2)) { markdown = md2; generated = true }
    }

    if (!generated) { markdown = fallbackMarkdown(entry) }
  } catch (err) {
    console.error('[GET /api/investment/tip]', err)
    markdown = fallbackMarkdown(entry)
    generated = false
  }

  return NextResponse.json({
    date,
    topic: entry.topic,
    storyTitle: entry.story.title,
    biasName: entry.bias.name,
    markdown,
    sources: entry.sources,
    generated,
  }, noStore)
}
