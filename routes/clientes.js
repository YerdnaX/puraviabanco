var express = require('express');
var router = express.Router();
var database = require('./database');

function formatearEntero(valor) {
  return new Intl.NumberFormat('es-CR', { maximumFractionDigits: 0 }).format(Number(valor || 0));
}

function formatearFecha(fecha, anioCorto) {
  if (!fecha) {
    return 'N/D';
  }

  return new Intl.DateTimeFormat('es-CR', {
    day: '2-digit',
    month: '2-digit',
    year: anioCorto ? '2-digit' : 'numeric',
    timeZone: 'America/Costa_Rica'
  }).format(fecha);
}

function formatearFechaSoloDia(fecha) {
  if (!fecha) {
    return 'N/D';
  }

  return new Intl.DateTimeFormat('es-CR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC'
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

function formatearMonto(valor, moneda) {
  var simbolo = moneda === 'USD' ? '$' : '₡';

  return simbolo + ' ' + new Intl.NumberFormat('es-CR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(Number(valor || 0));
}

function formatearIBAN(iban) {
  return String(iban || '').replace(/(.{4})/g, '$1 ').trim();
}

function formatearTipoTransaccion(tipo) {
  if (tipo === 'Deposito') {
    return 'Depósito';
  }

  if (tipo === 'Comision') {
    return 'Comisión';
  }

  return tipo || 'N/D';
}

function formatearTipoCambio(moneda, tipoCompra, tipoVenta) {
  var compra = Number(tipoCompra || 0);
  var venta = Number(tipoVenta || 0);

  if (!compra && !venta) {
    return '—';
  }

  var formato = new Intl.NumberFormat('es-CR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4
  });

  return 'Compra ' + formato.format(compra) + ' / Venta ' + formato.format(venta);
}

function formatearReferencia(codigoReferencia, codigoComisionRelacionada) {
  if (codigoReferencia) {
    return 'Ref ' + codigoReferencia;
  }

  if (codigoComisionRelacionada) {
    return codigoComisionRelacionada;
  }

  return '—';
}

router.get('/', async function (req, res, next) {
  try {
    const pool = await database.poolPromise;
    const indicadoresResult = await pool.request().query(`
      SELECT
        (SELECT COUNT(*) FROM dbo.CLIENTE WHERE estado = 'Activo') AS clientesActivos,
        (SELECT COUNT(*) FROM dbo.CLIENTE WHERE estado = 'Inactivo') AS clientesInactivos,
        (SELECT MAX(fecha_creacion) FROM dbo.CLIENTE) AS ultimaAlta;
    `);
    const clientesResult = await pool.request().query(`
      SELECT
        identificador_cliente,
        nombre_completo,
        correo_electronico,
        telefono,
        fecha_nacimiento,
        ocupacion,
        direccion,
        fecha_creacion,
        estado
      FROM dbo.CLIENTE
      ORDER BY fecha_creacion DESC, identificador_cliente ASC;
    `);

    const indicadores = indicadoresResult.recordset[0] || {};
    const ultimaAlta = indicadores.ultimaAlta ? new Date(indicadores.ultimaAlta) : null;

    const clientesLista = (clientesResult.recordset || []).map(cliente => ({
      identificadorCliente: cliente.identificador_cliente,
      identificadorClienteUrl: encodeURIComponent(cliente.identificador_cliente),
      nombreCompleto: cliente.nombre_completo,
      correoElectronico: cliente.correo_electronico,
      telefono: cliente.telefono,
      fechaNacimientoTexto: cliente.fecha_nacimiento ? formatearFechaSoloDia(new Date(cliente.fecha_nacimiento)) : 'N/D',
      ocupacion: cliente.ocupacion,
      direccion: cliente.direccion,
      creadoTexto: cliente.fecha_creacion ? formatearFecha(new Date(cliente.fecha_creacion), true) : 'N/D',
      estado: cliente.estado,
      estadoClase: cliente.estado === 'Activo' ? 'estado-libre' : 'estado-reservada'
    }));

    res.render('clientes', {
      title: 'Clientes',
      clientesActivos: formatearEntero(indicadores.clientesActivos),
      clientesInactivos: formatearEntero(indicadores.clientesInactivos),
      ultimaAltaFecha: ultimaAlta ? formatearFecha(ultimaAlta, false) : 'N/D',
      ultimaAltaHora: ultimaAlta ? formatearHora(ultimaAlta) : 'Sin registros',
      clientesLista
    });
  } catch (error) {
    next(error);
  }
});

router.get('/transaccionescliente', async function (req, res, next) {
  try {
    const pool = await database.poolPromise;
    let identificadorCliente = String(req.query.id || '').trim();

    if (!identificadorCliente) {
      const clientePorDefectoResult = await pool.request().query(`
        SELECT TOP 1 identificador_cliente
        FROM dbo.CLIENTE
        ORDER BY fecha_creacion DESC, identificador_cliente ASC;
      `);

      identificadorCliente = (clientePorDefectoResult.recordset[0] || {}).identificador_cliente || '';
    }

    if (!identificadorCliente) {
      return res.render('transaccionescliente', {
        title: 'Perfil Cliente',
        clienteNombre: 'N/D',
        clienteId: 'N/D',
        cuentasActivas: '0',
        monedasActivasTexto: 'N/D',
        saldoAgregadoTexto: '₡ 0',
        transaccionesCliente: [],
        solicitudesPrestamo: [],
        cuotasPrestamo: []
      });
    }

    const clienteResult = await pool
      .request()
      .input('identificadorCliente', database.sql.VarChar(20), identificadorCliente)
      .query(`
        SELECT TOP 1
          identificador_cliente,
          nombre_completo
        FROM dbo.CLIENTE
        WHERE identificador_cliente = @identificadorCliente;
      `);

    const cliente = clienteResult.recordset[0] || null;

    if (!cliente) {
      return res.render('transaccionescliente', {
        title: 'Perfil Cliente',
        clienteNombre: 'N/D',
        clienteId: 'N/D',
        cuentasActivas: '0',
        monedasActivasTexto: 'N/D',
        saldoAgregadoTexto: '₡ 0',
        transaccionesCliente: [],
        solicitudesPrestamo: [],
        cuotasPrestamo: []
      });
    }

    const tipoCambioResult = await pool.request().query(`
      SELECT TOP 1 tipo_cambio_compra
      FROM dbo.TIPO_CAMBIO
      WHERE activo = 1
        AND moneda_origen = 'USD'
        AND moneda_destino = 'CRC'
      ORDER BY fecha_modificacion DESC, id_tipo_cambio DESC;
    `);

    const tipoCambioCompra = Number((tipoCambioResult.recordset[0] || {}).tipo_cambio_compra || 0);

    const cuentasClienteResult = await pool
      .request()
      .input('identificadorCliente', database.sql.VarChar(20), cliente.identificador_cliente)
      .query(`
        SELECT
          moneda,
          saldo_actual,
          estado
        FROM dbo.CUENTA_BANCARIA
        WHERE identificador_cliente = @identificadorCliente;
      `);

    const cuentasActivasRows = (cuentasClienteResult.recordset || []).filter(cuenta => cuenta.estado === 'Activa');
    const monedasActivas = [...new Set(cuentasActivasRows.map(cuenta => cuenta.moneda).filter(Boolean))];

    const saldoAgregadoCRC = cuentasActivasRows.reduce((total, cuenta) => {
      const saldo = Number(cuenta.saldo_actual || 0);

      if (cuenta.moneda === 'USD') {
        return total + saldo * tipoCambioCompra;
      }

      return total + saldo;
    }, 0);

    const transaccionesResult = await pool
      .request()
      .input('identificadorCliente', database.sql.VarChar(20), cliente.identificador_cliente)
      .query(`
        SELECT
          t.codigo_transaccion,
          t.fecha_transaccion,
          t.tipo_transaccion,
          t.descripcion,
          t.iban,
          t.monto,
          t.moneda,
          t.tipo_cambio_compra,
          t.tipo_cambio_venta,
          t.saldo_final,
          t.codigo_referencia,
          tc.codigo_transaccion AS codigo_comision_relacionada
        FROM dbo.TRANSACCION t
        LEFT JOIN dbo.TRANSACCION tc
          ON tc.codigo_referencia = t.codigo_transaccion
         AND tc.tipo_transaccion = 'Comision'
        WHERE t.identificador_cliente = @identificadorCliente
        ORDER BY t.fecha_transaccion DESC, t.codigo_transaccion DESC;
      `);

    const solicitudesPrestamoResult = await pool
      .request()
      .input('identificadorCliente', database.sql.VarChar(20), cliente.identificador_cliente)
      .query(`
        SELECT
          numero_solicitud,
          fecha_solicitud,
          monto_prestamo,
          plazo_meses,
          cuota_mensual,
          estado
        FROM dbo.V_SOLICITUD_PRESTAMO_CLIENTE
        WHERE identificador_cliente = @identificadorCliente
        ORDER BY fecha_solicitud DESC, numero_solicitud DESC;
      `);

    const cuotasPrestamoResult = await pool
      .request()
      .input('identificadorCliente', database.sql.VarChar(20), cliente.identificador_cliente)
      .query(`
        SELECT
          numero_solicitud,
          numero_cuota,
          fecha_cuota,
          monto_cuota,
          saldo_estimado
        FROM dbo.V_DESGLOSE_CUOTAS_PRESTAMO
        WHERE identificador_cliente = @identificadorCliente
        ORDER BY numero_solicitud DESC, numero_cuota ASC;
      `);

    const transaccionesCliente = (transaccionesResult.recordset || []).map(transaccion => ({
      id: transaccion.codigo_transaccion,
      fecha: transaccion.fecha_transaccion ? formatearFecha(new Date(transaccion.fecha_transaccion), false) : 'N/D',
      tipo: formatearTipoTransaccion(transaccion.tipo_transaccion),
      descripcion: transaccion.descripcion,
      cuenta: formatearIBAN(transaccion.iban),
      monto: formatearMonto(transaccion.monto, transaccion.moneda),
      moneda: transaccion.moneda,
      tipoCambio: formatearTipoCambio(transaccion.moneda, transaccion.tipo_cambio_compra, transaccion.tipo_cambio_venta),
      saldoFinal: formatearMonto(transaccion.saldo_final, transaccion.moneda),
      referencia: formatearReferencia(transaccion.codigo_referencia, transaccion.codigo_comision_relacionada)
    }));

    const solicitudesPrestamo = (solicitudesPrestamoResult.recordset || []).map(solicitud => ({
      numeroSolicitud: solicitud.numero_solicitud,
      fechaSolicitud: solicitud.fecha_solicitud ? formatearFecha(new Date(solicitud.fecha_solicitud), false) : 'N/D',
      montoPrestamo: formatearMonto(solicitud.monto_prestamo, 'CRC'),
      plazoMeses: String(solicitud.plazo_meses || '0') + ' meses',
      cuotaMensual: formatearMonto(solicitud.cuota_mensual, 'CRC'),
      estado: solicitud.estado
    }));

    const cuotasPrestamo = (cuotasPrestamoResult.recordset || []).map(cuota => ({
      numeroSolicitud: cuota.numero_solicitud,
      numeroCuota: cuota.numero_cuota,
      fechaCuota: cuota.fecha_cuota ? formatearFechaSoloDia(new Date(cuota.fecha_cuota)) : 'N/D',
      montoCuota: formatearMonto(cuota.monto_cuota, 'CRC'),
      saldoEstimado: formatearMonto(cuota.saldo_estimado, 'CRC')
    }));

    res.render('transaccionescliente', {
      title: 'Perfil Cliente',
      clienteNombre: cliente.nombre_completo,
      clienteId: cliente.identificador_cliente,
      cuentasActivas: formatearEntero(cuentasActivasRows.length),
      monedasActivasTexto: monedasActivas.length ? monedasActivas.join('  ') : 'N/D',
      saldoAgregadoTexto: formatearMonto(saldoAgregadoCRC, 'CRC'),
      transaccionesCliente,
      solicitudesPrestamo,
      cuotasPrestamo
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
