// React, native image setters and dynamically inserted markup must all use
// VS Code resource URLs, while application navigation keeps its original paths.
const assetBaseUrl = window.__COOLVIBES_EXTENSION__?.assetBaseUrl
const publicAssetPath = /^\/(?:images|icons|animations|gifts|fonts|stickers|data|assets)\//
const resolveAsset = (value) =>
  typeof value === 'string' && assetBaseUrl && publicAssetPath.test(value)
    ? `${assetBaseUrl.replace(/\/+$/, '')}${value}`
    : value

if (assetBaseUrl) {
  const attributes = new Set(['src', 'href', 'poster', 'srcset'])
  const resolveAttribute = (name, value) => {
    if (name !== 'srcset' || typeof value !== 'string' || value.includes('data:')) {
      return resolveAsset(value)
    }
    return value.split(',').map((candidate) => {
      const [url, ...descriptor] = candidate.trim().split(/\s+/)
      return [resolveAsset(url), ...descriptor].join(' ')
    }).join(', ')
  }
  const originalSetAttribute = Element.prototype.setAttribute
  Element.prototype.setAttribute = function (name, value) {
    const key = String(name).toLowerCase()
    return originalSetAttribute.call(this, name,
      attributes.has(key) ? resolveAttribute(key, value) : value)
  }

  // Libraries also assign image.src directly rather than setting an attribute.
  for (const [constructor, properties] of [
    [HTMLImageElement, ['src', 'srcset']],
    [HTMLSourceElement, ['src', 'srcset']],
    [HTMLVideoElement, ['src', 'poster']],
    [HTMLAudioElement, ['src']],
    [HTMLLinkElement, ['href']],
    [HTMLAnchorElement, ['href']],
  ]) {
    for (const property of properties) {
      const descriptor = Object.getOwnPropertyDescriptor(constructor.prototype, property)
      if (!descriptor?.set || !descriptor.configurable) continue
      Object.defineProperty(constructor.prototype, property, {
        ...descriptor,
        set(value) {
          descriptor.set.call(this, resolveAttribute(property, value))
        },
      })
    }
  }

  // Cover HTML inserted by rich content and third-party widgets.
  const repairElement = (element) => {
    for (const attribute of attributes) {
      const value = element.getAttribute(attribute)
      if (value === null) continue
      const resolved = resolveAttribute(attribute, value)
      if (resolved !== value) originalSetAttribute.call(element, attribute, resolved)
    }
  }
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (!(node instanceof Element)) continue
        repairElement(node)
        node.querySelectorAll('[src], [href], [poster], [srcset]').forEach(repairElement)
      }
    }
  })
  observer.observe(document, { childList: true, subtree: true })
}
