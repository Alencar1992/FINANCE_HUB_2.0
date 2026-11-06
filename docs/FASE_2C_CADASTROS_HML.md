# FINANCE HUB 2.0 — Fase 2C (HML) | Cadastro e lançamentos básicos

## Status
- **Código preparado no GitHub**, sem envio automático ao seu Apps Script e **sem gravação efetuada** na planilha HML nesta entrega.
- Tela Executivo iPhone da 2B permanece integrada ao Dashboard.
- O modo de gravação fica **DESLIGADO por padrão**, mesmo após \`clasp push\`.
- Esta é a primeira entrega da 2C (**2C.1**). Parcelamentos, cartão/faturas, vendas, recorrências e fechamento exigem fases separadas de integridade financeira.

## Funcionalidades preparadas
1. **Contas:** nome, instituição, tipo, saldo de abertura em centavos, data de abertura.
2. **Cartões:** banco, bandeira, 4 últimos dígitos, limite, dia de fechamento, vencimento e conta pagadora opcional; **não permite compras ainda**.
3. **Pessoas:** nome e apelido; dívida de terceiros ficará para próxima fase.
4. **Entradas e saídas efetivadas:** conta, categoria, valor, data, forma, descrição, estabelecimento (com "Outro") e categoria personalizada. A movimentação gera \`TRANSACOES\` + \`MOVIMENTOS_CONTA\`, não uma fatura.
5. **Dashboard:** recalcula leitura após registro confirmado, separa obrigação de movimentação de caixa, exclui registros \`PENDENTE\` e distingue "Nenhum vencimento cadastrado" de "Nenhum vencimento nos próximos 7 dias".

Formas de pagamento **permitidas agora**: Pix, débito, dinheiro, transferência **para terceiro já liquidada**, boleto **já liquidado**. Crédito, boca-a-boca, parcelamentos, contas a pagar e transferências entre contas ficam bloqueados até regras específicas.

## Barreiras de segurança
- Planilha HML privada; Web App somente **"Eu" / "Somente eu"**.
- \`FINANCE_ENV=HML\`, conta proprietária validada via \`FINANCE_ALLOWED_EMAIL\`.
- Flags de escrita em **Script Properties** (não no GitHub):
  - \`FINANCE_WRITE_ENABLED\` = \`NO\` inicialmente;
  - \`FINANCE_WRITE_MODE\` = \`HML_TEST\` (não suficiente sozinha para gravar).
- Para permitir gravação de **dados totalmente fictícios**, depois dos testes, alterar **FINANCE_WRITE_ENABLED** para \`YES\`.
- LockService para impedir gravações concorrentes; leitura do Dashboard obtém o mesmo lock.
- Chave idempotente única e estável por tentativa. Um reenvio do mesmo pedido não cria operação duplicada.
- \`AUDITORIA\`: BEGIN (pendente) + COMMIT; inclui correlação e hash do payload, sem nomes/valores em texto livre.
- Se uma gravação multiaba ficar incompleta, retorna \`RECONCILIATION_REQUIRED\`. **Não** tentar reenvio com outro ID: exige investigação/regularização assistida.
- Mês confirmado em \`FECHAMENTOS\` bloqueia lançamento retroativo.
- Valores são inteiros em centavos. Datas ISO; nome e descrição têm limites e bloqueio de fórmulas.
- **Nenhum dado real, ID da planilha, credencial, e-mail pessoal ou backup é enviado ao GitHub**.

**Limitação estrutural:** o Google Sheets não oferece transações ACID entre abas. A aplicação reduz risco com lock, estados e auditoria, mas não deve ser usada como banco de produção até passar por testes de falha, recuperação/reconciliação e backup. Na HML, um erro parcial pode deixar um registro PENDENTE para ajuste, sem atualizar o saldo.

## Instalação (VS Code Windows)

No terminal, com seu repositório aberto:

\`\`\`powershell
git status
git fetch origin
git switch feat/phase-2c-hml-records
git pull --ff-only
node --test tests/*.test.mjs
git check-ignore .clasp.json
clasp status
\`\`\`

Confirme que \`.clasp.json\` aponta para **FINANCE HUB 2.0 — HML**. Caso o \`git status\` mostre alterações locais, revise e guarde seu trabalho antes de alternar de branch.

Após o GitHub Actions e testes locais passarem:

\`\`\`powershell
clasp push
clasp open-script
\`\`\`

Os novos arquivos incluem \`WriteCore.gs\`, \`WriteService.gs\` e \`Forms.html\`.

## Testes iniciais SEM permitir escrita

1. No Apps Script: **Configurações do projeto > Propriedades do script**:
   - \`FINANCE_ENV\` = \`HML\`
   - \`FINANCE_SHEET_ID\` = ID privado da planilha HML (já configurado na 2B)
   - \`FINANCE_ALLOWED_EMAIL\` = conta proprietária (já configurada na 2B)
   - \`FINANCE_WRITE_ENABLED\` = \`NO\`
   - \`FINANCE_WRITE_MODE\` = \`HML_TEST\`
2. Execute \`runConnectionTest\` → \`CONNECTION_OK\`.
3. Execute \`runDashboardTest\` → \`DASHBOARD_OK\`.
4. Execute \`run2CReadinessTest\`. Esperado: \`ok:true\`, \`status:CATALOG_OK\`, \`writeEnabled:false\`.
5. Abra a implantação restrita no iPhone, atualizando a implantação Web App para **nova versão**.
6. Confirme que em **Mais** aparecem contas, cartões e pessoas; e nas abas Entradas/Saídas, os formulários, mas com **Salvar desativado**. Outra conta Google não pode acessar o Web App.

## Testes de escrita na HML (somente após revisão)

1. Garanta que não existem lançamentos reais na HML.
2. Configure \`FINANCE_WRITE_ENABLED=YES\`, mantendo \`FINANCE_WRITE_MODE=HML_TEST\`, e execute \`run2CReadinessTest\` → \`writeEnabled:true\`.
3. No iPhone, abra o app privado e cadastre **Conta Teste** com saldo **R$ 0,00**.
4. Registre entrada fictícia de R$ 100,00 pela forma Pix e categoria "Salário".
5. Registre saída fictícia de R$ 20,00 via Pix e categoria "Compras".
6. Verifique: saldo R$ 80,00, entradas R$ 100,00, saídas R$ 20,00.
7. Nas abas \`TRANSACOES\`, \`MOVIMENTOS_CONTA\`, \`AUDITORIA\`: confirme 2 transações, 2 movimentos e trilha BEGIN/COMMIT para cada operação.
8. Teste o uso de \`Outro\` em categoria/estabelecimento, e os cadastros de pessoa e cartão sem operações de fatura.
9. Volte \`FINANCE_WRITE_ENABLED=NO\` depois do teste.
10. Se aparecer \`WRITE_UNCERTAIN\` ou \`RECONCILIATION_REQUIRED\`, **não refaça a operação com novo ID**; preserve os dados para conciliação.

## Critérios de aceite

- [ ] Testes automatizados GitHub Actions aprovados.
- [ ] \`run2CReadinessTest\` responde corretamente com flag NO.
- [ ] Botões de salvar bloqueados com flag NO.
- [ ] Acesso externo ao Web App bloqueado.
- [ ] Somente cadastros fictícios são gravados após flag YES.
- [ ] Repetir a mesma chave idempotente não duplica linhas.
- [ ] Erro parcial não confirma saldo automaticamente e exige reconciliação.
- [ ] Alteração de mês fechado, crédito e boca-a-boca ficam bloqueados.
- [ ] Dashboard preserva regras de caixa e recarrega após sucesso.
- [ ] Validação no iPhone em modo HML concluída.

**NÃO habilitar gravações reais nem migrar para produção nesta fase.**
