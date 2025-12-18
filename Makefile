# OpenGrok Navigator Build System
# Builds both VS Code and Chrome extensions and creates distribution packages

.PHONY: all clean build-vscode build-chrome source dist dev help

# Default target
all: dist

help:
	@echo "OpenGrok Navigator Build System"
	@echo ""
	@echo "Targets:"
	@echo "  all          - Build everything and create single distribution zip (default)"
	@echo "  build-vscode - Build VS Code extension (.vsix)"
	@echo "  build-chrome - Package Chrome extension (.zip)"
	@echo "  source       - Create source-only package (without .git, node_modules, etc.)"
	@echo "  dist         - Build all and create single distribution zip with built extensions"
	@echo "  clean        - Remove all build artifacts"
	@echo "  dev          - Quick development build (no clean)"
	@echo ""

# Clean all build artifacts
clean:
	@echo "Cleaning build artifacts..."
	rm -rf dist/
	rm -rf vscode-extension/out/
	rm -rf vscode-extension/*.vsix
	rm -rf chrome-extension/*.zip
	@echo "Clean complete"

# Build VS Code extension
build-vscode:
	@echo "Building VS Code extension..."
	cd vscode-extension && npm install
	cd vscode-extension && npm run compile
	cd vscode-extension && npx vsce package --no-git-tag-version
	@echo "VS Code extension built successfully"

# Package Chrome extension
build-chrome:
	@echo "Packaging Chrome extension..."
	@mkdir -p chrome-extension/dist
	cd chrome-extension && zip -r opengrok-navigator-chrome.zip \
		manifest.json \
		background.js \
		content.js \
		content.css \
		options.html \
		options.js \
		README.md \
		-x "*.zip" "dist/*" ".DS_Store"
	@echo "Chrome extension packaged successfully"

# Create source distribution package
source:
	@echo "Creating source package..."
	@mkdir -p dist
	@VERSION=$$(grep '"version"' vscode-extension/package.json | head -1 | sed 's/.*"version": "\(.*\)".*/\1/') && \
	zip -r dist/opengrok-navigator-source-v$$VERSION.zip \
		. \
		-x "*.git*" \
		-x "*node_modules/*" \
		-x "*/out/*" \
		-x "*.vsix" \
		-x "*.zip" \
		-x "*/dist/*" \
		-x "*/.DS_Store" \
		-x "*.log"
	@echo "Source package created in dist/"

# Build everything and create distribution
dist: clean build-vscode build-chrome
	@echo "Creating distribution package..."
	@mkdir -p dist/package
	@VERSION=$$(grep '"version"' vscode-extension/package.json | head -1 | sed 's/.*"version": "\(.*\)".*/\1/') && \
	cp vscode-extension/*.vsix dist/package/ 2>/dev/null && \
	cp chrome-extension/opengrok-navigator-chrome.zip dist/package/ 2>/dev/null && \
	cp README.md dist/package/ && \
	cp LICENSE dist/package/ && \
	cp BUILD.md dist/package/ && \
	echo "# OpenGrok Navigator v$$VERSION" > dist/package/VERSION.txt && \
	echo "" >> dist/package/VERSION.txt && \
	echo "Contents:" >> dist/package/VERSION.txt && \
	echo "- opengrok-navigator-*.vsix - VS Code extension" >> dist/package/VERSION.txt && \
	echo "- opengrok-navigator-chrome.zip - Chrome extension" >> dist/package/VERSION.txt && \
	echo "- README.md - User documentation" >> dist/package/VERSION.txt && \
	echo "- BUILD.md - Build instructions" >> dist/package/VERSION.txt && \
	echo "- LICENSE - MIT license" >> dist/package/VERSION.txt && \
	cd dist && zip -r opengrok-navigator-v$$VERSION.zip package/ && \
	rm -rf package/
	@echo ""
	@echo "=========================================="
	@echo "Build complete! Distribution package:"
	@echo "=========================================="
	@ls -lh dist/
	@echo "=========================================="

# Quick build for development (no clean)
dev: build-vscode build-chrome
	@echo "Development build complete"
