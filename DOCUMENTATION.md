# Documentation Technique - Analyseur de Réponses Ouvertes

Ce document fournit une explication technique détaillée du workflow et du fonctionnement interne de l'application "Analyseur de Réponses Ouvertes".

## Table des matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Architecture technique](#2-architecture-technique)
3. [Workflow détaillé](#3-workflow-détaillé)
   - [Étape 0: Importation des données](#étape-0-importation-des-données)
   - [Étape 1: Extraction des tags](#étape-1-extraction-des-tags)
   - [Étape 2: Normalisation des tags](#étape-2-normalisation-des-tags)
   - [Étape 3: Réattribution des tags normalisés](#étape-3-réattribution-des-tags-normalisés)
   - [Étape 4: Regroupement par tag](#étape-4-regroupement-par-tag)
   - [Étape 5: Génération des synthèses](#étape-5-génération-des-synthèses)
   - [Étape 6: Sauvegarde et affichage des résultats](#étape-6-sauvegarde-et-affichage-des-résultats)
4. [Interaction avec les modèles de langage (LLM)](#4-interaction-avec-les-modèles-de-langage-llm)
5. [Fonctionnalités supplémentaires](#5-fonctionnalités-supplémentaires)
6. [Interface utilisateur](#6-interface-utilisateur)
7. [Flux de données complet](#7-flux-de-données-complet)
8. [Gestion des erreurs et robustesse](#8-gestion-des-erreurs-et-robustesse)

## 1. Vue d'ensemble

L'application "Analyseur de Réponses Ouvertes" est conçue pour analyser des réponses textuelles ouvertes en utilisant un modèle de langage (LLM), principalement Mistral AI. Le workflow complet se déroule en 5 étapes principales, de l'importation des données à la visualisation des résultats.

## 2. Architecture technique

L'application est construite avec:
- **Backend**: Flask (Python)
- **Frontend**: HTML, CSS, JavaScript avec Bootstrap
- **Modèle d'IA**: Principalement Mistral AI (avec support pour OpenAI et Anthropic)

## 3. Workflow détaillé

### Étape 0: Importation des données

**Comment ça fonctionne dans le code:**
- L'utilisateur télécharge un fichier (CSV, JSON ou TXT) via l'interface web
- La route `/api/upload` (lignes 87-131) traite le fichier:
  - Détecte le format du fichier
  - Charge les données dans un DataFrame pandas
  - Sauvegarde temporairement les données dans `static/temp_data.json`
- L'utilisateur peut également utiliser des données d'exemple via le bouton "Tester avec données d'exemple" qui appelle la route `/test_workflow` (lignes 640-741)

### Étape 1: Extraction des tags

**Objectif**: Identifier les concepts clés (tags) présents dans chaque réponse.

**Comment ça fonctionne dans le code:**
- La fonction `process_extract_tags` (lignes 330-379) est appelée
- Les réponses sont traitées par lots de 25 pour éviter les limites de contexte du LLM
- Pour chaque lot:
  - Un prompt est construit demandant au LLM d'extraire 2 à 5 tags par réponse
  - Le LLM est appelé via la fonction `call_llm`
  - Les tags retournés sont extraits du format JSON
- Les tags sont dédupliqués pour obtenir une liste de tags uniques

**Exemple de prompt utilisé:**
```
Analyse les réponses suivantes et extrait les concepts clés (tags) présents dans chacune. 
Pour chaque réponse, identifie 2 à 5 tags qui représentent les idées principales.

Réponses à analyser:
1. [réponse 1]
2. [réponse 2]
...

Retourne uniquement un tableau JSON de tous les tags uniques que tu as identifiés, 
sans autre texte explicatif. Le format doit être ["tag1", "tag2", "tag3", ...].
```

### Étape 2: Normalisation des tags

**Objectif**: Nettoyer et normaliser les tags en regroupant les synonymes et uniformisant les formulations.

**Comment ça fonctionne dans le code:**
- La fonction `process_normalize_tags` (lignes 380-432) est appelée
- Un prompt est construit avec la liste des tags extraits
- Le LLM est appelé pour normaliser les tags
- Le résultat est un dictionnaire où:
  - Les clés sont les tags normalisés
  - Les valeurs sont des listes de tags originaux correspondants

**Exemple de prompt utilisé:**
```
Voici une liste de tags extraits de réponses à une question ouverte. 
Normalise ces tags en regroupant les synonymes, supprimant les doublons et uniformisant les formulations.

Tags à normaliser:
- tag1
- tag2
...

Retourne un objet JSON structuré comme suit, sans autre texte explicatif:
{
    "tag normalisé 1": ["tag original 1", "tag original 2", ...],
    "tag normalisé 2": ["tag original 3", "tag original 4", ...],
    ...
}

Assure-toi que chaque tag original est associé à exactement un tag normalisé.
```

### Étape 3: Réattribution des tags normalisés

**Objectif**: Associer les tags normalisés à chaque réponse.

**Comment ça fonctionne dans le code:**
- La fonction `process_reassign_tags` (lignes 433-510) est appelée
- Un mapping inverse est créé pour faciliter la recherche des tags normalisés
- Les réponses sont traitées par lots de 15
- Pour chaque lot:
  - Un prompt est construit avec la liste des tags normalisés et les réponses
  - Le LLM est appelé pour attribuer les tags normalisés à chaque réponse
  - Le résultat est une liste d'objets contenant l'index de la réponse et les tags associés

**Exemple de prompt utilisé:**
```
Pour chaque réponse ci-dessous, identifie les tags qui s'y appliquent parmi la liste de tags normalisés fournie.

Tags normalisés disponibles:
- tag normalisé 1
- tag normalisé 2
...

Réponses à analyser:
1. [réponse 1]
2. [réponse 2]
...

Retourne un tableau JSON d'objets, où chaque objet contient l'index de la réponse (commençant à 0) et les tags qui s'y appliquent.
Exemple de format attendu:
[
    {"index": 0, "tags": ["tag1", "tag2"]},
    {"index": 1, "tags": ["tag3"]},
    ...
]

Ne retourne que la structure JSON, sans autre texte explicatif.
```

### Étape 4: Regroupement par tag

**Objectif**: Regrouper les réponses par tag pour faciliter l'analyse.

**Comment ça fonctionne dans le code:**
- La fonction `process_group_by_tag` (lignes 511-530) est appelée
- Pour chaque réponse et ses tags associés:
  - Les réponses sont regroupées par tag
  - Un dictionnaire est créé où:
    - Les clés sont les tags normalisés
    - Les valeurs sont des listes de réponses associées à ce tag

### Étape 5: Génération des synthèses

**Objectif**: Générer des synthèses pour chaque groupe de tags.

**Comment ça fonctionne dans le code:**
- La fonction `process_generate_summaries` (lignes 531-564) est appelée
- Pour chaque tag et ses réponses associées:
  - Un échantillon de 50 réponses maximum est utilisé (pour éviter les problèmes de contexte)
  - Un prompt est construit demandant au LLM de synthétiser les réponses
  - Le LLM génère une synthèse structurée qui résume les principales idées, identifie les points communs et divergences, et note les tendances

**Exemple de prompt utilisé:**
```
Tu dois synthétiser un ensemble de réponses associées au tag "[tag]".

Voici les réponses à analyser:
1. [réponse 1]
2. [réponse 2]
...

Génère une synthèse structurée qui:
1. Résume les principales idées exprimées
2. Identifie les points communs et divergences
3. Note toute tendance ou point d'attention particulier

Ta synthèse doit être concise (max 300 mots) et présenter les informations de manière claire.
```

### Étape 6: Sauvegarde et affichage des résultats

**Comment ça fonctionne dans le code:**
- Les résultats sont sauvegardés dans `static/analysis_results.json` (lignes 173-175)
- L'interface utilisateur affiche les résultats dans trois onglets principaux:
  - **Tags**: Visualisation des tags originaux et normalisés avec leur fréquence
  - **Synthèses**: Résumés automatiques pour chaque tag avec verbatims représentatifs
  - **Données**: Tableau détaillé des réponses avec leurs tags associés

## 4. Interaction avec les modèles de langage (LLM)

L'application utilise principalement Mistral AI, mais supporte également OpenAI et Anthropic:

- **Mistral AI**: Fonction `call_llm` (lignes 245-271)
  - Utilise le client officiel MistralAI
  - Modèle par défaut: "mistral-large-latest"
  - Température: 0.3 (pour des réponses cohérentes)

- **OpenAI**: Fonction `call_openai` (lignes 272-300)
  - Utilise l'API OpenAI via requests
  - Modèle par défaut: "gpt-4"

- **Anthropic**: Fonction `call_anthropic` (lignes 301-329)
  - Utilise l'API Anthropic via requests
  - Modèle par défaut: "claude-2"

## 5. Fonctionnalités supplémentaires

### Analyse rapide de réponses individuelles

- Route `/analyze_single` (lignes 618-639)
- Permet d'analyser une seule réponse rapidement
- Utilise la fonction `analyze_with_mistral` (lignes 565-617)

### Exportation des résultats

- Route `/api/export/<format>` (lignes 188-244)
- Formats supportés: CSV et JSON
- Exporte les données brutes, les tags et les synthèses

### Configuration du modèle

- Route `/api/config` (lignes 68-86)
- Permet de configurer le modèle utilisé (Mistral, OpenAI, Anthropic)
- Sauvegarde la configuration dans `config.json`

## 6. Interface utilisateur

L'interface est organisée en plusieurs sections:

- **Barre de navigation**: Titre de l'application et accès à la configuration
- **Panneau latéral gauche**: 
  - Importation de fichiers (glisser-déposer ou sélection)
  - Bouton pour lancer l'analyse
  - Bouton pour tester avec des données d'exemple
  - Exportation des résultats
  - Analyse rapide d'une réponse individuelle
- **Panneau principal**: Affichage des résultats en trois onglets
  - Tags: Visualisation des tags originaux et normalisés
  - Synthèses: Résumés automatiques par tag
  - Données: Tableau détaillé des réponses

## 7. Flux de données complet

1. L'utilisateur télécharge un fichier CSV, JSON ou TXT
2. Le fichier est traité et les données sont extraites
3. Les réponses sont envoyées au LLM pour extraction des tags
4. Les tags sont normalisés par le LLM
5. Les tags normalisés sont réattribués aux réponses
6. Les réponses sont regroupées par tag
7. Des synthèses sont générées pour chaque groupe de tags
8. Les résultats sont affichés dans l'interface et peuvent être exportés

## 8. Gestion des erreurs et robustesse

- Traitement par lots pour éviter les limites de contexte du LLM
- Gestion des erreurs de parsing JSON avec des expressions régulières
- Logging détaillé pour le débogage
- Limitation du nombre de réponses pour les synthèses 