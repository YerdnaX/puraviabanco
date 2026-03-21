(function () {
  function normalizarIdentificador(valor) {
    return String(valor || '').trim().toUpperCase();
  }

  function convertirMontoNumero(valor) {
    var texto = String(valor || '').trim().replace(/,/g, '');
    return Number(texto);
  }

  function leerPlazoMeses(valorSelect) {
    var texto = String(valorSelect || '').trim();
    var numero = Number(texto);

    if (Number.isInteger(numero)) {
      return numero;
    }

    var coincidencia = texto.match(/\d+/);
    return coincidencia ? Number(coincidencia[0]) : NaN;
  }

  function leerFormularioPrestamo() {
    return {
      identificadorCliente: normalizarIdentificador((document.getElementById('id-cliente') || {}).value),
      montoPrestamo: convertirMontoNumero((document.getElementById('monto') || {}).value),
      plazoMeses: leerPlazoMeses((document.getElementById('plazomeses') || {}).value)
    };
  }

  async function solicitarPrestamo(datospaenviar) {
    var respuesta = await fetch('/api/prestamos/solicitar', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(datospaenviar)
    });

    var data = await respuesta.json().catch(function () {
      return {};
    });

    return { respuesta: respuesta, data: data };
  }

  async function manejarSolicitarPrestamo(event) {
    event.preventDefault();

    var boton = event.currentTarget;
    var datospaenviar = leerFormularioPrestamo();

    if (!datospaenviar.identificadorCliente) {
      alert('Debe ingresar el identificador del cliente.');
      return;
    }

    if (!Number.isFinite(datospaenviar.montoPrestamo) || datospaenviar.montoPrestamo <= 0) {
      alert('El monto del prestamo debe ser un numero mayor a cero.');
      return;
    }

    if (![4, 6, 9, 12].includes(datospaenviar.plazoMeses)) {
      alert('El plazo del prestamo debe ser 4, 6, 9 o 12 meses.');
      return;
    }

    if (boton) {
      boton.disabled = true;
    }

    try {
      var resultado = await solicitarPrestamo(datospaenviar);

      if (resultado.respuesta.ok && resultado.data.ok) {
        alert(resultado.data.message || 'Solicitud registrada correctamente.');
        window.location.reload();
        return;
      }

      if (resultado.data && resultado.data.reason === 'CLIENT_NOT_FOUND') {
        alert('Ese cliente no existe.');
        return;
      }

      alert((resultado.data && resultado.data.message) ? resultado.data.message : 'No fue posible registrar la solicitud.');
    } catch (error) {
      alert('error de conexion');
    } finally {
      if (boton) {
        boton.disabled = false;
      }
    }
  }

  window.manejarSolicitarPrestamo = manejarSolicitarPrestamo;
})();
