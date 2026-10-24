import fs from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const extensionRoot = path.resolve(scriptDir, '..')
const webviewRoot = path.join(extensionRoot, 'webview')
const outDir = path.join(extensionRoot, 'media', 'webview')

const pathExists = async (targetPath) => {
  try {
    await fs.access(targetPath)
    return true
  } catch {
    return false
  }
}

const resolveWebRoot = async () => {
  const configuredRoot = process.env.COOLVIBES_WEB_ROOT
    ? path.resolve(process.env.COOLVIBES_WEB_ROOT)
    : null
  const candidates = [
    configuredRoot,
    path.resolve(extensionRoot, '..', '..', 'web'),
    path.resolve(extensionRoot, '..', 'web'),
  ].filter(Boolean)

  for (const candidate of [...new Set(candidates)]) {
    const packagePath = path.join(candidate, 'package.json')
    const appEntryPath = path.join(candidate, 'src', 'main.tsx')

    if (!await pathExists(packagePath) || !await pathExists(appEntryPath)) {
      continue
    }

    try {
      const packageJson = JSON.parse(await fs.readFile(packagePath, 'utf8'))
      if (packageJson.name === 'coolvibes-web') {
        return candidate
      }
    } catch {
      // Continue through the candidate list and report every checked path below.
    }
  }

  const checkedPaths = [...new Set(candidates)]
    .map((candidate) => `  - ${candidate}`)
    .join('\n')

  throw new Error(
    `Could not locate the CoolVibes web project. Checked:\n${checkedPaths}\n` +
    'Set COOLVIBES_WEB_ROOT to the absolute web project path and try again.'
  )
}

const webRoot = await resolveWebRoot()
const requireFromWeb = createRequire(path.join(webRoot, 'package.json'))
const viteEntry = requireFromWeb.resolve('vite')
const leafletImagesDir = path.join(webRoot, 'node_modules', 'leaflet', 'dist', 'images')
const katexFontsDir = path.join(webRoot, 'node_modules', 'katex', 'dist', 'fonts')

for (const requiredPath of [viteEntry, leafletImagesDir, katexFontsDir]) {
  if (!await pathExists(requiredPath)) {
    throw new Error(
      `Missing build dependency at ${requiredPath}. Run yarn install in ${webRoot}.`
    )
  }
}

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

// Adapt public brand artwork without modifying the shared web workspace.
const webviewBrandAssets = {
  name: 'webview-brand-assets',
  enforce: 'pre',
  transform(code, id) {
    const sourcePath = id.split('?')[0].replaceAll('\\', '/')
    let updated = code
    if (sourcePath.endsWith('/features/landing/Brand.tsx')) {
      updated = updated.replace('src="/images/brand/dott-v3/wordmark.png"',
        'src={resolvePublicAssetUrl("/images/brand/dott-v3/wordmark.png")}')
    } else if (sourcePath.endsWith('/components/ui/IllustratedIcon.tsx')) {
      updated = updated.replace('src={`/images/icons/dott/${key}.avif`}',
        'src={resolvePublicAssetUrl(`/images/icons/dott/${key}.avif`)}')
    } else if (sourcePath.endsWith('/screens/BrandkitScreen.tsx')) {
      updated = updated.replace("const base = '/images/brand/dott-v3/'",
        "const base = resolvePublicAssetUrl('/images/brand/dott-v3/')")
    }
    if (updated === code) return null
    return { code: "import { resolvePublicAssetUrl } from '@/platform/runtime'\n" + updated, map: null }
  },
}

const copyDirectoryContents = async (sourceDir, targetDir) => {
  await fs.mkdir(targetDir, { recursive: true })
  const entries = await fs.readdir(sourceDir, { withFileTypes: true })

  for (const entry of entries) {
    if (entry.name === '.DS_Store') {
      continue
    }

    const sourcePath = path.join(sourceDir, entry.name)
    const targetPath = path.join(targetDir, entry.name)

    if (entry.isDirectory()) {
      await copyDirectoryContents(sourcePath, targetPath)
      continue
    }

    await fs.copyFile(sourcePath, targetPath)
  }
}

const walkFiles = async (rootDir) => {
  const files = []
  const entries = await fs.readdir(rootDir, { withFileTypes: true })

  for (const entry of entries) {
    const entryPath = path.join(rootDir, entry.name)
    if (entry.isDirectory()) {
      files.push(...await walkFiles(entryPath))
    } else {
      files.push(entryPath)
    }
  }

  return files
}

const removeFilesByName = async (rootDir, fileName) => {
  const files = await walkFiles(rootDir)
  await Promise.all(
    files
      .filter((filePath) => path.basename(filePath) === fileName)
      .map((filePath) => fs.rm(filePath, { force: true }))
  )
}

const removeWebOnlyFiles = async () => {
  const webOnlyFiles = [
    'manifest.json',
    'manifest.webmanifest',
    'offline.html',
    'robots.txt',
    'service-worker.js',
    'sitemap.xml',
  ]

  await Promise.all(
    webOnlyFiles.map((fileName) =>
      fs.rm(path.join(outDir, fileName), { force: true })
    )
  )
}

const rewriteAbsoluteCssAssetUrls = async () => {
  const cssFiles = (await walkFiles(path.join(outDir, 'assets')))
    .filter((filePath) => filePath.endsWith('.css'))

  for (const cssPath of cssFiles) {
    const originalCss = await fs.readFile(cssPath, 'utf8')
    const rewrittenCss = originalCss.replace(
      /url\((['"]?)\/(?!\/)/g,
      'url($1https://coolvibes.lgbt/'
    )

    if (rewrittenCss !== originalCss) {
      await fs.writeFile(cssPath, rewrittenCss)
    }
  }
}

const assertLocalFile = async (sourcePath, target) => {
  const targetWithoutSuffix = target.split(/[?#]/, 1)[0]
  const decodedTarget = decodeURIComponent(targetWithoutSuffix)
  const resolvedTarget = path.resolve(path.dirname(sourcePath), decodedTarget)
  const relativeToOutput = path.relative(outDir, resolvedTarget)

  if (relativeToOutput.startsWith('..') || path.isAbsolute(relativeToOutput)) {
    throw new Error(`Asset escapes the webview output: ${target} in ${sourcePath}`)
  }

  if (!await pathExists(resolvedTarget)) {
    throw new Error(`Missing webview asset: ${target} referenced by ${sourcePath}`)
  }
}

const validateBuild = async () => {
  const indexPath = path.join(outDir, 'index.html')
  const indexHtml = await fs.readFile(indexPath, 'utf8')
  const htmlReferencePattern = /\b(?:src|href)=["']([^"']+)["']/g

  for (const match of indexHtml.matchAll(htmlReferencePattern)) {
    const target = match[1]
    if (/^(?:[a-z]+:|\/\/|#)/i.test(target)) continue
    await assertLocalFile(indexPath, target)
  }

  const cssFiles = (await walkFiles(path.join(outDir, 'assets')))
    .filter((filePath) => filePath.endsWith('.css'))
  const cssReferencePattern = /url\(\s*((?:"[^"]*"|'[^']*'|[^)'"\s]+))\s*\)/g

  for (const cssPath of cssFiles) {
    const css = await fs.readFile(cssPath, 'utf8')

    for (const match of css.matchAll(cssReferencePattern)) {
      const target = match[1].trim().replace(/^(['"])(.*)\1$/, '$2')
      if (/^(?:data:|https?:|\/\/|#)/i.test(target)) continue
      await assertLocalFile(cssPath, target)
    }
  }
}

await build({
  configFile: false,
  root: webviewRoot,
  base: './',
  mode: 'production',
  envDir: webRoot,
  publicDir: false,
  plugins: [webviewBrandAssets, webWorkspaceResolver],
  resolve: {
    alias: {
      '@': path.join(webRoot, 'src'),
    },
  },
  css: {
    postcss: webRoot,
  },
  build: {
    outDir,
    emptyOutDir: true,
    assetsDir: 'assets',
    sourcemap: false,
    target: 'es2020',
    rollupOptions: {
      input: path.join(webviewRoot, 'index.html'),
    },
  },
})

await copyDirectoryContents(
  leafletImagesDir,
  path.join(outDir, 'assets', 'images')
)
await copyDirectoryContents(
  katexFontsDir,
  path.join(outDir, 'assets', 'fonts')
)
await rewriteAbsoluteCssAssetUrls()
await removeWebOnlyFiles()
await removeFilesByName(outDir, '.DS_Store')
await validateBuild()

// Keep VS Code's own icons outside the generated webview directory.
const brandDir = path.join(extensionRoot, 'media', 'brand')
await fs.mkdir(brandDir, { recursive: true })
await fs.copyFile(
  path.join(webRoot, 'public', 'images', 'brand', 'dott-v3', 'icon-256.png'),
  path.join(brandDir, 'icon.png')
)

const outputFiles = await walkFiles(outDir)
const outputBytes = (
  await Promise.all(outputFiles.map(async (filePath) => (await fs.stat(filePath)).size))
).reduce((total, size) => total + size, 0)

console.log(
  `Built CoolVibes webview from ${webRoot} to ${outDir} ` +
  `(${outputFiles.length} files, ${(outputBytes / 1024 / 1024).toFixed(1)} MB)`
)
