# OpenGrok Navigator

A VS Code extension that allows you to quickly open the current line of code in your OpenGrok instance.

## Features

- **Keyboard Shortcut**: Press `Ctrl+Shift+O` (Windows/Linux) or `Cmd+Shift+O` (Mac) to open the current line in OpenGrok
- **Context Menu**: Right-click in the editor and select "Open in OpenGrok"
- **Configurable**: Set your OpenGrok base URL in VS Code settings

## Installation

### From Source

1. Clone or download this extension
2. Open the extension folder in VS Code
3. Run `npm install` to install dependencies
4. Run `npm run compile` to compile the TypeScript code
5. Press `F5` to launch a new VS Code window with the extension loaded

### Packaging and Installing

1. Install vsce: `npm install -g @vscode/vsce`
2. Package the extension: `vsce package`
3. Install the `.vsix` file: In VS Code, go to Extensions → "..." menu → "Install from VSIX"

## Configuration

Before using the extension, configure your OpenGrok base URL:

1. Open VS Code Settings (`Ctrl+,` or `Cmd+,`)
2. Search for "OpenGrok Navigator"
3. Set the following settings:
   - **Base URL**: Your OpenGrok instance URL (e.g., `http://opengrok.example.com/source`)
   - **Project Root** (optional): If your project in OpenGrok has a different root path
   - **Use Integrated Browser** (optional): Enable to open OpenGrok links in VS Code's built-in Simple Browser instead of your system browser (default: disabled)

Example settings in `settings.json`:

```json
{
  "opengrok-navigator.baseUrl": "http://localhost:8080/source",
  "opengrok-navigator.projectRoot": "",
  "opengrok-navigator.useIntegratedBrowser": false
}
```

## Usage

1. Open a file in VS Code
2. Place your cursor on the line you want to view in OpenGrok
3. Use one of the following methods:
   - Press `Ctrl+Shift+O` (Windows/Linux) or `Cmd+Shift+O` (Mac)
   - Right-click and select "Open in OpenGrok" from the context menu
4. Your browser will open to the corresponding line in OpenGrok

## How It Works

The extension:
1. Gets the current file path relative to your workspace
2. Gets the current line number (1-indexed)
3. Constructs an OpenGrok URL in the format: `{baseUrl}/xref/{relativePath}#{lineNumber}`
4. Opens the URL in your default browser

## Requirements

- VS Code 1.74.0 or higher
- A running OpenGrok instance
- Files must be part of a workspace (not standalone files)

## Known Issues

- Only works with files that are part of a workspace
- Assumes standard OpenGrok URL structure (`/xref/` for cross-reference view)

## Release Notes

### 1.0.0

Initial release with:
- Keyboard shortcut support
- Context menu integration
- Configurable OpenGrok base URL
- Line number navigation

## Contributing

Feel free to submit issues or pull requests to improve this extension.

## License

MIT
