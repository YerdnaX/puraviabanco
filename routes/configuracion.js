var express = require('express');
var router = express.Router();
var database = require('./database');

router.get('/', async function (req, res, next) {
  try {
    const pool = await database.poolPromise;
    const tipoCambioResult = await pool.request().query(`
      SELECT TOP 1
        tipo_cambio_compra,
        tipo_cambio_venta,
        fecha_modificacion
      FROM dbo.TIPO_CAMBIO
      WHERE activo = 1
        AND moneda_origen = 'USD'
        AND moneda_destino = 'CRC'
      ORDER BY fecha_modificacion DESC, id_tipo_cambio DESC;
    `);

    const rangosComisionResult = await pool.request().query(`
      SELECT
        id_rango_comision,
        monto_minimo,
        monto_maximo,
        porcentaje_comision
      FROM dbo.RANGO_COMISION_RETIRO
      WHERE activo = 1
      ORDER BY monto_minimo ASC, id_rango_comision ASC;
    `);

    const tipoCambio = tipoCambioResult.recordset[0] || {};
    const tipoCambioCompra = Number(tipoCambio.tipo_cambio_compra || 0);
    const tipoCambioVenta = Number(tipoCambio.tipo_cambio_venta || 0);
    const fechaTipoCambio = tipoCambio.fecha_modificacion ? new Date(tipoCambio.fecha_modificacion) : null;

    const formatearMontoCRC = valor =>
      new Intl.NumberFormat('es-CR', {
        maximumFractionDigits: 0
      }).format(valor);
    const formatearPorcentaje = valor =>
      new Intl.NumberFormat('es-CR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
      }).format(valor);
    const formatearTipoCambio = valor =>
      new Intl.NumberFormat('es-CR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 4
      }).format(valor);
    const formatearFecha = fecha =>
      new Intl.DateTimeFormat('es-CR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'America/Costa_Rica'
      }).format(fecha);

    const rangosComision = (rangosComisionResult.recordset || []).map((rango, index) => ({
      nombre: `Rango ${index + 1}`,
      montoTexto: `CRC ${formatearMontoCRC(Number(rango.monto_minimo || 0))} - CRC ${formatearMontoCRC(Number(rango.monto_maximo || 0))}`,
      porcentajeTexto: `${formatearPorcentaje(Number(rango.porcentaje_comision || 0))} %`
    }));

    res.render('configuracion', {
      title: 'Configuración',
      tipoCambioTexto:
        tipoCambioCompra > 0 || tipoCambioVenta > 0
          ? `CRC ${formatearTipoCambio(tipoCambioCompra)} / CRC ${formatearTipoCambio(tipoCambioVenta)}`
          : 'No disponible',
      tipoCambioActualizadoTexto: fechaTipoCambio
        ? `Actualizado: ${formatearFecha(fechaTipoCambio)}`
        : 'Actualizado: N/D',
      rangosComision
    });
  } catch (error) {
    next(error);
  }
});

router.get('/rangoscomision', function (req, res, next) {
  res.render('rangoscomision', { title: 'Rangos Comisión' });
});

router.get('/tipodecampo', function (req, res, next) {
  res.render('tipodecampo', { title: 'Tipo de Cambio' });
});

module.exports = router;
