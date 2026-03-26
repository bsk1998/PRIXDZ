const mongoose = require('mongoose');

/**
 * Schéma des catégories de produits
 * Les catégories peuvent être suggérées par les utilisateurs
 */
const categorySchema = new mongoose.Schema(
  {
    // ===========================
    // NOM DE LA CATÉGORIE
    // ===========================
    name: {
      type: String,
      required: [true, 'Le nom de la catégorie est obligatoire'],
      unique: true,
      trim: true,
      lowercase: true,
      minlength: [3, 'Le nom doit faire au moins 3 caractères'],
      maxlength: [50, 'Le nom ne doit pas dépasser 50 caractères']
    },

    // ===========================
    // DESCRIPTION
    // ===========================
    description: {
      type: String,
      default: '',
      maxlength: [200, 'La description ne doit pas dépasser 200 caractères']
    },

    // ===========================
    // VALIDATION
    // ===========================
    isValidated: {
      type: Boolean,
      default: false
    },
    validatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    validatedAt: {
      type: Date,
      default: null
    },

    // ===========================
    // SUGGESTION PAR UTILISATEUR
    // ===========================
    suggestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },

    // ===========================
    // DESIGN & AFFICHAGE
    // ===========================
    icon: {
      type: String,
      default: '📦'
    },
    color: {
      type: String,
      default: '#3498db',
      match: [/^#[0-9A-F]{6}$/i, 'La couleur doit être au format hexadécimal (#RRGGBB)']
    },

    // ===========================
    // STATISTIQUES
    // ===========================
    productsCount: {
      type: Number,
      default: 0,
      min: 0
    },
    pricesCount: {
      type: Number,
      default: 0,
      min: 0
    },

    // ===========================
    // STATUT
    // ===========================
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
    }
  },
  { timestamps: true }
);

// ===========================
// INDEX POUR OPTIMISER LES REQUÊTES
// ===========================
categorySchema.index({ name: 1 });
categorySchema.index({ isValidated: 1 });
categorySchema.index({ createdAt: -1 });

// ===========================
// VIRTUAL : Obtenir le statut de validation
// ===========================
categorySchema.virtual('status').get(function () {
  if (this.isValidated) return 'validée';
  if (this.suggestedBy) return 'en attente';
  return 'archivée';
});

module.exports = mongoose.model('Category', categorySchema);
