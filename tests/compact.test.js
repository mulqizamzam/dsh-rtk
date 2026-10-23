import test from 'node:test'
import assert from 'node:assert/strict'
import { compactCommandOutput, isBypassed, isExcluded, normalizeOptions } from '../src/compact.js'

const testOutput = [
  'running 5 tests',
  'test alpha ... ok',
  'test beta ... ok',
  'test gamma ... ok',
  'test delta ... ok',
  'test epsilon ... ok',
  'Finished test profile [unoptimized + debuginfo] target(s) in 1.24s',
  'Running unittests src/lib.rs (target/debug/deps/example)',
  'test result: ok. 5 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out',
  '[exit code: 0]',
].join('\n')

test('summarizes successful Rust tests and preserves summary lines', () => {
  const expanded = testOutput + '\n' + Array.from({ length: 20 }, (_, i) => 'test extra_' + i + ' ... ok').join('\n')
  const result = compactCommandOutput('cargo test --workspace', expanded, {}, 0)
  assert.equal(result.changed, true)
  assert.match(result.reason, /successful-test-summary/)
  assert.match(result.text, /test result: ok/)
  assert.match(result.text, /\[exit code: 0\]/)
  assert.ok(result.text.length < expanded.length)
  assert.equal(result.estimatedTokensSaved, Math.floor(result.bytesSaved / 4))
})

test('preserves failing command output byte-for-byte', () => {
  const failure = '\u001b[31merror: assertion failed\u001b[0m\nstack frame\n[exit code: 1]\n'
  const result = compactCommandOutput('cargo test', failure, {}, 1)
  assert.equal(result.changed, false)
  assert.equal(result.reason, 'failure-preserved')
  assert.equal(result.text, failure)
  assert.equal(result.bytesSaved, 0)
})

test('does not alter detail-oriented source-inspection output', () => {
  for (const command of ['rg TODO src/', 'cat src/index.ts', 'sed -n 1,30p src/index.ts']) {
    const result = compactCommandOutput(command, 'line\nline\nline\n'.repeat(50), {}, 0)
    assert.equal(result.changed, false, command)
    assert.equal(result.reason, 'detail-output-preserved', command)
  }
})

test('excludes git diff by default, including when profile exclusions are empty', () => {
  const options = normalizeOptions({ excludedCommands: [] })
  assert.ok(options.excludedCommands.includes('git diff'))
  const result = compactCommandOutput('git diff --stat', 'line\nline\nline\n'.repeat(50), { excludedCommands: [] }, 0)
  assert.equal(result.changed, false)
  assert.equal(result.reason, 'excluded-command')
})


test('supports explicit per-command bypass', () => {
  const text = 'same\nsame\nsame\n'
  assert.equal(isBypassed('DSH_RTK_BYPASS=1 cargo test'), true)
  assert.equal(isBypassed('RTK_DSH_BYPASS=1 pnpm test'), true)
  assert.equal(isBypassed('cargo test'), false)
  const result = compactCommandOutput('DSH_RTK_BYPASS=1 cargo test', text, {}, 0)
  assert.equal(result.reason, 'explicit-bypass')
  assert.equal(result.text, text)
})

test('supports environment-level bypass for CI jobs', () => {
  assert.equal(isBypassed('cargo test', { DSH_RTK_BYPASS: '1' }), true)
  assert.equal(isBypassed('cargo test', { RTK_DSH_BYPASS: '1' }), true)
  assert.equal(isBypassed('cargo test', {}), false)

  const previous = process.env.DSH_RTK_BYPASS
  process.env.DSH_RTK_BYPASS = '1'
  try {
    const result = compactCommandOutput('cargo test', testOutput, {}, 0)
    assert.equal(result.changed, false)
    assert.equal(result.reason, 'explicit-bypass')
    assert.equal(result.text, testOutput)
  } finally {
    if (previous === undefined) delete process.env.DSH_RTK_BYPASS
    else process.env.DSH_RTK_BYPASS = previous
  }
})

test('allows explicit command-prefix exclusions', () => {
  const options = normalizeOptions({ excludedCommands: ['git status', 'pnpm test'] })
  assert.equal(isExcluded('git status --short', options), true)
  assert.equal(isExcluded('pnpm test', options), true)
  assert.equal(isExcluded('cargo test', options), false)
})

test('collapses installer progress while retaining warnings and lifecycle messages', () => {
  const lines = [
    'Progress: resolved 1, reused 0, downloaded 1, added 0',
    'Progress: resolved 2, reused 1, downloaded 1, added 0',
    'Progress: resolved 3, reused 1, downloaded 2, added 0',
    'Progress: resolved 4, reused 2, downloaded 2, added 0',
    'Downloading package A...',
    'Downloading package B...',
    'Linking dependencies...',
    'Progress: resolved 7, reused 2, downloaded 5, added 5',
    'warning: optional native dependency skipped',
    'postinstall: generated bindings',
    'added 5 packages',
    '[exit code: 0]',
  ].join('\n')
  const result = compactCommandOutput('pnpm install', lines, {}, 0)
  assert.equal(result.changed, true)
  assert.match(result.reason, /installer-progress/)
  assert.match(result.text, /warning: optional native dependency skipped/)
  assert.match(result.text, /postinstall: generated bindings/)
  assert.match(result.text, /added 5 packages/)
})

test('applies successful-output budget and declares omissions', () => {
  const text = Array.from({ length: 300 }, (_, i) => 'build step ' + i + ': completed').join('\n')
  const result = compactCommandOutput('some-tool build', text, { maxOutputChars: 1500, maxOutputLines: 40 }, 0)
  assert.equal(result.changed, true)
  assert.ok(result.text.length <= 1500)
  assert.match(result.text, /\[dsh-rtk\] omitted/)
})

test('keeps short ordinary output unchanged', () => {
  const text = 'Build succeeded.\n[exit code: 0]'
  const result = compactCommandOutput('some-tool build', text, {}, 0)
  assert.equal(result.changed, false)
  assert.equal(result.text, text)
})

test('respects the output line budget even when character budget is not reached', () => {
  const text = Array.from({ length: 100 }, (_, i) => 'step ' + i + ': ok').join('\n')
  const result = compactCommandOutput('some-tool build', text, { maxOutputChars: 10000, maxOutputLines: 20 }, 0)
  assert.equal(result.changed, true)
  assert.ok(result.text.split('\n').length <= 20)
  assert.match(result.text, /\[dsh-rtk\] omitted/)
})
