# FINANCE HUB 2.0 — Fase 2B: Dashboard Executivo conectado à HML

## Situação
Código preparado no GitHub e testes sintéticos em CI. **A aplicação ainda não foi publicada nem testada no seu projeto Apps Script desta fase**. A base HML continua privada e a operação é somente de leitura.

## O que entra
- Interface mobile-first preta e azul, baseada na proposta **Executivo V2.2**.
- Saldo atual de contas ativas.
- Entradas e saídas efetivadas da competência selecionada.
- Contas, faturas e parcelas sem cartão já registradas.
- Comprometimento e saldo livre projetado (com as limitações abaixo).
- Metas e aportes registrados, últimos lançamentos da competência.
- Sino e faixa de alertas de 7 dias, clicáveis para a seção de pendências.
- Estado vazio real para planilha sem movimentações.
- Sem formulários de lançamentos, pagamentos, alterações ou fechamento: outras abas serão integradas depois.

## Regra de cálculo (centrada em centavos inteiros)
1. **Saldo atual:** saldo de abertura das contas ativas + soma dos movimentos efetivados de todas as competências. Transferências entre contas afetam saldo de cada conta, mas não criam receita/despesa.
2. **Entradas/saídas no mês:** movimentos efetivados em \`MOVIMENTOS_CONTA\` na competência escolhida, excluindo transferências.
3. **Comprometido atual:** obrigações ainda abertas e vencidas ou vencendo **até o último dia do mês corrente**:
   - \`OCORRENCIAS\` não pagas;
   - \`FATURAS\` abertas, pelo \`SALDO_ABERTO_CENTAVOS\`;
   - \`PARCELAS\` sem fatura de cartão, pela diferença entre valor, ajustes e liquidação.
4. **Livre projetado:** saldo atual menos comprometido atual. Pode ser negativo.
5. **Metas:** \`VALOR_INICIAL_CENTAVOS\` + soma de \`APORTES_METAS\`; não contam como despesa.
6. **Alertas:** pendências vencidas ou que vencem em até sete dias, geradas dos registros financeiros; o sino leva ao item na própria seção "Próximos vencimentos".
7. **Últimos lançamentos:** até cinco eventos não cancelados de \`TRANSACOES\` na competência selecionada; não entram novamente nos indicadores de caixa.

**Importante:** selecionar um mês histórico altera entradas, saídas e últimos lançamentos. Saldo atual, compromissos e livre projetado permanecem **atuais**, não são fotografia histórica. O histórico mensal fiel será construído na fase de fechamento.

## Limites que não devem ser escondidos
- Uma recorrência cadastrada em \`RECORRENCIAS\` só aparece como pendência depois de sua ocorrência ser gerada em \`OCORRENCIAS\`. Essa geração será implementada depois.
- Contas não registradas na planilha não podem ser previstas pelo Dashboard.
- Faturas, dívidas e parcelas devem ter IDs únicos e vínculos corretos para não duplicar.
- Movimentos com status não efetivado não compõem o saldo nem o fluxo de caixa.
- Não há integração bancária ou confirmação automática de débito.
- Cada aba lida admite até 5.000 registros, acima disso a consulta falha com \`ROW_LIMIT_EXCEEDED\` (não calcula total parcial).
- O script valida a identidade de execução, mas **somente a implantação restrita "Somente eu" impede visitantes**; não publique um Web App aberto.

## Atualizar no VS Code (depois de salvar o trabalho local)
No terminal, dentro do repositório \`FINANCE_HUB_2.0\`:

\`\`\`powershell
git status
git fetch origin
git switch feat/dashboard-executivo-hml
git pull --ff-only
node --test tests/*.test.mjs
clasp status
clasp push
\`\`\`

O arquivo \`.clasp.json\` deve continuar **local e ignorado**. Confira se aponta para o projeto HML correto antes do \`clasp push\`; o comando atualiza arquivos do projeto remoto e **não** deve ser executado contra produção.

## Testar o Apps Script

1. Abra o editor HML com \`clasp open-script\`.
2. Confira em **Configurações > Propriedades do script**:
   - \`FINANCE_ENV\` = \`HML\`
   - \`FINANCE_SHEET_ID\` = ID da planilha privada HML
   - \`FINANCE_ALLOWED_EMAIL\` = endereço da conta proprietária
3. Execute \`runConnectionTest\` — deve continuar retornando \`CONNECTION_OK\`.
4. Execute \`runDashboardTest\` — deve retornar \`ok:true\`, \`status:DASHBOARD_OK\`, \`environment:HML\` e \`month:AAAA-MM\`.
5. Se a planilha está sem movimentos, \`isEmpty:true\` e indicadores zerados são esperados. **Não insira dados financeiros reais apenas para testar.**
6. Se uma implantação web já existir, publique uma **nova versão** em **Implantar > Gerenciar implantações**. Caso contrário, crie uma implantação como **Aplicativo da Web**.
7. Mantenha **Executar como: Eu** e **Quem tem acesso: Somente eu**; a permissão definida no editor deve ser verificada novamente na interface de implantação.
8. Abra a URL \`/exec\` no celular autenticado na sua conta. O Dashboard deve carregar sem mensagem de erro.
9. Teste uma conta diferente: ela não pode abrir a interface. Nunca altere o acesso para qualquer pessoa.

## Critérios de aceite
- [ ] \`runConnectionTest\` mantém \`CONNECTION_OK\`.
- [ ] \`runDashboardTest\` retorna \`DASHBOARD_OK\`.
- [ ] Dashboard carrega no celular e no desktop, sem travar.
- [ ] O modo HML e Somente leitura aparecem explicitamente.
- [ ] Planilha vazia apresenta zeros com aviso correto, não valores de demonstração.
- [ ] Sino abre alerta, e tocar um item navega até sua pendência dentro do dashboard.
- [ ] Trocar competência altera entradas, saídas e lançamentos, sem fingir saldo histórico.
- [ ] Acesso de outra conta é negado.
- [ ] Nenhuma célula financeira é gravada ou alterada pelo teste.

## Próxima fase
Integração de telas de entrada/saída e operações de gravação com \`LockService\`, chaves de idempotência, auditoria e validação atômica. **Não antecipar gravações nesta fase.**
