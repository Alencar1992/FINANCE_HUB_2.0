/**
 * FINANCE HUB 2.0 — Fase 2A: diagnóstico somente leitura.
 * NÃO há funções que gravem, apaguem ou movimentem dinheiro.
 *
 * ATENÇÃO: o HTML abaixo é apenas uma tela técnica de homologação.
 * O protótipo visual Executivo será integrado depois.
 */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('FINANCE HUB 2.0 | Conexão HML')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/** Chamável pelo front-end; retorna somente metadados técnicos. */
function getConnectionStatus() {
  return financeRunConnectionTest_();
}

/** Rodar manualmente no editor para conceder permissões e testar conexão. */
function runConnectionTest() {
  var result = financeRunConnectionTest_();
  console.log(JSON.stringify(result));
  return result;
}
