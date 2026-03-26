const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Middleware d'authentification JWT
 * Vérifie que l'utilisateur est connecté et valide le token
 */
const authMiddleware = async (req, res, next) => {
  try {
    // Récupérer le token du header Authorization
    const token = req.headers.authorization?.split(' ')[1];

    // Vérifier si le token existe
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token manquant. Authentification requise.',
        code: 'NO_TOKEN'
      });
    }

    // Vérifier et décoder le token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Vérifier que l'utilisateur existe toujours
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Utilisateur non trouvé',
        code: 'USER_NOT_FOUND'
      });
    }

    // Vérifier que l'utilisateur n'est pas banni
    if (user.isBanned) {
      return res.status(403).json({
        success: false,
        message: `Votre compte a été suspendu. Raison: ${user.banReason}`,
        code: 'USER_BANNED'
      });
    }

    // Vérifier que l'utilisateur est actif
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Votre compte a été désactivé',
        code: 'USER_INACTIVE'
      });
    }

    // Attacher les infos de l'utilisateur à la requête
    req.userId = decoded.id;
    req.userRole = decoded.role;
    req.user = user;

    next();
  } catch (error) {
    // Distinguer les différents types d'erreurs JWT
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expiré. Veuillez vous reconnecter.',
        code: 'TOKEN_EXPIRED'
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Token invalide',
        code: 'INVALID_TOKEN'
      });
    }

    res.status(401).json({
      success: false,
      message: 'Erreur d\'authentification',
      code: 'AUTH_ERROR',
      error: error.message
    });
  }
};

/**
 * Middleware pour vérifier le rôle ADMIN
 * À utiliser APRÈS authMiddleware
 */
const adminMiddleware = (req, res, next) => {
  try {
    if (!req.userRole) {
      return res.status(401).json({
        success: false,
        message: 'Authentification requise'
      });
    }

    if (req.userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Accès admin requis. Vous n\'avez pas les permissions nécessaires.',
        code: 'FORBIDDEN'
      });
    }

    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur de vérification des permissions'
    });
  }
};

/**
 * Middleware pour vérifier le rôle MODÉRATEUR
 * À utiliser APRÈS authMiddleware
 */
const moderatorMiddleware = (req, res, next) => {
  try {
    if (!req.userRole) {
      return res.status(401).json({
        success: false,
        message: 'Authentification requise'
      });
    }

    if (req.userRole !== 'moderator' && req.userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Accès modérateur requis. Vous n\'avez pas les permissions nécessaires.',
        code: 'FORBIDDEN'
      });
    }

    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur de vérification des permissions'
    });
  }
};

/**
 * Middleware optionnel pour vérifier l'authentification
 * Ne rejette pas si pas authentifié, mais attache les infos si disponibles
 */
const optionalAuthMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);

      if (user && !user.isBanned && user.isActive) {
        req.userId = decoded.id;
        req.userRole = decoded.role;
        req.user = user;
      }
    }

    next();
  } catch (error) {
    // Continuer même si erreur (authentification optionnelle)
    next();
  }
};

module.exports = {
  authMiddleware,
  adminMiddleware,
  moderatorMiddleware,
  optionalAuthMiddleware
};
