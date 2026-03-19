const sql = require('mssql/msnodesqlv8');

//Conexión con autenticación integrada a la BD
const config = {
  connectionString:
    'Driver={ODBC Driver 17 for SQL Server};Server=localhost;Database=SistemaBancarioDB;Trusted_Connection=yes;',
};

//Pool  para reutilizar conexiones
const poolPromise = new sql.ConnectionPool(config)
  .connect()
  .then(pool => {
    console.log('Conectado a SQL Server');
    return pool;
  })
  .catch(err => {
    console.error('Error al conectar a SQL Server', err);
    throw err;
  });

module.exports = { sql, poolPromise };
