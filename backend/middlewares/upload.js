const multer = require('multer');
const path = require('path');
const fs = require('fs');

/**
 * Middleware pour gérer l'upload de fichiers
 * Accepte uniquement les images
 */

// ===========================
// CRÉER LE DOSSIER UPLOADS S'IL N'EXISTE PAS
// ===========================
const uploadDir = 'uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log('📁 Dossier uploads créé');
}

// ===========================
// CONFIGURATION DU STOCKAGE
// ===========================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Stocker dans le dossier uploads
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Générer un nom unique pour le fichier
    // Format : fieldname-timestamp-randomnumber.extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    
    cb(null, name + '-' + uniqueSuffix + ext);
  }
});

// ===========================
// FILTRE POUR LES IMAGES UNIQUEMENT
// ===========================
const fileFilter = (req, file, cb) => {
  // Extensions acceptées
  const allowedExtensions = /jpeg|jpg|png|gif|webp/i;
  const ext = path.extname(file.originalname).toLowerCase();
  
  // MIME types acceptés
  const allowedMimeTypes = /image\/(jpeg|jpg|png|gif|webp)/i;
  const mimetype = allowedMimeTypes.test(file.mimetype);

  // Vérifier l'extension et le MIME type
  if (mimetype && allowedExtensions.test(ext)) {
    return cb(null, true);
  } else {
    cb(new Error(
      `Type de fichier non supporté. Extensions acceptées: jpeg, jpg, png, gif, webp`
    ));
  }
};

// ===========================
// CONFIGURATION MULTER
// ===========================
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // Limite: 5MB
  },
  fileFilter: fileFilter
});

// ===========================
// MIDDLEWARE PERSONNALISÉ POUR SINGLE FILE
// ===========================
const uploadSingle = (fieldName = 'photo') => {
  return (req, res, next) => {
    const singleUpload = upload.single(fieldName);
    
    singleUpload(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        // Erreurs Multer
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            message: 'Le fichier dépasse la taille maximale de 5MB',
            code: 'FILE_TOO_LARGE'
          });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({
            success: false,
            message: 'Trop de fichiers',
            code: 'TOO_MANY_FILES'
          });
        }
      }
      
      if (err) {
        // Autres erreurs
        return res.status(400).json({
          success: false,
          message: err.message || 'Erreur lors du téléchargement',
          code: 'UPLOAD_ERROR'
        });
      }

      next();
    });
  };
};

// ===========================
// MIDDLEWARE PERSONNALISÉ POUR MULTIPLE FILES
// ===========================
const uploadMultiple = (fieldName = 'photos', maxCount = 5) => {
  return (req, res, next) => {
    const multiUpload = upload.array(fieldName, maxCount);
    
    multiUpload(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            message: 'Un fichier dépasse la taille maximale de 5MB',
            code: 'FILE_TOO_LARGE'
          });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({
            success: false,
            message: `Maximum ${maxCount} fichiers autorisés`,
            code: 'TOO_MANY_FILES'
          });
        }
      }
      
      if (err) {
        return res.status(400).json({
          success: false,
          message: err.message || 'Erreur lors du téléchargement',
          code: 'UPLOAD_ERROR'
        });
      }

      next();
    });
  };
};

// ===========================
// FONCTION UTILITAIRE : SUPPRIMER UN FICHIER
// ===========================
const deleteFile = (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Erreur lors de la suppression du fichier:', error);
    return false;
  }
};

// ===========================
// FONCTION UTILITAIRE : OBTENIR L'URL DU FICHIER
// ===========================
const getFileUrl = (filename) => {
  return `/uploads/${filename}`;
};

module.exports = {
  uploadSingle,
  uploadMultiple,
  deleteFile,
  getFileUrl,
  upload
};
