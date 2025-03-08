import os
import json
import csv
import pandas as pd
from flask import Flask, request, jsonify, render_template, send_file
from flask_cors import CORS
import requests
import io
import logging
from urllib.parse import urlparse
from dotenv import load_dotenv
import mistralai
from mistralai.client import MistralClient
from mistralai.models.chat_completion import ChatMessage
import traceback

# Chargement des variables d'environnement depuis .env
load_dotenv()

# Configuration du logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Configuration par défaut
DEFAULT_CONFIG = {
    "model": "mistral-large-latest",
    "api_key": "",
    "endpoint": "https://api.mistral.ai/v1/chat/completions",
    "provider": "mistral"
}

# Chargement de la configuration depuis un fichier
CONFIG_FILE = "config.json"
config = DEFAULT_CONFIG.copy()

try:
    if os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE, 'r') as f:
            saved_config = json.load(f)
            config.update(saved_config)
except Exception as e:
    logger.error(f"Erreur lors du chargement de la configuration: {e}")

# Configuration Mistral
# Vérifier si la valeur dans config.json est une référence à la variable d'environnement
api_key_config = config.get("api_key", "")
if api_key_config == "ENV_MISTRAL_API_KEY":
    # Si c'est une référence, utiliser la variable d'environnement
    MISTRAL_API_KEY = os.environ.get("MISTRAL_API_KEY", "")
else:
    # Sinon, utiliser la valeur de config.json
    MISTRAL_API_KEY = api_key_config

mistral_client = MistralClient(api_key=MISTRAL_API_KEY)
MISTRAL_MODEL = "mistral-large-latest"  # Options: mistral-small-latest, mistral-medium-latest, mistral-large-latest

# Routes principales
@app.route('/')
def index():
    return render_template('index.html', config=config)

@app.route('/test')
def test():
    return render_template('test.html')

@app.route('/api/config', methods=['GET', 'POST'])
def handle_config():
    global config
    if request.method == 'POST':
        new_config = request.json
        config.update(new_config)
        
        # Sauvegarder la configuration
        try:
            with open(CONFIG_FILE, 'w') as f:
                json.dump(config, f)
        except Exception as e:
            logger.error(f"Erreur lors de la sauvegarde de la configuration: {e}")
            return jsonify({"success": False, "error": str(e)}), 500
            
        return jsonify({"success": True, "config": config})
    else:
        return jsonify(config)

@app.route('/api/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({"success": False, "error": "Aucun fichier téléchargé"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"success": False, "error": "Aucun fichier sélectionné"}), 400
    
    try:
        # Déterminer le format de fichier
        extension = os.path.splitext(file.filename)[1].lower()
        
        if extension == '.csv':
            df = pd.read_csv(file, encoding='utf-8')
        elif extension == '.json':
            df = pd.read_json(file)
        elif extension == '.txt':
            # Pour un fichier texte, supposer une réponse par ligne
            content = file.read().decode('utf-8')
            lines = [line.strip() for line in content.split('\n') if line.strip()]
            df = pd.DataFrame({"response": lines})
        else:
            return jsonify({"success": False, "error": "Format de fichier non pris en charge. Utilisez CSV, JSON ou TXT."}), 400
        
        # Vérifier qu'il y a des réponses à analyser
        if df.empty:
            return jsonify({"success": False, "error": "Le fichier ne contient aucune donnée"}), 400
        
        # Stocker temporairement les données
        temp_path = os.path.join("static", "temp_data.json")
        df.to_json(temp_path, orient="records")
        
        return jsonify({
            "success": True, 
            "message": "Fichier téléchargé avec succès",
            "rows": len(df),
            "columns": df.columns.tolist(),
            "preview": df.head(5).to_dict(orient="records")
        })
        
    except Exception as e:
        logger.error(f"Erreur lors du traitement du fichier: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/process', methods=['POST'])
def process_data():
    try:
        # Récupérer les paramètres
        params = request.json
        column_name = params.get('column', 'response')
        
        logger.info(f"Démarrage du traitement des données avec la colonne: {column_name}")
        
        # Charger les données
        temp_path = os.path.join("static", "temp_data.json")
        if not os.path.exists(temp_path):
            logger.error(f"Fichier temporaire non trouvé: {temp_path}")
            return jsonify({"success": False, "error": "Aucune donnée à analyser. Veuillez d'abord télécharger un fichier."}), 400
            
        logger.info(f"Chargement des données depuis {temp_path}")
        df = pd.read_json(temp_path, orient="records")
        logger.info(f"Données chargées: {len(df)} lignes, colonnes: {df.columns.tolist()}")
        
        if column_name not in df.columns:
            logger.error(f"Colonne {column_name} non trouvée dans les données")
            return jsonify({"success": False, "error": f"La colonne {column_name} n'existe pas dans les données"}), 400
        
        # Récupérer les réponses
        responses = df[column_name].tolist()
        logger.info(f"Extraction de {len(responses)} réponses de la colonne {column_name}")
        
        # Vérifier la clé API Mistral
        if not MISTRAL_API_KEY:
            logger.error("Clé API Mistral non définie")
            return jsonify({"success": False, "error": "Clé API Mistral non définie. Veuillez configurer votre clé API dans le fichier .env ou dans la configuration."}), 400
        
        # Traiter les réponses avec le LLM en plusieurs étapes
        results = {
            "tags": [],
            "normalized_tags": {},
            "response_tags": [],
            "tag_groups": {},
            "summaries": {}
        }
        
        # Étape 1: Extraction des tags
        logger.info("Étape 1: Extraction des tags")
        try:
            results["tags"] = process_extract_tags(responses)
            logger.info(f"Tags extraits: {results['tags']}")
        except Exception as e:
            logger.error(f"Erreur lors de l'extraction des tags: {e}")
            return jsonify({"success": False, "error": f"Erreur lors de l'extraction des tags: {str(e)}"}), 500
        
        # Si aucun tag n'a été extrait, retourner une erreur
        if not results["tags"]:
            logger.error("Aucun tag n'a été extrait des réponses")
            return jsonify({"success": False, "error": "Aucun tag n'a été extrait des réponses. Veuillez vérifier le contenu de vos données."}), 400
        
        # Étape 2: Normalisation des tags
        logger.info("Étape 2: Normalisation des tags")
        try:
            results["normalized_tags"] = process_normalize_tags(results["tags"])
            logger.info(f"Tags normalisés: {results['normalized_tags']}")
        except Exception as e:
            logger.error(f"Erreur lors de la normalisation des tags: {e}")
            return jsonify({"success": False, "error": f"Erreur lors de la normalisation des tags: {str(e)}"}), 500
        
        # Étape 3: Réattribution des tags normalisés
        logger.info("Étape 3: Réattribution des tags normalisés")
        try:
            results["response_tags"] = process_reassign_tags(responses, results["normalized_tags"])
            logger.info(f"Tags réattribués: {len(results['response_tags'])} réponses")
        except Exception as e:
            logger.error(f"Erreur lors de la réattribution des tags: {e}")
            return jsonify({"success": False, "error": f"Erreur lors de la réattribution des tags: {str(e)}"}), 500
        
        # Étape 4: Regroupement par tag
        logger.info("Étape 4: Regroupement par tag")
        try:
            results["tag_groups"] = process_group_by_tag(responses, results["response_tags"])
            logger.info(f"Groupes de tags: {len(results['tag_groups'])} groupes")
        except Exception as e:
            logger.error(f"Erreur lors du regroupement par tag: {e}")
            return jsonify({"success": False, "error": f"Erreur lors du regroupement par tag: {str(e)}"}), 500
        
        # Étape 5: Synthèse des retours
        logger.info("Étape 5: Génération des synthèses")
        try:
            results["summaries"] = process_generate_summaries(results["tag_groups"])
            logger.info(f"Synthèses générées: {len(results['summaries'])} synthèses")
        except Exception as e:
            logger.error(f"Erreur lors de la génération des synthèses: {e}")
            return jsonify({"success": False, "error": f"Erreur lors de la génération des synthèses: {str(e)}"}), 500
        
        # Sauvegarder les résultats
        results_path = os.path.join("static", "analysis_results.json")
        try:
            with open(results_path, 'w') as f:
                json.dump(results, f, ensure_ascii=False, indent=2)
            logger.info(f"Résultats sauvegardés dans {results_path}")
        except Exception as e:
            logger.error(f"Erreur lors de la sauvegarde des résultats: {e}")
            # Ne pas retourner d'erreur ici, car l'analyse a réussi
        
        # Préparer les résultats pour l'affichage
        display_results = {
            "success": True,
            "message": "Analyse terminée avec succès",
            "results": []
        }
        
        # Ajouter les résultats pour chaque réponse
        for i, response in enumerate(responses):
            result_item = {
                "id": i + 1,
                "response": response,
                "original_tags": [],
                "normalized_tags": [],
                "tag_summaries": {}
            }
            
            # Ajouter les tags normalisés pour cette réponse
            for tag_item in results["response_tags"]:
                if tag_item.get("response_id") == i + 1:
                    result_item["normalized_tags"] = tag_item.get("normalized_tags", [])
                    break
            
            # Ajouter les synthèses pour les tags de cette réponse
            for tag in result_item["normalized_tags"]:
                if tag in results["summaries"]:
                    result_item["tag_summaries"][tag] = results["summaries"][tag]
            
            display_results["results"].append(result_item)
        
        logger.info("Traitement terminé avec succès")
        return jsonify(display_results)
        
    except Exception as e:
        logger.error(f"Erreur lors de l'analyse des données: {e}")
        logger.error(traceback.format_exc())
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/export/<format>', methods=['GET'])
def export_data(format):
    try:
        # Vérifier que les résultats existent
        results_path = os.path.join("static", "analysis_results.json")
        if not os.path.exists(results_path):
            return jsonify({"success": False, "error": "Aucun résultat à exporter. Veuillez d'abord effectuer une analyse."}), 400
            
        with open(results_path, 'r') as f:
            results = json.load(f)
        
        if format.lower() == 'json':
            # Préparer le fichier JSON à télécharger
            output = io.BytesIO()
            output.write(json.dumps(results, ensure_ascii=False, indent=2).encode('utf-8'))
            output.seek(0)
            
            return send_file(
                output,
                mimetype='application/json',
                as_attachment=True,
                download_name='analysis_results.json'
            )
            
        elif format.lower() == 'csv':
            # Préparer un CSV à partir des résultats
            output = io.StringIO()
            writer = csv.writer(output)
            
            # En-têtes
            writer.writerow(['Tag', 'Occurrences', 'Résumé'])
            
            # Données
            for tag, summary in results.get('summaries', {}).items():
                writer.writerow([
                    tag,
                    len(results.get('tag_groups', {}).get(tag, [])),
                    summary
                ])
            
            output.seek(0)
            
            return send_file(
                io.BytesIO(output.getvalue().encode('utf-8')),
                mimetype='text/csv',
                as_attachment=True,
                download_name='analysis_results.csv'
            )
            
        else:
            return jsonify({"success": False, "error": "Format non pris en charge. Utilisez JSON ou CSV."}), 400
            
    except Exception as e:
        logger.error(f"Erreur lors de l'exportation des données: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

# Fonctions d'analyse avec le LLM
def call_llm(prompt, max_tokens=4000):
    """
    Fonction générique pour appeler le LLM configuré
    """
    try:
        provider = config.get('provider', 'mistral').lower()
        
        if provider == 'openai':
            return call_openai(prompt, max_tokens)
        elif provider == 'anthropic':
            return call_anthropic(prompt, max_tokens)
        elif provider == 'mistral':
            # Utiliser la fonction analyze_with_mistral mais adapter pour l'interface commune
            result = analyze_with_mistral(prompt)
            # Si le résultat est un dictionnaire
            if isinstance(result, dict):
                # S'il y a une erreur, la logger et la propager
                if 'error' in result:
                    logger.error(f"Erreur Mistral: {result['error']}")
                    raise ValueError(f"Erreur Mistral: {result['error']}")
                # S'il y a une analyse brute, la retourner
                elif 'raw_analysis' in result:
                    return result['raw_analysis']
                # Sinon, convertir le dictionnaire en JSON
                else:
                    return json.dumps(result)
            # Si c'est déjà une chaîne, la retourner directement
            elif isinstance(result, str):
                return result
            else:
                logger.error(f"Format de réponse inattendu de Mistral: {type(result)}")
                raise ValueError(f"Format de réponse inattendu de Mistral: {type(result)}")
        else:
            logger.error(f"Fournisseur LLM non pris en charge: {provider}")
            raise ValueError(f"Fournisseur LLM non pris en charge: {provider}")
            
    except Exception as e:
        logger.error(f"Erreur lors de l'appel au LLM: {e}")
        raise e

def call_openai(prompt, max_tokens=4000):
    """
    Appeler l'API OpenAI
    """
    endpoint = config.get('endpoint', 'https://api.openai.com/v1/chat/completions')
    api_key = config.get('api_key', '')
    model = config.get('model', 'gpt-4-turbo')
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    }
    
    data = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": max_tokens,
        "temperature": 0.3,
    }
    
    response = requests.post(endpoint, headers=headers, json=data)
    
    if response.status_code != 200:
        logger.error(f"Erreur OpenAI {response.status_code}: {response.text}")
        raise Exception(f"Erreur API OpenAI: {response.text}")
        
    result = response.json()
    return result['choices'][0]['message']['content'].strip()

def call_anthropic(prompt, max_tokens=4000):
    """
    Appeler l'API Anthropic
    """
    endpoint = config.get('endpoint', 'https://api.anthropic.com/v1/messages')
    api_key = config.get('api_key', '')
    model = config.get('model', 'claude-3-opus-20240229')
    
    headers = {
        "Content-Type": "application/json",
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01"
    }
    
    data = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": max_tokens
    }
    
    response = requests.post(endpoint, headers=headers, json=data)
    
    if response.status_code != 200:
        logger.error(f"Erreur Anthropic {response.status_code}: {response.text}")
        raise Exception(f"Erreur API Anthropic: {response.text}")
        
    result = response.json()
    return result['content'][0]['text']

def process_extract_tags(responses):
    """
    Étape 1: Extraire les tags des réponses
    """
    batch_size = 25  # Traiter par lots pour éviter les limites de contexte
    all_tags = []
    
    logger.info(f"Début de l'extraction des tags pour {len(responses)} réponses")
    logger.info(f"Exemple de réponse: {responses[0][:100]}...")
    
    # Première tentative avec l'approche par lots
    for i in range(0, len(responses), batch_size):
        batch = responses[i:i+batch_size]
        prompt = """
        Analyse les réponses suivantes et extrait les concepts clés (tags) présents dans chacune. 
        Pour chaque réponse, identifie 2 à 5 tags qui représentent les idées principales.
        
        Réponses à analyser:
        """
        
        for j, response in enumerate(batch):
            prompt += f"\n{j+1}. {response}"
        
        prompt += """
        
        Retourne uniquement un tableau JSON de tous les tags uniques que tu as identifiés, 
        sans autre texte explicatif. Le format doit être ["tag1", "tag2", "tag3", ...].
        """
        
        try:
            logger.info(f"Appel au LLM pour extraire les tags du lot {i//batch_size + 1}")
            logger.info(f"Prompt envoyé au LLM (début): {prompt[:200]}...")
            result = call_llm(prompt)
            logger.info(f"Réponse complète reçue du LLM: {result}")
            
            # Extraire la liste JSON de la réponse
            try:
                # Si la réponse est déjà un JSON valide
                if result.strip().startswith('[') and result.strip().endswith(']'):
                    tags = json.loads(result)
                    if isinstance(tags, list):
                        logger.info(f"Tags extraits avec succès (format JSON direct): {tags}")
                        all_tags.extend(tags)
                        logger.info(f"Tags extraits avec succès: {len(tags)} tags")
                    else:
                        logger.warning(f"Format de réponse incorrect (pas une liste): {result}")
                else:
                    # Tenter d'extraire la liste entre crochets
                    import re
                    match = re.search(r'\[(.*)\]', result, re.DOTALL)
                    if match:
                        try:
                            tags_str = match.group(1)
                            # Nettoyer la chaîne pour s'assurer qu'elle est un JSON valide
                            tags_str = tags_str.replace("'", '"')
                            logger.info(f"Chaîne de tags extraite avec regex: {tags_str}")
                            tags = json.loads(f"[{tags_str}]")
                            logger.info(f"Tags parsés avec succès après regex: {tags}")
                            all_tags.extend(tags)
                            logger.info(f"Tags extraits avec regex: {len(tags)} tags")
                        except json.JSONDecodeError as e:
                            logger.warning(f"Impossible de parser les tags avec regex: {e}")
                            logger.warning(f"Chaîne problématique: [{tags_str}]")
                    else:
                        logger.warning(f"Aucune liste de tags trouvée dans la réponse: {result}")
            except json.JSONDecodeError as e:
                logger.warning(f"Erreur de décodage JSON: {e}, réponse: {result}")
        except Exception as e:
            logger.error(f"Erreur lors de l'extraction des tags: {e}")
            logger.error(f"Détails de l'erreur: {traceback.format_exc()}")
    
    # Si aucun tag n'a été extrait avec la première méthode, essayer avec extract_tags_with_mistral
    if not all_tags:
        logger.info("Aucun tag extrait avec la méthode par lots, tentative avec extract_tags_with_mistral")
        try:
            # Utiliser extract_tags_with_mistral comme alternative
            result = extract_tags_with_mistral(responses)
            logger.info(f"Résultat de extract_tags_with_mistral: {result}")
            
            # Extraire tous les tags uniques des résultats
            if isinstance(result, list):
                for item in result:
                    if isinstance(item, dict) and 'tags' in item and isinstance(item['tags'], list):
                        all_tags.extend(item['tags'])
                logger.info(f"Tags extraits avec extract_tags_with_mistral: {all_tags}")
            else:
                logger.warning(f"Format de résultat inattendu de extract_tags_with_mistral: {result}")
        except Exception as e:
            logger.error(f"Erreur lors de l'utilisation de extract_tags_with_mistral: {e}")
            logger.error(f"Détails de l'erreur: {traceback.format_exc()}")
    
    # Si toujours aucun tag, essayer une approche simplifiée directe
    if not all_tags:
        logger.info("Tentative avec une approche simplifiée directe")
        try:
            prompt = """
            Voici une liste de réponses d'utilisateurs concernant leur expérience avec une application.
            Identifie les principaux thèmes ou concepts mentionnés dans ces réponses et liste-les sous forme de tags.
            
            Réponses:
            """
            
            # Ajouter quelques exemples de réponses (limiter pour éviter les problèmes de contexte)
            sample_size = min(10, len(responses))
            for i in range(sample_size):
                prompt += f"\n- {responses[i]}"
            
            prompt += """
            
            Retourne uniquement une liste de tags au format JSON ["tag1", "tag2", "tag3", ...] sans autre texte.
            """
            
            logger.info("Envoi d'un prompt simplifié au LLM")
            result = call_llm(prompt)
            logger.info(f"Réponse du LLM (approche simplifiée): {result}")
            
            # Tenter d'extraire les tags
            if result.strip().startswith('[') and result.strip().endswith(']'):
                tags = json.loads(result)
                if isinstance(tags, list):
                    all_tags = tags
                    logger.info(f"Tags extraits avec l'approche simplifiée: {tags}")
            else:
                # Tenter d'extraire avec regex
                match = re.search(r'\[(.*)\]', result, re.DOTALL)
                if match:
                    try:
                        tags_str = match.group(1).replace("'", '"')
                        tags = json.loads(f"[{tags_str}]")
                        all_tags = tags
                        logger.info(f"Tags extraits avec regex (approche simplifiée): {tags}")
                    except:
                        logger.warning("Échec de l'extraction avec regex (approche simplifiée)")
        except Exception as e:
            logger.error(f"Erreur avec l'approche simplifiée: {e}")
    
    # Dédupliquer les tags
    unique_tags = list(set(all_tags))
    logger.info(f"Total des tags uniques extraits: {len(unique_tags)}")
    logger.info(f"Tags extraits: {unique_tags}")
    
    # Si aucun tag n'a été extrait, créer quelques tags génériques basés sur les données
    if not unique_tags:
        logger.warning("Aucun tag extrait, création de tags génériques")
        generic_tags = ["interface", "performance", "fonctionnalité", "design", "expérience utilisateur"]
        logger.info(f"Tags génériques créés: {generic_tags}")
        return generic_tags
    
    return unique_tags

def process_normalize_tags(tags):
    """
    Étape 2: Nettoyer et normaliser les tags
    """
    if not tags:
        return {}
        
    prompt = """
    Voici une liste de tags extraits de réponses à une question ouverte. 
    Normalise ces tags en regroupant les synonymes, supprimant les doublons et uniformisant les formulations.
    
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
    
    result = call_llm(prompt)
    
    # Extraire l'objet JSON de la réponse
    try:
        normalized_tags = json.loads(result)
        if not isinstance(normalized_tags, dict):
            logger.warning(f"Format de réponse incorrect: {result}")
            normalized_tags = {}
    except json.JSONDecodeError:
        # Tenter d'extraire l'objet entre accolades si la réponse n'est pas un JSON pur
        import re
        match = re.search(r'\{(.*)\}', result, re.DOTALL)
        if match:
            try:
                normalized_tags = json.loads(f"{{{match.group(1)}}}")
            except:
                logger.warning(f"Impossible d'extraire les tags normalisés: {result}")
                normalized_tags = {}
        else:
            logger.warning(f"Format de réponse incorrect: {result}")
            normalized_tags = {}
    
    return normalized_tags

def process_reassign_tags(responses, normalized_tags):
    """
    Étape 3: Réattribuer les tags normalisés à chaque réponse
    """
    batch_size = 15  # Traiter par lots
    response_tags = []
    
    # Créer un mapping inverse pour faciliter la recherche
    tag_mapping = {}
    for normalized, originals in normalized_tags.items():
        for original in originals:
            tag_mapping[original.lower()] = normalized
    
    # Ajouter aussi les tags normalisés directement (pour les correspondances exactes)
    for normalized in normalized_tags.keys():
        tag_mapping[normalized.lower()] = normalized
    
    for i in range(0, len(responses), batch_size):
        batch = responses[i:i+batch_size]
        
        prompt = """
        Pour chaque réponse ci-dessous, identifie les tags qui s'y appliquent parmi la liste de tags normalisés fournie.
        
        Tags normalisés disponibles:
        """
        
        for tag in normalized_tags.keys():
            prompt += f"\n- {tag}"
            
        prompt += "\n\nRéponses à analyser:"
        
        for j, response in enumerate(batch):
            prompt += f"\n{j+1}. {response}"
        
        prompt += """
        
        Retourne un tableau JSON d'objets, où chaque objet contient l'index de la réponse (commençant à 0) et les tags qui s'y appliquent.
        Exemple de format attendu:
        [
            {"index": 0, "tags": ["tag1", "tag2"]},
            {"index": 1, "tags": ["tag3"]},
            ...
        ]
        
        Ne retourne que la structure JSON, sans autre texte explicatif.
        """
        
        result = call_llm(prompt)
        
        # Extraire la liste JSON de la réponse
        try:
            batch_results = json.loads(result)
            if isinstance(batch_results, list):
                # Ajuster les indices pour qu'ils correspondent à la position globale
                for item in batch_results:
                    if "index" in item and "tags" in item:
                        item["index"] += i
                response_tags.extend(batch_results)
            else:
                logger.warning(f"Format de réponse incorrect: {result}")
        except json.JSONDecodeError:
            # Tenter d'extraire la liste entre crochets
            import re
            match = re.search(r'\[(.*)\]', result, re.DOTALL)
            if match:
                try:
                    batch_results = json.loads(f"[{match.group(1)}]")
                    for item in batch_results:
                        if "index" in item and "tags" in item:
                            item["index"] += i
                    response_tags.extend(batch_results)
                except:
                    logger.warning(f"Impossible d'extraire les tags des réponses: {result}")
            else:
                logger.warning(f"Format de réponse incorrect: {result}")
    
    return response_tags

def process_group_by_tag(responses, response_tags):
    """
    Étape 4: Regrouper les réponses par tag
    """
    tag_groups = {}
    
    for item in response_tags:
        if "index" in item and "tags" in item:
            index = item["index"]
            if index < len(responses):
                for tag in item["tags"]:
                    if tag not in tag_groups:
                        tag_groups[tag] = []
                    tag_groups[tag].append({
                        "index": index,
                        "response": responses[index]
                    })
    
    return tag_groups

def process_generate_summaries(tag_groups):
    """
    Étape 5: Générer des synthèses pour chaque groupe de tags
    """
    summaries = {}
    
    for tag, responses in tag_groups.items():
        # Si trop de réponses, limiter pour éviter les problèmes de contexte
        sample = responses[:50] if len(responses) > 50 else responses
        
        prompt = f"""
        Tu dois synthétiser un ensemble de réponses associées au tag "{tag}".
        
        Voici les réponses à analyser:
        """
        
        for i, item in enumerate(sample):
            prompt += f"\n{i+1}. {item['response']}"
        
        prompt += """
        
        Génère une synthèse structurée qui:
        1. Résume les principales idées exprimées
        2. Identifie les points communs et divergences
        3. Note toute tendance ou point d'attention particulier
        
        Ta synthèse doit être concise (max 300 mots) et présenter les informations de manière claire.
        """
        
        summary = call_llm(prompt, max_tokens=2000)
        summaries[tag] = summary
    
    return summaries

def analyze_with_mistral(response_text, prompt_template=None):
    """
    Analyse une réponse ouverte en utilisant Mistral AI.
    
    Args:
        response_text (str): Le texte de la réponse à analyser
        prompt_template (str, optional): Template de prompt personnalisé
    
    Returns:
        dict: Le résultat de l'analyse
    """
    if not prompt_template:
        prompt_template = """Analysez la réponse suivante à la question "Quels sont vos problématiques concernant votre expérience utilisateur avec notre outil".
        
        Réponse: "{response}"
        
        Fournissez une analyse structurée qui inclut:
        1. Résumé des problèmes principaux (2-3 phrases)
        2. Catégorisation des problèmes (UX, performance, fonctionnalités manquantes, etc.)
        3. Niveau de satisfaction perçu (de 1 à 5)
        4. Priorité suggérée pour la résolution (haute, moyenne, basse)
        5. Suggestions d'amélioration basées sur les problèmes identifiés
        
        Formatez votre réponse en JSON."""
    
    formatted_prompt = prompt_template.format(response=response_text)
    
    # Structure pour l'API Mistral 0.4.2
    messages = [
        ChatMessage(role="system", content="Vous êtes un analyste d'expérience utilisateur expert qui analyse des réponses ouvertes pour identifier des problèmes et suggérer des améliorations."),
        ChatMessage(role="user", content=formatted_prompt)
    ]
    
    try:
        chat_response = mistral_client.chat(
            model=MISTRAL_MODEL,
            messages=messages,
            temperature=0.3,  # Valeur basse pour des réponses plus cohérentes et déterministes
            max_tokens=1024   # Ajustez selon vos besoins
        )
        
        # Tentative de parsing JSON de la réponse
        try:
            content = chat_response.choices[0].message.content
            result = json.loads(content)
            return result
        except json.JSONDecodeError:
            # Si le modèle ne renvoie pas un JSON valide, on retourne directement le texte
            return {"raw_analysis": chat_response.choices[0].message.content}
    except Exception as e:
        # En cas d'erreur, renvoyer des informations sur l'erreur
        return {"error": str(e), "error_type": type(e).__name__}

@app.route('/analyze_single', methods=['POST'])
def analyze_single():
    try:
        data = request.get_json()
        if not data or 'response_text' not in data:
            return jsonify({'error': 'Réponse manquante'}), 400

        response_text = data['response_text']
        custom_prompt = data.get('custom_prompt')

        # Analyser la réponse avec Mistral
        result = analyze_with_mistral(response_text, custom_prompt)

        return jsonify({
            'original_response': response_text,
            'analysis': result
        })

    except Exception as e:
        logger.error(f"Erreur lors de l'analyse: {str(e)}")
        return jsonify({'error': str(e)}), 500

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
        logger.info(f"Limitation à 3 lignes pour le test")
        
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
        tag_summaries = generate_tag_summaries_with_mistral(normalized_tags, normalized_response_tags, responses)
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
                'analysis': {
                    "message": "Analyse désactivée temporairement",
                    "note": "Le code d'analyse est conservé mais n'est pas exécuté pour le moment"
                },
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
    Pour chaque réponse, identifie 2 à 5 tags qui représentent les idées principales.
    
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

def generate_tag_summaries_with_mistral(normalized_tags, response_tags, responses):
    """
    Génère une synthèse pour chaque tag normalisé en utilisant Mistral AI.
    
    Args:
        normalized_tags (dict): Dictionnaire des tags normalisés avec leurs tags originaux associés
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
        3. Inclut 1-2 verbatims représentatifs (citations exactes des réponses)
        
        Format de la réponse:
        {{
            "synthèse": "Résumé des idées principales en 2-3 phrases",
            "nombre_utilisateurs": {len(tag_responses_list)},
            "verbatims": ["Citation 1", "Citation 2"]
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
    app.run(debug=True, host='0.0.0.0', port=5002) 