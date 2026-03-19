var express = require('express');
var router = express.Router();

router.get('/', function (req, res, next) {
  res.render('clientes', { title: 'Clientes' });
});

router.get('/transaccionescliente', function (req, res, next) {
  res.render('transaccionescliente', { title: 'Transacciones Cliente' });
});

module.exports = router;