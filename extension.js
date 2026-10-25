const vscode = require('vscode');

function activate(context) {
  const command = vscode.commands.registerCommand(
    'daylightProfiles.start',
    () => {
      vscode.window.showInformationMessage('Daylight Profiles запущен!');
    }
  );

  context.subscriptions.push(command);
}

module.exports = { activate };
