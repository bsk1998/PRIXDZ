const Price = require('../models/Price');
const Product = require('../models/Product');
const User = require('../models/User');

/**
 * AJOUTER UN PRIX
 */
exports.addPrice = async (req, res) => {
  try {
    const { productId, price, city, region, storeName, storeType } = req.body;

    // ===========================
    // VÉRIFIER LES CHAMPS OBLIGATOIRES
    // ===========================
    if (!productId || !price || !city) {
      return res.status(400).json({
        success: false,
        message: 'Produit, prix et ville sont obligatoires'
      });
    }

    if (price <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Le prix doit être positif'
      });
    }

    // ===========================
    // VÉRIFIER QUE LE PRODUIT EXISTE
    // ===========================
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Produit non trouvé',
        code: 'PRODUCT_NOT_FOUND'
      });
    }

    // ===========================
    // CRÉER LE PRIX
    // ===========================
    const newPrice = new Price({
      product: productId,
      user: req.userId,
      price: parseFloat(price),
      city: city.toLowerCase(),
      region: region ? region.toLowerCase() : null,
      storeName: storeName || null,
      storeType: storeType || 'petit_commerce'
    });

    await newPrice.save();
    await newPrice.populate('user');

    // ===========================
    // METTRE À JOUR LES STATISTIQUES DU PRODUIT
    // ===========================
    const allPrices = await Price.find({ product: productId, isActive: true });
    
    const averagePrice = allPrices.reduce((sum, p) => sum + p.price, 0) / allPrices.length;
    const lowestPrice = Math.min(...allPrices.map(p => p.price));
    const highestPrice = Math.max(...allPrices.map(p => p.price));

    await Product.findByIdAndUpdate(
      productId,
      {
        priceCount: allPrices.length,
        averagePrice: Math.round(averagePrice * 100) / 100,
        lowestPrice,
        highestPrice,
        lastPriceUpdate: new Date()
      }
    );

    // ===========================
    // INCRÉMENTER LE COMPTEUR DE L'UTILISATEUR
    // ===========================
    await User.findByIdAndUpdate(
      req.userId,
      { $inc: { verifiedPrices: 1 } }
    );

    res.status(201).json({
      success: true,
      message: 'Prix ajouté avec succès',
      price: newPrice
    });
  } catch (error) {
    console.error('Erreur ajout prix:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'ajout du prix',
      error: error.message
    });
  }
};

/**
 * OBTENIR LES PRIX D'UN PRODUIT PAR VILLE
 */
exports.getPricesByCity = async (req, res) => {
  try {
    const { productId } = req.params;
    const { city } = req.query;

    // ===========================
    // VÉRIFIER QUE LE PRODUIT EXISTE
    // ===========================
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Produit non trouvé'
      });
    }

    // ===========================
    // CONSTRUIRE LA REQUÊTE
    // ===========================
    let query = { product: productId, isActive: true };
    if (city) {
      query.city = new RegExp(city, 'i');
    }

    // ===========================
    // RÉCUPÉRER LES PRIX
    // ===========================
    const prices = await Price.find(query)
      .populate('user')
      .sort({ validationCount: -1, createdAt: -1 });

    // ===========================
    // GROUPER PAR VILLE
    // ===========================
    const pricesByCity = {};
    prices.forEach(p => {
      if (!pricesByCity[p.city]) {
        pricesByCity[p.city] = [];
      }
      pricesByCity[p.city].push(p);
    });

    res.json({
      success: true,
      pricesByCity,
      totalPrices: prices.length
    });
  } catch (error) {
    console.error('Erreur récupération prix par ville:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur',
      error: error.message
    });
  }
};

/**
 * OBTENIR LES PRIX D'UN PRODUIT DANS UNE VILLE SPÉCIFIQUE
 */
exports.getPricesInCity = async (req, res) => {
  try {
    const { productId, city } = req.params;

    const prices = await Price.find({
      product: productId,
      city: new RegExp(city, 'i'),
      isActive: true
    })
      .populate('user')
      .sort({ validationCount: -1, createdAt: -1 });

    // ===========================
    // CALCULER LES STATISTIQUES
    // ===========================
    const priceValues = prices.map(p => p.price);
    const stats = {
      average: prices.length > 0 
        ? Math.round(priceValues.reduce((a, b) => a + b, 0) / prices.length * 100) / 100 
        : 0,
      min: prices.length > 0 ? Math.min(...priceValues) : 0,
      max: prices.length > 0 ? Math.max(...priceValues) : 0,
      count: prices.length
    };

    res.json({
      success: true,
      city,
      prices,
      stats
    });
  } catch (error) {
    console.error('Erreur récupération prix dans ville:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur',
      error: error.message
    });
  }
};

/**
 * VALIDER UN PRIX (comme l'utilisateur connecté)
 */
exports.validatePrice = async (req, res) => {
  try {
    const { priceId } = req.params;

    // ===========================
    // RÉCUPÉRER LE PRIX
    // ===========================
    const price = await Price.findById(priceId);
    if (!price) {
      return res.status(404).json({
        success: false,
        message: 'Prix non trouvé'
      });
    }

    // ===========================
    // VÉRIFIER QUE L'UTILISATEUR NE VALIDE PAS SON PROPRE PRIX
    // ===========================
    if (price.user.toString() === req.userId) {
      return res.status(403).json({
        success: false,
        message: 'Vous ne pouvez pas valider votre propre prix'
      });
    }

    // ===========================
    // VALIDER LE PRIX
    // ===========================
    const alreadyValidated = price.validatedBy.some(
      val => val.user.toString() === req.userId
    );

    if (!alreadyValidated) {
      price.validate(req.userId);
      await price.save();

      // ===========================
      // INCRÉMENTER LE SCORE DE L'UTILISATEUR QUI A AJOUTÉ LE PRIX
      // ===========================
      await User.findByIdAndUpdate(
        price.user,
        { $inc: { pricesValidatedByOthers: 1 } }
      );
    }

    res.json({
      success: true,
      message: 'Prix validé',
      price
    });
  } catch (error) {
    console.error('Erreur validation prix:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur',
      error: error.message
    });
  }
};

/**
 * SIGNALER UN PRIX COMME INCORRECT
 */
exports.reportPrice = async (req, res) => {
  try {
    const { priceId } = req.params;
    const { reason } = req.body;

    // ===========================
    // VÉRIFIER QUE LA RAISON EST FOURNIE
    // ===========================
    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Veuillez fournir une raison'
      });
    }

    // ===========================
    // RÉCUPÉRER LE PRIX
    // ===========================
    const price = await Price.findById(priceId);
    if (!price) {
      return res.status(404).json({
        success: false,
        message: 'Prix non trouvé'
      });
    }

    // ===========================
    // SIGNALER LE PRIX
    // ===========================
    price.reportPrice(req.userId, reason);
    await price.save();

    res.json({
      success: true,
      message: 'Prix signalé',
      price
    });
  } catch (error) {
    console.error('Erreur signalement prix:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur',
      error: error.message
    });
  }
};

/**
 * ARCHIVER UN PRIX (le créateur ou admin)
 */
exports.archivePrice = async (req, res) => {
  try {
    const { priceId } = req.params;

    const price = await Price.findById(priceId);
    if (!price) {
      return res.status(404).json({
        success: false,
        message: 'Prix non trouvé'
      });
    }

    // ===========================
    // VÉRIFIER LES PERMISSIONS
    // ===========================
    if (price.user.toString() !== req.userId && req.userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Vous n\'avez pas la permission d\'archiver ce prix'
      });
    }

    // ===========================
    // ARCHIVER
    // ===========================
    price.isArchived = true;
    price.isActive = false;
    await price.save();

    // ===========================
    // RECALCULER LES PRIX DU PRODUIT
    // ===========================
    const allPrices = await Price.find({
      product: price.product,
      isActive: true
    });

    if (allPrices.length > 0) {
      const averagePrice = allPrices.reduce((sum, p) => sum + p.price, 0) / allPrices.length;
      const lowestPrice = Math.min(...allPrices.map(p => p.price));
      const highestPrice = Math.max(...allPrices.map(p => p.price));

      await Product.findByIdAndUpdate(
        price.product,
        {
          priceCount: allPrices.length,
          averagePrice: Math.round(averagePrice * 100) / 100,
          lowestPrice,
          highestPrice
        }
      );
    }

    res.json({
      success: true,
      message: 'Prix archivé'
    });
  } catch (error) {
    console.error('Erreur archivage prix:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur',
      error: error.message
    });
  }
};

/**
 * OBTENIR LES PRIX RÉCENTS (TOUTES VILLES)
 */
exports.getRecentPrices = async (req, res) => {
  try {
    const { limit = 20, page = 1 } = req.query;

    const skip = (page - 1) * limit;

    const prices = await Price.find({ isActive: true })
      .populate('product user')
      .limit(Number(limit))
      .skip(skip)
      .sort({ createdAt: -1 });

    const total = await Price.countDocuments({ isActive: true });

    res.json({
      success: true,
      prices,
      total,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Erreur récupération prix récents:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur',
      error: error.message
    });
  }
};

/**
 * OBTENIR LE NIVEAU DE CONFIANCE D'UN PRIX
 */
exports.getPriceTrustLevel = async (req, res) => {
  try {
    const { priceId } = req.params;

    const price = await Price.findById(priceId).populate('user');
    if (!price) {
      return res.status(404).json({
        success: false,
        message: 'Prix non trouvé'
      });
    }

    const trustLevel = price.getTrustLevel();

    res.json({
      success: true,
      price: {
        _id: price._id,
        price: price.price,
        validationCount: price.validationCount,
        reportCount: price.reportCount,
        trustLevel,
        user: {
          username: price.user.username,
          reliabilityScore: price.user.reliabilityScore
        }
      }
    });
  } catch (error) {
    console.error('Erreur confiance prix:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur',
      error: error.message
    });
  }
};
