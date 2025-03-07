# Analyseur de Réponses Ouvertes

Une application minimaliste et efficace pour analyser des réponses ouvertes en utilisant un modèle de langage (LLM).

## Fonctionnalités

- Importation de fichiers CSV, JSON ou TXT contenant des réponses à analyser
- Analyse automatique des réponses en 5 étapes:
  1. Extraction des tags (concepts clés)
  2. Nettoyage et normalisation des tags
  3. Réattribution des tags normalisés à chaque réponse
  4. Regroupement par tag
  5. Synthèse des retours pour chaque tag
- Interface intuitive pour visualiser les résultats
- Exportation des résultats en CSV et JSON

## Prérequis

- Python 3.8 ou version ultérieure
- Pip (gestionnaire de paquets Python)
- Une clé API pour un LLM (OpenAI GPT ou Anthropic Claude)

## Installation

1. Clonez ce dépôt ou téléchargez les fichiers sources
2. Créez un environnement virtuel Python (recommandé):

```bash
python -m venv venv
source venv/bin/activate  # Sur Windows: venv\Scripts\activate
```

3. Installez les dépendances:

```bash
pip install -r requirements.txt
```

## Configuration

Avant d'utiliser l'application, vous devez configurer un modèle de langage (LLM):

1. Lancez l'application
2. Cliquez sur "Configuration" dans la barre de navigation
3. Sélectionnez le fournisseur (OpenAI ou Anthropic)
4. Entrez votre clé API
5. Choisissez le modèle à utiliser (par exemple "gpt-4-turbo" pour OpenAI)
6. Enregistrez la configuration

## Utilisation

1. Lancez l'application:

```bash
python app.py
```

2. Ouvrez un navigateur et accédez à `http://localhost:5000`
3. Importez un fichier contenant des réponses ouvertes (formats acceptés: CSV, JSON, TXT)
4. Si nécessaire, sélectionnez la colonne contenant les réponses à analyser
5. Cliquez sur "Analyser les réponses"
6. Explorez les résultats dans les différents onglets:
   - **Tags**: Visualisation de la distribution des tags et liste des tags normalisés
   - **Synthèses**: Résumés des réponses pour chaque tag
   - **Données**: Tableau des réponses avec les tags associés
7. Exportez les résultats en CSV ou JSON pour une analyse plus approfondie

## Format des fichiers d'entrée

- **CSV**: Le fichier doit contenir une colonne avec les réponses. L'en-tête de colonne est requis.
- **JSON**: Le fichier doit contenir un tableau d'objets, chaque objet ayant un champ avec la réponse.
- **TXT**: Chaque ligne du fichier est considérée comme une réponse distincte.

## Structure du projet

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

## Dépendances

- Flask: Framework web léger pour Python
- Pandas: Manipulation et analyse de données
- Requests: Client HTTP pour les appels API
- Bootstrap: Framework CSS pour l'interface utilisateur
- Chart.js: Bibliothèque de visualisation de données

## Licence

Ce projet est distribué sous licence MIT. Voir le fichier `LICENSE` pour plus d'informations.

## Contribuer

Les contributions sont les bienvenues! N'hésitez pas à ouvrir une issue ou à proposer une pull request.

## Support

Pour toute question ou problème, veuillez ouvrir une issue sur le dépôt GitHub. 