/** Propriedades privadas (configuradas no editor Apps Script, nunca no GitHub). */
function financeConfig_() {
  var props = PropertiesService.getScriptProperties();
  var sheetId = String(props.getProperty('FINANCE_SHEET_ID') || '').trim();
  var allowedEmail = String(props.getProperty('FINANCE_ALLOWED_EMAIL') || '').trim().toLowerCase();
  var environment = String(props.getProperty('FINANCE_ENV') || '').trim().toUpperCase();

  if (environment !== 'HML') financeFail_('INVALID_ENVIRONMENT');
  if (!/^[a-zA-Z0-9_-]{20,}$/.test(sheetId)) financeFail_('MISSING_SHEET_ID');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(allowedEmail)) financeFail_('MISSING_ALLOWED_EMAIL');

  return { sheetId: sheetId, allowedEmail: allowedEmail, environment: environment };
}

/**
 * Verifica a identidade de EXECUÇÃO. Importante: quando um Web App executa
 * como o proprietário, getEffectiveUser() identifica o proprietário —
 * NÃO identifica com segurança quem abriu o link.
 * A barreira real de acesso é a implantação "Somente eu / MYSELF".
 * Nunca usar esta função, isoladamente, como autenticação multiusuário.
 */
function financeAssertOwnerExecution_(config) {
  var effective = String(Session.getEffectiveUser().getEmail() || '').trim().toLowerCase();
  var active = String(Session.getActiveUser().getEmail() || '').trim().toLowerCase();
  if (!effective || effective !== config.allowedEmail) financeFail_('OWNER_MISMATCH');
  if (active && active !== config.allowedEmail) financeFail_('ACTIVE_USER_DENIED');
}

function financeFail_(code) {
  var error = new Error(code);
  error.code = code;
  throw error;
}
