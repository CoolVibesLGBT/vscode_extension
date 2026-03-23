# CoolVibes VS Code Extension

Bu klasor, `../web` icindeki mevcut CoolVibes web uygulamasini VS Code webview icinde calistiran extension projesidir.

## Build

```bash
npm run build
```

Bu komut:

- `../web/src` kodunu Vite ile extension webview bundle'ina cevirir
- `../web/public` asset'lerini `media/webview` altina kopyalar

## Calistirma

1. Bu klasoru VS Code icinde acin.
2. `npm run build` calistirin.
3. `F5` ile Extension Development Host acin.
4. Activity Bar icindeki `CoolVibes` gorunumu ya da `CoolVibes: Open Panel` komutunu kullanin.
