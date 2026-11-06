/**
 * FINANCE HUB 2.0 — núcleo de cálculos para o Dashboard Executivo (HML).
 * Funções puras, sem acesso a planilhas e sem alterações financeiras.
 * Todas as quantias são centavos inteiros.
 */
function fhText_(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}
function fhUpper_(value) {
  return fhText_(value).toUpperCase();
}
function fhCents_(value, table) {
  if (value === '' || value === null || value === undefined) return 0;
  var n = typeof value === 'number' ? value : Number(fhText_(value));
  if (!Number.isSafeInteger(n)) throw new Error('INVALID_CENTS_' + table);
  return n;
}
function fhISO_(value) {
  if (typeof value === 'string') {
    var s = value.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s.slice(6) + '-' + s.slice(3, 5) + '-' + s.slice(0, 2);
    return '';
  }
  if (value instanceof Date && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, 'America/Sao_Paulo', 'yyyy-MM-dd');
  }
  return '';
}
function fhDatePlus_(isoDate, n) {
  var d = new Date(isoDate + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().substring(0, 10);
}
function fhFinalDay_(month) {
  return new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0))
    .toISOString().substring(0, 10);
}
function fhIsClosed_(status) {
  return ['PAGO', 'PAGA', 'QUITADO', 'QUITADA', 'LIQUIDADO', 'LIQUIDADA',
    'CANCELADO', 'CANCELADA', 'ESTORNADO', 'ESTORNADA'].indexOf(fhUpper_(status)) >= 0;
}
function fhIsEffective_(status) {
  return ['EFETIVADO', 'EFETIVADA', 'CONFIRMADO', 'CONFIRMADA', 'CONCILIADO',
    'CONCILIADA', 'PAGO', 'PAGA', 'RECEBIDO', 'RECEBIDA'].indexOf(fhUpper_(status)) >= 0;
}
function fhIsActiveAccount_(value) {
  return ['NAO', 'NÃO', 'FALSE', '0', 'INATIVO', 'INATIVA', 'CANCELADO'].indexOf(fhUpper_(value)) === -1;
}
function fhEmpty_(tables, key) {
  return Array.isArray(tables[key]) ? tables[key] : [];
}
function fhSafeDate_(date, source) {
  var iso = fhISO_(date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) ||
      new Date(iso + 'T12:00:00Z').toISOString().substring(0, 10) !== iso) {
    throw new Error('INVALID_DATE_' + source);
  }
  return iso;
}

/**
 * @param {Object} tables Map de tabelas para listas de registros com campos nomeados.
 * @param {Object} options {month:'YYYY-MM', today:'YYYY-MM-DD'}.
 */
function fhBuildDashboard_(tables, options) {
  var month = fhText_(options && options.month);
  var today = fhText_(options && options.today);
  if (!/^(20\d{2})-(0[1-9]|1[0-2])$/.test(month)) throw new Error('INVALID_MONTH');
  fhSafeDate_(today, 'TODAY');
  var activeMonth = today.slice(0, 7);
  var endOfActiveMonth = fhFinalDay_(activeMonth);
  var nextWeek = fhDatePlus_(today, 7);

  var accounts = fhEmpty_(tables, 'CONTAS').filter(function(row) {
    return fhIsActiveAccount_(row.ATIVA);
  });
  var accountIds = {};
  var balance = 0;
  accounts.forEach(function(row) {
    var id = fhText_(row.ID_CONTA);
    if (!id || accountIds[id]) throw new Error('INVALID_ACCOUNT_ID');
    accountIds[id] = true;
    balance += fhCents_(row.SALDO_ABERTURA_CENTAVOS, 'CONTAS');
  });

  var incoming = 0;
  var outgoing = 0;
  var ignoredMovements = 0;
  fhEmpty_(tables, 'MOVIMENTOS_CONTA').forEach(function(row) {
    if (!fhIsEffective_(row.STATUS)) {
      ignoredMovements++;
      return;
    }
    if (!accountIds[fhText_(row.ID_CONTA)]) throw new Error('UNKNOWN_ACCOUNT_MOVEMENT');
    var date = fhSafeDate_(row.DATA_MOVIMENTO, 'MOVIMENTOS_CONTA');
    var cents = fhCents_(row.VALOR_ASSINADO_CENTAVOS, 'MOVIMENTOS_CONTA');
    balance += cents;
    var isTransfer = fhText_(row.ID_TRANSFERENCIA) !== '' || fhUpper_(row.TIPO) === 'TRANSFERENCIA' || fhUpper_(row.TIPO) === 'TRANSFERÊNCIA';
    if (date.slice(0, 7) === month && !isTransfer) {
      if (cents > 0) incoming += cents;
      if (cents < 0) outgoing += -cents;
    }
  });

  var obligations = [];
  function addObligation(source, row, title, dateValue, open, kind) {
    var amount = fhCents_(open, source);
    if (amount <= 0) return;
    var due = fhSafeDate_(dateValue, source);
    var id = fhText_(row['ID_' + (source === 'OCORRENCIAS' ? 'OCORRENCIA' : source === 'FATURAS' ? 'FATURA' : 'PARCELA')]);
    if (!id) throw new Error('MISSING_ID_' + source);
    obligations.push({id: source + ':' + id, type: kind, title: fhText_(title) || kind, due: due, amountCents: amount});
  }

  fhEmpty_(tables, 'OCORRENCIAS').forEach(function(row) {
    if (fhIsClosed_(row.STATUS) || fhText_(row.DATA_PAGAMENTO)) return;
    var amount = fhText_(row.VALOR_CONFIRMADO_CENTAVOS) !== ''
      ? row.VALOR_CONFIRMADO_CENTAVOS : row.VALOR_PREVISTO_CENTAVOS;
    addObligation('OCORRENCIAS', row, row.DESCRICAO || 'Conta recorrente',
      row.DATA_VENCIMENTO, amount, 'Conta recorrente');
  });
  var cardNames = {};
  fhEmpty_(tables, 'CARTOES').forEach(function(row) {
    cardNames[fhText_(row.ID_CARTAO)] = fhText_(row.NOME || row.BANCO) || 'Cartão';
  });
  fhEmpty_(tables, 'FATURAS').forEach(function(row) {
    if (fhIsClosed_(row.STATUS)) return;
    addObligation('FATURAS', row,
      'Fatura · ' + (cardNames[fhText_(row.ID_CARTAO)] || 'Cartão'),
      row.DATA_VENCIMENTO, row.SALDO_ABERTO_CENTAVOS, 'Fatura');
  });
  fhEmpty_(tables, 'PARCELAS').forEach(function(row) {
    if (fhText_(row.ID_FATURA) || fhIsClosed_(row.STATUS)) return;
    var amount = fhCents_(row.VALOR_ORIGINAL_CENTAVOS, 'PARCELAS')
      + fhCents_(row.AJUSTE_CENTAVOS, 'PARCELAS')
      - fhCents_(row.LIQUIDADO_CENTAVOS, 'PARCELAS');
    addObligation('PARCELAS', row,
      'Parcela ' + fhText_(row.NUMERO || '') + ' · sem cartão',
      row.DATA_VENCIMENTO, amount, 'Parcela');
  });

  obligations.sort(function(a, b) {
    return a.due < b.due ? -1 : a.due > b.due ? 1 : a.id.localeCompare(b.id);
  });
  var committed = 0;
  obligations.forEach(function(item) {
    if (item.due <= endOfActiveMonth) committed += item.amountCents;
  });
  var near = obligations.filter(function(item) {
    return item.due <= nextWeek;
  });
  var alerts = near.slice(0, 10).map(function(item) {
    var overdue = item.due < today;
    return {
      id: item.id,
      title: item.title,
      due: item.due,
      amountCents: item.amountCents,
      label: overdue ? 'Vencida' : item.due === today ? 'Vence hoje' : 'Próximo vencimento',
      severity: overdue ? 'danger' : 'warning',
      target: 'pending'
    };
  });

  var aportes = {};
  fhEmpty_(tables, 'APORTES_METAS').forEach(function(row) {
    var key = fhText_(row.ID_META);
    aportes[key] = (aportes[key] || 0) + fhCents_(row.VALOR_CENTAVOS, 'APORTES_METAS');
  });
  var goals = fhEmpty_(tables, 'METAS').filter(function(row) {
    return !['CANCELADA','CANCELADO','INATIVA','INATIVO'].includes(fhUpper_(row.STATUS));
  }).map(function(row) {
    var id = fhText_(row.ID_META);
    if (!id) throw new Error('INVALID_GOAL_ID');
    var target = fhCents_(row.VALOR_ALVO_CENTAVOS, 'METAS');
    var saved = fhCents_(row.VALOR_INICIAL_CENTAVOS, 'METAS') + (aportes[id] || 0);
    return {id: id, title: fhText_(row.NOME) || 'Meta', targetCents: target, savedCents: saved,
      progress: target > 0 ? Math.min(100, Math.round(saved / target * 100)) : 0};
  }).slice(0, 3);

  var recent = fhEmpty_(tables, 'TRANSACOES').filter(function(row) {
    return fhISO_(row.DATA_COMPETENCIA).slice(0, 7) === month &&
      !['CANCELADO','CANCELADA','ESTORNADO','ESTORNADA'].includes(fhUpper_(row.STATUS));
  }).sort(function(a, b) {
    var left = fhISO_(a.DATA_COMPETENCIA), right = fhISO_(b.DATA_COMPETENCIA);
    return left < right ? 1 : left > right ? -1 : 0;
  }).slice(0, 5).map(function(row) {
    return {title: fhText_(row.DESCRICAO) || 'Lançamento', date: fhISO_(row.DATA_COMPETENCIA),
      type: fhUpper_(row.TIPO), amountCents: fhCents_(row.VALOR_CENTAVOS, 'TRANSACOES')};
  });

  var totalRows = ['CONTAS','MOVIMENTOS_CONTA','OCORRENCIAS','FATURAS',
    'PARCELAS','METAS','APORTES_METAS','TRANSACOES'].reduce(function(n, key) {
    return n + fhEmpty_(tables, key).length;
  }, 0);

  return {
    month: month,
    currentMonth: activeMonth,
    asOf: today,
    mode: 'READ_ONLY',
    isEmpty: totalRows === 0,
    stats: {
      balanceCents: balance,
      incomingCents: incoming,
      outgoingCents: outgoing,
      committedCents: committed,
      freeCents: balance - committed,
      activeAccounts: accounts.length,
      pendingCount: obligations.filter(function(row) {
        return row.due <= endOfActiveMonth;
      }).length
    },
    alerts: alerts,
    upcoming: obligations.filter(function(row) {
      return row.due <= endOfActiveMonth || row.due <= nextWeek;
    }).slice(0, 8).map(function(row) {
      return {id:row.id,type:row.type,title:row.title,due:row.due,amountCents:row.amountCents};
    }),
    goals: goals,
    recent: recent,
    warnings: ignoredMovements > 0 ? ['MOVEMENTS_NOT_CONFIRMED'] : []
  };
}
