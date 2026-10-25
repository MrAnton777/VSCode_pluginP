const vscode = require('vscode');

async function applyTimeTheme() {
  const hour = new Date().getHours();
  const isDay = hour >= 8 && hour < 19;
  const theme = isDay ? 'Visual Studio Light' : 'Visual Studio Dark';

  await vscode.workspace.getConfiguration('workbench').update(
    'colorTheme', theme, vscode.ConfigurationTarget.Global
  );
}

function activate(context) {
  let timer;

  function stopAutomatic() {
    clearInterval(timer);
    timer = undefined;
  }

  const command = vscode.commands.registerCommand(
    'daylightProfiles.start',
    () => {
      vscode.window.showInformationMessage('Daylight Profiles запущен!');
    }
  );

  const toggleCommand = vscode.commands.registerCommand(
    'daylightProfiles.toggleTheme',
    async () => {
      stopAutomatic();
      const kind = vscode.window.activeColorTheme.kind;
      const isLight = kind === vscode.ColorThemeKind.Light
        || kind === vscode.ColorThemeKind.HighContrastLight;
      const theme = isLight ? 'Visual Studio Dark' : 'Visual Studio Light';

      await vscode.workspace.getConfiguration('workbench').update(
        'colorTheme', theme, vscode.ConfigurationTarget.Global
      );
    }
  );

  const timeCommand = vscode.commands.registerCommand(
    'daylightProfiles.applyTimeTheme',
    applyTimeTheme
  );

  const autoCommand = vscode.commands.registerCommand(
    'daylightProfiles.startAutomatic',
    async () => {
      if (!timer) {
        timer = setInterval(() => {
          applyTimeTheme().catch(error => vscode.window.showErrorMessage(error.message));
        }, 60_000);
      }
      try {
        await applyTimeTheme();
        if (timer) vscode.window.showInformationMessage('Автоматический режим включён.');
      } catch (error) {
        stopAutomatic();
        vscode.window.showErrorMessage(error.message);
      }
    }
  );

  const stopCommand = vscode.commands.registerCommand(
    'daylightProfiles.stopAutomatic',
    () => {
      stopAutomatic();
      vscode.window.showInformationMessage('Автоматический режим остановлен.');
    }
  );

  context.subscriptions.push(command, toggleCommand, timeCommand, autoCommand, stopCommand);
  context.subscriptions.push({ dispose: stopAutomatic });
}

module.exports = { activate };
