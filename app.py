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
        
        # Charger les données
        temp_path = os.path.join("static", "temp_data.json")
        if not os.path.exists(temp_path):
            return jsonify({"success": False, "error": "Aucune donnée à analyser. Veuillez d'abord télécharger un fichier."}), 400
            
        df = pd.read_json(temp_path, orient="records")
        
        if column_name not in df.columns:
            return jsonify({"success": False, "error": f"La colonne {column_name} n'existe pas dans les données"}), 400
        
        # Récupérer les réponses
        responses = df[column_name].tolist()
        
        # Traiter les réponses avec le LLM en plusieurs étapes
        results = {
            "tags": process_extract_tags(responses),
            "normalized_tags": {},
            "response_tags": [],
            "tag_groups": {},
            "summaries": {}
        }
        
        # Étape 2: Normalisation des tags
        results["normalized_tags"] = process_normalize_tags(results["tags"])
        
        # Étape 3: Réattribution des tags normalisés
        results["response_tags"] = process_reassign_tags(responses, results["normalized_tags"])
        
        # Étape 4: Regroupement par tag
        results["tag_groups"] = process_group_by_tag(responses, results["response_tags"])
        
        # Étape 5: Synthèse des retours
        results["summaries"] = process_generate_summaries(results["tag_groups"])
        
        # Sauvegarder les résultats
        results_path = os.path.join("static", "analysis_results.json")
        with open(results_path, 'w') as f:
            json.dump(results, f, ensure_ascii=False, indent=2)
        
        return jsonify({
            "success": True,
            "message": "Analyse terminée avec succès",
            "results": results
        })
        
    except Exception as e:
        logger.error(f"Erreur lors de l'analyse des données: {e}")
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
            # Si le résultat est déjà un dictionnaire, retourner directement
            if isinstance(result, dict):
                return result
            # Sinon, retourner le texte comme résultat
            return {"content": result}
        else:
            logger.error(f"Fournisseur LLM non pris en charge: {provider}")
            raise ValueError(f"Fournisseur LLM non pris en charge: {provider}")
            
    except Exception as e:
        logger.error(f"Erreur lors de l'appel au LLM: {e}")
        return {"error": str(e)}

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
        
        result = call_llm(prompt)
        
        # Extraire la liste JSON de la réponse
        try:
            tags = json.loads(result)
            if isinstance(tags, list):
                all_tags.extend(tags)
            else:
                logger.warning(f"Format de réponse incorrect: {result}")
        except json.JSONDecodeError:
            # Tenter d'extraire la liste entre crochets si la réponse n'est pas un JSON pur
            import re
            match = re.search(r'\[(.*)\]', result, re.DOTALL)
            if match:
                try:
                    tags = json.loads(f"[{match.group(1)}]")
                    all_tags.extend(tags)
                except:
                    logger.warning(f"Impossible d'extraire les tags: {result}")
            else:
                logger.warning(f"Format de réponse incorrect: {result}")
    
    # Dédupliquer les tags
    return list(set(all_tags))

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
        
        # Préparer les résultats sans analyse
        results = []
        for index, row in df.iterrows():
            logger.info(f"Préparation de la réponse {index+1}/{len(df)}: {row['response'][:50]}...")
            
            # Trouver les tags correspondant à cette réponse
            tags_for_response = []
            for tag_item in response_tags:
                if tag_item.get('response_id') == index + 1:
                    tags_for_response = tag_item.get('tags', [])
                    break
            
            # Ajouter la réponse aux résultats sans analyse
            results.append({
                'id': int(row['id']),
                'response': row['response'],
                'analysis': {
                    "message": "Analyse désactivée temporairement",
                    "note": "Le code d'analyse est conservé mais n'est pas exécuté pour le moment"
                },
                'tags': tags_for_response
            })
        
        logger.info(f"Préparation terminée pour {len(results)} réponses")

        # Code d'analyse commenté mais conservé
        """
        # Analyser les réponses du fichier d'exemple
        results = []
        for index, row in df.iterrows():
            logger.info(f"Analyse de la réponse {index+1}/{len(df)}: {row['response'][:50]}...")
            analysis = analyze_with_mistral(row['response'])
            
            # Trouver les tags correspondant à cette réponse
            tags_for_response = []
            for tag_item in response_tags:
                if tag_item.get('response_id') == index + 1:
                    tags_for_response = tag_item.get('tags', [])
                    break
            
            results.append({
                'id': int(row['id']),
                'response': row['response'],
                'analysis': analysis,
                'tags': tags_for_response
            })
        
        logger.info(f"Analyse terminée pour {len(results)} réponses")
        """

        return jsonify({
            'success': True,
            'results': results
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

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5002) 