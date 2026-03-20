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
        (SELECT COUNT(*) FROM dbo.CUENTA_BANCARIA WHERE estado = 'Activa') AS cuentasActivas,
        (SELECT COUNT(*) FROM dbo.CUENTA_BANCARIA WHERE estado = 'Inactiva') AS cuentasInactivas,
        (SELECT MAX(fecha_creacion) FROM dbo.CUENTA_BANCARIA) AS ultimaAlta;
    `);

    const cuentasResult = await pool.request().query(`
      SELECT
        cb.iban,
        cb.alias_cuenta,
        cb.moneda,
        cb.saldo_actual,
        cb.fecha_creacion,
        cb.estado,
        c.nombre_completo
      FROM dbo.CUENTA_BANCARIA cb
      INNER JOIN dbo.CLIENTE c
        ON c.identificador_cliente = cb.identificador_cliente
      ORDER BY cb.fecha_creacion DESC, cb.iban ASC;
    `);

    const indicadores = indicadoresResult.recordset[0] || {};
    const ultimaAlta = indicadores.ultimaAlta ? new Date(indicadores.ultimaAlta) : null;

    const cuentasLista = (cuentasResult.recordset || []).map(cuenta => ({
      iban: formatearIBAN(cuenta.iban),
      aliasCuenta: cuenta.alias_cuenta,
      moneda: cuenta.moneda,
      saldoActual: formatearMonto(cuenta.saldo_actual, cuenta.moneda),
      clienteNombre: cuenta.nombre_completo,
      creadaTexto: cuenta.fecha_creacion ? formatearFecha(new Date(cuenta.fecha_creacion), false) : 'N/D',
      estado: cuenta.estado,
      estadoClase: cuenta.estado === 'Activa' ? 'estado-libre' : 'estado-reservada',
      ibanRaw: cuenta.iban,
      ibanUrl: encodeURIComponent(cuenta.iban)
    }));

    res.render('cuentas', {
      title: 'Cuentas',
      cuentasActivas: formatearEntero(indicadores.cuentasActivas),
      cuentasInactivas: formatearEntero(indicadores.cuentasInactivas),
      ultimaAltaFecha: ultimaAlta ? formatearFecha(ultimaAlta, false) : 'N/D',
      ultimaAltaHora: ultimaAlta ? formatearHora(ultimaAlta) : 'Sin registros',
      cuentasLista
    });
  } catch (error) {
    next(error);
  }
});

router.get('/transaccionescuenta', async function (req, res, next) {
  try {
    const pool = await database.poolPromise;
    let iban = String(req.query.iban || '').trim();

    if (!iban) {
      const cuentaPorDefectoResult = await pool.request().query(`
        SELECT TOP 1 iban
        FROM dbo.CUENTA_BANCARIA
        ORDER BY fecha_creacion DESC, iban ASC;
      `);

      iban = (cuentaPorDefectoResult.recordset[0] || {}).iban || '';
    }

    if (!iban) {
      return res.render('transaccionescuenta', {
        title: 'Transacciones Cuenta',
        cuentaIban: 'N/D',
        cuentaAlias: 'N/D',
        clienteNombre: 'N/D',
        clienteEstado: 'N/D',
        saldoActual: '₡ 0',
        monedaCuenta: 'N/D',
        transaccionesCuenta: []
      });
    }

    const cuentaResult = await pool
      .request()
      .input('iban', database.sql.VarChar(34), iban)
      .query(`
        SELECT TOP 1
          cb.iban,
          cb.alias_cuenta,
          cb.moneda,
          cb.saldo_actual,
          c.nombre_completo,
          c.estado AS estado_cliente
        FROM dbo.CUENTA_BANCARIA cb
        INNER JOIN dbo.CLIENTE c
          ON c.identificador_cliente = cb.identificador_cliente
        WHERE cb.iban = @iban;
      `);

    const cuenta = cuentaResult.recordset[0] || null;

    if (!cuenta) {
      return res.render('transaccionescuenta', {
        title: 'Transacciones Cuenta',
        cuentaIban: 'N/D',
        cuentaAlias: 'N/D',
        clienteNombre: 'N/D',
        clienteEstado: 'N/D',
        saldoActual: '₡ 0',
        monedaCuenta: 'N/D',
        transaccionesCuenta: []
      });
    }

    const transaccionesResult = await pool
      .request()
      .input('iban', database.sql.VarChar(34), cuenta.iban)
      .query(`
        SELECT
          t.codigo_transaccion,
          t.fecha_transaccion,
          t.tipo_transaccion,
          t.descripcion,
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
        WHERE t.iban = @iban
        ORDER BY t.fecha_transaccion DESC, t.codigo_transaccion DESC;
      `);

    const transaccionesCuenta = (transaccionesResult.recordset || []).map(transaccion => ({
      id: transaccion.codigo_transaccion,
      fecha: transaccion.fecha_transaccion ? formatearFecha(new Date(transaccion.fecha_transaccion), false) : 'N/D',
      tipo: formatearTipoTransaccion(transaccion.tipo_transaccion),
      descripcion: transaccion.descripcion,
      monto: formatearMonto(transaccion.monto, transaccion.moneda),
      moneda: transaccion.moneda,
      tipoCambio: formatearTipoCambio(transaccion.moneda, transaccion.tipo_cambio_compra, transaccion.tipo_cambio_venta),
      saldoFinal: formatearMonto(transaccion.saldo_final, transaccion.moneda),
      referencia: formatearReferencia(transaccion.codigo_referencia, transaccion.codigo_comision_relacionada)
    }));

    res.render('transaccionescuenta', {
      title: 'Transacciones Cuenta',
      cuentaIban: formatearIBAN(cuenta.iban),
      cuentaAlias: cuenta.alias_cuenta,
      clienteNombre: cuenta.nombre_completo,
      clienteEstado: cuenta.estado_cliente,
      saldoActual: formatearMonto(cuenta.saldo_actual, cuenta.moneda),
      monedaCuenta: cuenta.moneda,
      transaccionesCuenta
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

