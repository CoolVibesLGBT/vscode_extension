# Changelog

## 0.0.9

- Load public artwork, icons, stickers and animations from https://coolvibes.lgbt instead of embedding the public asset library
- Retain local application bundles, dependency assets and the VS Code brand icon
- Exclude generated VSIX files, webview builds and node_modules from Git

## 0.0.8

- Resolve public image and icon paths across all webview screens, including menus and profiles
- Support React attributes, direct image assignments, responsive sources and inserted HTML
- Preserve application routes and remote media URLs while rewriting packaged resources

## 0.0.7

- Refresh Marketplace description and feature documentation for the current web application
- Document supported languages, account requirements, device permissions and service availability
- Add optional Marketplace publishing to deploy.sh using the exact generated VSIX

## 0.0.6

- Use the current dott-v3 brand icon in the extension listing, Activity Bar, and panel tab
- Resolve the wordmark, illustrated icons, and brandkit images through webview resource URLs
- Synchronize the extension icon from the web brand assets on each build

## 0.0.5

- Bundled the updated CoolVibes web application directly from the web workspace
- Updated asset validation to support embedded SVG images containing parentheses
- Fixed the packaging hook to run the extension check script with Yarn

## 0.0.4

- Rebuilt the extension from the current CoolVibes Vite + React web application
- Fixed API tenant resolution and canonical share links inside VS Code webviews
- Fixed Leaflet, KaTeX, and root-relative CSS assets in packaged builds
- Synchronized authentication between the sidebar and panel with VS Code Secret Storage
- Opened account creation on the verified CoolVibes website for reliable reCAPTCHA checks
- Hardened Content Security Policy and external-link protocol validation
- Made the web source path portable and added post-build asset validation

## 0.0.1

- Initial VS Code extension release for CoolVibes
- Sidebar and panel webview support
- Bundled webview assets for Marketplace packaging
