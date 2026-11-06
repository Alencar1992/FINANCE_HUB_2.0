/**
 * FINANCE HUB 2.0 · Fase 2C — escrita controlada, SOMENTE HML.
 *
 * Não existe transação multiaba no Sheets. Usamos lock, IDs determinísticos,
 * trilha de intenção, estado PENDENTE e bloqueio de reenvio parcial.
 * Divergência => RECONCILIATION_REQUIRED, jamais tentar uma nova transação.
 */
function fh2cSetup_() {
  var config=financeConfig_();
  financeAssertOwnerExecution_(config);
  if(config.environment!=='HML')throw new Error('INVALID_ENVIRONMENT');
  var ss=SpreadsheetApp.openById(config.sheetId);
  if(!financeInspectSchema_(ss).ok)throw new Error('SCHEMA_VALIDATION_FAILED');
  return {ss:ss,config:config};
}
function fh2cWritable_() {
  var props=PropertiesService.getScriptProperties();
  return props.getProperty('FINANCE_WRITE_ENABLED')==='YES'
    && props.getProperty('FINANCE_WRITE_MODE')==='HML_TEST';
}
function fh2cLock_() {
  var lock=LockService.getScriptLock();
  if(!lock.tryLock(18000))throw new Error('LOCK_TIMEOUT');
  return lock;
}
function fh2cSheet_(ss, name) {
  var sheet=ss.getSheetByName(name);
  if(!sheet)throw new Error('SCHEMA_VALIDATION_FAILED');
  return sheet;
}
function fh2cHeaders_(sheet) {
  return sheet.getRange(1,1,1,sheet.getLastColumn()).getDisplayValues()[0]
    .map(function(v){return String(v).trim();});
}
function fh2cFind_(ss, tab, id) {
  var sheet=fh2cSheet_(ss,tab), last=sheet.getLastRow();
  if(last<2)return null;
  if(last>5001)throw new Error('ROW_LIMIT_EXCEEDED');
  var ids=sheet.getRange(2,1,last-1,1).getDisplayValues();
  for(var i=0;i<ids.length;i++){
    if(ids[i][0]===id){
      var cells=sheet.getRange(i+2,1,1,sheet.getLastColumn()).getValues()[0];
      var fields=fh2cHeaders_(sheet), obj={};
      fields.forEach(function(f,n){if(f)obj[f]=cells[n];});
      return {row:i+2,value:obj};
    }
  }
  return null;
}
function fh2cAppend_(ss,tab,values) {
  var sheet=fh2cSheet_(ss,tab), fields=fh2cHeaders_(sheet);
  var row=sheet.getLastRow()+1;
  if(row>5001)throw new Error('ROW_LIMIT_EXCEEDED');
  if(row>sheet.getMaxRows())sheet.insertRowsAfter(sheet.getMaxRows(),Math.max(100,row-sheet.getMaxRows()));
  fields.forEach(function(field){if(!field)throw new Error('SCHEMA_VALIDATION_FAILED');});
  var output=fields.map(function(field){
    var value=values[field];
    return value===undefined||value===null?'':value;
  });
  sheet.getRange(row,1,1,output.length).setValues([output]);
  SpreadsheetApp.flush();
  return row;
}
function fh2cUpdate_(ss,table,row,column,value) {
  var sheet=fh2cSheet_(ss,table), fields=fh2cHeaders_(sheet);
  var n=fields.indexOf(column);
  if(n<0)throw new Error('SCHEMA_VALIDATION_FAILED');
  sheet.getRange(row,n+1).setValue(value);
  SpreadsheetApp.flush();
}
function fh2cHash_(v) {
  var dig=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,JSON.stringify(v));
  return dig.map(function(n){return ('0'+(n<0?n+256:n).toString(16)).slice(-2);}).join('');
}
function fh2cAudit_(ss,phase,requestId,table,entityId,digest,at) {
  var eid='AUD_'+requestId+'_'+phase;
  if(fh2cFind_(ss,'AUDITORIA',eid))return;
  fh2cAppend_(ss,'AUDITORIA',{
    ID_EVENTO:eid,DATA_HORA:at,OPERACAO:'CREATE_'+table,TABELA:table,
    ID_REGISTRO:entityId,ANTES_HASH:'',DEPOIS_HASH:digest,
    CHAVE_CORRELACAO:requestId,ATOR:'HML_OWNER',
    RESULTADO:phase==='BEGIN'?'PENDENTE':'CONFIRMADO',
    DETALHES:'HML 2C · '+phase
  });
}
function fh2cCheckClosed_(ss, date) {
  var month=date.slice(0,7);
  var list=fhReadTable_(ss,'FECHAMENTOS');
  if(list.some(function(x){return String(x.COMPETENCIA)===month &&
    ['CONFIRMADO','FECHADO'].includes(fhUpper_(x.STATUS));})){
    throw new Error('PERIOD_CLOSED');
  }
}
function fh2cOwnError_(error) {
  var msg=String(error&&error.message||'ERROR');
  var known=['WRITE_DISABLED','INVALID_ENVIRONMENT','SCHEMA_VALIDATION_FAILED',
    'LOCK_TIMEOUT','ROW_LIMIT_EXCEEDED','UNKNOWN_ACCOUNT',
    'UNKNOWN_CATEGORY','CATEGORY_TYPE_MISMATCH','PERIOD_CLOSED',
    'FUTURE_CASH_DATE','REQUEST_REUSED_DIFFERENTLY','RECONCILIATION_REQUIRED',
    'INVALID_REQUEST_ID','INVALID_PAYLOAD','INVALID_ACCOUNT',
    'INVALID_PAYMENT_METHOD','MISSING_OTHER_CATEGORY','UNEXPECTED_OTHER_CATEGORY'];
  if(known.indexOf(msg)>=0)return msg;
  if(/^(INVALID|MISSING|UNSAFE)_([A-Z_]+)$/.test(msg))return msg;
  return 'WRITE_UNCERTAIN';
}
function fh2cRun_(task) {
  var lock;
  try {
    if(!fh2cWritable_())throw new Error('WRITE_DISABLED');
    lock=fh2cLock_();
    var ctx=fh2cSetup_();
    var result=task(ctx.ss,ctx.config);
    return {ok:true,status:result.status,id:result.id,environment:'HML'};
  } catch(error) {
    var status=fh2cOwnError_(error);
    console.warn('FINANCE_HUB_HML_2C '+status);
    return {ok:false,status:status,environment:'HML'};
  } finally {
    if(lock)lock.releaseLock();
  }
}
function fh2cCatalog_() {
  try {
    var ctx=fh2cSetup_(),ss=ctx.ss;
    var accounts=fhReadTable_(ss,'CONTAS').filter(function(x){return fhIsActiveAccount_(x.ATIVA);})
      .map(function(x){return {id:String(x.ID_CONTA),name:String(x.NOME||'Conta'),
        bank:String(x.INSTITUICAO||'')};});
    var categories=fhReadTable_(ss,'CATEGORIAS').filter(function(x){return fhIsActiveAccount_(x.ATIVA);})
      .map(function(x){return {id:String(x.ID_CATEGORIA),name:String(x.NOME),type:String(x.TIPO)};});
    var cards=fhReadTable_(ss,'CARTOES').filter(function(x){return fhIsActiveAccount_(x.ATIVO);})
      .map(function(x){return {id:String(x.ID_CARTAO),name:String(x.NOME),bank:String(x.BANCO),
        last4:String(x.FINAL_4||'')};});
    var people=fhReadTable_(ss,'PESSOAS').filter(function(x){return fhUpper_(x.STATUS)!=='INATIVO';})
      .map(function(x){return {id:String(x.ID_PESSOA),name:String(x.NOME)};});
    return {ok:true,status:'CATALOG_OK',environment:'HML',
      writeEnabled:fh2cWritable_(),accounts:accounts,categories:categories,cards:cards,people:people};
  }catch(e){return {ok:false,status:'CATALOG_UNAVAILABLE',environment:'HML',writeEnabled:false};}
}
function getHmlCatalog() {return fh2cCatalog_();}
/** Teste manual SEM escrita, inclusive com chave ativa. */
function run2CReadinessTest() {
  var catalog=fh2cCatalog_();
  var result={ok:catalog.ok,status:catalog.status,environment:'HML',
    writeEnabled:catalog.writeEnabled===true,
    accounts:catalog.ok?catalog.accounts.length:0,
    cards:catalog.ok?catalog.cards.length:0,
    people:catalog.ok?catalog.people.length:0};
  console.log(JSON.stringify(result));
  return result;
}
/**
 * Registros cadastrais com ID derivado da chave idempotente enviada pelo cliente.
 * Se houver falha de auditoria após gravar a linha, um reenvio do MESMO requestId
 * pode recuperar a auditoria; nunca criar um cadastro duplicado.
 */
function fh2cCreateEntity_(ss,table,id,requestId,normalized,row) {
  var digest=fh2cHash_(normalized),at=new Date().toISOString();
  var existing=fh2cFind_(ss,table,id);
  if(existing){
    // Não reusar chave para payload diferente
    // A tabela não possui coluna de hash. Usamos o evento BEGIN para comparação.
    var intent=fh2cFind_(ss,'AUDITORIA','AUD_'+requestId+'_BEGIN');
    if(intent && String(intent.value.DEPOIS_HASH)!==digest)throw new Error('REQUEST_REUSED_DIFFERENTLY');
    if(!intent)throw new Error('RECONCILIATION_REQUIRED');
    fh2cAudit_(ss,'COMMIT',requestId,table,id,digest,at);
    return {id:id,status:'ALREADY_SAVED'};
  }
  var prior=fh2cFind_(ss,'AUDITORIA','AUD_'+requestId+'_BEGIN');
  var closed=fh2cFind_(ss,'AUDITORIA','AUD_'+requestId+'_COMMIT');
  if(closed)throw new Error('RECONCILIATION_REQUIRED');
  if(prior && String(prior.value.DEPOIS_HASH)!==digest)throw new Error('REQUEST_REUSED_DIFFERENTLY');
  fh2cAudit_(ss,'BEGIN',requestId,table,id,digest,at);
  fh2cAppend_(ss,table,row);
  fh2cAudit_(ss,'COMMIT',requestId,table,id,digest,at);
  return {id:id,status:'SAVED'};
}
function saveHmlAccount(payload) {
  return fh2cRun_(function(ss){
    var p=fh2cAccount_(payload),id='ACC_'+p.requestId,at=new Date().toISOString();
    fh2cCheckClosed_(ss,p.dataAbertura);
    var today=Utilities.formatDate(new Date(),'America/Sao_Paulo','yyyy-MM-dd');
    if(p.dataAbertura>today)throw new Error('FUTURE_CASH_DATE');
    return fh2cCreateEntity_(ss,'CONTAS',id,p.requestId,p,{
      ID_CONTA:id,NOME:p.nome,INSTITUICAO:p.instituicao,TIPO:p.tipo,
      MOEDA:'BRL',SALDO_ABERTURA_CENTAVOS:p.aberturaCents,
      DATA_ABERTURA:p.dataAbertura,ATIVA:'SIM',
      CRIADO_EM:at,ATUALIZADO_EM:at,VERSAO:1
    });
  });
}
function saveHmlPerson(payload) {
  return fh2cRun_(function(ss){
    var p=fh2cPerson_(payload),id='PER_'+p.requestId,at=new Date().toISOString();
    return fh2cCreateEntity_(ss,'PESSOAS',id,p.requestId,p,{
      ID_PESSOA:id,NOME:p.nome,APELIDO:p.apelido,CONTATO:'',
      STATUS:'ATIVO',CRIADO_EM:at,ATUALIZADO_EM:at,VERSAO:1
    });
  });
}
function saveHmlCard(payload) {
  return fh2cRun_(function(ss){
    var p=fh2cCard_(payload),id='CARD_'+p.requestId,at=new Date().toISOString();
    if(p.contaPagadora&&!fh2cFind_(ss,'CONTAS',p.contaPagadora))throw new Error('UNKNOWN_ACCOUNT');
    return fh2cCreateEntity_(ss,'CARTOES',id,p.requestId,p,{
      ID_CARTAO:id,NOME:p.nome,BANCO:p.banco,BANDEIRA:p.bandeira,FINAL_4:p.final4,
      DIA_FECHAMENTO:p.fechamento,DIA_VENCIMENTO:p.vencimento,LIMITE_CENTAVOS:p.limiteCents,
      ID_CONTA_PAGADORA:p.contaPagadora,COR_HEX:'#1479F6',LOGO_URL:'',
      ATIVO:'SIM',CRIADO_EM:at,ATUALIZADO_EM:at,VERSAO:1
    });
  });
}
/** Cria entrada/saída à vista, com registro de caixa e auditoria por etapas. */
function saveHmlTransaction(payload) {
  return fh2cRun_(function(ss){
    var p=fh2cTransaction_(payload);
    var txId='TX_'+p.requestId,mvId='MOV_'+p.requestId;
    var today=Utilities.formatDate(new Date(),'America/Sao_Paulo','yyyy-MM-dd');
    if(p.data>today)throw new Error('FUTURE_CASH_DATE');
    fh2cCheckClosed_(ss,p.data);
    var account=fh2cFind_(ss,'CONTAS',p.conta);
    if(!account||!fhIsActiveAccount_(account.value.ATIVA))throw new Error('UNKNOWN_ACCOUNT');
    var category=fh2cFind_(ss,'CATEGORIAS',p.categoria);
    if(!category || !fhIsActiveAccount_(category.value.ATIVA))throw new Error('UNKNOWN_CATEGORY');
    if(String(category.value.TIPO).toUpperCase()!==p.tipo)throw new Error('CATEGORY_TYPE_MISMATCH');
    var normalized=p,digest=fh2cHash_(normalized),at=new Date().toISOString();
    var existing=fh2cFind_(ss,'TRANSACOES',txId),movement=fh2cFind_(ss,'MOVIMENTOS_CONTA',mvId);
    var intent=fh2cFind_(ss,'AUDITORIA','AUD_'+p.requestId+'_BEGIN');
    if(intent && String(intent.value.DEPOIS_HASH)!==digest)throw new Error('REQUEST_REUSED_DIFFERENTLY');
    if(!existing && !movement && fh2cFind_(ss,'AUDITORIA','AUD_'+p.requestId+'_COMMIT'))
      throw new Error('RECONCILIATION_REQUIRED');
    if(existing||movement){
      if(!intent||!existing||!movement ||
        !fhIsEffective_(existing.value.STATUS)||!fhIsEffective_(movement.value.STATUS))
        throw new Error('RECONCILIATION_REQUIRED');
      fh2cAudit_(ss,'COMMIT',p.requestId,'TRANSACOES',txId,digest,at);
      return {status:'ALREADY_SAVED',id:txId};
    }
    fh2cAudit_(ss,'BEGIN',p.requestId,'TRANSACOES',txId,digest,at);
    fh2cAppend_(ss,'TRANSACOES',{
      ID_TRANSACAO:txId,DATA_COMPETENCIA:p.data,DATA_EFETIVA:p.data,
      TIPO:p.tipo,DESCRICAO:p.descricao,VALOR_CENTAVOS:p.valorCents,
      ID_CATEGORIA:p.categoria,ID_ESTABELECIMENTO:'',
      OUTRO_ESTABELECIMENTO:p.estabelecimento,OUTRA_CATEGORIA:p.categoriaOutra,
      ID_PESSOA:'',ID_FORMA:p.forma,ID_CONTA:p.conta,ID_CARTAO:'',
      ID_PARCELAMENTO:'',ID_FONTE_RENDA:'',STATUS:'PENDENTE',
      OBSERVACOES:p.observacoes,CHAVE_IDEMPOTENCIA:p.requestId,
      CRIADO_EM:at,ATUALIZADO_EM:at,VERSAO:1
    });
    fh2cAppend_(ss,'MOVIMENTOS_CONTA',{
      ID_MOVIMENTO:mvId,ID_CONTA:p.conta,DATA_MOVIMENTO:p.data,
      VALOR_ASSINADO_CENTAVOS:p.tipo==='ENTRADA'?p.valorCents:-p.valorCents,
      TIPO:p.tipo==='ENTRADA'?'RECEBIMENTO':'DESPESA',
      ID_TRANSACAO:txId,ID_ORIGEM:txId,ID_TRANSFERENCIA:'',
      STATUS:'PENDENTE',CHAVE_IDEMPOTENCIA:p.requestId,CRIADO_EM:at
    });
    var tx=fh2cFind_(ss,'TRANSACOES',txId);
    var mov=fh2cFind_(ss,'MOVIMENTOS_CONTA',mvId);
    if(!tx||!mov)throw new Error('RECONCILIATION_REQUIRED');
    // Commutamos o registro econômico e só então o movimento de caixa;
    // dashboard usa lock compartilhado e nunca lê durante este intervalo.
    fh2cUpdate_(ss,'TRANSACOES',tx.row,'STATUS','CONFIRMADO');
    fh2cUpdate_(ss,'MOVIMENTOS_CONTA',mov.row,'STATUS','EFETIVADO');
    fh2cAudit_(ss,'COMMIT',p.requestId,'TRANSACOES',txId,digest,at);
    return {status:'SAVED',id:txId};
  });
}