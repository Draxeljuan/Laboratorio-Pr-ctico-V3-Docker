# 💊 Sistema de Control de Existencias Seguro con MFA - Droguería "Tenderos Balmoral"

[cite_start]Este proyecto implementa una solución de ciberseguridad contenerizada para mitigar los riesgos de acceso no autorizado en los endpoints críticos del sistema de inventario de la Droguería "Tenderos Balmoral"[cite: 1, 3]. [cite_start]La arquitectura base utiliza una infraestructura multi-contenedor compuesta por un backend en **Node.js** y un motor de base de datos **MariaDB**[cite: 1, 8].

[cite_start]Para resolver la vulnerabilidad de modificaciones anónimas en la red interna, se integró un mecanismo de **Autenticación Multifactor Basado en Tiempo (TOTP)** bajo el estándar internacional **RFC 6238** [cite: 1, 4, 6, 9][cite_start], asegurando que cualquier operación de escritura o borrado requiera una llave criptográfica dinámica de un solo uso[cite: 1, 25, 26].

---

## Requisitos Previos

Antes de levantar el proyecto, asegúrate de tener instalado en tu sistema operativo:

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (con soporte para Docker Compose v2).
- Si trabajas en Windows, se recomienda el uso de **WSL2** (Windows Subsystem for Linux).

---

## 🛠️ Credenciales de Acceso Iniciales

[cite_start]Para realizar las validaciones iniciales del sistema, utiliza las siguientes credenciales preconfiguradas en el script de inicialización de la base de datos[cite: 1, 16, 17]:

- **Usuario Administrador:** `admin_balmoral`
- **Contraseña Base:** `seguridad2026`

[cite_start]_Nota: Por defecto, al ingresar por primera vez, el segundo factor (2FA) se encuentra desactivado (`2fa_enabled = 0`), permitiendo el acceso directo para su posterior enrolamiento dinámico[cite: 1, 18, 24]._

---

## 🧪 Guía de Validación y Pruebas (Criterios de Evaluación)

El sistema ha sido blindado siguiendo estrictamente la rúbrica de evaluación del laboratorio[cite: 1, 34]. Se pueden validar las siguientes fases directamente desde la interfaz:

### 1. Autenticación Básica e Inicio de Sesión

- **Prueba Fallida:** Intente ingresar con un usuario aleatorio o contraseña errónea. El sistema responderá con un código `401 Unauthorized`.
- **Prueba Exitosa:** Ingrese con las credenciales por defecto. Al no tener el 2FA activo, el sistema dará paso directo al panel principal.

### 2. Enrolamiento Dinámico y Persistencia (Peso: 25% Frontend / 40% Backend)

- [cite_start]Al hacer clic en **🔐 Vincular nuevo 2FA**, el backend consume el endpoint `GET /api/2fa/setup` para generar un secreto criptográfico único en formato Base32 y renderizar un código QR dinámico mediante la librería `qrcode`[cite: 1, 21, 22].
- Escanee el código con **Google Authenticator** o **Authy**.
- Ingrese el token de 6 dígitos para validar. [cite_start]Si es correcto, el backend procesará el endpoint `POST /api/2fa/verify`, guardará de forma segura el secreto y cambiará el estado en la base de datos a activo (`2fa_enabled = 1`)[cite: 1, 18, 23, 24].

### 3. Middleware de Protección Global (Peso: 40% Backend)

- **Bloqueo de peticiones anónimas:** Intente agregar o eliminar un medicamento dejando la casilla **TOKEN 2FA OPERACIONES** vacía. [cite_start]El `mfaProtectionMiddleware` interceptará los métodos `POST`, `PUT` o `DELETE` devolviendo un código `401 Unauthorized`[cite: 1, 10, 25, 26].
- **Inserción Segura:** Ingrese el token vigente de su aplicación móvil en la casilla correspondiente. [cite_start]El cliente web adjuntará de forma limpia el header personalizado `x-mfa-token`[cite: 1, 26, 29]. [cite_start]La API validará el token criptográfico basados en tiempo real y permitirá la alteración del inventario[cite: 1, 41, 42].

### 4. Mitigación de Ataques de Replay (Estándar TOTP)

- Si intenta reutilizar un código de 6 dígitos que ya fue procesado con éxito o cuyo ciclo de tiempo (30 segundos) ya expiró, el servidor denegará la petición, garantizando la resistencia contra la interceptación de paquetes en la red local.

---

## Configuración para Acceso en Red Local (WSL2 Proxy / Bridge)

Por defecto, WSL2 corre en una red virtual privada (NAT), impidiendo que otros ordenadores o el celular del docente accedan usando la IP de tu Windows. Para solucionarlo y exponer el puerto `3000` a la red local, aplica **una** de las siguientes soluciones en el equipo anfitrión:

### Opción A: Modo Espejo en WSL2 (Recomendado para Windows 11)

1. En Windows, navega a tu carpeta de usuario presionando `Win + R` e ingresando `%USERPROFILE%`.
2. Crea o edita el archivo `.wslconfig` y añade las siguientes líneas:
   ```ini
   [wsl2]
   networkingMode=mirrored
   ```

### Opcion B: Redirección Manual de Puertos

1. Abre terminal de WSL y averigua la IP
   ```bash
   ip addr show eth0 | grep 'inet ' | awk '{print $2}' | cut -d'/' -f1
   ```
2. En Windows, abre PowerShell como administrador y ejecuta:

   ```powershell
   netsh interface portproxy add v4tov4 listenport=3000 listenaddress=0.0.0.0 connectport=3000 connectaddress=<IP_WSL2>
   ```

   3. Habilita el reenvío de puertos en el firewall de Windows para el puerto `3000`.

   ```powershell
   New-NetFirewallRule -DisplayName "Permitir Puerto 3000" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3000
   ```

   Los demas ahora se conectan si estan en la misma red con algo asi:
   http://192.168.1.15:3000

---

Como referencia cuando quiera iniciar el contenedor de ceros sin el autenticar configurado:

```bash
docker compose down && docker compose up --build
```
