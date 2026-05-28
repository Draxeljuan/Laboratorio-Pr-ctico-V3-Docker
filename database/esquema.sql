-- database/esquema.sql

-- Asegurar el uso de la base de datos correcta configurada en el .env
USE drogueria_db;

-- 1. Tabla de Inventario de Medicamentos
-- Soporta las operaciones críticas de la droguería (POST, PUT, DELETE)
CREATE TABLE IF NOT EXISTS medicamentos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    precio DECIMAL(10, 2) NOT NULL,
    stock INT NOT NULL,
    categoria VARCHAR(50) DEFAULT 'General'
);

-- 2. Tabla de Usuarios/Administradores (Paso 1 del Entregable)
-- Almacena las credenciales base y el estado criptográfico del segundo factor
CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL, -- Nota: En producción real aquí va un hash (ej. bcrypt)
    2fa_secret VARCHAR(100) DEFAULT NULL, -- Guarda el secreto único Base32
    2fa_enabled TINYINT(1) DEFAULT 0     -- Estado de activación (0 = Inactivo, 1 = Activo)
);

-- 3. Inserción de Datos Iniciales para Pruebas Libres de Errores
-- Al usar 'INSERT IGNORE' evitamos errores de duplicidad al reiniciar el contenedor
INSERT IGNORE INTO medicamentos (id, nombre, precio, stock, categoria) VALUES
(1, 'Acetaminofén 500mg', 2500.00, 120, 'Analgésico'),
(2, 'Ibuprofeno 400mg', 4500.00, 80, 'Antiinflamatorio'),
(3, 'Amoxicilina 500mg', 15000.00, 45, 'Antibiótico');

-- Creamos el usuario administrador inicial para interactuar con el backend
INSERT IGNORE INTO usuarios (id, username, password, 2fa_enabled) VALUES
(1, 'admin_balmoral', 'seguridad2026', 0);