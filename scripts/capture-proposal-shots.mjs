#!/usr/bin/env node
/**
 * Pictures for the /proposal deck, taken from the demo itself.
 *
 * The deck must never show a hand-drawn mock-up of a screen that exists. This
 * script builds the app, serves it on port 3200 with the in-memory seed (no
 * env, no database), drives the installed Chrome through `playwright-core`
 * and writes one PNG per screen into `public/proposal/`. Those PNGs are
 * committed, so a reviewer can rerun this and diff the pictures.
 *
 *   node scripts/capture-proposal-shots.mjs            # rebuild if needed, capture
 *   node scripts/capture-proposal-shots.mjs --build    # force a rebuild first
 *   node scripts/capture-proposal-shots.mjs --proof    # also shoot the deck itself
 *
 * `--proof` writes the review screenshots of the deck (slides at 1440 and 525
 * wide) into `.local/proof/`, which is not committed. Run it after the deck
 * PNGs exist and the app has been rebuilt, or the deck will photograph with
 * missing pictures.
 *
 * Chrome comes from the machine (`channel: 'chrome'`); nothing is downloaded.
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, rm } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PORT = 3200
const ORIGIN = `http://127.0.0.1:${PORT}`
const SHOT_DIR = resolve(ROOT, 'public/proposal')
const PROOF_DIR = resolve(ROOT, '.local/proof')
const WIDE = { width: 1440, height: 900 }

const args = new Set(process.argv.slice(2))
const forceBuild = args.has('--build')
const withProof = args.has('--proof')

/**
 * One picture. `at` is the route, `waitFor` is the thing that proves the seed
 * has landed, and `click` is the short path to the state the slide talks about
 * (the inbox has to be showing Brendan's WhatsApp, not an empty pane).
 */
const SHOTS = [
  { file: 'doors.png', at: '/', waitFor: 'text=Internal ops' },
  { file: 'jobs.png', at: '/ops/jobs', waitFor: 'text=MP-3318-MC' },
  { file: 'job-card.png', at: '/ops/jobs/MP-3318-MC', waitFor: 'text=MP-3318-MC' },
  {
    file: 'inbox.png',
    at: '/ops/inbox',
    waitFor: 'text=Pick a conversation',
    click: ['text=Needs reply', 'text=Brendan De Souza']
  },
  { file: 'reviews.png', at: '/ops/reviews', waitFor: 'text=MP-8125-HF' },
  { file: 'rewards.png', at: '/ops/rewards', waitFor: 'text=Review programme' }
]

/** Deck slides worth a reviewer's eye, shot at desk and phone width. */
const PROOF_SLIDES = ['title', 'job-card', 'two-systems']
const PROOF_WIDTHS = [1440, 525]

function run(cmd, cmdArgs, opts = {}) {
  return new Promise((ok, fail) => {
    const p = spawn(cmd, cmdArgs, { cwd: ROOT, stdio: 'inherit', ...opts })
    p.on('error', fail)
    p.on('exit', (code) => (code === 0 ? ok() : fail(new Error(`${cmd} exited ${code}`))))
  })
}

async function waitForServer(timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(ORIGIN, { redirect: 'manual' })
      if (res.status < 500) return
    } catch {
      // not listening yet
    }
    await new Promise((r) => setTimeout(r, 400))
  }
  throw new Error(`server did not answer on ${ORIGIN}`)
}

async function main() {
  const server = resolve(ROOT, '.output/server/index.mjs')
  if (forceBuild || !existsSync(server)) {
    console.log('> nuxt build')
    await run('npx', ['nuxt', 'build'])
  }

  console.log(`> serving on ${ORIGIN}`)
  const child = spawn('node', [server], {
    cwd: ROOT,
    stdio: ['ignore', 'inherit', 'inherit'],
    env: { ...process.env, PORT: String(PORT), NITRO_PORT: String(PORT), HOST: '127.0.0.1' }
  })
  const stopServer = () => {
    if (!child.killed) child.kill('SIGTERM')
  }
  process.on('exit', stopServer)
  process.on('SIGINT', () => {
    stopServer()
    process.exit(130)
  })

  let browser
  try {
    await waitForServer()

    browser = await chromium.launch({ channel: 'chrome' })
    await mkdir(SHOT_DIR, { recursive: true })

    const page = await browser.newPage({ viewport: WIDE, deviceScaleFactor: 2 })
    for (const shot of SHOTS) {
      await page.goto(`${ORIGIN}${shot.at}`, { waitUntil: 'networkidle' })
      if (shot.waitFor) await page.waitForSelector(shot.waitFor, { timeout: 20_000 })
      for (const selector of shot.click ?? []) {
        await page.locator(selector).first().click()
        await page.waitForTimeout(500)
      }
      await page.waitForTimeout(1200)
      const out = resolve(SHOT_DIR, shot.file)
      await page.screenshot({ path: out })
      console.log(`  ${shot.at} -> public/proposal/${shot.file}`)
    }
    await page.close()

    if (withProof) {
      await rm(PROOF_DIR, { recursive: true, force: true })
      await mkdir(PROOF_DIR, { recursive: true })
      for (const width of PROOF_WIDTHS) {
        const deck = await browser.newPage({
          viewport: { width, height: width === 1440 ? 900 : 950 },
          deviceScaleFactor: 2
        })
        for (const slide of PROOF_SLIDES) {
          await deck.goto(`${ORIGIN}/proposal?slide=${slide}`, { waitUntil: 'networkidle' })
          await deck.waitForTimeout(900)
          const out = resolve(PROOF_DIR, `${slide}-${width}.png`)
          await deck.screenshot({ path: out })
          console.log(`  /proposal?slide=${slide} @${width} -> .local/proof/${slide}-${width}.png`)
        }
        await deck.close()
      }
    }
  } finally {
    if (browser) await browser.close()
    stopServer()
  }

  console.log('proposal shots: done')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
