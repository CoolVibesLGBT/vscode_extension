import fs from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const extensionRoot = path.resolve(scriptDir, '..')
const workspaceRoot = path.resolve(extensionRoot, '..')
const webRoot = path.join(workspaceRoot, 'web')
const webviewRoot = path.join(extensionRoot, 'webview')
const outDir = path.join(extensionRoot, 'media', 'webview')
const leafletImagesDir = path.join(webRoot, 'node_modules', 'leaflet', 'dist', 'images')
const katexFontsDir = path.join(webRoot, 'node_modules', 'katex', 'dist', 'fonts')

const viteEntry = path.join(webRoot, 'node_modules', 'vite', 'dist', 'node', 'index.js')
const requireFromWeb = createRequire(path.join(webRoot, 'package.json'))

const { build } = await import(pathToFileURL(viteEntry).href)

process.chdir(webRoot)

const isBareSpecifier = (value) =>
  !value.startsWith('.') &&
  !value.startsWith('/') &&
  !value.startsWith('\0') &&
  !value.startsWith('virtual:') &&
  !/^[a-zA-Z]+:/.test(value)

const webWorkspaceResolver = {
  name: 'web-workspace-resolver',
  resolveId(source) {
    if (!isBareSpecifier(source)) return null

    try {
      return requireFromWeb.resolve(source)
    } catch {
      return null
    }
  },
}

const copyDirectoryContents = async (sourceDir, targetDir) => {
  await fs.mkdir(targetDir, { recursive: true })
  const entries = await fs.readdir(sourceDir, { withFileTypes: true })

  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name)
    const targetPath = path.join(targetDir, entry.name)

    if (entry.isDirectory()) {
      await copyDirectoryContents(sourcePath, targetPath)
      continue
    }

    await fs.copyFile(sourcePath, targetPath)
  }
}

await build({
  configFile: false,
  root: webviewRoot,
  base: './',
  publicDir: path.join(webRoot, 'public'),
  plugins: [webWorkspaceResolver],
  resolve: {
    alias: {
      '@': path.join(webRoot, 'src'),
    },
  },
  css: {
    postcss: webRoot,
  },
  define: {
    'import.meta.env.DEV': 'false',
  },
  build: {
    outDir,
    emptyOutDir: true,
    assetsDir: 'assets',
    sourcemap: false,
    rollupOptions: {
      input: path.join(webviewRoot, 'index.html'),
    },
  },
})

await copyDirectoryContents(leafletImagesDir, path.join(outDir, 'images'))
await copyDirectoryContents(katexFontsDir, path.join(outDir, 'fonts'))

console.log(`Built CoolVibes webview to ${outDir}`)
