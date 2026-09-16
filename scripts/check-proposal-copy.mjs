#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

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
  'sync',
  'synced',
  'database',
  'endpoint',
  'automation',
  'automated'
]

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const target = resolve(root, 'app/utils/proposal.ts')
const lines = readFileSync(target, 'utf8').split('\n')

const start = lines.findIndex((line) => line.includes('export const PROPOSAL_SLIDES'))
if (start === -1) {
  console.error('proposal copy: could not find "export const PROPOSAL_SLIDES" in app/utils/proposal.ts')
  process.exit(1)
}

const patterns = BANNED.map((term) => ({
  term,
  re: new RegExp(`(^|[^a-z0-9])${term.replace(/ /g, '\\s+')}(?![a-z0-9])`, 'i')
}))

const hits = []
for (let i = start; i < lines.length; i++) {
  for (const { term, re } of patterns) {
    if (re.test(lines[i])) hits.push({ line: i + 1, term, text: lines[i].trim() })
  }
}

if (hits.length > 0) {
  for (const hit of hits) console.log(`line:${hit.line}  ${hit.term}  ${hit.text}`)
  process.exit(1)
}

console.log('proposal copy: clean')
process.exit(0)
