# Analyseur de Réponses Ouvertes

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![Python 3.8+](https://img.shields.io/badge/python-3.8+-blue.svg)](https://www.python.org/downloads/)
[![Flask](https://img.shields.io/badge/flask-2.0+-green.svg)](https://flask.palletsprojects.com/)

Une application minimaliste et efficace pour analyser des réponses ouvertes en utilisant l'API Mistral AI.

![Interface de l'application](static/img/screenshot.png)

## 🚀 Fonctionnalités

- Importation de fichiers CSV contenant des réponses à analyser
- Analyse automatique des réponses en 4 étapes:
  1. **Extraction des tags** : Identification des concepts clés dans chaque réponse sans limitation de nombre
  2. **Normalisation des tags** : Regroupement des synonymes et uniformisation des formulations
  3. **Réattribution des tags normalisés** : Association des tags normalisés à chaque réponse
  4. **Génération de synthèses par tag** : Résumé des idées principales avec nombre d'utilisateurs et verbatims
- Interface intuitive avec trois sections principales:
  - **Synthèses** : Résumés automatiques pour chaque tag avec verbatims représentatifs
  - **Tags** : Visualisation des tags originaux et normalisés avec leur mapping
  - **Données** : Tableau détaillé des réponses avec leurs tags associés
- Traitement de jeux de données de toute taille (aucune limitation)
- Suivi en temps réel de la progression de l'analyse

## 📖 Documentation

Pour une explication technique détaillée du workflow et du fonctionnement interne de l'application, consultez le fichier [DOCUMENTATION.md](DOCUMENTATION.md).

## 🛠 Prérequis

- Python 3.8 ou version ultérieure
- Pip (gestionnaire de paquets Python)
- Une clé API Mistral AI (gratuite ou payante)

## 🔧 Installation

1. Clonez ce dépôt ou téléchargez les fichiers sources
2. Créez un environnement virtuel Python (recommandé):

```bash
python3 -m venv venv
source venv/bin/activate  # Sur Windows: venv\Scripts\activate
```

3. Installez les dépendances:

```bash
pip3 install -r requirements.txt
```

## ⚙️ Configuration

Avant d'utiliser l'application, vous devez configurer votre clé API Mistral :

1. Créez un fichier `.env` à la racine du projet avec le contenu suivant :
```
MISTRAL_API_KEY=votre_cle_api_ici
MISTRAL_MODEL=mistral-small-latest
```

2. Remplacez `votre_cle_api_ici` par votre clé API Mistral (obtenue sur [https://console.mistral.ai](https://console.mistral.ai))

3. Vous pouvez également spécifier un autre modèle Mistral si vous avez un compte payant (mistral-medium-latest ou mistral-large-latest)

## 📖 Utilisation

1. Lancez l'application:

```bash
python3 app.py
```

2. Ouvrez un navigateur et accédez à `http://localhost:5000`
3. Configurez votre clé API Mistral si ce n'est pas déjà fait
4. Choisissez entre utiliser les données de test ou importer votre propre fichier CSV
5. Cliquez sur "Analyser" pour démarrer l'analyse
6. Suivez la progression en temps réel dans l'onglet "Traitement"
7. Une fois l'analyse terminée, explorez les résultats dans les onglets "Synthèses", "Tags" et "Données"

### 📄 Format des fichiers d'entrée

- **CSV**: Le fichier doit contenir une colonne nommée "response" ou "réponse" avec les réponses à analyser.

## 🔍 Processus d'analyse

L'application utilise un processus en plusieurs étapes pour analyser les réponses:

1. **Chargement des données**: Lecture du fichier CSV et extraction des réponses
2. **Extraction des tags**: Utilisation de Mistral AI pour identifier les concepts clés dans chaque réponse
3. **Normalisation des tags**: Regroupement des tags similaires en catégories cohérentes
4. **Génération de synthèses**: Pour chaque tag normalisé, une synthèse est générée avec:
   - Un résumé des idées principales
   - Le nombre d'utilisateurs concernés
   - Des verbatims représentatifs (citations exactes)

Ce processus permet d'obtenir une vue d'ensemble structurée des retours utilisateurs, facilitant l'identification des tendances et des problématiques principales.

## 🗂 Structure du projet

```
open-response-analyzer/
│
├── app.py                 # Application Flask principale
├── .env                   # Configuration des clés API (à créer)
├── config.json            # Configuration de l'application
├── example_data.csv       # Données d'exemple
├── README.md              # Documentation utilisateur
├── DOCUMENTATION.md       # Documentation technique
├── requirements.txt       # Dépendances
│
├── static/                # Fichiers statiques
│   └── app.js             # Script principal de l'application
│
└── templates/             # Templates HTML
    └── index.html         # Page principale
```

## 📚 Dépendances principales

- **Flask**: Framework web léger pour Python
- **Pandas**: Manipulation et analyse de données
- **MistralAI**: Client officiel pour l'API Mistral AI
- **python-dotenv**: Gestion des variables d'environnement
- **Tailwind CSS**: Framework CSS pour l'interface utilisateur

## 📜 Licence

Ce projet est distribué sous licence GNU Affero General Public License v3.0 (AGPL-3.0).

## 🤝 Contribuer

Les contributions sont les bienvenues! N'hésitez pas à ouvrir une issue ou une pull request pour améliorer l'application. 