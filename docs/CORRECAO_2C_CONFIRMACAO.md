# Fase 2C — Correção de confirmação e diagnósticos (HML)

## Motivo
O iPhone mostrou “Registro confirmado” para uma conta fictícia, porém as abas `CONTAS` e `AUDITORIA` estavam vazias, e a lista de **Execuções** não mostrou uma chamada `saveHmlAccount` naquele intervalo. A causa raiz ainda não foi comprovada. Nesta correção a chamada de gravação é explícita, a confirmação exige evidência de leitura e a operação mantém sua chave quando o resultado é incerto.

## Três proteções implementadas

1. **Verificação do Sheets:** imediatamente após a escrita, o servidor relê o registro e as entradas BEGIN/COMMIT na aba `AUDITORIA`; para entradas/saídas verifica também o movimento de caixa efetivado. Só retorna `verified:true` após conferir. O iPhone então faz uma **segunda chamada independente** a `verifyHmlSaveReceipt` e só apresenta “Registro confirmado” quando recebe `VERIFIED_IN_SHEETS`.
2. **Diagnóstico seguro:** `FINANCE_HUB_2C_OP` nos logs para etapas `ATTEMPT`, `WRITE_VERIFIED`, `INDEPENDENT_VERIFY` e `STOPPED`. Registra ambiente, tipo, status e hash curto do identificador da tentativa; não registra nome, valor, e-mail, ID da planilha nem payload.
3. **Preservar identificador:** o iPhone bloqueia o formulário desde o envio até confirmação definitiva. Erro, ausência de resposta ou falha da verificação mantêm o ID e o bloqueio na sessão da guia. **Não clicar novamente em salvar e não criar outro ID** até reconciliação manual. Esse bloqueio não equivale a recuperação automática após limpeza de dados, troca de aparelho ou sessão.

## Instalação em segurança

**NÃO habilite gravações durante a atualização.** Confirme `FINANCE_WRITE_ENABLED=NO` antes de qualquer `clasp push`.

Terminal do VS Code, dentro do repositório:

```powershell
git status
git fetch origin
git switch fix/2c-confirmed-writes-diagnostics
git pull --ff-only
node --test tests/*.test.mjs
clasp status
clasp push
clasp open-script
```

Antes do `clasp push`, confira que `.clasp.json` aponta para o **Apps Script HML**. **Não executar `clasp push` se os testes falharem**.

No Apps Script, em Script Properties:
- `FINANCE_ENV=HML`
- `FINANCE_WRITE_MODE=HML_TEST`
- `FINANCE_WRITE_ENABLED=NO` (manter)
- `FINANCE_SHEET_ID` e `FINANCE_ALLOWED_EMAIL` mantidos

Execute sem escrita:
1. `runConnectionTest` → `CONNECTION_OK`.
2. `runDashboardTest` → `DASHBOARD_OK`.
3. `run2CReadinessTest` → `CATALOG_OK` com `writeEnabled:false`.
4. `run2CIntegrityTest` → `INTEGRITY_OK`.

Atualize a implantação de Web App para **Nova versão** (executar como Eu, acesso Somente eu), abra no iPhone e confirme botões desativados.

**Somente depois de validar a nova versão, com confirmação explícita**, considere habilitar temporariamente `YES` para **um cadastro fictício de R$ 0,00**. Se for repetido em outra sessão, um novo ID pode criar duplicidade; nunca faça isso diante de erro.

No primeiro teste de escrita:
- Confirme uma execução `saveHmlAccount` no painel **Execuções**.
- Confirme a segunda execução `verifyHmlSaveReceipt`.
- Confirme nova linha em `CONTAS` e 2 eventos em `AUDITORIA`.
- `run2CReadinessTest` deve mostrar uma conta.
- Volte `FINANCE_WRITE_ENABLED=NO`.

Se qualquer etapa falhar, mantenha a gravação em NO e envie a mensagem completa de status/execução sem dados pessoais. Não interprete o status **Concluído** do Apps Script como prova de persistência: ele indica apenas que a função encerrou.

## Limites
A correção não torna múltiplas abas do Sheets transacionais (ACID). Verificações posteriores ainda são necessárias antes de produção. As flags e a implantação continuam privadas, e não há escrita automática a partir do GitHub.
