// Download sizes and speeds follow the Steam language (#14: "Mo" shown to an
// English player). Strings below are the ones the scripts really write.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');
const compiled = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/Utils/units.ts'), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS }
}).outputText;
const context = { exports: {} };
vm.runInNewContext(compiled, context);
const { localizeUnits, formatRate, formatSize, parseDesc } = context.exports;

// downloads.parse_log (Epic/GOG/Amazon), downloads speed probe (EA), ports.py.
const LEGENDARY = 'Téléchargement · 43 % · 5,7 / 13,3 Go · 102 Mo/s · ~2 min';
const PROBE = 'Étape 2/4 · Installation · 12.5 Mo/s';
const PORTS = 'Downloading · 50 % · 0,4 / 0,8 Go · 12 Mo/s · ~1 min';
// xbox.step_text, already written in the Steam language.
const XBOX_EN = 'Step 3/4 · Downloading · 25 % · 1.5 / 6.0 GB · 40 MB/s · ~3 min';
const XBOX_RU = 'Шаг 3/4 · Загрузка · 25 % · 1,5 / 6,0 ГБ · 40 МБ/с · ~3 min';

test('English shows MB/GB with a decimal point', () => {
    assert.equal(localizeUnits(LEGENDARY, 'en'), 'Téléchargement · 43 % · 5.7 / 13.3 GB · 102 MB/s · ~2 min');
    assert.equal(localizeUnits(PROBE, 'en'), 'Étape 2/4 · Installation · 12.5 MB/s');
    assert.equal(localizeUnits(XBOX_RU, 'en'), 'Шаг 3/4 · Загрузка · 25 % · 1.5 / 6.0 GB · 40 MB/s · ~3 min');
});

test('French keeps Mo/Go with a decimal comma', () => {
    assert.equal(localizeUnits(LEGENDARY, 'fr'), LEGENDARY);
    assert.equal(localizeUnits(XBOX_EN, 'fr'), 'Step 3/4 · Downloading · 25 % · 1,5 / 6,0 Go · 40 Mo/s · ~3 min');
    assert.equal(localizeUnits(PROBE, 'fr'), 'Étape 2/4 · Installation · 12,5 Mo/s');
});

test('other languages: same units and comma as the Xbox engine', () => {
    assert.equal(localizeUnits(PORTS, 'de'), 'Downloading · 50 % · 0,4 / 0,8 GB · 12 MB/s · ~1 min');
    assert.equal(localizeUnits(XBOX_EN, 'ru'), 'Step 3/4 · Downloading · 25 % · 1,5 / 6,0 ГБ · 40 МБ/с · ~3 min');
    assert.equal(localizeUnits(LEGENDARY, 'xx'), localizeUnits(LEGENDARY, 'en'));
});

test('steps, percentages and words that start like a unit are untouched', () => {
    for (const s of ['Étape 3/4 · Téléchargement', '43 %', 'Mode 2 · Gold edition', '~2 min', '']) {
        assert.equal(localizeUnits(s, 'en'), s);
    }
    assert.equal(localizeUnits('<b>5 Go</b>', 'en'), '<b>5 GB</b>');
});

test('the Downloads page still reads speed and amount, in every language', () => {
    for (const [text, speed] of [[LEGENDARY, 102], [XBOX_EN, 40], [XBOX_RU, 40], [PROBE, 12.5], [PORTS, 12]]) {
        assert.equal(parseDesc(text, 'en').speed, speed, text);
    }
    assert.equal(parseDesc(LEGENDARY, 'en').amount, '5.7 GB / 13.3 GB');
    assert.equal(parseDesc(LEGENDARY, 'fr').amount, '5,7 Go / 13,3 Go');
    assert.equal(parseDesc(XBOX_RU, 'de').amount, '1,5 GB / 6,0 GB');
    assert.equal(parseDesc('1,2 Go / 3 Go', 'en').amount, '1.2 GB / 3 GB');
    assert.equal(parseDesc(LEGENDARY, 'en').eta, '2 min');
    assert.equal(parseDesc(PROBE, 'en').amount, null);
    assert.equal(parseDesc('', 'en').speed, null);
});

test('rates and sizes', () => {
    assert.equal(formatRate(48.25, 'en'), '48.3 MB/s');
    assert.equal(formatRate(48.25, 'fr'), '48,3 Mo/s');
    assert.equal(formatRate(3, 'ru'), '3,0 МБ/с');
    assert.equal(formatSize(5 * 2 ** 30, 'en'), '5.0 GB');
    assert.equal(formatSize(5 * 2 ** 30, 'fr'), '5,0 Go');
    assert.equal(formatSize(300 * 2 ** 20, 'pl'), '300 MB');
    assert.equal(formatSize(1, 'en'), '1 MB');
});
