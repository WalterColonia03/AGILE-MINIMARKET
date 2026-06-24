const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const { Categoria, Producto, Proveedor, Usuario, Cliente, Venta, DetalleVenta, MovimientoInventario, SolicitudReposicion } = require('../models');

const backupDir = path.join(__dirname, '..', 'backups');

try {
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
} catch (e) {
  console.warn('[Backup] Entorno de solo lectura detectado. Las operaciones de backup en disco fallarán.');
}

// Retener 7 dias
const cleanOldBackups = () => {
  try {
    const files = fs.readdirSync(backupDir);
    const now = Date.now();
    files.forEach(file => {
      const filePath = path.join(backupDir, file);
      const stat = fs.statSync(filePath);
      const daysOld = (now - stat.mtimeMs) / (1000 * 60 * 60 * 24);
      if (daysOld > 7) {
        fs.unlinkSync(filePath);
        console.log(`[Backup] Archivo antiguo eliminado: ${file}`);
      }
    });
  } catch (err) {
    console.error('[Backup] Error al limpiar backups antiguos:', err);
  }
};

const runBackup = async () => {
  console.log('[Backup] Iniciando volcado de base de datos...');
  try {
    const data = {
      categorias: await Categoria.findAll(),
      productos: await Producto.findAll(),
      proveedores: await Proveedor.findAll(),
      usuarios: await Usuario.findAll(),
      clientes: await Cliente.findAll(),
      ventas: await Venta.findAll(),
      detalles: await DetalleVenta.findAll(),
      movimientos: await MovimientoInventario.findAll(),
      solicitudes: await SolicitudReposicion.findAll()
    };
    
    // Formato: backup_YYYYMMDD_HHMMSS.json
    const date = new Date();
    const timestamp = date.getFullYear() +
      String(date.getMonth() + 1).padStart(2, '0') +
      String(date.getDate()).padStart(2, '0') + '_' +
      String(date.getHours()).padStart(2, '0') +
      String(date.getMinutes()).padStart(2, '0') +
      String(date.getSeconds()).padStart(2, '0');
      
    const filename = `backup_${timestamp}.json`;
    const filePath = path.join(backupDir, filename);
    
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log(`[Backup] Respaldo completado: ${filename}`);
    cleanOldBackups();
    return { filename, path: filePath };
  } catch (error) {
    console.error('[Backup] Error al realizar el volcado:', error);
    throw error;
  }
};

const initCron = () => {
  // Ejecutar todos los días a la medianoche (00:00)
  cron.schedule('0 0 * * *', () => {
    runBackup();
  });
  console.log('[Backup] Tarea programada iniciada (00:00 diario)');
};

module.exports = { initCron, runBackup, backupDir };
