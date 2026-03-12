import { Command } from 'commander'
import { resolve } from 'node:path'
import { readFile } from 'node:fs/promises'
import { loadConfig } from '../config-loader'
import { generateManifests } from '../generators/manifests'
import { generateHooks } from '../generators/hooks'

async function hasReactPackage(): Promise<boolean> {
  try {
    const pkg = JSON.parse(await readFile(resolve(process.cwd(), 'package.json'), 'utf-8'))
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies }
    return '@agentableui/react' in allDeps
  } catch {
    return false
  }
}

export const generateCommand = new Command('generate')
  .description('Build manifests and hooks from agentable.config.ts')
  .option('--config <path>', 'Path to config file', 'agentable.config.ts')
  .option('--watch', 'Watch for changes and regenerate')
  .action(async (opts) => {
    const configPath = resolve(process.cwd(), opts.config)
    const outputDir = resolve(process.cwd(), '.agentable')

    async function run() {
      try {
        const config = await loadConfig(configPath)
        const manifests = await generateManifests(config, outputDir)
        manifests.forEach(f => console.log(`  wrote ${f}`))

        if (await hasReactPackage()) {
          const hooksPath = await generateHooks(config, outputDir)
          console.log(`  wrote ${hooksPath}`)
        } else {
          console.log('  Skipping hooks.ts (@agentableui/react not installed)')
        }

        console.log('Done.')
      } catch (err) {
        console.error(`Error: ${(err as Error).message}`)
        process.exit(1)
      }
    }

    await run()

    if (opts.watch) {
      const { watch } = await import('chokidar')
      const files = [
        configPath,
        resolve(process.cwd(), 'agentable.handlers.ts'),
        resolve(process.cwd(), 'agentable.conditions.ts'),
      ]
      let timeout: ReturnType<typeof setTimeout> | null = null
      const watcher = watch(files, { ignoreInitial: true })
      watcher.on('all', () => {
        if (timeout) clearTimeout(timeout)
        timeout = setTimeout(async () => {
          console.log('\nChange detected, regenerating...')
          await run()
        }, 300)
      })
      console.log('Watching for changes...')
    }
  })
