var express = require('express');
var router = express.Router();

router.get('/', function (req, res, next) {
  res.render('transacciones', { title: 'Transacciones' });
});

router.get('/deposito', function (req, res, next) {
  res.render('deposito', { title: 'Depósito' });
});

router.get('/retiro', function (req, res, next) {
  res.render('retiro', { title: 'Retiro' });
});

module.exports = router;
