const Comment = require('../models/Comment');
const Product = require('../models/Product');
const User = require('../models/User');

/**
 * AJOUTER UN COMMENTAIRE
 */
exports.addComment = async (req, res) => {
  try {
    const { productId, text, rating } = req.body;

    // ===========================
    // VÉRIFIER LES CHAMPS OBLIGATOIRES
    // ===========================
    if (!productId || !text) {
      return res.status(400).json({
        success: false,
        message: 'Produit et texte sont obligatoires'
      });
    }

    if (text.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Le commentaire ne peut pas être vide'
      });
    }

    if (text.length > 500) {
      return res.status(400).json({
        success: false,
        message: 'Le commentaire ne doit pas dépasser 500 caractères'
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
    // VÉRIFIER LA NOTE (1-5 ÉTOILES)
    // ===========================
    let ratingValue = null;
    if (rating !== undefined) {
      if (rating < 1 || rating > 5 || !Number.isInteger(rating)) {
        return res.status(400).json({
          success: false,
          message: 'La note doit être un entier entre 1 et 5'
        });
      }
      ratingValue = rating;
    }

    // ===========================
    // CRÉER LE COMMENTAIRE
    // ===========================
    const comment = new Comment({
      product: productId,
      user: req.userId,
      text: text.trim(),
      rating: ratingValue
    });

    await comment.save();
    await comment.populate('user');

    // ===========================
    // INCRÉMENTER LE COMPTEUR DU PRODUIT
    // ===========================
    await Product.findByIdAndUpdate(
      productId,
      { $inc: { commentCount: 1 } }
    );

    // ===========================
    // INCRÉMENTER LE COMPTEUR DE L'UTILISATEUR
    // ===========================
    await User.findByIdAndUpdate(
      req.userId,
      { $inc: { totalComments: 1 } }
    );

    res.status(201).json({
      success: true,
      message: 'Commentaire ajouté avec succès',
      comment
    });
  } catch (error) {
    console.error('Erreur ajout commentaire:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'ajout du commentaire',
      error: error.message
    });
  }
};

/**
 * OBTENIR LES COMMENTAIRES D'UN PRODUIT
 */
exports.getProductComments = async (req, res) => {
  try {
    const { productId } = req.params;
    const { limit = 20, page = 1, sortBy = 'recent' } = req.query;

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
    // DÉTERMINER L'ORDRE DE TRI
    // ===========================
    let sortQuery = { createdAt: -1 }; // Défaut: récent
    
    if (sortBy === 'likes') {
      sortQuery = { likesCount: -1, createdAt: -1 };
    } else if (sortBy === 'rating') {
      sortQuery = { rating: -1, createdAt: -1 };
    }

    // ===========================
    // PAGINATION
    // ===========================
    const skip = (page - 1) * limit;

    // ===========================
    // RÉCUPÉRER LES COMMENTAIRES
    // ===========================
    const comments = await Comment.find({
      product: productId,
      isDeleted: false
    })
      .populate('user')
      .limit(Number(limit))
      .skip(skip)
      .sort(sortQuery);

    // ===========================
    // COMPTER LE TOTAL
    // ===========================
    const total = await Comment.countDocuments({
      product: productId,
      isDeleted: false
    });

    // ===========================
    // VÉRIFIER LES LIKES DE L'UTILISATEUR CONNECTÉ
    // ===========================
    let result = comments.map(comment => {
      return {
        ...comment.toObject(),
        isLikedByMe: req.userId 
          ? comment.isLikedBy(req.userId)
          : false
      };
    });

    res.json({
      success: true,
      productId,
      comments: result,
      total,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Erreur récupération commentaires:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur',
      error: error.message
    });
  }
};

/**
 * LIKER/UNLIKER UN COMMENTAIRE
 */
exports.likeComment = async (req, res) => {
  try {
    const { commentId } = req.params;

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Commentaire non trouvé'
      });
    }

    if (comment.isDeleted) {
      return res.status(410).json({
        success: false,
        message: 'Ce commentaire a été supprimé'
      });
    }

    const isLiked = comment.isLikedBy(req.userId);

    if (isLiked) {
      // Retirer le like
      comment.removeLike(req.userId);
    } else {
      // Ajouter le like
      comment.addLike(req.userId);
    }

    await comment.save();

    res.json({
      success: true,
      message: isLiked ? 'Like retiré' : 'Like ajouté',
      comment: {
        _id: comment._id,
        likesCount: comment.likesCount,
        isLiked: !isLiked
      }
    });
  } catch (error) {
    console.error('Erreur like commentaire:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur',
      error: error.message
    });
  }
};

/**
 * SIGNALER UN COMMENTAIRE
 */
exports.reportComment = async (req, res) => {
  try {
    const { commentId } = req.params;
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

    const validReasons = ['spam', 'insulte', 'hors_sujet', 'faux', 'autre'];
    if (!validReasons.includes(reason)) {
      return res.status(400).json({
        success: false,
        message: 'Raison de signalement invalide'
      });
    }

    // ===========================
    // RÉCUPÉRER LE COMMENTAIRE
    // ===========================
    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Commentaire non trouvé'
      });
    }

    // ===========================
    // SIGNALER
    // ===========================
    comment.reportComment(req.userId, reason);
    await comment.save();

    res.json({
      success: true,
      message: 'Commentaire signalé. Un modérateur examinera le signalement.',
      comment
    });
  } catch (error) {
    console.error('Erreur signalement commentaire:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur',
      error: error.message
    });
  }
};

/**
 * SUPPRIMER UN COMMENTAIRE (créateur ou modérateur)
 */
exports.deleteComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { reason } = req.body;

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Commentaire non trouvé'
      });
    }

    // ===========================
    // VÉRIFIER LES PERMISSIONS
    // ===========================
    if (comment.user.toString() !== req.userId && 
        req.userRole !== 'moderator' && 
        req.userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Vous n\'avez pas la permission de supprimer ce commentaire'
      });
    }

    // ===========================
    // SOFT DELETE (marquer comme supprimé)
    // ===========================
    comment.softDelete(req.userId, reason || 'Supprimé par l\'utilisateur');
    await comment.save();

    // ===========================
    // DÉCRÉMENTER LE COMPTEUR DU PRODUIT
    // ===========================
    await Product.findByIdAndUpdate(
      comment.product,
      { $inc: { commentCount: -1 } }
    );

    // ===========================
    // DÉCRÉMENTER LE COMPTEUR DE L'UTILISATEUR
    // ===========================
    await User.findByIdAndUpdate(
      comment.user,
      { $inc: { totalComments: -1 } }
    );

    res.json({
      success: true,
      message: 'Commentaire supprimé'
    });
  } catch (error) {
    console.error('Erreur suppression commentaire:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur',
      error: error.message
    });
  }
};

/**
 * MODIFIER UN COMMENTAIRE
 */
exports.updateComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { text, rating } = req.body;

    // ===========================
    // RÉCUPÉRER LE COMMENTAIRE
    // ===========================
    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Commentaire non trouvé'
      });
    }

    // ===========================
    // VÉRIFIER LES PERMISSIONS
    // ===========================
    if (comment.user.toString() !== req.userId) {
      return res.status(403).json({
        success: false,
        message: 'Vous ne pouvez pas modifier ce commentaire'
      });
    }

    if (comment.isDeleted) {
      return res.status(410).json({
        success: false,
        message: 'Ce commentaire a été supprimé'
      });
    }

    // ===========================
    // METTRE À JOUR LE TEXTE
    // ===========================
    if (text !== undefined) {
      if (text.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Le commentaire ne peut pas être vide'
        });
      }
      if (text.length > 500) {
        return res.status(400).json({
          success: false,
          message: 'Le commentaire ne doit pas dépasser 500 caractères'
        });
      }
      comment.text = text.trim();
    }

    // ===========================
    // METTRE À JOUR LA NOTE
    // ===========================
    if (rating !== undefined) {
      if (rating < 1 || rating > 5 || !Number.isInteger(rating)) {
        return res.status(400).json({
          success: false,
          message: 'La note doit être un entier entre 1 et 5'
        });
      }
      comment.rating = rating;
    }

    comment.updatedAt = new Date();
    await comment.save();

    res.json({
      success: true,
      message: 'Commentaire mis à jour',
      comment
    });
  } catch (error) {
    console.error('Erreur modification commentaire:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur',
      error: error.message
    });
  }
};

/**
 * OBTENIR LES COMMENTAIRES D'UN UTILISATEUR
 */
exports.getUserComments = async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 20, page = 1 } = req.query;

    // ===========================
    // PAGINATION
    // ===========================
    const skip = (page - 1) * limit;

    // ===========================
    // RÉCUPÉRER LES COMMENTAIRES
    // ===========================
    const comments = await Comment.find({
      user: userId,
      isDeleted: false
    })
      .populate('product user')
      .limit(Number(limit))
      .skip(skip)
      .sort({ createdAt: -1 });

    const total = await Comment.countDocuments({
      user: userId,
      isDeleted: false
    });

    res.json({
      success: true,
      userId,
      comments,
      total,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Erreur commentaires utilisateur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur',
      error: error.message
    });
  }
};

/**
 * OBTENIR LES COMMENTAIRES SIGNALÉS (MODÉRATEURS)
 */
exports.getReportedComments = async (req, res) => {
  try {
    const { limit = 20, page = 1 } = req.query;

    // ===========================
    // VÉRIFIER LES PERMISSIONS
    // ===========================
    if (req.userRole !== 'moderator' && req.userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Accès modérateur requis'
      });
    }

    // ===========================
    // PAGINATION
    // ===========================
    const skip = (page - 1) * limit;

    // ===========================
    // RÉCUPÉRER LES COMMENTAIRES SIGNALÉS
    // ===========================
    const comments = await Comment.find({
      isReported: true
    })
      .populate('user')
      .limit(Number(limit))
      .skip(skip)
      .sort({ reportCount: -1, createdAt: -1 });

    const total = await Comment.countDocuments({ isReported: true });

    res.json({
      success: true,
      comments,
      total,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Erreur commentaires signalés:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur',
      error: error.message
    });
  }
};
