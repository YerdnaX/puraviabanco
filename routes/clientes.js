var express = require('express');
var router = express.Router();
var database = require('./database');

router.get('/', async function (req, res, next) {
  try {
    const pool = await database.poolPromise;
    const result = await pool.request().query(`
      SELECT
        (SELECT COUNT(*) FROM dbo.CLIENTE WHERE estado = 'Activo') AS clientesActivos,
        (SELECT COUNT(*) FROM dbo.CLIENTE WHERE estado = 'Inactivo') AS clientesInactivos,
        (SELECT MAX(fecha_creacion) FROM dbo.CLIENTE) AS ultimaAlta;
    `);

    const indicadores = result.recordset[0] || {};
    const clientesActivos = Number(indicadores.clientesActivos || 0);
    const clientesInactivos = Number(indicadores.clientesInactivos || 0);
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

    res.render('clientes', {
      title: 'Clientes',
      clientesActivos: formatearEntero(clientesActivos),
      clientesInactivos: formatearEntero(clientesInactivos),
      ultimaAltaFecha: ultimaAlta ? formatearFecha(ultimaAlta) : 'N/D',
      ultimaAltaHora: ultimaAlta ? formatearHora(ultimaAlta) : 'Sin registros'
    });
  } catch (error) {
    next(error);
  }
});

router.get('/transaccionescliente', function (req, res, next) {
  res.render('transaccionescliente', { title: 'Transacciones Cliente' });
});

module.exports = router;
