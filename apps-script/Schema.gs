/**
 * Colunas mínimas obrigatórias na base HML do FINANCE HUB 2.0.
 * O status verifica todas as 32 abas e os campos críticos, sem ler
 * registros financeiros, nomes de pessoas ou valores de transações.
 */
var FINANCE_REQUIRED_HEADERS_ = {
  GUIA: ['AREA', 'CONTEUDO', 'REGRA'],
  DICIONARIO: ['TABELA', 'CAMPO', 'TIPO'],
  CONFIGURACOES: ['CHAVE', 'VALOR', 'TIPO'],
  CONTAS: ['ID_CONTA', 'NOME', 'SALDO_ABERTURA_CENTAVOS'],
  CARTOES: ['ID_CARTAO', 'BANCO', 'LIMITE_CENTAVOS', 'DIA_FECHAMENTO', 'DIA_VENCIMENTO'],
  PESSOAS: ['ID_PESSOA', 'NOME'],
  CATEGORIAS: ['ID_CATEGORIA', 'NOME', 'TIPO'],
  ESTABELECIMENTOS: ['ID_ESTABELECIMENTO', 'NOME'],
  FORMAS_PAGAMENTO: ['ID_FORMA', 'NOME', 'GERA_FATURA', 'PERMITE_PARCELAS'],
  FONTES_RENDA: ['ID_FONTE', 'NOME', 'TIPO'],
  ENTREGAS: ['ID_ENTREGA', 'DATA_ENTREGA', 'PLATAFORMA', 'BRUTO_CENTAVOS'],
  TRANSACOES: ['ID_TRANSACAO', 'DATA_COMPETENCIA', 'TIPO', 'VALOR_CENTAVOS', 'CHAVE_IDEMPOTENCIA'],
  MOVIMENTOS_CONTA: ['ID_MOVIMENTO', 'ID_CONTA', 'VALOR_ASSINADO_CENTAVOS'],
  PARCELAMENTOS: ['ID_PARCELAMENTO', 'VALOR_TOTAL_CENTAVOS', 'QTD_PARCELAS'],
  PARCELAS: ['ID_PARCELA', 'ID_PARCELAMENTO', 'DATA_VENCIMENTO'],
  FATURAS: ['ID_FATURA', 'ID_CARTAO', 'PAGO_CENTAVOS', 'SALDO_ABERTO_CENTAVOS'],
  PAGAMENTOS_FATURA: ['ID_PAGAMENTO', 'ID_FATURA', 'VALOR_CENTAVOS'],
  ALOCACOES_FATURA: ['ID_ALOCACAO', 'ID_PAGAMENTO', 'ID_PESSOA'],
  AJUSTES_FATURA: ['ID_AJUSTE', 'ID_FATURA', 'VALOR_ASSINADO_CENTAVOS', 'MOTIVO'],
  DIVIDAS: ['ID_DIVIDA', 'ID_PESSOA', 'TIPO', 'VALOR_TOTAL_CENTAVOS'],
  PAGAMENTOS_DIVIDA: ['ID_PAGAMENTO', 'ID_DIVIDA', 'VALOR_CENTAVOS'],
  RECORRENCIAS: ['ID_RECORRENCIA', 'FREQUENCIA', 'DIA_VENCIMENTO'],
  OCORRENCIAS: ['ID_OCORRENCIA', 'ID_RECORRENCIA', 'COMPETENCIA'],
  VENDAS: ['ID_VENDA', 'ID_COMPRADOR', 'VALOR_TOTAL_CENTAVOS'],
  PARCELAS_VENDA: ['ID_PARCELA_VENDA', 'ID_VENDA', 'DATA_VENCIMENTO'],
  RECEBIMENTOS_VENDA: ['ID_RECEBIMENTO', 'ID_PARCELA_VENDA', 'VALOR_CENTAVOS'],
  METAS: ['ID_META', 'VALOR_ALVO_CENTAVOS', 'DATA_ALVO'],
  APORTES_METAS: ['ID_APORTE', 'ID_META', 'VALOR_CENTAVOS'],
  NOTIFICACOES: ['ID_NOTIFICACAO', 'ROTA_APP', 'STATUS'],
  FECHAMENTOS: ['ID_FECHAMENTO', 'COMPETENCIA', 'HASH_SNAPSHOT'],
  FECHAMENTO_ITENS: ['ID_ITEM', 'ID_FECHAMENTO', 'ID_REGISTRO'],
  AUDITORIA: ['ID_EVENTO', 'OPERACAO', 'TABELA', 'ID_REGISTRO']
};

/** Retorna apenas presença de abas/cabeçalhos e versão, jamais conteúdo financeiro. */
function financeInspectSchema_(spreadsheet) {
  var requiredNames = Object.keys(FINANCE_REQUIRED_HEADERS_);
  var missingSheets = [];
  var missingColumns = [];
  var duplicateColumns = [];
  var foundCount = 0;

  requiredNames.forEach(function(name) {
    var sheet = spreadsheet.getSheetByName(name);
    if (!sheet) {
      missingSheets.push(name);
      return;
    }
    foundCount++;
    var lastColumn = sheet.getLastColumn();
    var headers = lastColumn > 0
      ? sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0].map(function(h) { return String(h).trim(); })
      : [];
    var seen = {};
    headers.forEach(function(header) {
      if (!header) return;
      if (seen[header]) duplicateColumns.push(name + '.' + header);
      seen[header] = true;
    });
    FINANCE_REQUIRED_HEADERS_[name].forEach(function(header) {
      if (headers.indexOf(header) === -1) missingColumns.push(name + '.' + header);
    });
  });

  var configSheet = spreadsheet.getSheetByName('CONFIGURACOES');
  var config = {};
  if (configSheet && configSheet.getLastRow() > 1) {
    var count = Math.min(configSheet.getLastRow() - 1, 100);
    configSheet.getRange(2, 1, count, 2).getDisplayValues().forEach(function(row) {
      var key = String(row[0] || '').trim();
      if (key) config[key] = String(row[1] || '').trim();
    });
  }

  var timeZoneOk = spreadsheet.getSpreadsheetTimeZone() === 'America/Sao_Paulo';
  var configOk = config.AMBIENTE === 'HML' && config.VERSAO_ESQUEMA === '1.0.0';
  var ok = missingSheets.length === 0 && missingColumns.length === 0 &&
    duplicateColumns.length === 0 && timeZoneOk && configOk;

  return {
    ok: ok,
    expectedSheets: requiredNames.length,
    foundSheets: foundCount,
    missingSheets: missingSheets,
    missingColumns: missingColumns,
    duplicateColumns: duplicateColumns,
    timeZoneOk: timeZoneOk,
    configOk: configOk,
    schemaVersion: config.VERSAO_ESQUEMA || 'não configurada'
  };
}
