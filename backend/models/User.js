const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * Schéma Utilisateur
 * Contient les infos de l'utilisateur et son score de fiabilité
 */
const userSchema = new mongoose.Schema(
  {
    // ===========================
    // INFOS DE BASE
    // ===========================
    username: {
      type: String,
      required: [true, 'Veuillez entrer un nom d\'utilisateur'],
      unique: true,
      minlength: [3, 'Le nom d\'utilisateur doit faire au moins 3 caractères'],
      maxlength: [30, 'Le nom d\'utilisateur ne doit pas dépasser 30 caractères'],
      lowercase: true,
      trim: true,
      match: [/^[a-zA-Z0-9_-]+$/, 'Le nom d\'utilisateur ne peut contenir que des lettres, chiffres, - et _']
    },
    email: {
      type: String,
      required: [true, 'Veuillez entrer une adresse email'],
      unique: true,
      lowercase: true,
      match: [/.+\@.+\..+/, 'Veuillez entrer une adresse email valide']
    },
    passwordHash: {
      type: String,
      required: [true, 'Veuillez entrer un mot de passe'],
      minlength: [6, 'Le mot de passe doit faire au moins 6 caractères'],
      select: false // Ne pas retourner le hash par défaut
    },

    // ===========================
    // LOCALISATION
    // ===========================
    city: {
      type: String,
      default: null,
      enum: [
        'Alger', 'Oran', 'Constantine', 'Annaba', 'Blida', 'Béjaïa',
        'Tizi Ouzou', 'Sétif', 'Batna', 'Bouïra', 'Chlef', 'Laghouat',
        'Saïda', 'Skikda', 'Sidi Bel Abbès', 'Tipaza', 'Mascara',
        'Ouargla', 'Arzew', 'Relizane', null
      ]
    },
    region: {
      type: String,
      default: null
    },

    // ===========================
    // SCORE DE FIABILITÉ
    // ===========================
    reliabilityScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    verifiedPrices: {
      type: Number,
      default: 0
    },
    pricesValidatedByOthers: {
      type: Number,
      default: 0
    },
    totalComments: {
      type: Number,
      default: 0
    },
    reportedComments: {
      type: Number,
      default: 0
    },

    // ===========================
    // RÔLE ET PERMISSIONS
    // ===========================
    role: {
      type: String,
      enum: ['user', 'moderator', 'admin'],
      default: 'user'
    },

    // ===========================
    // STATUT
    // ===========================
    isActive: {
      type: Boolean,
      default: true
    },
    isBanned: {
      type: Boolean,
      default: false
    },
    banReason: {
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
    },
    lastLoginAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

// ===========================
// HASH LE MOT DE PASSE AVANT LA SAUVEGARDE
// ===========================
userSchema.pre('save', async function (next) {
  // Si le mot de passe n'a pas été modifié, on continue
  if (!this.isModified('passwordHash')) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// ===========================
// MÉTHODE : COMPARER LES MOTS DE PASSE
// ===========================
userSchema.methods.comparePassword = async function (password) {
  return bcrypt.compare(password, this.passwordHash);
};

// ===========================
// MÉTHODE : RETIRER LE MOT DE PASSE LORS DE LA SERIALISATION
// ===========================
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  return obj;
};

// ===========================
// MÉTHODE : CALCULER LE SCORE DE FIABILITÉ
// ===========================
userSchema.methods.calculateReliabilityScore = function () {
  const verifiedWeight = 5;
  const validatedWeight = 10;
  const commentWeight = 2;

  const score =
    (this.verifiedPrices * verifiedWeight +
      this.pricesValidatedByOthers * validatedWeight +
      this.totalComments * commentWeight) /
    (verifiedWeight + validatedWeight + commentWeight);

  // Limiter entre 0 et 100
  this.reliabilityScore = Math.min(100, Math.max(0, Math.round(score)));
  return this.reliabilityScore;
};

// ===========================
// INDEX POUR OPTIMISER LES REQUÊTES
// ===========================
userSchema.index({ username: 1 });
userSchema.index({ email: 1 });
userSchema.index({ city: 1 });
userSchema.index({ createdAt: -1 });

module.exports = mongoose.model('User', userSchema);
