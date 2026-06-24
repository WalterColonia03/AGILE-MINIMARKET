const fs = require('fs');
const path = require('path');
const { runBackup, backupDir } = require('../utils/backup');

const descargarBackup = async (req, res) => {
  try {
    // Si queremos generar on-demand:
    const backupInfo = await runBackup();
    
    // Descargar el archivo generado
    if (fs.existsSync(backupInfo.path)) {
      res.download(backupInfo.path, backupInfo.filename, (err) => {
        if (err) {
          console.error('[Backup] Error al descargar archivo:', err);
          if (!res.headersSent) {
            res.status(500).json({ mensaje: 'Error al descargar el backup' });
          }
        }
      });
    } else {
      res.status(404).json({ mensaje: 'Archivo de backup no encontrado' });
    }
  } catch (error) {
    console.error('Error al generar/descargar backup:', error);
    res.status(500).json({ mensaje: 'Error al procesar la solicitud de backup' });
  }
};

module.exports = {
  descargarBackup
};
