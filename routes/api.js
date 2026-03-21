var express = require('express');
var router = express.Router();
var database = require('./database');

function normalizarTexto(valor) {
  return String(valor || '').trim();
}

function normalizarEstado(valor) {
  return valor === 'Inactivo' ? 'Inactivo' : 'Activo';
}

function normalizarEstadoCuenta(valor) {
  return valor === 'Inactiva' ? 'Inactiva' : 'Activa';
}

function normalizarMoneda(valor) {
  return valor === 'USD' ? 'USD' : 'CRC';
}

function redondearDosDecimales(valor) {
  return Math.round((Number(valor) + Number.EPSILON) * 100) / 100;
}

function normalizarIBAN(valor) {
  return normalizarTexto(valor).toUpperCase().replace(/\s+/g, '');
}

router.post('/configuracion/tipo-cambio', async function (req, res) {
  try {
    const pool = await database.poolPromise;
    const compraTexto = normalizarTexto(req.body.compra);
    const ventaTexto = normalizarTexto(req.body.venta);
    const registradoPor = normalizarTexto(req.body.registradoPor);

    if (!compraTexto || !ventaTexto || !registradoPor) {
      return res.status(400).json({
        ok: false,
        reason: 'INVALID_INPUT',
        message: 'Compra, venta y registrado por son obligatorios.'
      });
    }

    const compra = Number(compraTexto);
    const venta = Number(ventaTexto);

    if (!Number.isFinite(compra) || compra <= 0 || !Number.isFinite(venta) || venta <= 0) {
      return res.status(400).json({
        ok: false,
        reason: 'INVALID_EXCHANGE_RATE',
        message: 'Los tipos de cambio deben ser numéricos y mayores a cero.'
      });
    }

    const tx = new database.sql.Transaction(pool);
    await tx.begin();

    try {
      const desactivarRequest = new database.sql.Request(tx);
      await desactivarRequest.query(`
        UPDATE dbo.TIPO_CAMBIO
        SET activo = 0
        WHERE activo = 1
          AND moneda_origen = 'USD'
          AND moneda_destino = 'CRC';
      `);

      const insertarRequest = new database.sql.Request(tx);
      await insertarRequest
        .input('compra', database.sql.Decimal(12, 4), compra)
        .input('venta', database.sql.Decimal(12, 4), venta)
        .input('registradoPor', database.sql.NVarChar(120), registradoPor)
        .query(`
          INSERT INTO dbo.TIPO_CAMBIO (
            moneda_origen,
            moneda_destino,
            tipo_cambio_compra,
            tipo_cambio_venta,
            fecha_modificacion,
            registrado_por,
            activo
          )
          VALUES (
            'USD',
            'CRC',
            @compra,
            @venta,
            SYSDATETIME(),
            @registradoPor,
            1
          );
        `);

      await tx.commit();

      return res.json({
        ok: true,
        message: 'Tipo de cambio actualizado correctamente.'
      });
    } catch (error) {
      await tx.rollback();
      throw error;
    }
  } catch (error) {
    return res.status(500).json({
      ok: false,
      reason: 'INTERNAL_ERROR',
      message: 'Ocurrió un error actualizando el tipo de cambio.'
    });
  }
});

router.get('/configuracion/rangos-comision', async function (req, res) {
  try {
    const pool = await database.poolPromise;
    const result = await pool.request().query(`
      SELECT
        id_rango_comision,
        monto_minimo,
        monto_maximo,
        porcentaje_comision,
        fecha_modificacion,
        activo
      FROM dbo.RANGO_COMISION_RETIRO
      WHERE activo = 1
      ORDER BY monto_minimo ASC, id_rango_comision ASC;
    `);

    return res.json({
      ok: true,
      data: result.recordset || []
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      reason: 'INTERNAL_ERROR',
      message: 'Ocurrió un error consultando los rangos de comisión.'
    });
  }
});

router.post('/configuracion/rangos-comision', async function (req, res) {
  try {
    const pool = await database.poolPromise;
    const rangos = Array.isArray(req.body.rangos) ? req.body.rangos : [];

    if (rangos.length !== 3) {
      return res.status(400).json({
        ok: false,
        reason: 'INVALID_RANGES',
        message: 'Debe enviar exactamente 3 rangos de comisión.'
      });
    }

    const rangosNormalizados = rangos.map(function (rango) {
      return {
        montoMinimo: Number(rango.montoMinimo),
        montoMaximo: Number(rango.montoMaximo),
        porcentajeComision: Number(rango.porcentajeComision)
      };
    });

    for (var i = 0; i < rangosNormalizados.length; i += 1) {
      var rangoActual = rangosNormalizados[i];

      if (
        !Number.isFinite(rangoActual.montoMinimo) ||
        !Number.isFinite(rangoActual.montoMaximo) ||
        !Number.isFinite(rangoActual.porcentajeComision)
      ) {
        return res.status(400).json({
          ok: false,
          reason: 'INVALID_RANGE_VALUES',
          message: 'Todos los valores de rango deben ser numéricos.'
        });
      }

      if (!Number.isInteger(rangoActual.montoMinimo) || !Number.isInteger(rangoActual.montoMaximo)) {
        return res.status(400).json({
          ok: false,
          reason: 'INVALID_RANGE_STEP',
          message: 'Los montos mínimo y máximo deben ser números enteros.'
        });
      }

      if (rangoActual.montoMinimo < 0 || rangoActual.montoMaximo < rangoActual.montoMinimo) {
        return res.status(400).json({
          ok: false,
          reason: 'INVALID_RANGE_ORDER',
          message: 'Cada rango debe tener mínimo mayor o igual a 0 y máximo mayor o igual al mínimo.'
        });
      }

      if (rangoActual.porcentajeComision <= 0 || rangoActual.porcentajeComision > 100) {
        return res.status(400).json({
          ok: false,
          reason: 'INVALID_PERCENTAGE',
          message: 'El porcentaje de comisión debe ser mayor a 0 y menor o igual a 100.'
        });
      }
    }

    for (var j = 1; j < rangosNormalizados.length; j += 1) {
      var previo = rangosNormalizados[j - 1];
      var actual = rangosNormalizados[j];

      if (actual.montoMinimo !== (previo.montoMaximo + 1)) {
        return res.status(400).json({
          ok: false,
          reason: 'RANGE_GAP_OR_OVERLAP',
          message: 'Los rangos no deben trasponerse ni tener huecos: el siguiente mínimo debe ser máximo anterior + 1.'
        });
      }
    }

    const tx = new database.sql.Transaction(pool);
    await tx.begin();

    try {
      const desactivarRequest = new database.sql.Request(tx);
      await desactivarRequest.query(`
        UPDATE dbo.RANGO_COMISION_RETIRO
        SET activo = 0
        WHERE activo = 1;
      `);

      for (var k = 0; k < rangosNormalizados.length; k += 1) {
        var rangoInsertar = rangosNormalizados[k];
        const insertarRequest = new database.sql.Request(tx);

        await insertarRequest
          .input('montoMinimo', database.sql.Decimal(18, 2), rangoInsertar.montoMinimo)
          .input('montoMaximo', database.sql.Decimal(18, 2), rangoInsertar.montoMaximo)
          .input('porcentajeComision', database.sql.Decimal(5, 2), rangoInsertar.porcentajeComision)
          .query(`
            INSERT INTO dbo.RANGO_COMISION_RETIRO (
              monto_minimo,
              monto_maximo,
              porcentaje_comision,
              fecha_modificacion,
              activo
            )
            VALUES (
              @montoMinimo,
              @montoMaximo,
              @porcentajeComision,
              SYSDATETIME(),
              1
            );
          `);
      }

      await tx.commit();

      return res.json({
        ok: true,
        message: 'Rangos de comisión guardados correctamente.'
      });
    } catch (error) {
      await tx.rollback();
      throw error;
    }
  } catch (error) {
    return res.status(500).json({
      ok: false,
      reason: 'INTERNAL_ERROR',
      message: 'Ocurrió un error guardando los rangos de comisión.'
    });
  }
});

router.post('/clientes/guardar-actualizar', async function (req, res) {
  try {
    const pool = await database.poolPromise;
    const identificadorCliente = normalizarTexto(req.body.identificadorCliente);
    const nombreCompleto = normalizarTexto(req.body.nombreCompleto);
    const correoElectronico = normalizarTexto(req.body.correoElectronico);
    const telefono = normalizarTexto(req.body.telefono);
    const fechaNacimientoTexto = normalizarTexto(req.body.fechaNacimiento);
    const ocupacion = normalizarTexto(req.body.ocupacion);
    const direccion = normalizarTexto(req.body.direccion);
    const estado = normalizarEstado(normalizarTexto(req.body.estado));
    const confirmarActualizacion = Boolean(req.body.confirmarActualizacion);

    if (
      !identificadorCliente ||
      !nombreCompleto ||
      !correoElectronico ||
      !telefono ||
      !fechaNacimientoTexto ||
      !ocupacion ||
      !direccion
    ) {
      return res.status(400).json({
        ok: false,
        reason: 'INVALID_INPUT',
        message: 'Todos los campos son obligatorios para guardar el cliente.'
      });
    }

    const fechaNacimiento = new Date(fechaNacimientoTexto);

    if (Number.isNaN(fechaNacimiento.getTime())) {
      return res.status(400).json({
        ok: false,
        reason: 'INVALID_DATE',
        message: 'La fecha de nacimiento no es válida.'
      });
    }

    const validacionResult = await pool
      .request()
      .input('identificadorCliente', database.sql.VarChar(20), identificadorCliente)
      .query(`
        SELECT COUNT(*) AS existeCliente
        FROM dbo.CLIENTE
        WHERE identificador_cliente = @identificadorCliente;
      `);

    const existeCliente = Number((validacionResult.recordset[0] || {}).existeCliente || 0) > 0;

    if (existeCliente && !confirmarActualizacion) {
      return res.status(409).json({
        ok: false,
        reason: 'CLIENT_EXISTS_CONFIRM',
        message: 'El identificador ya existe. ¿Desea actualizar este cliente?'
      });
    }

    const correoDuplicadoResult = await pool
      .request()
      .input('identificadorCliente', database.sql.VarChar(20), identificadorCliente)
      .input('correoElectronico', database.sql.NVarChar(120), correoElectronico)
      .query(`
        SELECT COUNT(*) AS correoDuplicado
        FROM dbo.CLIENTE
        WHERE correo_electronico = @correoElectronico
          AND identificador_cliente <> @identificadorCliente;
      `);

    const correoDuplicado = Number((correoDuplicadoResult.recordset[0] || {}).correoDuplicado || 0) > 0;

    if (correoDuplicado) {
      return res.status(409).json({
        ok: false,
        reason: 'EMAIL_IN_USE',
        message: 'El correo electrónico ya está asociado a otro cliente.'
      });
    }

    const request = pool.request();
    request.input('identificadorCliente', database.sql.VarChar(20), identificadorCliente);
    request.input('nombreCompleto', database.sql.NVarChar(150), nombreCompleto);
    request.input('correoElectronico', database.sql.NVarChar(120), correoElectronico);
    request.input('telefono', database.sql.VarChar(20), telefono);
    request.input('fechaNacimiento', database.sql.Date, fechaNacimiento);
    request.input('ocupacion', database.sql.NVarChar(100), ocupacion);
    request.input('direccion', database.sql.NVarChar(250), direccion);
    request.input('estado', database.sql.VarChar(10), estado);

    if (existeCliente) {
      await request.query(`
        UPDATE dbo.CLIENTE
        SET
          nombre_completo = @nombreCompleto,
          correo_electronico = @correoElectronico,
          telefono = @telefono,
          fecha_nacimiento = @fechaNacimiento,
          ocupacion = @ocupacion,
          direccion = @direccion,
          fecha_creacion = SYSDATETIME(),
          estado = @estado
        WHERE identificador_cliente = @identificadorCliente;
      `);

      return res.json({
        ok: true,
        action: 'updated',
        message: 'Cliente actualizado correctamente.'
      });
    }

    await request.query(`
      INSERT INTO dbo.CLIENTE (
        identificador_cliente,
        nombre_completo,
        correo_electronico,
        telefono,
        fecha_nacimiento,
        ocupacion,
        direccion,
        fecha_creacion,
        estado
      )
      VALUES (
        @identificadorCliente,
        @nombreCompleto,
        @correoElectronico,
        @telefono,
        @fechaNacimiento,
        @ocupacion,
        @direccion,
        SYSDATETIME(),
        @estado
      );
    `);

    return res.json({
      ok: true,
      action: 'created',
      message: 'Cliente creado correctamente.'
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      reason: 'INTERNAL_ERROR',
      message: 'Ocurrió un error guardando el cliente.'
    });
  }
});

router.post('/clientes/eliminar', async function (req, res) {
  try {
    const pool = await database.poolPromise;
    const identificadorCliente = String(req.body.identificadorCliente || '').trim();

    if (!identificadorCliente) {
      return res.status(400).json({
        ok: false,
        reason: 'INVALID_INPUT',
        message: 'Debe indicar el identificador del cliente.'
      });
    }

    const validacionResult = await pool
      .request()
      .input('identificadorCliente', database.sql.VarChar(20), identificadorCliente)
      .query(`
        SELECT
          (SELECT COUNT(*) FROM dbo.CLIENTE WHERE identificador_cliente = @identificadorCliente) AS existeCliente,
          (SELECT COUNT(*) FROM dbo.TRANSACCION WHERE identificador_cliente = @identificadorCliente) AS totalTransacciones,
          (SELECT COUNT(*) FROM dbo.SOLICITUD_PRESTAMO WHERE identificador_cliente = @identificadorCliente) AS totalSolicitudesPrestamo;
      `);

    const validacion = validacionResult.recordset[0] || {};

    if (Number(validacion.existeCliente || 0) === 0) {
      return res.status(404).json({
        ok: false,
        reason: 'NOT_FOUND',
        message: 'El cliente no existe.'
      });
    }

    if (Number(validacion.totalTransacciones || 0) > 0) {
      return res.status(409).json({
        ok: false,
        reason: 'HAS_TRANSACTIONS',
        message: 'No se puede eliminar este cliente porque tiene transacciones.'
      });
    }

    if (Number(validacion.totalSolicitudesPrestamo || 0) > 0) {
      return res.status(409).json({
        ok: false,
        reason: 'HAS_LOAN_REQUESTS',
        message: 'No se puede eliminar este cliente porque tiene solicitudes de préstamo.'
      });
    }

    const tx = new database.sql.Transaction(pool);
    await tx.begin();

    try {
      const request = new database.sql.Request(tx);

      await request
        .input('identificadorCliente', database.sql.VarChar(20), identificadorCliente)
        .query(`
          DELETE FROM dbo.CUENTA_BANCARIA
          WHERE identificador_cliente = @identificadorCliente;

          DELETE FROM dbo.CLIENTE
          WHERE identificador_cliente = @identificadorCliente;
        `);

      await tx.commit();
    } catch (error) {
      await tx.rollback();
      throw error;
    }

    return res.json({
      ok: true,
      message: 'Cliente eliminado correctamente.'
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      reason: 'INTERNAL_ERROR',
      message: 'Ocurrió un error eliminando el cliente.'
    });
  }
});

router.post('/cuentas/guardar-actualizar', async function (req, res) {
  try {
    const pool = await database.poolPromise;
    const iban = normalizarTexto(req.body.iban).toUpperCase();
    const aliasCuenta = normalizarTexto(req.body.aliasCuenta);
    const moneda = normalizarMoneda(normalizarTexto(req.body.moneda).toUpperCase());
    const saldoActualTexto = normalizarTexto(req.body.saldoActual);
    const clientePropietario = normalizarTexto(req.body.clientePropietario);
    const estado = normalizarEstadoCuenta(normalizarTexto(req.body.estado));
    const confirmarActualizacion = Boolean(req.body.confirmarActualizacion);

    if (!iban || !aliasCuenta || !saldoActualTexto || !clientePropietario) {
      return res.status(400).json({
        ok: false,
        reason: 'INVALID_INPUT',
        message: 'Todos los campos son obligatorios para guardar la cuenta.'
      });
    }

    const saldoActual = Number(saldoActualTexto);
    if (!Number.isFinite(saldoActual) || saldoActual < 0) {
      return res.status(400).json({
        ok: false,
        reason: 'INVALID_BALANCE',
        message: 'El saldo actual debe ser un número mayor o igual a cero.'
      });
    }

    const clienteResult = await pool
      .request()
      .input('clientePropietario', database.sql.NVarChar(150), clientePropietario)
      .query(`
        SELECT
          identificador_cliente,
          nombre_completo
        FROM dbo.CLIENTE
        WHERE identificador_cliente = @clientePropietario
           OR nombre_completo = @clientePropietario;
      `);

    const clientesCoincidentes = clienteResult.recordset || [];

    if (clientesCoincidentes.length === 0) {
      return res.status(404).json({
        ok: false,
        reason: 'OWNER_NOT_FOUND',
        message: 'El cliente propietario no existe en el registro de clientes.'
      });
    }

    if (clientesCoincidentes.length > 1) {
      return res.status(409).json({
        ok: false,
        reason: 'OWNER_AMBIGUOUS',
        message: 'Ingrese el identificador del cliente correcto para continuar.'
      });
    }

    const identificadorCliente = clientesCoincidentes[0].identificador_cliente;

    const validacionCuentaResult = await pool
      .request()
      .input('iban', database.sql.VarChar(34), iban)
      .query(`
        SELECT COUNT(*) AS existeCuenta
        FROM dbo.CUENTA_BANCARIA
        WHERE iban = @iban;
      `);

    const existeCuenta = Number((validacionCuentaResult.recordset[0] || {}).existeCuenta || 0) > 0;

    if (existeCuenta && !confirmarActualizacion) {
      return res.status(409).json({
        ok: false,
        reason: 'ACCOUNT_EXISTS_CONFIRM',
        message: 'El IBAN ya existe. ¿Desea actualizar esta cuenta?'
      });
    }

    const request = pool.request();
    request.input('iban', database.sql.VarChar(34), iban);
    request.input('aliasCuenta', database.sql.NVarChar(100), aliasCuenta);
    request.input('moneda', database.sql.Char(3), moneda);
    request.input('saldoActual', database.sql.Decimal(18, 2), saldoActual);
    request.input('identificadorCliente', database.sql.VarChar(20), identificadorCliente);
    request.input('estado', database.sql.VarChar(10), estado);

    if (existeCuenta) {
      await request.query(`
        UPDATE dbo.CUENTA_BANCARIA
        SET
          alias_cuenta = @aliasCuenta,
          moneda = @moneda,
          saldo_actual = @saldoActual,
          identificador_cliente = @identificadorCliente,
          fecha_creacion = SYSDATETIME(),
          estado = @estado
        WHERE iban = @iban;
      `);

      return res.json({
        ok: true,
        action: 'updated',
        message: 'Cuenta actualizada correctamente.'
      });
    }

    await request.query(`
      INSERT INTO dbo.CUENTA_BANCARIA (
        iban,
        alias_cuenta,
        moneda,
        saldo_actual,
        identificador_cliente,
        fecha_creacion,
        estado
      )
      VALUES (
        @iban,
        @aliasCuenta,
        @moneda,
        @saldoActual,
        @identificadorCliente,
        SYSDATETIME(),
        @estado
      );
    `);

    return res.json({
      ok: true,
      action: 'created',
      message: 'Cuenta creada correctamente.'
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      reason: 'INTERNAL_ERROR',
      message: 'Ocurrió un error guardando la cuenta.'
    });
  }
});

router.post('/cuentas/eliminar', async function (req, res) {
  try {
    const pool = await database.poolPromise;
    const iban = String(req.body.iban || '').trim();

    if (!iban) {
      return res.status(400).json({
        ok: false,
        reason: 'INVALID_INPUT',
        message: 'Debe indicar el IBAN de la cuenta.'
      });
    }

    const validacionResult = await pool
      .request()
      .input('iban', database.sql.VarChar(34), iban)
      .query(`
        SELECT
          (SELECT COUNT(*) FROM dbo.CUENTA_BANCARIA WHERE iban = @iban) AS existeCuenta,
          (SELECT COUNT(*) FROM dbo.TRANSACCION WHERE iban = @iban) AS totalTransacciones;
      `);

    const validacion = validacionResult.recordset[0] || {};

    if (Number(validacion.existeCuenta || 0) === 0) {
      return res.status(404).json({
        ok: false,
        reason: 'NOT_FOUND',
        message: 'La cuenta no existe.'
      });
    }

    if (Number(validacion.totalTransacciones || 0) > 0) {
      return res.status(409).json({
        ok: false,
        reason: 'HAS_TRANSACTIONS',
        message: 'No se puede eliminar esta cuenta porque tiene transacciones.'
      });
    }

    await pool
      .request()
      .input('iban', database.sql.VarChar(34), iban)
      .query(`
        DELETE FROM dbo.CUENTA_BANCARIA
        WHERE iban = @iban;
      `);

    return res.json({
      ok: true,
      message: 'Cuenta eliminada correctamente.'
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      reason: 'INTERNAL_ERROR',
      message: 'Ocurrió un error eliminando la cuenta.'
    });
  }
});

router.post('/transacciones/deposito', async function (req, res) {
  try {
    const pool = await database.poolPromise;
    const cuentaDeposito = normalizarTexto(req.body.cuentaDeposito);
    const cuentaDepositoIBANNormalizado = normalizarIBAN(req.body.cuentaDeposito);
    const descripcion = normalizarTexto(req.body.descripcion);
    const montoTexto = normalizarTexto(req.body.monto);
    const monedaDeposito = normalizarMoneda(normalizarTexto(req.body.moneda).toUpperCase());

    if (!cuentaDeposito || !descripcion || !montoTexto) {
      return res.status(400).json({
        ok: false,
        reason: 'INVALID_INPUT',
        message: 'Cuenta, descripción y monto son obligatorios.'
      });
    }

    const monto = Number(montoTexto);
    if (!Number.isFinite(monto) || monto <= 0) {
      return res.status(400).json({
        ok: false,
        reason: 'INVALID_AMOUNT',
        message: 'El monto del depósito debe ser mayor a cero.'
      });
    }

    const tx = new database.sql.Transaction(pool);
    await tx.begin();

    try {
      const cuentaRequest = new database.sql.Request(tx);
      cuentaRequest.input('cuentaDeposito', database.sql.NVarChar(150), cuentaDeposito);
      cuentaRequest.input('cuentaDepositoIBANNormalizado', database.sql.VarChar(34), cuentaDepositoIBANNormalizado);

      const cuentaResult = await cuentaRequest.query(`
        SELECT
          cb.iban,
          cb.moneda,
          cb.saldo_actual,
          cb.identificador_cliente,
          cb.estado AS estado_cuenta,
          c.nombre_completo,
          c.estado AS estado_cliente
        FROM dbo.CUENTA_BANCARIA cb
        INNER JOIN dbo.CLIENTE c
          ON c.identificador_cliente = cb.identificador_cliente
        WHERE REPLACE(UPPER(cb.iban), ' ', '') = @cuentaDepositoIBANNormalizado
           OR c.nombre_completo = @cuentaDeposito;
      `);

      const cuentas = cuentaResult.recordset || [];

      if (cuentas.length === 0) {
        await tx.rollback();
        return res.status(404).json({
          ok: false,
          reason: 'ACCOUNT_NOT_FOUND',
          message: 'La cuenta no existe.'
        });
      }

      if (cuentas.length > 1) {
        await tx.rollback();
        return res.status(409).json({
          ok: false,
          reason: 'ACCOUNT_AMBIGUOUS',
          message: 'Se encontraron varias cuentas para ese cliente. Ingrese el IBAN.'
        });
      }

      const cuenta = cuentas[0];

      if (cuenta.estado_cuenta !== 'Activa' || cuenta.estado_cliente !== 'Activo') {
        await tx.rollback();
        return res.status(409).json({
          ok: false,
          reason: 'ACCOUNT_INACTIVE',
          message: 'Solo se permiten depósitos en cuentas activas de clientes activos.'
        });
      }

      let montoAcreditado = monto;
      let tipoCambioCompra = null;
      let tipoCambioVenta = null;
      let tipoCambioAplicadoTexto = 'No aplica';

      if (monedaDeposito !== cuenta.moneda) {
        const tipoCambioRequest = new database.sql.Request(tx);
        const tipoCambioResult = await tipoCambioRequest.query(`
          SELECT TOP 1
            tipo_cambio_compra,
            tipo_cambio_venta
          FROM dbo.TIPO_CAMBIO
          WHERE activo = 1
            AND moneda_origen = 'USD'
            AND moneda_destino = 'CRC'
          ORDER BY fecha_modificacion DESC, id_tipo_cambio DESC;
        `);

        const tipoCambio = tipoCambioResult.recordset[0] || null;
        if (!tipoCambio) {
          await tx.rollback();
          return res.status(409).json({
            ok: false,
            reason: 'EXCHANGE_RATE_NOT_FOUND',
            message: 'No existe un tipo de cambio activo para convertir el depósito.'
          });
        }

        const compra = Number(tipoCambio.tipo_cambio_compra || 0);
        const venta = Number(tipoCambio.tipo_cambio_venta || 0);

        if (compra <= 0 || venta <= 0) {
          await tx.rollback();
          return res.status(409).json({
            ok: false,
            reason: 'EXCHANGE_RATE_INVALID',
            message: 'El tipo de cambio activo no es válido.'
          });
        }

        if (monedaDeposito === 'USD' && cuenta.moneda === 'CRC') {
          montoAcreditado = monto * compra;
          tipoCambioAplicadoTexto = 'Compra ' + compra;
        } else if (monedaDeposito === 'CRC' && cuenta.moneda === 'USD') {
          montoAcreditado = monto / venta;
          tipoCambioAplicadoTexto = 'Venta ' + venta;
        } else {
          await tx.rollback();
          return res.status(400).json({
            ok: false,
            reason: 'UNSUPPORTED_CURRENCY',
            message: 'La combinación de monedas no es soportada.'
          });
        }

        tipoCambioCompra = compra;
        tipoCambioVenta = venta;
      }

      montoAcreditado = redondearDosDecimales(montoAcreditado);
      const saldoFinal = redondearDosDecimales(Number(cuenta.saldo_actual || 0) + montoAcreditado);

      const codigoRequest = new database.sql.Request(tx);
      const codigoResult = await codigoRequest.query(`
        SELECT 'TRX-' + RIGHT(REPLACE(CONVERT(VARCHAR(36), NEWID()), '-', ''), 15) AS codigoTransaccion;
      `);
      const codigoTransaccion = (codigoResult.recordset[0] || {}).codigoTransaccion;

      const updateCuentaRequest = new database.sql.Request(tx);
      await updateCuentaRequest
        .input('iban', database.sql.VarChar(34), cuenta.iban)
        .input('saldoFinal', database.sql.Decimal(18, 2), saldoFinal)
        .query(`
          UPDATE dbo.CUENTA_BANCARIA
          SET saldo_actual = @saldoFinal
          WHERE iban = @iban;
        `);

      const insertTransaccionRequest = new database.sql.Request(tx);
      await insertTransaccionRequest
        .input('codigoTransaccion', database.sql.VarChar(20), codigoTransaccion)
        .input('iban', database.sql.VarChar(34), cuenta.iban)
        .input('identificadorCliente', database.sql.VarChar(20), cuenta.identificador_cliente)
        .input('descripcion', database.sql.NVarChar(250), descripcion)
        .input('montoAcreditado', database.sql.Decimal(18, 2), montoAcreditado)
        .input('monedaCuenta', database.sql.Char(3), cuenta.moneda)
        .input('tipoCambioCompra', database.sql.Decimal(12, 4), tipoCambioCompra)
        .input('tipoCambioVenta', database.sql.Decimal(12, 4), tipoCambioVenta)
        .input('saldoFinal', database.sql.Decimal(18, 2), saldoFinal)
        .query(`
          INSERT INTO dbo.TRANSACCION (
            codigo_transaccion,
            iban,
            identificador_cliente,
            tipo_transaccion,
            descripcion,
            fecha_transaccion,
            monto,
            moneda,
            tipo_cambio_compra,
            tipo_cambio_venta,
            saldo_final,
            codigo_referencia
          )
          VALUES (
            @codigoTransaccion,
            @iban,
            @identificadorCliente,
            'Deposito',
            @descripcion,
            SYSDATETIME(),
            @montoAcreditado,
            @monedaCuenta,
            @tipoCambioCompra,
            @tipoCambioVenta,
            @saldoFinal,
            NULL
          );
        `);

      await tx.commit();

      return res.json({
        ok: true,
        message: 'Depósito registrado correctamente.',
        data: {
          codigoTransaccion: codigoTransaccion,
          iban: cuenta.iban,
          descripcion: descripcion,
          fechaTransaccion: new Date().toISOString(),
          montoIngresado: redondearDosDecimales(monto),
          monedaDeposito: monedaDeposito,
          monedaCuenta: cuenta.moneda,
          montoAcreditado: montoAcreditado,
          saldoFinal: saldoFinal,
          tipoCambioAplicado: tipoCambioAplicadoTexto
        }
      });
    } catch (error) {
      await tx.rollback();
      throw error;
    }
  } catch (error) {
    return res.status(500).json({
      ok: false,
      reason: 'INTERNAL_ERROR',
      message: 'Ocurrió un error registrando el depósito.'
    });
  }
});

router.post('/transacciones/retiro', async function (req, res) {
  try {
    const pool = await database.poolPromise;
    const cuentaRetiro = normalizarTexto(req.body.cuentaRetiro);
    const cuentaRetiroIBANNormalizado = normalizarIBAN(req.body.cuentaRetiro);
    const descripcion = normalizarTexto(req.body.descripcion);
    const montoTexto = normalizarTexto(req.body.monto);
    const monedaRetiro = normalizarMoneda(normalizarTexto(req.body.moneda).toUpperCase());

    if (!cuentaRetiro || !descripcion || !montoTexto) {
      return res.status(400).json({
        ok: false,
        reason: 'INVALID_INPUT',
        message: 'Cuenta, descripción y monto son obligatorios.'
      });
    }

    const montoIngresado = Number(montoTexto);
    if (!Number.isFinite(montoIngresado) || montoIngresado <= 0) {
      return res.status(400).json({
        ok: false,
        reason: 'INVALID_AMOUNT',
        message: 'El monto del retiro debe ser mayor a cero.'
      });
    }

    const tx = new database.sql.Transaction(pool);
    await tx.begin();

    try {
      const cuentaRequest = new database.sql.Request(tx);
      cuentaRequest.input('cuentaRetiro', database.sql.NVarChar(150), cuentaRetiro);
      cuentaRequest.input('cuentaRetiroIBANNormalizado', database.sql.VarChar(34), cuentaRetiroIBANNormalizado);

      const cuentaResult = await cuentaRequest.query(`
        SELECT
          cb.iban,
          cb.moneda,
          cb.saldo_actual,
          cb.identificador_cliente,
          cb.estado AS estado_cuenta,
          c.estado AS estado_cliente,
          c.nombre_completo
        FROM dbo.CUENTA_BANCARIA cb
        INNER JOIN dbo.CLIENTE c
          ON c.identificador_cliente = cb.identificador_cliente
        WHERE REPLACE(UPPER(cb.iban), ' ', '') = @cuentaRetiroIBANNormalizado
           OR c.nombre_completo = @cuentaRetiro;
      `);

      const cuentas = cuentaResult.recordset || [];

      if (cuentas.length === 0) {
        await tx.rollback();
        return res.status(404).json({
          ok: false,
          reason: 'ACCOUNT_NOT_FOUND',
          message: 'La cuenta no existe.'
        });
      }

      if (cuentas.length > 1) {
        await tx.rollback();
        return res.status(409).json({
          ok: false,
          reason: 'ACCOUNT_AMBIGUOUS',
          message: 'Se encontraron varias cuentas para ese cliente. Ingrese el IBAN.'
        });
      }

      const cuenta = cuentas[0];
      if (cuenta.estado_cuenta !== 'Activa' || cuenta.estado_cliente !== 'Activo') {
        await tx.rollback();
        return res.status(409).json({
          ok: false,
          reason: 'ACCOUNT_INACTIVE',
          message: 'Solo se permiten retiros en cuentas activas de clientes activos.'
        });
      }

      const tipoCambioRequest = new database.sql.Request(tx);
      const tipoCambioResult = await tipoCambioRequest.query(`
        SELECT TOP 1
          tipo_cambio_compra,
          tipo_cambio_venta
        FROM dbo.TIPO_CAMBIO
        WHERE activo = 1
          AND moneda_origen = 'USD'
          AND moneda_destino = 'CRC'
        ORDER BY fecha_modificacion DESC, id_tipo_cambio DESC;
      `);

      const tipoCambio = tipoCambioResult.recordset[0] || null;
      const compra = Number((tipoCambio || {}).tipo_cambio_compra || 0);
      const venta = Number((tipoCambio || {}).tipo_cambio_venta || 0);

      let montoRetiro = montoIngresado;
      let tipoCambioCompra = null;
      let tipoCambioVenta = null;
      let tipoCambioAplicadoTexto = 'No aplica';

      if (monedaRetiro !== cuenta.moneda) {
        if (!tipoCambio || compra <= 0 || venta <= 0) {
          await tx.rollback();
          return res.status(409).json({
            ok: false,
            reason: 'EXCHANGE_RATE_NOT_FOUND',
            message: 'No existe un tipo de cambio activo válido para convertir el retiro.'
          });
        }

        if (monedaRetiro === 'USD' && cuenta.moneda === 'CRC') {
          montoRetiro = montoIngresado * compra;
          tipoCambioAplicadoTexto = 'Compra ' + compra;
          tipoCambioCompra = compra;
          tipoCambioVenta = venta;
        } else if (monedaRetiro === 'CRC' && cuenta.moneda === 'USD') {
          montoRetiro = montoIngresado / venta;
          tipoCambioAplicadoTexto = 'Venta ' + venta;
          tipoCambioCompra = compra;
          tipoCambioVenta = venta;
        } else {
          await tx.rollback();
          return res.status(400).json({
            ok: false,
            reason: 'UNSUPPORTED_CURRENCY',
            message: 'La combinación de monedas no es soportada.'
          });
        }
      }

      montoRetiro = redondearDosDecimales(montoRetiro);

      let montoBaseComisionCRC = montoRetiro;
      if (cuenta.moneda === 'USD') {
        if (!tipoCambio || compra <= 0) {
          await tx.rollback();
          return res.status(409).json({
            ok: false,
            reason: 'EXCHANGE_RATE_NOT_FOUND',
            message: 'No existe un tipo de cambio activo válido para calcular la comisión.'
          });
        }

        montoBaseComisionCRC = montoRetiro * compra;
      }

      montoBaseComisionCRC = redondearDosDecimales(montoBaseComisionCRC);

      const rangoRequest = new database.sql.Request(tx);
      rangoRequest.input('montoBaseComisionCRC', database.sql.Decimal(18, 2), montoBaseComisionCRC);
      const rangoResult = await rangoRequest.query(`
        SELECT TOP 1
          id_rango_comision,
          monto_minimo,
          monto_maximo,
          porcentaje_comision
        FROM dbo.RANGO_COMISION_RETIRO
        WHERE activo = 1
          AND @montoBaseComisionCRC BETWEEN monto_minimo AND monto_maximo
        ORDER BY fecha_modificacion DESC, id_rango_comision DESC;
      `);

      const rango = rangoResult.recordset[0] || null;
      if (!rango) {
        await tx.rollback();
        return res.status(409).json({
          ok: false,
          reason: 'COMMISSION_RANGE_NOT_FOUND',
          message: 'No existe un rango de comisión activo para este retiro.'
        });
      }

      const porcentajeComision = Number(rango.porcentaje_comision || 0);
      const montoComision = redondearDosDecimales(montoRetiro * (porcentajeComision / 100));
      const saldoActual = Number(cuenta.saldo_actual || 0);
      const totalDescontar = redondearDosDecimales(montoRetiro + montoComision);

      if (saldoActual < totalDescontar) {
        await tx.rollback();
        return res.status(409).json({
          ok: false,
          reason: 'INSUFFICIENT_FUNDS',
          message: 'Saldo insuficiente para cubrir el retiro y su comisión.'
        });
      }

      const saldoDespuesRetiro = redondearDosDecimales(saldoActual - montoRetiro);
      const saldoFinal = redondearDosDecimales(saldoDespuesRetiro - montoComision);

      const codigoRetiroRequest = new database.sql.Request(tx);
      const codigoRetiroResult = await codigoRetiroRequest.query(`
        SELECT 'TRX-' + RIGHT(REPLACE(CONVERT(VARCHAR(36), NEWID()), '-', ''), 15) AS codigoRetiro;
      `);
      const codigoRetiro = (codigoRetiroResult.recordset[0] || {}).codigoRetiro;

      const codigoComisionRequest = new database.sql.Request(tx);
      const codigoComisionResult = await codigoComisionRequest.query(`
        SELECT 'COM-' + RIGHT(REPLACE(CONVERT(VARCHAR(36), NEWID()), '-', ''), 15) AS codigoComision;
      `);
      const codigoComision = (codigoComisionResult.recordset[0] || {}).codigoComision;

      const updateCuentaRequest = new database.sql.Request(tx);
      await updateCuentaRequest
        .input('iban', database.sql.VarChar(34), cuenta.iban)
        .input('saldoFinal', database.sql.Decimal(18, 2), saldoFinal)
        .query(`
          UPDATE dbo.CUENTA_BANCARIA
          SET saldo_actual = @saldoFinal
          WHERE iban = @iban;
        `);

      const insertRetiroRequest = new database.sql.Request(tx);
      await insertRetiroRequest
        .input('codigoRetiro', database.sql.VarChar(20), codigoRetiro)
        .input('iban', database.sql.VarChar(34), cuenta.iban)
        .input('identificadorCliente', database.sql.VarChar(20), cuenta.identificador_cliente)
        .input('descripcion', database.sql.NVarChar(250), descripcion)
        .input('montoRetiro', database.sql.Decimal(18, 2), montoRetiro)
        .input('monedaCuenta', database.sql.Char(3), cuenta.moneda)
        .input('tipoCambioCompra', database.sql.Decimal(12, 4), tipoCambioCompra)
        .input('tipoCambioVenta', database.sql.Decimal(12, 4), tipoCambioVenta)
        .input('saldoDespuesRetiro', database.sql.Decimal(18, 2), saldoDespuesRetiro)
        .query(`
          INSERT INTO dbo.TRANSACCION (
            codigo_transaccion,
            iban,
            identificador_cliente,
            tipo_transaccion,
            descripcion,
            fecha_transaccion,
            monto,
            moneda,
            tipo_cambio_compra,
            tipo_cambio_venta,
            saldo_final,
            codigo_referencia
          )
          VALUES (
            @codigoRetiro,
            @iban,
            @identificadorCliente,
            'Retiro',
            @descripcion,
            SYSDATETIME(),
            @montoRetiro,
            @monedaCuenta,
            @tipoCambioCompra,
            @tipoCambioVenta,
            @saldoDespuesRetiro,
            NULL
          );
        `);

      const insertComisionRequest = new database.sql.Request(tx);
      await insertComisionRequest
        .input('codigoComision', database.sql.VarChar(20), codigoComision)
        .input('iban', database.sql.VarChar(34), cuenta.iban)
        .input('identificadorCliente', database.sql.VarChar(20), cuenta.identificador_cliente)
        .input('montoComision', database.sql.Decimal(18, 2), montoComision)
        .input('monedaCuenta', database.sql.Char(3), cuenta.moneda)
        .input('tipoCambioCompra', database.sql.Decimal(12, 4), tipoCambioCompra)
        .input('tipoCambioVenta', database.sql.Decimal(12, 4), tipoCambioVenta)
        .input('saldoFinal', database.sql.Decimal(18, 2), saldoFinal)
        .input('codigoRetiro', database.sql.VarChar(20), codigoRetiro)
        .query(`
          INSERT INTO dbo.TRANSACCION (
            codigo_transaccion,
            iban,
            identificador_cliente,
            tipo_transaccion,
            descripcion,
            fecha_transaccion,
            monto,
            moneda,
            tipo_cambio_compra,
            tipo_cambio_venta,
            saldo_final,
            codigo_referencia
          )
          VALUES (
            @codigoComision,
            @iban,
            @identificadorCliente,
            'Comision',
            N'Comisión por retiro',
            SYSDATETIME(),
            @montoComision,
            @monedaCuenta,
            @tipoCambioCompra,
            @tipoCambioVenta,
            @saldoFinal,
            @codigoRetiro
          );
        `);

      const insertDetalleRetiroRequest = new database.sql.Request(tx);
      await insertDetalleRetiroRequest
        .input('codigoRetiro', database.sql.VarChar(20), codigoRetiro)
        .input('idRangoComision', database.sql.Int, Number(rango.id_rango_comision))
        .input('porcentajeComision', database.sql.Decimal(5, 2), porcentajeComision)
        .input('montoComision', database.sql.Decimal(18, 2), montoComision)
        .input('saldoDespuesRetiro', database.sql.Decimal(18, 2), saldoDespuesRetiro)
        .input('codigoComision', database.sql.VarChar(20), codigoComision)
        .query(`
          INSERT INTO dbo.TRANSACCION_RETIRO (
            codigo_transaccion_retiro,
            id_rango_comision,
            porcentaje_comision_aplicado,
            monto_comision,
            saldo_despues_retiro,
            codigo_transaccion_comision
          )
          VALUES (
            @codigoRetiro,
            @idRangoComision,
            @porcentajeComision,
            @montoComision,
            @saldoDespuesRetiro,
            @codigoComision
          );
        `);

      await tx.commit();

      return res.json({
        ok: true,
        message: 'Retiro registrado correctamente.',
        data: {
          codigoRetiro: codigoRetiro,
          codigoComision: codigoComision,
          iban: cuenta.iban,
          fechaTransaccion: new Date().toISOString(),
          montoRetiro: montoRetiro,
          montoComision: montoComision,
          saldoDespuesRetiro: saldoDespuesRetiro,
          saldoFinal: saldoFinal,
          monedaCuenta: cuenta.moneda,
          rangoAplicado: '₡ ' + Number(rango.monto_minimo || 0) + ' - ₡ ' + Number(rango.monto_maximo || 0),
          porcentajeComision: porcentajeComision,
          tipoCambioAplicado: tipoCambioAplicadoTexto
        }
      });
    } catch (error) {
      await tx.rollback();
      throw error;
    }
  } catch (error) {
    return res.status(500).json({
      ok: false,
      reason: 'INTERNAL_ERROR',
      message: 'Ocurrió un error registrando el retiro.'
    });
  }
});

router.post('/prestamos/solicitar', async function (req, res) {
  try {
    const pool = await database.poolPromise;
    const identificadorCliente = normalizarTexto(req.body.identificadorCliente).toUpperCase();
    const montoPrestamoTexto = normalizarTexto(req.body.montoPrestamo).replace(/,/g, '');
    const plazoMesesTexto = normalizarTexto(req.body.plazoMeses);

    if (!identificadorCliente || !montoPrestamoTexto || !plazoMesesTexto) {
      return res.status(400).json({
        ok: false,
        reason: 'CAMPOS_OBLIGATORIOS',
        message: 'Identificador de cliente, monto y plazo son obligatorios.'
      });
    }

    const montoPrestamo = Number(montoPrestamoTexto);
    const plazoMeses = Number(plazoMesesTexto);

    if (!Number.isFinite(montoPrestamo) || montoPrestamo <= 0) {
      return res.status(400).json({
        ok: false,
        reason: 'MONTO_INVALIDO',
        message: 'El monto del préstamo debe ser un número mayor a cero.'
      });
    }

    if (!Number.isInteger(plazoMeses) || ![4, 6, 9, 12].includes(plazoMeses)) {
      return res.status(400).json({
        ok: false,
        reason: 'PLAZO_INVALIDO',
        message: 'El plazo del préstamo debe ser 4, 6, 9 o 12 meses.'
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
      return res.status(404).json({
        ok: false,
        reason: 'CLIENTE_NO_ENCONTRADO',
        message: 'El identificador de cliente no existe.'
      });
    }

    const solicitudResult = await pool
      .request()
      .input('identificadorCliente', database.sql.VarChar(20), cliente.identificador_cliente)
      .input('montoPrestamo', database.sql.Decimal(18, 2), montoPrestamo)
      .input('plazoMeses', database.sql.TinyInt, plazoMeses)
      .query(`
        INSERT INTO dbo.SOLICITUD_PRESTAMO (
          identificador_cliente,
          monto_prestamo,
          plazo_meses
        )
        OUTPUT
          INSERTED.numero_solicitud,
          INSERTED.fecha_solicitud,
          INSERTED.identificador_cliente,
          INSERTED.monto_prestamo,
          INSERTED.plazo_meses,
          INSERTED.cuota_mensual,
          INSERTED.estado
        VALUES (
          @identificadorCliente,
          @montoPrestamo,
          @plazoMeses
        );
      `);

    const solicitud = solicitudResult.recordset[0] || {};

    return res.json({
      ok: true,
      message: 'Solicitud de préstamo registrada correctamente.',
      data: {
        numeroSolicitud: solicitud.numero_solicitud,
        fechaSolicitud: solicitud.fecha_solicitud,
        identificadorCliente: solicitud.identificador_cliente,
        nombreCliente: cliente.nombre_completo,
        montoPrestamo: solicitud.monto_prestamo,
        plazoMeses: solicitud.plazo_meses,
        cuotaMensual: solicitud.cuota_mensual,
        estado: solicitud.estado
      }
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      reason: 'INTERNAL_ERROR',
      message: 'Ocurrió un error registrando la solicitud de préstamo.'
    });
  }
});

module.exports = router;
