/**
 * Full demo.gif rebuild: app UI frames (Playwright) + real Word paste frames.
 * Usage: node scripts/rebuild-demo.mjs [baseUrl]
 */
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const baseUrl = process.argv[2] || 'http://127.0.0.1:5173'

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: root, stdio: 'inherit', shell: true, ...opts })
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${cmd} ${args.join(' ')} exited ${code}`))
    })
  })
}

await run('node', ['scripts/capture-demo.mjs', baseUrl])
await run('node', ['scripts/export-demo-rtf.mjs'])
await run('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', 'scripts/capture-word-demo.ps1'])
await run('python', ['scripts/build-demo-gif.py'])
console.log('demo.gif rebuilt with real Word paste frames')
