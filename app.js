var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var clientesRouter = require('./routes/clientes');
var panelRouter = require('./routes/panel');
var cuentasRouter = require('./routes/cuentas');
var transaccionesRouter = require('./routes/transacciones');
var configuracionRouter = require('./routes/configuracion');
var contactoRouter = require('./routes/contacto');
var APIRouter = require('./routes/api');
var prestamosRouter = require('./routes/prestamos');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/clientes', clientesRouter);
app.use('/panel', panelRouter);
app.use('/cuentas', cuentasRouter);
app.use('/transacciones', transaccionesRouter); 
app.use('/configuracion', configuracionRouter);
app.use('/contacto', contactoRouter);
app.use('/api', APIRouter);
app.use('/prestamos', prestamosRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
