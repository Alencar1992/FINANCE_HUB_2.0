import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const manifest = JSON.parse(source('apps-script/appsscript.json'));
const server = ['Main.gs', 'Security.gs', 'Schema.gs', 'SheetConnection.gs']
  .map(name => source('apps-script/' + name)).join('\n');

test('implantação deve ser somente do proprietário', () => {
  assert.equal(manifest.webapp.access, 'MYSELF');
  assert.equal(manifest.webapp.executeAs, 'USER_DEPLOYING');
  assert.equal(manifest.timeZone, 'America/Sao_Paulo');
});
test('somente leitura: sem APIs de mutação ou endpoints de escrita', () => {
  assert.doesNotMatch(server, /\b(?:appendRow|setValue|setValues|deleteRow|deleteRows|insertRow|insertRows|clearContents|copyTo|doPost)\s*\(/);
  assert.match(server, /SpreadsheetApp\.openById\(/);
  assert.match(server, /function\s+getConnectionStatus\(/);
});
test('sem ID da planilha ou email gravados no código-fonte', () => {
  assert.match(server, /getProperty\('FINANCE_SHEET_ID'\)/);
  assert.match(server, /getProperty\('FINANCE_ALLOWED_EMAIL'\)/);
  assert.match(server, /getProperty\('FINANCE_ENV'\)/);
  assert.doesNotMatch(server, /https:\/\/docs\.google\.com\/spreadsheets\/d\//);
});
test('conexão compara 32 abas e estrutura HML', () => {
  const schema = source('apps-script/Schema.gs');
  const block = schema.split('var FINANCE_REQUIRED_HEADERS_ = {')[1].split('};')[0];
  const tabDefs = block.match(/^\s{2}[A-Z_]+:\s*\[/gm) || [];
  assert.equal(tabDefs.length, 32);
  for (const required of ['FECHAMENTOS', 'FECHAMENTO_ITENS', 'PAGAMENTOS_FATURA', 'AJUSTES_FATURA', 'RECORRENCIAS', 'OCORRENCIAS', 'VENDAS', 'ENTREGAS']) {
    assert.match(block, new RegExp('\\b' + required + ':'));
  }
  assert.match(schema, /config\.AMBIENTE === 'HML'/);
  assert.match(schema, /config\.VERSAO_ESQUEMA === '1\.0\.0'/);
});
test('resposta não devolve ID da planilha nem identidade do proprietário', () => {
  const connector = source('apps-script/SheetConnection.gs');
  assert.doesNotMatch(connector, /sheetId\s*:/);
  assert.doesNotMatch(connector, /allowedEmail\s*:/);
  assert.match(connector, /accessMode: 'READ_ONLY'/);
});
