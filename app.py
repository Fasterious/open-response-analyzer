import os
import json
import pandas as pd
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import logging
from dotenv import load_dotenv
from mistralai.client import MistralClient
from mistralai.models.chat_completion import ChatMessage
import io
from version import VERSION_STRING

# Chargement des variables d'environnement depuis .env
load_dotenv()

# Configuration du logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Configuration Mistral
MISTRAL_API_KEY = os.environ.get("MISTRAL_API_KEY", "")
mistral_client = MistralClient(api_key=MISTRAL_API_KEY)
MISTRAL_MODEL = "mistral-large-latest"  # Options: mistral-small-latest, mistral-medium-latest, mistral-large-latest

# Routes principales
@app.route('/')
def index():
    return render_template('index.html', version=VERSION_STRING)

@app.route('/test_workflow', methods=['POST'])
def test_workflow():
    logger.info("Route /test_workflow appelée")
    try:
        # Charger le fichier example_data.csv
        example_file = 'example_data.csv'
        logger.info(f"Vérification de l'existence du fichier {example_file}")
        if not os.path.exists(example_file):
            logger.error("Fichier example_data.csv non trouvé")
            return jsonify({'error': 'Fichier de test non trouvé'}), 404

        # Lire le fichier CSV
        logger.info("Lecture du fichier CSV")
        df = pd.read_csv(example_file)
        logger.info(f"Fichier CSV lu avec succès, {len(df)} lignes trouvées")
        
        # Limiter à 3 lignes pour les tests
        df = df.head(3)
        # logger.info(f"Limitation à 3 lignes pour le test")
        
        # Extraire les réponses pour l'extraction des tags
        responses = df['response'].tolist()
        
        # Étape 1: Extraction des tags
        logger.info("Extraction des tags à partir des réponses")
        response_tags = extract_tags_with_mistral(responses)
        logger.info(f"Tags extraits: {response_tags}")
        
        # Étape 2: Collecter tous les tags uniques de toutes les réponses
        all_unique_tags = set()
        for item in response_tags:
            all_unique_tags.update(item.get('tags', []))
        all_unique_tags = list(all_unique_tags)
        logger.info(f"Tags uniques collectés: {all_unique_tags}")
        
        # Étape 3: Normalisation des tags avec Mistral
        logger.info("Normalisation des tags extraits")
        normalized_tags = normalize_tags_with_mistral(all_unique_tags)
        logger.info(f"Tags normalisés: {normalized_tags}")
        
        # Étape 4: Réattribution des tags normalisés aux réponses
        logger.info("Réattribution des tags normalisés aux réponses")
        normalized_response_tags = reassign_normalized_tags(response_tags, normalized_tags)
        logger.info(f"Tags normalisés réattribués: {normalized_response_tags}")
        
        # Étape 5: Génération des synthèses par tag normalisé
        logger.info("Génération des synthèses par tag normalisé")
        tag_summaries = generate_tag_summaries_with_mistral(normalized_response_tags, responses)
        logger.info(f"Synthèses générées: {tag_summaries}")
        
        # Préparer les résultats
        results = []
        for index, row in df.iterrows():
            logger.info(f"Préparation de la réponse {index+1}/{len(df)}: {row['response'][:50]}...")
            
            # Trouver les tags originaux correspondant à cette réponse
            original_tags = []
            for tag_item in response_tags:
                if tag_item.get('response_id') == index + 1:
                    original_tags = tag_item.get('tags', [])
                    break
            
            # Trouver les tags normalisés correspondant à cette réponse
            normalized_tags_for_response = []
            for tag_item in normalized_response_tags:
                if tag_item.get('response_id') == index + 1:
                    normalized_tags_for_response = tag_item.get('normalized_tags', [])
                    break
            
            # Récupérer les synthèses pour les tags normalisés de cette réponse
            response_summaries = {}
            for tag in normalized_tags_for_response:
                if tag in tag_summaries:
                    response_summaries[tag] = tag_summaries[tag]
            
            # Ajouter la réponse aux résultats
            results.append({
                'id': int(row['id']),
                'response': row['response'],
                'original_tags': original_tags,
                'normalized_tags': normalized_tags_for_response,
                'tag_summaries': response_summaries
            })
        
        logger.info(f"Préparation terminée pour {len(results)} réponses")

        return jsonify({
            'success': True,
            'results': results,
            'tag_mapping': normalized_tags,
            'tag_summaries': tag_summaries
        })

    except Exception as e:
        logger.error(f"Erreur lors du test: {str(e)}")
        logger.exception("Détail de l'erreur:")
        return jsonify({'error': str(e)}), 500

@app.route('/import_and_test', methods=['POST'])
def import_and_test():
    logger.info("Route /import_and_test appelée")
    try:
        # Vérifier si un fichier a été envoyé
        if 'file' not in request.files:
            logger.error("Aucun fichier n'a été envoyé")
            return jsonify({'error': 'Aucun fichier n\'a été envoyé'}), 400
        
        file = request.files['file']
        
        # Vérifier si le fichier a un nom
        if file.filename == '':
            logger.error("Aucun fichier sélectionné")
            return jsonify({'error': 'Aucun fichier sélectionné'}), 400
        
        # Vérifier si le fichier est un CSV
        if not file.filename.endswith('.csv'):
            logger.error("Le fichier doit être au format CSV")
            return jsonify({'error': 'Le fichier doit être au format CSV'}), 400
        
        # Lire le fichier CSV
        logger.info("Lecture du fichier CSV importé")
        try:
            # Lire le contenu du fichier en mémoire
            file_content = file.read().decode('utf-8')
            df = pd.read_csv(io.StringIO(file_content))
            logger.info(f"Fichier CSV lu avec succès, {len(df)} lignes trouvées")
            
            # Vérifier si la colonne 'response' existe
            if 'response' not in df.columns:
                logger.error("Le fichier CSV doit contenir une colonne 'response'")
                return jsonify({'error': 'Le fichier CSV doit contenir une colonne \'response\''}), 400
            
            # Limiter à 3 lignes pour les tests
            # df = df.head(3)
            # logger.info(f"Limitation à 3 lignes pour le test")
            
            # Extraire les réponses pour l'extraction des tags
            responses = df['response'].tolist()
            
            # Étape 1: Extraction des tags
            logger.info("Extraction des tags à partir des réponses")
            response_tags = extract_tags_with_mistral(responses)
            logger.info(f"Tags extraits: {response_tags}")
            
            # Étape 2: Collecter tous les tags uniques de toutes les réponses
            all_unique_tags = set()
            for item in response_tags:
                all_unique_tags.update(item.get('tags', []))
            all_unique_tags = list(all_unique_tags)
            logger.info(f"Tags uniques collectés: {all_unique_tags}")
            
            # Étape 3: Normalisation des tags avec Mistral
            logger.info("Normalisation des tags extraits")
            normalized_tags = normalize_tags_with_mistral(all_unique_tags)
            logger.info(f"Tags normalisés: {normalized_tags}")
            
            # Étape 4: Réattribution des tags normalisés aux réponses
            logger.info("Réattribution des tags normalisés aux réponses")
            normalized_response_tags = reassign_normalized_tags(response_tags, normalized_tags)
            logger.info(f"Tags normalisés réattribués: {normalized_response_tags}")
            
            # Étape 5: Génération des synthèses par tag normalisé
            logger.info("Génération des synthèses par tag normalisé")
            tag_summaries = generate_tag_summaries_with_mistral(normalized_response_tags, responses)
            logger.info(f"Synthèses générées: {tag_summaries}")
            
            # Préparer les résultats
            results = []
            for index, row in df.iterrows():
                logger.info(f"Préparation de la réponse {index+1}/{len(df)}: {row['response'][:50]}...")
                
                # Trouver les tags originaux correspondant à cette réponse
                original_tags = []
                for tag_item in response_tags:
                    if tag_item.get('response_id') == index + 1:
                        original_tags = tag_item.get('tags', [])
                        break
                
                # Trouver les tags normalisés correspondant à cette réponse
                normalized_tags_for_response = []
                for tag_item in normalized_response_tags:
                    if tag_item.get('response_id') == index + 1:
                        normalized_tags_for_response = tag_item.get('normalized_tags', [])
                        break
                
                # Récupérer les synthèses pour les tags normalisés de cette réponse
                response_summaries = {}
                for tag in normalized_tags_for_response:
                    if tag in tag_summaries:
                        response_summaries[tag] = tag_summaries[tag]
                
                # Ajouter la réponse aux résultats
                results.append({
                    'id': int(row.get('id', index + 1)),
                    'response': row['response'],
                    'original_tags': original_tags,
                    'normalized_tags': normalized_tags_for_response,
                    'tag_summaries': response_summaries
                })
            
            logger.info(f"Préparation terminée pour {len(results)} réponses")

            return jsonify({
                'success': True,
                'results': results,
                'tag_mapping': normalized_tags,
                'tag_summaries': tag_summaries
            })
            
        except Exception as e:
            logger.error(f"Erreur lors de la lecture du fichier CSV: {str(e)}")
            return jsonify({'error': f'Erreur lors de la lecture du fichier CSV: {str(e)}'}), 500

    except Exception as e:
        logger.error(f"Erreur lors de l'importation et du test: {str(e)}")
        logger.exception("Détail de l'erreur:")
        return jsonify({'error': str(e)}), 500

def extract_tags_with_mistral(responses):
    """
    Extrait les tags des réponses en utilisant Mistral AI.
    
    Args:
        responses (list): Liste des réponses à analyser
    
    Returns:
        list: Liste des tags extraits pour chaque réponse
    """
    # Construire le prompt
    prompt = """
    Analyse les réponses suivantes et extrait les concepts clés (tags) présents dans chacune. 
    
    Réponses à analyser:
    """
    
    for i, response in enumerate(responses):
        prompt += f"\n{i+1}. {response}"
    
    prompt += """
    
    Pour chaque réponse, retourne les tags identifiés dans un format JSON structuré comme ceci:
    [
        {
            "response_id": 1,
            "tags": ["tag1", "tag2", "tag3"]
        },
        {
            "response_id": 2,
            "tags": ["tag4", "tag5"]
        }
    ]
    
    Retourne uniquement le tableau JSON, sans autre texte explicatif.
    """
    
    # Structure pour l'API Mistral
    messages = [
        ChatMessage(role="system", content="Vous êtes un analyste expert qui extrait des tags pertinents à partir de réponses utilisateur."),
        ChatMessage(role="user", content=prompt)
    ]
    
    try:
        chat_response = mistral_client.chat(
            model=MISTRAL_MODEL,
            messages=messages,
            temperature=0.3,
            max_tokens=1024
        )
        
        content = chat_response.choices[0].message.content
        
        # Essayer de parser le contenu comme JSON
        try:
            result = json.loads(content)
            return result
        except json.JSONDecodeError:
            # Si ce n'est pas un JSON valide, essayer d'extraire avec regex
            import re
            match = re.search(r'\[(.*)\]', content, re.DOTALL)
            if match:
                try:
                    result = json.loads(f"[{match.group(1)}]")
                    return result
                except:
                    logger.warning(f"Impossible d'extraire les tags: {content}")
                    return []
            else:
                logger.warning(f"Format de réponse incorrect pour les tags: {content}")
                return []
    except Exception as e:
        logger.error(f"Erreur lors de l'extraction des tags: {str(e)}")
        return []

def normalize_tags_with_mistral(tags):
    """
    Nettoie et normalise les tags en utilisant Mistral AI.
    
    Args:
        tags (list): Liste des tags à normaliser
    
    Returns:
        dict: Dictionnaire des tags normalisés avec leurs tags originaux associés
    """
    # Construire le prompt
    prompt = """
    Voici une liste de tags extraits de réponses à une question ouverte concernant l'expérience utilisateur d'une application. 
    Ta mission est de normaliser ces tags en:
    1. Regroupant les synonymes et concepts similaires sous un même tag normalisé
    2. Supprimant les doublons et variations mineures
    3. Uniformisant les formulations pour plus de cohérence
    4. Créant des catégories claires et distinctes

    Règles importantes:
    - Utilise des termes simples et clairs pour les tags normalisés
    - Assure-toi que chaque tag original est associé à exactement un tag normalisé
    - Préfère des noms plutôt que des adjectifs pour les tags normalisés
    - Ne regroupe pas des concepts différents juste pour réduire le nombre de catégories
    
    Tags à normaliser:
    """
    
    for tag in tags:
        prompt += f"\n- {tag}"
    
    prompt += """
    
    Retourne un objet JSON structuré comme suit, sans autre texte explicatif:
    {
        "tag normalisé 1": ["tag original 1", "tag original 2", ...],
        "tag normalisé 2": ["tag original 3", "tag original 4", ...],
        ...
    }
    
    Assure-toi que chaque tag original est associé à exactement un tag normalisé.
    """
    
    # Structure pour l'API Mistral
    messages = [
        ChatMessage(role="system", content="Vous êtes un expert en analyse de données qui normalise et regroupe des tags similaires en catégories cohérentes."),
        ChatMessage(role="user", content=prompt)
    ]
    
    try:
        chat_response = mistral_client.chat(
            model=MISTRAL_MODEL,
            messages=messages,
            temperature=0.2,
            max_tokens=1024
        )
        
        content = chat_response.choices[0].message.content
        
        # Essayer de parser le contenu comme JSON
        try:
            result = json.loads(content)
            return result
        except json.JSONDecodeError:
            # Si ce n'est pas un JSON valide, essayer d'extraire avec regex
            import re
            match = re.search(r'\{(.*)\}', content, re.DOTALL)
            if match:
                try:
                    result = json.loads(f"{{{match.group(1)}}}")
                    return result
                except:
                    logger.warning(f"Impossible d'extraire les tags normalisés: {content}")
                    return {}
            else:
                logger.warning(f"Format de réponse incorrect pour les tags normalisés: {content}")
                return {}
    except Exception as e:
        logger.error(f"Erreur lors de la normalisation des tags: {str(e)}")
        return {}

def reassign_normalized_tags(response_tags, normalized_tags):
    """
    Réattribue les tags normalisés à chaque réponse.
    
    Args:
        response_tags (list): Liste des tags par réponse
        normalized_tags (dict): Dictionnaire de mapping des tags originaux vers les tags normalisés
    
    Returns:
        list: Liste des tags normalisés par réponse
    """
    # Créer un mapping inverse pour faciliter la recherche
    tag_mapping = {}
    for normalized, originals in normalized_tags.items():
        for original in originals:
            tag_mapping[original.lower()] = normalized
    
    # Réattribuer les tags normalisés à chaque réponse
    normalized_response_tags = []
    
    for response_item in response_tags:
        response_id = response_item.get('response_id')
        original_tags = response_item.get('tags', [])
        
        # Convertir les tags originaux en tags normalisés
        normalized_tags_for_response = []
        for tag in original_tags:
            normalized_tag = tag_mapping.get(tag.lower())
            if normalized_tag and normalized_tag not in normalized_tags_for_response:
                normalized_tags_for_response.append(normalized_tag)
            elif not normalized_tag:
                # Si aucune correspondance exacte n'est trouvée, chercher une correspondance partielle
                for original, normalized in tag_mapping.items():
                    if tag.lower() in original or original in tag.lower():
                        if normalized not in normalized_tags_for_response:
                            normalized_tags_for_response.append(normalized)
                            break
        
        normalized_response_tags.append({
            'response_id': response_id,
            'original_tags': original_tags,
            'normalized_tags': normalized_tags_for_response
        })
    
    return normalized_response_tags

def generate_tag_summaries_with_mistral(response_tags, responses):
    """
    Génère une synthèse pour chaque tag normalisé en utilisant Mistral AI.
    
    Args:
        response_tags (list): Liste des tags normalisés par réponse
        responses (list): Liste des réponses originales
    
    Returns:
        dict: Dictionnaire des synthèses par tag normalisé
    """
    # Créer un dictionnaire pour regrouper les réponses par tag normalisé
    tag_responses = {}
    
    # Pour chaque réponse, ajouter à tous les tags normalisés associés
    for item in response_tags:
        response_id = item.get('response_id')
        if response_id <= len(responses):  # Vérifier que l'ID est valide
            response_index = response_id - 1  # Convertir en index 0-based
            response_text = responses[response_index]
            
            for tag in item.get('normalized_tags', []):
                if tag not in tag_responses:
                    tag_responses[tag] = []
                tag_responses[tag].append(response_text)
    
    # Générer une synthèse pour chaque tag normalisé
    summaries = {}
    
    for tag, tag_responses_list in tag_responses.items():
        # Construire le prompt
        prompt = f"""
        Analyse les {len(tag_responses_list)} réponses suivantes qui ont été associées au tag "{tag}".
        
        Réponses:
        """
        
        for i, response in enumerate(tag_responses_list):
            prompt += f"\n{i+1}. {response}"
        
        prompt += f"""
        
        Génère une synthèse concise qui:
        1. Résume les idées principales exprimées dans ces réponses
        2. Mentionne que {len(tag_responses_list)} utilisateurs ont exprimé des idées liées à ce tag
        3. Inclut tous les verbatims représentatifs en extrayant UNIQUEMENT les parties des réponses qui concernent spécifiquement le tag "{tag}" (ne pas inclure les parties de réponses non pertinentes pour ce tag)
        
        
        Format de la réponse:
        {{
            "synthèse": "Résumé des idées principales en 2-3 phrases",
            "nombre_utilisateurs": {len(tag_responses_list)},
            "verbatims": ["Extrait pertinent 1", "Extrait pertinent 2", "..."]
        }}
        
        Retourne uniquement l'objet JSON, sans autre texte explicatif.
        """
        
        # Structure pour l'API Mistral
        messages = [
            ChatMessage(role="system", content="Vous êtes un analyste expert qui synthétise des retours utilisateurs de manière concise et pertinente."),
            ChatMessage(role="user", content=prompt)
        ]
        
        try:
            logger.info(f"Génération de la synthèse pour le tag '{tag}'")
            chat_response = mistral_client.chat(
                model=MISTRAL_MODEL,
                messages=messages,
                temperature=0.3,
                max_tokens=1024
            )
            
            content = chat_response.choices[0].message.content
            
            # Essayer de parser le contenu comme JSON
            try:
                result = json.loads(content)
                summaries[tag] = result
            except json.JSONDecodeError:
                # Si ce n'est pas un JSON valide, essayer d'extraire avec regex
                import re
                match = re.search(r'\{(.*)\}', content, re.DOTALL)
                if match:
                    try:
                        result = json.loads(f"{{{match.group(1)}}}")
                        summaries[tag] = result
                    except:
                        logger.warning(f"Impossible d'extraire la synthèse pour le tag '{tag}': {content}")
                        summaries[tag] = {
                            "synthèse": "Erreur lors de la génération de la synthèse",
                            "nombre_utilisateurs": len(tag_responses_list),
                            "verbatims": []
                        }
                else:
                    logger.warning(f"Format de réponse incorrect pour la synthèse du tag '{tag}': {content}")
                    summaries[tag] = {
                        "synthèse": content,
                        "nombre_utilisateurs": len(tag_responses_list),
                        "verbatims": []
                    }
        except Exception as e:
            logger.error(f"Erreur lors de la génération de la synthèse pour le tag '{tag}': {str(e)}")
            summaries[tag] = {
                "synthèse": f"Erreur: {str(e)}",
                "nombre_utilisateurs": len(tag_responses_list),
                "verbatims": []
            }
    
    return summaries

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000) 