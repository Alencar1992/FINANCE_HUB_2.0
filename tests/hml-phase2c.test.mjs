import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';

const source = p => readFileSync(new URL('../'+p, import.meta.url),'utf8');
function pure(){
  const sandbox = { Date, Number, String, Error };
  vm.runInNewContext(source('apps-script/WriteCore.gs'),sandbox);
  return sandbox;
}
const requestId='request_01_abcdef1234567890987654321';
const baseAccount={
  requestId,nome:'Conta Teste',instituicao:'Banco Exemplo',tipo:'CORRENTE',
  aberturaCents:10000,dataAbertura:'2020-01-01'
};
const baseTransaction={
  requestId:'request_tx_abcdefgh123456789099',tipo:'ENTRADA',data:'2020-01-02',descricao:'Renda simulada',
  valorCents:1200,conta:'ACC_'+requestId,categoria:'cat_salario',
  forma:'forma_pix',estabelecimento:'',categoriaOutra:'',observacoes:''
};
test('validação exige requestId estável, centavos inteiros e datas reais',()=>{
  const v=pure();
  assert.equal(v.fh2cAccount_(baseAccount).aberturaCents,10000);
  assert.throws(()=>v.fh2cAccount_({...baseAccount,aberturaCents:12.34}),/INVALID_OPENING_BALANCE/);
  assert.throws(()=>v.fh2cAccount_({...baseAccount,dataAbertura:'2026-02-30'}),/INVALID_OPENING_DATE/);
  assert.throws(()=>v.fh2cAccount_({...baseAccount,nome:'=HYPERLINK("url")'}),/UNSAFE_NAME/);
  assert.throws(()=>v.fh2cAccount_({...baseAccount,requestId:'X'}),/INVALID_REQUEST_ID/);
});
test('lançamento no cartão, negociação parcelada e transferência interna não são tratadas como dinheiro à vista',()=>{
  const v=pure();
  assert.throws(()=>v.fh2cTransaction_({...baseTransaction,forma:'forma_credito'}),/INVALID_PAYMENT_METHOD/);
  assert.throws(()=>v.fh2cTransaction_({...baseTransaction,forma:'forma_boca_a_boca'}),/INVALID_PAYMENT_METHOD/);
  assert.throws(()=>v.fh2cTransaction_({...baseTransaction,forma:'transferencia_interna'}),/INVALID_PAYMENT_METHOD/);
  assert.equal(v.fh2cTransaction_(baseTransaction).tipo,'ENTRADA');
});
test('Outro obriga o nome da categoria',()=>{
  const v=pure();
  assert.throws(()=>v.fh2cTransaction_({...baseTransaction,tipo:'SAIDA',categoria:'cat_outros_saida'}),/MISSING_OTHER_CATEGORY/);
  assert.equal(v.fh2cTransaction_({...baseTransaction,tipo:'SAIDA',categoria:'cat_outros_saida',
    categoriaOutra:'Gastos negociados'}).categoriaOutra,'Gastos negociados');
});
test('cartão exige somente os últimos 4 dígitos',()=>{
  const v=pure();
  const p={requestId,nome:'Cartão Teste',banco:'Banco X',bandeira:'VISA',
    final4:'1234',fechamento:12,vencimento:20,limiteCents:250000,contaPagadora:''};
  assert.equal(v.fh2cCard_(p).final4,'1234');
  assert.throws(()=>v.fh2cCard_({...p,final4:'1234567812345678'}),/INVALID_FINAL4/);
  assert.throws(()=>v.fh2cCard_({...p,vencimento:31}),/INVALID_DUE_DAY/);
});

function buildMock({enabled=true,failMovement=false}={}){
  const sheets={};
  function add(name,headers,rows=[]){sheets[name]=new FakeSheet(headers,rows);}
  class FakeSheet{
    constructor(headers,rows){this.data=[headers,...rows.map(x=>headers.map(h=>x[h]??''))];this.name=headers[0];this.maxRows=1000;}
    getLastRow(){return this.data.length;}
    getLastColumn(){return this.data[0].length;}
    getMaxRows(){return this.maxRows;}
    insertRowsAfter(_at,n){this.maxRows+=n;}
    getRange(r,c,h=1,w=1){
      const sheet=this;
      return {
        getDisplayValues(){return Array.from({length:h},(_,i)=>Array.from({length:w},(_,j)=>String(sheet.data[r+i-1]?.[c+j-1]??'')));},
        getValues(){return Array.from({length:h},(_,i)=>Array.from({length:w},(_,j)=>sheet.data[r+i-1]?.[c+j-1]??''));},
        setValues(values){
          if(failMovement && sheet===sheets.MOVIMENTOS_CONTA) throw Error('SIMULATED_WRITE_FAILURE');
          values.forEach((row,i)=>{const n=r+i-1;sheet.data[n]||=Array(sheet.getLastColumn()).fill('');
            row.forEach((cell,j)=>sheet.data[n][c+j-1]=cell);});
        },
        setValue(value){sheet.data[r-1][c-1]=value;}
      };
    }
  }
  add('CONTAS',['ID_CONTA','NOME','INSTITUICAO','TIPO','MOEDA','SALDO_ABERTURA_CENTAVOS','DATA_ABERTURA','ATIVA','CRIADO_EM','ATUALIZADO_EM','VERSAO']);
  add('PESSOAS',['ID_PESSOA','NOME','APELIDO','CONTATO','STATUS','CRIADO_EM','ATUALIZADO_EM','VERSAO']);
  add('CARTOES',['ID_CARTAO','NOME','BANCO','BANDEIRA','FINAL_4','DIA_FECHAMENTO','DIA_VENCIMENTO','LIMITE_CENTAVOS','ID_CONTA_PAGADORA','COR_HEX','LOGO_URL','ATIVO','CRIADO_EM','ATUALIZADO_EM','VERSAO']);
  add('CATEGORIAS',['ID_CATEGORIA','NOME','TIPO','ICONE','COR_HEX','ATIVA'],[
    {ID_CATEGORIA:'cat_salario',NOME:'Salário',TIPO:'ENTRADA',ATIVA:'SIM'},
    {ID_CATEGORIA:'cat_compras',NOME:'Compras',TIPO:'SAIDA',ATIVA:'SIM'},
    {ID_CATEGORIA:'cat_outros_saida',NOME:'Outro',TIPO:'SAIDA',ATIVA:'SIM'}
  ]);
  add('TRANSACOES',['ID_TRANSACAO','DATA_COMPETENCIA','DATA_EFETIVA','TIPO','DESCRICAO','VALOR_CENTAVOS','ID_CATEGORIA','ID_ESTABELECIMENTO','OUTRO_ESTABELECIMENTO','OUTRA_CATEGORIA','ID_PESSOA','ID_FORMA','ID_CONTA','ID_CARTAO','ID_PARCELAMENTO','ID_FONTE_RENDA','STATUS','OBSERVACOES','CHAVE_IDEMPOTENCIA','CRIADO_EM','ATUALIZADO_EM','VERSAO']);
  add('MOVIMENTOS_CONTA',['ID_MOVIMENTO','ID_CONTA','DATA_MOVIMENTO','VALOR_ASSINADO_CENTAVOS','TIPO','ID_TRANSACAO','ID_ORIGEM','ID_TRANSFERENCIA','STATUS','CHAVE_IDEMPOTENCIA','CRIADO_EM']);
  add('AUDITORIA',['ID_EVENTO','DATA_HORA','OPERACAO','TABELA','ID_REGISTRO','ANTES_HASH','DEPOIS_HASH','CHAVE_CORRELACAO','ATOR','RESULTADO','DETALHES']);
  add('FECHAMENTOS',['ID_FECHAMENTO','COMPETENCIA','DATA_FECHAMENTO','STATUS']);
  const ss={getSheetByName(name){return sheets[name]||null;}};
  const prop={FINANCE_WRITE_ENABLED:enabled?'YES':'NO',FINANCE_WRITE_MODE:'HML_TEST'};
  let busy=false;
  const ctx={
    Date, Number, String, Error,
    console:{warn(){}},
    PropertiesService:{getScriptProperties(){return {getProperty(k){return prop[k]||'';}}}},
    SpreadsheetApp:{openById(){return ss;},flush(){}},
    LockService:{getScriptLock(){return {tryLock(){if(busy)return false;busy=true;return true;},releaseLock(){busy=false;}}}},
    Utilities:{
      DigestAlgorithm:{SHA_256:'SHA_256'},
      computeDigest(_alg,str){return [...createHash('sha256').update(str).digest()].map(n=>n>127?n-256:n);},
      formatDate(){return '2026-11-06';}
    },
    financeConfig_(){return {sheetId:'MOCK',allowedEmail:'owner',environment:'HML'};},
    financeAssertOwnerExecution_(){},
    financeInspectSchema_(){return {ok:true};}
  };
  vm.createContext(ctx);
  vm.runInContext(source('apps-script/DashboardCore.gs'),ctx);
  ctx.fhReadTable_=function(_ss,name){
    if(!sheets[name])return [];
    const rows=sheets[name].data;
    return rows.slice(1).map(cells=>Object.fromEntries(rows[0].map((h,i)=>[h,cells[i]])));
  };
  vm.runInContext(source('apps-script/WriteCore.gs'),ctx);
  vm.runInContext(source('apps-script/WriteService.gs'),ctx);
  return {ctx,sheets,prop};
}
test('escrita desligada por padrão bloqueia até cadastro',()=>{
  const {ctx,sheets}=buildMock({enabled:false});
  const out=ctx.saveHmlAccount(baseAccount);
  assert.equal(out.status,'WRITE_DISABLED');
  assert.equal(sheets.CONTAS.data.length,1);
  assert.equal(sheets.AUDITORIA.data.length,1);
});
test('conta criada uma só vez, repetição idempotente e auditoria por duas etapas',()=>{
  const {ctx,sheets}=buildMock();
  const a=ctx.saveHmlAccount(baseAccount);
  assert.equal(a.status,'SAVED');
  assert.equal(sheets.CONTAS.data.length,2);
  assert.equal(sheets.AUDITORIA.data.length,3);
  const repeated=ctx.saveHmlAccount(baseAccount);
  assert.equal(repeated.status,'ALREADY_SAVED');
  assert.equal(sheets.CONTAS.data.length,2);
  assert.equal(sheets.AUDITORIA.data.length,3);
  assert.equal(ctx.saveHmlAccount({...baseAccount,nome:'Outro nome'}).status,'REQUEST_REUSED_DIFFERENTLY');
});
test('pessoa e cartão podem ser cadastrados sem lançar faturas',()=>{
  const {ctx,sheets}=buildMock();
  const p=ctx.saveHmlPerson({requestId:'request_person_abcdefgh1234567890',nome:'Pessoa Teste',apelido:'Teste'});
  const c=ctx.saveHmlCard({requestId:'request_card_abcdefgh1234567890',nome:'Cartão Teste',banco:'Banco Teste',
    bandeira:'MASTERCARD',final4:'4321',fechamento:10,vencimento:20,limiteCents:100000,contaPagadora:''});
  assert.equal(p.ok,true);assert.equal(c.ok,true);
  assert.equal(sheets.PESSOAS.data.length,2);
  assert.equal(sheets.CARTOES.data.length,2);
  assert.equal(sheets.TRANSACOES.data.length,1);
});
test('movimentação grava transação+caixa sem duplicidade e com trilha de auditoria',()=>{
  const {ctx,sheets}=buildMock();
  assert.equal(ctx.saveHmlAccount(baseAccount).status,'SAVED');
  const a=ctx.saveHmlTransaction(baseTransaction);
  assert.equal(a.status,'SAVED');
  assert.equal(sheets.TRANSACOES.data.length,2);
  assert.equal(sheets.MOVIMENTOS_CONTA.data.length,2);
  assert.equal(sheets.TRANSACOES.data[1][16],'CONFIRMADO');
  assert.equal(sheets.MOVIMENTOS_CONTA.data[1][8],'EFETIVADO');
  assert.equal(ctx.saveHmlTransaction(baseTransaction).status,'ALREADY_SAVED');
  assert.equal(sheets.TRANSACOES.data.length,2);
  assert.equal(sheets.MOVIMENTOS_CONTA.data.length,2);
});
test('falha entre transação e movimento bloqueia repetição silenciosa',()=>{
  const {ctx,sheets}=buildMock({failMovement:true});
  assert.equal(ctx.saveHmlAccount(baseAccount).status,'SAVED');
  const out=ctx.saveHmlTransaction(baseTransaction);
  assert.equal(out.status,'WRITE_UNCERTAIN');
  assert.equal(sheets.TRANSACOES.data.length,2);
  assert.equal(sheets.MOVIMENTOS_CONTA.data.length,1);
  const retry=ctx.saveHmlTransaction(baseTransaction);
  assert.equal(retry.status,'RECONCILIATION_REQUIRED');
  assert.equal(sheets.TRANSACOES.data.length,2);
});
test('validação de categoria, mês fechado e data futura antes de gravar',()=>{
  const {ctx,sheets}=buildMock();
  ctx.saveHmlAccount(baseAccount);
  assert.equal(ctx.saveHmlTransaction({...baseTransaction,categoria:'cat_compras'}).status,'CATEGORY_TYPE_MISMATCH');
  assert.equal(ctx.saveHmlTransaction({...baseTransaction,data:'2099-01-01'}).status,'FUTURE_CASH_DATE');
  sheets.FECHAMENTOS.data.push(['FH1','2020-01','2020-02-01','CONFIRMADO']);
  assert.equal(ctx.saveHmlTransaction(baseTransaction).status,'PERIOD_CLOSED');
});
test('script privado, sem planilha e credenciais hardcoded',()=>{
  const code=source('apps-script/WriteService.gs');
  const main=source('apps-script/Main.gs');
  const forms=source('apps-script/Forms.html');
  const manifest=JSON.parse(source('apps-script/appsscript.json'));
  assert.match(code,/FINANCE_WRITE_ENABLED/);
  assert.match(code,/FINANCE_WRITE_MODE/);
  assert.match(code,/LockService\.getScriptLock/);
  assert.match(code,/CHAVE_IDEMPOTENCIA/);
  assert.match(code,/fh2cAudit_/);
  assert.match(main,/createTemplateFromFile\('Index'\)/);
  assert.match(forms,/saveHmlTransaction/);
  assert.equal(manifest.webapp.access,'MYSELF');
  assert.equal(manifest.webapp.executeAs,'USER_DEPLOYING');
  assert.doesNotMatch(code,/docs\.google\.com\/spreadsheets\/d\//);
});

test('Scripts de formulário e dashboard têm JavaScript válido',()=>{
  const forms=source('apps-script/Forms.html');
  const dashboard=source('apps-script/Index.html');
  const formJs=forms.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  const dashJs=dashboard.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(formJs&&dashJs);
  assert.doesNotThrow(()=>new vm.Script(formJs));
  assert.doesNotThrow(()=>new vm.Script(dashJs));
  assert.match(dashboard,/fhInclude_\('Forms'\)/);
  assert.match(dashboard,/Nenhum vencimento cadastrado/);
  assert.match(forms,/fh2c-tx-type/);
});
