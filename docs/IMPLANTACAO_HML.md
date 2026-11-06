# FINANCE HUB 2.0 — Instalação da conexão Google Sheets (Fase 2A)

Status: **código preparado no GitHub; vinculação e teste real no Apps Script ainda pendentes**.
Esta fase é **somente leitura** e trabalha exclusivamente com a planilha HML.

## Arquitetura

```text
Celular / navegador (tela de diagnóstico HML)
        |
        | google.script.run (apenas status técnico)
        v
Apps Script (executa somente como o proprietário)
        |
        | Script Properties -> FINANCE_SHEET_ID (sem ID no código)
        v
Google Sheets privado — FINANCE HUB 2.0 | BASE DE DADOS (HML)
```

O **GitHub público só armazena código**, não armazena identificadores reais, dados financeiros, senhas, backups, tokens ou arquivos de autorização.

## 1. Criar o projeto no Apps Script

1. Acesse [script.google.com](https://script.google.com) pela conta Google que é proprietária da planilha HML.
2. Clique em **Novo projeto** e nomeie **FINANCE HUB 2.0 — HML**.
3. Entre em **Configurações do projeto > Propriedades do script** e adicione as propriedades abaixo, sem aspas:

| Nome | Valor |
| --- | --- |
| `FINANCE_SHEET_ID` | ID copiado da URL da planilha HML no seu Drive |
| `FINANCE_ALLOWED_EMAIL` | E-mail da MESMA conta Google proprietária do projeto |
| `FINANCE_ENV` | `HML` |

**Não informe esses valores no GitHub, em Issues, em commits ou em capturas de tela públicas.**

## 2. Vincular o repositório por clasp

Na máquina local, no terminal do VS Code:

```bash
git clone https://github.com/Alencar1992/FINANCE_HUB_2.0.git
cd FINANCE_HUB_2.0
git switch feat/apps-script-sheets-hml

npm install -g @google/clasp
clasp login
```

Habilite a **API do Google Apps Script** nas configurações da conta em
<https://script.google.com/home/usersettings>, se necessário.

Copie `.clasp.example.json` para `.clasp.json`, cole o **ID do projeto Apps Script** no campo `scriptId`, e **mantenha `.clasp.json` fora do GitHub** — está no `.gitignore`.

Para obter o Script ID: projeto Apps Script > **Configurações do projeto > IDs > ID do script**.

```bash
clasp status
clasp push
clasp open
```

**Antes do push:** confira se o Script ID aponta para o projeto **HML** correto. Não execute `clasp create` em cima da planilha de produção. Não use `clasp pull` sem revisar os efeitos sobre seu diretório local.

## 3. Autorizar e validar conexão

1. No editor Apps Script, selecione **`runConnectionTest`** e clique em **Executar**.
2. Autorize o acesso solicitado **somente se o projeto for o HML que você criou**.
3. Abra o log de execução. A resposta deve ter `ok:true`, `environment:HML`, `accessMode:READ_ONLY`, `expectedSheets:32`, `foundSheets:32`, `status:CONNECTION_OK`.
4. Se não houver sucesso, consulte o quadro de erros abaixo. **Não substitua dados da planilha para tentar corrigir.**

## 4. Abrir no celular: implantação restrita

Após o teste pelo editor:

1. No Apps Script, clique em **Implantar > Nova implantação > Aplicativo da Web**.
2. Execute como **Eu (proprietário)**.
3. Em **Quem tem acesso**, selecione **Somente eu**. **Nunca selecione Qualquer pessoa ou Todos na organização nesta fase.**
4. Implante e abra a URL `/exec` usando sua própria conta Google.
5. Toque em **Verificar conexão** e confirme o resultado. Teste que uma conta Google diferente **não** consegue abrir o aplicativo.

**Atenção:** quando o Web App executa como o proprietário, `Session.getEffectiveUser()` é a identidade do PROPRIETÁRIO, não do visitante. Portanto, conferir o e-mail de execução no código **não substitui** a restrição da implantação **Somente eu**. Esta arquitetura não está aprovada para multiusuários.

## 5. Diagnóstico

| Código | O que corrigir |
| --- | --- |
| `MISSING_SHEET_ID` | Criar/corrigir propriedade FINANCE_SHEET_ID no Apps Script |
| `MISSING_ALLOWED_EMAIL` | Criar/corrigir propriedade FINANCE_ALLOWED_EMAIL |
| `INVALID_ENVIRONMENT` | FINANCE_ENV precisa ser HML |
| `OWNER_MISMATCH` | Logar na conta Google certa, conferir e-mail do proprietário |
| `ACTIVE_USER_DENIED` | Usuário ativo divergente; não prosseguir |
| `SHEET_NOT_ACCESSIBLE` | Verificar ID da HML e acesso da conta que executa |
| `SCHEMA_VALIDATION_FAILED` | Conferir abas, cabeçalhos, fuso e CONFIGURACOES |
| `UNEXPECTED_ERROR` | Verificar execução no editor do Apps Script; não compartilhar tokens/IDs |

## 6. Critérios de aceite da fase

- [ ] O Apps Script pertence à conta Google dona da planilha HML.
- [ ] `.clasp.json` não está no repositório e foi ignorado pelo Git.
- [ ] O projeto Apps Script contém os arquivos da branch HML.
- [ ] A função `runConnectionTest` retorna `CONNECTION_OK`.
- [ ] Web App implantado somente para o proprietário.
- [ ] Outra conta Google não consegue acessar a URL.
- [ ] Nenhum lançamento financeiro foi escrito, modificado ou apagado.

## Limites desta fase

- Não há gravação no Sheets, cadastro de transações, pagamentos ou fechamento mensal.
- A tela técnica não substitui o protótipo visual **Executivo V2.2** aprovado.
- Escopos OAuth do `SpreadsheetApp.openById` podem ser amplos; considere uma conta Google separada e restrita para dados financeiros quando evoluirmos.
- Uma planilha não oferece as mesmas transações, isolamento e integridade de um banco de dados relacional. Antes de liberar pagamentos e fechamento, precisamos de trava, idempotência, auditoria e testes.
