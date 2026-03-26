const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const productController = require('../controllers/productController');
const { authMiddleware, optionalAuthMiddleware } = require('../middlewares/auth');
const { uploadSingle } = require('../middlewares/upload');

/**
 * ===========================
 * ROUTES PRODUITS
 * ===========================
 */

/**
 * POST /api/products
 * Ajouter un nouveau produit
 * Authentification: REQUISE
 * 
 * Body (FormData):
 * {
 *   "name": "Lait Noir",
 *   "categoryId": "65a1b2c3d4e5f6g7h8i9j0k1",
 *   "description": "Lait frais de qualité supérieure",
 *   "photo": <file>
 * }
 */
router.post(
  '/',
  authMiddleware,
  uploadSingle('photo'),
  [
    body('name')
      .trim()
      .notEmpty()
      .withMessage('Nom du produit requis')
      .isLength({ min: 2, max: 100 })
      .withMessage('Nom doit faire entre 2 et 100 caractères'),
    
    body('categoryId')
      .notEmpty()
      .withMessage('Catégorie requise')
      .isMongoId()
      .withMessage('ID de catégorie invalide'),
    
    body('description')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Description ne doit pas dépasser 500 caractères')
  ],
  productController.addProduct
);

/**
 * GET /api/products/search
 * Rechercher des produits
 * Authentification: OPTIONNELLE
 * 
 * Query params:
 * ?name=lait&categoryId=65a1b2c3d4e5f6g7h8i9j0k1&city=Alger&limit=20&page=1
 */
router.get(
  '/search',
  optionalAuthMiddleware,
  productController.searchProducts
);

/**
 * GET /api/products/top
 * Obtenir les produits les plus populaires
 * Authentification: OPTIONNELLE
 * 
 * Query params:
 * ?limit=10&category=65a1b2c3d4e5f6g7h8i9j0k1
 */
router.get(
  '/top',
  optionalAuthMiddleware,
  productController.getTopProducts
);

/**
 * GET /api/products/:id
 * Obtenir les détails d'un produit
 * Authentification: OPTIONNELLE
 * 
 * Retourne:
 * - Détails du produit
 * - Liste des prix
 * - Commentaires
 * - Si l'utilisateur l'a aimé
 */
router.get(
  '/:id',
  optionalAuthMiddleware,
  productController.getProductById
);

/**
 * POST /api/products/:id/like
 * Liker/Unliker un produit
 * Authentification: REQUISE
 */
router.post(
  '/:id/like',
  authMiddleware,
  productController.likeProduct
);

/**
 * DELETE /api/products/:id
 * Supprimer un produit (créateur ou admin)
 * Authentification: REQUISE
 */
router.delete(
  '/:id',
  authMiddleware,
  productController.deleteProduct
);

/**
 * POST /api/products/suggest-category
 * Suggérer une nouvelle catégorie
 * Authentification: REQUISE
 * 
 * Body:
 * {
 *   "name": "Chaussures",
 *   "description": "Chaussures pour hommes et femmes"
 * }
 */
router.post(
  '/suggest-category',
  authMiddleware,
  [
    body('name')
      .trim()
      .notEmpty()
      .withMessage('Nom de la catégorie requis')
      .isLength({ min: 3, max: 50 })
      .withMessage('Nom doit faire entre 3 et 50 caractères'),
    
    body('description')
      .optional()
      .trim()
      .isLength({ max: 200 })
      .withMessage('Description ne doit pas dépasser 200 caractères')
  ],
  productController.suggestCategory
);

module.exports = router;
