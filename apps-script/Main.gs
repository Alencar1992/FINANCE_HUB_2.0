/**
 * FINANCE HUB 2.0 — HML (somente leitura).
 * O dashboard lê dados existentes, sem criação ou alteração de lançamentos.
 */
function doGet() {
  return HtmlService.createTemplateFromFile('Index').evaluate()
    .setTitle('FINANCE HUB 2.0 | Executivo HML')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/** Diagnóstico técnico da Fase 2A mantido. */
function getConnectionStatus() {
  return financeRunConnectionTest_();
}

/** Teste manual de conexão, mantido para regressão. */
function runConnectionTest() {
  var result = financeRunConnectionTest_();
  console.log(JSON.stringify(result));
  return result;
}

/** Endpoint somente leitura utilizado pelo Dashboard Executivo. */
function getDashboardData(selectedMonth) {
  return fhGetDashboardData_(selectedMonth);
}

/** Inclusão exclusiva de componente local; não recebe nomes arbitrários da Web App. */
function fhInclude_(file) {
  if (file !== 'Forms') throw new Error('INVALID_INCLUDE');
  return HtmlService.createHtmlOutputFromFile('Forms').getContent();
}
