const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

class Element {
  constructor() { this.attributes = new Map() }
  setAttribute(name, value) { this.attributes.set(name, value) }
  getAttribute(name) { return this.attributes.get(name) ?? null }
  querySelectorAll() { return [] }
}
const globals = { Element }
for (const name of ['HTMLImageElement', 'HTMLSourceElement', 'HTMLVideoElement', 'HTMLAudioElement', 'HTMLLinkElement', 'HTMLAnchorElement']) {
  globals[name] = class extends Element {}
  for (const key of ['src', 'srcset', 'href', 'poster']) {
    Object.defineProperty(globals[name].prototype, key, {
      configurable: true,
      get() { return this.getAttribute(key) },
      set(value) { this.attributes.set(key, value) },
    })
  }
}
let mutationCallback
vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../../webview/assets.js'), 'utf8'), {
  ...globals,
  window: { __COOLVIBES_EXTENSION__: { assetBaseUrl: 'https://webview.test/resources/' } },
  document: {},
  MutationObserver: class { constructor(callback) { mutationCallback = callback } observe() {} },
})
const base = 'https://webview.test/resources'
for (const folder of ['images', 'icons', 'animations', 'gifts', 'fonts', 'stickers', 'data', 'assets']) {
  const image = new globals.HTMLImageElement()
  image.setAttribute('src', `/${folder}/icon.avif`)
  assert.equal(image.getAttribute('src'), `${base}/${folder}/icon.avif`)
  image.src = `/${folder}/native.png`
  assert.equal(image.src, `${base}/${folder}/native.png`)
}
for (const value of ['https://cdn.test/photo.png', '//cdn.test/photo.png', 'data:image/png;base64,abc', 'blob:example', '/profile/123', '#section']) {
  const node = new globals.HTMLAnchorElement()
  node.href = value
  assert.equal(node.href, value)
}
const source = new globals.HTMLSourceElement()
source.srcset = '/images/a.png 1x, /images/b.png 2x'
assert.equal(source.srcset, `${base}/images/a.png 1x, ${base}/images/b.png 2x`)
const inserted = new Element()
inserted.attributes.set('src', '/images/inserted.png')
mutationCallback([{ addedNodes: [inserted] }])
assert.equal(inserted.getAttribute('src'), `${base}/images/inserted.png`)
const root = path.resolve(__dirname, '../../media/webview')
const webRoot = process.env.COOLVIBES_WEB_ROOT || path.resolve(__dirname, '../../../../web')
const catalog = JSON.parse(fs.readFileSync(path.join(webRoot, 'src/features/illustrations/icon-catalog.json'), 'utf8'))
for (const icon of catalog) {
  const file = path.join(webRoot, 'public/images/icons/dott', `${icon.key}.avif`)
  assert.ok(fs.statSync(file).size > 0, `Missing icon ${icon.key}`)
}
console.log(`PASS: asset routing, DOM setters, responsive sources, inserted markup and ${catalog.length} catalog asset paths.`)
