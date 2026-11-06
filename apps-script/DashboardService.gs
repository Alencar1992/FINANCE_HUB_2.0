/**
 * FINANCE HUB 2.0 — Serviço de leitura do Dashboard (Fase 2B / HML).
 * Sem qualquer escrita no Google Sheets.
 * Envia ao celular apenas totais e itens necessários ao painel.
 */
function fhGetDashboardData_(selectedMonth) {
  var now = new Date();
  var checkedAt = now.toISOString();
  var lock=null,locked=false;
  try {
    lock=LockService.getScriptLock();
    if(!lock.tryLock(18000))throw new Error('LOCK_TIMEOUT');
    locked=true;
    var config = financeConfig_();
    financeAssertOwnerExecution_(config);
    var spreadsheet = SpreadsheetApp.openById(config.sheetId);
    var schema = financeInspectSchema_(spreadsheet);
    if (!schema.ok) return {ok:false, status:'SCHEMA_VALIDATION_FAILED', checkedAt:checkedAt};

    var today = Utilities.formatDate(now, 'America/Sao_Paulo', 'yyyy-MM-dd');
    var month = String(selectedMonth || today.slice(0, 7));
    if (!/^(20\d{2})-(0[1-9]|1[0-2])$/.test(month)) {
      return {ok:false,status:'INVALID_MONTH',checkedAt:checkedAt};
    }

    var names = [
      'CONTAS','CARTOES','MOVIMENTOS_CONTA','OCORRENCIAS','FATURAS',
      'PARCELAS','METAS','APORTES_METAS','TRANSACOES','RECORRENCIAS'
    ];
    var tables = {};
    names.forEach(function(name) {
      tables[name] = fhReadTable_(spreadsheet, name);
    });

    var recurringName = {};
    tables.RECORRENCIAS.forEach(function(row) {
      recurringName[String(row.ID_RECORRENCIA || '')] = String(row.DESCRICAO || 'Conta recorrente');
    });
    tables.OCORRENCIAS.forEach(function(row) {
      row.DESCRICAO = recurringName[String(row.ID_RECORRENCIA || '')] || 'Conta recorrente';
    });

    var dashboard = fhBuildDashboard_(tables, {month: month,today: today});
    return {ok:true,status:'DASHBOARD_OK',environment:'HML',
      checkedAt:checkedAt,data:dashboard};
  } catch (error) {
    // Não retornar exceção, stack, IDs privados, valores crus, e-mail nem tokens.
    var known = [
      'INVALID_MONTH','INVALID_ENVIRONMENT','MISSING_SHEET_ID','MISSING_ALLOWED_EMAIL',
      'OWNER_MISMATCH','ACTIVE_USER_DENIED','SHEET_NOT_ACCESSIBLE','SHEET_NOT_FOUND',
      'ROW_LIMIT_EXCEEDED','MISSING_COLUMN','UNKNOWN_ACCOUNT_MOVEMENT',
      'INVALID_ACCOUNT_ID','INVALID_GOAL_ID','LOCK_TIMEOUT'
    ];
    var text = String(error && error.message || '');
    var status = known.indexOf(text) >= 0 ? text :
      /^(INVALID_CENTS|INVALID_DATE|MISSING_ID)_/.test(text) ? 'INVALID_SOURCE_DATA' : 'DASHBOARD_ERROR';
    console.warn('FINANCE_HUB_HML_DASHBOARD ' + status);
    return {ok:false,status:status,checkedAt:checkedAt};
  } finally {
    if(locked)lock.releaseLock();
  }
}

/** Carrega até 5.000 registros por aba; nunca calcular valores a partir de dados truncados. */
function fhReadTable_(spreadsheet, name) {
  var sheet = spreadsheet.getSheetByName(name);
  if (!sheet) throw new Error('SHEET_NOT_FOUND');
  var lastRow = sheet.getLastRow();
  if (lastRow > 5001) throw new Error('ROW_LIMIT_EXCEEDED');
  var colCount = sheet.getLastColumn();
  if (colCount < 1) throw new Error('MISSING_COLUMN');
  var names = sheet.getRange(1, 1, 1, colCount).getDisplayValues()[0]
    .map(function(x) { return String(x || '').trim(); });
  if (lastRow <= 1) return [];
  var values = sheet.getRange(2, 1, lastRow - 1, colCount).getValues();
  return values.filter(function(row) {
    return row.some(function(cell) { return cell !== '' && cell !== null; });
  }).map(function(row) {
    var item = {};
    names.forEach(function(field, index) {
      if (field) item[field] = row[index];
    });
    return item;
  });
}

/** Execução manual do editor: somente contagens, nunca dados financeiros. */
function runDashboardTest() {
  var result = fhGetDashboardData_();
  console.log(JSON.stringify({
    ok:result.ok,
    status:result.status,
    environment:result.environment || 'HML',
    activeAccounts:result.ok ? result.data.stats.activeAccounts : null,
    alertsCount:result.ok ? result.data.alerts.length : null,
    month:result.ok ? result.data.month : null,
    isEmpty:result.ok ? result.data.isEmpty : null
  }));
  return result.ok ? {
    ok:true,
    status:result.status,
    environment:'HML',
    month:result.data.month,
    isEmpty:result.data.isEmpty,
    activeAccounts:result.data.stats.activeAccounts
  } : {ok:false,status:result.status};
}
