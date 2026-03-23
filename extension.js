const fs = require('node:fs')
const path = require('node:path')
const vscode = require('vscode')

const EXTENSION_TITLE = 'CoolVibes'
const SIDEBAR_VIEW_TYPE = 'coolvibes.sidebar'
const PANEL_VIEW_TYPE = 'coolvibes.panel'
const OPEN_PANEL_COMMAND = 'coolvibes.openPanel'

const DEFAULT_SERVICE_URL = [
  'https://api.coolvibes.lgbt',
  'https://api.coolvibes.lgbt',
]

const DEFAULT_SOCKET_URL = [
  'wss://socket.coolvibes.lgbt',
  'wss://socket2.coolvibes.lgbt',
]

function activate(context) {
  const provider = new CoolVibesWebviewProvider(context)

  context.subscriptions.push(
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
  }

  resolveWebviewView(webviewView) {
    this.configureWebview(webviewView.webview, 'sidebar')
  }

  openPanel() {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.One)
      return
    }

    const panel = vscode.window.createWebviewPanel(
      PANEL_VIEW_TYPE,
      EXTENSION_TITLE,
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [getWebviewRoot(this.context.extensionUri)],
      }
    )

    this.panel = panel
    this.configureWebview(panel.webview, 'panel')

    panel.onDidDispose(() => {
      if (this.panel === panel) {
        this.panel = undefined
      }
    })
  }

  configureWebview(webview, placement) {
    webview.options = {
      enableScripts: true,
      localResourceRoots: [getWebviewRoot(this.context.extensionUri)],
    }

    webview.html = getWebviewHtml(webview, this.context.extensionUri, placement)
    webview.onDidReceiveMessage(async (message) => {
      if (!message || typeof message !== 'object') {
        return
      }

      if (message.type === 'openExternal' && typeof message.url === 'string') {
        try {
          await vscode.env.openExternal(vscode.Uri.parse(message.url))
        } catch (error) {
          const detail = error instanceof Error ? error.message : 'Unknown error'
          void vscode.window.showErrorMessage(`Could not open link: ${detail}`)
        }
      }
    })
  }
}

function getWebviewRoot(extensionUri) {
  return vscode.Uri.joinPath(extensionUri, 'media', 'webview')
}

function getWebviewHtml(webview, extensionUri, placement) {
  const webviewRoot = getWebviewRoot(extensionUri)
  const indexPath = path.join(webviewRoot.fsPath, 'index.html')

  if (!fs.existsSync(indexPath)) {
    return getMissingBuildHtml()
  }

  const nonce = getNonce()
  const assetBaseUrl = `${webview.asWebviewUri(webviewRoot).toString()}/`
  let html = fs.readFileSync(indexPath, 'utf8')

  html = html.replace(
    '<head>',
    `<head>
    <meta http-equiv="Content-Security-Policy" content="${getContentSecurityPolicy(webview, nonce)}">
    <script nonce="${nonce}">
      const vscode = acquireVsCodeApi();
      const assetBaseUrl = ${JSON.stringify(assetBaseUrl)};
      const toAssetUrl = (value) => {
        if (typeof value !== 'string' || !value.startsWith('/')) return value;
        return assetBaseUrl + value.replace(/^\\/+/, '');
      };
      if (/\\/index\\.html?$/.test(window.location.pathname || '')) {
        const normalizedUrl = '/' + (window.location.search || '') + (window.location.hash || '');
        window.history.replaceState({}, '', normalizedUrl);
      }
      window.__COOLVIBES_EXTENSION__ = Object.freeze({
        mode: 'vscode',
        placement: ${JSON.stringify(placement)},
        assetBaseUrl,
        serviceURL: ${JSON.stringify(DEFAULT_SERVICE_URL)},
        socketURL: ${JSON.stringify(DEFAULT_SOCKET_URL)},
        disableNotifications: true,
        disablePush: true,
        disableAnalytics: true
      });
      const originalOpen = typeof window.open === 'function' ? window.open.bind(window) : null;
      window.open = (url, target, features) => {
        if (typeof url === 'string') {
          vscode.postMessage({ type: 'openExternal', url });
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
            const rewrittenUrl = toAssetUrl(input.url.replace(window.location.origin, ''));
            if (rewrittenUrl !== input.url) {
              return originalFetch(new Request(rewrittenUrl, input), init);
            }
          }
          return originalFetch(input, init);
        };
      }
      document.addEventListener('click', (event) => {
        const path = event.composedPath ? event.composedPath() : [];
        const anchor = path.find((node) => node && node.tagName === 'A');
        if (!anchor) return;
        const href = anchor.getAttribute('href');
        if (!href) return;
        if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:')) {
          event.preventDefault();
          vscode.postMessage({ type: 'openExternal', url: href });
        }
      });
    </script>`
  )

  html = html.replace(/<script(?![^>]*\bnonce=)\b/g, `<script nonce="${nonce}"`)
  html = rewriteLocalResourceUrls(html, webview, webviewRoot)

  return html
}

function rewriteLocalResourceUrls(html, webview, webviewRoot) {
  return html.replace(
    /\b(?:src|href)=["']([^"']+)["']/g,
    (match, target) => {
      if (
        target.startsWith('http://') ||
        target.startsWith('https://') ||
        target.startsWith('data:') ||
        target.startsWith('mailto:') ||
        target.startsWith('#')
      ) {
        return match
      }

      const relativeTarget = target.replace(/^\.\//, '').replace(/^\/+/, '')
      const resourceUri = webview.asWebviewUri(
        vscode.Uri.joinPath(webviewRoot, ...relativeTarget.split('/'))
      )

      return match.replace(target, resourceUri.toString())
    }
  )
}

function getContentSecurityPolicy(webview, nonce) {
  return [
    "default-src 'none'",
    `img-src ${webview.cspSource} https: data: blob:`,
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `font-src ${webview.cspSource} https: data:`,
    `script-src 'nonce-${nonce}' ${webview.cspSource} https:`,
    `connect-src https: wss: ${webview.cspSource}`,
    `media-src ${webview.cspSource} https: data: blob:`,
    `worker-src ${webview.cspSource} blob:`,
  ].join('; ')
}

function getMissingBuildHtml() {
  return `<!doctype html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
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
        <p>Run <code>npm run build</code> inside <code>vscode_extension</code> and reload the window.</p>
      </main>
    </body>
  </html>`
}

function getNonce() {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let nonce = ''
  for (let index = 0; index < 32; index += 1) {
    nonce += alphabet.charAt(Math.floor(Math.random() * alphabet.length))
  }
  return nonce
}

module.exports = {
  activate,
  deactivate,
}
