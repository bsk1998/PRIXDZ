const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const { authMiddleware } = require('../middlewares/auth');

/**
 * ===========================
 * ROUTES D'AUTHENTIFICATION
 * ===========================
 */

/**
 * POST /api/auth/register
 * Créer un nouvel utilisateur
 * 
 * Body:
 * {
 *   "username": "john_doe",
 *   "email": "john@example.com",
 *   "password": "password123",
 *   "city": "Alger"
 * }
 */
router.post(
  '/register',
  [
    // Validation
    body('username')
      .trim()
      .isLength({ min: 3, max: 30 })
      .withMessage('Username doit faire entre 3 et 30 caractères')
      .matches(/^[a-zA-Z0-9_-]+$/)
      .withMessage('Username ne peut contenir que des lettres, chiffres, - et _'),
    
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Email invalide'),
    
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password doit faire au moins 6 caractères'),
    
    body('city')
      .optional()
      .trim()
  ],
  authController.register
);

/**
 * POST /api/auth/login
 * Connecter un utilisateur
 * 
 * Body:
 * {
 *   "email": "john@example.com",
 *   "password": "password123"
 * }
 */
router.post(
  '/login',
  [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Email invalide'),
    
    body('password')
      .notEmpty()
      .withMessage('Password requis')
  ],
  authController.login
);

/**
 * GET /api/auth/profile
 * Obtenir le profil de l'utilisateur connecté
 * Authentification: REQUISE
 */
router.get('/profile', authMiddleware, authController.getProfile);

/**
 * PUT /api/auth/profile
 * Mettre à jour le profil
 * Authentification: REQUISE
 * 
 * Body:
 * {
 *   "city": "Oran",
 *   "region": "Nord-Ouest",
 *   "username": "new_username"
 * }
 */
router.put(
  '/profile',
  authMiddleware,
  [
    body('city').optional().trim(),
    body('region').optional().trim(),
    body('username').optional().trim()
  ],
  authController.updateProfile
);

/**
 * POST /api/auth/change-password
 * Changer le mot de passe
 * Authentification: REQUISE
 * 
 * Body:
 * {
 *   "oldPassword": "password123",
 *   "newPassword": "newpassword123"
 * }
 */
router.post(
  '/change-password',
  authMiddleware,
  [
    body('oldPassword')
      .notEmpty()
      .withMessage('Ancien password requis'),
    
    body('newPassword')
      .isLength({ min: 6 })
      .withMessage('Nouveau password doit faire au moins 6 caractères')
  ],
  authController.changePassword
);

/**
 * GET /api/auth/user/:userId
 * Obtenir les infos publiques d'un utilisateur
 * Authentification: OPTIONNELLE
 */
router.get('/user/:userId', authController.getUserInfo);

/**
 * POST /api/auth/logout
 * Déconnecter l'utilisateur
 * Authentification: REQUISE (mais c'est juste côté client)
 */
router.post('/logout', authMiddleware, authController.logout);

module.exports = router;
