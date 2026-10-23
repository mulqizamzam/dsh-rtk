const ANSI = /\u001B(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001B\\))/g
const TEST = /\b(?:cargo\s+(?:test|nextest|check|clippy)|(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?(?:test|lint|check|typecheck|build)|pytest|python(?:3)?\s+-m\s+pytest|go\s+test|vitest|jest|ruff\s+check|eslint|mypy|tsc\b|gradle\s+test|mvn\s+test)\b/i
const INSTALL = /\b(?:(?:npm|pnpm|yarn|bun)\s+(?:install|add|i|ci|update)|cargo\s+install|brew\s+(?:install|upgrade|update)|pip(?:3)?\s+install|uv\s+(?:sync|add|pip\s+install)|composer\s+install|dotnet\s+restore)\b/i
const DETAIL = /(?:^|[;&|]\s*)(?:(?:[A-Za-z_][A-Za-z0-9_]*=\S+)\s+)*(?:cat|sed|awk|head|tail|less|more|bat|rg|grep|find|tree|ls|pwd|printf|echo|xxd|hexdump|git\s+(?:diff|show|blame))\b/i
const FAIL = /^(?:\s*(?:FAIL(?:ED)?\b|ERROR:|FATAL:|fatal:|error:|Traceback \(most recent call last\)|permission denied|access denied|Unhandled exception\b|test result:\s*FAILED\b)|.*\b[1-9]\d*\s+failed\b)/i
const EXIT = /^\s*\[exit code:\s*-?\d+\]\s*$/i
const WARNING = /^\s*(?:warning:|warn(?:ing)?\b|⚠|note:|notice:)/i
const bytes = (text) => Buffer.byteLength(text, 'utf8')

export function normalizeOptions(options = {}) {
  const clamp = (v, fallback, min, max) => Number.isFinite(Number(v)) ? Math.min(max, Math.max(min, Math.trunc(Number(v)))) : fallback
  return {
    compactSuccessfulTests: options.compactSuccessfulTests !== false,
    compactInstallOutput: options.compactInstallOutput !== false,
    maxOutputChars: clamp(options.maxOutputChars, 12000, 512, 100000),
    maxOutputLines: clamp(options.maxOutputLines, 160, 20, 2000),
    excludedCommands: Array.isArray(options.excludedCommands) ? options.excludedCommands.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim().toLowerCase()) : [],
  }
}

export function isBypassed(command) {
  return /(?:^|\s)(?:DSH_RTK_BYPASS|RTK_DSH_BYPASS)=1(?:\s|$)/.test(command)
}

export function isExcluded(command, options = {}) {
  const normalized = String(command).trim().toLowerCase()
  return normalizeOptions(options).excludedCommands.some((prefix) => normalized.startsWith(prefix))
}

function testSummary(line) {
  const s = line.trim()
  return EXIT.test(s) || WARNING.test(s) || /^test result:\s*ok\b/i.test(s)
    || /^test suites?:\s+.*\bpassed\b/i.test(s) || /^tests?:\s+.*\bpassed\b/i.test(s)
    || /^#\s+(?:tests|pass|fail|skipped|todo|duration_ms)\b/i.test(s)
    || /^ran\s+\d+\s+tests?\b/i.test(s) || /^all tests passed\b/i.test(s)
    || /^ok\s*\(\s*\d+\s+tests?\s*\)$/i.test(s)
    || /^(?:finished|build finished|test run finished)\b.*\b(?:test|check|clippy|build)\b/i.test(s)
    || /^(?:passed|success):\s+\d+\b/i.test(s) || /^time:\s*\d/i.test(s) || /^duration\b.*\d/i.test(s)
}

function compactTests(lines) {
  if (lines.some((line) => FAIL.test(line))) return null
  const summary = lines.filter(testSummary)
  if (!summary.length || summary.length >= lines.length * 0.75) return null
  return ['[dsh-rtk] successful test/build output summarized: kept ' + summary.length + ' of ' + lines.length + ' lines; non-zero exits are never summarized.', ...summary].join('\n')
}

function installerNoise(line) {
  const s = line.trim()
  return !s || /^progress:\s*(?:resolved|downloaded|reused|added|removed|done)\b/i.test(s)
    || /^(?:downloading|fetching packages|resolving packages|linking dependencies|building fresh packages)\b.*(?:\.\.\.|\b\d+\/\d+\b|\bfrom\b)/i.test(s)
    || /^(?:[╭╮│╰─━█▇▆▅▄▃▂░▒▓▏·•]+\s*)+$/.test(s) || /^\s*\d+\/\d+\s*$/.test(s)
}

function compactInstaller(lines) {
  if (lines.length < 12) return null
  const kept = lines.filter((line) => !installerNoise(line))
  if (!kept.length || kept.length >= lines.length * 0.8) return null
  return ['[dsh-rtk] package-manager progress collapsed: kept ' + kept.length + ' of ' + lines.length + ' lines; warnings and lifecycle messages are retained.', ...kept].join('\n')
}

function capOutput(text, options) {
  const lines = text.split('\n')
  if (text.length <= options.maxOutputChars && lines.length <= options.maxOutputLines) return text
  const marker = '[dsh-rtk] omitted output to respect the configured successful-output budget. Prefix the command with DSH_RTK_BYPASS=1 to preserve full output.'
  const budget = Math.max(0, options.maxOutputChars - marker.length - 2)
  const head = Math.floor(budget * 0.68)
  const tail = budget - head
  return text.slice(0, head) + '\n' + marker + '\n' + (tail ? text.slice(-tail) : '')
}

export function compactCommandOutput(command, originalText, rawOptions = {}, exitCode) {
  const original = typeof originalText === 'string' ? originalText : String(originalText ?? '')
  const options = normalizeOptions(rawOptions)
  const unchanged = (reason) => ({ text: original, changed: false, reason, originalBytes: bytes(original), compactedBytes: bytes(original), bytesSaved: 0, estimatedTokensSaved: 0 })
  if (!original.trim()) return unchanged('empty-output')
  if (isBypassed(command)) return unchanged('explicit-bypass')
  if (isExcluded(command, options)) return unchanged('excluded-command')
  if (typeof exitCode === 'number' && exitCode !== 0) return unchanged('failure-preserved')
  if (exitCode === undefined && original.split('\n').some((line) => FAIL.test(line))) return unchanged('possible-failure-preserved')
  if (DETAIL.test(String(command).trim())) return unchanged('detail-output-preserved')

  let text = original.replace(ANSI, '').replace(/\r\n?/g, '\n').replace(/[ \t]+$/gm, '')
  let strategy = 'normalized'
  const originalLines = text.split('\n')
  const lines = []
  let previous = null
  let dropped = 0
  for (const line of originalLines) {
    if ((line.trim() === '' && previous === '') || (line !== '' && line === previous)) { dropped++; continue }
    lines.push(line)
    previous = line
  }
  while (lines.length && lines[lines.length - 1] === '') lines.pop()
  text = lines.join('\n')
  if (dropped) strategy = 'duplicate-lines'

  if (exitCode === 0 && TEST.test(command) && options.compactSuccessfulTests && originalLines.length >= 12) {
    const summary = compactTests(text.split('\n'))
    if (summary && summary.length < text.length) { text = summary; strategy = 'successful-test-summary' }
  }
  if (strategy !== 'successful-test-summary' && exitCode === 0 && INSTALL.test(command) && options.compactInstallOutput) {
    const cleaned = compactInstaller(text.split('\n'))
    if (cleaned && cleaned.length < text.length) { text = cleaned; strategy = 'installer-progress' }
  }
  if (exitCode === 0) {
    const capped = capOutput(text, options)
    if (capped !== text) { text = capped; strategy = strategy === 'normalized' ? 'output-budget' : strategy + '+output-budget' }
  }
  if (dropped > 2 && strategy !== 'successful-test-summary' && strategy !== 'installer-progress') {
    const marker = '[dsh-rtk] collapsed ' + dropped + ' adjacent duplicate/blank line(s).'
    if (!text.includes(marker)) text += '\n' + marker
  }
  if (text === original) return unchanged('no-safe-reduction')
  const originalBytes = bytes(original)
  const compactedBytes = bytes(text)
  const bytesSaved = Math.max(0, originalBytes - compactedBytes)
  return { text, changed: true, reason: strategy, originalBytes, compactedBytes, bytesSaved, estimatedTokensSaved: Math.floor(bytesSaved / 4) }
}
