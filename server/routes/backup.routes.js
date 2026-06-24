const express = require('express');
const router = express.Router();
const backupController = require('../controllers/backup.controller');
const verificarToken = require('../middlewares/auth.middleware');
const { verificarRol } = require('../middlewares/auth.middleware');

// GET /api/v1/backups/download - Generar y descargar volcado on-demand (Solo SuperAdmin/Administrador)
router.get('/download', verificarToken, verificarRol(['Administrador']), backupController.descargarBackup);

module.exports = router;
