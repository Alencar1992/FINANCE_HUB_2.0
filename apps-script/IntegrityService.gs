/**
 * Diagnóstico de integridade HML sem escrita. Não retorna nomes, valores,
 * identificadores ou informações pessoais, apenas contagens dos registros
 * criados pela Fase 2C. Não é mecanismo automático de reparação.
 */
function fh2cIntegrity_() {
  var lock,locked=false;
  try {
    lock=LockService.getScriptLock();
    if(!lock.tryLock(18000))throw new Error('LOCK_TIMEOUT');
    locked=true;
    var ss=fh2cSetup_().ss;
    var tx=fhReadTable_(ss,'TRANSACOES').filter(function(x){
      return String(x.ID_TRANSACAO||'').indexOf('TX_')===0;
    });
    var mv=fhReadTable_(ss,'MOVIMENTOS_CONTA').filter(function(x){
      return String(x.ID_MOVIMENTO||'').indexOf('MOV_')===0;
    });
    var audit=fhReadTable_(ss,'AUDITORIA');
    var movementMap={},auditMap={},transMap={};
    var missingMovement=0,wrongMovement=0,pending=0,missingAudit=0,orphan=0;
    mv.forEach(function(row){movementMap[String(row.ID_MOVIMENTO)]=row;});
    audit.forEach(function(row){auditMap[String(row.ID_EVENTO)]=row;});
    tx.forEach(function(row){
      var id=String(row.ID_TRANSACAO), key=String(row.CHAVE_IDEMPOTENCIA);
      transMap[id]=true;
      var m=movementMap['MOV_'+key];
      if(!m){missingMovement++;return;}
      if(String(m.ID_TRANSACAO)!==id || String(m.ID_CONTA)!==String(row.ID_CONTA) ||
        Number(m.VALOR_ASSINADO_CENTAVOS)!==
          (String(row.TIPO)==='ENTRADA'?Number(row.VALOR_CENTAVOS):-Number(row.VALOR_CENTAVOS))){
        wrongMovement++;
      }
      if(!fhIsEffective_(row.STATUS) || !fhIsEffective_(m.STATUS))pending++;
      if(!auditMap['AUD_'+key+'_BEGIN'] || !auditMap['AUD_'+key+'_COMMIT'])missingAudit++;
    });
    mv.forEach(function(row){
      if(!transMap[String(row.ID_TRANSACAO)])orphan++;
    });
    var hasProblem=missingMovement>0 || wrongMovement>0 || pending>0 ||
      missingAudit>0 || orphan>0;
    return {ok:!hasProblem,status:hasProblem?'INTEGRITY_REVIEW_REQUIRED':'INTEGRITY_OK',
      environment:'HML',transactionsChecked:tx.length,movementsChecked:mv.length,
      missingMovements:missingMovement,wrongMovements:wrongMovement,
      pendingTransactions:pending,missingAuditCommits:missingAudit,
      orphanMovements:orphan};
  }catch(e){return {ok:false,status:'INTEGRITY_CHECK_FAILED',environment:'HML'};}
  finally{if(locked)lock.releaseLock();}
}
function run2CIntegrityTest() {
  var result=fh2cIntegrity_();
  console.log(JSON.stringify(result));
  return result;
}
