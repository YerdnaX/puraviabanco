var express = require('express');
var router = express.Router();

router.get('/', function (req, res, next) {
  res.render('cuentas', { title: 'Cuentas' });
});

router.get('/transaccionescuenta', function (req, res, next) {
  res.render('transaccionescuenta', { title: 'Transacciones Cuenta' });
});

module.exports = router;