var express = require('express');
var router = express.Router();

router.get('/', function (req, res, next) {
  res.render('configuracion', { title: 'Configuración' });
});

router.get('/rangoscomision', function (req, res, next) {
  res.render('rangoscomision', { title: 'Rangos Comisión' });
});

router.get('/tipodecampo', function (req, res, next) {
  res.render('tipodecampo', { title: 'Tipo de Cambio' });
});

module.exports = router;
