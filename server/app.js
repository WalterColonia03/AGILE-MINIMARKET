require('dotenv').config();
const express = require('express');
const cors    = require('cors');

// Importar sequelize y todos los modelos (con sus asociaciones ya definidas)
const { sequelize } = require('./models');

// ─── Importar rutas ───────────────────────────────────────────────────────────
const authRoutes       = require('./routes/auth.routes');
const usuarioRoutes    = require('./routes/usuario.routes');
const categoriaRoutes   = require('./routes/categoria.routes');
const productoRoutes    = require('./routes/producto.routes');
const proveedorRoutes   = require('./routes/proveedor.routes');
const ventaRoutes       = require('./routes/venta.routes');
const clienteRoutes     = require('./routes/cliente.routes');
const inventarioRoutes  = require('./routes/inventario.routes');
const reporteRoutes     = require('./routes/reporte.routes');
const backupRoutes      = require('./routes/backup.routes');

// ─── Importar seeders ─────────────────────────────────────────────────────────
const seedAdmin = require('./seeders/adminSeed');
const { initCron } = require('./utils/backup');
const logger = require('./utils/logger');

const app = express();

// ─── Logging Middleware ────────────────────────────────────────────────────────
app.use((req, res, next) => {
  logger.info(`[${req.method}] ${req.url}`);
  next();
});

// ─── Middlewares globales ─────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Rutas (Versionamiento v1 y Legacy) ─────────────────────────────────────────
const apiRouter = express.Router();
apiRouter.use('/auth',       authRoutes);
apiRouter.use('/usuarios',   usuarioRoutes);
apiRouter.use('/categorias', categoriaRoutes);
apiRouter.use('/productos',   productoRoutes);
apiRouter.use('/proveedores', proveedorRoutes);
apiRouter.use('/ventas',      ventaRoutes);
apiRouter.use('/clientes',    clienteRoutes);
apiRouter.use('/inventario',  inventarioRoutes);
apiRouter.use('/reportes',    reporteRoutes);
apiRouter.use('/backups',     backupRoutes);

app.use('/api/v1', apiRouter);
app.use('/api', apiRouter); // Legacy fallback

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Minimarket API v1 running' });
});

// ─── Global Error Handler (Centralizado) ──────────────────────────────────────
app.use((err, req, res, next) => {
  logger.error(`Unhandled Error en ${req.method} ${req.url}: ${err.message}`, { stack: err.stack });
  res.status(err.status || 500).json({
    mensaje: err.mensaje || 'Error interno del servidor',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// ─── Solo arrancar servidor si NO estamos en Vercel ──────────────────────────
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 3000;

  sequelize
    .sync({ alter: true })
    .then(async () => {
      console.log('✅ Tablas sincronizadas correctamente');
      await seedAdmin();
      initCron(); // Iniciar tareas programadas de backup
      app.listen(PORT, () => {
        console.log(`🚀 Server listening on port ${PORT}`);
      });
    })
    .catch((err) => {
      console.error('❌ Unable to sync database:', err);
      process.exit(1);
    });
}

module.exports = app;
