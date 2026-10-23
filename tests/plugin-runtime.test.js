import test from 'node:test'
import assert from 'node:assert/strict'
import { installRtkPlugin } from '../src/plugin-runtime.js'

function createContext() {
  const listeners = new Map()
  const tools = []
  return {
    listeners,
    toolsRegistered: tools,
    on(event, handler) { listeners.set(event, handler) },
    tools: { register(tool) { tools.push(tool) } },
  }
}

function fakeDefineTool(definition) { return definition }

function bashExecution(command, exitCode = 0, extra = {}) {
  return {
    exec: { name: 'bash', arguments: { command, ...extra } },
    result: {
      isError: false,
      value: { kind: 'foreground', exitCode },
      content: [{ type: 'text', text: [
        'Finished test profile [unoptimized + debuginfo] target(s) in 1.24s',
        ...Array.from({ length: 30 }, (_, i) => 'test item_' + i + ' ... ok'),
        'test result: ok. 30 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out',
        '[exit code: 0]',
      ].join('\n') }],
    },
  }
}

test('uses the DSH property-level required flag in output schemas', () => {
  const ctx = createContext()
  installRtkPlugin(ctx, {}, fakeDefineTool)
  for (const tool of ctx.toolsRegistered) {
    assert.equal(tool.output.schema.type, 'object')
    assert.equal(tool.output.schema.additionalProperties, false)
    assert.equal('required' in tool.output.schema, false)
    for (const property of Object.values(tool.output.schema.properties)) {
      assert.equal(property.required, true)
    }
  }
})

test('registers the native hook, manual compaction, and stats tools', () => {
  const ctx = createContext()
  const runtime = installRtkPlugin(ctx, {}, fakeDefineTool)
  assert.ok(ctx.listeners.has('tools/post-execute'))
  assert.deepEqual(ctx.toolsRegistered.map((tool) => tool.name), ['dsh_rtk_stats', 'dsh_rtk_compact'])
  assert.equal(runtime.stats.commandsObserved, 0)
})

test('compacts successful Bash output and tracks approximate savings', async () => {
  const ctx = createContext()
  const { stats } = installRtkPlugin(ctx, {}, fakeDefineTool)
  const handler = ctx.listeners.get('tools/post-execute')
  const call = bashExecution('cargo test --workspace')
  const decision = await handler(call.exec, call.result, async () => ({ kind: 'accept' }))
  assert.equal(decision.kind, 'accept')
  assert.equal(decision.content[0].type, 'text')
  assert.match(decision.content[0].text, /dsh-rtk/)
  assert.equal(stats.commandsObserved, 1)
  assert.equal(stats.commandsCompacted, 1)
  assert.ok(stats.bytesSaved > 0)
})

test('delegates failures, non-Bash calls, background calls, and bypassed commands', async () => {
  const ctx = createContext()
  installRtkPlugin(ctx, {}, fakeDefineTool)
  const handler = ctx.listeners.get('tools/post-execute')
  const next = async () => ({ kind: 'accept', marker: 'downstream' })
  const failed = bashExecution('cargo test', 1)
  assert.equal((await handler(failed.exec, failed.result, next)).marker, 'downstream')
  const nonBash = bashExecution('cargo test')
  nonBash.exec.name = 'read_file'
  assert.equal((await handler(nonBash.exec, nonBash.result, next)).marker, 'downstream')
  const background = bashExecution('cargo test', 0, { run_in_background: true })
  assert.equal((await handler(background.exec, background.result, next)).marker, 'downstream')
  const bypass = bashExecution('DSH_RTK_BYPASS=1 cargo test')
  assert.equal((await handler(bypass.exec, bypass.result, next)).marker, 'downstream')
})

test('manual compaction returns measured output and stats stay process-local', async () => {
  const ctx = createContext()
  installRtkPlugin(ctx, {}, fakeDefineTool)
  const compactTool = ctx.toolsRegistered.find((tool) => tool.name === 'dsh_rtk_compact')
  const statsTool = ctx.toolsRegistered.find((tool) => tool.name === 'dsh_rtk_stats')
  const text = ['Finished test profile [unoptimized + debuginfo] target(s) in 1.24s',
    ...Array.from({ length: 30 }, (_, i) => 'test case_' + i + ' ... ok'),
    'test result: ok. 30 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out',
    '[exit code: 0]'].join('\n')
  const compacted = await compactTool.execute({ text, commandHint: 'cargo test', exitCode: 0 })
  assert.equal(compacted.changed, true)
  assert.ok(compacted.bytesSaved > 0)
  const stats = await statsTool.execute({})
  assert.equal(stats.commandsObserved, 1)
  assert.equal(stats.commandsCompacted, 1)
  assert.equal(stats.estimatedTokensSaved, Math.floor(stats.bytesSaved / 4))
})

test('enabled=false disables automatic compaction but keeps explicit tools', async () => {
  const ctx = createContext()
  installRtkPlugin(ctx, { enabled: false }, fakeDefineTool)
  const handler = ctx.listeners.get('tools/post-execute')
  const call = bashExecution('cargo test')
  const decision = await handler(call.exec, call.result, async () => ({ kind: 'accept', marker: 'delegated' }))
  assert.equal(decision.marker, 'delegated')
  assert.equal(ctx.toolsRegistered.length, 2)
})
