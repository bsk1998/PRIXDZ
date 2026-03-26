const mongoose = require('mongoose');

/**
 * Schéma des produits
 * Chaque produit a un nom, une catégorie, et peut avoir une photo
 */
const productSchema = new mongoose.Schema(
  {
    // ===========================
    // INFOS DE BASE
    // ===========================
    name: {
      type: String,
      required: [true, 'Le nom du produit est obligatoire'],
      trim: true,
      lowercase: true,
      minlength: [2, 'Le nom doit faire au moins 2 caractères'],
      maxlength: [100, 'Le nom ne doit pas dépasser 100 caractères']
    },

    // ===========================
    // CATÉGORIE
    // ===========================
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'La catégorie est obligatoire']
    },

    // ===========================
    // DESCRIPTION
    // ===========================
    description: {
      type: String,
      default: '',
      maxlength: [500, 'La description ne doit pas dépasser 500 caractères']
    },

    // ===========================
    // PHOTOS
    // ===========================
    photoUrl: {
      type: String,
      default: null
    },
    photoUrls: [
      {
        type: String
      }
    ],

    // ===========================
    // CRÉATEUR
    // ===========================
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },

    // ===========================
    // STATISTIQUES
    // ===========================
    priceCount: {
      type: Number,
      default: 0,
      min: 0
    },
    averagePrice: {
      type: Number,
      default: 0,
      min: 0
    },
    lowestPrice: {
      type: Number,
      default: 0,
      min: 0
    },
    highestPrice: {
      type: Number,
      default: 0,
      min: 0
    },
    commentCount: {
      type: Number,
      default: 0,
      min: 0
    },

    // ===========================
    // POPULARITÉ
    // ===========================
    views: {
      type: Number,
      default: 0,
      min: 0
    },
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    ],
    likesCount: {
      type: Number,
      default: 0
    },

    // ===========================
    // VALIDATION
    // ===========================
    isApproved: {
      type: Boolean,
      default: true
    },
    isActive: {
      type: Boolean,
      default: true
    },

    // ===========================
    // DATES
    // ===========================
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    },
    lastPriceUpdate: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

// ===========================
// INDEXES POUR OPTIMISER LES REQUÊTES
// ===========================
// Index texte pour la recherche
productSchema.index({ name: 'text', description: 'text' });

// Index composé pour éviter les doublons
productSchema.index(
  { name: 1, category: 1 },
  { unique: true, sparse: true }
);

// Autres indexes
productSchema.index({ category: 1, createdAt: -1 });
productSchema.index({ createdBy: 1 });
productSchema.index({ views: -1 });
productSchema.index({ likesCount: -1 });

// ===========================
// MÉTHODE : AJOUTER UN LIKE
// ===========================
productSchema.methods.addLike = function (userId) {
  if (!this.likes.includes(userId)) {
    this.likes.push(userId);
    this.likesCount = this.likes.length;
  }
  return this;
};

// ===========================
// MÉTHODE : RETIRER UN LIKE
// ===========================
productSchema.methods.removeLike = function (userId) {
  this.likes = this.likes.filter(id => id.toString() !== userId.toString());
  this.likesCount = this.likes.length;
  return this;
};

// ===========================
// MÉTHODE : VÉRIFIER SI AIMÉ
// ===========================
productSchema.methods.isLikedBy = function (userId) {
  return this.likes.some(id => id.toString() === userId.toString());
};

// ===========================
// MÉTHODE : INCRÉMENTER LES VUES
// ===========================
productSchema.methods.incrementViews = function () {
  this.views += 1;
  return this;
};

// ===========================
// VIRTUAL : Score de popularité
// ===========================
productSchema.virtual('popularityScore').get(function () {
  return Math.round((this.views * 0.3 + this.likesCount * 0.5 + this.priceCount * 0.2) / 10);
});

module.exports = mongoose.model('Product', productSchema);
