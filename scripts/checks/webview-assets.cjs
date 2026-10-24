const fs = require('node:fs/promises')
const path = require('node:path')
const assert = require('node:assert/strict')

async function main() {
  const webRoot = process.env.COOLVIBES_WEB_ROOT || path.resolve(__dirname, '../../../../web')
  const { chromium } = require(require.resolve('@playwright/test', { paths: [webRoot] }))
  const extensionRoot = path.resolve(__dirname, '../..')
  const publicRoot = path.join(webRoot, 'public')
  const catalog = JSON.parse(await fs.readFile(path.join(webRoot, 'src/features/illustrations/icon-catalog.json'), 'utf8'))
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', headless: true })
  try {
    const page = await browser.newPage()
    await page.route('https://extension.test/**', route => route.fulfill({ contentType: 'text/html', body: '<html><body></body></html>' }))
    await page.route('https://assets.test/**', async route => {
      const relative = new URL(route.request().url()).pathname.slice(1)
      const file = path.resolve(publicRoot, relative)
      assert.ok(file.startsWith(publicRoot + path.sep))
      const body = await fs.readFile(file)
      await route.fulfill({ body, contentType: file.endsWith('.avif') ? 'image/avif' : 'image/png' })
    })
    await page.goto('https://extension.test/')
    await page.evaluate(() => { window.__COOLVIBES_EXTENSION__ = { assetBaseUrl: 'https://assets.test/' } })
    await page.addScriptTag({ content: await fs.readFile(path.join(extensionRoot, 'webview/assets.js'), 'utf8') })
    const result = await page.evaluate(async (keys) => {
      const failures = []
      const check = async (url, mode) => {
        const image = document.createElement('img')
        if (mode === 'attribute') image.setAttribute('src', url)
        else image.src = url
        document.body.append(image)
        try { await image.decode(); if (!image.naturalWidth) failures.push(url) }
        catch { failures.push(url) }
      }
      // React writes image attributes; media libraries assign native properties.
      for (let offset = 0; offset < keys.length; offset += 30) {
        await Promise.all(keys.slice(offset, offset + 30).map((key, i) =>
          check(`/images/icons/dott/${key}.avif`, i % 2 ? 'attribute' : 'property')))
      }
      await check('/images/brand/dott-v3/wordmark.png', 'attribute')
      const container = document.createElement('div')
      container.innerHTML = '<img src="/images/brand/dott-v3/icon-128.png">'
      document.body.append(container)
      await new Promise(resolve => setTimeout(resolve, 0))
      try { await container.firstChild.decode() } catch { failures.push('inserted HTML') }
      const route = document.createElement('a')
      route.setAttribute('href', '/profile/example')
      const remote = document.createElement('img')
      remote.setAttribute('src', 'https://remote.test/avatar.png')
      const source = document.createElement('source')
      source.srcset = '/images/brand/dott-v3/icon-128.png 1x, /images/brand/dott-v3/icon-256.png 2x'
      return { failures, route: route.getAttribute('href'), remote: remote.getAttribute('src'), srcset: source.srcset }
    }, catalog.map(icon => icon.key))
    assert.deepEqual(result.failures, [])
    assert.equal(result.route, '/profile/example')
    assert.equal(result.remote, 'https://remote.test/avatar.png')
    assert.equal(result.srcset, 'https://assets.test/images/brand/dott-v3/icon-128.png 1x, https://assets.test/images/brand/dott-v3/icon-256.png 2x')
    console.log(`PASS: ${catalog.length} real illustrated icons decoded in Chromium; brand, native setters, inserted HTML, srcset, remote URLs and navigation checked.`)
  } finally { await browser.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
