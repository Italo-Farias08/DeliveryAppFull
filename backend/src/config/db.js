const { Pool, types } = require('pg');

// Por padrão, o driver pg devolve colunas NUMERIC/DECIMAL como string
// (para não perder precisão), o que quebra .toFixed() no frontend em
// campos como rating, delivery_fee, price e total. Convertemos para
// float aqui, num lugar só, em vez de fazer Number(...) em cada query.
types.setTypeParser(1700, (val) => (val === null ? null : parseFloat(val)));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function withTenantClient(tenantId, callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.current_tenant', $1, true)", [tenantId]);
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, withTenantClient };
