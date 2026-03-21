--  Sistema Bancario Pura Vida

SET NOCOUNT ON;
GO

IF DB_ID(N'SistemaBancarioDB') IS NULL
BEGIN
    CREATE DATABASE SistemaBancarioDB;
END;
GO

USE SistemaBancarioDB;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

/* ==========================================================
   Limpieza para ejecucion repetible del script
   ========================================================== */
IF OBJECT_ID(N'dbo.TRANSACCION_RETIRO', N'U') IS NOT NULL
    DROP TABLE dbo.TRANSACCION_RETIRO;
GO
IF OBJECT_ID(N'dbo.TRANSACCION', N'U') IS NOT NULL
    DROP TABLE dbo.TRANSACCION;
GO
IF OBJECT_ID(N'dbo.CUENTA_BANCARIA', N'U') IS NOT NULL
    DROP TABLE dbo.CUENTA_BANCARIA;
GO
IF OBJECT_ID(N'dbo.V_DESGLOSE_CUOTAS_PRESTAMO', N'V') IS NOT NULL
    DROP VIEW dbo.V_DESGLOSE_CUOTAS_PRESTAMO;
GO
IF OBJECT_ID(N'dbo.V_SOLICITUD_PRESTAMO_CLIENTE', N'V') IS NOT NULL
    DROP VIEW dbo.V_SOLICITUD_PRESTAMO_CLIENTE;
GO
IF OBJECT_ID(N'dbo.SOLICITUD_PRESTAMO', N'U') IS NOT NULL
    DROP TABLE dbo.SOLICITUD_PRESTAMO;
GO
IF OBJECT_ID(N'dbo.CLIENTE', N'U') IS NOT NULL
    DROP TABLE dbo.CLIENTE;
GO
IF OBJECT_ID(N'dbo.TIPO_CAMBIO', N'U') IS NOT NULL
    DROP TABLE dbo.TIPO_CAMBIO;
GO
IF OBJECT_ID(N'dbo.RANGO_COMISION_RETIRO', N'U') IS NOT NULL
    DROP TABLE dbo.RANGO_COMISION_RETIRO;
GO
IF OBJECT_ID(N'dbo.CONTACTO_SOPORTE', N'U') IS NOT NULL
    DROP TABLE dbo.CONTACTO_SOPORTE;
GO

/* ==========================================================
   TABLA: CLIENTE
   ========================================================== */
CREATE TABLE dbo.CLIENTE (
    identificador_cliente VARCHAR(20) NOT NULL,
    nombre_completo NVARCHAR(150) NOT NULL,
    correo_electronico NVARCHAR(120) NOT NULL,
    telefono VARCHAR(20) NOT NULL,
    fecha_nacimiento DATE NOT NULL,
    ocupacion NVARCHAR(100) NOT NULL,
    direccion NVARCHAR(250) NOT NULL,
    fecha_creacion DATETIME2(0) NOT NULL
        CONSTRAINT DF_CLIENTE_FECHA_CREACION DEFAULT SYSDATETIME(),
    estado VARCHAR(10) NOT NULL,
    CONSTRAINT PK_CLIENTE PRIMARY KEY (identificador_cliente),
    CONSTRAINT UQ_CLIENTE_CORREO UNIQUE (correo_electronico),
    CONSTRAINT CK_CLIENTE_ESTADO CHECK (estado IN ('Activo', 'Inactivo'))
);
GO

/* ==========================================================
   TABLA: CUENTA_BANCARIA
   ========================================================== */
CREATE TABLE dbo.CUENTA_BANCARIA (
    iban VARCHAR(34) NOT NULL,
    alias_cuenta NVARCHAR(100) NOT NULL,
    moneda CHAR(3) NOT NULL,
    saldo_actual DECIMAL(18,2) NOT NULL
        CONSTRAINT DF_CUENTA_SALDO DEFAULT (0),
    identificador_cliente VARCHAR(20) NOT NULL,
    fecha_creacion DATETIME2(0) NOT NULL
        CONSTRAINT DF_CUENTA_FECHA_CREACION DEFAULT SYSDATETIME(),
    estado VARCHAR(10) NOT NULL,
    CONSTRAINT PK_CUENTA_BANCARIA PRIMARY KEY (iban),
    CONSTRAINT UQ_CUENTA_IBAN_CLIENTE UNIQUE (iban, identificador_cliente),
    CONSTRAINT FK_CUENTA_CLIENTE
        FOREIGN KEY (identificador_cliente)
        REFERENCES dbo.CLIENTE (identificador_cliente),
    CONSTRAINT CK_CUENTA_MONEDA CHECK (moneda IN ('CRC', 'USD')),
    CONSTRAINT CK_CUENTA_SALDO CHECK (saldo_actual >= 0),
    CONSTRAINT CK_CUENTA_ESTADO CHECK (estado IN ('Activa', 'Inactiva'))
);
GO

/* ==========================================================
   TABLA: TIPO_CAMBIO
   ========================================================== */
CREATE TABLE dbo.TIPO_CAMBIO (
    id_tipo_cambio INT IDENTITY(1,1) NOT NULL,
    moneda_origen CHAR(3) NOT NULL
        CONSTRAINT DF_TIPO_CAMBIO_MONEDA_ORIGEN DEFAULT ('USD'),
    moneda_destino CHAR(3) NOT NULL
        CONSTRAINT DF_TIPO_CAMBIO_MONEDA_DESTINO DEFAULT ('CRC'),
    tipo_cambio_compra DECIMAL(12,4) NOT NULL,
    tipo_cambio_venta DECIMAL(12,4) NOT NULL,
    fecha_modificacion DATETIME2(0) NOT NULL
        CONSTRAINT DF_TIPO_CAMBIO_FECHA DEFAULT SYSDATETIME(),
    registrado_por NVARCHAR(120) NOT NULL,
    activo BIT NOT NULL
        CONSTRAINT DF_TIPO_CAMBIO_ACTIVO DEFAULT (1),
    CONSTRAINT PK_TIPO_CAMBIO PRIMARY KEY (id_tipo_cambio),
    CONSTRAINT CK_TIPO_CAMBIO_MONEDA_ORIGEN CHECK (moneda_origen IN ('CRC', 'USD')),
    CONSTRAINT CK_TIPO_CAMBIO_MONEDA_DESTINO CHECK (moneda_destino IN ('CRC', 'USD')),
    CONSTRAINT CK_TIPO_CAMBIO_MONEDAS_DISTINTAS CHECK (moneda_origen <> moneda_destino),
    CONSTRAINT CK_TIPO_CAMBIO_COMPRA CHECK (tipo_cambio_compra > 0),
    CONSTRAINT CK_TIPO_CAMBIO_VENTA CHECK (tipo_cambio_venta > 0)
);
GO

CREATE UNIQUE INDEX UX_TIPO_CAMBIO_ACTIVO
    ON dbo.TIPO_CAMBIO (moneda_origen, moneda_destino)
    WHERE activo = 1;
GO

/* ==========================================================
   TABLA: RANGO_COMISION_RETIRO
   ========================================================== */
CREATE TABLE dbo.RANGO_COMISION_RETIRO (
    id_rango_comision INT IDENTITY(1,1) NOT NULL,
    monto_minimo DECIMAL(18,2) NOT NULL,
    monto_maximo DECIMAL(18,2) NOT NULL,
    porcentaje_comision DECIMAL(5,2) NOT NULL,
    fecha_modificacion DATETIME2(0) NOT NULL
        CONSTRAINT DF_RANGO_COMISION_FECHA DEFAULT SYSDATETIME(),
    activo BIT NOT NULL
        CONSTRAINT DF_RANGO_COMISION_ACTIVO DEFAULT (1),
    CONSTRAINT PK_RANGO_COMISION_RETIRO PRIMARY KEY (id_rango_comision),
    CONSTRAINT CK_RANGO_COMISION_MINIMO CHECK (monto_minimo >= 0),
    CONSTRAINT CK_RANGO_COMISION_MAXIMO CHECK (monto_maximo >= monto_minimo),
    CONSTRAINT CK_RANGO_COMISION_PORCENTAJE CHECK (
        porcentaje_comision > 0 AND porcentaje_comision <= 100
    )
);
GO

/* ==========================================================
   TABLA: TRANSACCION
   ========================================================== */
CREATE TABLE dbo.TRANSACCION (
    codigo_transaccion VARCHAR(20) NOT NULL,
    iban VARCHAR(34) NOT NULL,
    identificador_cliente VARCHAR(20) NOT NULL,
    tipo_transaccion VARCHAR(10) NOT NULL,
    descripcion NVARCHAR(250) NOT NULL,
    fecha_transaccion DATETIME2(0) NOT NULL
        CONSTRAINT DF_TRANSACCION_FECHA DEFAULT SYSDATETIME(),
    monto DECIMAL(18,2) NOT NULL,
    moneda CHAR(3) NOT NULL,
    tipo_cambio_compra DECIMAL(12,4) NULL,
    tipo_cambio_venta DECIMAL(12,4) NULL,
    saldo_final DECIMAL(18,2) NOT NULL,
    codigo_referencia VARCHAR(20) NULL,
    CONSTRAINT PK_TRANSACCION PRIMARY KEY (codigo_transaccion),
    CONSTRAINT FK_TRANSACCION_CUENTA_CLIENTE
        FOREIGN KEY (iban, identificador_cliente)
        REFERENCES dbo.CUENTA_BANCARIA (iban, identificador_cliente),
    CONSTRAINT FK_TRANSACCION_REFERENCIA
        FOREIGN KEY (codigo_referencia)
        REFERENCES dbo.TRANSACCION (codigo_transaccion),
    CONSTRAINT CK_TRANSACCION_CODIGO CHECK (codigo_transaccion LIKE '[A-Z][A-Z][A-Z]-%'),
    CONSTRAINT CK_TRANSACCION_TIPO CHECK (tipo_transaccion IN ('Deposito', 'Retiro', 'Comision')),
    CONSTRAINT CK_TRANSACCION_MONEDA CHECK (moneda IN ('CRC', 'USD')),
    CONSTRAINT CK_TRANSACCION_MONTO CHECK (monto > 0),
    CONSTRAINT CK_TRANSACCION_SALDO_FINAL CHECK (saldo_final >= 0),
    CONSTRAINT CK_TRANSACCION_TC_COMPRA CHECK (tipo_cambio_compra IS NULL OR tipo_cambio_compra > 0),
    CONSTRAINT CK_TRANSACCION_TC_VENTA CHECK (tipo_cambio_venta IS NULL OR tipo_cambio_venta > 0),
    CONSTRAINT CK_TRANSACCION_TC_CRC CHECK (
        (moneda = 'CRC' AND tipo_cambio_compra IS NULL AND tipo_cambio_venta IS NULL)
        OR moneda = 'USD'
    )
);
GO

/* ==========================================================
   TABLA: TRANSACCION_RETIRO
   Guarda detalle de comision aplicada a cada retiro.
   ========================================================== */
CREATE TABLE dbo.TRANSACCION_RETIRO (
    codigo_transaccion_retiro VARCHAR(20) NOT NULL,
    id_rango_comision INT NOT NULL,
    porcentaje_comision_aplicado DECIMAL(5,2) NOT NULL,
    monto_comision DECIMAL(18,2) NOT NULL,
    saldo_despues_retiro DECIMAL(18,2) NOT NULL,
    codigo_transaccion_comision VARCHAR(20) NULL,
    CONSTRAINT PK_TRANSACCION_RETIRO PRIMARY KEY (codigo_transaccion_retiro),
    CONSTRAINT UQ_TRANSACCION_RETIRO_COMISION UNIQUE (codigo_transaccion_comision),
    CONSTRAINT FK_TRANSACCION_RETIRO_TRANSACCION
        FOREIGN KEY (codigo_transaccion_retiro)
        REFERENCES dbo.TRANSACCION (codigo_transaccion),
    CONSTRAINT FK_TRANSACCION_RETIRO_RANGO
        FOREIGN KEY (id_rango_comision)
        REFERENCES dbo.RANGO_COMISION_RETIRO (id_rango_comision),
    CONSTRAINT FK_TRANSACCION_RETIRO_TRANSACCION_COMISION
        FOREIGN KEY (codigo_transaccion_comision)
        REFERENCES dbo.TRANSACCION (codigo_transaccion),
    CONSTRAINT CK_TRANSACCION_RETIRO_PORCENTAJE CHECK (
        porcentaje_comision_aplicado > 0 AND porcentaje_comision_aplicado <= 100
    ),
    CONSTRAINT CK_TRANSACCION_RETIRO_MONTO_COMISION CHECK (monto_comision >= 0),
    CONSTRAINT CK_TRANSACCION_RETIRO_SALDO CHECK (saldo_despues_retiro >= 0)
);
GO

/* ==========================================================
   TABLA: CONTACTO_SOPORTE
   ========================================================== */
CREATE TABLE dbo.CONTACTO_SOPORTE (
    id_contacto BIGINT IDENTITY(1,1) NOT NULL,
    nombre NVARCHAR(120) NOT NULL,
    correo NVARCHAR(120) NOT NULL,
    telefono VARCHAR(20) NULL,
    asunto NVARCHAR(180) NOT NULL,
    mensaje NVARCHAR(MAX) NOT NULL,
    fecha_contacto DATETIME2(0) NOT NULL
        CONSTRAINT DF_CONTACTO_FECHA DEFAULT SYSDATETIME(),
    estado VARCHAR(10) NOT NULL
        CONSTRAINT DF_CONTACTO_ESTADO DEFAULT ('Pendiente'),
    CONSTRAINT PK_CONTACTO_SOPORTE PRIMARY KEY (id_contacto),
    CONSTRAINT CK_CONTACTO_ESTADO CHECK (estado IN ('Pendiente', 'Atendido'))
);
GO
/* ==========================================================
   TABLA: Solicitud de prestamo
   ========================================================== */
CREATE TABLE dbo.SOLICITUD_PRESTAMO (
    numero_solicitud INT IDENTITY(1,1) NOT NULL,
    fecha_solicitud DATETIME2(0) NOT NULL
        CONSTRAINT DF_SOLICITUD_PRESTAMO_FECHA DEFAULT SYSDATETIME(),
    identificador_cliente VARCHAR(20) NOT NULL,
    monto_prestamo DECIMAL(18,2) NOT NULL,
    plazo_meses TINYINT NOT NULL,
    cuota_mensual AS CAST(
        ROUND(
            monto_prestamo / NULLIF(CAST(plazo_meses AS DECIMAL(18,2)), 0),
            2
        ) AS DECIMAL(18,2)
    ) PERSISTED,
    estado VARCHAR(10) NOT NULL
        CONSTRAINT DF_SOLICITUD_PRESTAMO_ESTADO DEFAULT ('Pendiente'),
    CONSTRAINT PK_SOLICITUD_PRESTAMO PRIMARY KEY (numero_solicitud),
    CONSTRAINT FK_SOLICITUD_PRESTAMO_CLIENTE
        FOREIGN KEY (identificador_cliente)
        REFERENCES dbo.CLIENTE (identificador_cliente),
    CONSTRAINT CK_SOLICITUD_PRESTAMO_MONTO CHECK (monto_prestamo > 0),
    CONSTRAINT CK_SOLICITUD_PRESTAMO_PLAZO CHECK (plazo_meses IN (4, 6, 9, 12)),
    CONSTRAINT CK_SOLICITUD_PRESTAMO_ESTADO CHECK (estado IN ('Pendiente', 'Aprobada', 'Rechazada'))
);
GO

CREATE INDEX IX_SOLICITUD_PRESTAMO_CLIENTE_FECHA
    ON dbo.SOLICITUD_PRESTAMO (identificador_cliente, fecha_solicitud DESC);
GO

CREATE VIEW dbo.V_SOLICITUD_PRESTAMO_CLIENTE AS
SELECT
    sp.numero_solicitud,
    sp.fecha_solicitud,
    sp.identificador_cliente,
    c.nombre_completo,
    sp.monto_prestamo,
    sp.plazo_meses,
    sp.cuota_mensual,
    sp.estado
FROM dbo.SOLICITUD_PRESTAMO sp
INNER JOIN dbo.CLIENTE c
    ON c.identificador_cliente = sp.identificador_cliente;
GO

CREATE VIEW dbo.V_DESGLOSE_CUOTAS_PRESTAMO AS
SELECT
    sp.numero_solicitud,
    sp.identificador_cliente,
    c.nombre_completo,
    cuotas.numero_cuota,
    DATEADD(MONTH, cuotas.numero_cuota, CAST(sp.fecha_solicitud AS DATE)) AS fecha_cuota,
    sp.cuota_mensual AS monto_cuota,
    CAST(
        CASE
            WHEN sp.monto_prestamo - (sp.cuota_mensual * cuotas.numero_cuota) < 0 THEN 0
            ELSE ROUND(sp.monto_prestamo - (sp.cuota_mensual * cuotas.numero_cuota), 2)
        END
        AS DECIMAL(18,2)
    ) AS saldo_estimado
FROM dbo.SOLICITUD_PRESTAMO sp
INNER JOIN dbo.CLIENTE c
    ON c.identificador_cliente = sp.identificador_cliente
CROSS APPLY (
    VALUES (1), (2), (3), (4), (5), (6), (7), (8), (9), (10), (11), (12)
) AS cuotas(numero_cuota)
WHERE cuotas.numero_cuota <= sp.plazo_meses;
GO


/* ==========================================================
   Datos iniciales y datos de prueba
   ========================================================== */
IF NOT EXISTS (SELECT 1 FROM dbo.CLIENTE)
BEGIN
    INSERT INTO dbo.CLIENTE (
        identificador_cliente,
        nombre_completo,
        correo_electronico,
        telefono,
        fecha_nacimiento,
        ocupacion,
        direccion,
        fecha_creacion,
        estado
    )
    VALUES
        ('1-0456-1234', N'Laura Fernandez Rojas', N'laura.fernandez@bpv.cr', '8888-1200', '1992-04-12', N'Arquitecta', N'San Jose, Montes de Oca', '2026-03-18T10:34:00', 'Activo'),
        ('800123456789', N'Wei Zhang', N'w.zhang@bpv.cr', '7090-4433', '1985-09-05', N'Profesor', N'Heredia, Santo Domingo', '2026-03-15T09:00:00', 'Inactivo'),
        ('P-99332211', N'Sofia Morales', N'sofia.m@bpv.cr', '8630-2209', '1998-01-22', N'Disenadora UX', N'Cartago, Paraiso', '2026-03-10T14:20:00', 'Activo'),
        ('2-1234-5678', N'Carlos Mendez Soto', N'carlos.mendez@bpv.cr', '8777-9080', '1990-11-30', N'Contador', N'Alajuela, Grecia', '2026-03-12T11:10:00', 'Activo');
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.SOLICITUD_PRESTAMO)
BEGIN
    INSERT INTO dbo.SOLICITUD_PRESTAMO (
        fecha_solicitud,
        identificador_cliente,
        monto_prestamo,
        plazo_meses,
        estado
    )
    VALUES
        ('2026-03-19T10:00:00', '1-0456-1234', 1200000.00, 12, 'Aprobada'),
        ('2026-03-20T14:10:00', 'P-99332211', 540000.00, 6, 'Pendiente'),
        ('2026-03-18T09:20:00', '2-1234-5678', 360000.00, 4, 'Rechazada');
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.CUENTA_BANCARIA)
BEGIN
    INSERT INTO dbo.CUENTA_BANCARIA (
        iban,
        alias_cuenta,
        moneda,
        saldo_actual,
        identificador_cliente,
        fecha_creacion,
        estado
    )
    VALUES
        ('CR050123000045678901', N'Ahorros casa', 'CRC', 1540000.00, '1-0456-1234', '2026-03-18T10:34:00', 'Activa'),
        ('CR239876543210987654', N'Ahorro en USD', 'USD', 7788.00, '800123456789', '2026-03-15T09:05:00', 'Inactiva'),
        ('CR115500102030405060', N'Cuenta viajes', 'CRC', 286400.00, 'P-99332211', '2026-03-10T14:30:00', 'Activa'),
        ('CR870001002003004005', N'Fondo emergencia USD', 'USD', 2500.00, '1-0456-1234', '2026-03-18T11:20:00', 'Activa'),
        ('CR330020003000400050', N'Cuenta principal', 'CRC', 975000.00, '2-1234-5678', '2026-03-12T11:15:00', 'Activa');
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.TIPO_CAMBIO)
BEGIN
    INSERT INTO dbo.TIPO_CAMBIO (
        moneda_origen,
        moneda_destino,
        tipo_cambio_compra,
        tipo_cambio_venta,
        fecha_modificacion,
        registrado_por,
        activo
    )
    VALUES (
        'USD',
        'CRC',
        522.0000,
        534.0000,
        SYSDATETIME(),
        N'Admin',
        1
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.RANGO_COMISION_RETIRO)
BEGIN
    INSERT INTO dbo.RANGO_COMISION_RETIRO (
        monto_minimo,
        monto_maximo,
        porcentaje_comision,
        fecha_modificacion,
        activo
    )
    VALUES
        (0.00, 100000.00, 1.50, SYSDATETIME(), 1),
        (100001.00, 500000.00, 3.00, SYSDATETIME(), 1),
        (500001.00, 2000000.00, 4.50, SYSDATETIME(), 1);
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.TRANSACCION)
BEGIN
    INSERT INTO dbo.TRANSACCION (
        codigo_transaccion,
        iban,
        identificador_cliente,
        tipo_transaccion,
        descripcion,
        fecha_transaccion,
        monto,
        moneda,
        tipo_cambio_compra,
        tipo_cambio_venta,
        saldo_final,
        codigo_referencia
    )
    VALUES
        ('TRX-87433', 'CR050123000045678901', '1-0456-1234', 'Retiro', N'Pago renta', '2026-03-17T15:30:00', 120000.00, 'CRC', NULL, NULL, 1290000.00, NULL),
        ('TRX-87432', 'CR050123000045678901', '1-0456-1234', 'Deposito', N'Nomina marzo', '2026-03-18T08:00:00', 253600.00, 'CRC', NULL, NULL, 1540000.00, NULL),
        ('TRX-87450', 'CR239876543210987654', '800123456789', 'Deposito', N'Transferencia internacional', '2026-03-15T09:30:00', 8200.00, 'USD', 522.0000, 534.0000, 8200.00, NULL),
        ('TRX-87451', 'CR239876543210987654', '800123456789', 'Retiro', N'Pago renta', '2026-03-18T09:45:00', 400.00, 'USD', 522.0000, 534.0000, 7800.00, NULL),
        ('TRX-87460', 'CR115500102030405060', 'P-99332211', 'Deposito', N'Abono ahorro', '2026-03-12T16:00:00', 300000.00, 'CRC', NULL, NULL, 300000.00, NULL),
        ('TRX-87461', 'CR115500102030405060', 'P-99332211', 'Retiro', N'Compra boletos', '2026-03-13T10:10:00', 20000.00, 'CRC', NULL, NULL, 280000.00, NULL),
        ('TRX-87462', 'CR115500102030405060', 'P-99332211', 'Deposito', N'Complemento ahorro', '2026-03-18T11:00:00', 6700.00, 'CRC', NULL, NULL, 286400.00, NULL),
        ('TRX-87500', 'CR870001002003004005', '1-0456-1234', 'Deposito', N'Ahorro en dolares', '2026-03-18T12:00:00', 2500.00, 'USD', 522.0000, 534.0000, 2500.00, NULL),
        ('TRX-87510', 'CR330020003000400050', '2-1234-5678', 'Deposito', N'Capital inicial', '2026-03-12T11:30:00', 975000.00, 'CRC', NULL, NULL, 975000.00, NULL),
        ('COM-87433', 'CR050123000045678901', '1-0456-1234', 'Comision', N'3% sobre retiro', '2026-03-17T15:31:00', 3600.00, 'CRC', NULL, NULL, 1286400.00, 'TRX-87433'),
        ('COM-87451', 'CR239876543210987654', '800123456789', 'Comision', N'3% sobre retiro', '2026-03-18T09:46:00', 12.00, 'USD', 522.0000, 534.0000, 7788.00, 'TRX-87451'),
        ('COM-87461', 'CR115500102030405060', 'P-99332211', 'Comision', N'1.5% sobre retiro', '2026-03-13T10:11:00', 300.00, 'CRC', NULL, NULL, 279700.00, 'TRX-87461');
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.TRANSACCION_RETIRO)
BEGIN
    INSERT INTO dbo.TRANSACCION_RETIRO (
        codigo_transaccion_retiro,
        id_rango_comision,
        porcentaje_comision_aplicado,
        monto_comision,
        saldo_despues_retiro,
        codigo_transaccion_comision
    )
    VALUES
        ('TRX-87433', 2, 3.00, 3600.00, 1290000.00, 'COM-87433'),
        ('TRX-87451', 2, 3.00, 12.00, 7800.00, 'COM-87451'),
        ('TRX-87461', 1, 1.50, 300.00, 280000.00, 'COM-87461');
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.CONTACTO_SOPORTE)
BEGIN
    INSERT INTO dbo.CONTACTO_SOPORTE (
        nombre,
        correo,
        telefono,
        asunto,
        mensaje,
        fecha_contacto,
        estado
    )
    VALUES
        (N'Maria Quesada', N'maria.q@bpv.cr', '8888-0001', N'Consulta de acceso', N'No puedo ingresar al panel de transacciones.', '2026-03-18T10:00:00', 'Pendiente'),
        (N'Jose Aguilar', N'jose.a@bpv.cr', '8888-0002', N'Ajuste de tipo de cambio', N'Solicito revisar la fecha de actualizacion del tipo de cambio.', '2026-03-18T11:40:00', 'Atendido');
END;
GO
