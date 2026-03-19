--- Sistema bancario V1 Sin validaciones

CREATE DATABASE SistemaBancarioDB;
GO

USE SistemaBancarioDB;
GO

-- =========================================
-- TABLA: CLIENTE
-- =========================================
CREATE TABLE CLIENTE (
    id_cliente INT PRIMARY KEY IDENTITY(1,1),
    nombre_completo NVARCHAR(150) NOT NULL,
    correo_electronico NVARCHAR(120) NOT NULL,
    telefono NVARCHAR(20) NOT NULL,
    fecha_nacimiento DATE NOT NULL,
    direccion NVARCHAR(250) NOT NULL,
    ocupacion NVARCHAR(100) NOT NULL,
    fecha_creacion DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    estado VARCHAR(20) NOT NULL
);
GO

-- =========================================
-- TABLA: TIPO_CAMBIO
-- =========================================
CREATE TABLE TIPO_CAMBIO (
    id_tipo_cambio INT PRIMARY KEY IDENTITY(1,1),
    tipo_cambio_compra DECIMAL(18,4) NOT NULL,
    tipo_cambio_venta DECIMAL(18,4) NOT NULL,
    fecha_actualizacion DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);
GO

-- =========================================
-- TABLA: RANGO_COMISION_RETIRO
-- =========================================
CREATE TABLE RANGO_COMISION_RETIRO (
    id_rango_comision INT PRIMARY KEY IDENTITY(1,1),
    monto_minimo DECIMAL(18,2) NOT NULL,
    monto_maximo DECIMAL(18,2) NOT NULL,
    porcentaje_comision DECIMAL(5,2) NOT NULL,
    fecha_actualizacion DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);
GO

-- =========================================
-- TABLA: CUENTA_BANCARIA
-- =========================================
CREATE TABLE CUENTA_BANCARIA (
    numero_cuenta VARCHAR(34) PRIMARY KEY,
    alias_cuenta NVARCHAR(100) NOT NULL,
    tipo_moneda CHAR(3) NOT NULL,
    saldo_actual DECIMAL(18,2) NOT NULL DEFAULT 0,
    id_cliente INT NOT NULL,
    fecha_creacion DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    estado VARCHAR(20) NOT NULL,

    CONSTRAINT FK_CUENTA_CLIENTE
        FOREIGN KEY (id_cliente) REFERENCES CLIENTE(id_cliente)
);
GO

-- =========================================
-- TABLA: TRANSACCION
-- =========================================
CREATE TABLE TRANSACCION (
    id_transaccion INT PRIMARY KEY IDENTITY(1,1),
    numero_cuenta VARCHAR(34) NOT NULL,
    id_cliente INT NOT NULL,
    tipo_transaccion VARCHAR(30) NOT NULL,
    descripcion NVARCHAR(250) NOT NULL,
    fecha_transaccion DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    monto DECIMAL(18,2) NOT NULL,
    saldo_actualizado DECIMAL(18,2) NOT NULL,
    id_transaccion_referencia INT NULL,

    CONSTRAINT FK_TRANSACCION_CUENTA
        FOREIGN KEY (numero_cuenta) REFERENCES CUENTA_BANCARIA(numero_cuenta),

    CONSTRAINT FK_TRANSACCION_CLIENTE
        FOREIGN KEY (id_cliente) REFERENCES CLIENTE(id_cliente),

    CONSTRAINT FK_TRANSACCION_REFERENCIA
        FOREIGN KEY (id_transaccion_referencia) REFERENCES TRANSACCION(id_transaccion)
);
GO


-- Sistema Bancario V2 con validaciones :D

   CREATE DATABASE SistemaBancarioDB;
GO

USE SistemaBancarioDB;
GO

CREATE TABLE CLIENTE (
    id_cliente INT PRIMARY KEY IDENTITY(1,1),
    nombre_completo NVARCHAR(150) NOT NULL,
    correo_electronico NVARCHAR(120) NOT NULL UNIQUE,
    telefono NVARCHAR(20) NOT NULL,
    fecha_nacimiento DATE NOT NULL,
    direccion NVARCHAR(250) NOT NULL,
    ocupacion NVARCHAR(100) NOT NULL,
    fecha_creacion DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    estado VARCHAR(20) NOT NULL
        CHECK (estado IN ('Activo', 'Inactivo'))
);
GO

CREATE TABLE TIPO_CAMBIO (
    id_tipo_cambio INT PRIMARY KEY IDENTITY(1,1),
    tipo_cambio_compra DECIMAL(18,4) NOT NULL
        CHECK (tipo_cambio_compra > 0),
    tipo_cambio_venta DECIMAL(18,4) NOT NULL
        CHECK (tipo_cambio_venta > 0),
    fecha_actualizacion DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);
GO

CREATE TABLE RANGO_COMISION_RETIRO (
    id_rango_comision INT PRIMARY KEY IDENTITY(1,1),
    monto_minimo DECIMAL(18,2) NOT NULL
        CHECK (monto_minimo >= 0),
    monto_maximo DECIMAL(18,2) NOT NULL
        CHECK (monto_maximo >= monto_minimo),
    porcentaje_comision DECIMAL(5,2) NOT NULL
        CHECK (porcentaje_comision >= 0 AND porcentaje_comision <= 100),
    fecha_actualizacion DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);
GO

CREATE TABLE CUENTA_BANCARIA (
    numero_cuenta VARCHAR(34) PRIMARY KEY,
    alias_cuenta NVARCHAR(100) NOT NULL,
    tipo_moneda CHAR(3) NOT NULL
        CHECK (tipo_moneda IN ('CRC', 'USD')),
    saldo_actual DECIMAL(18,2) NOT NULL DEFAULT 0
        CHECK (saldo_actual >= 0),
    id_cliente INT NOT NULL,
    fecha_creacion DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    estado VARCHAR(20) NOT NULL
        CHECK (estado IN ('Activa', 'Inactiva')),

    CONSTRAINT FK_CUENTA_CLIENTE
        FOREIGN KEY (id_cliente) REFERENCES CLIENTE(id_cliente)
);
GO

CREATE TABLE TRANSACCION (
    id_transaccion INT PRIMARY KEY IDENTITY(1,1),
    numero_cuenta VARCHAR(34) NOT NULL,
    id_cliente INT NOT NULL,
    tipo_transaccion VARCHAR(30) NOT NULL
        CHECK (tipo_transaccion IN ('Deposito', 'Retiro', 'ComisionRetiro')),
    descripcion NVARCHAR(250) NOT NULL,
    fecha_transaccion DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    monto DECIMAL(18,2) NOT NULL
        CHECK (monto > 0),
    saldo_actualizado DECIMAL(18,2) NOT NULL
        CHECK (saldo_actualizado >= 0),
    id_transaccion_referencia INT NULL,

    CONSTRAINT FK_TRANSACCION_CUENTA
        FOREIGN KEY (numero_cuenta) REFERENCES CUENTA_BANCARIA(numero_cuenta),

    CONSTRAINT FK_TRANSACCION_CLIENTE
        FOREIGN KEY (id_cliente) REFERENCES CLIENTE(id_cliente),

    CONSTRAINT FK_TRANSACCION_REFERENCIA
        FOREIGN KEY (id_transaccion_referencia) REFERENCES TRANSACCION(id_transaccion)
);
GO