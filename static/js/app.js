// Application JavaScript pour l'Analyseur de Réponses Ouvertes

document.addEventListener('DOMContentLoaded', function() {
    // Initialisation du stepper
    const stepper = new Stepper(document.querySelector('#workflow-stepper'), {
        linear: false,
        animation: true
    });

    // Éléments DOM
    const uploadForm = document.getElementById('uploadForm');
    const fileInput = document.getElementById('file');
    const fileInfo = document.getElementById('fileInfo');
    const rowCount = document.getElementById('rowCount');
    const columnList = document.getElementById('columnList');
    const columnSelectContainer = document.getElementById('columnSelectContainer');
    const columnSelect = document.getElementById('columnSelect');
    const processBtn = document.getElementById('processBtn');
    const exportCsvBtn = document.getElementById('exportCsvBtn');
    const exportJsonBtn = document.getElementById('exportJsonBtn');
    const exportCsvBtnMain = document.getElementById('exportCsvBtnMain');
    const exportJsonBtnMain = document.getElementById('exportJsonBtnMain');
    const exportPanel = document.getElementById('export-panel');
    
    // Éléments du workflow
    const prevTabBtns = document.querySelectorAll('.prev-tab-btn');
    const nextTabBtns = document.querySelectorAll('.next-tab-btn');
    
    // Onglets de résultats
    const resultTabs = document.getElementById('resultTabs');
    const loadingAnalysis = document.getElementById('loadingAnalysis');
    const analyzeContent = document.getElementById('analyzeContent');
    const noAnalysisContent = document.getElementById('noAnalysisContent');
    const loadingTags = document.getElementById('loadingTags');
    const loadingSummaries = document.getElementById('loadingSummaries');
    const tagsContent = document.getElementById('tagsContent');
    const summariesContent = document.getElementById('summariesContent');
    const dataContent = document.getElementById('dataContent');
    const noTagsContent = document.getElementById('noTagsContent');
    const noSummariesContent = document.getElementById('noSummariesContent');
    const noDataContent = document.getElementById('noDataContent');
    
    // Éléments pour les synthèses
    const tagSelector = document.getElementById('tagSelector');
    const tagSummaryContainer = document.getElementById('tagSummaryContainer');
    const currentTagName = document.getElementById('currentTagName');
    const tagSummaryContent = document.getElementById('tagSummaryContent');
    const tagResponsesList = document.getElementById('tagResponsesList');
    
    // Éléments pour le test Mistral
    const mistralTestForm = document.getElementById('mistralTestForm');
    const mistralResponseText = document.getElementById('mistralResponseText');
    const mistralCustomPrompt = document.getElementById('mistralCustomPrompt');
    const mistralResultsCard = document.getElementById('mistralResultsCard');
    const mistralOriginalResponse = document.getElementById('mistralOriginalResponse');
    const mistralAnalysisResult = document.getElementById('mistralAnalysisResult');
    const mistralModelUsed = document.getElementById('mistralModelUsed');
    
    // Éléments pour le modal de configuration
    const configForm = document.getElementById('configForm');
    const modelSelect = document.getElementById('model');
    const apiKeyInput = document.getElementById('apiKey');
    const endpointInput = document.getElementById('endpoint');
    const saveConfigBtn = document.getElementById('saveConfigBtn');
    
    // Variables globales
    let analysisResults = null;
    let currentColumnName = 'response';
    let tagsChart = null;
    let currentTabIndex = 0;
    const tabOrder = ['importTab', 'analyzeTab', 'tagsTab', 'summariesTab', 'dataTab', 'exportTab'];
    
    // Fonction pour naviguer entre les onglets
    function navigateToTab(tabId) {
        // Activer l'onglet correspondant
        const tabElement = document.getElementById(tabId);
        const tabLink = document.querySelector(`a[href="#${tabId}"]`);
        
        if (tabElement && tabLink) {
            const tabInstance = new bootstrap.Tab(tabLink);
            tabInstance.show();
            
            // Mettre à jour l'index de l'onglet actuel
            currentTabIndex = tabOrder.indexOf(tabId);
            
            // Mettre à jour le stepper
            updateStepper(tabId);
        }
    }
    
    // Fonction pour mettre à jour le stepper en fonction de l'onglet actif
    function updateStepper(tabId) {
        let stepIndex = 0;
        
        switch (tabId) {
            case 'importTab':
                stepIndex = 0;
                break;
            case 'analyzeTab':
                stepIndex = 1;
                break;
            case 'tagsTab':
                stepIndex = 2;
                break;
            case 'summariesTab':
                stepIndex = 3;
                break;
            case 'dataTab':
                stepIndex = 4;
                break;
            case 'exportTab':
                stepIndex = 5;
                break;
            default:
                // Ne pas modifier le stepper pour les onglets hors workflow
                return;
        }
        
        stepper.to(stepIndex);
    }
    
    // Gestion des boutons de navigation
    prevTabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            if (currentTabIndex > 0) {
                navigateToTab(tabOrder[currentTabIndex - 1]);
            }
        });
    });
    
    nextTabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            if (currentTabIndex < tabOrder.length - 1) {
                navigateToTab(tabOrder[currentTabIndex + 1]);
            }
        });
    });
    
    // Écouter les changements d'onglet pour mettre à jour le stepper
    resultTabs.addEventListener('shown.bs.tab', function(e) {
        const tabId = e.target.getAttribute('href').substring(1);
        updateStepper(tabId);
    });
    
    // Gestion du formulaire d'upload
    uploadForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        if (!fileInput.files[0]) {
            showAlert('Veuillez sélectionner un fichier', 'danger');
            return;
        }
        
        const formData = new FormData();
        formData.append('file', fileInput.files[0]);
        
        // Afficher un indicateur de chargement
        showLoading('Importation en cours...');
        
        // Envoyer le fichier au serveur
        fetch('/api/upload', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            hideLoading();
            
            if (data.success) {
                // Mettre à jour les informations du fichier
                rowCount.textContent = data.rows;
                columnList.textContent = data.columns.join(', ');
                
                // Remplir la liste déroulante des colonnes
                columnSelect.innerHTML = '';
                data.columns.forEach(column => {
                    const option = document.createElement('option');
                    option.value = column;
                    option.textContent = column;
                    
                    // Sélectionner par défaut la colonne "response" si elle existe
                    if (column.toLowerCase() === 'response' || column.toLowerCase() === 'réponse') {
                        option.selected = true;
                        currentColumnName = column;
                    }
                    
                    columnSelect.appendChild(option);
                });
                
                // Afficher les éléments d'information et le bouton de traitement
                fileInfo.classList.remove('d-none');
                
                if (data.columns.length > 1) {
                    columnSelectContainer.classList.remove('d-none');
                } else {
                    columnSelectContainer.classList.add('d-none');
                }
                
                // Passer à l'onglet d'analyse (étape 2)
                navigateToTab('analyzeTab');
                
                // Afficher une notification de succès
                showAlert('Fichier importé avec succès', 'success');
            } else {
                showAlert(data.error || 'Erreur lors de l\'importation du fichier', 'danger');
            }
        })
        .catch(error => {
            hideLoading();
            console.error('Erreur:', error);
            showAlert('Une erreur est survenue lors de l\'importation', 'danger');
        });
    });
    
    // Mise à jour de la colonne à analyser
    columnSelect.addEventListener('change', function() {
        currentColumnName = this.value;
    });
    
    // Traitement des données
    processBtn.addEventListener('click', function() {
        // Afficher l'indicateur de chargement
        loadingAnalysis.classList.remove('d-none');
        analyzeContent.classList.add('d-none');
        noAnalysisContent.classList.add('d-none');
        
        loadingTags.classList.remove('d-none');
        tagsContent.classList.add('d-none');
        noTagsContent.classList.add('d-none');
        
        // Passer à l'onglet d'analyse
        navigateToTab('analyzeTab');
        
        // Appel API pour traiter les données
        fetch('/api/process', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                column: currentColumnName
            })
        })
        .then(response => response.json())
        .then(data => {
            // Masquer les indicateurs de chargement
            loadingAnalysis.classList.add('d-none');
            loadingTags.classList.add('d-none');
            
            if (data.success) {
                // Sauvegarder les résultats
                analysisResults = data.results;
                
                // Afficher les résultats dans les différents onglets
                updateTagsVisualization(data.results);
                updateSummariesSection(data.results);
                updateDataTable(data.results.data, data.results.normalized_tags);
                
                // Activer les boutons d'exportation
                exportCsvBtn.disabled = false;
                exportJsonBtn.disabled = false;
                exportCsvBtnMain.disabled = false;
                exportJsonBtnMain.disabled = false;
                exportPanel.classList.remove('d-none');
                
                // Afficher le contenu des onglets
                analyzeContent.classList.remove('d-none');
                
                // Montrer l'onglet d'analyse
                showAlert('Analyse terminée avec succès', 'success');
            } else {
                // Afficher l'erreur
                noAnalysisContent.classList.remove('d-none');
                noTagsContent.classList.remove('d-none');
                showAlert(data.error || 'Erreur lors de l\'analyse des données', 'danger');
            }
        })
        .catch(error => {
            // Masquer les indicateurs de chargement
            loadingAnalysis.classList.add('d-none');
            loadingTags.classList.add('d-none');
            
            // Afficher l'erreur
            noAnalysisContent.classList.remove('d-none');
            noTagsContent.classList.remove('d-none');
            
            console.error('Erreur:', error);
            showAlert('Une erreur est survenue lors de l\'analyse', 'danger');
        });
    });
    
    // Exportation en CSV
    exportCsvBtn.addEventListener('click', exportCsv);
    exportCsvBtnMain.addEventListener('click', exportCsv);
    
    function exportCsv() {
        if (!analysisResults) {
            showAlert('Aucune donnée à exporter', 'warning');
            return;
        }
        
        fetch('/api/export/csv', {
            method: 'GET'
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Erreur lors de l\'exportation');
            }
            return response.blob();
        })
        .then(blob => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = 'analyse_reponses.csv';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            
            showAlert('Données exportées en CSV avec succès', 'success');
        })
        .catch(error => {
            console.error('Erreur:', error);
            showAlert('Une erreur est survenue lors de l\'exportation en CSV', 'danger');
        });
    }
    
    // Exportation en JSON
    exportJsonBtn.addEventListener('click', exportJson);
    exportJsonBtnMain.addEventListener('click', exportJson);
    
    function exportJson() {
        if (!analysisResults) {
            showAlert('Aucune donnée à exporter', 'warning');
            return;
        }
        
        fetch('/api/export/json', {
            method: 'GET'
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Erreur lors de l\'exportation');
            }
            return response.blob();
        })
        .then(blob => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = 'analyse_reponses.json';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            
            showAlert('Données exportées en JSON avec succès', 'success');
        })
        .catch(error => {
            console.error('Erreur:', error);
            showAlert('Une erreur est survenue lors de l\'exportation en JSON', 'danger');
        });
    }

    // Formulaire de test Mistral
    mistralTestForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const responseText = mistralResponseText.value;
        const customPrompt = mistralCustomPrompt.value;
        
        if (!responseText.trim()) {
            showAlert('Veuillez saisir une réponse à analyser', 'warning');
            return;
        }
        
        try {
            // Afficher un indicateur de chargement
            const submitBtn = this.querySelector('button[type="submit"]');
            submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Analyse en cours...';
            submitBtn.disabled = true;
            
            // Appel API
            const response = await fetch('/analyze_response', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    response_text: responseText,
                    custom_prompt: customPrompt || null
                })
            });
            
            if (!response.ok) {
                throw new Error('Erreur lors de l\'analyse');
            }
            
            const data = await response.json();
            
            // Afficher les résultats
            mistralOriginalResponse.textContent = data.original_response;
            
            // Formater et afficher l'analyse
            if (typeof data.analysis === 'object') {
                mistralAnalysisResult.innerHTML = '<pre style="white-space: pre-wrap;">' + JSON.stringify(data.analysis, null, 2) + '</pre>';
            } else {
                mistralAnalysisResult.innerHTML = formatText(data.analysis);
            }
            
            mistralModelUsed.textContent = data.model_used;
            mistralResultsCard.classList.remove('d-none');
            
            // Réinitialiser le bouton
            submitBtn.innerHTML = '<i class="bi bi-robot me-2"></i>Analyser avec Mistral';
            submitBtn.disabled = false;
            
        } catch (error) {
            console.error('Erreur:', error);
            showAlert('Une erreur est survenue: ' + error.message, 'danger');
            
            // Réinitialiser le bouton
            const submitBtn = this.querySelector('button[type="submit"]');
            submitBtn.innerHTML = '<i class="bi bi-robot me-2"></i>Analyser avec Mistral';
            submitBtn.disabled = false;
        }
    });
    
    // Gestion du modal de configuration
    saveConfigBtn.addEventListener('click', function() {
        const config = {
            model: modelSelect.value,
            api_key: apiKeyInput.value,
            endpoint: endpointInput.value
        };
        
        fetch('/api/config', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(config)
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Fermer le modal
                const modal = bootstrap.Modal.getInstance(document.getElementById('configModal'));
                modal.hide();
                
                showAlert('Configuration Mistral AI enregistrée avec succès', 'success');
            } else {
                showAlert(data.error || 'Erreur lors de l\'enregistrement de la configuration', 'danger');
            }
        })
        .catch(error => {
            console.error('Erreur:', error);
            showAlert('Une erreur est survenue lors de l\'enregistrement de la configuration', 'danger');
        });
    });
    
    // Fonctions d'affichage et mise à jour des visualisations
    
    // Gestion des alertes
    function showAlert(message, type) {
        // Suppression des anciennes alertes
        const oldAlerts = document.querySelectorAll('.alert-floating');
        oldAlerts.forEach(alert => alert.remove());
        
        // Création d'une nouvelle alerte
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} alert-dismissible alert-floating fade show`;
        alertDiv.role = 'alert';
        
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;
        
        // Ajout au corps de la page
        document.body.appendChild(alertDiv);
        
        // Disparition automatique après 5 secondes
        setTimeout(() => {
            if (alertDiv.parentNode) {
                const alert = bootstrap.Alert.getOrCreateInstance(alertDiv);
                alert.close();
            }
        }, 5000);
    }
    
    // Affichage d'un indicateur de chargement
    function showLoading(message) {
        // Création d'un div pour l'indicateur de chargement
        const loadingDiv = document.createElement('div');
        loadingDiv.id = 'loadingIndicator';
        loadingDiv.className = 'loading-overlay';
        
        loadingDiv.innerHTML = `
            <div class="loading-spinner">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Chargement...</span>
                </div>
                <p class="mt-2">${message || 'Chargement...'}</p>
            </div>
        `;
        
        // Ajout au corps de la page
        document.body.appendChild(loadingDiv);
    }
    
    // Suppression de l'indicateur de chargement
    function hideLoading() {
        const loadingDiv = document.getElementById('loadingIndicator');
        if (loadingDiv) {
            loadingDiv.remove();
        }
    }
    
    // Mise à jour de la visualisation des tags
    function updateTagsVisualization(results) {
        if (!results || !results.normalized_tags) {
            noTagsContent.classList.remove('d-none');
            return;
        }
        
        // Créer ou mettre à jour le graphique des tags
        createTagsChart(results);
        
        // Afficher la liste des tags normalisés
        displayNormalizedTags(results.normalized_tags);
        
        // Afficher le contenu des tags
        tagsContent.classList.remove('d-none');
    }
    
    // Création du graphique des tags
    function createTagsChart(results) {
        // Préparation des données pour le graphique
        const tags = Object.keys(results.tag_counts);
        const counts = Object.values(results.tag_counts);
        
        // Couleurs pour le graphique
        const backgroundColors = tags.map((_, i) => {
            const hue = (i * 137.5) % 360; // Distribution des couleurs
            return `hsl(${hue}, 70%, 60%)`;
        });
        
        // Destruction du graphique précédent s'il existe
        if (tagsChart) {
            tagsChart.destroy();
        }
        
        // Création du nouveau graphique
        const ctx = document.getElementById('tagsChart').getContext('2d');
        tagsChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: tags,
                datasets: [{
                    label: 'Nombre de réponses',
                    data: counts,
                    backgroundColor: backgroundColors,
                    borderColor: backgroundColors.map(color => color.replace('60%', '50%')),
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.raw} réponse(s)`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            precision: 0
                        }
                    }
                }
            }
        });
    }
    
    // Affichage des tags normalisés
    function displayNormalizedTags(normalizedTags) {
        const normalizedTagsList = document.getElementById('normalizedTagsList');
        normalizedTagsList.innerHTML = '';
        
        Object.entries(normalizedTags).forEach(([tag, info]) => {
            const tagItem = document.createElement('a');
            tagItem.href = '#';
            tagItem.className = 'list-group-item list-group-item-action d-flex justify-content-between align-items-center';
            tagItem.dataset.tag = tag;
            
            // Nom du tag
            const tagName = document.createElement('span');
            tagName.textContent = tag;
            
            // Badge avec le nombre d'occurrences
            const badge = document.createElement('span');
            badge.className = 'badge bg-primary rounded-pill';
            badge.textContent = info.count;
            
            // Assembler l'élément
            tagItem.appendChild(tagName);
            tagItem.appendChild(badge);
            
            // Ajouter à la liste
            normalizedTagsList.appendChild(tagItem);
            
            // Ajouter un événement de clic
            tagItem.addEventListener('click', function(e) {
                e.preventDefault();
                // Sélectionner ce tag dans l'onglet des synthèses
                document.querySelector(`a[href="#summariesTab"]`).click();
                tagSelector.value = tag;
                tagSelector.dispatchEvent(new Event('change'));
            });
        });
    }
    
    // Mise à jour de la section des synthèses
    function updateSummariesSection(results) {
        if (!results || !results.normalized_tags || !results.summaries) {
            noSummariesContent.classList.remove('d-none');
            return;
        }
        
        // Remplir le sélecteur de tags
        tagSelector.innerHTML = '<option value="">Sélectionnez un tag...</option>';
        Object.keys(results.normalized_tags).forEach(tag => {
            const option = document.createElement('option');
            option.value = tag;
            option.textContent = tag;
            tagSelector.appendChild(option);
        });
        
        // Événement de changement de tag
        tagSelector.addEventListener('change', function() {
            const selectedTag = this.value;
            
            if (selectedTag) {
                // Afficher la synthèse et les réponses pour ce tag
                currentTagName.textContent = selectedTag;
                
                // Afficher la synthèse
                if (results.summaries[selectedTag]) {
                    tagSummaryContent.innerHTML = formatText(results.summaries[selectedTag]);
                } else {
                    tagSummaryContent.innerHTML = '<em>Aucune synthèse disponible pour ce tag</em>';
                }
                
                // Afficher les réponses associées à ce tag
                const responses = results.normalized_tags[selectedTag].responses || [];
                displayTagResponses(selectedTag, responses);
                
                // Afficher le conteneur de synthèse
                tagSummaryContainer.classList.remove('d-none');
            } else {
                // Masquer le conteneur de synthèse
                tagSummaryContainer.classList.add('d-none');
            }
        });
        
        // Afficher le contenu des synthèses
        summariesContent.classList.remove('d-none');
    }
    
    // Affichage des réponses pour un tag
    function displayTagResponses(tag, responses) {
        tagResponsesList.innerHTML = '';
        
        if (!responses || responses.length === 0) {
            const emptyItem = document.createElement('div');
            emptyItem.className = 'list-group-item text-muted';
            emptyItem.textContent = 'Aucune réponse associée à ce tag';
            tagResponsesList.appendChild(emptyItem);
            return;
        }
        
        // Limiter à 10 réponses pour éviter une liste trop longue
        const displayResponses = responses.slice(0, 10);
        
        displayResponses.forEach((response, index) => {
            const responseItem = document.createElement('div');
            responseItem.className = 'list-group-item';
            
            const responseText = document.createElement('p');
            responseText.className = 'mb-1';
            responseText.innerHTML = formatText(response);
            
            responseItem.appendChild(responseText);
            tagResponsesList.appendChild(responseItem);
        });
        
        // Ajouter un message si on a tronqué les réponses
        if (responses.length > 10) {
            const moreItem = document.createElement('div');
            moreItem.className = 'list-group-item text-muted text-center';
            moreItem.textContent = `... et ${responses.length - 10} autres réponses`;
            tagResponsesList.appendChild(moreItem);
        }
    }
    
    // Mise à jour du tableau de données avec les tags
    function updateDataTableWithTags(results) {
        if (!results || !results.data) {
            noDataContent.classList.remove('d-none');
            return;
        }
        
        // Mettre à jour le tableau avec les données et les tags associés
        updateDataTable(results.data, results.normalized_tags);
        
        // Afficher le contenu des données
        dataContent.classList.remove('d-none');
    }
    
    // Mise à jour du tableau de données
    function updateDataTable(data, responseTags) {
        const tableBody = document.querySelector('#dataTable tbody');
        tableBody.innerHTML = '';
        
        if (!data || data.length === 0) {
            noDataContent.classList.remove('d-none');
            return;
        }
        
        // Création des lignes du tableau
        data.forEach((item, index) => {
            const row = document.createElement('tr');
            
            // Colonne de numéro
            const indexCell = document.createElement('td');
            indexCell.textContent = index + 1;
            row.appendChild(indexCell);
            
            // Colonne de réponse
            const responseCell = document.createElement('td');
            responseCell.innerHTML = formatText(item.response);
            row.appendChild(responseCell);
            
            // Colonne de tags
            const tagsCell = document.createElement('td');
            
            // Recherche des tags associés à cette réponse
            const tags = [];
            Object.entries(responseTags).forEach(([tag, info]) => {
                if (info.responses && info.responses.includes(item.response)) {
                    tags.push(tag);
                }
            });
            
            // Affichage des tags sous forme de badges
            if (tags.length > 0) {
                tags.forEach(tag => {
                    const badge = document.createElement('span');
                    badge.className = 'badge bg-primary me-1 mb-1';
                    badge.textContent = tag;
                    tagsCell.appendChild(badge);
                });
            } else {
                tagsCell.textContent = '-';
            }
            
            row.appendChild(tagsCell);
            
            // Ajout de la ligne au tableau
            tableBody.appendChild(row);
        });
    }
    
    // Formater le texte pour l'affichage
    function formatText(text) {
        if (!text) return '';
        
        // Échapper les caractères HTML spéciaux
        const escaped = escapeHtml(text);
        
        // Convertir les sauts de ligne en balises <br>
        return escaped.replace(/\n/g, '<br>');
    }
    
    // Échapper les caractères HTML
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // Initialisation
    function init() {
        // Vérifier s'il y a des données de session
        fetch('/api/session', {
            method: 'GET'
        })
        .then(response => response.json())
        .then(data => {
            if (data.has_session) {
                // Charger les données de session
                analysisResults = data.results;
                
                // Mettre à jour les visualisations
                if (analysisResults) {
                    updateTagsVisualization(analysisResults);
                    updateSummariesSection(analysisResults);
                    updateDataTableWithTags(analysisResults);
                    
                    // Activer les boutons d'exportation
                    exportCsvBtn.disabled = false;
                    exportJsonBtn.disabled = false;
                    exportCsvBtnMain.disabled = false;
                    exportJsonBtnMain.disabled = false;
                    exportPanel.classList.remove('d-none');
                }
            }
        })
        .catch(error => {
            console.error('Erreur lors du chargement de la session:', error);
        });
    }
    
    // Lancer l'initialisation
    init();
});

// Ajouter des styles CSS pour l'interface
document.head.insertAdjacentHTML('beforeend', `
<style>
    /* Styles pour le stepper */
    .bs-stepper .line {
        min-height: 24px;
        margin: 0 1rem;
        position: relative;
    }
    
    .bs-stepper .line::before {
        position: absolute;
        content: '';
        width: 2px;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.1);
        left: 50%;
        transform: translateX(-50%);
    }
    
    .bs-stepper .step {
        cursor: pointer;
        margin-bottom: 1rem;
    }
    
    .bs-stepper-circle {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 2rem;
        height: 2rem;
        border-radius: 50%;
        background-color: rgba(0, 0, 0, 0.1);
        color: #495057;
        margin-right: 0.5rem;
    }
    
    .bs-stepper .active .bs-stepper-circle {
        background-color: #0d6efd;
        color: white;
    }
    
    .bs-stepper-label {
        font-weight: 500;
    }
    
    /* Styles pour les alertes flottantes */
    .alert-floating {
        position: fixed;
        top: 20px;
        right: 20px;
        max-width: 350px;
        z-index: 9999;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
    }
    
    /* Overlay de chargement */
    .loading-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 9998;
    }
    
    .loading-spinner {
        background-color: white;
        padding: 2rem;
        border-radius: 8px;
        text-align: center;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }
</style>
`); 