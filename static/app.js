// Application JavaScript pour l'Analyseur de Réponses Ouvertes

// Fonction globale pour afficher les résultats
function displayResults(data) {
    if (!data.success || !data.results || !data.results.length) {
        showAlert('Aucun résultat à afficher', 'warning');
        return;
    }

    // Afficher les résultats dans l'onglet "Données"
    const dataContent = document.getElementById('dataContent');
    if (!dataContent) {
        console.error("Élément dataContent non trouvé");
        showAlert("Erreur lors de l'affichage des résultats: élément dataContent non trouvé", "danger");
        return;
    }
    
    dataContent.innerHTML = `
        <div class="table-responsive">
            <table class="table table-striped">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Réponse</th>
                        <th>Analyse</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.results.map(result => `
                        <tr>
                            <td>${result.id}</td>
                            <td>${escapeHtml(result.response)}</td>
                            <td>${formatAnalysis(result.analysis)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;

    // Masquer le message "pas de données"
    const noDataContent = document.querySelector('#data .text-center.text-muted.py-5');
    if (noDataContent) {
        noDataContent.style.display = 'none';
    }

    // Activer les boutons d'exportation
    const exportCsvBtn = document.getElementById('exportCsvBtn');
    const exportJsonBtn = document.getElementById('exportJsonBtn');
    
    if (exportCsvBtn) exportCsvBtn.disabled = false;
    if (exportJsonBtn) exportJsonBtn.disabled = false;
    
    // Basculer vers l'onglet "Données"
    const dataTab = document.getElementById('data-tab');
    if (dataTab) {
        const tabInstance = new bootstrap.Tab(dataTab);
        tabInstance.show();
    }
}

// Fonction globale pour afficher les alertes
function showAlert(message, type) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.querySelector('.container-fluid').insertBefore(alertDiv, document.querySelector('.row'));
    
    // Auto-dismiss après 5 secondes
    setTimeout(() => {
        alertDiv.remove();
    }, 5000);
}

// Fonction globale pour formater le JSON
function formatJSON(obj) {
    const jsonString = JSON.stringify(obj, null, 2);
    return jsonString.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
        let cls = 'json-string';
        if (/^"/.test(match)) {
            if (/:$/.test(match)) {
                cls = 'json-key';
            }
        } else if (/true|false/.test(match)) {
            cls = 'json-boolean';
        } else if (/null/.test(match)) {
            cls = 'json-null';
        } else {
            cls = 'json-number';
        }
        return '<span class="' + cls + '">' + match + '</span>';
    });
}

// Fonction globale pour échapper le HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Fonction globale pour le test avec données d'exemple
function testWorkflow() {
    console.log("Fonction testWorkflow appelée");
    
    // Récupérer le bouton de test
    const testBtn = document.getElementById('testBtn');
    
    if (!testBtn) {
        console.error("Bouton de test non trouvé");
        showAlert("Erreur: Bouton de test non trouvé", "danger");
        return;
    }
    
    // Afficher le spinner sur le bouton de test
    const spinner = document.createElement('span');
    spinner.className = 'spinner-border spinner-border-sm me-2';
    spinner.setAttribute('role', 'status');
    spinner.setAttribute('aria-hidden', 'true');
    
    const originalContent = testBtn.innerHTML;
    testBtn.innerHTML = '';
    testBtn.appendChild(spinner);
    testBtn.appendChild(document.createTextNode('Test en cours...'));
    testBtn.disabled = true;
    
    // Désactiver le bouton d'analyse si présent
    const analyzeBtn = document.getElementById('analyzeBtn');
    if (analyzeBtn) analyzeBtn.disabled = true;

    // Envoyer la requête au serveur
    fetch('/test_workflow', {
        method: 'POST'
    })
    .then(response => {
        console.log("Réponse reçue:", response.status);
        if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status}`);
        }
        return response.json();
    })
    .then(result => {
        console.log("Données reçues:", result);
        if (result.error) {
            throw new Error(result.error);
        }
        
        try {
            displayResults(result);
            showAlert(`Test effectué avec succès ! ${result.results.length} réponses analysées.`, 'success');
        } catch (err) {
            console.error("Erreur lors de l'affichage des résultats:", err);
            showAlert("Les données ont été reçues mais une erreur s'est produite lors de leur affichage.", "warning");
        }
    })
    .catch(error => {
        console.error("Erreur:", error);
        showAlert(`Erreur lors du test: ${error.message}`, 'danger');
    })
    .finally(() => {
        // Restaurer le bouton
        if (testBtn) {
            testBtn.innerHTML = originalContent;
            testBtn.disabled = false;
        }
        
        // Réactiver le bouton d'analyse si présent
        if (analyzeBtn) {
            const fileInput = document.getElementById('file');
            if (fileInput) {
                analyzeBtn.disabled = fileInput.files.length === 0;
            }
        }
    });
}

// Fonction pour formater l'analyse en texte structuré lisible
function formatAnalysis(analysis) {
    // Si l'analyse est une chaîne ou null, la retourner telle quelle
    if (typeof analysis !== 'object' || analysis === null) {
        return analysis || 'Aucune analyse disponible';
    }
    
    // Si une erreur s'est produite
    if (analysis.error) {
        return `Erreur: ${analysis.error}`;
    }
    
    // Si l'analyse est en texte brut
    if (analysis.raw_analysis) {
        return analysis.raw_analysis;
    }
    
    // Construire un texte structuré à partir des champs communs
    let formattedText = '';
    
    // Résumé
    if (analysis.résumé || analysis.resume || analysis.summary) {
        formattedText += `<strong>Résumé:</strong> ${analysis.résumé || analysis.resume || analysis.summary}<br><br>`;
    }
    
    // Catégorisation
    if (analysis.catégorisation || analysis.categorisation || analysis.categories || analysis.category) {
        const categories = analysis.catégorisation || analysis.categorisation || analysis.categories || analysis.category;
        if (typeof categories === 'string') {
            formattedText += `<strong>Catégories:</strong> ${categories}<br><br>`;
        } else if (Array.isArray(categories)) {
            formattedText += `<strong>Catégories:</strong> ${categories.join(', ')}<br><br>`;
        }
    }
    
    // Niveau de satisfaction
    if (analysis.satisfaction || analysis['niveau_de_satisfaction'] || analysis['satisfaction_level']) {
        formattedText += `<strong>Niveau de satisfaction:</strong> ${analysis.satisfaction || analysis['niveau_de_satisfaction'] || analysis['satisfaction_level']}/5<br><br>`;
    }
    
    // Priorité
    if (analysis.priorité || analysis.priorite || analysis.priority) {
        formattedText += `<strong>Priorité:</strong> ${analysis.priorité || analysis.priorite || analysis.priority}<br><br>`;
    }
    
    // Suggestions
    if (analysis.suggestions || analysis.améliorations || analysis.ameliorations || analysis.improvements) {
        const suggestions = analysis.suggestions || analysis.améliorations || analysis.ameliorations || analysis.improvements;
        formattedText += `<strong>Suggestions:</strong><br>`;
        
        if (typeof suggestions === 'string') {
            formattedText += suggestions;
        } else if (Array.isArray(suggestions)) {
            formattedText += '<ul>';
            suggestions.forEach(suggestion => {
                formattedText += `<li>${suggestion}</li>`;
            });
            formattedText += '</ul>';
        }
    }
    
    // Si aucun champ standard n'a été trouvé, afficher le JSON formaté
    if (!formattedText) {
        return formatJSON(analysis);
    }
    
    return formattedText;
}

document.addEventListener('DOMContentLoaded', function() {
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
    const analyzeBtn = document.getElementById('analyzeBtn');
    const testBtn = document.getElementById('testBtn');
    
    // Éléments pour l'analyse individuelle
    const responseForm = document.getElementById('responseForm');
    const responseText = document.getElementById('responseText');
    const singlePrompt = document.getElementById('singlePrompt');
    const singleResultCard = document.getElementById('singleResultCard');
    const originalResponse = document.getElementById('originalResponse');
    const analysisResult = document.getElementById('analysisResult');
    
    console.log("Initialisation des éléments DOM");
    console.log("Bouton de test trouvé:", testBtn);

    if (!testBtn) {
        console.error("Le bouton de test n'a pas été trouvé dans le DOM");
        return;
    }

    // Onglets de résultats
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
    
    // Éléments pour le modal de configuration
    const configForm = document.getElementById('configForm');
    const providerSelect = document.getElementById('provider');
    const modelInput = document.getElementById('model');
    const apiKeyInput = document.getElementById('apiKey');
    const endpointInput = document.getElementById('endpoint');
    const saveConfigBtn = document.getElementById('saveConfigBtn');
    
    // Variables globales
    let analysisResults = null;
    let currentColumnName = 'response';
    let tagsChart = null;
    
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
                
                // Affecter les événements après le chargement
                columnSelect.addEventListener('change', function() {
                    currentColumnName = this.value;
                });
                
                // Afficher l'aperçu dans l'onglet Données
                updateDataTable(data.preview, null);
                dataContent.classList.remove('d-none');
                noDataContent.classList.add('d-none');
                
                showAlert(`Fichier importé avec succès: ${data.rows} lignes`, 'success');
            } else {
                showAlert(`Erreur lors de l'importation: ${data.error}`, 'danger');
            }
        })
        .catch(error => {
            hideLoading();
            showAlert(`Erreur lors de l'importation: ${error.message}`, 'danger');
        });
    });
    
    // Traitement des données
    processBtn.addEventListener('click', function() {
        if (!currentColumnName) {
            showAlert('Veuillez sélectionner une colonne à analyser', 'warning');
            return;
        }
        
        // Afficher les indicateurs de chargement
        showLoading('Analyse en cours...');
        loadingTags.classList.remove('d-none');
        tagsContent.classList.add('d-none');
        noTagsContent.classList.add('d-none');
        loadingSummaries.classList.remove('d-none');
        summariesContent.classList.add('d-none');
        noSummariesContent.classList.add('d-none');
        
        // Désactiver les boutons d'exportation pendant le traitement
        exportCsvBtn.disabled = true;
        exportJsonBtn.disabled = true;
        
        // Appeler l'API pour le traitement
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
            hideLoading();
            loadingTags.classList.add('d-none');
            loadingSummaries.classList.add('d-none');
            
            if (data.success) {
                // Stocker les résultats
                analysisResults = data.results;
                
                // Mettre à jour les visualisations
                updateTagsVisualization(analysisResults);
                updateSummariesSection(analysisResults);
                updateDataTableWithTags(analysisResults);
                
                // Activer les boutons d'exportation
                exportCsvBtn.disabled = false;
                exportJsonBtn.disabled = false;
                
                showAlert('Analyse terminée avec succès', 'success');
            } else {
                showAlert(`Erreur lors de l'analyse: ${data.error}`, 'danger');
                
                // Afficher les messages "aucun contenu"
                noTagsContent.classList.remove('d-none');
                noSummariesContent.classList.remove('d-none');
            }
        })
        .catch(error => {
            hideLoading();
            loadingTags.classList.add('d-none');
            loadingSummaries.classList.add('d-none');
            
            showAlert(`Erreur lors de l'analyse: ${error.message}`, 'danger');
            
            // Afficher les messages "aucun contenu"
            noTagsContent.classList.remove('d-none');
            noSummariesContent.classList.remove('d-none');
        });
    });
    
    // Exportation des résultats
    exportCsvBtn.addEventListener('click', function() {
        if (!analysisResults) {
            showAlert('Aucun résultat à exporter. Veuillez d\'abord analyser les données.', 'warning');
            return;
        }
        
        window.location.href = '/api/export/csv';
    });
    
    exportJsonBtn.addEventListener('click', function() {
        if (!analysisResults) {
            showAlert('Aucun résultat à exporter. Veuillez d\'abord analyser les données.', 'warning');
            return;
        }
        
        window.location.href = '/api/export/json';
    });
    
    // Sélection d'un tag pour afficher sa synthèse
    tagSelector.addEventListener('change', function() {
        const selectedTag = this.value;
        
        if (!selectedTag) {
            tagSummaryContainer.classList.add('d-none');
            return;
        }
        
        if (!analysisResults || !analysisResults.summaries[selectedTag]) {
            showAlert('Données de synthèse non disponibles pour ce tag', 'warning');
            return;
        }
        
        // Afficher la synthèse du tag sélectionné
        currentTagName.textContent = selectedTag;
        tagSummaryContent.innerHTML = formatAnalysis(analysisResults.summaries[selectedTag]);
        
        // Afficher les réponses associées à ce tag
        displayTagResponses(selectedTag, analysisResults.tag_groups[selectedTag]);
        
        tagSummaryContainer.classList.remove('d-none');
    });
    
    // Sauvegarde de la configuration
    saveConfigBtn.addEventListener('click', function() {
        const config = {
            provider: providerSelect.value,
            model: modelInput.value,
            api_key: apiKeyInput.value,
            endpoint: endpointInput.value
        };
        
        // Envoyer la configuration au serveur
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
                showAlert('Configuration enregistrée avec succès', 'success');
                // Fermer le modal
                bootstrap.Modal.getInstance(document.getElementById('configModal')).hide();
            } else {
                showAlert(`Erreur lors de la sauvegarde: ${data.error}`, 'danger');
            }
        })
        .catch(error => {
            showAlert(`Erreur lors de la sauvegarde: ${error.message}`, 'danger');
        });
    });
    
    // Gestion du bouton de test
    console.log("Ajout de l'événement click sur le bouton de test");
    if (testBtn) {
        console.log("Le bouton de test existe, ajout de l'événement click");
        testBtn.addEventListener('click', async function() {
            console.log("Clic sur le bouton de test (addEventListener)");
            
            // Afficher une modal pour tester si le clic est bien reçu
            alert("Le bouton a été cliqué!");
            
            // Afficher le spinner sur le bouton de test
            const spinner = document.createElement('span');
            spinner.className = 'spinner-border spinner-border-sm me-2';
            spinner.setAttribute('role', 'status');
            spinner.setAttribute('aria-hidden', 'true');
            
            const originalContent = this.innerHTML;
            this.innerHTML = '';
            this.appendChild(spinner);
            this.appendChild(document.createTextNode('Test en cours...'));
            this.disabled = true;
            analyzeBtn.disabled = true;

            // Afficher un message de chargement plus informatif
            showLoading("Analyse des données d'exemple en cours...");

            try {
                console.log("Envoi de la requête test_workflow");
                const response = await fetch('/test_workflow', {
                    method: 'POST'
                });

                console.log("Réponse reçue du serveur:", response.status);
                
                if (!response.ok) {
                    throw new Error(`Erreur HTTP: ${response.status}`);
                }

                const result = await response.json();
                console.log("Données JSON reçues:", result);
                
                if (result.error) {
                    throw new Error(result.error);
                }
                
                // Masquer le message de chargement
                hideLoading();
                
                displayResults(result);
                showAlert(`Test effectué avec succès ! ${result.results.length} réponses analysées.`, 'success');
            } catch (error) {
                console.error('Erreur détaillée:', error);
                // Masquer le message de chargement en cas d'erreur
                hideLoading();
                showAlert(`Erreur lors du test: ${error.message}`, 'danger');
            } finally {
                // Restaurer le bouton
                this.innerHTML = originalContent;
                this.disabled = false;
                analyzeBtn.disabled = fileInput.files.length === 0;
            }
        });
    } else {
        console.error("Le bouton de test n'a pas été trouvé dans le DOM lors de l'ajout de l'événement");
    }
    
    // Supprimer l'ancien gestionnaire d'événements onclick s'il existe
    testBtn.onclick = null;
    
    // Gestion du formulaire d'analyse individuelle
    if (responseForm) {
        responseForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            // Vérifier que le texte n'est pas vide
            if (!responseText.value.trim()) {
                showAlert('Veuillez saisir une réponse à analyser', 'warning');
                return;
            }
            
            // Afficher le spinner sur le bouton
            const submitBtn = this.querySelector('button[type="submit"]');
            const spinner = submitBtn.querySelector('.spinner-border');
            const originalBtnText = submitBtn.innerHTML;
            
            spinner.classList.remove('d-none');
            submitBtn.disabled = true;
            
            try {
                // Envoyer la requête au serveur
                const response = await fetch('/analyze_single', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        text: responseText.value,
                        prompt: singlePrompt.value
                    })
                });
                
                if (!response.ok) {
                    throw new Error(`Erreur HTTP: ${response.status}`);
                }
                
                const result = await response.json();
                
                if (result.error) {
                    throw new Error(result.error);
                }
                
                // Afficher les résultats
                originalResponse.textContent = responseText.value;
                analysisResult.innerHTML = formatAnalysis(result.analysis);
                singleResultCard.classList.remove('d-none');
                
                // Faire défiler jusqu'aux résultats
                singleResultCard.scrollIntoView({ behavior: 'smooth' });
                
            } catch (error) {
                console.error('Erreur:', error);
                showAlert(`Erreur lors de l'analyse: ${error.message}`, 'danger');
                singleResultCard.classList.add('d-none');
            } finally {
                // Restaurer le bouton
                spinner.classList.add('d-none');
                submitBtn.disabled = false;
            }
        });
    }
    
    // Fonctions utilitaires
    
    // Affichage d'un indicateur de chargement global
    function showLoading(message) {
        // Créer l'élément de chargement
        const loadingElement = document.createElement('div');
        loadingElement.id = 'globalLoading';
        loadingElement.className = 'position-fixed top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center';
        loadingElement.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        loadingElement.style.zIndex = '9999';
        
        // Ajouter le contenu
        loadingElement.innerHTML = `
            <div class="bg-white p-4 rounded shadow">
                <div class="d-flex justify-content-center">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Chargement...</span>
                    </div>
                </div>
                <p class="text-center mt-2">${message}</p>
            </div>
        `;
        
        // Ajouter à la page
        document.body.appendChild(loadingElement);
    }
    
    // Masquer l'indicateur de chargement global
    function hideLoading() {
        const loadingElement = document.getElementById('globalLoading');
        if (loadingElement) {
            loadingElement.parentNode.removeChild(loadingElement);
        }
    }
    
    // Mise à jour de la visualisation des tags
    function updateTagsVisualization(results) {
        if (!results || !results.normalized_tags || Object.keys(results.normalized_tags).length === 0) {
            noTagsContent.classList.remove('d-none');
            return;
        }
        
        // Créer le graphique de distribution des tags
        createTagsChart(results);
        
        // Afficher la liste des tags normalisés
        displayNormalizedTags(results.normalized_tags);
        
        // Afficher la section des tags
        tagsContent.classList.remove('d-none');
        noTagsContent.classList.add('d-none');
    }
    
    // Création du graphique de distribution des tags
    function createTagsChart(results) {
        // Compter les occurrences de chaque tag
        const tagCounts = {};
        for (const tag in results.tag_groups) {
            tagCounts[tag] = results.tag_groups[tag].length;
        }
        
        // Trier les tags par nombre d'occurrences (décroissant)
        const sortedTags = Object.keys(tagCounts).sort((a, b) => tagCounts[b] - tagCounts[a]);
        
        // Limiter à 10 tags maximum pour la lisibilité
        const topTags = sortedTags.slice(0, 10);
        
        // Préparer les données pour le graphique
        const labels = topTags;
        const data = topTags.map(tag => tagCounts[tag]);
        
        // Créer ou mettre à jour le graphique
        const ctx = document.getElementById('tagsChart').getContext('2d');
        
        if (tagsChart) {
            tagsChart.destroy();
        }
        
        tagsChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Nombre de réponses',
                    data: data,
                    backgroundColor: 'rgba(54, 162, 235, 0.7)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                indexAxis: 'y',
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: {
                            precision: 0
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            title: function(tooltipItems) {
                                return tooltipItems[0].label;
                            },
                            label: function(context) {
                                return `${context.parsed.x} réponses`;
                            }
                        }
                    }
                }
            }
        });
    }
    
    // Affichage de la liste des tags normalisés
    function displayNormalizedTags(normalizedTags) {
        const normalizedTagsList = document.getElementById('normalizedTagsList');
        normalizedTagsList.innerHTML = '';
        
        // Créer une entrée pour chaque tag normalisé
        for (const normalizedTag in normalizedTags) {
            const originalTags = normalizedTags[normalizedTag];
            
            const tagItem = document.createElement('div');
            tagItem.className = 'list-group-item tag-item';
            tagItem.innerHTML = `
                <div>
                    <strong>${normalizedTag}</strong>
                    <p class="text-muted mb-0 small">
                        <em>Inclut: ${originalTags.join(', ')}</em>
                    </p>
                </div>
            `;
            
            normalizedTagsList.appendChild(tagItem);
        }
    }
    
    // Mise à jour de la section des synthèses
    function updateSummariesSection(results) {
        if (!results || !results.summaries || Object.keys(results.summaries).length === 0) {
            noSummariesContent.classList.remove('d-none');
            return;
        }
        
        // Remplir le sélecteur de tags
        tagSelector.innerHTML = '<option value="">Sélectionnez un tag...</option>';
        
        // Ajouter les options pour chaque tag (triés par nombre de réponses)
        const tagCounts = {};
        for (const tag in results.tag_groups) {
            tagCounts[tag] = results.tag_groups[tag].length;
        }
        
        const sortedTags = Object.keys(tagCounts).sort((a, b) => tagCounts[b] - tagCounts[a]);
        
        sortedTags.forEach(tag => {
            const option = document.createElement('option');
            option.value = tag;
            option.textContent = `${tag} (${tagCounts[tag]} réponses)`;
            tagSelector.appendChild(option);
        });
        
        // Afficher la section des synthèses
        summariesContent.classList.remove('d-none');
        noSummariesContent.classList.add('d-none');
    }
    
    // Affichage des réponses associées à un tag
    function displayTagResponses(tag, responses) {
        tagResponsesList.innerHTML = '';
        
        if (!responses || responses.length === 0) {
            tagResponsesList.innerHTML = '<p class="text-muted">Aucune réponse associée à ce tag</p>';
            return;
        }
        
        // Limiter à 50 réponses maximum pour des raisons de performance
        const displayResponses = responses.slice(0, 50);
        
        // Créer une entrée pour chaque réponse
        displayResponses.forEach((item, index) => {
            const responseItem = document.createElement('div');
            responseItem.className = 'response-item';
            responseItem.innerHTML = `
                <p class="mb-0"><strong>#${item.index + 1}:</strong> ${escapeHtml(item.response)}</p>
            `;
            
            tagResponsesList.appendChild(responseItem);
        });
        
        if (responses.length > 50) {
            const moreResponses = document.createElement('p');
            moreResponses.className = 'text-muted text-center mt-2';
            moreResponses.textContent = `... et ${responses.length - 50} réponses supplémentaires`;
            tagResponsesList.appendChild(moreResponses);
        }
    }
    
    // Mise à jour du tableau de données avec les tags
    function updateDataTableWithTags(results) {
        if (!results || !results.response_tags) {
            return;
        }
        
        // Créer un mapping des réponses aux tags
        const responseTags = {};
        results.response_tags.forEach(item => {
            responseTags[item.index] = item.tags;
        });
        
        // Récupérer les données depuis le serveur (tout récharger)
        fetch('/api/upload', {
            method: 'POST',
            body: new FormData(uploadForm)
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                updateDataTable(data.preview, responseTags);
            }
        })
        .catch(error => {
            console.error('Erreur lors de la récupération des données:', error);
        });
    }
    
    // Mise à jour du tableau de données
    function updateDataTable(data, responseTags) {
        const dataTable = document.getElementById('dataTable').getElementsByTagName('tbody')[0];
        dataTable.innerHTML = '';
        
        if (!data || data.length === 0) {
            noDataContent.classList.remove('d-none');
            dataContent.classList.add('d-none');
            return;
        }
        
        // Créer une ligne pour chaque réponse
        data.forEach((item, index) => {
            const row = document.createElement('tr');
            
            // Déterminer la colonne à afficher
            const responseText = item[currentColumnName] || '';
            
            // Déterminer les tags associés
            const tags = responseTags && responseTags[index] ? responseTags[index] : [];
            
            row.innerHTML = `
                <td>${index + 1}</td>
                <td>${escapeHtml(responseText)}</td>
                <td>${tags.map(tag => `<span class="badge bg-info me-1">${tag}</span>`).join('')}</td>
            `;
            
            dataTable.appendChild(row);
        });
        
        dataContent.classList.remove('d-none');
        noDataContent.classList.add('d-none');
    }
    
    // Formatter le texte (convertir les sauts de ligne en HTML)
    function formatText(text) {
        if (!text) return '';
        
        // Convertir les sauts de ligne en balises <br>
        return text.replace(/\n/g, '<br>');
    }
    
    // Initialisation
    function init() {
        // Afficher les sections "aucun contenu" par défaut
        noTagsContent.classList.remove('d-none');
        noSummariesContent.classList.remove('d-none');
        noDataContent.classList.remove('d-none');
    }
    
    // Lancer l'initialisation
    init();
}); 