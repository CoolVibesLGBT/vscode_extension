# Developing and publishing CoolVibes for VS Code


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

Publishing automatically uses `VSCE_PAT` when supplied, or Microsoft Entra ID through an installed Azure CLI. If a Microsoft login is needed, the script opens the sign-in flow; no Azure subscription is required. The Microsoft identity must have publishing access to the CoolVibes publisher.

Without Azure CLI, the script opens the Marketplace publisher page and reveals the VSIX for browser upload. Select the extension, choose **Update**, and upload the package. This path exits with status 2 to indicate that publication is still pending.

For token-free CLI publishing on macOS:

```bash
brew install azure-cli
COOLVIBES_PUBLISH_AUTH=azure ./deploy.sh --publish
```

Use `COOLVIBES_PUBLISH_AUTH=browser` to select browser upload, or `COOLVIBES_PUBLISH_AUTH=pat` to use an existing vsce login. Keep credentials out of source files. Increase the version in `package.json` before publishing another release.


## Verify asset integration

```bash
yarn run check
yarn run check:assets
yarn run check:assets:browser
```

Browser checks require Chrome and the web workspace’s Playwright dependencies.
