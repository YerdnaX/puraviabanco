(function () {
	function formatearMonto(valor, moneda) {
		var simbolo = moneda === 'USD' ? '$' : '₡';
		var numero = Number(valor || 0);
		var texto = new Intl.NumberFormat('es-CR', {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		}).format(numero);

		return simbolo + ' ' + texto + ' ' + moneda;
	}

	function formatearFecha(fechaIso) {
		if (!fechaIso) {
			return 'N/D';
		}

		var fecha = new Date(fechaIso);
		if (Number.isNaN(fecha.getTime())) {
			return 'N/D';
		}

		return new Intl.DateTimeFormat('es-CR', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
			hour12: true,
			timeZone: 'America/Costa_Rica'
		}).format(fecha);
	}

	function asignarTexto(id, valor) {
		var elemento = document.getElementById(id);
		if (elemento) {
			elemento.textContent = valor;
		}
	}

	function renderizarResumenTransaccion(configuracion) {
		var contenedor = document.getElementById(configuracion.seccionId);
		if (!contenedor) {
			return;
		}

		(configuracion.campos || []).forEach(function (campo) {
			asignarTexto(campo.id, campo.valor);
		});

		contenedor.style.display = 'block';
		contenedor.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	function mostrarResultadoDeposito(data) {
		if (!data) {
			return;
		}

		renderizarResumenTransaccion({
			seccionId: 'resultado-deposito',
			campos: [
				{ id: 'res-codigo', valor: data.codigoTransaccion || 'N/D' },
				{ id: 'res-iban', valor: data.iban || 'N/D' },
				{ id: 'res-descripcion', valor: data.descripcion || 'N/D' },
				{ id: 'res-fecha', valor: formatearFecha(data.fechaTransaccion) },
				{ id: 'res-monto-ingresado', valor: formatearMonto(data.montoIngresado, data.monedaDeposito || 'CRC') },
				{ id: 'res-monto-acreditado', valor: formatearMonto(data.montoAcreditado, data.monedaCuenta || 'CRC') },
				{ id: 'res-saldo-final', valor: formatearMonto(data.saldoFinal, data.monedaCuenta || 'CRC') },
				{ id: 'res-tipo-cambio', valor: data.tipoCambioAplicado || 'No aplica' }
			]
		});
	}

	function mostrarResultadoRetiro(data) {
		if (!data) {
			return;
		}

		renderizarResumenTransaccion({
			seccionId: 'resultado-retiro',
			campos: [
				{ id: 'res-retiro-id', valor: data.codigoRetiro || 'N/D' },
				{ id: 'res-comision-id', valor: data.codigoComision || 'N/D' },
				{ id: 'res-retiro-iban', valor: data.iban || 'N/D' },
				{ id: 'res-retiro-fecha', valor: formatearFecha(data.fechaTransaccion) },
				{ id: 'res-retiro-monto', valor: formatearMonto(data.montoRetiro, data.monedaCuenta || 'CRC') },
				{ id: 'res-retiro-comision', valor: formatearMonto(data.montoComision, data.monedaCuenta || 'CRC') },
				{ id: 'res-retiro-saldo-final', valor: formatearMonto(data.saldoFinal, data.monedaCuenta || 'CRC') },
				{ id: 'res-retiro-tipo-cambio', valor: data.tipoCambioAplicado || 'No aplica' }
			]
		});
	}

	function actualizarPanelComision(data) {
		if (!data) {
			return;
		}

		asignarTexto('retiro-rango-aplicado', data.rangoAplicado || 'N/D');
		asignarTexto('retiro-porcentaje-comision', (data.porcentajeComision != null ? (data.porcentajeComision + ' %') : 'N/D'));
		asignarTexto('retiro-comision-calculada', formatearMonto(data.montoComision, data.monedaCuenta || 'CRC'));
		asignarTexto('retiro-saldo-tras-retiro', formatearMonto(data.saldoDespuesRetiro, data.monedaCuenta || 'CRC'));
		asignarTexto('retiro-pill-comision', formatearMonto(data.montoComision, data.monedaCuenta || 'CRC'));
	}

	function leerFormularioDeposito() {
		return {
			cuentaDeposito: (document.getElementById('cuenta-deposito') || {}).value,
			descripcion: (document.getElementById('descripcion-deposito') || {}).value,
			monto: (document.getElementById('monto-deposito') || {}).value,
			moneda: (document.getElementById('moneda-deposito') || {}).value
		};
	}

	function leerFormularioRetiro() {
		return {
			cuentaRetiro: (document.getElementById('cuenta-retiro') || {}).value,
			descripcion: (document.getElementById('descripcion-retiro') || {}).value,
			monto: (document.getElementById('monto-retiro') || {}).value,
			moneda: (document.getElementById('moneda-retiro') || {}).value
		};
	}

	async function registrarDeposito(payload) {
		var respuesta = await fetch('/api/transacciones/deposito', {
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

	async function registrarRetiro(payload) {
		var respuesta = await fetch('/api/transacciones/retiro', {
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

	async function manejarRegistroDeposito(event) {
		event.preventDefault();

		var boton = event.currentTarget;
		var payload = leerFormularioDeposito();

		if (boton) {
			boton.disabled = true;
		}

		try {
			var resultado = await registrarDeposito(payload);

			if (resultado.respuesta.ok && resultado.data.ok) {
				alert(resultado.data.message || 'Depósito registrado correctamente.');
				mostrarResultadoDeposito(resultado.data.data || {});
				return;
			}

			alert(resultado.data.message || 'No fue posible registrar el depósito.');
		} catch (error) {
			alert('No fue posible comunicarse con el servidor.');
		} finally {
			if (boton) {
				boton.disabled = false;
			}
		}
	}

	async function manejarRegistroRetiro(event) {
		event.preventDefault();

		var boton = event.currentTarget;
		var payload = leerFormularioRetiro();

		if (boton) {
			boton.disabled = true;
		}

		try {
			var resultado = await registrarRetiro(payload);

			if (resultado.respuesta.ok && resultado.data.ok) {
				alert(resultado.data.message || 'Retiro registrado correctamente.');
				actualizarPanelComision(resultado.data.data || {});
				mostrarResultadoRetiro(resultado.data.data || {});
				return;
			}

			alert(resultado.data.message || 'No fue posible registrar el retiro.');
		} catch (error) {
			alert('No fue posible comunicarse con el servidor.');
		} finally {
			if (boton) {
				boton.disabled = false;
			}
		}
	}

	document.addEventListener('DOMContentLoaded', function () {
		var botonRegistrarDeposito = document.getElementById('btn-registrar-deposito');
		if (botonRegistrarDeposito) {
			botonRegistrarDeposito.addEventListener('click', manejarRegistroDeposito);
		}

		var botonRegistrarRetiro = document.getElementById('btn-registrar-retiro');
		if (botonRegistrarRetiro) {
			botonRegistrarRetiro.addEventListener('click', manejarRegistroRetiro);
		}
	});
})();
