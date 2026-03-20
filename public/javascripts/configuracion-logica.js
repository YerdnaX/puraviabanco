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

	function leerRangosComisionFormulario() {
		var rangos = [];

		for (var i = 1; i <= 3; i += 1) {
			var minimo = document.querySelector('input[data-campo="minimo"][data-rango="' + i + '"]');
			var maximo = document.querySelector('input[data-campo="maximo"][data-rango="' + i + '"]');
			var porcentaje = document.querySelector('input[data-campo="porcentaje"][data-rango="' + i + '"]');

			rangos.push({
				montoMinimo: Number((minimo || {}).value),
				montoMaximo: Number((maximo || {}).value),
				porcentajeComision: Number((porcentaje || {}).value)
			});
		}

		return rangos;
	}

	function validarRangosComision(rangos) {
		if (!Array.isArray(rangos) || rangos.length !== 3) {
			return 'Debe definir exactamente 3 rangos.';
		}

		for (var i = 0; i < rangos.length; i += 1) {
			var actual = rangos[i];

			if (
				!Number.isFinite(actual.montoMinimo) ||
				!Number.isFinite(actual.montoMaximo) ||
				!Number.isFinite(actual.porcentajeComision)
			) {
				return 'Todos los valores deben ser numéricos.';
			}

			if (!Number.isInteger(actual.montoMinimo) || !Number.isInteger(actual.montoMaximo)) {
				return 'Los montos mínimo y máximo deben ser enteros.';
			}

			if (actual.montoMinimo < 0 || actual.montoMaximo < actual.montoMinimo) {
				return 'Cada rango debe tener mínimo >= 0 y máximo >= mínimo.';
			}

			if (actual.porcentajeComision <= 0 || actual.porcentajeComision > 100) {
				return 'El porcentaje de comisión debe estar entre 0 y 100.';
			}
		}

		for (var j = 1; j < rangos.length; j += 1) {
			var previo = rangos[j - 1];
			var siguiente = rangos[j];

			if (siguiente.montoMinimo !== (previo.montoMaximo + 1)) {
				return 'Los rangos no deben trasponerse: el siguiente mínimo debe ser máximo anterior + 1.';
			}
		}

		return '';
	}

	function llenarRangosEnPantalla(rangos) {
		if (!Array.isArray(rangos) || rangos.length === 0) {
			return;
		}

		for (var i = 0; i < 3; i += 1) {
			var rango = rangos[i];
			if (!rango) {
				continue;
			}

			var minimo = document.querySelector('input[data-campo="minimo"][data-rango="' + (i + 1) + '"]');
			var maximo = document.querySelector('input[data-campo="maximo"][data-rango="' + (i + 1) + '"]');
			var porcentaje = document.querySelector('input[data-campo="porcentaje"][data-rango="' + (i + 1) + '"]');

			if (minimo) {
				minimo.value = Number(rango.monto_minimo || 0);
			}

			if (maximo) {
				maximo.value = Number(rango.monto_maximo || 0);
			}

			if (porcentaje) {
				porcentaje.value = Number(rango.porcentaje_comision || 0);
			}
		}
	}

	async function obtenerUltimosRangos() {
		var respuesta = await fetch('/api/configuracion/rangos-comision', {
			method: 'GET',
			headers: {
				'Accept': 'application/json'
			}
		});

		var data = await respuesta.json().catch(function () {
			return {};
		});

		return { respuesta: respuesta, data: data };
	}

	async function guardarRangos(payload) {
		var respuesta = await fetch('/api/configuracion/rangos-comision', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Accept': 'application/json'
			},
			body: JSON.stringify({ rangos: payload })
		});

		var data = await respuesta.json().catch(function () {
			return {};
		});

		return { respuesta: respuesta, data: data };
	}

	async function manejarUltimosRangos(event) {
		event.preventDefault();

		var boton = event.currentTarget;
		if (boton) {
			boton.disabled = true;
		}

		try {
			var resultado = await obtenerUltimosRangos();

			if (resultado.respuesta.ok && resultado.data.ok) {
				llenarRangosEnPantalla(resultado.data.data || []);
				alert('Se cargaron en pantalla los últimos rangos activos.');
				return;
			}

			alert(resultado.data.message || 'No fue posible consultar los últimos rangos.');
		} catch (error) {
			alert('No fue posible comunicarse con el servidor.');
		} finally {
			if (boton) {
				boton.disabled = false;
			}
		}
	}

	async function manejarGuardarRangos(event) {
		event.preventDefault();

		var boton = document.getElementById('btn-guardar-rangos');
		var rangos = leerRangosComisionFormulario();
		var errorValidacion = validarRangosComision(rangos);

		if (errorValidacion) {
			alert(errorValidacion);
			return;
		}

		if (boton) {
			boton.disabled = true;
		}

		try {
			var resultado = await guardarRangos(rangos);

			if (resultado.respuesta.ok && resultado.data.ok) {
				alert(resultado.data.message || 'Rangos guardados correctamente.');
				window.location.reload();
				return;
			}

			alert(resultado.data.message || 'No fue posible guardar los rangos.');
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

		var botonUltimosRangos = document.getElementById('btn-ultimos-rangos');
		if (botonUltimosRangos) {
			botonUltimosRangos.addEventListener('click', manejarUltimosRangos);
		}

		var formularioRangos = document.getElementById('form-rangos-comision');
		if (formularioRangos) {
			formularioRangos.addEventListener('submit', manejarGuardarRangos);
		}
	});
})();
