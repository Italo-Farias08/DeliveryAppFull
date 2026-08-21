function getKey() { return localStorage.getItem('adminKey') || ''; }

function saveKeyAndLoad() {
  localStorage.setItem('adminKey', document.getElementById('key').value.trim());
  load();
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: { 'x-admin-key': getKey(), 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Erro ${res.status}`);
  }
  return res.json();
}

function fmtMoney(v) { return 'R$ ' + Number(v).toFixed(2); }
function fmtDate(v) { return new Date(v).toLocaleDateString('pt-BR'); }

async function load() {
  const msg = document.getElementById('msg');
  msg.textContent = 'Carregando...';
  try {
    const settlements = await api('/api/admin/settlements');
    const tbody = document.getElementById('tbody');
    tbody.innerHTML = '';
    for (const s of settlements) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${s.tenantName}</td>
        <td>${fmtDate(s.periodStart)} – ${fmtDate(s.periodEnd)}</td>
        <td>${s.ordersCount}</td>
        <td>${fmtMoney(s.grossAmount)}</td>
        <td>${s.commissionRate}%</td>
        <td>${fmtMoney(s.commissionAmount)}</td>
        <td><strong>${fmtMoney(s.netAmount)}</strong></td>
        <td class="${s.status}">${s.status === 'pago' ? 'Repassado' : 'Pendente'}</td>
        <td></td>
      `;
      if (s.status === 'pendente') {
        const btn = document.createElement('button');
        btn.textContent = 'Marquei o repasse como feito';
        btn.addEventListener('click', () => markPaid(s.id));
        tr.lastElementChild.appendChild(btn);
      }
      tbody.appendChild(tr);
    }
    document.getElementById('tbl').style.display = settlements.length ? 'table' : 'none';
    msg.textContent = settlements.length ? '' : 'Nenhum acerto ainda.';
  } catch (err) {
    msg.textContent = 'Erro: ' + err.message;
  }
}

async function generate() {
  const msg = document.getElementById('msg');
  msg.textContent = 'Fechando semana...';
  try {
    const result = await api('/api/admin/settlements/generate', { method: 'POST' });
    msg.textContent = `${result.generated} acerto(s) gerado(s).`;
    load();
  } catch (err) {
    msg.textContent = 'Erro: ' + err.message;
  }
}

async function markPaid(id) {
  try {
    await api(`/api/admin/settlements/${id}/mark-paid`, { method: 'PATCH' });
    load();
  } catch (err) {
    alert('Erro: ' + err.message);
  }
}

document.getElementById('key').value = getKey();
document.getElementById('btn-entrar').addEventListener('click', saveKeyAndLoad);
document.getElementById('btn-fechar').addEventListener('click', generate);
document.getElementById('btn-atualizar').addEventListener('click', load);

if (getKey()) load();