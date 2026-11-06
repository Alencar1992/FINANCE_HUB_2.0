/**
 * FINANCE HUB 2.0 · Fase 2C · Validações de HML.
 * Funções puras. O frontend nunca determina status, saldo ou IDs de banco.
 */
function fh2cField_(v, max, label, required) {
  if (typeof v !== 'string') { if (required || v !== undefined && v !== null) throw new Error('INVALID_' + label); return ''; }
  var s=v.trim().replace(/\s+/g,' ');
  if (s.length>max || (required && s.length<2)) throw new Error('INVALID_' + label);
  if (/^[=+\-@\t\r\n]/.test(s) || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(s)) throw new Error('UNSAFE_' + label);
  return s;
}
function fh2cId_(v) {
  if (typeof v !== 'string' || !/^[A-Za-z0-9_-]{20,80}$/.test(v)) throw new Error('INVALID_REQUEST_ID');
  return v;
}
function fh2cMoney_(v, label, allowZero) {
  if (!Number.isSafeInteger(v) || v<0 || (v===0&&!allowZero) || v>100000000000) throw new Error('INVALID_' + label);
  return v;
}
function fh2cDate_(date, label) {
  if(typeof date!=='string'|| !/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error('INVALID_'+label);
  var d=new Date(date+'T12:00:00Z');
  if(Number.isNaN(d.getTime())||d.toISOString().slice(0,10)!==date)throw new Error('INVALID_'+label);
  return date;
}
function fh2cChoice_(value, choices, label) {
  if(choices.indexOf(value)<0)throw new Error('INVALID_'+label);
  return value;
}
function fh2cAccount_(p) {
  if(!p || typeof p!=='object')throw new Error('INVALID_PAYLOAD');
  return {
    requestId:fh2cId_(p.requestId),
    nome:fh2cField_(p.nome,70,'NAME',true),
    instituicao:fh2cField_(p.instituicao,70,'BANK',true),
    tipo:fh2cChoice_(p.tipo,['CORRENTE','POUPANCA','DINHEIRO','CARTEIRA','RESERVA'],'TYPE'),
    aberturaCents:fh2cMoney_(p.aberturaCents,'OPENING_BALANCE',true),
    dataAbertura:fh2cDate_(p.dataAbertura,'OPENING_DATE')
  };
}
function fh2cCard_(p) {
  if(!p||typeof p!=='object')throw new Error('INVALID_PAYLOAD');
  var obj={
    requestId:fh2cId_(p.requestId),
    nome:fh2cField_(p.nome,60,'NAME',true),
    banco:fh2cField_(p.banco,70,'BANK',true),
    bandeira:fh2cChoice_(p.bandeira,['VISA','MASTERCARD','ELO','AMEX','OUTRA'],'BRAND'),
    final4:fh2cField_(p.final4,4,'FINAL4',true),
    fechamento:Number(p.fechamento),
    vencimento:Number(p.vencimento),
    limiteCents:fh2cMoney_(p.limiteCents,'LIMIT',true),
    contaPagadora:typeof p.contaPagadora==='string'?p.contaPagadora:''
  };
  if(!/^\d{4}$/.test(obj.final4))throw new Error('INVALID_FINAL4');
  if(!Number.isInteger(obj.fechamento)||obj.fechamento<1||obj.fechamento>28)throw new Error('INVALID_CLOSING_DAY');
  if(!Number.isInteger(obj.vencimento)||obj.vencimento<1||obj.vencimento>28)throw new Error('INVALID_DUE_DAY');
  if(obj.contaPagadora&&!/^ACC_[A-Za-z0-9_-]{20,80}$/.test(obj.contaPagadora))throw new Error('INVALID_PAYER_ACCOUNT');
  return obj;
}
function fh2cPerson_(p) {
  if(!p||typeof p!=='object')throw new Error('INVALID_PAYLOAD');
  return {requestId:fh2cId_(p.requestId),nome:fh2cField_(p.nome,90,'NAME',true),
    apelido:fh2cField_(p.apelido,60,'NICKNAME',false)};
}
function fh2cTransaction_(p) {
  if(!p||typeof p!=='object')throw new Error('INVALID_PAYLOAD');
  var data={
    requestId:fh2cId_(p.requestId),
    tipo:fh2cChoice_(p.tipo,['ENTRADA','SAIDA'],'TRANSACTION_TYPE'),
    data:fh2cDate_(p.data,'TRANSACTION_DATE'),
    descricao:fh2cField_(p.descricao,140,'DESCRIPTION',true),
    valorCents:fh2cMoney_(p.valorCents,'AMOUNT',false),
    conta:fh2cField_(p.conta,100,'ACCOUNT',true),
    categoria:fh2cField_(p.categoria,70,'CATEGORY',true),
    forma:fh2cChoice_(p.forma,['forma_pix','forma_debito','forma_dinheiro','forma_transferencia','forma_boleto'],'PAYMENT_METHOD'),
    estabelecimento:fh2cField_(p.estabelecimento,80,'MERCHANT',false),
    categoriaOutra:fh2cField_(p.categoriaOutra,80,'OTHER_CATEGORY',false),
    observacoes:fh2cField_(p.observacoes,300,'NOTES',false)
  };
  if(!/^ACC_[A-Za-z0-9_-]{20,80}$/.test(data.conta))throw new Error('INVALID_ACCOUNT');
  if(!/^cat_[a-z_]{3,64}$/.test(data.categoria))throw new Error('INVALID_CATEGORY');
  if(data.categoria==='cat_outros_saida'||data.categoria==='cat_outros_entrada'){
    if(!data.categoriaOutra)throw new Error('MISSING_OTHER_CATEGORY');
  }else if(data.categoriaOutra)throw new Error('UNEXPECTED_OTHER_CATEGORY');
  if(p.estabelecimento==='Outro'&&!data.estabelecimento)throw new Error('MISSING_MERCHANT');
  return data;
}
function fh2cSafeEqual_(a,b) {return String(a??'')===String(b??'');}
