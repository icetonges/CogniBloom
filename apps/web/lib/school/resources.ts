/**
 * Study sources and progression ladders per course.
 *
 * Two kinds of material live here:
 *
 *  1. **Authoritative** — what Fairfax County actually assigns or publishes:
 *     the FCPS course pages, the Virginia DOE Standards of Learning that the
 *     course is written against, and the district's licensed digital tools.
 *     These are the things a teacher will grade against.
 *
 *  2. **Challenge ladders** — level-by-level enrichment past the course
 *     ceiling, for the honors/AA tracks and for competition math (AMC 8 →
 *     AMC 10, MATHCOUNTS). Each rung names a concrete next action, so the
 *     study coach can say "you are on rung 3, do this next" instead of
 *     handing over a reading list.
 *
 * Links are to stable landing pages, never deep links that rot mid-year.
 */

export type SourceKind = 'official' | 'platform' | 'standard' | 'practice' | 'enrichment' | 'competition'

export interface StudySource {
  label: string
  url: string
  kind: SourceKind
  /** Why this one — shown as the hint under the link. */
  note: string
}

export interface LadderRung {
  level: number
  title: string
  /** What "done" looks like at this rung. */
  goal: string
  /** The concrete next action. */
  action: string
  /** Roughly how long this rung takes at 30-40 min/day. */
  span: string
}

export interface CourseResources {
  courseId: string
  /** One-line description of what the course is actually about this year. */
  arc: string
  sources: StudySource[]
  ladder: LadderRung[]
  /** Recurring habits that move the needle in this specific class. */
  habits: string[]
}

// ── District-wide, every course ─────────────────────────────────────────────

export const DISTRICT_SOURCES: StudySource[] = [
  {
    label: 'FCPS Schoology',
    url: 'https://fcps.schoology.com/',
    kind: 'official',
    note: 'Where assignments, due dates and course materials are posted. Check it before you plan the evening.',
  },
  {
    label: 'SIS StudentVUE',
    url: 'https://www.fcps.edu/services/technology/tools/sis-studentvue',
    kind: 'official',
    note: 'Live gradebook. Look at the assignment list, not just the letter — the zeros are what move an A to a B.',
  },
  {
    label: 'FCPS Digital Resources by Grade',
    url: 'https://www.fcps.edu/services/technology/grade-level-digital-resources',
    kind: 'platform',
    note: 'The full list of tools your FCPS account already pays for — databases, Britannica, Gale, and more.',
  },
  {
    label: 'FCPS Middle School Honors (Grades 7-8)',
    url: 'https://www.fcps.edu/academics/advanced-academic-programs-aap/middle/honors-grades-7-8',
    kind: 'official',
    note: 'What the AA / Honors designation actually expects of you — worth reading once in September.',
  },
  {
    label: 'Virginia DOE Standards of Learning',
    url: 'https://www.doe.virginia.gov/teaching-learning-assessment/k-12-standards-instruction',
    kind: 'standard',
    note: 'The SOL documents your courses are written against. The end-of-year test comes from here.',
  },
]

// ── Per-course ──────────────────────────────────────────────────────────────

export const COURSE_RESOURCES: readonly CourseResources[] = [
  {
    courseId: 'algebra',
    arc: 'Algebra 1 Honors — a full high-school credit taken in 7th grade, ending in the Algebra I SOL. Expressions and equations → functions → linear systems → quadratics and statistics.',
    sources: [
      { label: 'FCPS Middle School Mathematics', url: 'https://www.fcps.edu/academics/middle/mathematics', kind: 'official', note: 'Course sequence and what Algebra 1 in middle school commits you to.' },
      { label: 'VDOE Mathematics SOL — Algebra I', url: 'https://www.doe.virginia.gov/teaching-learning-assessment/k-12-standards-instruction/mathematics', kind: 'standard', note: 'The A.1–A.9 standards. Print the one-page list and tick them off as you master them.' },
      { label: 'Desmos Graphing Calculator', url: 'https://www.desmos.com/calculator', kind: 'platform', note: 'Graph every function you meet. Seeing the shape is half of Algebra 1.' },
      { label: 'Khan Academy — Algebra 1', url: 'https://www.khanacademy.org/math/algebra', kind: 'practice', note: 'Free, mastery-based, aligned unit-for-unit. Your fallback when a lesson did not land.' },
      { label: 'DeltaMath', url: 'https://www.deltamath.com/', kind: 'practice', note: 'Commonly assigned in FCPS math. Infinite regenerating practice — use it past the assigned set.' },
      { label: 'Art of Problem Solving — Introduction to Algebra', url: 'https://artofproblemsolving.com/store', kind: 'enrichment', note: 'The step past the textbook. Harder, deeper, and the standard prep for competition math.' },
      { label: 'AoPS Alcumus', url: 'https://artofproblemsolving.com/alcumus', kind: 'practice', note: 'Free adaptive problem engine. 15 minutes a day compounds faster than anything else on this list.' },
    ],
    ladder: [
      { level: 1, title: 'Never behind', goal: 'Every assigned problem set finished the night it is given, nothing in the gradebook missing.', action: 'Check Schoology at 4 PM; do the set before dinner, not after.', span: 'Ongoing' },
      { level: 2, title: 'Fluent, not just correct', goal: 'Solve routine equations and graph lines without stopping to think about the procedure.', action: '10 timed DeltaMath problems a day on the current unit until speed feels boring.', span: '2-3 weeks per unit' },
      { level: 3, title: 'Explain it cold', goal: 'Teach the current unit out loud, in your own words, with no notes.', action: 'Record a 3-minute explanation into a note after each unit. If you stall, that is the gap.', span: 'Per unit' },
      { level: 4, title: 'Non-routine problems', goal: 'Handle problems where the method is not stated in the question.', action: 'AoPS Alcumus, Algebra topics, 15 min/day. Push the difficulty dial up when accuracy passes 80%.', span: 'Ongoing from October' },
      { level: 5, title: 'AMC 8 ready', goal: 'Comfortably score in the honor-roll range on past AMC 8 papers.', action: 'One full past AMC 8 every other Saturday; review every miss to root cause.', span: 'Sept → competition' },
      { level: 6, title: 'Reach into AMC 10', goal: 'Attempt AMC 10 problems 1-15 with real success.', action: 'AoPS Introduction to Algebra chapters past the school syllabus + AMC 10 problems 1-10 weekly.', span: 'Spring' },
    ],
    habits: [
      'Redo every problem you got wrong on a quiz — same day, from scratch, no peeking.',
      'Keep an "error log" note: the mistake, the cause, the fix. Reread it before each test.',
      'Graph it in Desmos before you trust an algebraic answer.',
    ],
  },
  {
    courseId: 'life-science',
    arc: 'Life Science AA — cells and cell processes → genetics and heredity → classification and ecosystems → change over time. Lab work and the scientific method run through all of it.',
    sources: [
      { label: 'VDOE Science SOL — Life Science', url: 'https://www.doe.virginia.gov/teaching-learning-assessment/k-12-standards-instruction/science', kind: 'standard', note: 'Standards LS.1–LS.12. LS.1 (scientific investigation) shows up on every single lab.' },
      { label: 'FCPS Digital Resources — Britannica & Gale', url: 'https://www.fcps.edu/services/technology/grade-level-digital-resources', kind: 'platform', note: 'Your FCPS login unlocks these. Citable, unlike a random search result.' },
      { label: 'Khan Academy — Biology', url: 'https://www.khanacademy.org/science/biology', kind: 'practice', note: 'Goes deeper than 7th grade; use the cell, genetics and ecology units.' },
      { label: 'HHMI BioInteractive', url: 'https://www.biointeractive.org/', kind: 'enrichment', note: 'Real scientific data and click-through case studies. Excellent for the AA extension work.' },
      { label: 'Science Olympiad', url: 'https://www.soinc.org/', kind: 'competition', note: 'If Frost runs a team, the life-science events line up directly with this course.' },
    ],
    ladder: [
      { level: 1, title: 'Lab-notebook discipline', goal: 'Every lab written up the same day with a clean hypothesis, variables, and conclusion.', action: 'Use the same five headings every time: Question · Hypothesis · Variables · Data · Conclusion.', span: 'Ongoing' },
      { level: 2, title: 'Vocabulary as a system', goal: 'Know every unit term and how the terms connect, not just the definitions.', action: 'Build a flashcard deck per unit; add the *relationship* to the back, not only the definition.', span: 'Per unit' },
      { level: 3, title: 'Draw the mechanism', goal: 'Sketch mitosis, a Punnett square, or an energy pyramid from memory.', action: 'Weekly mind map in the planner: one process, branched out with no notes open.', span: 'Weekly' },
      { level: 4, title: 'Read real data', goal: 'Interpret a graph or dataset you have never seen and say what it means.', action: 'One HHMI BioInteractive data activity every other week.', span: 'Ongoing' },
      { level: 5, title: 'Independent investigation', goal: 'Design and run your own controlled experiment end to end.', action: 'Pick a question in October, run it over 4 weeks, write it up like a real paper.', span: 'One per semester' },
    ],
    habits: [
      'Turn each lecture into one diagram, not a wall of text.',
      'Before a test, explain each process to someone as a story with a beginning and end.',
    ],
  },
  {
    courseId: 'english',
    arc: 'English 7 AA — close reading of fiction and nonfiction, argument and analytical writing, vocabulary in context, and research with real citations.',
    sources: [
      { label: 'VDOE English SOL — Grade 7', url: 'https://www.doe.virginia.gov/teaching-learning-assessment/k-12-standards-instruction/english', kind: 'standard', note: 'Reading, writing, research and communication standards for 7th grade.' },
      { label: 'FCPS Library Databases', url: 'https://www.fcps.edu/services/technology/grade-level-digital-resources', kind: 'platform', note: 'Where research papers should start. Cite these, not a search engine.' },
      { label: 'Your reading list & tutor', url: '/dashboard/english', kind: 'official', note: 'All 43 texts Ms. Champagne may assign, with the Socratic reading coach and your per-book study folders.' },
      { label: 'Purdue OWL', url: 'https://owl.purdue.edu/owl/purdue_owl.html', kind: 'official', note: 'The citation and grammar reference that will still be right in college.' },
      { label: 'CommonLit', url: 'https://www.commonlit.org/', kind: 'practice', note: 'Free leveled passages with text-dependent questions — the exact skill the SOL tests.' },
      { label: 'Membean / vocabulary in context', url: 'https://membean.com/', kind: 'practice', note: 'Roots-based vocabulary. Beats memorising word lists for retention.' },
    ],
    ladder: [
      { level: 1, title: 'Annotate everything', goal: 'No passage read passively — every text gets marks and margin notes.', action: 'Three annotations per page minimum: a question, a reaction, a connection.', span: 'Ongoing' },
      { level: 2, title: 'Thesis first', goal: 'Write a specific, arguable thesis before drafting anything.', action: 'One sentence, on paper, approved by yourself out loud before paragraph one.', span: 'Per essay' },
      { level: 3, title: 'Evidence that earns its place', goal: 'Every quotation followed by two sentences of your own analysis.', action: 'Use the quote-sandwich: set up → quote → explain why it proves the thesis.', span: 'Per essay' },
      { level: 4, title: 'Revise, do not just edit', goal: 'A second draft that changes structure, not only commas.', action: 'Draft, sleep on it, then reorder the paragraphs before fixing sentences.', span: 'Per essay' },
      { level: 5, title: 'Write beyond the assignment', goal: 'Produce writing nobody asked for and get it read.', action: 'Enter a writing contest, or publish a piece in the Learning Chronicle each month.', span: 'Monthly' },
    ],
    habits: [
      'Read 20 minutes a night from a book that is a little too hard.',
      'Collect strong sentences you encounter; steal their structure, not their words.',
    ],
  },
  {
    courseId: 'us-history',
    arc: 'US History 7 (USII) — the United States from 1865 to the present: Reconstruction, industry and immigration, the world wars, civil rights, and the modern era. Heavy on primary sources and geography.',
    sources: [
      { label: 'VDOE History & Social Science SOL — USII', url: 'https://www.doe.virginia.gov/teaching-learning-assessment/k-12-standards-instruction/history-social-science', kind: 'standard', note: 'The USII.1–USII.9 standards define exactly what is on the test.' },
      { label: 'Library of Congress — Primary Source Sets', url: 'https://www.loc.gov/classroom-materials/', kind: 'official', note: 'The actual documents, photographs and maps. This is what AA-level analysis is built on.' },
      { label: 'National Archives — DocsTeach', url: 'https://www.docsteach.org/', kind: 'enrichment', note: 'Primary-source activities built by the National Archives. Great for document-based questions.' },
      { label: 'Khan Academy — US History', url: 'https://www.khanacademy.org/humanities/us-history', kind: 'practice', note: 'Clear narrative to fill gaps between units.' },
      { label: 'National History Day', url: 'https://www.nhd.org/', kind: 'competition', note: 'Year-long research project competition — the natural next level for an AA history student.' },
    ],
    ladder: [
      { level: 1, title: 'Timeline in your head', goal: 'Place any major event in the right decade without looking.', action: 'Keep one running wall timeline; add every event the moment you meet it.', span: 'Ongoing' },
      { level: 2, title: 'Cause and effect, not dates', goal: 'Explain why something happened and what it caused.', action: 'After each unit write three "because → therefore" chains.', span: 'Per unit' },
      { level: 3, title: 'Read a primary source', goal: 'Pull argument, audience and bias out of an original document.', action: 'One LOC or DocsTeach document a week, with a four-line analysis.', span: 'Weekly' },
      { level: 4, title: 'Argue from evidence', goal: 'Write a document-based response using three sources that disagree.', action: 'Pick a contested question per unit and defend a position in a page.', span: 'Per unit' },
      { level: 5, title: 'Original research', goal: 'Investigate something nobody assigned you.', action: 'Build a National History Day project, or a deep note in the Learning Chronicle.', span: 'Semester-long' },
    ],
    habits: [
      'Map it — if you cannot point to where it happened, you do not know it yet.',
      'For every "what", ask "who benefited?"',
    ],
  },
  {
    courseId: 'french',
    arc: 'French 1 Part A — the first half of high-school French 1, spread across a full year. Sound system, present-tense verbs, core vocabulary, and everyday conversation.',
    sources: [
      { label: 'FCPS World Languages', url: 'https://www.fcps.edu/academics/academic-overview/world-languages', kind: 'official', note: 'The Part A / Part B sequence and where it leads in high school.' },
      { label: 'Duolingo — French', url: 'https://www.duolingo.com/course/fr/en/Learn-French', kind: 'practice', note: 'Already in the daily routine. Keep it short and keep the streak.' },
      { label: 'Quizlet / flashcards', url: 'https://quizlet.com/subject/french/', kind: 'practice', note: 'Vocabulary lists per chapter — but say them out loud, do not just read them.' },
      { label: 'TV5MONDE — Apprendre le français', url: 'https://apprendre.tv5monde.com/', kind: 'enrichment', note: 'Real French video graded by level. Start at A1 and do not translate in your head.' },
      { label: 'Le Petit Journal / RFI Journal en français facile', url: 'https://francaisfacile.rfi.fr/', kind: 'enrichment', note: 'Slow-spoken French news with transcripts. Ten minutes a day rebuilds your ear.' },
      { label: 'National French Contest (Le Grand Concours)', url: 'https://www.frenchteachers.org/concours/', kind: 'competition', note: 'March exam through AATF — ask Mme Beardsley whether Frost enters students.' },
    ],
    ladder: [
      { level: 1, title: 'Sound before spelling', goal: 'Read any new word aloud with correct French sounds.', action: 'Read the chapter vocabulary out loud daily — five minutes, no exceptions.', span: 'First quarter' },
      { level: 2, title: 'Verbs on reflex', goal: 'Conjugate -er, -ir, -re, être, avoir and aller without hesitating.', action: 'Two-minute daily conjugation drill from memory, written not typed.', span: 'Ongoing' },
      { level: 3, title: 'Say something real', goal: 'Hold a 60-second unscripted conversation on a familiar topic.', action: 'Record yourself for 60 seconds a week; listen back and fix one thing.', span: 'Weekly' },
      { level: 4, title: 'Input beyond class', goal: 'Understand the gist of native audio at slow speed.', action: 'One RFI "français facile" segment a day with the transcript.', span: 'From November' },
      { level: 5, title: 'Compete and certify', goal: 'Test yourself against students outside Frost.', action: 'Sit Le Grand Concours in the spring; aim for the next level up next year.', span: 'Spring' },
    ],
    habits: [
      'Never learn a noun without its article — le/la is part of the word.',
      'Label things around your room in French for a week per unit.',
    ],
  },
  {
    courseId: 'engineering',
    arc: 'Engineering 1: Design & Modeling — the PLTW Gateway design-and-modeling unit. Sketching, measurement, the engineering design process, 3D CAD modelling and prototyping.',
    sources: [
      { label: 'PLTW Gateway — Design and Modeling', url: 'https://www.pltw.org/our-programs/pltw-gateway', kind: 'official', note: 'The national curriculum this course runs on. Read the unit overview to see where it goes.' },
      { label: 'FCPS Career & Technical Education', url: 'https://www.fcps.edu/academics/high-school-academics-course-information/career-and-technical-education', kind: 'official', note: 'How Engineering 1 connects to the high-school CTE and engineering pathway.' },
      { label: 'Autodesk Fusion for Education', url: 'https://www.autodesk.com/education/edu-software/overview', kind: 'platform', note: 'Free with a student account. The CAD skill transfers straight to high school and beyond.' },
      { label: 'Onshape for Education', url: 'https://www.onshape.com/en/education/', kind: 'platform', note: 'Browser-based CAD — works on a Chromebook when desktop CAD will not.' },
      { label: 'TeachEngineering', url: 'https://www.teachengineering.org/', kind: 'enrichment', note: 'Thousands of tested design challenges if you want a project beyond the syllabus.' },
      { label: 'Technology Student Association (TSA)', url: 'https://tsaweb.org/', kind: 'competition', note: 'Middle-school design competitions; ask Mr. Fox whether Frost has a chapter.' },
    ],
    ladder: [
      { level: 1, title: 'Sketch honestly', goal: 'Freehand isometric and orthographic sketches that another person could build from.', action: 'One object a day sketched in three views in the engineering notebook.', span: 'First 6 weeks' },
      { level: 2, title: 'Measure like an engineer', goal: 'Use a scale and calipers to the correct precision, with units every time.', action: 'Measure five household objects and dimension the sketches properly.', span: 'Weeks 3-6' },
      { level: 3, title: 'Model it in CAD', goal: 'Reproduce any of your sketches as a parametric 3D model.', action: 'Rebuild one sketch a week in Onshape or Fusion.', span: 'Ongoing' },
      { level: 4, title: 'Design for a constraint', goal: 'Solve a problem where cost, material or size is genuinely limited.', action: 'Take one TeachEngineering challenge per month and document the whole design process.', span: 'Monthly' },
      { level: 5, title: 'Build and iterate', goal: 'A physical prototype, tested, then improved based on what failed.', action: 'Use the Maker Space; log version 1 → what broke → version 2.', span: 'Per project' },
    ],
    habits: [
      'The notebook is the deliverable — date every page, never erase, cross out instead.',
      'Photograph every prototype before you take it apart.',
    ],
  },
  {
    courseId: 'coding',
    arc: 'Coding & Innovation Technology — computational thinking, algorithms, and building working programs. Where the S1 engineering slot goes in the second semester.',
    sources: [
      { label: 'FCPS Computer Science', url: 'https://www.fcps.edu/academics/academic-overview/computer-science', kind: 'official', note: 'The FCPS CS pathway from middle school through high school.' },
      { label: 'Code.org — CS Discoveries', url: 'https://code.org/educate/csd', kind: 'platform', note: 'Widely used in FCPS middle schools; free and self-paceable past the assigned units.' },
      { label: 'Python for Everybody', url: 'https://www.py4e.com/', kind: 'practice', note: 'Free, gentle, complete. The real next step once blocks stop being enough.' },
      { label: 'Replit', url: 'https://replit.com/', kind: 'platform', note: 'Write and run code in the browser on a Chromebook — no install needed.' },
      { label: 'CodingBat / Codewars', url: 'https://www.codingbat.com/python', kind: 'practice', note: 'Short problems that build fluency. Ten a week is plenty.' },
      { label: 'USACO', url: 'https://usaco.org/', kind: 'competition', note: 'The long-term target for competitive programming. Bronze division is reachable with a year of work.' },
    ],
    ladder: [
      { level: 1, title: 'Finish what is assigned', goal: 'Every Code.org lesson complete, nothing skipped.', action: 'Do the assigned level plus the "challenge" variant of it.', span: 'Ongoing' },
      { level: 2, title: 'Text, not blocks', goal: 'Write working Python without a block editor.', action: 'Py4E chapters 1-5, one chapter a week, typing every example yourself.', span: '5 weeks' },
      { level: 3, title: 'Build something nobody assigned', goal: 'A small program you actually use.', action: 'Pick one annoyance in your week and automate it.', span: 'One per month' },
      { level: 4, title: 'Think in algorithms', goal: 'Choose the right approach before writing code.', action: 'Ten CodingBat or Codewars problems a week; always write the plan first in comments.', span: 'Ongoing' },
      { level: 5, title: 'Compete', goal: 'Solve timed problems under contest conditions.', action: 'Work USACO Bronze past problems on Saturdays.', span: 'Spring onward' },
    ],
    habits: [
      'Read the error message all the way through before changing anything.',
      'Comment the *why*, never the *what*.',
    ],
  },
  {
    courseId: 'pe-s1',
    arc: 'Health & PE 7 — fitness testing, team and individual activities, and a health curriculum covering nutrition, body systems, wellbeing and decision-making.',
    sources: [
      { label: 'FCPS Health & Physical Education', url: 'https://www.fcps.edu/academics/academic-overview/health-and-physical-education', kind: 'official', note: 'What the course covers and how the health units are graded.' },
      { label: 'VDOE Health & PE SOL', url: 'https://www.doe.virginia.gov/teaching-learning-assessment/k-12-standards-instruction/health-physical-education-driver-education', kind: 'standard', note: 'The grade-7 standards behind the health quizzes.' },
      { label: 'MyPlate', url: 'https://www.myplate.gov/', kind: 'practice', note: 'The federal nutrition framework the health unit uses.' },
    ],
    ladder: [
      { level: 1, title: 'Always dressed out', goal: 'Never lose participation points to a forgotten kit.', action: 'Gym bag packed the night before, on the Gray-day checklist.', span: 'Ongoing' },
      { level: 2, title: 'Baseline your fitness', goal: 'Know your current numbers on each fitness test.', action: 'Record the first-week results and set a target for the semester.', span: 'September' },
      { level: 3, title: 'Train, do not just attend', goal: 'Improve one measurable number.', action: 'The three daily workout sets in the planner, aimed at your weakest test.', span: 'Ongoing' },
      { level: 4, title: 'Health units taken seriously', goal: 'Treat health quizzes like science quizzes.', action: 'Flashcard deck per health unit; ten minutes the night before.', span: 'Per unit' },
    ],
    habits: ['Water bottle filled before period 6.', 'Lock the locker, every time.'],
  },
  {
    courseId: 'ta-activity',
    arc: 'TA / Activity — the daily period-4 block with recess and advisory. The single best 45 minutes in the day for staying ahead.',
    sources: [
      { label: 'FCPS Schoology', url: 'https://fcps.schoology.com/', kind: 'official', note: 'Use advisory to check every course for anything posted since yesterday.' },
    ],
    ladder: [
      { level: 1, title: 'Use it, do not waste it', goal: 'Leave period 4 with at least one thing crossed off.', action: 'Open the planner at the start of the block and pick the smallest open item.', span: 'Daily' },
      { level: 2, title: 'Ask the question', goal: 'Never carry a confusion home.', action: 'Office hours in period 4 — bring one specific question, not "I don\'t get it".', span: 'Daily' },
    ],
    habits: ['Check Schoology for all seven courses during advisory.'],
  },
]

// ── Competition calendar ────────────────────────────────────────────────────

export interface Competition {
  id: string
  name: string
  window: string
  url: string
  why: string
  subject: string
}

export const COMPETITIONS: readonly Competition[] = [
  {
    id: 'amc8',
    name: 'AMC 8',
    window: 'Typically January — registration opens in the autumn through the school',
    url: 'https://maa.org/student-programs/amc/',
    why: 'The entry point to competition math. 25 questions, 40 minutes, no calculator. Algebra 1 Honors already covers most of the algebra on it.',
    subject: 'Math',
  },
  {
    id: 'amc10',
    name: 'AMC 10',
    window: 'Typically November — open to any student in grade 10 or below',
    url: 'https://maa.org/student-programs/amc/',
    why: 'The next rung after AMC 8, and Daniel is eligible now. Problems 1-10 are within reach with Algebra 1 plus AoPS work.',
    subject: 'Math',
  },
  {
    id: 'mathcounts',
    name: 'MATHCOUNTS',
    window: 'School round in the autumn, chapter competition in February',
    url: 'https://www.mathcounts.org/',
    why: 'Team-based middle-school math. Ask the math department whether Frost fields a team.',
    subject: 'Math',
  },
  {
    id: 'scioly',
    name: 'Science Olympiad',
    window: 'Regional tournaments in late winter',
    url: 'https://www.soinc.org/',
    why: 'Life-science events map directly onto the AA course content.',
    subject: 'Science',
  },
  {
    id: 'nhd',
    name: 'National History Day',
    window: 'Project runs autumn → regional contest in the spring',
    url: 'https://www.nhd.org/',
    why: 'A year-long original research project — the strongest possible extension of US History AA.',
    subject: 'History',
  },
  {
    id: 'concours',
    name: 'Le Grand Concours (National French Contest)',
    window: 'Exam window in March',
    url: 'https://www.frenchteachers.org/concours/',
    why: 'A national benchmark for French 1 students.',
    subject: 'French',
  },
]

// ── Lookups ─────────────────────────────────────────────────────────────────

export function resourcesFor(courseId: string): CourseResources | undefined {
  // The two PE semester sections share one resource entry.
  const id = courseId === 'pe-s2' ? 'pe-s1' : courseId
  return COURSE_RESOURCES.find((r) => r.courseId === id)
}

export function competitionsForSubject(subject: string): Competition[] {
  return COMPETITIONS.filter((c) => c.subject === subject)
}
