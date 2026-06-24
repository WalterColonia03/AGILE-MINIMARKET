const fs = require('fs');
const path = require('path');

const isVercel = !!process.env.VERCEL;
const logDir = path.join(__dirname, '..', 'logs');
const logFile = path.join(logDir, 'system.log');

if (!isVercel) {
  if (!fs.existsSync(logDir)) {
    try {
      fs.mkdirSync(logDir, { recursive: true });
    } catch (e) {
      console.warn('No se pudo crear directorio de logs locales');
    }
  }
}

const log = (level, message, meta = {}) => {
  const timestamp = new Date().toISOString();
  let metaStr = '';
  try {
    if (meta && Object.keys(meta).length > 0) {
      // Evitar serializar objetos gigantes como requests completos
      const safeMeta = { ...meta };
      if (safeMeta.req) safeMeta.req = undefined;
      if (safeMeta.res) safeMeta.res = undefined;
      metaStr = ` | Meta: ${JSON.stringify(safeMeta)}`;
    }
  } catch(e) {
    metaStr = ' | Meta: [Unserializable data]';
  }
  
  const logLine = `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}\n`;
  
  // Imprimir por consola para desarrollo
  if (level === 'error') {
    console.error(logLine.trim());
  } else if (level === 'warn') {
    console.warn(logLine.trim());
  } else {
    console.log(logLine.trim());
  }

  // Guardar en archivo (solo en desarrollo/local)
  if (!isVercel) {
    try {
      fs.appendFileSync(logFile, logLine);
    } catch (err) {
      console.error('No se pudo escribir en el archivo de log:', err);
    }
  }
};

module.exports = {
  info: (msg, meta) => log('info', msg, meta),
  warn: (msg, meta) => log('warn', msg, meta),
  error: (msg, meta) => log('error', msg, meta),
  debug: (msg, meta) => log('debug', msg, meta)
};
