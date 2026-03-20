var express = require('express');
var router = express.Router();
var database = require('./database');

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
          (SELECT COUNT(*) FROM dbo.TRANSACCION WHERE identificador_cliente = @identificadorCliente) AS totalTransacciones;
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

module.exports = router;
