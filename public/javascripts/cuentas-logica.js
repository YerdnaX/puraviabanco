(function () {
  function normalizarIBAN(valor) {
    return String(valor || '').trim().toUpperCase().replace(/\s+/g, '');
  }

  function esIBANValido(iban) {
    var formatoIBAN = /^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/;
    return formatoIBAN.test(iban);
  }

  function mostrarMensajeError(data) {
    if (data && data.reason === 'HAS_TRANSACTIONS') {
      alert('No se puede eliminar esta cuenta porque tiene transacciones.');
      return;
    }

    alert((data && data.message) ? data.message : 'No se pudo eliminar la cuenta.');
  }

  async function manejarEliminacionCuenta(event) {
    event.preventDefault();

    var formulario = event.currentTarget;
    var inputIban = formulario.querySelector('input[name="iban"]');
    var boton = formulario.querySelector('button[type="submit"]');

    if (!inputIban || !inputIban.value) {
      alert('No se encontró el IBAN de la cuenta.');
      return;
    }

    if (boton) {
      boton.disabled = true;
    }

    try {
      var respuesta = await fetch('/api/cuentas/eliminar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ iban: inputIban.value })
      });

      var data = await respuesta.json().catch(function () {
        return {};
      });

      if (respuesta.ok && data.ok) {
        window.location.reload();
        return;
      }

      mostrarMensajeError(data);
    } catch (error) {
      alert('No fue posible comunicarse con el servidor.');
    } finally {
      if (boton) {
        boton.disabled = false;
      }
    }
  }

  function leerFormularioCuenta() {
    var ibanNormalizado = normalizarIBAN((document.getElementById('iban') || {}).value);

    return {
      iban: ibanNormalizado,
      aliasCuenta: (document.getElementById('alias') || {}).value,
      moneda: (document.getElementById('moneda') || {}).value,
      saldoActual: (document.getElementById('saldo') || {}).value,
      clientePropietario: (document.getElementById('cliente') || {}).value,
      estado: (document.getElementById('estado-cuenta') || {}).value
    };
  }

  async function enviarGuardarActualizar(payload) {
    var respuesta = await fetch('/api/cuentas/guardar-actualizar', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    var data = await respuesta.json().catch(function () {
      return {};
    });

    return { respuesta: respuesta, data: data };
  }

  async function manejarGuardarActualizarCuenta(event) {
    event.preventDefault();

    var boton = event.currentTarget;
    var payload = leerFormularioCuenta();

    if (!esIBANValido(payload.iban)) {
      alert('IBAN inválido. Debe tener formato: 2 letras de país, 2 dígitos de control y entre 10 y 30 caracteres alfanuméricos. Ejemplo: CR050123000045678901.');
      return;
    }

    var inputIban = document.getElementById('iban');
    if (inputIban) {
      inputIban.value = payload.iban;
    }

    if (boton) {
      boton.disabled = true;
    }

    try {
      var resultado = await enviarGuardarActualizar(payload);

      if (resultado.respuesta.ok && resultado.data.ok) {
        alert(resultado.data.message || 'Cuenta guardada correctamente.');
        window.location.reload();
        return;
      }

      if (resultado.data.reason === 'ACCOUNT_EXISTS_CONFIRM') {
        var confirmar = window.confirm(resultado.data.message || 'La cuenta ya existe. ¿Desea actualizarla?');

        if (!confirmar) {
          return;
        }

        var resultadoConfirmado = await enviarGuardarActualizar({
          iban: payload.iban,
          aliasCuenta: payload.aliasCuenta,
          moneda: payload.moneda,
          saldoActual: payload.saldoActual,
          clientePropietario: payload.clientePropietario,
          estado: payload.estado,
          confirmarActualizacion: true
        });

        if (resultadoConfirmado.respuesta.ok && resultadoConfirmado.data.ok) {
          alert(resultadoConfirmado.data.message || 'Cuenta actualizada correctamente.');
          window.location.reload();
          return;
        }

        alert(resultadoConfirmado.data.message || 'No fue posible actualizar la cuenta.');
        return;
      }

      alert(resultado.data.message || 'No fue posible guardar la cuenta.');
    } catch (error) {
      alert('No fue posible comunicarse con el servidor.');
    } finally {
      if (boton) {
        boton.disabled = false;
      }
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    var formularios = document.querySelectorAll('form[data-eliminar="cuenta"]');
    formularios.forEach(function (formulario) {
      formulario.addEventListener('submit', manejarEliminacionCuenta);
    });

    var botonGuardarActualizar = document.getElementById('btn-guardar-actualizar-cuenta');
    if (botonGuardarActualizar) {
      botonGuardarActualizar.addEventListener('click', manejarGuardarActualizarCuenta);
    }
  });
})();
