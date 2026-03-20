var express = require('express');
var router = express.Router();
var database = require('./database');

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
  if (moneda !== 'USD') {
    return '—';
  }

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
    const transaccionesResult = await pool.request().query(`
      SELECT TOP 100
        t.codigo_transaccion,
        t.iban,
        t.tipo_transaccion,
        t.descripcion,
        t.fecha_transaccion,
        t.monto,
        t.moneda,
        t.tipo_cambio_compra,
        t.tipo_cambio_venta,
        t.saldo_final,
        t.codigo_referencia,
        c.nombre_completo,
        tc.codigo_transaccion AS codigo_comision_relacionada
      FROM dbo.TRANSACCION t
      INNER JOIN dbo.CLIENTE c
        ON c.identificador_cliente = t.identificador_cliente
      LEFT JOIN dbo.TRANSACCION tc
        ON tc.codigo_referencia = t.codigo_transaccion
       AND tc.tipo_transaccion = 'Comision'
      ORDER BY t.fecha_transaccion DESC, t.codigo_transaccion DESC;
    `);

    const transaccionesLista = (transaccionesResult.recordset || []).map(transaccion => ({
      id: transaccion.codigo_transaccion,
      cuenta: formatearIBAN(transaccion.iban),
      cliente: transaccion.nombre_completo,
      tipo: formatearTipoTransaccion(transaccion.tipo_transaccion),
      descripcion: transaccion.descripcion,
      fecha: transaccion.fecha_transaccion ? formatearFecha(new Date(transaccion.fecha_transaccion)) : 'N/D',
      monto: formatearMonto(transaccion.monto, transaccion.moneda),
      moneda: transaccion.moneda,
      tipoCambio: formatearTipoCambio(transaccion.moneda, transaccion.tipo_cambio_compra, transaccion.tipo_cambio_venta),
      saldoFinal: formatearMonto(transaccion.saldo_final, transaccion.moneda),
      referencia: formatearReferencia(transaccion.codigo_referencia, transaccion.codigo_comision_relacionada)
    }));

    res.render('transacciones', {
      title: 'Transacciones',
      transaccionesLista
    });
  } catch (error) {
    next(error);
  }
});

router.get('/deposito', function (req, res, next) {
  res.render('deposito', { title: 'Depósito' });
});

router.get('/retiro', function (req, res, next) {
  res.render('retiro', { title: 'Retiro' });
});

module.exports = router;

