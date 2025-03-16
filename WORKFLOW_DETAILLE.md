# Workflow Détaillé de l'Analyseur de Réponses Ouvertes

Ce document explique en détail chaque étape du workflow d'analyse, les prompts envoyés à l'API Mistral et les résultats attendus.

## Vue d'ensemble du workflow

L'application suit un workflow en 5 étapes pour analyser les réponses ouvertes:

1. **Chargement des données**: Lecture et préparation des réponses à analyser
2. **Extraction des tags**: Identification des concepts clés dans chaque réponse
3. **Normalisation des tags**: Regroupement des tags similaires en catégories cohérentes
4. **Génération des synthèses**: Création de résumés pour chaque groupe de réponses
5. **Préparation des résultats**: Organisation et structuration des données pour l'affichage

## Étape 1: Chargement des données

### Description
Cette étape consiste à charger les données depuis un fichier CSV ou à utiliser des données de test prédéfinies.

### Processus technique
1. L'utilisateur choisit entre utiliser des données de test ou importer un fichier CSV
2. Le système vérifie que le fichier contient une colonne "response" ou "réponse"
3. Les données sont chargées dans un DataFrame pandas puis converties en liste de réponses
4. Aucune limitation n'est appliquée sur le nombre de réponses traitées

### Logs affichés à l'utilisateur
```
ÉTAPE 1/5 : Chargement des données en cours...
Utilisation des données de test
Vérification de l'existence du fichier example_data.csv
Lecture du fichier CSV de test
Fichier CSV lu avec succès, X réponses trouvées
ÉTAPE 1/5 : Chargement des données terminé avec succès
```

### Résultat
Une liste de réponses textuelles prêtes à être analysées.

## Étape 2: Extraction des tags

### Description
Cette étape utilise l'API Mistral pour identifier les concepts clés (tags) présents dans chaque réponse.

### Prompt envoyé à Mistral
```
Tu es un expert en analyse de données textuelles. Ta tâche est d'extraire des tags pertinents à partir de réponses ouvertes.

Pour chaque réponse, les tags qui capturent les thèmes, sentiments ou concepts clés.
Les tags doivent être des mots ou expressions courtes (1-3 mots).

Voici les réponses à analyser:
Réponse 1: [texte de la réponse 1]
Réponse 2: [texte de la réponse 2]
...

Réponds UNIQUEMENT au format JSON suivant, sans aucun texte supplémentaire:
[
  {
    "response_id": 1,
    "tags": ["tag1", "tag2", "tag3"]
  },
  ...
]
```

### Logs affichés à l'utilisateur
```
ÉTAPE 2/5 : Extraction des tags à partir des réponses
Préparation de la requête d'extraction de tags
Envoi de la requête d'extraction de tags à Mistral
Réponse reçue de Mistral, traitement des tags extraits
Tags uniques collectés: X tags identifiés
ÉTAPE 2/5 : Extraction des tags terminée avec succès
```

### Résultat attendu de Mistral
```json
[
  {
    "response_id": 1,
    "tags": ["interface intuitive", "facilité d'utilisation", "design moderne"]
  },
  {
    "response_id": 2,
    "tags": ["bugs fréquents", "lenteur", "interface confuse"]
  },
  ...
]
```

### Traitement des résultats
- Parsing du JSON retourné par Mistral
- Extraction de tous les tags uniques pour l'étape de normalisation
- Création d'une liste de tous les tags uniques identifiés

## Étape 3: Normalisation des tags

### Description
Cette étape utilise l'API Mistral pour regrouper les tags similaires en catégories cohérentes.

### Prompt envoyé à Mistral
```
Tu es un expert en analyse de données textuelles. Ta tâche est de normaliser et regrouper des tags similaires.

Voici une liste de tags extraits de réponses ouvertes:
tag1, tag2, tag3, tag4, tag5, ...

Regroupe ces tags en catégories cohérentes. Crée un dictionnaire où:
- Les clés sont les tags normalisés (catégories)
- Les valeurs sont des listes de tags originaux qui appartiennent à cette catégorie

Réponds UNIQUEMENT au format JSON suivant, sans aucun texte supplémentaire:
{
  "Tag normalisé 1": ["tag original 1", "tag original 2"],
  "Tag normalisé 2": ["tag original 3", "tag original 4"],
  ...
}
```

### Logs affichés à l'utilisateur
```
ÉTAPE 3/5 : Normalisation des tags extraits
Préparation de la requête de normalisation des tags
Envoi de la requête de normalisation des tags à Mistral
Réponse reçue de Mistral, traitement des tags normalisés
Tags normalisés: X catégories créées
Tags normalisés réattribués aux réponses
ÉTAPE 3/5 : Normalisation des tags terminée avec succès
```

### Résultat attendu de Mistral
```json
{
  "Interface utilisateur": ["interface intuitive", "design moderne", "interface confuse", "design épuré"],
  "Performance": ["bugs fréquents", "lenteur", "rapidité", "fluidité"],
  "Fonctionnalités": ["fonctionnalités manquantes", "options limitées", "fonctionnalités complètes"],
  ...
}
```

### Traitement des résultats
- Création d'un dictionnaire de mapping entre tags originaux et normalisés
- Réattribution des tags normalisés à chaque réponse
- Conservation des tags originaux pour référence

## Étape 4: Génération des synthèses

### Description
Cette étape utilise l'API Mistral pour générer des synthèses pour chaque groupe de réponses partageant un même tag normalisé.

### Prompt envoyé à Mistral
```
Tu es un expert en analyse de données textuelles. Ta tâche est de générer une synthèse pour un groupe de réponses partageant un même tag.

Tag: [tag normalisé]

Voici les réponses associées à ce tag:
- [réponse 1]
- [réponse 2]
- ...

Génère une synthèse qui:
1. Résume les points communs et les tendances principales
2. Identifie le nombre d'utilisateurs concernés
3. Extrait 2-3 verbatims représentatifs (citations exactes des réponses)

Réponds UNIQUEMENT au format JSON suivant, sans aucun texte supplémentaire:
{
  "synthèse": "Texte de la synthèse...",
  "nombre_utilisateurs": X,
  "verbatims": ["verbatim 1", "verbatim 2", "verbatim 3"]
}
```

### Logs affichés à l'utilisateur
```
ÉTAPE 4/5 : Génération des synthèses par tag normalisé
Préparation de la génération des synthèses par tag
Génération de la synthèse pour le tag '[tag normalisé]'
Synthèses générées pour X tags
ÉTAPE 4/5 : Génération des synthèses terminée avec succès
```

### Résultat attendu de Mistral
```json
{
  "synthèse": "Les utilisateurs apprécient généralement l'interface utilisateur pour sa clarté et son design moderne. Cependant, certains utilisateurs trouvent l'interface confuse, notamment en ce qui concerne la navigation entre les différentes sections.",
  "nombre_utilisateurs": 12,
  "verbatims": [
    "L'interface est très intuitive et agréable à utiliser au quotidien.",
    "Le design est moderne mais certains éléments sont difficiles à trouver.",
    "J'apprécie l'esthétique épurée qui facilite la concentration."
  ]
}
```

### Traitement des résultats
- Parsing du JSON retourné par Mistral
- Organisation des synthèses par tag normalisé
- Préparation des données pour l'affichage dans l'interface

## Étape 5: Préparation des résultats

### Description
Cette étape organise et structure les résultats des étapes précédentes pour l'affichage dans l'interface utilisateur.

### Processus technique
1. Consolidation des données des étapes précédentes dans une structure cohérente
2. Association de chaque réponse à ses tags originaux et normalisés
3. Organisation des synthèses par tag normalisé
4. Préservation du mapping entre tags originaux et normalisés pour référence

### Logs affichés à l'utilisateur
```
ÉTAPE 5/5 : Préparation des résultats pour l'affichage
Préparation terminée pour X réponses
ÉTAPE 5/5 : Préparation des résultats terminée avec succès
Analyse terminée avec succès
```

### Structure finale des résultats
```json
{
  "results": [
    {
      "response_id": 1,
      "response": "Texte de la réponse...",
      "tags": ["tag1", "tag2"],
      "normalized_tags": ["Tag normalisé 1", "Tag normalisé 2"]
    },
    ...
  ],
  "tag_mapping": {
    "Tag normalisé 1": ["tag1", "tag3", "tag5"],
    "Tag normalisé 2": ["tag2", "tag4", "tag6"]
  },
  "tag_summaries": {
    "Tag normalisé 1": {
      "synthèse": "Texte de la synthèse...",
      "nombre_utilisateurs": 10,
      "verbatims": ["verbatim 1", "verbatim 2", "verbatim 3"]
    },
    ...
  }
}
```

## Affichage des résultats dans l'interface

Les résultats sont présentés à l'utilisateur dans trois sections principales:

1. **Synthèses**: Affiche les résumés générés pour chaque tag normalisé, avec le nombre d'utilisateurs concernés et des verbatims représentatifs.

2. **Tags**: Présente le mapping entre les tags originaux et les tags normalisés, permettant de comprendre comment les tags ont été regroupés.

3. **Données**: Affiche un tableau détaillé de toutes les réponses avec leurs tags associés, permettant une exploration approfondie des données.

Cette structure permet à l'utilisateur de comprendre rapidement les tendances principales tout en ayant accès aux détails si nécessaire. 