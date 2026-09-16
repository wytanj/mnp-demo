#!/usr/bin/env node
/**
 * The /proposal deck lint.
 *
 * Two jobs:
 *
 *   1. Vocabulary. The customer's current software is never named, and no
 *      engineering word ever reaches the page. The deck is read by people who
 *      do not work in software, and one stray "API" undoes the whole tone.
 *   2. Shape. The deck is a walkthrough, not an essay: a headline of at most
 *      ten words, at most three captions of at most 25 words each, and under
 *      60 words of body copy on a slide.
 *
 * It imports `app/utils/proposal.ts` rather than reading it as text, so it
 * sees exactly the strings the page renders — captions, diagram labels, alt
 * text, button labels — and cannot be fooled by a comment or drift out of
 * step with a new block kind. Node strips the types on the way in, so this
 * needs Node 23+ (or 22.6+ with --experimental-strip-types).
 *
 *   node scripts/check-proposal-copy.mjs
 *
 * Exits 0 and prints the per-slide word counts, or exits 1 and prints one
 * line per problem.
 */
import { PROPOSAL_SLIDES, countWords, slideAltStrings, slideBodyStrings } from '../app/utils/proposal.ts'

/** Never say these. `freshdesk` and friends stand in for "any named tool". */
const BANNED = [
  'api',
  'apis',
  'bidirectional',
  'system of record',
  'webhook',
  'webhooks',
  'mcp',
  'dbos',
  'freshdesk',
  'zendesk',
  'hubspot',
  'integration',
  'integrations',
  'integrate',
  'sync',
  'synced',
  'syncing',
  'database',
  'endpoint',
  'endpoints',
  'automation',
  'automated'
]

const MAX_TITLE_WORDS = 10
const MAX_CAPTION_WORDS = 25
const MAX_CAPTIONS = 3
const MAX_BODY_WORDS = 60

if (!process.features.typescript) {
  console.error('proposal copy: needs Node 23+, or Node 22.6+ with --experimental-strip-types')
  process.exit(1)
}

const patterns = BANNED.map((term) => ({
  term,
  re: new RegExp(`(^|[^a-z0-9])${term.replace(/ /g, '\\s+')}(?![a-z0-9])`, 'i')
}))

const problems = []
const report = []

for (const slide of PROPOSAL_SLIDES) {
  const where = `slide:${slide.id}`

  // 1. Vocabulary — every string the slide puts on screen, alt text included.
  const strings = [slide.kicker, slide.title, ...slideBodyStrings(slide), ...slideAltStrings(slide)].filter(
    (s) => typeof s === 'string' && s.length > 0
  )

  for (const text of strings) {
    for (const { term, re } of patterns) {
      if (re.test(text)) problems.push(`${where}  banned word "${term}"  ${text}`)
    }
  }

  // 2. Shape.
  const titleWords = countWords(slide.title)
  if (titleWords > MAX_TITLE_WORDS) {
    problems.push(`${where}  headline is ${titleWords} words, at most ${MAX_TITLE_WORDS}  ${slide.title}`)
  }

  const captions = slide.captions ?? []
  if (captions.length > MAX_CAPTIONS) {
    problems.push(`${where}  ${captions.length} captions, at most ${MAX_CAPTIONS}`)
  }
  for (const caption of captions) {
    const words = countWords(caption.text)
    if (words > MAX_CAPTION_WORDS) {
      problems.push(`${where}  caption ${caption.n} is ${words} words, at most ${MAX_CAPTION_WORDS}  ${caption.text}`)
    }
  }

  const bodyWords = slideBodyStrings(slide).reduce((n, s) => n + countWords(s), 0)
  if (bodyWords >= MAX_BODY_WORDS) {
    problems.push(`${where}  ${bodyWords} body words, must stay under ${MAX_BODY_WORDS}`)
  }

  // A badge with no caption to read it (or the other way round) is a slide
  // that does not explain its own picture.
  if (slide.visual.kind === 'shot') {
    const marks = (slide.visual.marks ?? []).map((m) => m.n).sort().join(',')
    const numbers = captions.map((c) => c.n).sort().join(',')
    if (marks !== numbers) {
      problems.push(`${where}  badges [${marks}] do not match captions [${numbers}]`)
    }
  }

  report.push({ slide: slide.id, headline: titleWords, captions: captions.length, body: bodyWords })
}

if (problems.length > 0) {
  for (const problem of problems) console.log(problem)
  process.exit(1)
}

console.log(`proposal copy: clean — ${PROPOSAL_SLIDES.length} slides`)
for (const row of report) {
  console.log(
    `  ${row.slide.padEnd(18)} headline ${String(row.headline).padStart(2)}w  ` +
      `captions ${row.captions}  body ${String(row.body).padStart(2)}w`
  )
}
process.exit(0)
