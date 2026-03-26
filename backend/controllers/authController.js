const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');

/**
 * Générer un JWT token
 */
const generateToken = (userId, userRole) => {
  return jwt.sign(
    { id: userId, role: userRole },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
};

/**
 * ENREGISTREMENT - Créer un nouvel utilisateur
 */
exports.register = async (req, res) => {
  try {
    // Vérifier les erreurs de validation
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Erreur de validation',
        errors: errors.array()
      });
    }

    const { username, email, password, city } = req.body;

    // ===========================
    // VÉRIFIER SI L'UTILISATEUR EXISTE DÉJÀ
    // ===========================
    let user = await User.findOne({ $or: [{ email }, { username }] });
    if (user) {
      return res.status(409).json({
        success: false,
        message: 'Utilisateur ou email déjà existant',
        code: 'USER_EXISTS'
      });
    }

    // ===========================
    // CRÉER LE NOUVEL UTILISATEUR
    // ===========================
    user = new User({
      username,
      email,
      passwordHash: password,
      city
    });

    await user.save();

    // ===========================
    // GÉNÉRER LE JWT
    // ===========================
    const token = generateToken(user._id, user.role);

    // ===========================
    // RÉPONDRE AVEC SUCCÈS
    // ===========================
    res.status(201).json({
      success: true,
      message: 'Utilisateur créé avec succès',
      token,
      user: user.toJSON()
    });
  } catch (error) {
    console.error('Erreur enregistrement:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'enregistrement',
      error: error.message
    });
  }
};

/**
 * CONNEXION - Authentifier un utilisateur
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // ===========================
    // VÉRIFIER QUE LES CHAMPS SONT REMPLIS
    // ===========================
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email et mot de passe requis'
      });
    }

    // ===========================
    // RECHERCHER L'UTILISATEUR
    // ===========================
    const user = await User.findOne({ email }).select('+passwordHash');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Email ou mot de passe incorrect',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // ===========================
    // VÉRIFIER LE MOT DE PASSE
    // ===========================
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Email ou mot de passe incorrect',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // ===========================
    // VÉRIFIER QUE L'UTILISATEUR N'EST PAS BANNI
    // ===========================
    if (user.isBanned) {
      return res.status(403).json({
        success: false,
        message: `Votre compte a été suspendu. Raison: ${user.banReason}`,
        code: 'USER_BANNED'
      });
    }

    // ===========================
    // VÉRIFIER QUE L'UTILISATEUR EST ACTIF
    // ===========================
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Votre compte a été désactivé',
        code: 'USER_INACTIVE'
      });
    }

    // ===========================
    // GÉNÉRER LE JWT
    // ===========================
    const token = generateToken(user._id, user.role);

    // ===========================
    // METTRE À JOUR LAST LOGIN
    // ===========================
    user.lastLoginAt = new Date();
    await user.save();

    // ===========================
    // RÉPONDRE AVEC SUCCÈS
    // ===========================
    res.json({
      success: true,
      message: 'Connexion réussie',
      token,
      user: user.toJSON()
    });
  } catch (error) {
    console.error('Erreur connexion:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la connexion',
      error: error.message
    });
  }
};

/**
 * RÉCUPÉRER LE PROFIL DE L'UTILISATEUR CONNECTÉ
 */
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé',
        code: 'USER_NOT_FOUND'
      });
    }

    res.json({
      success: true,
      user: user.toJSON()
    });
  } catch (error) {
    console.error('Erreur récupération profil:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur',
      error: error.message
    });
  }
};

/**
 * METTRE À JOUR LE PROFIL
 */
exports.updateProfile = async (req, res) => {
  try {
    const { city, region, username } = req.body;

    // ===========================
    // VÉRIFIER LES MODIFICATIONS AUTORISÉES
    // ===========================
    const updateData = {};
    if (city) updateData.city = city;
    if (region) updateData.region = region;
    if (username && username !== req.user.username) {
      // Vérifier que le username n'existe pas déjà
      const existingUser = await User.findOne({ username });
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'Ce nom d\'utilisateur existe déjà'
        });
      }
      updateData.username = username;
    }

    // ===========================
    // METTRE À JOUR
    // ===========================
    const user = await User.findByIdAndUpdate(
      req.userId,
      updateData,
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Profil mis à jour',
      user: user.toJSON()
    });
  } catch (error) {
    console.error('Erreur mise à jour profil:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur',
      error: error.message
    });
  }
};

/**
 * CHANGER LE MOT DE PASSE
 */
exports.changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    // ===========================
    // VÉRIFIER LES CHAMPS
    // ===========================
    if (!oldPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Ancien et nouveau mot de passe requis'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Le nouveau mot de passe doit faire au moins 6 caractères'
      });
    }

    // ===========================
    // RÉCUPÉRER L'UTILISATEUR AVEC LE HASH
    // ===========================
    const user = await User.findById(req.userId).select('+passwordHash');

    // ===========================
    // VÉRIFIER L'ANCIEN MOT DE PASSE
    // ===========================
    const isMatch = await user.comparePassword(oldPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'L\'ancien mot de passe est incorrect'
      });
    }

    // ===========================
    // METTRE À JOUR LE MOT DE PASSE
    // ===========================
    user.passwordHash = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Mot de passe changé avec succès'
    });
  } catch (error) {
    console.error('Erreur changement mot de passe:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur',
      error: error.message
    });
  }
};

/**
 * RÉCUPÉRER LES INFOS D'UN AUTRE UTILISATEUR (profil public)
 */
exports.getUserInfo = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    // Ne retourner que les infos publiques
    res.json({
      success: true,
      user: {
        _id: user._id,
        username: user.username,
        city: user.city,
        reliabilityScore: user.reliabilityScore,
        verifiedPrices: user.verifiedPrices,
        totalComments: user.totalComments,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Erreur récupération infos:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur',
      error: error.message
    });
  }
};

/**
 * DÉCONNEXION (optionnel - peut être fait côté client)
 */
exports.logout = async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'Déconnexion réussie'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur'
    });
  }
};
