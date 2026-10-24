const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const vscode = require('vscode')

const EXTENSION_TITLE = 'CoolVibes'
const SIDEBAR_VIEW_TYPE = 'coolvibes.sidebar'
const PANEL_VIEW_TYPE = 'coolvibes.panel'
const OPEN_PANEL_COMMAND = 'coolvibes.openPanel'
const AUTH_STATE_SECRET = 'coolvibes.auth-state.v1'

const APP_URL = 'https://coolvibes.lgbt'
const APP_DOMAIN = 'coolvibes.lgbt'
const SERVICE_URL = [
  'https://api.coolvibes.lgbt',
  'https://api.coolvibes.lgbt',
]
const SOCKET_URL = [
  'wss://socket.coolvibes.lgbt',
  'wss://socket2.coolvibes.lgbt',
]

const ALLOWED_EXTERNAL_SCHEMES = new Set(['http', 'https', 'mailto'])

function activate(context) {
  const provider = new CoolVibesWebviewProvider(context)

  context.subscriptions.push(
    provider,
    vscode.window.registerWebviewViewProvider(SIDEBAR_VIEW_TYPE, provider, {
      webviewOptions: {
        retainContextWhenHidden: true,
      },
    }),
    vscode.commands.registerCommand(OPEN_PANEL_COMMAND, () => provider.openPanel())
  )
}

function deactivate() {}

class CoolVibesWebviewProvider {
  constructor(context) {
    this.context = context
    this.panel = undefined
    this.records = new Set()
    this.authUpdateQueue = Promise.resolve()
  }

  async resolveWebviewView(webviewView) {
    const record = this.createRecord(webviewView.webview, 'sidebar')

    record.disposables.push(
      webviewView.onDidDispose(() => this.disposeRecord(record))
    )

    await this.renderWebview(record)
  }

  async openPanel() {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.Active)
      return
    }

    const panel = vscode.window.createWebviewPanel(
      PANEL_VIEW_TYPE,
      EXTENSION_TITLE,
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [getWebviewRoot(this.context.extensionUri)],
      }
    )

    panel.iconPath = vscode.Uri.joinPath(this.context.extensionUri, 'media', 'brand', 'icon.png')

    this.panel = panel
    const record = this.createRecord(panel.webview, 'panel')

    record.disposables.push(
      panel.onDidDispose(() => {
        if (this.panel === panel) {
          this.panel = undefined
        }
        this.disposeRecord(record)
      })
    )

    await this.renderWebview(record)
  }

  createRecord(webview, placement) {
    webview.options = {
      enableScripts: true,
      localResourceRoots: [getWebviewRoot(this.context.extensionUri)],
    }

    const record = {
      webview,
      placement,
      authState: { known: false, token: null },
      disposables: [],
      renderVersion: 0,
    }

    record.disposables.push(
      webview.onDidReceiveMessage((message) => {
        void this.handleMessage(record, message)
      })
    )

    this.records.add(record)
    return record
  }

  async renderWebview(record, providedAuthState) {
    const renderVersion = record.renderVersion + 1
    record.renderVersion = renderVersion

    const authState = providedAuthState ?? await this.readAuthState()

    if (!this.records.has(record) || record.renderVersion !== renderVersion) {
      return
    }

    record.authState = authState
    record.webview.html = getWebviewHtml(
      record.webview,
      this.context.extensionUri,
      record.placement,
      authState
    )
  }

  async readAuthState() {
    let rawValue
    try {
      rawValue = await this.context.secrets.get(AUTH_STATE_SECRET)
    } catch {
      return { known: false, token: null }
    }

    if (rawValue === undefined) {
      return { known: false, token: null }
    }

    try {
      const parsed = JSON.parse(rawValue)
      return {
        known: true,
        token: normalizeAuthToken(parsed?.token),
      }
    } catch {
      return {
        known: true,
        token: normalizeAuthToken(rawValue),
      }
    }
  }

  async handleMessage(record, message) {
    if (!message || typeof message !== 'object') {
      return
    }

    if (message.type === 'openExternal') {
      await openExternalUrl(message.url)
      return
    }

    if (message.type !== 'authTokenChanged') {
      return
    }

    this.authUpdateQueue = this.authUpdateQueue
      .catch(() => {})
      .then(() => this.updateAuthToken(record, message.token))

    await this.authUpdateQueue
  }

  async updateAuthToken(record, value) {
    const nextToken = normalizeAuthToken(value)
    const nextAuthState = { known: true, token: nextToken }
    const stateChanged =
      !record.authState.known || record.authState.token !== nextToken

    try {
      await this.context.secrets.store(
        AUTH_STATE_SECRET,
        JSON.stringify({ token: nextToken })
      )
    } catch {
      // Keep the current views synchronized even if the OS keychain is unavailable.
    }

    record.authState = nextAuthState

    if (!stateChanged) {
      return
    }

    await Promise.all(
      [...this.records]
        .filter((target) => target !== record)
        .map((target) => this.renderWebview(target, nextAuthState))
    )
  }

  disposeRecord(record) {
    if (!this.records.delete(record)) {
      return
    }

    for (const disposable of record.disposables.splice(0)) {
      disposable.dispose()
    }
  }

  dispose() {
    const panel = this.panel
    this.panel = undefined

    if (panel) {
      panel.dispose()
    }

    for (const record of [...this.records]) {
      this.disposeRecord(record)
    }
  }
}

function normalizeAuthToken(value) {
  if (typeof value !== 'string') {
    return null
  }

  const token = value.trim()
  if (!token || token.length > 65_536) {
    return null
  }

  return token
}

async function openExternalUrl(value) {
  if (typeof value !== 'string' || value.length > 8_192) {
    return
  }

  let uri
  try {
    uri = vscode.Uri.parse(value, true)
  } catch {
    return
  }

  if (!ALLOWED_EXTERNAL_SCHEMES.has(uri.scheme.toLowerCase())) {
    return
  }

  try {
    await vscode.env.openExternal(uri)
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unknown error'
    void vscode.window.showErrorMessage(`Could not open link: ${detail}`)
  }
}

function getWebviewRoot(extensionUri) {
  return vscode.Uri.joinPath(extensionUri, 'media', 'webview')
}

function getWebviewHtml(webview, extensionUri, placement, authState) {
  const webviewRoot = getWebviewRoot(extensionUri)
  const indexPath = path.join(webviewRoot.fsPath, 'index.html')

  if (!fs.existsSync(indexPath)) {
    return getMissingBuildHtml()
  }

  const nonce = getNonce()
  const assetBaseUrl = `${webview.asWebviewUri(webviewRoot).toString()}/`
  const runtimeConfig = {
    mode: 'vscode',
    placement,
    assetBaseUrl: `${APP_URL}/`,
    appDomain: APP_DOMAIN,
    appURL: APP_URL,
    registrationURL: APP_URL,
    serviceURL: SERVICE_URL,
    socketURL: SOCKET_URL,
    disableNotifications: true,
    disablePush: true,
    disableAnalytics: true,
  }

  let html = fs.readFileSync(indexPath, 'utf8')

  html = html.replace(
    '<head>',
    `<head>
    <meta http-equiv="Content-Security-Policy" content="${getContentSecurityPolicy(webview, nonce)}">
    <script nonce="${nonce}">
      (() => {
        const vscodeApi = acquireVsCodeApi();
        const runtimeConfig = ${serializeForInlineScript(runtimeConfig)};
        const initialAuthState = ${serializeForInlineScript(authState)};
        const assetBaseUrl = runtimeConfig.assetBaseUrl;
        const toAssetUrl = (value) => {
          if (
            typeof value !== 'string' ||
            !value.startsWith('/') ||
            value.startsWith('//')
          ) {
            return value;
          }
          return assetBaseUrl + value.replace(/^\\/+/, '');
        };

        try {
          if (/\\/index\\.html?$/.test(window.location.pathname || '')) {
            const normalizedUrl = '/' + (window.location.search || '') + (window.location.hash || '');
            window.history.replaceState({}, '', normalizedUrl);
          }
        } catch {
          // The app can still run if the webview origin does not allow history normalization.
        }

        Object.defineProperty(window, '__COOLVIBES_EXTENSION__', {
          configurable: false,
          enumerable: false,
          value: Object.freeze(runtimeConfig),
          writable: false
        });

        try {
          if (initialAuthState.known) {
            if (initialAuthState.token) {
              window.localStorage.setItem('authToken', initialAuthState.token);
            } else {
              window.localStorage.removeItem('authToken');
            }
          } else {
            queueMicrotask(() => {
              vscodeApi.postMessage({
                type: 'authTokenChanged',
                token: window.localStorage.getItem('authToken')
              });
            });
          }
        } catch {
          // Auth still works for the current view if persistent webview storage is unavailable.
        }

        window.addEventListener('auth-token-changed', (event) => {
          vscodeApi.postMessage({
            type: 'authTokenChanged',
            token: event?.detail?.token ?? null
          });
        });

        const originalOpen = typeof window.open === 'function' ? window.open.bind(window) : null;
        window.open = (url, target, features) => {
          if (typeof url === 'string') {
            vscodeApi.postMessage({ type: 'openExternal', url });
            return null;
          }
          return originalOpen ? originalOpen(url, target, features) : null;
        };

        const originalFetch = typeof window.fetch === 'function' ? window.fetch.bind(window) : null;
        if (originalFetch) {
          window.fetch = (input, init) => {
            if (typeof input === 'string') {
              return originalFetch(toAssetUrl(input), init);
            }
            if (input instanceof Request) {
              const localPath = input.url.startsWith(window.location.origin)
                ? input.url.slice(window.location.origin.length)
                : input.url;
              const rewrittenUrl = toAssetUrl(localPath);
              if (rewrittenUrl !== input.url) {
                return originalFetch(new Request(rewrittenUrl, input), init);
              }
            }
            return originalFetch(input, init);
          };
        }

        document.addEventListener('click', (event) => {
          const eventPath = event.composedPath ? event.composedPath() : [];
          const anchor = eventPath.find((node) => node && node.tagName === 'A');
          if (!anchor) return;
          const href = anchor.getAttribute('href');
          if (!href) return;
          if (
            href.startsWith('http://') ||
            href.startsWith('https://') ||
            href.startsWith('mailto:')
          ) {
            event.preventDefault();
            vscodeApi.postMessage({ type: 'openExternal', url: href });
          }
        });
      })();
    </script>`
  )

  html = html.replace(/<script(?![^>]*\bnonce=)\b/g, `<script nonce="${nonce}"`)
  html = rewriteLocalResourceUrls(html, webview, webviewRoot)

  return html
}

function rewriteLocalResourceUrls(html, webview, webviewRoot) {
  return html.replace(
    /\b(src|href)=(['"])([^'"]+)\2/g,
    (match, attribute, quote, target) => {
      if (
        target.startsWith('http://') ||
        target.startsWith('https://') ||
        target.startsWith('data:') ||
        target.startsWith('mailto:') ||
        target.startsWith('#')
      ) {
        return match
      }

      const suffixIndex = target.search(/[?#]/)
      const resourceTarget = suffixIndex === -1 ? target : target.slice(0, suffixIndex)
      const suffix = suffixIndex === -1 ? '' : target.slice(suffixIndex)
      const relativeTarget = resourceTarget.replace(/^\.\//, '').replace(/^\/+/, '')
      const resourceUri = webview.asWebviewUri(
        vscode.Uri.joinPath(webviewRoot, ...relativeTarget.split('/'))
      )
      const rewrittenTarget = `${resourceUri.toString()}${suffix}`

      return `${attribute}=${quote}${rewrittenTarget}${quote}`
    }
  )
}

function getContentSecurityPolicy(webview, nonce) {
  return [
    "default-src 'none'",
    "base-uri 'none'",
    `img-src ${webview.cspSource} https: data: blob:`,
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `font-src ${webview.cspSource} https://coolvibes.lgbt data:`,
    `script-src 'nonce-${nonce}' ${webview.cspSource} https://www.google.com https://www.gstatic.com https://www.recaptcha.net https://platform.twitter.com https://cdn.syndication.twimg.com https://pay.google.com`,
    `connect-src ${webview.cspSource} https: wss:`,
    'frame-src https:',
    `media-src ${webview.cspSource} https: data: blob:`,
    `worker-src ${webview.cspSource} blob:`,
    'form-action https:',
  ].join('; ')
}

function getMissingBuildHtml() {
  return `<!doctype html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <style>
        body {
          margin: 0;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          background: #111827;
          color: #f9fafb;
          display: grid;
          place-items: center;
          min-height: 100vh;
          padding: 24px;
        }
        main {
          max-width: 560px;
          background: rgba(17, 24, 39, 0.92);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          padding: 24px;
          line-height: 1.6;
        }
        code {
          background: rgba(255, 255, 255, 0.08);
          padding: 2px 6px;
          border-radius: 6px;
        }
      </style>
    </head>
    <body>
      <main>
        <h1>CoolVibes webview build is missing</h1>
        <p>Run <code>yarn build</code> inside <code>vscode_extension</code> and reload the window.</p>
      </main>
    </body>
  </html>`
}

function serializeForInlineScript(value) {
  return JSON.stringify(value)
    .replace(/&/g, '\\u0026')
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}

function getNonce() {
  return crypto.randomBytes(24).toString('base64url')
}

module.exports = {
  activate,
  deactivate,
}
