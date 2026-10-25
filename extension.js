const vscode = require('vscode');
const { randomUUID } = require('node:crypto');
const PREFIX = 'daylightProfiles';
const config = () => vscode.workspace.getConfiguration(PREFIX);
const save = (key, value) => config().update(key, value, vscode.ConfigurationTarget.Global);
const themes = () => [...new Set(vscode.extensions.all.flatMap(extension =>
  (extension.packageJSON.contributes?.themes || []).map(theme => theme.id || theme.label)))].sort();

function profiles() {
  const list = config().get('profiles', []);
  if (!Array.isArray(list) || !list.length) throw new Error('Добавьте хотя бы один профиль.');
  for (const p of list) {
    if (!p || ['id', 'name', 'theme'].some(key => typeof p[key] !== 'string' || !p[key].trim())
      || !Number.isFinite(p.fontSize) || p.fontSize < 6 || p.fontSize > 100) throw new Error('Проверьте поля профиля и размер шрифта (6–100).');
  }
  if (new Set(list.map(p => p.id)).size !== list.length) throw new Error('Идентификаторы должны быть уникальными.');
  return list;
}
function timeProfile() {
  const start = config().get('dayStart', 8), end = config().get('nightStart', 19);
  if (![start, end].every(h => Number.isInteger(h) && h >= 0 && h <= 23) || start === end) throw new Error('Задайте разные целые часы от 0 до 23.');
  const hour = new Date().getHours();
  const day = start < end ? hour >= start && hour < end : hour >= start || hour < end;
  const list = profiles();
  if (!['day', 'night'].every(key => list.some(p => p.id === config().get(key + 'Profile', key)))) throw new Error('Проверьте профили расписания.');
  return list.find(p => p.id === config().get(day ? 'dayProfile' : 'nightProfile', day ? 'day' : 'night'));
}
async function choose(title) {
  const item = await vscode.window.showQuickPick(profiles().map(p => ({ label: p.name, description: `${p.theme}, ${p.fontSize}`, profile: p })), { title });
  return item?.profile;
}
function activate(context) {
  const state = context.globalState;
  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  status.command = PREFIX + '.selectProfile';
  status.tooltip = 'Выбрать профиль. Ручной выбор действует до включения автоматики.';
  status.show();
  let last = '';
  let lastError = '';
  let disposed = false;
  let pending = false;
  let queue = Promise.resolve();
  function run(action) {
    queue = queue.then(async () => {
      if (disposed) return;
      try { await action(); lastError = ''; }
      catch (error) {
        status.text = '$(warning) Daylight: ошибка';
        status.tooltip = error.message;
        if (error.message !== lastError) void vscode.window.showErrorMessage(error.message);
        lastError = error.message;
      }
    });
    return queue;
  }
  async function apply(p, force = false) {
    if (!p) throw new Error('Профиль удалён. Выберите другой или включите авто.');
    if (!themes().includes(p.theme)) throw new Error(`Тема «${p.theme}» не установлена.`);
    if (force || JSON.stringify(p) !== last) {
      if (vscode.workspace.getConfiguration('window').get('autoDetectColorScheme')) throw new Error('Отключите Window: Auto Detect Color Scheme.');
      await vscode.workspace.getConfiguration('workbench').update('colorTheme', p.theme, vscode.ConfigurationTarget.Global);
      await vscode.workspace.getConfiguration('editor').update('fontSize', p.fontSize, vscode.ConfigurationTarget.Global);
      last = JSON.stringify(p);
    }
  }
  async function refresh() {
    status.tooltip = 'Выбрать профиль. Ручной выбор действует до включения автоматики.';
    const id = state.get('manualProfileId'), auto = state.get('automaticEnabled', false);
    if (!id && !auto) { status.text = '$(debug-pause) Daylight · пауза'; last = ''; return; }
    const p = id ? profiles().find(p => p.id === id) : timeProfile();
    await apply(p);
    status.text = `$(color-mode) ${p.name} · ${id ? 'вручную' : 'авто'}`;
  }
  async function select(p, auto = false) {
    await apply(p, true);
    await state.update('automaticEnabled', auto);
    await state.update('manualProfileId', auto ? undefined : p.id);
    await refresh();
  }
  async function edit(existing) {
    const name = await vscode.window.showInputBox({ title: 'Название', value: existing?.name || '', validateInput: s => s.trim() ? undefined : 'Введите название.' });
    if (name === undefined) return;
    const theme = await vscode.window.showQuickPick(themes(), { title: 'Тема' });
    if (theme === undefined) return;
    const size = await vscode.window.showInputBox({ title: 'Размер шрифта', value: String(existing?.fontSize ?? 14),
      validateInput: s => s.trim() && Number.isFinite(+s) && +s >= 6 && +s <= 100 ? undefined : 'Введите число от 6 до 100.' });
    if (size === undefined) return;
    const p = { id: existing?.id || randomUUID(), name: name.trim(), theme, fontSize: +size };
    await save('profiles', existing ? profiles().map(item => item.id === p.id ? p : item) : [...profiles(), p]);
    await refresh();
  }
  const actions = {
    selectProfile: async () => { const p = await choose('Ручной профиль'); if (p) await select(p); },
    startAutomatic: () => select(timeProfile(), true),
    stopAutomatic: async () => { await state.update('automaticEnabled', false); await state.update('manualProfileId', undefined); await refresh(); },
    createProfile: () => edit(),
    editProfile: async () => { const p = await choose('Редактировать'); if (p) await edit(p); },
    deleteProfile: async () => {
      const p = await choose('Удалить профиль');
      if (!p) return;
      if (['day', 'night'].some(key => config().get(key + 'Profile', key) === p.id)) throw new Error('Сначала замените профиль в расписании.');
      if (profiles().length === 1) throw new Error('Нельзя удалить последний профиль.');
      if (await vscode.window.showWarningMessage(`Удалить «${p.name}»?`, { modal: true }, 'Удалить') !== 'Удалить') return;
      await save('profiles', profiles().filter(item => item.id !== p.id));
      if (state.get('manualProfileId') === p.id) await state.update('manualProfileId', undefined);
      await refresh();
    },
    configureSchedule: () => vscode.commands.executeCommand('workbench.action.openSettings', PREFIX),
    openSettings: () => vscode.commands.executeCommand('workbench.action.openSettings', PREFIX),
    manage: async () => {
      const items = context.extension.packageJSON.contributes.commands.filter(c => !['manage', 'openSettings'].includes(c.command.split('.').at(-1)));
      const item = await vscode.window.showQuickPick(items.map(c => ({ label: c.title.replace('Daylight Profiles: ', ''), id: c.command.split('.').at(-1) })), { title: 'Daylight Profiles' });
      if (item) await actions[item.id]();
    }
  };
  for (const [name, action] of Object.entries(actions)) {
    context.subscriptions.push(vscode.commands.registerCommand(PREFIX + '.' + name, () => run(action)));
  }
  context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(event => {
    if (event.affectsConfiguration(PREFIX) || event.affectsConfiguration('window.autoDetectColorScheme')) void run(refresh);
  }));
  const timer = setInterval(() => {
    if (pending || disposed) return;
    pending = true;
    void run(refresh).finally(() => { pending = false; });
  }, 30_000);
  context.subscriptions.push(status, { dispose: () => { disposed = true; clearInterval(timer); } });
  void run(refresh);
}
module.exports = { activate };
