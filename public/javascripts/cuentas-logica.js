(function () {
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

  document.addEventListener('DOMContentLoaded', function () {
    var formularios = document.querySelectorAll('form[data-eliminar="cuenta"]');
    formularios.forEach(function (formulario) {
      formulario.addEventListener('submit', manejarEliminacionCuenta);
    });
  });
})();
