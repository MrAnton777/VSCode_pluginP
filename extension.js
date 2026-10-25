const vscode = require('vscode');

async function applyTimeTheme() {
  const config = vscode.workspace.getConfiguration('daylightProfiles');
  const dayStart = config.get('dayStart', 8);
  const nightStart = config.get('nightStart', 19);
  if (!Number.isInteger(dayStart) || !Number.isInteger(nightStart)
    || dayStart < 0 || dayStart > 23 || nightStart < 0 || nightStart > 23
    || dayStart === nightStart) {
    throw new Error('Начало дня и ночи: разные целые числа от 0 до 23.');
  }
  const hour = new Date().getHours();
  const isDay = dayStart < nightStart
    ? hour >= dayStart && hour < nightStart
    : hour >= dayStart || hour < nightStart;
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

  const settingsCommand = vscode.commands.registerCommand(
    'daylightProfiles.openSettings',
    () => vscode.commands.executeCommand('workbench.action.openSettings', 'daylightProfiles')
  );

  context.subscriptions.push(command, toggleCommand, timeCommand, autoCommand, stopCommand, settingsCommand);
  context.subscriptions.push({ dispose: stopAutomatic });
}

module.exports = { activate };
