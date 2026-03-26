const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const priceController = require('../controllers/priceController');
const { authMiddleware, optionalAuthMiddleware } = require('../middlewares/auth');

/**
 * ===========================
 * ROUTES PRIX
 * ===========================
 */

/**
 * POST /api/prices
 * Ajouter un nouveau prix
 * Authentification: REQUISE
 * 
 * Body:
 * {
 *   "productId": "65a1b2c3d4e5f6g7h8i9j0k1",
 *   "price": 1200,
 *   "city": "Alger",
 *   "region": "Centre",
 *   "storeName": "Carrefour",
 *   "storeType": "supermarché"
 * }
 */
router.post(
  '/',
  authMiddleware,
  [
    body('productId')
      .notEmpty()
      .withMessage('Produit requis')
      .isMongoId()
      .withMessage('ID de produit invalide'),
    
    body('price')
      .notEmpty()
      .withMessage('Prix requis')
      .isFloat({ min: 0.01 })
      .withMessage('Prix doit être un nombre positif'),
    
    body('city')
      .notEmpty()
      .withMessage('Ville requise')
      .trim()
      .toLowerCase(),
    
    body('region')
      .optional()
      .trim()
      .toLowerCase(),
    
    body('storeName')
      .optional()
      .trim(),
    
    body('storeType')
      .optional()
      .isIn(['supermarché', 'petit_commerce', 'marché', 'en_ligne', 'autre'])
      .withMessage('Type de magasin invalide')
  ],
  priceController.addPrice
);

/**
 * GET /api/prices/product/:productId/all
 * Obtenir tous les prix d'un produit (groupés par ville)
 * Authentification: OPTIONNELLE
 * 
 * Query params:
 * ?city=Alger
 */
router.get(
  '/product/:productId/all',
  optionalAuthMiddleware,
  priceController.getPricesByCity
);

/**
 * GET /api/prices/product/:productId/city/:city
 * Obtenir les prix d'un produit dans une ville spécifique
 * Authentification: OPTIONNELLE
 * 
 * Params:
 * - productId: ID du produit
 * - city: Nom de la ville
 */
router.get(
  '/product/:productId/city/:city',
  optionalAuthMiddleware,
  priceController.getPricesInCity
);

/**
 * POST /api/prices/:priceId/validate
 * Valider un prix (l'utilisateur connecté valide)
 * Authentification: REQUISE
 * 
 * Note: L'utilisateur ne peut pas valider son propre prix
 */
router.post(
  '/:priceId/validate',
  authMiddleware,
  priceController.validatePrice
);

/**
 * POST /api/prices/:priceId/report
 * Signaler un prix comme incorrect
 * Authentification: REQUISE
 * 
 * Body:
 * {
 *   "reason": "prix_incorrect" | "doublon" | "spam" | "autre"
 * }
 */
router.post(
  '/:priceId/report',
  authMiddleware,
  [
    body('reason')
      .notEmpty()
      .withMessage('Raison requise')
      .isIn(['prix_incorrect', 'doublon', 'spam', 'autre'])
      .withMessage('Raison invalide')
  ],
  priceController.reportPrice
);

/**
 * POST /api/prices/:priceId/archive
 * Archiver un prix (créateur ou admin)
 * Authentification: REQUISE
 */
router.post(
  '/:priceId/archive',
  authMiddleware,
  priceController.archivePrice
);

/**
 * GET /api/prices/recent
 * Obtenir les prix récents (toutes villes)
 * Authentification: OPTIONNELLE
 * 
 * Query params:
 * ?limit=20&page=1
 */
router.get(
  '/recent',
  optionalAuthMiddleware,
  priceController.getRecentPrices
);

/**
 * GET /api/prices/:priceId/trust-level
 * Obtenir le niveau de confiance d'un prix
 * Authentification: OPTIONNELLE
 * 
 * Retourne:
 * - trustLevel: "très_fiable" | "fiable" | "neutre" | "non_fiable"
 * - validationCount et reportCount
 */
router.get(
  '/:priceId/trust-level',
  optionalAuthMiddleware,
  priceController.getPriceTrustLevel
);

module.exports = router;
