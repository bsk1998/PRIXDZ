const Category = require('../models/Category');
const Product = require('../models/Product');

/**
 * OBTENIR TOUTES LES CATÉGORIES VALIDÉES
 */
exports.getAllCategories = async (req, res) => {
  try {
    const { limit = 50, page = 1, sortBy = 'name' } = req.query;

    // ===========================
    // DÉTERMINER L'ORDRE DE TRI
    // ===========================
    let sortQuery = { name: 1 }; // Défaut: alphabétique
    
    if (sortBy === 'products') {
      sortQuery = { productsCount: -1 };
    } else if (sortBy === 'recent') {
      sortQuery = { createdAt: -1 };
    } else if (sortBy === 'popular') {
      sortQuery = { pricesCount: -1 };
    }

    // ===========================
    // PAGINATION
    // ===========================
    const skip = (page - 1) * limit;

    // ===========================
    // RÉCUPÉRER LES CATÉGORIES VALIDÉES
    // ===========================
    const categories = await Category.find({ isValidated: true, isActive: true })
      .limit(Number(limit))
      .skip(skip)
      .sort(sortQuery);

    const total = await Category.countDocuments({
      isValidated: true,
      isActive: true
    });

    res.json({
      success: true,
      categories,
      total,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Erreur récupération catégories:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur',
      error: error.message
    });
  }
};

/**
 * OBTENIR LES DÉTAILS D'UNE CATÉGORIE
 */
exports.getCategoryById = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { limit = 20, page = 1 } = req.query;

    // ===========================
    // RÉCUPÉRER LA CATÉGORIE
    // ===========================
    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Catégorie non trouvée',
        code: 'CATEGORY_NOT_FOUND'
      });
    }

    if (!category.isValidated && !req.userRole?.includes('admin')) {
      return res.status(404).json({
        success: false,
        message: 'Catégorie non trouvée'
      });
    }

    // ===========================
    // PAGINATION
    // ===========================
    const skip = (page - 1) * limit;

    // ===========================
    // OBTENIR LES PRODUITS DE CETTE CATÉGORIE
    // ===========================
    const products = await Product.find({ category: categoryId, isActive: true })
      .limit(Number(limit))
      .skip(skip)
      .sort({ createdAt: -1 });

    const totalProducts = await Product.countDocuments({
      category: categoryId,
      isActive: true
    });

    res.json({
      success: true,
      category,
      products,
      totalProducts,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(totalProducts / limit)
    });
  } catch (error) {
    console.error('Erreur récupération catégorie:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur',
      error: error.message
    });
  }
};

/**
 * CRÉER UNE NOUVELLE CATÉGORIE (ADMIN UNIQUEMENT)
 */
exports.createCategory = async (req, res) => {
  try {
    const { name, description, icon, color } = req.body;

    // ===========================
    // VÉRIFIER QUE LE NOM EST FOURNI
    // ===========================
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Le nom de la catégorie est obligatoire'
      });
    }

    // ===========================
    // VÉRIFIER QUE LA CATÉGORIE N'EXISTE PAS DÉJÀ
    // ===========================
    const existingCategory = await Category.findOne({
      name: name.toLowerCase()
    });

    if (existingCategory) {
      return res.status(409).json({
        success: false,
        message: 'Cette catégorie existe déjà',
        code: 'CATEGORY_EXISTS',
        categoryId: existingCategory._id
      });
    }

    // ===========================
    // CRÉER LA CATÉGORIE
    // ===========================
    const category = new Category({
      name: name.toLowerCase(),
      description: description || '',
      icon: icon || '📦',
      color: color || '#3498db',
      isValidated: true,
      validatedBy: req.userId,
      validatedAt: new Date()
    });

    await category.save();

    res.status(201).json({
      success: true,
      message: 'Catégorie créée avec succès',
      category
    });
  } catch (error) {
    console.error('Erreur création catégorie:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur',
      error: error.message
    });
  }
};

/**
 * METTRE À JOUR UNE CATÉGORIE (ADMIN UNIQUEMENT)
 */
exports.updateCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { description, icon, color } = req.body;

    // ===========================
    // RÉCUPÉRER LA CATÉGORIE
    // ===========================
    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Catégorie non trouvée'
      });
    }

    // ===========================
    // METTRE À JOUR LES CHAMPS
    // ===========================
    const updateData = {};
    
    if (description !== undefined) {
      updateData.description = description;
    }
    if (icon !== undefined) {
      updateData.icon = icon;
    }
    if (color !== undefined) {
      updateData.color = color;
    }

    // ===========================
    // SAUVEGARDER
    // ===========================
    const updatedCategory = await Category.findByIdAndUpdate(
      categoryId,
      updateData,
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Catégorie mise à jour',
      category: updatedCategory
    });
  } catch (error) {
    console.error('Erreur mise à jour catégorie:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur',
      error: error.message
    });
  }
};

/**
 * VALIDER UNE CATÉGORIE SUGGÉRÉE (MODÉRATEUR/ADMIN)
 */
exports.validateCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;

    // ===========================
    // RÉCUPÉRER LA CATÉGORIE
    // ===========================
    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Catégorie non trouvée'
      });
    }

    // ===========================
    // VÉRIFIER QU'ELLE N'EST PAS DÉJÀ VALIDÉE
    // ===========================
    if (category.isValidated) {
      return res.status(409).json({
        success: false,
        message: 'Cette catégorie est déjà validée'
      });
    }

    // ===========================
    // VALIDER
    // ===========================
    category.isValidated = true;
    category.validatedBy = req.userId;
    category.validatedAt = new Date();
    await category.save();

    res.json({
      success: true,
      message: 'Catégorie validée',
      category
    });
  } catch (error) {
    console.error('Erreur validation catégorie:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur',
      error: error.message
    });
  }
};

/**
 * REJETER UNE CATÉGORIE SUGGÉRÉE (MODÉRATEUR/ADMIN)
 */
exports.rejectCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;

    // ===========================
    // RÉCUPÉRER LA CATÉGORIE
    // ===========================
    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Catégorie non trouvée'
      });
    }

    // ===========================
    // VÉRIFIER QU'ELLE N'EST PAS VALIDÉE
    // ===========================
    if (category.isValidated) {
      return res.status(409).json({
        success: false,
        message: 'Une catégorie validée ne peut pas être rejetée'
      });
    }

    // ===========================
    // SUPPRIMER
    // ===========================
    await Category.findByIdAndDelete(categoryId);

    res.json({
      success: true,
      message: 'Catégorie rejetée et supprimée'
    });
  } catch (error) {
    console.error('Erreur rejet catégorie:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur',
      error: error.message
    });
  }
};

/**
 * OBTENIR LES CATÉGORIES EN ATTENTE DE VALIDATION (MODÉRATEUR/ADMIN)
 */
exports.getPendingCategories = async (req, res) => {
  try {
    // ===========================
    // VÉRIFIER LES PERMISSIONS
    // ===========================
    if (req.userRole !== 'moderator' && req.userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Accès modérateur requis'
      });
    }

    const { limit = 20, page = 1 } = req.query;

    // ===========================
    // PAGINATION
    // ===========================
    const skip = (page - 1) * limit;

    // ===========================
    // RÉCUPÉRER LES CATÉGORIES EN ATTENTE
    // ===========================
    const categories = await Category.find({ isValidated: false })
      .populate('suggestedBy')
      .limit(Number(limit))
      .skip(skip)
      .sort({ createdAt: 1 });

    const total = await Category.countDocuments({ isValidated: false });

    res.json({
      success: true,
      categories,
      total,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Erreur catégories en attente:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur',
      error: error.message
    });
  }
};

/**
 * RECHERCHER DES CATÉGORIES
 */
exports.searchCategories = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'La recherche doit faire au moins 2 caractères'
      });
    }

    // ===========================
    // RECHERCHER LES CATÉGORIES
    // ===========================
    const categories = await Category.find({
      $and: [
        { isValidated: true, isActive: true },
        {
          $or: [
            { name: new RegExp(q, 'i') },
            { description: new RegExp(q, 'i') }
          ]
        }
      ]
    }).limit(20);

    res.json({
      success: true,
      categories
    });
  } catch (error) {
    console.error('Erreur recherche catégories:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur',
      error: error.message
    });
  }
};

/**
 * OBTENIR LES CATÉGORIES POPULAIRES
 */
exports.getPopularCategories = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const categories = await Category.find({
      isValidated: true,
      isActive: true
    })
      .limit(Number(limit))
      .sort({ productsCount: -1 });

    res.json({
      success: true,
      categories
    });
  } catch (error) {
    console.error('Erreur catégories populaires:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur',
      error: error.message
    });
  }
};

/**
 * DÉSACTIVER UNE CATÉGORIE (ADMIN)
 */
exports.deactivateCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;

    const category = await Category.findByIdAndUpdate(
      categoryId,
      { isActive: false },
      { new: true }
    );

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Catégorie non trouvée'
      });
    }

    res.json({
      success: true,
      message: 'Catégorie désactivée',
      category
    });
  } catch (error) {
    console.error('Erreur désactivation catégorie:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur',
      error: error.message
    });
  }
};

/**
 * RÉACTIVER UNE CATÉGORIE (ADMIN)
 */
exports.reactivateCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;

    const category = await Category.findByIdAndUpdate(
      categoryId,
      { isActive: true },
      { new: true }
    );

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Catégorie non trouvée'
      });
    }

    res.json({
      success: true,
      message: 'Catégorie réactivée',
      category
    });
  } catch (error) {
    console.error('Erreur réactivation catégorie:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur',
      error: error.message
    });
  }
};
