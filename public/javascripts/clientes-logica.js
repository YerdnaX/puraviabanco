(function () {
  function normalizarIdentificador(valor) {
    return String(valor || '').trim().toUpperCase();
  }

  function esIdentificadorValido(identificador) {
    var cedulaNacional = /^\d-\d{4}-\d{4}$/;
    var extranjeroNumerico = /^\d{9,20}$/;
    var pasaporte = /^[A-Z]-[A-Z0-9]{6,15}$/;

    return cedulaNacional.test(identificador) ||
      extranjeroNumerico.test(identificador) ||
      pasaporte.test(identificador);
  }

  function mostrarMensajeError(data) {
    if (data && data.reason === 'HAS_TRANSACTIONS') {
      alert('No se puede eliminar este cliente porque tiene transacciones.');
      return;
    }

    alert((data && data.message) ? data.message : 'No se pudo eliminar el cliente.');
  }

  async function manejarEliminacionCliente(event) {
    event.preventDefault();

    var formulario = event.currentTarget;
    var inputId = formulario.querySelector('input[name="identificadorCliente"]');
    var boton = formulario.querySelector('button[type="submit"]');

    if (!inputId || !inputId.value) {
      alert('No se encontró el identificador del cliente.');
      return;
    }

    if (boton) {
      boton.disabled = true;
    }

    try {
      var respuesta = await fetch('/api/clientes/eliminar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ identificadorCliente: inputId.value })
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

  function leerFormularioCliente() {
    var identificadorNormalizado = normalizarIdentificador((document.getElementById('id-cliente') || {}).value);

    return {
      identificadorCliente: identificadorNormalizado,
      nombreCompleto: (document.getElementById('nombre') || {}).value,
      correoElectronico: (document.getElementById('correo') || {}).value,
      telefono: (document.getElementById('telefono') || {}).value,
      fechaNacimiento: (document.getElementById('fecha-nacimiento') || {}).value,
      direccion: (document.getElementById('direccion') || {}).value,
      ocupacion: (document.getElementById('ocupacion') || {}).value,
      estado: (document.getElementById('estado') || {}).value
    };
  }

  async function enviarGuardarActualizar(payload) {
    var respuesta = await fetch('/api/clientes/guardar-actualizar', {
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

  async function manejarGuardarActualizarCliente(event) {
    event.preventDefault();

    var boton = event.currentTarget;
    var payload = leerFormularioCliente();

    if (!esIdentificadorValido(payload.identificadorCliente)) {
      alert('Identificador inválido. Use un formato válido, por ejemplo: 1-0456-1234, 800123456789 o P-99332211.');
      return;
    }

    if (boton) {
      boton.disabled = true;
    }

    try {
      var resultado = await enviarGuardarActualizar(payload);

      if (resultado.respuesta.ok && resultado.data.ok) {
        alert(resultado.data.message || 'Cliente guardado correctamente.');
        window.location.reload();
        return;
      }

      if (resultado.data.reason === 'CLIENT_EXISTS_CONFIRM') {
        var confirmar = window.confirm(resultado.data.message || 'El cliente ya existe. ¿Desea actualizarlo?');

        if (!confirmar) {
          return;
        }

        var resultadoConfirmado = await enviarGuardarActualizar({
          identificadorCliente: payload.identificadorCliente,
          nombreCompleto: payload.nombreCompleto,
          correoElectronico: payload.correoElectronico,
          telefono: payload.telefono,
          fechaNacimiento: payload.fechaNacimiento,
          direccion: payload.direccion,
          ocupacion: payload.ocupacion,
          estado: payload.estado,
          confirmarActualizacion: true
        });

        if (resultadoConfirmado.respuesta.ok && resultadoConfirmado.data.ok) {
          alert(resultadoConfirmado.data.message || 'Cliente actualizado correctamente.');
          window.location.reload();
          return;
        }

        alert(resultadoConfirmado.data.message || 'No fue posible actualizar el cliente.');
        return;
      }

      alert(resultado.data.message || 'No fue posible guardar el cliente.');
    } catch (error) {
      alert('No fue posible comunicarse con el servidor.');
    } finally {
      if (boton) {
        boton.disabled = false;
      }
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    var formularios = document.querySelectorAll('form[data-eliminar="cliente"]');
    formularios.forEach(function (formulario) {
      formulario.addEventListener('submit', manejarEliminacionCliente);
    });

    var botonGuardarActualizar = document.getElementById('btn-guardar-actualizar');
    if (botonGuardarActualizar) {
      botonGuardarActualizar.addEventListener('click', manejarGuardarActualizarCliente);
    }
  });
})();
