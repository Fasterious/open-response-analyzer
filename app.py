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
import uuid
import threading
import time
from collections import deque
import queue

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

# Dictionnaire pour stocker les sessions d'analyse
analysis_sessions = {}

# Classe pour gérer une session d'analyse
class AnalysisSession:
    def __init__(self, session_id):
        self.session_id = session_id
        self.status = "initializing"  # initializing, running, completed, error
        self.current_step = "data-loading"  # data-loading, tag-extraction, tag-normalization, synthesis-generation
        self.results = None
        self.error_message = None
        self.logs = deque(maxlen=100)  # Garder les 100 derniers logs
        self.log_queue = queue.Queue()  # File pour les nouveaux logs
        self.last_poll_index = 0  # Index du dernier log récupéré
    
    def add_log(self, message, level="INFO"):
        """Ajouter un log à la session"""
        log_entry = {
            "timestamp": time.time(),
            "message": message,
            "level": level
        }
        self.logs.append(log_entry)
        self.log_queue.put(log_entry)
        logger.info(f"[Session {self.session_id}] {message}")
    
    def get_new_logs(self):
        """Récupérer les nouveaux logs depuis le dernier polling"""
        new_logs = []
        try:
            while True:
                new_logs.append(self.log_queue.get_nowait())
        except queue.Empty:
            pass
        return new_logs
    
    def update_status(self, status, error_message=None):
        """Mettre à jour le statut de la session"""
        self.status = status
        if error_message:
            self.error_message = error_message
            self.add_log(f"Erreur: {error_message}", "ERROR")
    
    def update_step(self, step):
        """Mettre à jour l'étape courante"""
        self.current_step = step
        self.add_log(f"Passage à l'étape: {step}")
    
    def set_results(self, results):
        """Définir les résultats de l'analyse"""
        self.results = results
        self.status = "completed"
        self.add_log("Analyse terminée avec succès", "INFO")

# Fonction pour créer une nouvelle session d'analyse
def create_analysis_session():
    session_id = str(uuid.uuid4())
    analysis_sessions[session_id] = AnalysisSession(session_id)
    return session_id

# Fonction pour récupérer une session d'analyse
def get_analysis_session(session_id):
    return analysis_sessions.get(session_id)

# Fonction pour nettoyer les anciennes sessions (à appeler périodiquement)
def cleanup_old_sessions():
    # Implémenter la logique de nettoyage des anciennes sessions
    pass

# Routes principales
@app.route('/')
def index():
    return render_template('index.html', version=VERSION_STRING)

@app.route('/save_api_key', methods=['POST'])
def save_api_key():
    logger.info("Route /save_api_key appelée")
    try:
        data = request.json
        api_key = data.get('api_key')
        
        if not api_key:
            logger.error("Clé API manquante")
            return jsonify({'success': False, 'error': 'Clé API manquante'}), 400
        
        # Vérifier la validité de la clé API en créant un client Mistral
        try:
            test_client = MistralClient(api_key=api_key)
            # Tester la clé avec une requête simple
            test_client.chat(
                model=MISTRAL_MODEL,
                messages=[ChatMessage(role="user", content="Test de la clé API")],
                max_tokens=10
            )
            
            # Si aucune exception n'est levée, la clé est valide
            # Sauvegarder la clé dans le fichier .env
            with open('.env', 'w') as f:
                f.write(f"MISTRAL_API_KEY={api_key}")
            
            # Mettre à jour la variable globale
            global MISTRAL_API_KEY, mistral_client
            MISTRAL_API_KEY = api_key
            mistral_client = MistralClient(api_key=MISTRAL_API_KEY)
            
            logger.info("Clé API sauvegardée avec succès")
            return jsonify({'success': True}), 200
            
        except Exception as e:
            logger.error(f"Clé API invalide: {str(e)}")
            return jsonify({'success': False, 'error': 'Clé API invalide'}), 400
        
    except Exception as e:
        logger.error(f"Erreur lors de la sauvegarde de la clé API: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

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
                    'id': index + 1,
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
            return jsonify({'error': f'Erreur lors de la lecture du fichier CSV: {str(e)}'}), 400

    except Exception as e:
        logger.error(f"Erreur lors de l'importation et du test: {str(e)}")
        logger.exception("Détail de l'erreur:")
        return jsonify({'error': str(e)}), 500

@app.route('/get_test_data_preview')
def get_test_data_preview():
    logger.info("Route /get_test_data_preview appelée")
    try:
        # Charger le fichier example_data.csv
        example_file = 'example_data.csv'
        if not os.path.exists(example_file):
            logger.error("Fichier example_data.csv non trouvé")
            return jsonify([]), 200

        # Lire le fichier CSV
        df = pd.read_csv(example_file)
        
        # Limiter à 5 lignes pour l'aperçu
        df = df.head(5)
        
        # Préparer les données pour l'affichage
        preview_data = []
        for index, row in df.iterrows():
            preview_data.append({
                'id': index + 1,
                'response': row['response'] if 'response' in row else row.iloc[0]
            })
        
        return jsonify(preview_data), 200
    except Exception as e:
        logger.error(f"Erreur lors de la récupération de l'aperçu des données de test: {str(e)}")
        return jsonify([]), 200

# Fonction modifiée pour extraire les tags avec Mistral
def extract_tags_with_mistral(responses, session=None):
    """Extraire les tags des réponses en utilisant Mistral AI"""
    try:
        if session:
            session.add_log("Préparation de la requête d'extraction de tags")
        
        # Préparer les réponses pour l'extraction
        formatted_responses = []
        for i, response in enumerate(responses):
            formatted_responses.append(f"Réponse {i+1}: {response}")
        
        # Construire le prompt pour Mistral
        prompt = """Tu es un expert en analyse de données textuelles. Ta tâche est d'extraire des tags pertinents à partir de réponses ouvertes.

Pour chaque réponse, identifie 3 à 5 tags qui capturent les thèmes, sentiments ou concepts clés.
Les tags doivent être des mots ou expressions courtes (1-3 mots).

Voici les réponses à analyser:

{responses}

Réponds UNIQUEMENT au format JSON suivant, sans aucun texte supplémentaire:
[
  {{
    "response_id": 1,
    "tags": ["tag1", "tag2", "tag3"]
  }},
  ...
]""".format(responses="\n".join(formatted_responses))
        
        if session:
            session.add_log("Envoi de la requête d'extraction de tags à Mistral")
        
        # Appeler l'API Mistral
        chat_response = mistral_client.chat(
            model=MISTRAL_MODEL,
            messages=[ChatMessage(role="user", content=prompt)],
        )
        
        # Extraire la réponse
        response_content = chat_response.choices[0].message.content
        
        if session:
            session.add_log("Réponse reçue de Mistral, traitement des tags extraits")
        
        # Extraire le JSON de la réponse
        try:
            # Essayer de parser directement
            extracted_tags = json.loads(response_content)
        except json.JSONDecodeError:
            # Si échec, essayer d'extraire le JSON de la réponse textuelle
            import re
            json_match = re.search(r'\[\s*\{.*\}\s*\]', response_content, re.DOTALL)
            if json_match:
                extracted_tags = json.loads(json_match.group(0))
            else:
                raise ValueError("Impossible d'extraire le JSON de la réponse")
        
        if session:
            session.add_log(f"Tags extraits: {extracted_tags[:3]}...")
        
        return extracted_tags
    
    except Exception as e:
        error_msg = f"Erreur lors de l'extraction des tags: {str(e)}"
        logger.error(error_msg)
        if session:
            session.add_log(error_msg, "ERROR")
        raise

# Fonction modifiée pour normaliser les tags avec Mistral
def normalize_tags_with_mistral(tags, session=None):
    """Normaliser les tags en utilisant Mistral AI"""
    try:
        if session:
            session.add_log("Préparation de la requête de normalisation des tags")
        
        # Construire le prompt pour Mistral
        prompt = """Tu es un expert en analyse de données textuelles. Ta tâche est de normaliser et regrouper des tags similaires.

Voici une liste de tags extraits de réponses ouvertes:
{tags}

Regroupe ces tags en catégories cohérentes. Crée un dictionnaire où:
- Les clés sont les tags normalisés (catégories)
- Les valeurs sont des listes de tags originaux qui appartiennent à cette catégorie

Réponds UNIQUEMENT au format JSON suivant, sans aucun texte supplémentaire:
{{
  "Tag normalisé 1": ["tag original 1", "tag original 2"],
  "Tag normalisé 2": ["tag original 3", "tag original 4"],
  ...
}}""".format(tags=", ".join(tags))
        
        if session:
            session.add_log("Envoi de la requête de normalisation des tags à Mistral")
        
        # Appeler l'API Mistral
        chat_response = mistral_client.chat(
            model=MISTRAL_MODEL,
            messages=[ChatMessage(role="user", content=prompt)],
        )
        
        # Extraire la réponse
        response_content = chat_response.choices[0].message.content
        
        if session:
            session.add_log("Réponse reçue de Mistral, traitement des tags normalisés")
        
        # Extraire le JSON de la réponse
        try:
            # Essayer de parser directement
            normalized_tags = json.loads(response_content)
        except json.JSONDecodeError:
            # Si échec, essayer d'extraire le JSON de la réponse textuelle
            import re
            json_match = re.search(r'\{.*\}', response_content, re.DOTALL)
            if json_match:
                normalized_tags = json.loads(json_match.group(0))
            else:
                raise ValueError("Impossible d'extraire le JSON de la réponse")
        
        if session:
            session.add_log(f"Tags normalisés: {normalized_tags}")
        
        return normalized_tags
    
    except Exception as e:
        error_msg = f"Erreur lors de la normalisation des tags: {str(e)}"
        logger.error(error_msg)
        if session:
            session.add_log(error_msg, "ERROR")
        raise

# Fonction modifiée pour réattribuer les tags normalisés
def reassign_normalized_tags(response_tags, normalized_tags, session=None):
    """Réattribuer les tags normalisés aux réponses"""
    try:
        if session:
            session.add_log("Réattribution des tags normalisés aux réponses")
        
        # Créer un dictionnaire pour la recherche rapide
        tag_to_normalized = {}
        for normalized_tag, original_tags in normalized_tags.items():
            for tag in original_tags:
                tag_to_normalized[tag.lower()] = normalized_tag
        
        # Réattribuer les tags normalisés à chaque réponse
        normalized_response_tags = []
        for item in response_tags:
            original_tags = item.get('tags', [])
            normalized_tags_for_response = []
            
            # Pour chaque tag original, trouver le tag normalisé correspondant
            for tag in original_tags:
                normalized_tag = tag_to_normalized.get(tag.lower())
                if normalized_tag and normalized_tag not in normalized_tags_for_response:
                    normalized_tags_for_response.append(normalized_tag)
            
            # Ajouter l'élément avec les tags originaux et normalisés
            normalized_response_tags.append({
                'response_id': item.get('response_id'),
                'original_tags': original_tags,
                'normalized_tags': normalized_tags_for_response
            })
        
        if session:
            session.add_log(f"Tags normalisés réattribués: {normalized_response_tags[:3]}...")
        
        return normalized_response_tags
    
    except Exception as e:
        error_msg = f"Erreur lors de la réattribution des tags normalisés: {str(e)}"
        logger.error(error_msg)
        if session:
            session.add_log(error_msg, "ERROR")
        raise

# Fonction modifiée pour générer les synthèses avec Mistral
def generate_tag_summaries_with_mistral(response_tags, responses, session=None):
    """Générer des synthèses pour chaque tag normalisé en utilisant Mistral AI"""
    try:
        if session:
            session.add_log("Préparation de la génération des synthèses par tag")
        
        # Collecter toutes les réponses par tag normalisé
        responses_by_tag = {}
        for i, item in enumerate(response_tags):
            if i < len(responses):  # S'assurer que l'index est valide
                response = responses[i]
                for tag in item.get('normalized_tags', []):
                    if tag not in responses_by_tag:
                        responses_by_tag[tag] = []
                    responses_by_tag[tag].append(response)
        
        # Générer une synthèse pour chaque tag
        summaries = {}
        for tag, tag_responses in responses_by_tag.items():
            if session:
                session.add_log(f"Génération de la synthèse pour le tag '{tag}'")
            
            # Limiter le nombre de réponses pour éviter de dépasser les limites de l'API
            if len(tag_responses) > 10:
                tag_responses = tag_responses[:10]
            
            # Construire le prompt pour Mistral
            prompt = """Tu es un expert en analyse de données textuelles. Ta tâche est de générer une synthèse pour un groupe de réponses partageant un même tag.

Tag: {tag}

Voici les réponses associées à ce tag:
{responses}

Génère une synthèse qui:
1. Résume les points communs et les tendances principales
2. Identifie le nombre d'utilisateurs concernés
3. Extrait 2-3 verbatims représentatifs (citations exactes des réponses)

Réponds UNIQUEMENT au format JSON suivant, sans aucun texte supplémentaire:
{{
  "synthèse": "Texte de la synthèse...",
  "nombre_utilisateurs": X,
  "verbatims": ["verbatim 1", "verbatim 2", "verbatim 3"]
}}""".format(tag=tag, responses="\n".join([f"- {r}" for r in tag_responses]))
            
            # Appeler l'API Mistral
            chat_response = mistral_client.chat(
                model=MISTRAL_MODEL,
                messages=[ChatMessage(role="user", content=prompt)],
            )
            
            # Extraire la réponse
            response_content = chat_response.choices[0].message.content
            
            # Extraire le JSON de la réponse
            try:
                # Essayer de parser directement
                summary = json.loads(response_content)
            except json.JSONDecodeError:
                # Si échec, essayer d'extraire le JSON de la réponse textuelle
                import re
                json_match = re.search(r'\{.*\}', response_content, re.DOTALL)
                if json_match:
                    summary = json.loads(json_match.group(0))
                else:
                    # En cas d'échec, créer une synthèse par défaut
                    summary = {
                        "synthèse": f"Synthèse pour le tag '{tag}' (erreur de génération)",
                        "nombre_utilisateurs": len(tag_responses),
                        "verbatims": tag_responses[:2] if tag_responses else []
                    }
            
            summaries[tag] = summary
        
        if session:
            session.add_log(f"Synthèses générées: {list(summaries.keys())}")
        
        return summaries
    
    except Exception as e:
        error_msg = f"Erreur lors de la génération des synthèses: {str(e)}"
        logger.error(error_msg)
        if session:
            session.add_log(error_msg, "ERROR")
        raise

# Nouvelle route pour démarrer une analyse
@app.route('/start_analysis', methods=['POST'])
def start_analysis():
    """Démarrer une nouvelle session d'analyse"""
    try:
        # Créer une nouvelle session
        session_id = create_analysis_session()
        session = get_analysis_session(session_id)
        
        # Déterminer si on utilise les données de test ou un fichier importé
        use_test_data = False
        
        if request.content_type and 'application/json' in request.content_type:
            data = request.json
            use_test_data = data.get('use_test_data', False)
        
        # Lancer l'analyse en arrière-plan
        threading.Thread(target=run_analysis, args=(session_id, use_test_data, request.files.get('file'))).start()
        
        return jsonify({
            'success': True,
            'session_id': session_id,
            'message': 'Analyse démarrée'
        })
    
    except Exception as e:
        logger.error(f"Erreur lors du démarrage de l'analyse: {str(e)}")
        return jsonify({
            'success': False,
            'error': f"Erreur lors du démarrage de l'analyse: {str(e)}"
        }), 500

# Route pour suivre la progression de l'analyse
@app.route('/analysis_progress/<session_id>', methods=['GET'])
def analysis_progress(session_id):
    """Récupérer la progression d'une session d'analyse"""
    session = get_analysis_session(session_id)
    
    if not session:
        return jsonify({
            'success': False,
            'error': 'Session non trouvée'
        }), 404
    
    # Récupérer les nouveaux logs
    new_logs = session.get_new_logs()
    
    response_data = {
        'success': True,
        'status': session.status,
        'current_step': session.current_step,
        'logs': new_logs
    }
    
    # Ajouter les résultats si l'analyse est terminée
    if session.status == 'completed' and session.results:
        response_data['results'] = session.results
    
    # Ajouter le message d'erreur si une erreur s'est produite
    if session.status == 'error':
        response_data['error_message'] = session.error_message
    
    return jsonify(response_data)

# Fonction pour exécuter l'analyse en arrière-plan
def run_analysis(session_id, use_test_data, uploaded_file=None):
    """Exécuter l'analyse en arrière-plan"""
    session = get_analysis_session(session_id)
    
    if not session:
        logger.error(f"Session {session_id} non trouvée")
        return
    
    try:
        session.update_status("running")
        
        # Étape 1: Chargement des données
        session.update_step("data-loading")
        session.add_log("Chargement des données en cours...")
        
        responses = []
        
        if use_test_data:
            # Utiliser les données de test
            session.add_log("Utilisation des données de test")
            
            # Vérifier l'existence du fichier de données de test
            test_data_path = os.path.join(os.path.dirname(__file__), 'example_data.csv')
            session.add_log(f"Vérification de l'existence du fichier example_data.csv")
            
            if not os.path.exists(test_data_path):
                raise FileNotFoundError(f"Fichier de données de test non trouvé: {test_data_path}")
            
            # Lire le fichier CSV
            session.add_log("Lecture du fichier CSV")
            df = pd.read_csv(test_data_path)
            
            # Extraire les réponses
            if 'response' in df.columns or 'réponse' in df.columns:
                response_col = 'response' if 'response' in df.columns else 'réponse'
                responses = df[response_col].tolist()
                session.add_log(f"Fichier CSV lu avec succès, {len(responses)} lignes trouvées")
            else:
                raise ValueError("Le fichier CSV ne contient pas de colonne 'response' ou 'réponse'")
        else:
            # Utiliser le fichier importé
            if not uploaded_file:
                raise ValueError("Aucun fichier n'a été fourni")
            
            session.add_log(f"Traitement du fichier importé: {uploaded_file.filename}")
            
            # Lire le contenu du fichier
            content = uploaded_file.read().decode('utf-8')
            df = pd.read_csv(io.StringIO(content))
            
            # Extraire les réponses
            if 'response' in df.columns or 'réponse' in df.columns:
                response_col = 'response' if 'response' in df.columns else 'réponse'
                responses = df[response_col].tolist()
                session.add_log(f"Fichier CSV importé lu avec succès, {len(responses)} lignes trouvées")
            else:
                raise ValueError("Le fichier CSV ne contient pas de colonne 'response' ou 'réponse'")
        
        # Limiter le nombre de réponses pour les tests
        if len(responses) > 15:
            session.add_log(f"Limitation à 15 réponses pour les tests (sur {len(responses)} au total)")
            responses = responses[:15]
        
        # Étape 2: Extraction des tags
        session.update_step("tag-extraction")
        session.add_log("Extraction des tags à partir des réponses")
        
        # Extraire les tags avec Mistral
        response_tags = extract_tags_with_mistral(responses, session)
        
        # Collecter tous les tags uniques
        all_tags = []
        for item in response_tags:
            if 'tags' in item and item['tags']:
                all_tags.extend(item['tags'])
        
        unique_tags = list(set(all_tags))
        session.add_log(f"Tags uniques collectés: {unique_tags}")
        
        # Étape 3: Normalisation des tags
        session.update_step("tag-normalization")
        session.add_log("Normalisation des tags extraits")
        
        # Normaliser les tags avec Mistral
        normalized_tags = normalize_tags_with_mistral(unique_tags, session)
        session.add_log(f"Tags normalisés: {normalized_tags}")
        
        # Réattribuer les tags normalisés aux réponses
        normalized_response_tags = reassign_normalized_tags(response_tags, normalized_tags, session)
        session.add_log("Tags normalisés réattribués aux réponses")
        
        # Étape 4: Génération des synthèses
        session.update_step("synthesis-generation")
        session.add_log("Génération des synthèses par tag normalisé")
        
        # Générer les synthèses avec Mistral
        tag_summaries = generate_tag_summaries_with_mistral(normalized_response_tags, responses, session)
        session.add_log("Synthèses générées")
        
        # Préparer les résultats
        results = {
            'results': [],
            'tag_mapping': normalized_tags,
            'tag_summaries': tag_summaries
        }
        
        # Préparer les résultats détaillés pour chaque réponse
        for i, response in enumerate(responses):
            if i < len(normalized_response_tags):
                item = normalized_response_tags[i]
                result_item = {
                    'response_id': item.get('response_id', i + 1),
                    'response': response,
                    'tags': item.get('original_tags', []),
                    'normalized_tags': item.get('normalized_tags', [])
                }
                results['results'].append(result_item)
                session.add_log(f"Préparation de la réponse {i+1}/{len(responses)}: {response[:30]}...")
        
        session.add_log(f"Préparation terminée pour {len(results['results'])} réponses")
        
        # Définir les résultats et marquer la session comme terminée
        session.set_results(results)
    
    except Exception as e:
        logger.error(f"Erreur lors de l'analyse: {str(e)}")
        session.update_status("error", str(e))

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000) 