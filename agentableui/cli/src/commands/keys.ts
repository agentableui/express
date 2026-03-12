import { Command } from 'commander'
import { resolve } from 'node:path'
import { generateKey, listKeys, revokeKey } from '@agentableui/core'

const DEFAULT_KEYS_PATH = '.agentable/keys.json'

export const keysCommand = new Command('keys')
  .description('Manage agent API keys')

keysCommand
  .command('generate')
  .description('Generate a new API key')
  .requiredOption('--name <name>', 'Name for the key')
  .option('--role <role>', 'Auth role for the key', 'user')
  .option('--keys-path <path>', 'Path to keys file', DEFAULT_KEYS_PATH)
  .action(async (opts) => {
    try {
      const keysPath = resolve(process.cwd(), opts.keysPath)
      const result = await generateKey(opts.name, { role: opts.role }, keysPath)
      console.log(`Key generated:`)
      console.log(`  Key:    ${result.key}`)
      console.log(`  Prefix: ${result.prefix}`)
      console.log(`  Name:   ${result.name}`)
      console.log(`  Role:   ${result.role}`)
      console.log(`\nSave this key — it won't be shown again.`)
    } catch (err) {
      console.error(`Error: ${(err as Error).message}`)
      process.exit(1)
    }
  })

keysCommand
  .command('list')
  .description('List all API keys')
  .option('--keys-path <path>', 'Path to keys file', DEFAULT_KEYS_PATH)
  .action(async (opts) => {
    try {
      const keysPath = resolve(process.cwd(), opts.keysPath)
      const keys = await listKeys(keysPath)

      if (keys.length === 0) {
        console.log('No keys found.')
        return
      }

      // Table header
      const header = ['PREFIX', 'NAME', 'ROLE', 'CREATED', 'STATUS']
      const rows = keys.map(k => [
        k.prefix,
        k.name,
        k.role,
        k.createdAt.slice(0, 10),
        k.revokedAt ? 'revoked' : 'active',
      ])

      const widths = header.map((h, i) =>
        Math.max(h.length, ...rows.map(r => r[i].length))
      )

      const pad = (s: string, w: number) => s.padEnd(w)
      console.log(header.map((h, i) => pad(h, widths[i])).join('  '))
      console.log(widths.map(w => '-'.repeat(w)).join('  '))
      rows.forEach(row => {
        console.log(row.map((c, i) => pad(c, widths[i])).join('  '))
      })
    } catch (err) {
      console.error(`Error: ${(err as Error).message}`)
      process.exit(1)
    }
  })

keysCommand
  .command('revoke')
  .description('Revoke an API key by prefix')
  .argument('<prefix>', 'Key prefix to revoke')
  .option('--keys-path <path>', 'Path to keys file', DEFAULT_KEYS_PATH)
  .action(async (prefix, opts) => {
    try {
      const keysPath = resolve(process.cwd(), opts.keysPath)
      const revoked = await revokeKey(prefix, keysPath)
      if (revoked) {
        console.log(`Key ${prefix} revoked.`)
      } else {
        console.error(`Key with prefix "${prefix}" not found.`)
        process.exit(1)
      }
    } catch (err) {
      console.error(`Error: ${(err as Error).message}`)
      process.exit(1)
    }
  })
