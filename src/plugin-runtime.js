import { compactCommandOutput, isBypassed, isExcluded, normalizeOptions } from './compact.js'

function emptyStats() {
  return { commandsObserved: 0, commandsCompacted: 0, originalBytes: 0, returnedBytes: 0, bytesSaved: 0 }
}

function record(stats, result) {
  stats.commandsObserved += 1
  stats.originalBytes += result.originalBytes
  stats.returnedBytes += result.compactedBytes
  stats.bytesSaved += result.bytesSaved
  if (result.changed) stats.commandsCompacted += 1
}

function statsSnapshot(stats) {
  const bytesSaved = Math.max(0, stats.bytesSaved)
  return {
    commandsObserved: stats.commandsObserved,
    commandsCompacted: stats.commandsCompacted,
    originalBytes: stats.originalBytes,
    returnedBytes: stats.returnedBytes,
    bytesSaved,
    savingsPercent: stats.originalBytes > 0 ? Math.round(bytesSaved / stats.originalBytes * 1000) / 10 : 0,
    estimatedTokensSaved: Math.floor(bytesSaved / 4),
  }
}

function outputSchema(properties) {
  const requiredProperties = Object.fromEntries(
    Object.entries(properties).map(([key, schema]) => [key, { ...schema, required: true }]),
  )
  return { type: 'object', additionalProperties: false, properties: requiredProperties }
}

function statsTool(stats, defineTool) {
  const properties = {
    commandsObserved: { type: 'number' }, commandsCompacted: { type: 'number' },
    originalBytes: { type: 'number' }, returnedBytes: { type: 'number' },
    bytesSaved: { type: 'number' }, savingsPercent: { type: 'number' }, estimatedTokensSaved: { type: 'number' },
  }
  return defineTool({
    name: 'dsh_rtk_stats',
    description: 'Show DSH-RTK command-output compaction metrics for this DSH process. Counters reset on restart; token savings are approximate, not billing measurements.',
    parameters: {},
    output: {
      schema: outputSchema(properties),
      render: (_args, value) => [{ type: 'text', text: [
        'DSH-RTK — current process',
        'Eligible commands observed: ' + value.commandsObserved,
        'Outputs compacted: ' + value.commandsCompacted,
        'UTF-8 bytes before / after: ' + value.originalBytes + ' / ' + value.returnedBytes,
        'Bytes avoided: ' + value.bytesSaved + ' (' + value.savingsPercent + '%)',
        'Estimated tokens avoided: ~' + value.estimatedTokensSaved + ' (bytes ÷ 4 heuristic; not billable-token count)',
      ].join('\n') }],
    },
    async execute() { return statsSnapshot(stats) },
  })
}

function compactTool(options, stats, defineTool) {
  const properties = {
    text: { type: 'string' }, changed: { type: 'boolean' }, reason: { type: 'string' },
    originalBytes: { type: 'number' }, compactedBytes: { type: 'number' },
    bytesSaved: { type: 'number' }, estimatedTokensSaved: { type: 'number' },
  }
  return defineTool({
    name: 'dsh_rtk_compact',
    description: 'Compact supplied build/test/install logs or command output. Preserves non-zero-exit output and source-inspection commands. Processes only supplied text; does not execute shell or read files.',
    parameters: {
      text: { type: 'string', required: true, description: 'Command output or log text to compact.' },
      commandHint: { type: 'string', description: 'Optional command, such as cargo test or pnpm install.' },
      exitCode: { type: 'integer', description: 'Optional exit code. Supply 0 only when the command succeeded; non-zero preserves the input.' },
    },
    output: {
      schema: outputSchema(properties),
      render: (_args, value) => [{ type: 'text', text: [
        'Changed: ' + (value.changed ? 'yes' : 'no') + ' (' + value.reason + ')',
        'Bytes: ' + value.originalBytes + ' → ' + value.compactedBytes + '; avoided ' + value.bytesSaved + ' bytes (~' + value.estimatedTokensSaved + ' tokens).',
        '--- compacted output ---', value.text,
      ].join('\n') }],
    },
    async execute(args) {
      const result = compactCommandOutput(args.commandHint || '', args.text, options, args.exitCode)
      record(stats, result)
      return result
    },
  })
}

/** Register DSH-native result compaction and local productivity tools. */
export function installRtkPlugin(ctx, rawConfig = {}, defineTool) {
  if (typeof defineTool !== 'function') throw new TypeError('dsh-rtk requires the DSH defineTool API')
  const options = normalizeOptions(rawConfig)
  options.enabled = rawConfig.enabled !== false
  const stats = emptyStats()

  ctx.on('tools/post-execute', async (exec, result, next) => {
    if (!options.enabled || exec.name !== 'bash') return next()
    if (result?.isError !== false || result.value?.kind !== 'foreground' || result.value.exitCode !== 0) return next()
    const args = exec.arguments
    if (!args || typeof args !== 'object' || typeof args.command !== 'string') return next()
    if (args.run_in_background === true || isBypassed(args.command) || isExcluded(args.command, options)) return next()
    if (typeof result.content?.[0]?.text !== 'string' || result.content.length !== 1) return next()

    const compacted = compactCommandOutput(args.command, result.content[0].text, options, result.value.exitCode)
    record(stats, compacted)
    if (!compacted.changed) return next()
    return { kind: 'accept', content: [{ type: 'text', text: compacted.text }] }
  })

  ctx.tools.register(statsTool(stats, defineTool))
  ctx.tools.register(compactTool(options, stats, defineTool))
  return { stats, options }
}
