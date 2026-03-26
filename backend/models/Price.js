const mongoose = require('mongoose');

/**
 * Schéma des prix des produits
 * Contient le prix, la ville, et les validations des autres utilisateurs
 */
const priceSchema = new mongoose.Schema(
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
    // UTILISATEUR QUI A AJOUTÉ LE PRIX
    // ===========================
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'L\'utilisateur est obligatoire']
    },

    // ===========================
    // PRIX
    // ===========================
    price: {
      type: Number,
      required: [true, 'Le prix est obligatoire'],
      min: [0, 'Le prix ne peut pas être négatif']
    },
    currency: {
      type: String,
      default: 'DZD',
      enum: ['DZD', 'USD', 'EUR']
    },

    // ===========================
    // LOCALISATION
    // ===========================
    city: {
      type: String,
      required: [true, 'La ville est obligatoire'],
      lowercase: true,
      enum: [
        'alger', 'oran', 'constantine', 'annaba', 'blida', 'béjaïa',
        'tizi ouzou', 'sétif', 'batna', 'bouïra', 'chlef', 'laghouat',
        'saïda', 'skikda', 'sidi bel abbès', 'tipaza', 'mascara',
        'ouargla', 'arzew', 'relizane'
      ]
    },
    region: {
      type: String,
      default: null,
      lowercase: true
    },
    storeName: {
      type: String,
      default: null
    },
    storeType: {
      type: String,
      enum: ['supermarché', 'petit_commerce', 'marché', 'en_ligne', 'autre'],
      default: 'petit_commerce'
    },

    // ===========================
    // VALIDATIONS PAR D'AUTRES UTILISATEURS
    // ===========================
    validatedBy: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        },
        validatedAt: {
          type: Date,
          default: Date.now
        }
      }
    ],
    validationCount: {
      type: Number,
      default: 0,
      min: 0
    },

    // ===========================
    // SIGNALEMENTS
    // ===========================
    reportedBy: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        },
        reason: {
          type: String,
          enum: ['prix_incorrect', 'doublon', 'spam', 'autre'],
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
    isDisputed: {
      type: Boolean,
      default: false
    },

    // ===========================
    // STATUT
    // ===========================
    isActive: {
      type: Boolean,
      default: true
    },
    isArchived: {
      type: Boolean,
      default: false
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
    expiresAt: {
      type: Date,
      default: () => new Date(+new Date() + 30 * 24 * 60 * 60 * 1000) // 30 jours
    }
  },
  { timestamps: true }
);

// ===========================
// INDEXES POUR OPTIMISER LES REQUÊTES
// ===========================
// Index pour rechercher par produit et ville
priceSchema.index({ product: 1, city: 1 });

// Index pour obtenir les prix récents d'un produit
priceSchema.index({ product: 1, createdAt: -1 });

// Index pour les prix par ville
priceSchema.index({ city: 1 });

// Index pour les prix par utilisateur
priceSchema.index({ user: 1 });

// TTL Index : supprimer automatiquement après expiration
priceSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// ===========================
// MÉTHODE : VALIDER UN PRIX
// ===========================
priceSchema.methods.validate = function (userId) {
  const alreadyValidated = this.validatedBy.some(
    val => val.user.toString() === userId.toString()
  );

  if (!alreadyValidated) {
    this.validatedBy.push({
      user: userId,
      validatedAt: new Date()
    });
    this.validationCount += 1;
  }

  return this;
};

// ===========================
// MÉTHODE : SIGNALER UN PRIX
// ===========================
priceSchema.methods.reportPrice = function (userId, reason) {
  const alreadyReported = this.reportedBy.some(
    r => r.user.toString() === userId.toString()
  );

  if (!alreadyReported) {
    this.reportedBy.push({
      user: userId,
      reason,
      reportedAt: new Date()
    });
    this.reportCount += 1;

    // Si plus de 2 signalements, marquer comme disputé
    if (this.reportCount >= 2) {
      this.isDisputed = true;
    }
  }

  return this;
};

// ===========================
// MÉTHODE : VÉRIFIER LA CONFIANCE DU PRIX
// ===========================
priceSchema.methods.getTrustLevel = function () {
  const validationRatio = this.validationCount / Math.max(1, this.reportCount + 1);

  if (validationRatio >= 3) return 'très_fiable';
  if (validationRatio >= 1) return 'fiable';
  if (this.isDisputed) return 'non_fiable';
  return 'neutre';
};

// ===========================
// VIRTUAL : Âge du prix en jours
// ===========================
priceSchema.virtual('ageInDays').get(function () {
  const now = new Date();
  const diff = now - this.createdAt;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
});

module.exports = mongoose.model('Price', priceSchema);
