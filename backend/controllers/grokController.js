const axios = require('axios');
const Product = require('../models/Product');
const Category = require('../models/Category');

/**
 * RECONNAÎTRE UN PRODUIT PAR PHOTO (Grok API)
 */
exports.recognizeProduct = async (req, res) => {
  try {
    // ===========================
    // VÉRIFIER QUE LA PHOTO EST FOURNIE
    // ===========================
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Une image est requise',
        code: 'NO_IMAGE'
      });
    }

    // ===========================
    // VÉRIFIER LA CLÉ API GROK
    // ===========================
    if (!process.env.GROK_API_KEY) {
      return res.status(500).json({
        success: false,
        message: 'Clé API Grok non configurée',
        code: 'GROK_NOT_CONFIGURED'
      });
    }

    // ===========================
    // LIRE L'IMAGE EN BASE64
    // ===========================
    const fs = require('fs');
    const imageBuffer = fs.readFileSync(req.file.path);
    const base64Image = imageBuffer.toString('base64');

    // ===========================
    // ENVOYER À L'API GROK
    // ===========================
    const grokResponse = await axios.post(
      'https://api.x.ai/v1/chat/completions',
      {
        model: 'grok-vision-beta',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/jpeg',
                  data: base64Image
                }
              },
              {
                type: 'text',
                text: `Analysez cette image et identifiez le produit. Répondez en JSON avec la structure suivante:
                {
                  "productName": "nom du produit",
                  "category": "catégorie estimée",
                  "brand": "marque si visible",
                  "description": "description brève",
                  "confidence": 0.95,
                  "price": "prix visible si présent"
                }
                
                Soyez précis et détecté la catégorie parmi: Alimentaire, Hygiène, Électronique, Vêtements, Livres, Autres`
              }
            ]
          }
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.GROK_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    // ===========================
    // EXTRAIRE LA RÉPONSE
    // ===========================
    const content = grokResponse.data.choices[0].message.content;
    
    // Parser la réponse JSON
    let productData;
    try {
      productData = JSON.parse(content);
    } catch (parseError) {
      // Essayer d'extraire le JSON de la réponse
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        productData = JSON.parse(jsonMatch[0]);
      } else {
        return res.status(500).json({
          success: false,
          message: 'Impossible de traiter la réponse de Grok',
          error: content
        });
      }
    }

    // ===========================
    // SUPPRIMER L'IMAGE TEMPORAIRE
    // ===========================
    fs.unlinkSync(req.file.path);

    // ===========================
    // CHERCHER LES PRODUITS SIMILAIRES
    // ===========================
    const similarProducts = await Product.find({
      $or: [
        { name: new RegExp(productData.productName, 'i') },
        { name: new RegExp(productData.brand, 'i') }
      ]
    })
      .populate('category')
      .limit(5);

    res.json({
      success: true,
      message: 'Produit identifié avec succès',
      recognizedProduct: {
        name: productData.productName,
        brand: productData.brand,
        category: productData.category,
        description: productData.description,
        confidence: productData.confidence,
        estimatedPrice: productData.price
      },
      similarProducts,
      grokRawResponse: productData
    });
  } catch (error) {
    // Supprimer l'image en cas d'erreur
    if (req.file) {
      try {
        require('fs').unlinkSync(req.file.path);
      } catch (e) {
        // Ignorer l'erreur de suppression
      }
    }

    console.error('Erreur reconnaissance Grok:', error);

    // Distinguer les erreurs
    if (error.response?.status === 401) {
      return res.status(401).json({
        success: false,
        message: 'Clé API Grok invalide',
        code: 'GROK_AUTH_ERROR'
      });
    }

    if (error.response?.status === 429) {
      return res.status(429).json({
        success: false,
        message: 'Limite d\'appels API atteinte. Réessayez plus tard.',
        code: 'GROK_RATE_LIMIT'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Erreur lors de la reconnaissance du produit',
      error: error.message,
      code: 'GROK_ERROR'
    });
  }
};

/**
 * ANALYSER UNE IMAGE ET EXTRAIRE DES INFOS (VISION)
 */
exports.analyzeImage = async (req, res) => {
  try {
    // ===========================
    // VÉRIFIER QUE LA PHOTO EST FOURNIE
    // ===========================
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Une image est requise'
      });
    }

    // ===========================
    // VÉRIFIER LA CLÉ API GROK
    // ===========================
    if (!process.env.GROK_API_KEY) {
      return res.status(500).json({
        success: false,
        message: 'Clé API Grok non configurée'
      });
    }

    // ===========================
    // LIRE L'IMAGE EN BASE64
    // ===========================
    const fs = require('fs');
    const imageBuffer = fs.readFileSync(req.file.path);
    const base64Image = imageBuffer.toString('base64');

    // ===========================
    // ENVOYER À L'API GROK
    // ===========================
    const grokResponse = await axios.post(
      'https://api.x.ai/v1/chat/completions',
      {
        model: 'grok-vision-beta',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/jpeg',
                  data: base64Image
                }
              },
              {
                type: 'text',
                text: `Analysez cette image et fournissez une analyse détaillée en JSON:
                {
                  "description": "description générale",
                  "mainObjects": ["objet1", "objet2"],
                  "colors": ["couleur1", "couleur2"],
                  "quality": "haute/moyenne/basse",
                  "textVisible": "texte détecté si présent",
                  "estimatedPriceRange": "50-200 DZD si visible"
                }`
              }
            ]
          }
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.GROK_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    // ===========================
    // EXTRAIRE ET PARSER LA RÉPONSE
    // ===========================
    const content = grokResponse.data.choices[0].message.content;
    let analysisData;
    try {
      analysisData = JSON.parse(content);
    } catch (parseError) {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysisData = JSON.parse(jsonMatch[0]);
      }
    }

    // ===========================
    // SUPPRIMER L'IMAGE TEMPORAIRE
    // ===========================
    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      message: 'Image analysée',
      analysis: analysisData
    });
  } catch (error) {
    // Supprimer l'image en cas d'erreur
    if (req.file) {
      try {
        require('fs').unlinkSync(req.file.path);
      } catch (e) {
        // Ignorer
      }
    }

    console.error('Erreur analyse image:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'analyse de l\'image',
      error: error.message
    });
  }
};

/**
 * GÉNÉRER UNE DESCRIPTION DE PRODUIT (TEXTE)
 */
exports.generateProductDescription = async (req, res) => {
  try {
    const { productName, category, brand } = req.body;

    // ===========================
    // VÉRIFIER LES CHAMPS
    // ===========================
    if (!productName) {
      return res.status(400).json({
        success: false,
        message: 'Nom du produit requis'
      });
    }

    // ===========================
    // VÉRIFIER LA CLÉ API GROK
    // ===========================
    if (!process.env.GROK_API_KEY) {
      return res.status(500).json({
        success: false,
        message: 'Clé API Grok non configurée'
      });
    }

    // ===========================
    // ENVOYER À L'API GROK
    // ===========================
    const grokResponse = await axios.post(
      'https://api.x.ai/v1/chat/completions',
      {
        model: 'grok-2-1212',
        messages: [
          {
            role: 'user',
            content: `Générez une description courte et attrayante pour ce produit (max 200 caractères):
            
            Nom: ${productName}
            ${brand ? `Marque: ${brand}` : ''}
            ${category ? `Catégorie: ${category}` : ''}
            
            La description doit être claire, concise et en français.`
          }
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.GROK_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const description = grokResponse.data.choices[0].message.content.trim();

    res.json({
      success: true,
      description,
      productName,
      brand: brand || null,
      category: category || null
    });
  } catch (error) {
    console.error('Erreur génération description:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la génération de la description',
      error: error.message
    });
  }
};

/**
 * VÉRIFIER UN PRIX AVEC IA
 */
exports.verifyPrice = async (req, res) => {
  try {
    const { productName, price, city, category } = req.body;

    // ===========================
    // VÉRIFIER LES CHAMPS
    // ===========================
    if (!productName || !price || !city) {
      return res.status(400).json({
        success: false,
        message: 'Nom du produit, prix et ville sont requis'
      });
    }

    // ===========================
    // VÉRIFIER LA CLÉ API GROK
    // ===========================
    if (!process.env.GROK_API_KEY) {
      return res.status(500).json({
        success: false,
        message: 'Clé API Grok non configurée'
      });
    }

    // ===========================
    // ENVOYER À L'API GROK
    // ===========================
    const grokResponse = await axios.post(
      'https://api.x.ai/v1/chat/completions',
      {
        model: 'grok-2-1212',
        messages: [
          {
            role: 'user',
            content: `Analysez si ce prix semble raisonnable pour ce produit en Algérie:

            Produit: ${productName}
            ${category ? `Catégorie: ${category}` : ''}
            Prix: ${price} DZD
            Ville: ${city}

            Répondez en JSON:
            {
              "isReasonable": true/false,
              "priceLevel": "très_bas/bas/normal/élevé/très_élevé",
              "reason": "explication courte",
              "estimatedRange": "1000-2000 DZD"
            }`
          }
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.GROK_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    // ===========================
    // EXTRAIRE ET PARSER LA RÉPONSE
    // ===========================
    const content = grokResponse.data.choices[0].message.content;
    let verificationData;
    try {
      verificationData = JSON.parse(content);
    } catch (parseError) {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        verificationData = JSON.parse(jsonMatch[0]);
      }
    }

    res.json({
      success: true,
      verification: verificationData,
      product: {
        name: productName,
        price,
        city,
        category: category || null
      }
    });
  } catch (error) {
    console.error('Erreur vérification prix:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la vérification du prix',
      error: error.message
    });
  }
};

/**
 * OBTENIR LE STATUT DE L'API GROK
 */
exports.getGrokStatus = async (req, res) => {
  try {
    // ===========================
    // VÉRIFIER QUE LA CLÉ EST CONFIGURÉE
    // ===========================
    const isConfigured = !!process.env.GROK_API_KEY;

    if (!isConfigured) {
      return res.json({
        success: true,
        status: 'not_configured',
        message: 'Grok API n\'est pas configurée',
        configured: false
      });
    }

    // ===========================
    // TESTER LA CONNEXION AVEC UN APPEL SIMPLE
    // ===========================
    try {
      const testResponse = await axios.post(
        'https://api.x.ai/v1/chat/completions',
        {
          model: 'grok-2-1212',
          messages: [
            {
              role: 'user',
              content: 'Répond "OK" uniquement'
            }
          ]
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.GROK_API_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: 5000
        }
      );

      res.json({
        success: true,
        status: 'operational',
        message: 'Grok API est opérationnelle',
        configured: true,
        responseTime: 'fast'
      });
    } catch (apiError) {
      res.json({
        success: true,
        status: 'error',
        message: 'Grok API a des problèmes',
        configured: true,
        error: apiError.message
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la vérification du statut',
      error: error.message
    });
  }
};
