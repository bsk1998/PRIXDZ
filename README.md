# 🇩🇿 PRIXDZ - Comparaison de Prix en Algérie

Application mobile **gratuite** pour les habitants d'Algérie permettant de **suivre et comparer les prix des produits** par ville et région.

![License](https://img.shields.io/badge/License-MIT-blue.svg)
![Platform](https://img.shields.io/badge/Platform-Android%20%7C%20iOS-green.svg)
![Flutter](https://img.shields.io/badge/Flutter-3.x-blue.svg)
![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)

---

## 🎯 Fonctionnalités

✅ **Recherche de produits** - Par nom, catégorie, ville, région  
✅ **Ajout de prix** - Simple et rapide  
✅ **Scan IA** - Identifie les produits par photo via Grok API  
✅ **Commentaires & Avis** - Mini réseau social par produit  
✅ **Système de fiabilité** - Score utilisateur basé sur la validation des prix  
✅ **Prix par ville** - Comparaison géographique  
✅ **Catégories flexibles** - Suggestion de nouvelles catégories  
✅ **Libre et gratuit** - 100% gratuit pour tous  

---

## 📱 Technologies

### Frontend
- **Flutter** 3.x (Android & iOS)
- Provider (State Management)
- HTTP / Dio (Networking)
- Image Picker & Camera

### Backend
- **Node.js** + Express
- **MongoDB** (Base de données)
- JWT (Authentification)
- Multer (Upload fichiers)
- Axios (HTTP Client)

### API IA
- **Grok API** (xAI) - Reconnaissance d'image

---

## 🚀 Installation Rapide

### Backend

```bash
cd backend
npm install
cp .env.example .env
# Configurer MongoDB URI et GROK_API_KEY dans .env
npm run dev
