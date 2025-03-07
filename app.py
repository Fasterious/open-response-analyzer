import os
import json
import pandas as pd
from flask import Flask, request, jsonify, render_template, send_file
from flask_cors import CORS
import io
import logging
from dotenv import load_dotenv
from mistralai.client import MistralClient
from mistralai.models.chat_completion import ChatMessage

# Initialisation
load_dotenv()  # Charger variables depuis .env
app = Flask(__name__)
CORS(app)
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuration
CONFIG_FILE = "config.json"
DEFAULT_CONFIG = {
    "model": "mistral-large-latest",
    "endpoint": "https://api.mistral.ai/v1/chat/completions"
}

# Charger la configuration
config = DEFAULT_CONFIG.copy()
try:
    if os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE, 'r') as f:
            config.update(json.load(f))
except Exception as e:
    logger.error(f"Erreur chargement config: {e}")

# Initialiser Mistral AI
MISTRAL_API_KEY = os.environ.get("MISTRAL_API_KEY", "")
if not MISTRAL_API_KEY:
    logger.warning("Clé API Mistral manquante dans .env")
    
mistral_client = MistralClient(api_key=MISTRAL_API_KEY)
MISTRAL_MODEL = config.get("model", "mistral-large-latest")

# Routes
@app.route('/')
def index():
    return render_template('index.html', config=config)

@app.route('/api/config', methods=['GET', 'POST'])
def handle_config():
    global config
    if request.method == 'POST':
        new_config = request.json
        config.update(new_config)
        
        try:
            with open(CONFIG_FILE, 'w') as f:
                json.dump(config, f)
            return jsonify({"success": True, "config": config})
        except Exception as e:
            logger.error(f"Erreur sauvegarde config: {e}")
            return jsonify({"success": False, "error": str(e)}), 500
    else:
        return jsonify(config)

@app.route('/api/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files or request.files['file'].filename == '':
        return jsonify({"success": False, "error": "Aucun fichier sélectionné"}), 400
    
    file = request.files['file']
    try:
        # Détecter et charger le format du fichier
        extension = os.path.splitext(file.filename)[1].lower()
        
        if extension == '.csv':
            df = pd.read_csv(file, encoding='utf-8')
        elif extension == '.json':
            df = pd.read_json(file)
        elif extension == '.txt':
            content = file.read().decode('utf-8')
            lines = [line.strip() for line in content.split('\n') if line.strip()]
            df = pd.DataFrame({"response": lines})
        else:
            return jsonify({"success": False, "error": "Format non supporté (CSV, JSON, TXT)"}), 400
        
        if df.empty:
            return jsonify({"success": False, "error": "Fichier vide"}), 400
        
        # Sauvegarder temporairement
        temp_path = os.path.join("static", "temp_data.json")
        df.to_json(temp_path, orient="records")
        
        return jsonify({
            "success": True, 
            "rows": len(df),
            "columns": df.columns.tolist(),
            "preview": df.head(5).to_dict(orient="records")
        })
        
    except Exception as e:
        logger.error(f"Erreur traitement fichier: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/process', methods=['POST'])
def process_data():
    try:
        column_name = request.json.get('column', 'response')
        temp_path = os.path.join("static", "temp_data.json")
        
        if not os.path.exists(temp_path):
            return jsonify({"success": False, "error": "Données manquantes"}), 400
            
        df = pd.read_json(temp_path, orient="records")
        
        if column_name not in df.columns:
            return jsonify({"success": False, "error": f"Colonne {column_name} introuvable"}), 400
        
        responses = df[column_name].tolist()
        
        # Traitement en 5 étapes
        results = {}
        results["tags"] = process_extract_tags(responses)
        results["normalized_tags"] = process_normalize_tags(results["tags"])
        results["response_tags"] = process_reassign_tags(responses, results["normalized_tags"])
        results["tag_counts"] = {tag: len(info.get("responses", [])) for tag, info in results["normalized_tags"].items()}
        results["summaries"] = process_generate_summaries(results["normalized_tags"])
        results["data"] = [{"response": r} for r in responses]
        
        # Sauvegarder les résultats
        with open(os.path.join("static", "analysis_results.json"), 'w') as f:
            json.dump(results, f, ensure_ascii=False, indent=2)
        
        return jsonify({"success": True, "results": results})
        
    except Exception as e:
        logger.error(f"Erreur analyse: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/export/<format>', methods=['GET'])
def export_data(format):
    try:
        results_path = os.path.join("static", "analysis_results.json")
        if not os.path.exists(results_path):
            return jsonify({"success": False, "error": "Aucun résultat à exporter"}), 400
            
        with open(results_path, 'r') as f:
            results = json.load(f)
        
        if format.lower() == 'json':
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
            output = io.StringIO()
            writer = pd.DataFrame({
                'Tag': list(results.get('summaries', {}).keys()),
                'Occurrences': [results.get('tag_counts', {}).get(tag, 0) for tag in results.get('summaries', {}).keys()],
                'Résumé': list(results.get('summaries', {}).values())
            }).to_csv(index=False)
            
            return send_file(
                io.BytesIO(writer.encode('utf-8')),
                mimetype='text/csv',
                as_attachment=True,
                download_name='analysis_results.csv'
            )
            
        else:
            return jsonify({"success": False, "error": "Format non supporté (JSON, CSV)"}), 400
            
    except Exception as e:
        logger.error(f"Erreur exportation: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

# Fonctions d'analyse
def process_extract_tags(responses):
    """Étape 1: Extraire les tags des réponses"""
    prompt = f"""
    Voici une liste de réponses à une question ouverte. Pour chaque réponse, identifie les concepts clés (tags) abordés.
    
    Réponses:
    {responses[:50]}
    
    Réponds au format JSON avec la structure suivante:
    [
      {{"index": 0, "tags": ["tag1", "tag2", ...]}}
    ]
    """
    
    # Appel à Mistral
    result = analyze_with_mistral(prompt)
    
    try:
        if isinstance(result, dict) and "raw_analysis" in result:
            return json.loads(result["raw_analysis"])
        elif isinstance(result, dict):
            return result.get("analysis", [])
        else:
            return json.loads(result)
    except:
        logger.error(f"Erreur parsing JSON de la réponse du LLM: {result}")
        return []

def process_normalize_tags(tags):
    """Étape 2: Normaliser les tags"""
    # Extraire tous les tags uniques
    all_tags = []
    for item in tags:
        all_tags.extend(item.get("tags", []))
    
    unique_tags = list(set(all_tags))
    
    prompt = f"""
    Voici une liste de tags extraits de réponses à une question ouverte.
    Normalise ces tags en regroupant ceux qui représentent le même concept.
    
    Tags: {unique_tags}
    
    Réponds au format JSON:
    {{
      "tag_normalisé_1": ["tag_original_1", "tag_original_2"],
      "tag_normalisé_2": ["tag_original_3", "tag_original_4"]
    }}
    """
    
    result = analyze_with_mistral(prompt)
    
    try:
        if isinstance(result, dict) and "raw_analysis" in result:
            normalized_map = json.loads(result["raw_analysis"])
        elif isinstance(result, dict):
            normalized_map = result.get("analysis", {})
        else:
            normalized_map = json.loads(result)
        
        # Convertir en format plus pratique pour l'utilisation
        normalized_tags = {}
        for norm_tag, original_tags in normalized_map.items():
            normalized_tags[norm_tag] = {
                "original_tags": original_tags,
                "count": 0,
                "responses": []
            }
        
        return normalized_tags
    except:
        logger.error(f"Erreur parsing JSON de la réponse du LLM: {result}")
        return {}

def process_reassign_tags(responses, normalized_tags):
    """Étape 3: Réassigner les tags normalisés aux réponses"""
    result = []
    
    # Créer un mapping des tags originaux aux tags normalisés
    tag_mapping = {}
    for norm_tag, info in normalized_tags.items():
        for orig_tag in info["original_tags"]:
            tag_mapping[orig_tag.lower()] = norm_tag
    
    # Réassigner les tags pour chaque réponse
    for i, response in enumerate(responses):
        prompt = f"""
        Identifie les concepts clés dans cette réponse: "{response}"
        Réponds uniquement avec une liste de tags au format JSON, exemple: ["tag1", "tag2"]
        """
        
        result_tags = analyze_with_mistral(prompt)
        
        try:
            if isinstance(result_tags, dict) and "raw_analysis" in result_tags:
                extracted_tags = json.loads(result_tags["raw_analysis"])
            elif isinstance(result_tags, dict):
                extracted_tags = result_tags.get("analysis", [])
            else:
                extracted_tags = json.loads(result_tags)
            
            # Normaliser les tags extraits
            normalized = []
            for tag in extracted_tags:
                tag_lower = tag.lower()
                if tag_lower in tag_mapping:
                    norm_tag = tag_mapping[tag_lower]
                    normalized.append(norm_tag)
                    # Mettre à jour le compteur et ajouter la réponse
                    normalized_tags[norm_tag]["count"] += 1
                    normalized_tags[norm_tag]["responses"].append(response)
            
            result.append({"index": i, "response": response, "tags": normalized})
        except:
            logger.error(f"Erreur parsing JSON de la réponse du LLM pour la réponse {i}")
            result.append({"index": i, "response": response, "tags": []})
    
    return result

def process_generate_summaries(normalized_tags):
    """Étape 4: Générer des synthèses pour chaque tag"""
    summaries = {}
    
    for tag, info in normalized_tags.items():
        if not info.get("responses"):
            continue
            
        # Limiter le nombre de réponses pour éviter des requêtes trop longues
        sample_responses = info["responses"][:20]
        
        prompt = f"""
        Voici un ensemble de réponses qui partagent le concept "{tag}".
        
        Réponses:
        {sample_responses}
        
        Synthétise ces réponses en un paragraphe qui capture les points communs et les nuances.
        """
        
        summary = analyze_with_mistral(prompt)
        
        if isinstance(summary, dict):
            summaries[tag] = summary.get("analysis", "Aucune synthèse disponible")
        else:
            summaries[tag] = summary
    
    return summaries

def analyze_with_mistral(response_text, prompt_template=None):
    """Analyser avec Mistral AI"""
    try:
        logger.info(f"Appel à Mistral AI avec texte de longueur {len(response_text)}")
        
        if not prompt_template:
            # Prompt par défaut pour l'analyse
            prompt_template = """
            Analyse la réponse suivante et identifie les concepts clés abordés.
            
            Réponse: {response}
            
            Réponds au format JSON.
            """
        
        # Construire le prompt final
        prompt = prompt_template.replace("{response}", response_text) if "{response}" in prompt_template else response_text
        logger.info(f"Prompt construit, longueur: {len(prompt)}")
        
        try:
            # Faire l'appel à l'API Mistral
            messages = [ChatMessage(role="user", content=prompt)]
            logger.info(f"Envoi de la requête à Mistral avec modèle: {MISTRAL_MODEL}")
            
            chat_response = mistral_client.chat(
                model=MISTRAL_MODEL,
                messages=messages
            )
            
            response_text = chat_response.choices[0].message.content
            logger.info(f"Réponse reçue de Mistral, longueur: {len(response_text)}")
            
            # Essayer de parser comme JSON
            try:
                parsed_json = json.loads(response_text)
                logger.info("Réponse parsée avec succès en JSON")
                return parsed_json
            except json.JSONDecodeError:
                logger.warning("La réponse n'est pas un JSON valide, retour en brut")
                return {"raw_analysis": response_text}
        except Exception as e:
            logger.error(f"Erreur lors de l'appel à l'API Mistral: {str(e)}")
            return {"error": str(e), "error_type": type(e).__name__}
    except Exception as e:
        logger.error(f"Erreur générale dans analyze_with_mistral: {str(e)}")
        return {"error": str(e), "error_type": type(e).__name__}

@app.route('/analyze_response', methods=['POST'])
def analyze_endpoint():
    try:
        logger.info("Requête reçue sur /analyze_response")
        data = request.json
        logger.info(f"Données reçues: {data}")
        
        response_text = data.get('response_text', '')
        custom_prompt = data.get('custom_prompt', None)
        
        if not response_text:
            logger.warning("Aucun texte de réponse fourni")
            return jsonify({"error": "Texte manquant"}), 400
        
        logger.info(f"Analyse en cours pour texte de longueur {len(response_text)}")
        analysis_result = analyze_with_mistral(response_text, custom_prompt)
        logger.info(f"Analyse terminée, résultat: {type(analysis_result)}")
        
        result = {
            "original_response": response_text,
            "analysis": analysis_result,
            "model_used": MISTRAL_MODEL
        }
        logger.info("Envoi de la réponse")
        return jsonify(result)
    except Exception as e:
        logger.error(f"Erreur dans analyze_endpoint: {str(e)}")
        return jsonify({"error": str(e), "error_type": type(e).__name__}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5002) 