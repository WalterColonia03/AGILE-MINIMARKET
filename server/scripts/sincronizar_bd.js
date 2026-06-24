require('dotenv').config();

if (process.env.NODE_ENV === 'production') {
  console.error('❌ ALERTA: Script bloqueado en entorno de Producción.');
  process.exit(1);
}

const { sequelize } = require('../models');
const seedAdmin = require('../seeders/adminSeed');

(async () => {
  try {
    console.log('🔌 Conectando a la base de datos...');
    await sequelize.authenticate();
    console.log('✅ Conexión exitosa');

    console.log('🔄 Sincronizando tablas...');
    await sequelize.sync({ alter: true });
    console.log('✅ Tablas sincronizadas');

    console.log('🌱 Insertando seed de administrador...');
    await seedAdmin();
    console.log('✅ Seed completado');

    console.log('🎉 Base de datos lista');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
})();
