import { Command } from 'commander'
import { initCommand } from './commands/init'
import { generateCommand } from './commands/generate'
import { validateCommand } from './commands/validate'
import { visualizeCommand } from './commands/visualize'
import { keysCommand } from './commands/keys'

const program = new Command()

program
  .name('agentableui')
  .description('CLI tools for AgentableUI')
  .version('0.1.0')

program.addCommand(initCommand)
program.addCommand(generateCommand)
program.addCommand(validateCommand)
program.addCommand(visualizeCommand)
program.addCommand(keysCommand)

program.parse()
