var express = require('express');
var router = express.Router();
var database = require('./database');

router.get('/', async function (req, res, next) {
  try {
    const pool = await database.poolPromise;
    const result = await pool.request().query(`
      SELECT
        (SELECT COUNT(*) FROM dbo.CLIENTE WHERE estado = 'Activo') AS clientesActivos,
        (SELECT COUNT(*) FROM dbo.CUENTA_BANCARIA WHERE estado = 'Activa') AS cuentasAbiertas,
        (SELECT COUNT(*) FROM dbo.TRANSACCION WHERE CAST(fecha_transaccion AS DATE) = CAST(SYSDATETIME() AS DATE)) AS transaccionesDelDia;
    `);

    const indicadores = result.recordset[0] || {};

    res.render('index', {
      title: 'Inicio',
      clientesActivos: indicadores.clientesActivos ?? 0,
      cuentasAbiertas: indicadores.cuentasAbiertas ?? 0,
      transaccionesDelDia: indicadores.transaccionesDelDia ?? 0
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
