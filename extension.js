const vscode = require('vscode');

function activate(context) {
  const command = vscode.commands.registerCommand(
    'daylightProfiles.start',
    () => {
      vscode.window.showInformationMessage('Daylight Profiles запущен!');
    }
  );

  const toggleCommand = vscode.commands.registerCommand(
    'daylightProfiles.toggleTheme',
    async () => {
      const kind = vscode.window.activeColorTheme.kind;
      const isLight = kind === vscode.ColorThemeKind.Light
        || kind === vscode.ColorThemeKind.HighContrastLight;
      const theme = isLight ? 'Visual Studio Dark' : 'Visual Studio Light';

      await vscode.workspace.getConfiguration('workbench').update(
        'colorTheme', theme, vscode.ConfigurationTarget.Global
      );
    }
  );

  context.subscriptions.push(command, toggleCommand);
}

module.exports = { activate };
