var express = require('express');
var router = express.Router();
var database = require('./database');

router.get('/', async function (req, res, next) {
  try {
    const pool = await database.poolPromise;
    const result = await pool.request().query(`
      SELECT
        (SELECT COUNT(*) FROM dbo.CUENTA_BANCARIA WHERE estado = 'Activa') AS cuentasActivas,
        (SELECT COUNT(*) FROM dbo.CUENTA_BANCARIA WHERE estado = 'Inactiva') AS cuentasInactivas,
        (SELECT MAX(fecha_creacion) FROM dbo.CUENTA_BANCARIA) AS ultimaAlta;
    `);

    const indicadores = result.recordset[0] || {};
    const cuentasActivas = Number(indicadores.cuentasActivas || 0);
    const cuentasInactivas = Number(indicadores.cuentasInactivas || 0);
    const ultimaAlta = indicadores.ultimaAlta ? new Date(indicadores.ultimaAlta) : null;

    const formatearEntero = valor =>
      new Intl.NumberFormat('es-CR', { maximumFractionDigits: 0 }).format(valor);
    const formatearFecha = fecha =>
      new Intl.DateTimeFormat('es-CR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'America/Costa_Rica'
      }).format(fecha);
    const formatearHora = fecha =>
      new Intl.DateTimeFormat('es-CR', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: 'America/Costa_Rica'
      }).format(fecha);

    res.render('cuentas', {
      title: 'Cuentas',
      cuentasActivas: formatearEntero(cuentasActivas),
      cuentasInactivas: formatearEntero(cuentasInactivas),
      ultimaAltaFecha: ultimaAlta ? formatearFecha(ultimaAlta) : 'N/D',
      ultimaAltaHora: ultimaAlta ? formatearHora(ultimaAlta) : 'Sin registros'
    });
  } catch (error) {
    next(error);
  }
});

router.get('/transaccionescuenta', function (req, res, next) {
  res.render('transaccionescuenta', { title: 'Transacciones Cuenta' });
});

module.exports = router;
