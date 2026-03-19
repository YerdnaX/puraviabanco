var express = require('express');
var router = express.Router();

router.get('/', function (req, res, next) {
  res.render('configuracion', { title: 'Configuracion' });
});

router.get('/rangoscomision', function (req, res, next) {
  res.render('rangoscomision', { title: 'Rangos Comision' });
});

router.get('/tipodecampo', function (req, res, next) {
  res.render('tipodecampo', { title: 'Tipo de Cambio' });
});

module.exports = router;
