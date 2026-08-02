const { Router } = require('express');
const { pool } = require('../../config/db');
const asyncHandler = require('../../utils/asyncHandler');

const router = Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const result = await pool.query('SELECT id, name, icon FROM categories ORDER BY name');
    res.json(result.rows);
  })
);

module.exports = router;
