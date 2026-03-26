const mongoose = require('mongoose');

/**
 * Schéma des commentaires sur les produits
 * Mini réseau social avec likes et système de signalement
 */
const commentSchema = new mongoose.Schema(
  {
    // ===========================
    // PRODUIT ASSOCIÉ
    // ===========================
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Le produit est obligatoire']
    },

    // ===========================
    // UTILISATEUR
    // ===========================
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'L\'utilisateur est obligatoire']
    },

    // ===========================
    // CONTENU
    // ===========================
    text: {
      type: String,
      required: [true, 'Le commentaire ne peut pas être vide'],
      minlength: [1, 'Le commentaire doit faire au moins 1 caractère'],
      maxlength: [500, 'Le commentaire ne doit pas dépasser 500 caractères'],
      trim: true
    },

    // ===========================
    // NOTE (1-5 ÉTOILES OPTIONNEL)
    // ===========================
    rating: {
      type: Number,
      min: [1, 'La note doit être au moins 1'],
      max: [5, 'La note ne doit pas dépasser 5'],
      default: null
    },

    // ===========================
    // LIKES
    // ===========================
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    ],
    likesCount: {
      type: Number,
      default: 0,
      min: 0
    },

    // ===========================
    // SIGNALEMENTS
    // ===========================
    reports: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        },
        reason: {
          type: String,
          enum: ['spam', 'insulte', 'hors_sujet', 'faux', 'autre'],
          default: 'autre'
        },
        reportedAt: {
          type: Date,
          default: Date.now
        }
      }
    ],
    reportCount: {
      type: Number,
      default: 0,
      min: 0
    },
    isReported: {
      type: Boolean,
      default: false
    },

    // ===========================
    // MODÉRATION
    // ===========================
    isDeleted: {
      type: Boolean,
      default: false
    },
    isHidden: {
      type: Boolean,
      default: false
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    deletionReason: {
      type: String,
      default: null
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
    }
  },
  { timestamps: true }
);

// ===========================
// INDEXES POUR OPTIMISER LES REQUÊTES
// ===========================
// Index pour obtenir les commentaires d'un produit
commentSchema.index({ product: 1, createdAt: -1 });

// Index pour obtenir les commentaires d'un utilisateur
commentSchema.index({ user: 1 });

// Index pour les commentaires non supprimés
commentSchema.index({ product: 1, isDeleted: 1 });

// Index pour les commentaires signalés
commentSchema.index({ isReported: 1 });

// ===========================
// MÉTHODE : AJOUTER UN LIKE
// ===========================
commentSchema.methods.addLike = function (userId) {
  if (!this.likes.includes(userId)) {
    this.likes.push(userId);
    this.likesCount = this.likes.length;
  }
  return this;
};

// ===========================
// MÉTHODE : RETIRER UN LIKE
// ===========================
commentSchema.methods.removeLike = function (userId) {
  this.likes = this.likes.filter(id => id.toString() !== userId.toString());
  this.likesCount = this.likes.length;
  return this;
};

// ===========================
// MÉTHODE : VÉRIFIER SI AIMÉ
// ===========================
commentSchema.methods.isLikedBy = function (userId) {
  return this.likes.some(id => id.toString() === userId.toString());
};

// ===========================
// MÉTHODE : SIGNALER UN COMMENTAIRE
// ===========================
commentSchema.methods.reportComment = function (userId, reason) {
  const alreadyReported = this.reports.some(
    r => r.user.toString() === userId.toString()
  );

  if (!alreadyReported) {
    this.reports.push({
      user: userId,
      reason,
      reportedAt: new Date()
    });
    this.reportCount += 1;

    // Si plus de 3 signalements, cacher le commentaire
    if (this.reportCount >= 3) {
      this.isHidden = true;
      this.isReported = true;
    }
  }

  return this;
};

// ===========================
// MÉTHODE : SUPPRIMER UN COMMENTAIRE
// ===========================
commentSchema.methods.softDelete = function (userId, reason) {
  this.isDeleted = true;
  this.deletedBy = userId;
  this.deletionReason = reason;
  return this;
};

// ===========================
// VIRTUAL : Score de qualité du commentaire
// ===========================
commentSchema.virtual('qualityScore').get(function () {
  const likeWeight = 1;
  const reportWeight = -2;

  return Math.max(0, this.likesCount * likeWeight + this.reportCount * reportWeight);
});

module.exports = mongoose.model('Comment', commentSchema);
