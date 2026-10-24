<p align="center">
  <img src="https://coolvibes.lgbt/images/brand/dott-v3/wordmark.png" alt="CoolVibes" width="330">
</p>

# CoolVibes for Visual Studio Code

**Your colors. Your people.** Bring the CoolVibes social and dating experience into VS Code: community posts, expressive profiles, discovery, conversations and more for the LGBTQIA+ community and respectful allies, aged **18 and over**.

Open CoolVibes in the Activity Bar while you work, or use **CoolVibes: Open Panel** for a wider editor view. This extension bundles the current CoolVibes web application and loads its wordmark, illustrated icons and public media from coolvibes.lgbt. The VS Code extension icon remains included locally.

[Website](https://coolvibes.lgbt) · [Brandkit](https://coolvibes.lgbt/brandkit) · [Support and issues](https://github.com/CoolVibesLGBT/vscode_extension/issues)

## Features

### Community and publishing

Browse the community feed, read and write posts, reply, react and bookmark content. Share media and use the web application's rich editor, polls and event flows. Content visibility, uploads and moderation follow your account's service permissions.

### Profiles, friends and photos

Personalize your biography, interests, attributes and preferences. Explore profiles, followers and engagement lists, manage friend requests, and browse public and private photo tabs. Private-photo access requests and revocation use the same server permissions as the website.

### Discovery, dating and places

Search for people, explore discovery and nearby views, and use likes and matches where available to your account. Discover places, view map and business details, and access check-in flows. Location-based results require location access and available service data.

### Private messages and groups

Access private and group conversations, replies, message editing, forwarding, pinned messages, attachments, stickers and GIFs. Manage group details, membership and invitation links through the existing CoolVibes messaging experience. Messaging requires the CoolVibes API and socket services.

### Live and community services

Access live broadcast discovery and participation screens, community classifieds, wallet history and referral features offered by the web application. Broadcasts depend on media permissions and live-service tokens; financial actions depend on provider availability and account eligibility. Some web payment options are placeholders.

### Appearance and languages

Use light, dark or system appearance, accent colors, message sizing, chat gradients and wallpaper. The app includes **23 locale variants**, including English, Turkish, German, Spanish, French, Arabic, Nepali, Khmer, Chinese and Korean variants, with right-to-left support where appropriate. The responsive interface adapts to a narrow sidebar or a larger panel.

### Integrated with VS Code

- Open CoolVibes from its updated CV icon in the Activity Bar.
- Run **CoolVibes: Open Panel** from the Command Palette for more room.
- Keep authentication synchronized between the sidebar and panel using VS Code Secret Storage.
- Open external web links in your browser through VS Code.
- Load current brand artwork and illustrated icons from the CoolVibes website.

## Getting started

1. Install **CoolVibes** and select its icon in the Activity Bar.
2. Sign in with your existing CoolVibes account.
3. For a larger view, open the Command Palette and run **CoolVibes: Open Panel**.

Account creation opens [coolvibes.lgbt](https://coolvibes.lgbt) in your browser so reCAPTCHA runs on the verified website domain. After registration, return to the extension and sign in.

Requires **Visual Studio Code 1.85 or later**, an internet connection and a CoolVibes account for authenticated features.

## Privacy, permissions and availability

The extension connects to the CoolVibes HTTPS API and secure WebSocket services. Authentication is stored using VS Code Secret Storage and shared between this extension's views. Browser notifications, push notifications, service workers and analytics are disabled through the extension's runtime integration.

Your account permissions, visibility preferences, blocking/reporting controls and service feature gates still apply. Device-dependent features such as location, camera, microphone and clipboard access depend on VS Code's webview and operating-system permissions. Some browser integrations may require the website. This extension does not claim end-to-end encrypted messaging or guaranteed support for live media and payments inside VS Code.

Read the current privacy policy and community rules in the website's [legal and community center](https://coolvibes.lgbt/legal).

## What's new in 0.0.9

- Load menu/profile icons, public artwork, stickers and animations from coolvibes.lgbt to reduce package size.
- Current CoolVibes web experience bundled directly from the web workspace.
- Updated CV icon for the extension listing, Activity Bar and editor panel tab.
- Fixed webview resource paths for the wordmark, illustrated icons and brandkit artwork.
- Expanded this listing to describe current community, profile, discovery, messaging and personalization features.
- Added a single-command build workflow with optional Marketplace publication.

See [CHANGELOG.md](CHANGELOG.md) for release history.

## Build and publish

Install the web workspace's dependencies with Yarn, then install the extension's dependencies:

```bash
yarn install --frozen-lockfile
```

Build the latest web source into a validated, installable VSIX:

```bash
./deploy.sh
# Or select a specific web workspace:
./deploy.sh /absolute/path/to/web
```

The build discovers the sibling web workspace automatically. You can also set `COOLVIBES_WEB_ROOT`. It refreshes brand artwork, validates HTML/CSS asset references and packages the extension. Install the resulting `.vsix` using **Extensions → Install from VSIX…**.

To build and publish the same package to the **CoolVibes** Marketplace publisher:

```bash
./deploy.sh --publish
# Or:
./deploy.sh --publish /absolute/path/to/web
```

Publishing requires a configured `vsce` publisher login or the `VSCE_PAT` environment variable with Marketplace publishing permissions. Keep credentials out of source files. Increase the version in `package.json` before publishing another release.

## Support

- [CoolVibes website](https://coolvibes.lgbt)
- [Report an extension issue](https://github.com/CoolVibesLGBT/vscode_extension/issues)
- [Extension source](https://github.com/CoolVibesLGBT/vscode_extension)
- [Web application and product documentation](https://github.com/CoolVibesLGBT/web)
