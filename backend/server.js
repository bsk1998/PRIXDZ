const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// ===========================
// INITIALISATION APP
// ===========================
const app = express();

// ===========================
// MIDDLEWARES DE SÉCURITÉ
// ===========================
app.use(helmet()); // Sécuriser les headers HTTP
app.use(morgan('combined')); // Logger les requêtes

// Limiter les requêtes (anti-spam)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limite de 100 requêtes par IP
});
app.use(limiter);

// ===========================
// MIDDLEWARES GÉNÉRAUX
// ===========================
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Servir les fichiers uploadés
app.use('/uploads', express.static('uploads'));

// ===========================
// CONNEXION MONGODB
// ===========================
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  })
  .then(() => {
    console.log('✅ MongoDB connectée avec succès');
  })
  .catch((err) => {
    console.error('❌ Erreur de connexion MongoDB:', err.message);
    process.exit(1);
  });

// ===========================
// IMPORTATION DES ROUTES
// ===========================
// À décommenter une fois les fichiers routes créés :
// const authRoutes = require('./routes/authRoutes');
// const productRoutes = require('./routes/productRoutes');
// const priceRoutes = require('./routes/priceRoutes');
// const categoryRoutes = require('./routes/categoryRoutes');
// const commentRoutes = require('./routes/commentRoutes');
// const grokRoutes = require('./routes/grokRoutes');

// ===========================
// ROUTES API
// ===========================
// app.use('/api/auth', authRoutes);
// app.use('/api/products', productRoutes);
// app.use('/api/prices', priceRoutes);
// app.use('/api/categories', categoryRoutes);
// app.use('/api/comments', commentRoutes);
// app.use('/api/grok', grokRoutes);

// ===========================
// ROUTE HEALTH CHECK
// ===========================
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'API PRIXDZ est opérationnelle ✅',
    timestamp: new Date(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// ===========================
// ROUTE 404 - PAGE NON TROUVÉE
// ===========================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route non trouvée',
    path: req.path,
    method: req.method
  });
});

// ===========================
// GESTION DES ERREURS GLOBALES
// ===========================
app.use((err, req, res, next) => {
  console.error('❌ Erreur serveur:', err);
  
  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'development' 
    ? err.message 
    : 'Une erreur serveur est survenue';

  res.status(statusCode).json({
    success: false,
    message: message,
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    timestamp: new Date()
  });
});

// ===========================
// DÉMARRAGE DU SERVEUR
// ===========================
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log('');
  console.log('╔════════════════════════════════════╗');
  console.log('║   🚀 PRIXDZ API DÉMARRÉE 🚀        ║');
  console.log('╠════════════════════════════════════╣');
  console.log(`║ Port: ${PORT}`);
  console.log(`║ URL: http://localhost:${PORT}`);
  console.log(`║ API: http://localhost:${PORT}/api`);
  console.log(`║ Env: ${process.env.NODE_ENV || 'development'}`);
  console.log('╚════════════════════════════════════╝');
  console.log('');
});

// ===========================
// GESTION ARRÊT GRACIEUX
// ===========================
process.on('SIGINT', () => {
  console.log('\n⏹️  Arrêt du serveur...');
  mongoose.connection.close(() => {
    console.log('✅ MongoDB déconnectée');
    process.exit(0);
  });
});

module.exports = app;
