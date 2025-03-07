# Analyseur de Réponses Ouvertes

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![Python 3.8+](https://img.shields.io/badge/python-3.8+-blue.svg)](https://www.python.org/downloads/)
[![Flask](https://img.shields.io/badge/flask-2.0+-green.svg)](https://flask.palletsprojects.com/)

Une application minimaliste et efficace pour analyser des réponses ouvertes en utilisant un modèle de langage (LLM).

![Interface de l'application](static/img/screenshot.png)

## 🚀 Fonctionnalités

- Importation de fichiers CSV, JSON ou TXT contenant des réponses à analyser
- Analyse automatique des réponses en 5 étapes:
  1. Extraction des tags (concepts clés)
  2. Nettoyage et normalisation des tags
  3. Réattribution des tags normalisés à chaque réponse
  4. Regroupement par tag
  5. Synthèse des retours pour chaque tag
- Interface intuitive pour visualiser les résultats
- Exportation des résultats en CSV et JSON

## 🛠 Prérequis

- Python 3.8 ou version ultérieure
- Pip (gestionnaire de paquets Python)
- Une clé API pour un LLM (Mistral AI, OpenAI GPT ou Anthropic Claude)

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
```

2. Remplacez `votre_cle_api_ici` par votre clé API Mistral (obtenue sur [https://console.mistral.ai](https://console.mistral.ai))

3. Lancez l'application
4. Si nécessaire, vous pouvez modifier le modèle utilisé en cliquant sur "Configuration" dans la barre de navigation

## 📖 Utilisation

1. Lancez l'application:

```bash
python3 app.py
```

2. Ouvrez un navigateur et accédez à `http://localhost:5002`
3. Importez un fichier contenant des réponses ouvertes (formats acceptés: CSV, JSON, TXT)
4. Si nécessaire, sélectionnez la colonne contenant les réponses à analyser
5. Cliquez sur "Analyser les réponses"
6. Explorez les résultats dans les différents onglets:
   - **Tags**: Visualisation de la distribution des tags et liste des tags normalisés
   - **Synthèses**: Résumés des réponses pour chaque tag
   - **Données**: Tableau des réponses avec les tags associés
7. Exportez les résultats en CSV ou JSON pour une analyse plus approfondie

## 📄 Format des fichiers d'entrée

- **CSV**: Le fichier doit contenir une colonne avec les réponses. L'en-tête de colonne est requis.
- **JSON**: Le fichier doit contenir un tableau d'objets, chaque objet ayant un champ avec la réponse.
- **TXT**: Chaque ligne du fichier est considérée comme une réponse distincte.

## 🗂 Structure du projet

```
open-response-analyzer/
│
├── app.py                 # Application Flask principale
├── config.json            # Configuration du LLM
├── README.md              # Documentation
├── requirements.txt       # Dépendances
│
├── static/                # Fichiers statiques
│   ├── css/               # Styles CSS
│   │   └── style.css      # Styles personnalisés
│   │
│   ├── js/                # Scripts JavaScript
│   │   └── app.js         # Script principal de l'application
│   │
│   └── img/               # Images (si nécessaire)
│
└── templates/             # Templates HTML
    └── index.html         # Page principale
```

## 📚 Dépendances principales

- **Flask** (2.0+): Framework web léger pour Python
- **Pandas** (1.5+): Manipulation et analyse de données
- **Requests** (2.28+): Client HTTP pour les appels API
- **Bootstrap** (5.3): Framework CSS pour l'interface utilisateur
- **Chart.js** (4.0+): Bibliothèque de visualisation de données
- **MistralAI** (Client officiel pour l'API Mistral AI)
- **python-dotenv**: Pour la gestion des variables d'environnement

## 📜 Licence

Ce projet est distribué sous licence GNU Affero General Public License v3.0 (AGPL-3.0).

**Pourquoi AGPL-3.0 ?**
- Garantit que le code reste libre et open source
- Protège les droits des utilisateurs même dans un contexte de service en ligne
- Encourage la transparence et la collaboration
- Permet aux communautés d'adapter l'outil à leurs besoins
- Assure que les améliorations profitent à tous

[Lire le texte complet de la licence](LICENSE)

## 🤝 Contribuer

Les contributions sont les bienvenues! Voici comment vous pouvez aider:

1. Forkez le projet
2. Créez une branche pour votre fonctionnalité (`git checkout -b feature/AmazingFeature`)
3. Committez vos changements (`git commit -m 'Add some AmazingFeature'`)
4. Poussez vers la branche (`git push origin feature/AmazingFeature`)
5. Ouvrez une Pull Request

## 💬 Support

Pour toute question ou problème:
- Ouvrez une [issue](https://github.com/Fasterious/open-response-analyzer-app.py-/issues)
- Consultez les [discussions](https://github.com/Fasterious/open-response-analyzer-app.py-/discussions) 