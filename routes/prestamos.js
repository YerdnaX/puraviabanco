var express = require('express');
var router = express.Router();
var database = require('./database');

function formatearEntero(valor) {
  return new Intl.NumberFormat('es-CR', { maximumFractionDigits: 0 }).format(Number(valor || 0));
}

function formatearMontoCRC(valor) {
  return 'CRC ' + new Intl.NumberFormat('es-CR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(Number(valor || 0));
}

function formatearFecha(fecha) {
  if (!fecha) {
    return 'N/D';
  }

  return new Intl.DateTimeFormat('es-CR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'America/Costa_Rica'
  }).format(fecha);
}

function formatearHora(fecha) {
  if (!fecha) {
    return 'Sin registros';
  }

  return new Intl.DateTimeFormat('es-CR', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'America/Costa_Rica'
  }).format(fecha);
}

router.get('/', async function (req, res, next) {
  try {
    const pool = await database.poolPromise;

    const indicadoresResult = await pool.request().query(`
      SELECT
        (SELECT COUNT(*) FROM dbo.CLIENTE WHERE estado = 'Activo') AS clientesActivos,
        (SELECT COUNT(*) FROM dbo.SOLICITUD_PRESTAMO) AS prestamosSolicitados,
        (SELECT SUM(monto_prestamo) FROM dbo.SOLICITUD_PRESTAMO) AS montoTotalPrestado,
        (SELECT MAX(fecha_solicitud) FROM dbo.SOLICITUD_PRESTAMO) AS ultimaSolicitud;
    `);

    const solicitudesResult = await pool.request().query(`
      SELECT numero_solicitud, identificador_cliente, nombre_completo, monto_prestamo, plazo_meses, cuota_mensual, fecha_solicitud, estado
      FROM dbo.V_SOLICITUD_PRESTAMO_CLIENTE
      ORDER BY fecha_solicitud DESC, numero_solicitud DESC;
    `);

    const indicadores = indicadoresResult.recordset[0] || {};
    const solicitudesPrestamoLista = (solicitudesResult.recordset || []).map(solicitud => ({
      numeroSolicitud: solicitud.numero_solicitud,
      identificadorCliente: solicitud.identificador_cliente,
      nombreCliente: solicitud.nombre_completo,
      montoPrestamo: formatearMontoCRC(solicitud.monto_prestamo),
      plazoMeses: String(solicitud.plazo_meses || 0) + ' meses',
      cuotaMensual: formatearMontoCRC(solicitud.cuota_mensual),
      fechaSolicitud: solicitud.fecha_solicitud ? formatearFecha(new Date(solicitud.fecha_solicitud)) : 'N/D',
      estado: solicitud.estado,
      estadoClase: solicitud.estado === 'Aprobada' ? 'estado-libre' : 'estado-reservada'
    }));

    const ultimaSolicitud = indicadores.ultimaSolicitud ? new Date(indicadores.ultimaSolicitud) : null;

    res.render('prestamos', {
      title: 'Prestamos',
      clientesActivos: formatearEntero(indicadores.clientesActivos),
      prestamosSolicitados: formatearEntero(indicadores.prestamosSolicitados),
      montoTotalPrestado: formatearMontoCRC(indicadores.montoTotalPrestado),
      ultimaSolicitudHora: formatearHora(ultimaSolicitud),
      solicitudesPrestamoLista
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

