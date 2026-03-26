const Product = require('../models/Product');
const Price = require('../models/Price');
const Category = require('../models/Category');
const { deleteFile } = require('../middlewares/upload');

/**
 * AJOUTER UN NOUVEAU PRODUIT
 */
exports.addProduct = async (req, res) => {
  try {
    const { name, categoryId, description } = req.body;
    const photoUrl = req.file ? `/uploads/${req.file.filename}` : null;

    // ===========================
    // VÉRIFIER QUE LA CATÉGORIE EXISTE
    // ===========================
    const category = await Category.findById(categoryId);
    if (!category) {
      // Supprimer la photo si erreur
      if (req.file) {
        deleteFile(req.file.path);
      }
      return res.status(404).json({
        success: false,
        message: 'Catégorie non trouvée',
        code: 'CATEGORY_NOT_FOUND'
      });
    }

    // ===========================
    // VÉRIFIER LES DOUBLONS
    // ===========================
    let product = await Product.findOne({
      name: name.toLowerCase(),
      category: categoryId
    });

    if (product) {
      // Supprimer la photo si erreur
      if (req.file) {
        deleteFile(req.file.path);
      }
      return res.status(409).json({
        success: false,
        message: 'Ce produit existe déjà dans cette catégorie',
        code: 'PRODUCT_EXISTS',
        productId: product._id
      });
    }

    // ===========================
    // CRÉER LE PRODUIT
    // ===========================
    product = new Product({
      name: name.toLowerCase(),
      category: categoryId,
      description: description || '',
      photoUrl,
      createdBy: req.userId
    });

    await product.save();
    await product.populate('category createdBy');

    // ===========================
    // INCRÉMENTER LE COMPTEUR DE LA CATÉGORIE
    // ===========================
    await Category.findByIdAndUpdate(
      categoryId,
      { $inc: { productsCount: 1 } }
    );

    res.status(201).json({
      success: true,
      message: 'Produit créé avec succès',
      product
    });
  } catch (error) {
    // Supprimer la photo en cas d'erreur
    if (req.file) {
      deleteFile(req.file.path);
    }
    console.error('Erreur création produit:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création du produit',
      error: error.message
    });
  }
};

/**
 * RECHERCHER DES PRODUITS
 */
exports.searchProducts = async (req, res) => {
  try {
    const { name, categoryId, city, region, limit = 20, page = 1 } = req.query;

    // ===========================
    // CONSTRUIRE LA REQUÊTE
    // ===========================
    let query = {};

    if (name) {
      // Recherche texte
      query.$text = { $search: name };
    }

    if (categoryId) {
      query.category = categoryId;
    }

    // ===========================
    // PAGINATION
    // ===========================
    const skip = (page - 1) * limit;

    // ===========================
    // RÉCUPÉRER LES PRODUITS
    // ===========================
    const products = await Product.find(query)
      .populate('category createdBy')
      .limit(Number(limit))
      .skip(skip)
      .sort({ createdAt: -1 });

    // ===========================
    // AJOUTER LES PRIX (filtrer par ville/région si nécessaire)
    // ===========================
    let result = [];

    for (const product of products) {
      let priceQuery = { product: product._id, isActive: true };
      
      if (city) {
        priceQuery.city = new RegExp(city, 'i');
      }
      if (region) {
        priceQuery.region = new RegExp(region, 'i');
      }

      const prices = await Price.find(priceQuery)
        .populate('user')
        .sort({ validationCount: -1, createdAt: -1 });

      result.push({
        ...product.toObject(),
        prices
      });
    }

    // ===========================
    // COMPTER LE TOTAL
    // ===========================
    const total = await Product.countDocuments(query);

    res.json({
      success: true,
      total,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / limit),
      products: result
    });
  } catch (error) {
    console.error('Erreur recherche:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la recherche',
      error: error.message
    });
  }
};

/**
 * OBTENIR LES DÉTAILS D'UN PRODUIT
 */
exports.getProductById = async (req, res) => {
  try {
    const { id } = req.params;

    // ===========================
    // RÉCUPÉRER LE PRODUIT ET INCRÉMENTER LES VUES
    // ===========================
    const product = await Product.findByIdAndUpdate(
      id,
      { $inc: { views: 1 } },
      { new: true }
    ).populate('category createdBy');

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Produit non trouvé',
        code: 'PRODUCT_NOT_FOUND'
      });
    }

    // ===========================
    // RÉCUPÉRER LES PRIX
    // ===========================
    const prices = await Price.find({ product: id, isActive: true })
      .populate('user')
      .sort({ validationCount: -1, createdAt: -1 });

    // ===========================
    // RÉCUPÉRER LES COMMENTAIRES
    // ===========================
    const Comment = require('../models/Comment');
    const comments = await Comment.find({ product: id, isDeleted: false })
      .populate('user')
      .sort({ likesCount: -1, createdAt: -1 });

    // ===========================
    // VÉRIFIER SI AIMÉ PAR L'UTILISATEUR CONNECTÉ
    // ===========================
    let isLiked = false;
    if (req.userId) {
      isLiked = product.isLikedBy(req.userId);
    }

    res.json({
      success: true,
      product: {
        ...product.toObject(),
        prices,
        comments,
        isLiked
      }
    });
  } catch (error) {
    console.error('Erreur récupération produit:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur',
      error: error.message
    });
  }
};

/**
 * LIKER/UNLIKER UN PRODUIT
 */
exports.likeProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Produit non trouvé'
      });
    }

    const isLiked = product.isLikedBy(req.userId);

    if (isLiked) {
      // Retirer le like
      product.removeLike(req.userId);
    } else {
      // Ajouter le like
      product.addLike(req.userId);
    }

    await product.save();

    res.json({
      success: true,
      message: isLiked ? 'Like retiré' : 'Like ajouté',
      product: {
        _id: product._id,
        likesCount: product.likesCount,
        isLiked: !isLiked
      }
    });
  } catch (error) {
    console.error('Erreur like produit:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur',
      error: error.message
    });
  }
};

/**
 * OBTENIR LES PRODUITS LES PLUS POPULAIRES
 */
exports.getTopProducts = async (req, res) => {
  try {
    const { limit = 10, category } = req.query;

    let query = { isActive: true };
    if (category) {
      query.category = category;
    }

    const products = await Product.find(query)
      .populate('category createdBy')
      .limit(Number(limit))
      .sort({ views: -1 });

    res.json({
      success: true,
      products
    });
  } catch (error) {
    console.error('Erreur top produits:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur',
      error: error.message
    });
  }
};

/**
 * SUPPRIMER UN PRODUIT (admin)
 */
exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Produit non trouvé'
      });
    }

    // ===========================
    // VÉRIFIER LES PERMISSIONS
    // ===========================
    if (product.createdBy.toString() !== req.userId && req.userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Vous n\'avez pas la permission de supprimer ce produit'
      });
    }

    // ===========================
    // SUPPRIMER LA PHOTO SI ELLE EXISTE
    // ===========================
    if (product.photoUrl) {
      const photoPath = `uploads/${product.photoUrl.split('/').pop()}`;
      deleteFile(photoPath);
    }

    // ===========================
    // SUPPRIMER LE PRODUIT
    // ===========================
    await Product.findByIdAndDelete(id);

    // ===========================
    // DÉCRÉMENTER LE COMPTEUR DE LA CATÉGORIE
    // ===========================
    await Category.findByIdAndUpdate(
      product.category,
      { $inc: { productsCount: -1 } }
    );

    res.json({
      success: true,
      message: 'Produit supprimé'
    });
  } catch (error) {
    console.error('Erreur suppression produit:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur',
      error: error.message
    });
  }
};

/**
 * SUGGÉRER UNE NOUVELLE CATÉGORIE
 */
exports.suggestCategory = async (req, res) => {
  try {
    const { name, description } = req.body;

    // ===========================
    // VÉRIFIER SI LA CATÉGORIE EXISTE DÉJÀ
    // ===========================
    let category = await Category.findOne({
      name: name.toLowerCase()
    });

    if (category) {
      return res.status(409).json({
        success: false,
        message: 'Cette catégorie existe déjà',
        code: 'CATEGORY_EXISTS',
        categoryId: category._id
      });
    }

    // ===========================
    // CRÉER LA NOUVELLE CATÉGORIE (NON VALIDÉE)
    // ===========================
    category = new Category({
      name: name.toLowerCase(),
      description: description || '',
      suggestedBy: req.userId,
      isValidated: false
    });

    await category.save();

    res.status(201).json({
      success: true,
      message: 'Catégorie suggérée. Elle sera validée par un modérateur.',
      category
    });
  } catch (error) {
    console.error('Erreur suggestion catégorie:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur',
      error: error.message
    });
  }
};
