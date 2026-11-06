import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const sandbox = {};
vm.runInNewContext(read('apps-script/DashboardCore.gs'), sandbox);
const run = (tables, opts={month:'2026-11',today:'2026-11-06'}) =>
  sandbox.fhBuildDashboard_(tables, opts);
const make = () => ({
  CONTAS:[{ID_CONTA:'A',ATIVA:'SIM',SALDO_ABERTURA_CENTAVOS:100000}],
  CARTOES:[{ID_CARTAO:'C',NOME:'Banco de teste'}],
  MOVIMENTOS_CONTA: [
    {ID_CONTA:'A',DATA_MOVIMENTO:'2026-11-05',VALOR_ASSINADO_CENTAVOS:20000,STATUS:'EFETIVADO',TIPO:'RECEBIMENTO'},
    {ID_CONTA:'A',DATA_MOVIMENTO:'2026-11-05',VALOR_ASSINADO_CENTAVOS:-3000,STATUS:'CONFIRMADO',TIPO:'DESPESA'},
    {ID_CONTA:'A',DATA_MOVIMENTO:'2026-11-04',VALOR_ASSINADO_CENTAVOS:-1000,STATUS:'EFETIVADO',TIPO:'TRANSFERENCIA',ID_TRANSFERENCIA:'X'},
    {ID_CONTA:'A',DATA_MOVIMENTO:'2026-11-04',VALOR_ASSINADO_CENTAVOS:1000,STATUS:'EFETIVADO',TIPO:'TRANSFERENCIA',ID_TRANSFERENCIA:'X'},
    {ID_CONTA:'A',DATA_MOVIMENTO:'2026-11-05',VALOR_ASSINADO_CENTAVOS:-5000,STATUS:'PENDENTE',TIPO:'DESPESA'}
  ],
  OCORRENCIAS:[
    {ID_OCORRENCIA:'R1',DATA_VENCIMENTO:'2026-11-09',VALOR_PREVISTO_CENTAVOS:5000,STATUS:'PENDENTE',DESCRICAO:'Internet'},
    {ID_OCORRENCIA:'R2',DATA_VENCIMENTO:'2026-12-09',VALOR_PREVISTO_CENTAVOS:9000,STATUS:'PENDENTE',DESCRICAO:'Próximo mês'},
    {ID_OCORRENCIA:'R3',DATA_VENCIMENTO:'2026-11-08',VALOR_PREVISTO_CENTAVOS:8000,STATUS:'PAGO',DESCRICAO:'Já paga'}
  ],
  FATURAS:[{ID_FATURA:'F1',ID_CARTAO:'C',DATA_VENCIMENTO:'2026-11-12',SALDO_ABERTO_CENTAVOS:12000,STATUS:'ABERTA'}],
  PARCELAS:[
    {ID_PARCELA:'P1',NUMERO:1,DATA_VENCIMENTO:'2026-11-20',VALOR_ORIGINAL_CENTAVOS:2000,LIQUIDADO_CENTAVOS:0,STATUS:'PENDENTE'},
    {ID_PARCELA:'P2',NUMERO:2,ID_FATURA:'F1',DATA_VENCIMENTO:'2026-11-20',VALOR_ORIGINAL_CENTAVOS:6000,STATUS:'PENDENTE'}
  ],
  METAS:[{ID_META:'G1',NOME:'Reserva',VALOR_ALVO_CENTAVOS:50000,VALOR_INICIAL_CENTAVOS:10000,STATUS:'ATIVA'}],
  APORTES_METAS:[{ID_META:'G1',VALOR_CENTAVOS:5000}],
  TRANSACOES:[{ID_TRANSACAO:'T1',DATA_COMPETENCIA:'2026-11-05',DESCRICAO:'Compra teste',VALOR_CENTAVOS:3000,TIPO:'SAIDA',STATUS:'CONFIRMADO'}]
});
test('Caixa do mês exclui transferências e movimentações pendentes', () => {
  const d=run(make());
  assert.equal(d.stats.balanceCents,117000);
  assert.equal(d.stats.incomingCents,20000);
  assert.equal(d.stats.outgoingCents,3000);
  assert.equal(d.warnings[0],'MOVEMENTS_NOT_CONFIRMED');
});
test('Faturas não duplicam parcelas do próprio cartão', () => {
  const d=run(make());
  assert.equal(d.stats.committedCents,19000);
  assert.equal(d.stats.freeCents,98000);
  assert.equal(d.stats.pendingCount,3);
});
test('Alerta de 7 dias aponta apenas para obrigações próximas', () => {
  const d=run(make());
  assert.equal(d.alerts.length,2);
  assert.equal(d.alerts[0].id,'OCORRENCIAS:R1');
  assert.equal(d.alerts[0].target,'pending');
  assert.equal(d.alerts[1].id,'FATURAS:F1');
});
test('Meta usa aporte como reserva e não duplica entrada ou saída', () => {
  const d=run(make());
  assert.equal(d.goals[0].savedCents,15000);
  assert.equal(d.goals[0].progress,30);
  assert.equal(d.stats.outgoingCents,3000);
});
test('Filtro histórico não muda o compromisso atual sem snapshot', () => {
  const d=run(make(),{month:'2026-10',today:'2026-11-06'});
  assert.equal(d.stats.incomingCents,0);
  assert.equal(d.stats.outgoingCents,0);
  assert.equal(d.stats.committedCents,19000);
  assert.equal(d.recent.length,0);
});
test('Base vazia é zero real e explicitamente vazia', () => {
  const d=run({});
  assert.equal(d.isEmpty,true);
  assert.equal(d.stats.balanceCents,0);
  assert.equal(d.alerts.length,0);
  assert.equal(d.goals.length,0);
});
test('Dados monetários inválidos falham sem produzir resumo parcial', () => {
  const tables=make();
  tables.FATURAS[0].SALDO_ABERTO_CENTAVOS=12.34;
  assert.throws(()=>run(tables),/INVALID_CENTS_FATURAS/);
});
test('Conta desconhecida em movimentação efetivada falha',()=>{
  const tables=make();
  tables.MOVIMENTOS_CONTA[0].ID_CONTA='NAO_EXISTE';
  assert.throws(()=>run(tables),/UNKNOWN_ACCOUNT_MOVEMENT/);
});
test('Mês inválido não executa agregação',()=>{
  assert.throws(()=>run({}, {month:'2026-13',today:'2026-11-06'}),/INVALID_MONTH/);
});
test('Endpoint e interface não incluem rotinas de escrita e mantêm acesso privado',()=>{
  const server=read('apps-script/DashboardService.gs') + read('apps-script/Main.gs');
  const page=read('apps-script/Index.html');
  const manifest=JSON.parse(read('apps-script/appsscript.json'));
  assert.doesNotMatch(server,/\b(?:appendRow|setValue|setValues|deleteRow|deleteRows|clearContents|insertRows|doPost)\s*\(/);
  assert.match(server,/financeAssertOwnerExecution_\(config\)/);
  assert.match(server,/financeInspectSchema_\(spreadsheet\)/);
  assert.match(page,/google\.script\.run/);
  assert.match(page,/getDashboardData/);
  assert.equal(manifest.webapp.access,'MYSELF');
  assert.equal(manifest.webapp.executeAs,'USER_DEPLOYING');
  assert.doesNotMatch(server,/1J_FhVcmJlpeFX3sWQnF4zmYwShkpT4MLYiDNUUIAnw4/);
});
