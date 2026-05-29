// backend/backend.js
const express = require("express");
const mariadb = require("mariadb");
const speakeasy = require("speakeasy");
const QRCode = require("qrcode");
const cors = require("cors");
const path = require("path"); // Requerido para rutas de archivos

const app = express();

app.use(cors());
app.use(express.json());

// SERVIR EL FRONTEND DESDE EXPRESS (Ruta dinámica autodetectada)
const carpetaFrontend = path.join(__dirname, "frontend");
app.use(express.static(carpetaFrontend));

// Ruta explícita para servir el index.html al entrar a la raíz (http://localhost:3000)
app.get("/", (req, res) => {
  res.sendFile(path.join(carpetaFrontend, "index.html"));
});

const pool = mariadb.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionLimit: 5,
});

// ==========================================
// 🔐 ENDPOINT ADICIONAL: INICIO DE SESIÓN (LOGIN)
// ==========================================
app.post("/api/auth/login", async (req, res) => {
  const { username, password, token } = req.body;
  let connection;

  try {
    connection = await pool.getConnection();
    const rows = await connection.query(
      "SELECT id, username, password, 2fa_secret, 2fa_enabled FROM usuarios WHERE username = ?",
      [username],
    );

    // 1. Validar existencia de usuario y contraseña básica
    if (rows.length === 0 || rows[0].password !== password) {
      return res.status(401).json({ error: "Credenciales incorrectas" });
    }

    const usuario = rows[0];

    // 2. Si tiene el 2FA activo, se vuelve obligatorio evaluar el token en este instante
    if (usuario["2fa_enabled"] === 1) {
      if (!token) {
        // Le avisa al frontend que las credenciales son correctas pero requiere el segundo factor
        return res.json({
          require2FA: true,
          message: "Se requiere código de verificación de 6 dígitos",
        });
      }

      const isValid = speakeasy.totp.verify({
        secret: usuario["2fa_secret"],
        encoding: "base32",
        token: token,
        window: 1,
      });

      if (!isValid) {
        return res.status(401).json({ error: "Token MFA inválido o expirado" });
      }
    }

    // 3. Login Exitoso
    res.json({
      success: true,
      userId: usuario.id,
      username: usuario.username,
      ["2faEnabled"]: usuario["2fa_enabled"] === 1,
    });
  } catch (error) {
    res.status(500).json({ error: "Error en el proceso de autenticación" });
  } finally {
    if (connection) connection.release();
  }
});

// ==========================================
// 🛡️ MIDDLEWARE DE PROTECCIÓN DE ENDPOINTS (CORREGIDO)
// ==========================================
const mfaProtectionMiddleware = async (req, res, next) => {
  // Intercepta solo métodos que modifican datos y excluye rutas de autenticación
  if (
    ["POST", "PUT", "DELETE"].includes(req.method) &&
    !req.path.includes("/api/auth/login") &&
    !req.path.includes("/api/2fa/verify")
  ) {
    const mfaToken = req.headers["x-mfa-token"];

    if (!mfaToken) {
      return res.status(401).json({
        error: "Acceso denegado. Se requiere el encabezado x-mfa-token",
      });
    }

    let connection;
    try {
      connection = await pool.getConnection();

      // 🔍 CAMBIO CLAVE: Buscamos por username para evitar fallos si el ID no es 1
      const rows = await connection.query(
        "SELECT 2fa_secret, 2fa_enabled FROM usuarios WHERE username = 'admin_balmoral'",
      );

      // 🔍 CAMBIO CLAVE 2: Uso de corchetes ['2fa_enabled'] para evitar errores de sintaxis en JS
      if (rows.length > 0 && rows[0]["2fa_enabled"] === 1) {
        const isValid = speakeasy.totp.verify({
          secret: rows[0]["2fa_secret"],
          encoding: "base32",
          token: mfaToken,
          window: 1, // Margen de tolerancia de 30 segundos antes/después
        });

        if (!isValid) {
          return res
            .status(401)
            .json({ error: "Token MFA inválido o expirado" });
        }
      } else {
        return res
          .status(401)
          .json({ error: "El segundo factor de autenticación no está activo" });
      }
    } catch (err) {
      console.error("Error interno en Middleware:", err);
      return res
        .status(500)
        .json({ error: "Error de validación interna del servidor" });
    } finally {
      if (connection) connection.release();
    }
  }
  next();
};
app.use(mfaProtectionMiddleware);

// ==========================================
// 🔑 ENDPOINTS DE SEGURIDAD (TOTP/MFA)
// ==========================================
// Ejemplo de la ruta en tu backend/backend.js
app.get("/api/2fa/setup", async (req, res) => {
  try {
    // 1. Generar el secreto con speakeasy u otplib
    const secret = speakeasy.generateSecret({
      name: "Drogueria Balmoral:admin_balmoral",
    });

    // 2. Convertir la URL string 'otpauth://...' en una imagen Base64 real usando la librería qrcode
    const QRCode = require("qrcode");
    QRCode.toDataURL(secret.otpauth_url, (err, dataUrl) => {
      if (err) {
        return res
          .status(500)
          .json({ error: "Error generando el código de barras QR" });
      }

      // 3. Responder al frontend con el secreto base32 Y la imagen mapeada de forma idéntica
      res.json({
        secret: secret.base32,
        qrCodeUrl: dataUrl, // <-- Este 'dataUrl' es el string largo que el <img> necesita
      });
    });
  } catch (error) {
    res.status(500).json({ error: "Fallo estructural en el servidor" });
  }
});

app.post("/api/2fa/verify", async (req, res) => {
  const { token, secret: secretBase32 } = req.body;
  let connection;

  try {
    const verified = speakeasy.totp.verify({
      secret: secretBase32, // Ahora sí tiene el string Base32 correcto
      encoding: "base32",
      token: token,
      window: 1,
    });

    if (verified) {
      connection = await pool.getConnection();
      await connection.query(
        "UPDATE usuarios SET 2fa_secret = ?, 2fa_enabled = 1 WHERE id = 1",
        [secretBase32],
      );
      return res.json({ success: true });
    } else {
      return res.status(400).json({ error: "Token inválido" });
    }
  } catch (error) {
    return res.status(500).json({ error: "Error en el servidor" });
  } finally {
    if (connection) connection.release();
  }
});

// ==========================================
// 💊 ENDPOINTS DE NEGOCIO (MEDICAMENTOS)
// ==========================================
app.get("/api/medicamentos", async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const rows = await connection.query("SELECT * FROM medicamentos");
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "Error" });
  } finally {
    if (connection) connection.release();
  }
});

app.post("/api/medicamentos", async (req, res) => {
  const { nombre, precio, stock, categoria } = req.body;
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query(
      "INSERT INTO medicamentos (nombre, precio, stock, categoria) VALUES (?, ?, ?, ?)",
      [nombre, precio, stock, categoria],
    );
    res.status(201).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Error" });
  } finally {
    if (connection) connection.release();
  }
});

app.delete("/api/medicamentos/:id", async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query("DELETE FROM medicamentos WHERE id = ?", [
      req.params.id,
    ]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Error" });
  } finally {
    if (connection) connection.release();
  }
});

// Arrancar servidor
app.listen(3000, () => {
  console.log(` Servidor e interfaz corriendo en puerto 3000`);
});
