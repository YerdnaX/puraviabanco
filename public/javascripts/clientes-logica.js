(function () {
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

  document.addEventListener('DOMContentLoaded', function () {
    var formularios = document.querySelectorAll('form[data-eliminar="cliente"]');
    formularios.forEach(function (formulario) {
      formulario.addEventListener('submit', manejarEliminacionCliente);
    });
  });
})();
