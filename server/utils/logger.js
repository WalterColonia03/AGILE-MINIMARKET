const fs = require('fs');
const path = require('path');

const logDir = path.join(__dirname, '..', 'logs');
const logFile = path.join(logDir, 'system.log');

let canWriteToFile = true;

try {
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
} catch (e) {
  canWriteToFile = false;
  console.warn('[Logger] Entorno de solo lectura detectado. Logs de archivo deshabilitados.');
}

const log = (level, message, meta = {}) => {
  const timestamp = new Date().toISOString();
  let metaStr = '';
  try {
    if (meta && Object.keys(meta).length > 0) {
      const safeMeta = { ...meta };
      if (safeMeta.req) safeMeta.req = undefined;
      if (safeMeta.res) safeMeta.res = undefined;
      metaStr = ` | Meta: ${JSON.stringify(safeMeta)}`;
    }
  } catch(e) {
    metaStr = ' | Meta: [Unserializable data]';
  }
  
  const logLine = `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}\n`;
  
  if (level === 'error') {
    console.error(logLine.trim());
  } else if (level === 'warn') {
    console.warn(logLine.trim());
  } else {
    console.log(logLine.trim());
  }

  if (canWriteToFile) {
    try {
      fs.appendFileSync(logFile, logLine);
    } catch (err) {
      // Si falla en tiempo de ejecución (ej. permisos), no hacemos crash
      canWriteToFile = false; 
    }
  }
};

module.exports = {
  info: (msg, meta) => log('info', msg, meta),
  warn: (msg, meta) => log('warn', msg, meta),
  error: (msg, meta) => log('error', msg, meta),
  debug: (msg, meta) => log('debug', msg, meta)
};
