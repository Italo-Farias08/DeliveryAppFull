const { Preference, Payment } = require('mercadopago');
const { pool } = require('../../config/db');
const { mpClient } = require('../../config/mercadopago');
const AppError = require('../../utils/AppError');
const { toClient, toTenant } = require('../../realtime/socket');
const { sendPushToUser, sendPushToTenant } = require('../../utils/push');

// Percentual que a plataforma retém de cada pedido pago (comissão do
// restaurante). Calculado em cima do SUBTOTAL (valor dos itens/comida),
// sem contar a taxa de entrega — que normalmente não é receita do
// restaurante. Pode ajustar via COMMISSION_RATE no .env.
const COMMISSION_RATE = Number(process.env.COMMISSION_RATE || 12);

// URL pública do backend (sem a barra final), usada pro Mercado Pago saber
// pra onde mandar a notificação de pagamento (webhook) e pra onde devolver
// o usuário depois do checkout. Em produção é a URL do Railway; em dev
// local, o webhook só funciona com um túnel público (ex: ngrok), porque o
// Mercado Pago precisa conseguir alcançar essa URL pela internet.
const APP_PUBLIC_URL = (process.env.APP_PUBLIC_URL || '').replace(/\/$/, '');

// Cria a "preferência" de pagamento no Mercado Pago pra um pedido já
// existente (Checkout Pro: o cliente é redirecionado pra uma página do MP
// onde escolhe Pix, crédito ou débito, e paga sem o app nunca tocar em
// dado de cartão). Retorna a URL de checkout (init_point) pro app abrir.
async function createPaymentForOrder(clientId, orderId) {
  const orderResult = await pool.query(
    `SELECT o.id, o.subtotal, o.delivery_fee AS "deliveryFee", o.total, o.status, o.payment_status AS "paymentStatus",
            o.tenant_id AS "tenantId", r.name AS "restaurantName",
            c.name AS "clientName", c.email AS "clientEmail"
     FROM orders o
     JOIN restaurants r ON r.id = o.restaurant_id
     JOIN users c ON c.id = o.client_id
     WHERE o.id = $1 AND o.client_id = $2`,
    [orderId, clientId]
  );
  if (orderResult.rowCount === 0) throw new AppError('Pedido não encontrado', 404);
  const order = orderResult.rows[0];

  if (order.paymentStatus === 'pago') {
    throw new AppError('Este pedido já foi pago', 409);
  }
  if (order.status === 'cancelado') {
    throw new AppError('Este pedido foi cancelado', 409);
  }
  if (!APP_PUBLIC_URL) {
    throw new AppError(
      'APP_PUBLIC_URL não configurado no servidor — defina no .env a URL pública do backend para habilitar pagamentos.',
      500
    );
  }
  // Cria um pagamento Pix DIRETO na API do Mercado Pago (Checkout API/transparente),
// sem passar pela página web do Checkout Pro. Retorna o QR code (base64) e o
// código "copia e cola" pra mostrar dentro do próprio app.
// Pix no Brasil exige CPF do pagador — por isso o cliente precisa ter
// cadastrado o CPF antes (tela "Meus dados").
async function createPixPaymentForOrder(clientId, orderId) {
  const orderResult = await pool.query(
    `SELECT o.id, o.total, o.status, o.payment_status AS "paymentStatus",
            c.name AS "clientName", c.email AS "clientEmail", c.cpf AS "clientCpf"
     FROM orders o
     JOIN users c ON c.id = o.client_id
     WHERE o.id = $1 AND o.client_id = $2`,
    [orderId, clientId]
  );
  if (orderResult.rowCount === 0) throw new AppError('Pedido não encontrado', 404);
  const order = orderResult.rows[0];

  if (order.paymentStatus === 'pago') {
    throw new AppError('Este pedido já foi pago', 409);
  }
  if (order.status === 'cancelado') {
    throw new AppError('Este pedido foi cancelado', 409);
  }
  if (!order.clientCpf) {
    throw new AppError('Cadastre seu CPF em "Meus dados" para pagar com Pix', 422);
  }
  if (!APP_PUBLIC_URL) {
    throw new AppError(
      'APP_PUBLIC_URL não configurado no servidor — defina no .env a URL pública do backend para habilitar pagamentos.',
      500
    );
  }

  const [firstName, ...rest] = (order.clientName || 'Cliente').trim().split(' ');
  const lastName = rest.join(' ') || firstName;

  const payment = new Payment(mpClient);
  const result = await payment.create({
    body: {
      transaction_amount: Number(order.total),
      description: `Pedido #${order.id.slice(0, 8)}`,
      payment_method_id: 'pix',
      external_reference: order.id,
      notification_url: `${APP_PUBLIC_URL}/api/payments/webhook`,
      payer: {
        email: order.clientEmail,
        first_name: firstName,
        last_name: lastName,
        identification: {
          type: 'CPF',
          number: order.clientCpf.replace(/\D/g, ''),
        },
      },
    },
  });

  const txData = result.point_of_interaction?.transaction_data;
  if (!txData?.qr_code) {
    throw new AppError('Mercado Pago não retornou o QR code do Pix. Tente novamente.', 502);
  }

  await pool.query(`UPDATE orders SET mp_payment_id = $1 WHERE id = $2`, [String(result.id), order.id]);

  return {
    orderId: order.id,
    paymentId: result.id,
    status: result.status, // normalmente "pending" até o pagamento cair
    qrCodeBase64: txData.qr_code_base64, // já vem pronto pra <Image source={{uri:`data:image/png;base64,${qrCodeBase64}`}} />
    qrCode: txData.qr_code, // código "copia e cola"
    expiresAt: result.date_of_expiration,
  };
}

  const preference = new Preference(mpClient);
  const items = [
    {
      id: order.id,
      title: `Pedido em ${order.restaurantName}`,
      quantity: 1,
      unit_price: Number(order.total),
      currency_id: 'BRL',
    },
  ];

  const result = await preference.create({
    body: {
      items,
      external_reference: order.id,
      payer: order.clientEmail ? { email: order.clientEmail, name: order.clientName } : undefined,
      // Pix, crédito e débito ficam habilitados; boleto (ticket) fica fora
      // porque não faz sentido pra um pedido de delivery que precisa ser
      // pago na hora. installments: 1 mantém o pagamento à vista.
      payment_methods: {
        excluded_payment_types: [{ id: 'ticket' }],
        installments: 1,
      },
      back_urls: {
        success: `${APP_PUBLIC_URL}/api/payments/return?status=success`,
        pending: `${APP_PUBLIC_URL}/api/payments/return?status=pending`,
        failure: `${APP_PUBLIC_URL}/api/payments/return?status=failure`,
      },
      auto_return: 'approved',
      notification_url: `${APP_PUBLIC_URL}/api/payments/webhook`,
    },
  });

  await pool.query(`UPDATE orders SET mp_preference_id = $1 WHERE id = $2`, [result.id, order.id]);

  return {
    orderId: order.id,
    preferenceId: result.id,
    initPoint: result.init_point,
    // en sandbox (credenciais TEST-...) o Mercado Pago também devolve um
    // sandbox_init_point — mais estável pra testar com cartões de teste
    sandboxInitPoint: result.sandbox_init_point,
  };
}

// Chamado pelo webhook do Mercado Pago. Busca o pagamento direto na API do
// MP (nunca confia só no que veio na notificação) e atualiza o pedido.
async function processPaymentNotification(mpPaymentId) {
  const payment = new Payment(mpClient);
  const info = await payment.get({ id: mpPaymentId });

  const orderId = info.external_reference;
  if (!orderId) return;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const orderResult = await client.query(
      `SELECT id, tenant_id AS "tenantId", client_id AS "clientId", subtotal, payment_status AS "paymentStatus"
       FROM orders WHERE id = $1 FOR UPDATE`,
      [orderId]
    );
    if (orderResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return;
    }
    const order = orderResult.rows[0];

    // Idempotência: se esse pedido já está marcado como pago, não processa
    // de novo (o Mercado Pago pode reenviar o mesmo webhook várias vezes).
    if (order.paymentStatus === 'pago') {
      await client.query('COMMIT');
      return;
    }

    const paymentMethodMap = { pix: 'pix', credit_card: 'credit_card', debit_card: 'debit_card' };
    const paymentMethod = paymentMethodMap[info.payment_type_id] || info.payment_type_id;

    if (info.status === 'approved') {
      const commissionAmount = Number(order.subtotal) * (COMMISSION_RATE / 100);
      await client.query(
        `UPDATE orders
         SET payment_status = 'pago', payment_method = $1, mp_payment_id = $2, paid_at = now(),
             commission_rate = $3, commission_amount = $4
         WHERE id = $5`,
        [paymentMethod, String(info.id), COMMISSION_RATE, commissionAmount.toFixed(2), orderId]
      );
    } else if (info.status === 'rejected') {
      await client.query(
        `UPDATE orders SET payment_status = 'recusado', payment_method = $1, mp_payment_id = $2 WHERE id = $3`,
        [paymentMethod, String(info.id), orderId]
      );
    } else if (info.status === 'refunded' || info.status === 'charged_back') {
      await client.query(
        `UPDATE orders SET payment_status = 'estornado', mp_payment_id = $1 WHERE id = $2`,
        [String(info.id), orderId]
      );
    }
    // outros status (pending, in_process) — o Pix às vezes fica alguns
    // segundos em "pending"; o MP manda um novo webhook quando confirmar.

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  // Fora da transação: avisa cliente e restaurante em tempo real, e só
  // agora (pagamento confirmado) o restaurante fica sabendo do pedido novo.
  if (info.status === 'approved') {
    await notifyOrderPaid(orderId);
  } else if (info.status === 'rejected') {
    const clientId = await orderClientId(orderId);
    if (clientId) {
      toClient(clientId, 'order:payment', { id: orderId, paymentStatus: 'recusado' });
      sendPushToUser(clientId, {
        title: 'Pagamento recusado',
        body: 'Seu pagamento não foi aprovado. Tente novamente com outro cartão ou via Pix.',
        data: { orderId, type: 'order:payment', paymentStatus: 'recusado' },
      });
    }
  }
}

async function notifyOrderPaid(orderId) {
  const result = await pool.query(
    `SELECT o.id, o.tenant_id AS "tenantId", o.client_id AS "clientId", o.status, o.subtotal,
            o.delivery_fee AS "deliveryFee", o.total, o.pickup_code AS "pickupCode", o.created_at AS "createdAt",
            c.name AS "clientName", c.phone AS "clientPhone",
            a.street, a.number, a.complement, a.neighborhood, a.city, a.state, a.lat, a.lng
     FROM orders o
     JOIN users c ON c.id = o.client_id
     LEFT JOIN addresses a ON a.id = o.address_id
     WHERE o.id = $1`,
    [orderId]
  );
  if (result.rowCount === 0) return;
  const order = result.rows[0];

  const itemsResult = await pool.query(
    `SELECT order_id AS "orderId", id, name_snapshot AS name, price_snapshot AS price, qty, notes,
            addons_snapshot AS addons
     FROM order_items WHERE order_id = $1`,
    [orderId]
  );

  toClient(order.clientId, 'order:payment', { id: order.id, paymentStatus: 'pago' });
  sendPushToUser(order.clientId, {
    title: 'Pagamento aprovado! ✅',
    body: 'Seu pagamento foi confirmado e o pedido já foi enviado ao restaurante.',
    data: { orderId: order.id, type: 'order:payment', paymentStatus: 'pago' },
  });

  // só agora o restaurante fica sabendo do pedido — antes do pagamento
  // confirmado, ele não aparece na fila do restaurante
  const tenantOrder = { ...order, items: itemsResult.rows };
  toTenant(order.tenantId, 'order:new', tenantOrder);
  sendPushToTenant(order.tenantId, {
    title: 'Novo pedido pago! 🛎️',
    body: `${order.clientName} pagou um pedido.`,
    data: { orderId: order.id, type: 'order:new' },
  });
}

// helper pequeno só pra achar o clientId de um pedido rejeitado sem
// duplicar a query acima (usado só no caminho de "recusado")
async function orderClientId(orderId) {
  const result = await pool.query('SELECT client_id AS "clientId" FROM orders WHERE id = $1', [orderId]);
  return result.rows[0]?.clientId;
}

// --- Comissão / acertos semanais ---

// Quanto um tenant deve AGORA (pedidos já pagos, ainda não incluídos em
// nenhum acerto semanal). Usado tanto na tela do restaurante quanto no
// fechamento semanal.
async function getPendingCommission(tenantId) {
  const result = await pool.query(
    `SELECT COUNT(*)::int AS "ordersCount",
            COALESCE(SUM(subtotal), 0) AS "grossAmount",
            COALESCE(SUM(commission_amount), 0) AS "commissionAmount"
     FROM orders
     WHERE tenant_id = $1 AND payment_status = 'pago' AND settlement_id IS NULL`,
    [tenantId]
  );
  return result.rows[0];
}

async function listSettlementsByTenant(tenantId) {
  const result = await pool.query(
    `SELECT id, period_start AS "periodStart", period_end AS "periodEnd", orders_count AS "ordersCount",
            gross_amount AS "grossAmount", commission_rate AS "commissionRate",
            commission_amount AS "commissionAmount", status, paid_at AS "paidAt", created_at AS "createdAt"
     FROM settlements WHERE tenant_id = $1 ORDER BY period_start DESC`,
    [tenantId]
  );
  return result.rows;
}

// Fecha um período pra UM tenant: agrupa todo pedido pago ainda "solto"
// (sem settlement_id) num novo registro de acerto e trava o valor.
// Chamada pelo endpoint de admin, manualmente ou por uma rotina agendada
// (cron) que você configurar toda semana.
async function generateSettlementForTenant(tenantId, periodStart, periodEnd) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const pendingResult = await client.query(
      `SELECT id, subtotal, commission_amount FROM orders
       WHERE tenant_id = $1 AND payment_status = 'pago' AND settlement_id IS NULL
         AND paid_at >= $2 AND paid_at < $3
       FOR UPDATE`,
      [tenantId, periodStart, periodEnd]
    );
    if (pendingResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return null;
    }
    const orders = pendingResult.rows;
    const grossAmount = orders.reduce((s, o) => s + Number(o.subtotal), 0);
    const commissionAmount = orders.reduce((s, o) => s + Number(o.commission_amount || 0), 0);

    const settlementResult = await client.query(
      `INSERT INTO settlements (tenant_id, period_start, period_end, orders_count, gross_amount, commission_rate, commission_amount)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, period_start AS "periodStart", period_end AS "periodEnd", orders_count AS "ordersCount",
                 gross_amount AS "grossAmount", commission_rate AS "commissionRate",
                 commission_amount AS "commissionAmount", status, created_at AS "createdAt"`,
      [tenantId, periodStart, periodEnd, orders.length, grossAmount.toFixed(2), COMMISSION_RATE, commissionAmount.toFixed(2)]
    );
    const settlement = settlementResult.rows[0];

    await client.query(
      `UPDATE orders SET settlement_id = $1 WHERE id = ANY($2::uuid[])`,
      [settlement.id, orders.map((o) => o.id)]
    );

    await client.query('COMMIT');
    return settlement;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Fecha o período pra TODOS os tenants que têm pedido pago pendente de
// acerto — chamado uma vez por semana.
async function generateWeeklySettlements() {
  const tenantsResult = await pool.query(
    `SELECT DISTINCT tenant_id AS "tenantId" FROM orders WHERE payment_status = 'pago' AND settlement_id IS NULL`
  );
  const periodEnd = new Date();
  const periodStart = new Date(periodEnd.getTime() - 7 * 24 * 60 * 60 * 1000);
  const settlements = [];
  for (const { tenantId } of tenantsResult.rows) {
    const settlement = await generateSettlementForTenant(tenantId, periodStart, periodEnd);
    if (settlement) settlements.push(settlement);
  }
  return settlements;
}

async function markSettlementPaid(settlementId) {
  const result = await pool.query(
    `UPDATE settlements SET status = 'pago', paid_at = now() WHERE id = $1 AND status = 'pendente'
     RETURNING id, tenant_id AS "tenantId", status, paid_at AS "paidAt"`,
    [settlementId]
  );
  if (result.rowCount === 0) throw new AppError('Acerto não encontrado ou já estava pago', 404);
  return result.rows[0];
}

async function listAllSettlements() {
  const result = await pool.query(
    `SELECT s.id, s.tenant_id AS "tenantId", t.name AS "tenantName",
            s.period_start AS "periodStart", s.period_end AS "periodEnd", s.orders_count AS "ordersCount",
            s.gross_amount AS "grossAmount", s.commission_rate AS "commissionRate",
            s.commission_amount AS "commissionAmount", s.status, s.paid_at AS "paidAt", s.created_at AS "createdAt"
     FROM settlements s
     JOIN tenants t ON t.id = s.tenant_id
     ORDER BY s.status ASC, s.period_start DESC`
  );
  return result.rows;
}

module.exports = {
  createPaymentForOrder,
  processPaymentNotification,
  getPendingCommission,
  listSettlementsByTenant,
  generateWeeklySettlements,
  generateSettlementForTenant,
  markSettlementPaid,
  listAllSettlements,
};
