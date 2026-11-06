/** Diagnóstico HML sem escrita, sem leitura de lançamentos e sem retornar identificadores. */
function financeRunConnectionTest_() {
  var checkedAt = new Date().toISOString();
  try {
    var config = financeConfig_();
    financeAssertOwnerExecution_(config);
    var spreadsheet;
    try {
      spreadsheet = SpreadsheetApp.openById(config.sheetId);
    } catch (_) {
      financeFail_('SHEET_NOT_ACCESSIBLE');
    }
    var check = financeInspectSchema_(spreadsheet);
    return {
      ok: check.ok,
      environment: 'HML',
      accessMode: 'READ_ONLY',
      checkedAt: checkedAt,
      schemaVersion: check.schemaVersion,
      expectedSheets: check.expectedSheets,
      foundSheets: check.foundSheets,
      missingSheets: check.missingSheets,
      missingColumns: check.missingColumns,
      duplicateColumns: check.duplicateColumns,
      timeZoneOk: check.timeZoneOk,
      configOk: check.configOk,
      status: check.ok ? 'CONNECTION_OK' : 'SCHEMA_VALIDATION_FAILED'
    };
  } catch (err) {
    var publicCodes = [
      'INVALID_ENVIRONMENT', 'MISSING_SHEET_ID', 'MISSING_ALLOWED_EMAIL',
      'OWNER_MISMATCH', 'ACTIVE_USER_DENIED', 'SHEET_NOT_ACCESSIBLE'
    ];
    var code = err && publicCodes.indexOf(err.code) >= 0 ? err.code : 'UNEXPECTED_ERROR';
    // Não enviar stack trace, URL da planilha, e-mail, tokens ou IDs ao cliente.
    return {
      ok: false,
      environment: 'HML',
      accessMode: 'READ_ONLY',
      checkedAt: checkedAt,
      status: code
    };
  }
}
