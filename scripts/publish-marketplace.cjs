const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const root = path.resolve(__dirname, '..')
const manifest = require(path.join(root, 'package.json'))
const checkOnly = process.argv.includes('--check-auth')
const forceLogin = process.argv.includes('--login') || process.env.COOLVIBES_PUBLISH_LOGIN === '1'
const packageArgument = process.argv.slice(2).find(value => !value.startsWith('--'))
const packagePath = path.resolve(packageArgument || path.join(root, `${manifest.name}-${manifest.version}.vsix`))
const mode = process.env.COOLVIBES_PUBLISH_AUTH || (forceLogin ? 'azure' : 'auto')
const resource = '499b84ac-1321-427f-aa17-267ca6975798'
function run(command, args, quiet = false) {
  return spawnSync(command, args, { cwd: root, stdio: quiet ? 'ignore' : 'inherit' })
}
function publish(args) {
  const verified = run(process.execPath, [path.join(root, 'node_modules/@vscode/vsce/vsce'), 'verify-pat', manifest.publisher, ...args])
  if (verified.status !== 0) {
    console.error(`The selected identity cannot access publisher ${manifest.publisher}.`)
    console.error(`Open https://marketplace.visualstudio.com/manage/publishers/${manifest.publisher} with the publisher owner account.`)
    console.error('In Members, grant this identity Contributor or Owner access. Creator cannot update extensions owned by another identity.')
    console.error('To select a different Microsoft account: node scripts/publish-marketplace.cjs --login')
    process.exit(verified.status ?? 1)
  }
  if (checkOnly) process.exit(0)
  const result = run(process.execPath, [path.join(root, 'node_modules/@vscode/vsce/vsce'), 'publish', '--packagePath', packagePath, ...args])
  if (result.error) console.error(result.error.message)
  process.exit(result.status ?? 1)
}
function browserUpload() {
  const url = `https://marketplace.visualstudio.com/manage/publishers/${encodeURIComponent(manifest.publisher)}`
  console.log(`Sign in to the ${manifest.publisher} publisher: ${url}`)
  console.log(`Choose ${manifest.name} → Update, then select: ${packagePath}`)
  if (process.platform === 'darwin') {
    run('open', [url])
    run('open', ['-R', packagePath])
  } else if (process.platform === 'win32') {
    run('explorer.exe', [url])
    run('explorer.exe', [`/select,${packagePath}`])
  } else {
    run('xdg-open', [url])
    run('xdg-open', [path.dirname(packagePath)])
  }
  console.log('Browser upload is pending. The extension has NOT been published by this script.')
  process.exit(2)
}
if (!checkOnly && !fs.existsSync(packagePath)) {
  console.error(`VSIX not found: ${packagePath}. Run ./deploy.sh first.`)
  process.exit(1)
}
if (!['auto', 'pat', 'azure', 'browser'].includes(mode)) {
  console.error('COOLVIBES_PUBLISH_AUTH must be auto, azure, browser or pat.')
  process.exit(1)
}
if (mode === 'browser') { if (checkOnly) process.exit(0); browserUpload() }
if (mode === 'pat' || (mode === 'auto' && process.env.VSCE_PAT)) publish([])
const hasAzureCli = run('az', ['version'], true).status === 0
if (!hasAzureCli) {
  if (mode === 'auto') { if (checkOnly) process.exit(0); browserUpload() }
  console.error('Azure CLI is required for Microsoft sign-in. On macOS: brew install azure-cli')
  process.exit(1)
}
// Verify the correct Azure DevOps scope; an Azure subscription is not required.
if (forceLogin || run('az', ['account', 'get-access-token', '--resource', resource, '--output', 'none'], true).status !== 0) {
  const args = ['login', '--allow-no-subscriptions', '--scope', `${resource}/.default`]
  if (process.env.AZURE_TENANT_ID) args.push('--tenant', process.env.AZURE_TENANT_ID)
  const login = run('az', args)
  if (login.status !== 0) process.exit(login.status ?? 1)
}
publish(['--azure-credential'])
