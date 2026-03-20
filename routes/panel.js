var express = require('express');
var router = express.Router();
var database = require('./database');

router.get('/', async function (req, res, next) {
  try {
    const pool = await database.poolPromise;
    const result = await pool.request().query(`
      DECLARE @tipoCambioCompra DECIMAL(12,4) = 0;
      DECLARE @tipoCambioVenta DECIMAL(12,4) = 0;
      DECLARE @fechaTipoCambio DATETIME2(0) = NULL;

      SELECT TOP 1
        @tipoCambioCompra = tipo_cambio_compra,
        @tipoCambioVenta = tipo_cambio_venta,
        @fechaTipoCambio = fecha_modificacion
      FROM dbo.TIPO_CAMBIO
      WHERE activo = 1
        AND moneda_origen = 'USD'
        AND moneda_destino = 'CRC'
      ORDER BY fecha_modificacion DESC, id_tipo_cambio DESC;

      SELECT
        (SELECT COUNT(*) FROM dbo.CLIENTE) AS clientesRegistrados,
        (SELECT COUNT(*) FROM dbo.CLIENTE WHERE estado = 'Inactivo') AS clientesInactivos,
        (SELECT COUNT(*) FROM dbo.CUENTA_BANCARIA WHERE estado = 'Activa') AS cuentasActivas,
        (SELECT COUNT(*) FROM dbo.CUENTA_BANCARIA) AS cuentasTotales,
        (SELECT COUNT(*) FROM dbo.TRANSACCION WHERE CAST(fecha_transaccion AS DATE) = CAST(SYSDATETIME() AS DATE)) AS movimientosHoy,
        (
          SELECT COALESCE(
            SUM(
              CASE
                WHEN cb.moneda = 'CRC' THEN cb.saldo_actual
                WHEN cb.moneda = 'USD' THEN cb.saldo_actual * @tipoCambioCompra
                ELSE 0
              END
            ), 0
          )
          FROM dbo.CUENTA_BANCARIA cb
          WHERE cb.estado = 'Activa'
        ) AS saldoGlobalCRC,
        @tipoCambioCompra AS tipoCambioCompra,
        @tipoCambioVenta AS tipoCambioVenta,
        @fechaTipoCambio AS fechaTipoCambio;
    `);

    const indicadores = result.recordset[0] || {};
    const clientesRegistrados = Number(indicadores.clientesRegistrados || 0);
    const clientesInactivos = Number(indicadores.clientesInactivos || 0);
    const cuentasActivas = Number(indicadores.cuentasActivas || 0);
    const cuentasTotales = Number(indicadores.cuentasTotales || 0);
    const movimientosHoy = Number(indicadores.movimientosHoy || 0);
    const saldoGlobalCRC = Number(indicadores.saldoGlobalCRC || 0);
    const tipoCambioCompra = Number(indicadores.tipoCambioCompra || 0);
    const tipoCambioVenta = Number(indicadores.tipoCambioVenta || 0);
    const fechaTipoCambio = indicadores.fechaTipoCambio ? new Date(indicadores.fechaTipoCambio) : null;

    const formatearEntero = valor =>
      new Intl.NumberFormat('es-CR', { maximumFractionDigits: 0 }).format(valor);
    const formatearMontoCRC = valor =>
      new Intl.NumberFormat('es-CR', {
        style: 'currency',
        currency: 'CRC',
        minimumFractionDigits: 2,
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

    const porcentajeCuentasActivas =
      cuentasTotales > 0 ? ((cuentasActivas / cuentasTotales) * 100).toFixed(1) : '0.0';

    res.render('panel', {
      title: 'Panel',
      clientesRegistrados: formatearEntero(clientesRegistrados),
      clientesInactivosTexto: `${formatearEntero(clientesInactivos)} inactivos`,
      cuentasActivas: formatearEntero(cuentasActivas),
      cuentasActivasPorcentajeTexto: `${porcentajeCuentasActivas} % activas`,
      saldoGlobalCRC: formatearMontoCRC(saldoGlobalCRC),
      movimientosHoy: formatearEntero(movimientosHoy),
      tipoCambioTexto:
        tipoCambioCompra > 0 || tipoCambioVenta > 0
          ? `CRC ${formatearTipoCambio(tipoCambioCompra)} / CRC ${formatearTipoCambio(tipoCambioVenta)}`
          : 'No disponible',
      tipoCambioActualizadoTexto: fechaTipoCambio
        ? `Actualizado: ${formatearFecha(fechaTipoCambio)}`
        : 'Actualizado: N/D'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
