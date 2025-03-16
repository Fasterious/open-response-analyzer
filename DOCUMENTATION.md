# Documentation Technique - Analyseur de Réponses Ouvertes

Ce document fournit une explication technique détaillée du workflow et du fonctionnement interne de l'application "Analyseur de Réponses Ouvertes".

## Table des matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Architecture technique](#2-architecture-technique)
3. [Workflow détaillé](#3-workflow-détaillé)
   - [Étape 1: Chargement des données](#étape-1-chargement-des-données)
   - [Étape 2: Extraction des tags](#étape-2-extraction-des-tags)
   - [Étape 3: Normalisation des tags](#étape-3-normalisation-des-tags)
   - [Étape 4: Génération des synthèses](#étape-4-génération-des-synthèses)
   - [Étape 5: Présentation des résultats](#étape-5-présentation-des-résultats)
4. [Communication avec Mistral AI](#4-communication-avec-mistral-ai)
5. [Gestion des sessions](#5-gestion-des-sessions)
6. [Interface utilisateur](#6-interface-utilisateur)
7. [Flux de données complet](#7-flux-de-données-complet)
8. [Gestion des erreurs](#8-gestion-des-erreurs)

## 1. Vue d'ensemble

L'application "Analyseur de Réponses Ouvertes" est conçue pour analyser des réponses textuelles ouvertes en utilisant l'API Mistral AI. Le workflow complet se déroule en 5 étapes principales, du chargement des données à la présentation des résultats, sans aucune limitation sur le volume de données traitées.

## 2. Architecture technique

L'application est construite avec:
- **Backend**: Flask (Python)
- **Frontend**: HTML, CSS, JavaScript avec Tailwind CSS
- **API d'IA**: Mistral AI (modèle mistral-small-latest par défaut)
- **Gestion des sessions**: Traitement asynchrone avec threading et file d'attente

## 3. Workflow détaillé

### Étape 1: Chargement des données

**Objectif**: Charger et préparer les données pour l'analyse.

**Implémentation technique**:
- La classe `AnalysisSession` gère une session d'analyse unique avec un identifiant UUID
- L'utilisateur peut choisir entre utiliser des données de test ou importer un fichier CSV
- Le fichier CSV est validé pour s'assurer qu'il contient une colonne "response" ou "réponse"
- Les données sont chargées dans un DataFrame pandas puis converties en liste de réponses
- Aucune limitation n'est appliquée sur le nombre de réponses traitées

**Points clés du code**:
- Fonction `run_analysis` (lignes ~700-850): Gère le workflow complet d'analyse
- Validation du format CSV et extraction des réponses
- Logging détaillé de chaque étape pour le suivi en temps réel

### Étape 2: Extraction des tags

**Objectif**: Identifier les concepts clés (tags) présents dans chaque réponse.

**Implémentation technique**:
- Fonction `extract_tags_with_mistral`: Communique avec l'API Mistral pour extraire les tags
- Les réponses sont formatées et envoyées à Mistral avec un prompt spécifique
- Mistral identifie les tags pertinents pour chaque réponse sans limitation de nombre
- Les tags sont retournés au format JSON structuré

**Prompt utilisé**:
```
Tu es un expert en analyse de données textuelles. Ta tâche est d'extraire des tags pertinents à partir de réponses ouvertes.

Pour chaque réponse, les tags qui capturent les thèmes, sentiments ou concepts clés.
Les tags doivent être des mots ou expressions courtes (1-3 mots).

Voici les réponses à analyser:
[réponses formatées]

Réponds UNIQUEMENT au format JSON suivant, sans aucun texte supplémentaire:
[
  {
    "response_id": 1,
    "tags": ["tag1", "tag2", "tag3"]
  },
  ...
]
```

**Traitement des résultats**:
- Parsing du JSON retourné par Mistral
- Extraction de tous les tags uniques pour l'étape de normalisation
- Logging des tags extraits pour le suivi

### Étape 3: Normalisation des tags

**Objectif**: Regrouper les tags similaires en catégories cohérentes.

**Implémentation technique**:
- Fonction `normalize_tags_with_mistral`: Communique avec l'API Mistral pour normaliser les tags
- Tous les tags uniques sont envoyés à Mistral avec un prompt de normalisation
- Mistral regroupe les tags similaires en catégories cohérentes
- Fonction `reassign_normalized_tags`: Réattribue les tags normalisés aux réponses originales

**Prompt utilisé**:
```
Tu es un expert en analyse de données textuelles. Ta tâche est de normaliser et regrouper des tags similaires.

Voici une liste de tags extraits de réponses ouvertes:
[liste de tags]

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

**Traitement des résultats**:
- Création d'un dictionnaire de mapping entre tags originaux et normalisés
- Réattribution des tags normalisés à chaque réponse
- Conservation des tags originaux pour référence

### Étape 4: Génération des synthèses

**Objectif**: Générer des synthèses pour chaque groupe de réponses partageant un même tag.

**Implémentation technique**:
- Fonction `generate_tag_summaries_with_mistral`: Communique avec l'API Mistral pour générer des synthèses
- Pour chaque tag normalisé, toutes les réponses associées sont regroupées
- Aucune limitation n'est appliquée sur le nombre de réponses par tag
- Mistral génère une synthèse structurée pour chaque groupe de réponses

**Prompt utilisé**:
```
Tu es un expert en analyse de données textuelles. Ta tâche est de générer une synthèse pour un groupe de réponses partageant un même tag.

Tag: [tag]

Voici les réponses associées à ce tag:
[réponses formatées]

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

**Traitement des résultats**:
- Parsing du JSON retourné par Mistral
- Organisation des synthèses par tag normalisé
- Préparation des données pour l'affichage dans l'interface

### Étape 5: Présentation des résultats

**Objectif**: Organiser et présenter les résultats de l'analyse de manière claire et exploitable.

**Implémentation technique**:
- Les résultats sont structurés en trois sections principales:
  1. **Synthèses**: Résumés par tag avec verbatims représentatifs
  2. **Tags**: Mapping entre tags originaux et normalisés
  3. **Données**: Tableau détaillé des réponses avec leurs tags
- L'interface utilisateur affiche les résultats de manière interactive
- Les données sont organisées pour faciliter l'exploration et l'analyse

## 4. Communication avec Mistral AI

L'application utilise l'API Mistral AI pour toutes les tâches d'analyse:

**Configuration**:
- Modèle utilisé: `mistral-small-latest` (configurable via le fichier .env)
- Client officiel MistralAI pour Python
- Clé API stockée dans le fichier .env

**Appels API**:
- Trois appels principaux à l'API Mistral:
  1. Extraction des tags (`extract_tags_with_mistral`)
  2. Normalisation des tags (`normalize_tags_with_mistral`)
  3. Génération des synthèses (`generate_tag_summaries_with_mistral`)
- Format de réponse attendu: JSON structuré
- Gestion des erreurs et parsing robuste des réponses

## 5. Gestion des sessions

L'application utilise un système de sessions pour gérer les analyses:

**Classe `AnalysisSession`**:
- Chaque analyse crée une session unique avec un identifiant UUID
- La session stocke:
  - L'état actuel de l'analyse (initializing, running, completed, error)
  - L'étape courante (data-loading, tag-extraction, tag-normalization, synthesis-generation)
  - Les logs d'activité (100 derniers logs)
  - Les résultats de l'analyse
- Système de file d'attente pour les logs permettant un suivi en temps réel

**Traitement asynchrone**:
- L'analyse est exécutée dans un thread séparé pour ne pas bloquer l'interface
- L'utilisateur peut suivre la progression en temps réel via des requêtes AJAX
- Les résultats sont disponibles dès que l'analyse est terminée

## 6. Interface utilisateur

L'interface utilisateur est organisée en plusieurs sections:

**Navigation principale**:
- Onglets pour naviguer entre les différentes étapes du processus

**Section Démarrer**:
- Configuration de l'API Mistral
- Choix entre données de test et importation de fichier
- Bouton pour lancer l'analyse

**Section Traitement**:
- Affichage en temps réel de la progression de l'analyse
- Logs détaillés pour chaque étape
- Indicateurs visuels de l'état d'avancement

**Sections de résultats**:
- Synthèses: Résumés par tag avec verbatims
- Tags: Visualisation du mapping des tags
- Données: Tableau détaillé des réponses avec pagination et recherche

## 7. Flux de données complet

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Chargement des │     │  Extraction des │     │ Normalisation   │     │  Génération des │
│     données     │────▶│      tags       │────▶│    des tags     │────▶│    synthèses    │
└─────────────────┘     └─────────────────┘     └─────────────────┘     └─────────────────┘
                              │                        │                        │
                              ▼                        ▼                        ▼
                        ┌─────────────────────────────────────────────────────────┐
                        │                  Présentation des résultats             │
                        └─────────────────────────────────────────────────────────┘
```

1. **Chargement des données**:
   - Entrée: Fichier CSV ou données de test
   - Sortie: Liste de réponses textuelles

2. **Extraction des tags**:
   - Entrée: Liste de réponses
   - Traitement: Appel à Mistral AI
   - Sortie: Liste de réponses avec tags associés

3. **Normalisation des tags**:
   - Entrée: Liste de tous les tags uniques
   - Traitement: Appel à Mistral AI
   - Sortie: Mapping entre tags originaux et normalisés

4. **Génération des synthèses**:
   - Entrée: Réponses regroupées par tag normalisé
   - Traitement: Appel à Mistral AI
   - Sortie: Synthèses par tag avec verbatims

5. **Présentation des résultats**:
   - Entrée: Données structurées des étapes précédentes
   - Sortie: Interface utilisateur interactive

## 8. Gestion des erreurs

L'application intègre une gestion robuste des erreurs à plusieurs niveaux:

**Validation des entrées**:
- Vérification du format des fichiers importés
- Validation de la présence des colonnes requises
- Contrôle de la clé API Mistral

**Gestion des erreurs API**:
- Détection des erreurs de communication avec Mistral
- Parsing robuste des réponses JSON
- Extraction des messages d'erreur pour le diagnostic

**Logging et suivi**:
- Logs détaillés à chaque étape du processus
- Capture et affichage des exceptions
- Mise à jour du statut de la session en cas d'erreur

**Interface utilisateur**:
- Affichage des erreurs de manière claire et compréhensible
- Possibilité de reprendre l'analyse après correction
- Indicateurs visuels de l'état de l'analyse 