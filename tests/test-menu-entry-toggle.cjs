// Same option as Steamcord #86: the SkullKey entry in Steam's main menu can be turned off, and the
// choice survives a Steam restart even when Steam did not write its localStorage.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '../src/menuEntry.tsx'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React } }).outputText;

const tick = () => new Promise(r => setImmediate(r));

// backend: { menu } like steamcord-view.json, or null for a failing backend.
function load(store, backend = {}) {
  const registered = new Set();
  let registrations = 0;
  const call = async (name, ...args) => {
    if (backend === null) throw new Error('backend down');
    if (name === 'get_menu_entry') return backend.menu ?? null;
    if (name === 'set_menu_entry') { backend.menu = (args[0].on) ? 'on' : 'off'; return { ok: true }; }
    throw new Error('unexpected ' + name);
  };
  const context = {
    exports: {},
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
    React: { createElement: () => null },
    require: name => name === './steamMenu'
      ? { registerSteamMenu: entry => { registrations++; registered.add(entry.id); return () => registered.delete(entry.id); } }
      : name === 'react' ? { createElement: () => null } : {},
  };
  vm.createContext(context);
  vm.runInContext('(function(exports, require){' + compiled + '})(exports, require)', context);
  const api = { callPluginMethod: async (n, a) => ({ success: true, result: await call(n, a) }) };
  const menu = Object.assign({}, context.exports, { patchMenu: () => context.exports.patchMenu(api) });
  return { menu, registered, count: () => registrations };
}

test('the entry is shown by default and the choice is saved', async () => {
  const backend = {};
  const { menu, registered } = load({}, backend);
  menu.patchMenu();
  await tick();
  assert.ok(registered.has('skullkey'));
  assert.equal(menu.menuEntryEnabled(), true);
  assert.equal(backend.menu, 'on');
});

test('turning it off removes the entry and survives a reload', async () => {
  const store = {}, backend = {};
  const first = load(store, backend);
  first.menu.patchMenu();
  await tick();
  first.menu.setMenuEntryEnabled(false);
  await tick();
  assert.equal(first.registered.has('skullkey'), false);
  assert.equal(backend.menu, 'off');
  const reloaded = load(store, backend);
  reloaded.menu.patchMenu();
  await tick();
  assert.equal(reloaded.registered.has('skullkey'), false);
});

test('a Steam restart that lost the localStorage write keeps the entry off (#86)', async () => {
  const store = { SKULLKEY_MENU_ENTRY: '1' };   // old value Steam reloads
  const { menu, registered } = load(store, { menu: 'off' });
  menu.patchMenu();
  await tick();
  assert.equal(registered.has('skullkey'), false);
  assert.equal(store.SKULLKEY_MENU_ENTRY, '0');
  assert.equal(menu.menuEntryEnabled(), false);
});

test('an upgrade keeps an earlier local choice', async () => {
  const backend = {};
  const { menu, registered } = load({ SKULLKEY_MENU_ENTRY: '0' }, backend);
  menu.patchMenu();
  await tick();
  assert.equal(registered.has('skullkey'), false);
  assert.equal(backend.menu, 'off');
});

test('without the backend, the local choice is used', async () => {
  const { menu, registered } = load({ SKULLKEY_MENU_ENTRY: '0' }, null);
  menu.patchMenu();
  await tick();
  assert.equal(registered.has('skullkey'), false);
  const on = load({}, null);
  on.menu.patchMenu();
  await tick();
  assert.ok(on.registered.has('skullkey'));
});

test('turning it back on registers the entry once', async () => {
  const { menu, registered, count } = load({ SKULLKEY_MENU_ENTRY: '0' }, { menu: 'off' });
  menu.patchMenu();
  await tick();
  menu.setMenuEntryEnabled(true);
  menu.setMenuEntryEnabled(true);
  assert.ok(registered.has('skullkey'));
  assert.equal(count(), 1);
});

test('unloading the plugin removes the entry, even before the backend answers', async () => {
  const { menu, registered } = load({}, { menu: 'on' });
  const unpatch = menu.patchMenu();
  unpatch();
  await tick();
  assert.equal(registered.has('skullkey'), false);
  const loaded = load({}, { menu: 'on' });
  const unpatch2 = loaded.menu.patchMenu();
  await tick();
  unpatch2();
  assert.equal(loaded.registered.has('skullkey'), false);
});
