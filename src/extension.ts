import * as vscode from 'vscode';
import * as path from 'path';

function buildOpenGrokUrl(): string | null {
    const editor = vscode.window.activeTextEditor;

    if (!editor) {
        vscode.window.showErrorMessage('No active editor found');
        return null;
    }

    const document = editor.document;
    const selection = editor.selection;
    const lineNumber = selection.active.line + 1; // VS Code lines are 0-indexed, OpenGrok is 1-indexed

    // Get configuration
    const config = vscode.workspace.getConfiguration('opengrok-navigator');
    const baseUrl = config.get<string>('baseUrl');
    const projectRoot = config.get<string>('projectRoot');
    const useTopLevelFolder = config.get<boolean>('useTopLevelFolder', false);

    if (!baseUrl) {
        vscode.window.showErrorMessage('OpenGrok base URL is not configured. Please set it in settings.');
        return null;
    }

    // Get the file path relative to workspace
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        vscode.window.showErrorMessage('No workspace folder found');
        return null;
    }

    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    const filePath = document.uri.fsPath;

    // Calculate relative path
    let relativePath = path.relative(workspaceRoot, filePath);

    // Determine the project name for OpenGrok URL
    let projectName: string;

    if (useTopLevelFolder) {
        // Use the top-level folder name (first component of relative path)
        const pathComponents = relativePath.split(path.sep);
        if (pathComponents.length > 0) {
            projectName = pathComponents[0];
            // Remove the top-level folder from the relative path
            relativePath = pathComponents.slice(1).join('/');
        } else {
            vscode.window.showErrorMessage('Unable to determine top-level folder');
            return null;
        }
    } else {
        // Use the workspace name
        projectName = vscode.workspace.workspaceFolders?.[0]?.name || 'unknown';
    }

    // If projectRoot is specified, prepend it
    if (projectRoot) {
        relativePath = path.join(projectRoot, relativePath);
    }

    // Normalize path for URL (replace backslashes with forward slashes)
    relativePath = relativePath.replace(/\\/g, '/');

    // Construct OpenGrok URL
    // OpenGrok URL format: {baseUrl}/xref/{projectName}/{path}#{line}
    return `${baseUrl}/xref/${projectName}/${relativePath}#${lineNumber}`;
}

export function activate(context: vscode.ExtensionContext) {
    console.log('OpenGrok Navigator extension is now active');

    // Command: Open in OpenGrok
    let openDisposable = vscode.commands.registerCommand('opengrok-navigator.openInOpenGrok', async () => {
        const openGrokUrl = buildOpenGrokUrl();
        if (!openGrokUrl) {
            return;
        }

        const config = vscode.workspace.getConfiguration('opengrok-navigator');
        const useIntegratedBrowser = config.get<boolean>('useIntegratedBrowser', false);

        // Open in browser (integrated or external based on setting)
        if (useIntegratedBrowser) {
            // Open in VS Code's built-in Simple Browser
            try {
                await vscode.commands.executeCommand('simpleBrowser.show', openGrokUrl);
            } catch (error) {
                // Handle any errors with Simple Browser
                vscode.window.showErrorMessage(
                    `Failed to open in Simple Browser: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    'Open Settings',
                    'Use External Browser'
                ).then(selection => {
                    if (selection === 'Open Settings') {
                        vscode.commands.executeCommand('workbench.action.openSettings', 'opengrok-navigator.useIntegratedBrowser');
                    } else if (selection === 'Use External Browser') {
                        vscode.env.openExternal(vscode.Uri.parse(openGrokUrl));
                    }
                });
                return;
            }
        } else {
            // Open in external system browser
            vscode.env.openExternal(vscode.Uri.parse(openGrokUrl));
        }
    });

    // Command: Copy OpenGrok URL
    let copyDisposable = vscode.commands.registerCommand('opengrok-navigator.copyOpenGrokUrl', async () => {
        const openGrokUrl = buildOpenGrokUrl();
        if (!openGrokUrl) {
            return;
        }

        // Copy URL to clipboard
        await vscode.env.clipboard.writeText(openGrokUrl);
        vscode.window.showInformationMessage('OpenGrok URL copied to clipboard');
    });

    // Command: Search in OpenGrok
    let searchDisposable = vscode.commands.registerCommand('opengrok-navigator.searchInOpenGrok', async () => {
        const editor = vscode.window.activeTextEditor;
        const config = vscode.workspace.getConfiguration('opengrok-navigator');
        const baseUrl = config.get<string>('baseUrl');
        const useTopLevelFolder = config.get<boolean>('useTopLevelFolder', false);

        if (!baseUrl) {
            vscode.window.showErrorMessage('OpenGrok base URL is not configured. Please set it in settings.');
            return;
        }

        // Determine the project name
        let projectName: string = '';

        if (editor) {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (workspaceFolders) {
                const workspaceRoot = workspaceFolders[0].uri.fsPath;
                const filePath = editor.document.uri.fsPath;
                const relativePath = path.relative(workspaceRoot, filePath);

                if (useTopLevelFolder) {
                    // Use the top-level folder name
                    const pathComponents = relativePath.split(path.sep);
                    if (pathComponents.length > 0) {
                        projectName = pathComponents[0];
                    }
                } else {
                    // Use the workspace name
                    projectName = workspaceFolders[0].name;
                }
            }
        }

        // Get selected text or prompt for search term
        let searchText = '';
        if (editor && !editor.selection.isEmpty) {
            searchText = editor.document.getText(editor.selection);
        }

        // If no selection, prompt for search term
        if (!searchText) {
            const input = await vscode.window.showInputBox({
                prompt: 'Enter text to search in OpenGrok',
                placeHolder: 'Search term'
            });

            if (!input) {
                return; // User cancelled
            }
            searchText = input;
        }

        // URL encode and quote the search text for exact match
        const quotedSearchText = `"${searchText}"`;
        const encodedSearchText = encodeURIComponent(quotedSearchText);

        // Construct OpenGrok search URL with project parameter
        // OpenGrok search format: {baseUrl}/search?full={searchText}&project={projectName}
        let searchUrl = `${baseUrl}/search?full=${encodedSearchText}`;
        if (projectName) {
            searchUrl += `&project=${encodeURIComponent(projectName)}`;
        }

        const useIntegratedBrowser = config.get<boolean>('useIntegratedBrowser', false);

        // Open search results in browser (integrated or external based on setting)
        if (useIntegratedBrowser) {
            try {
                await vscode.commands.executeCommand('simpleBrowser.show', searchUrl);
            } catch (error) {
                vscode.window.showErrorMessage(
                    `Failed to open in Simple Browser: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    'Open Settings',
                    'Use External Browser'
                ).then(selection => {
                    if (selection === 'Open Settings') {
                        vscode.commands.executeCommand('workbench.action.openSettings', 'opengrok-navigator.useIntegratedBrowser');
                    } else if (selection === 'Use External Browser') {
                        vscode.env.openExternal(vscode.Uri.parse(searchUrl));
                    }
                });
                return;
            }
        } else {
            vscode.env.openExternal(vscode.Uri.parse(searchUrl));
        }
    });

    context.subscriptions.push(openDisposable, copyDisposable, searchDisposable);
}

export function deactivate() {}
