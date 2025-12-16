import * as vscode from 'vscode';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
    console.log('OpenGrok Navigator extension is now active');

    let disposable = vscode.commands.registerCommand('opengrok-navigator.openInOpenGrok', async () => {
        const editor = vscode.window.activeTextEditor;
        
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found');
            return;
        }

        const document = editor.document;
        const selection = editor.selection;
        const lineNumber = selection.active.line + 1; // VS Code lines are 0-indexed, OpenGrok is 1-indexed
        
        // Get configuration
        const config = vscode.workspace.getConfiguration('opengrok-navigator');
        const baseUrl = config.get<string>('baseUrl');
        const projectRoot = config.get<string>('projectRoot');
        const useIntegratedBrowser = config.get<boolean>('useIntegratedBrowser', false);
        const workspaceName = vscode.workspace.workspaceFolders?.[0]?.name;

        if (!baseUrl) {
            vscode.window.showErrorMessage('OpenGrok base URL is not configured. Please set it in settings.');
            return;
        }

        // Get the file path relative to workspace
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            vscode.window.showErrorMessage('No workspace folder found');
            return;
        }

        const workspaceRoot = workspaceFolders[0].uri.fsPath;
        const filePath = document.uri.fsPath;
        
        // Calculate relative path
        let relativePath = path.relative(workspaceRoot, filePath);
        
        // If projectRoot is specified, prepend it
        if (projectRoot) {
            relativePath = path.join(projectRoot, relativePath);
        }
        
        // Normalize path for URL (replace backslashes with forward slashes)
        relativePath = relativePath.replace(/\\/g, '/');
        
        // Construct OpenGrok URL
        // OpenGrok URL format: {baseUrl}/xref/{path}#{line}
        const openGrokUrl = `${baseUrl}/xref/${workspaceName}/${relativePath}#${lineNumber}`;

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

    context.subscriptions.push(disposable);
}

export function deactivate() {}
