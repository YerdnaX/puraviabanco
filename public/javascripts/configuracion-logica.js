(function () {
	function leerFormularioTipoCambio() {
		return {
			compra: (document.getElementById('compra') || {}).value,
			venta: (document.getElementById('venta') || {}).value,
			registradoPor: (document.getElementById('registrado') || {}).value
		};
	}

	async function registrarTipoCambio(payload) {
		var respuesta = await fetch('/api/configuracion/tipo-cambio', {
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

	async function manejarActualizarTipoCambio(event) {
		event.preventDefault();

		var boton = event.currentTarget;
		var payload = leerFormularioTipoCambio();

		if (boton) {
			boton.disabled = true;
		}

		try {
			var resultado = await registrarTipoCambio(payload);

			if (resultado.respuesta.ok && resultado.data.ok) {
				alert(resultado.data.message || 'Tipo de cambio actualizado correctamente.');
				window.location.reload();
				return;
			}

			alert(resultado.data.message || 'No fue posible actualizar el tipo de cambio.');
		} catch (error) {
			alert('No fue posible comunicarse con el servidor.');
		} finally {
			if (boton) {
				boton.disabled = false;
			}
		}
	}

	document.addEventListener('DOMContentLoaded', function () {
		var botonActualizar = document.getElementById('btn-actualizar-tipo-cambio');
		if (botonActualizar) {
			botonActualizar.addEventListener('click', manejarActualizarTipoCambio);
		}
	});
})();
