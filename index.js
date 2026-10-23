import Schema from '@deepseek-ai/schemastery'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { installRtkPlugin } from './src/plugin-runtime.js'

export const name = 'dsh-rtk'
export const inject = ['tools']

export const Config = Schema.object({
  enabled: Schema.boolean().default(true),
  compactSuccessfulTests: Schema.boolean().default(true),
  compactInstallOutput: Schema.boolean().default(true),
  maxOutputChars: Schema.number().default(12000),
  maxOutputLines: Schema.number().default(160),
  excludedCommands: Schema.array(Schema.string()).default([]),
})

export function apply(ctx, config = {}) {
  installRtkPlugin(ctx, config, defineTool)
}
