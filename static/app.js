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
                        <th>Tags Originaux</th>
                        <th>Tags Normalisés</th>
                        <th>Analyse</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.results.map(result => `
                        <tr>
                            <td>${result.id}</td>
                            <td>${escapeHtml(result.response)}</td>
                            <td>${formatTags(result.original_tags || [])}</td>
                            <td>${formatTags(result.normalized_tags || [], 'bg-success')}</td>
                            <td>${formatAnalysis(result.analysis)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        
        <div class="text-center mt-4">
            <button class="btn btn-success" onclick="showSynthesisTab()">
                <i class="bi bi-journal-text me-2"></i>Voir les synthèses
            </button>
        </div>
    `;

    // Masquer le message "pas de données"
    const noDataContent = document.querySelector('#data .text-center.text-muted.py-5');
    if (noDataContent) {
        noDataContent.style.display = 'none';
    }

    // Afficher les tags dans l'onglet "Tags"
    displayTagsFromResults(data.results, data.tag_mapping, data.tag_summaries);
    
    // Afficher les synthèses dans l'onglet "Synthèses"
    displaySynthesesFromResults(data.tag_summaries);

    // Activer les boutons d'exportation
    const exportCsvBtn = document.getElementById('exportCsvBtn');
    const exportJsonBtn = document.getElementById('exportJsonBtn');
    
    if (exportCsvBtn) exportCsvBtn.disabled = false;
    if (exportJsonBtn) exportJsonBtn.disabled = false;
    
    // Basculer vers l'onglet "Synthèses" si des synthèses sont disponibles
    if (data.tag_summaries && Object.keys(data.tag_summaries).length > 0) {
        showSynthesisTab();
    } else {
        // Sinon, basculer vers l'onglet "Données"
        const dataTab = document.getElementById('data-tab');
        if (dataTab) {
            const tabInstance = new bootstrap.Tab(dataTab);
            tabInstance.show();
        }
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
async function testWorkflow() {
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
    }
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

// Fonction pour formater les tags
function formatTags(tags, bgClass = 'bg-primary') {
    if (!tags || tags.length === 0) {
        return '<span class="text-muted">Aucun tag</span>';
    }
    
    return tags.map(tag => 
        `<span class="badge ${bgClass} me-1">${escapeHtml(tag)}</span>`
    ).join(' ');
}

// Fonction pour formater les synthèses des tags
function formatTagSummaries(tagSummaries) {
    if (!tagSummaries || Object.keys(tagSummaries).length === 0) {
        return '<span class="text-muted">Aucune synthèse disponible</span>';
    }
    
    let html = '<div class="tag-summaries">';
    
    for (const [tag, summary] of Object.entries(tagSummaries)) {
        html += `
            <div class="card mb-2">
                <div class="card-header py-1 bg-light">
                    <span class="badge bg-success">${escapeHtml(tag)}</span>
                    <span class="badge bg-secondary ms-1">${summary.nombre_utilisateurs} utilisateur(s)</span>
                </div>
                <div class="card-body py-2">
                    <p class="mb-1"><small>${escapeHtml(summary.synthèse)}</small></p>
                    ${summary.verbatims && summary.verbatims.length > 0 ? 
                        `<div class="verbatims">
                            <small class="text-muted">Verbatims:</small>
                            <ul class="mb-0">
                                ${summary.verbatims.map(verbatim => 
                                    `<li><small><em>"${escapeHtml(verbatim)}"</em></small></li>`
                                ).join('')}
                            </ul>
                        </div>` : 
                        ''
                    }
                </div>
            </div>
        `;
    }
    
    html += '</div>';
    return html;
}

// Fonction pour afficher les tags extraits dans l'onglet "Tags"
function displayTagsFromResults(results, tagMapping = null, tagSummaries = null) {
    const tagsContent = document.getElementById('tagsContent');
    if (!tagsContent) {
        console.error("Élément tagsContent non trouvé");
        return;
    }
    
    // Collecter tous les tags uniques (originaux et normalisés)
    const originalTags = {};
    const normalizedTags = {};
    
    results.forEach(result => {
        // Traiter les tags originaux
        if (result.original_tags && result.original_tags.length > 0) {
            result.original_tags.forEach(tag => {
                if (!originalTags[tag]) {
                    originalTags[tag] = 0;
                }
                originalTags[tag]++;
            });
        }
        
        // Traiter les tags normalisés
        if (result.normalized_tags && result.normalized_tags.length > 0) {
            result.normalized_tags.forEach(tag => {
                if (!normalizedTags[tag]) {
                    normalizedTags[tag] = 0;
                }
                normalizedTags[tag]++;
            });
        }
    });
    
    // Si aucun tag n'a été trouvé
    if (Object.keys(originalTags).length === 0 && Object.keys(normalizedTags).length === 0) {
        const noTagsContent = document.getElementById('noTagsContent');
        if (noTagsContent) {
            noTagsContent.classList.remove('d-none');
        }
        return;
    }
    
    // Masquer le message "pas de tags"
    const noTagsContent = document.getElementById('noTagsContent');
    if (noTagsContent) {
        noTagsContent.classList.add('d-none');
    }
    
    // Trier les tags par fréquence (décroissant)
    const sortedOriginalTags = Object.keys(originalTags).sort((a, b) => originalTags[b] - originalTags[a]);
    const sortedNormalizedTags = Object.keys(normalizedTags).sort((a, b) => normalizedTags[b] - normalizedTags[a]);
    
    // Construire le contenu HTML
    let html = '';
    
    // Afficher le mapping des tags si disponible
    if (tagMapping && Object.keys(tagMapping).length > 0) {
        html += `
            <div class="card mb-4">
                <div class="card-header bg-white">
                    <h5 class="card-title mb-0">Normalisation des Tags</h5>
                </div>
                <div class="card-body">
                    <p class="card-text">Voici comment les tags ont été normalisés :</p>
                    <div class="table-responsive">
                        <table class="table table-sm">
                            <thead>
                                <tr>
                                    <th>Tag Normalisé</th>
                                    <th>Tags Originaux</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${Object.entries(tagMapping).map(([normalized, originals]) => `
                                    <tr>
                                        <td><span class="badge bg-success">${escapeHtml(normalized)}</span></td>
                                        <td>${originals.map(tag => `<span class="badge bg-primary me-1">${escapeHtml(tag)}</span>`).join(' ')}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Afficher les tags normalisés
    html += `
        <div class="card mb-4">
            <div class="card-header bg-white">
                <h5 class="card-title mb-0">Tags Normalisés</h5>
            </div>
            <div class="card-body">
                <div class="d-flex flex-wrap gap-2">
                    ${sortedNormalizedTags.map(tag => 
                        `<div class="badge bg-success fs-6 p-2">
                            ${escapeHtml(tag)} 
                            <span class="badge bg-light text-dark ms-1">${normalizedTags[tag]}</span>
                        </div>`
                    ).join('')}
                </div>
            </div>
        </div>
    `;
    
    // Afficher les tags originaux
    html += `
        <div class="card">
            <div class="card-header bg-white">
                <h5 class="card-title mb-0">Tags Originaux</h5>
            </div>
            <div class="card-body">
                <div class="d-flex flex-wrap gap-2">
                    ${sortedOriginalTags.map(tag => 
                        `<div class="badge bg-primary fs-6 p-2">
                            ${escapeHtml(tag)} 
                            <span class="badge bg-light text-dark ms-1">${originalTags[tag]}</span>
                        </div>`
                    ).join('')}
                </div>
            </div>
        </div>
    `;
    
    tagsContent.innerHTML = html;
}

// Fonction pour afficher les synthèses dans l'onglet dédié
function displaySynthesesFromResults(tagSummaries) {
    const synthesisContent = document.getElementById('synthesisContent');
    if (!synthesisContent) {
        console.error("Élément synthesisContent non trouvé");
        return;
    }
    
    // Si aucune synthèse n'est disponible
    if (!tagSummaries || Object.keys(tagSummaries).length === 0) {
        synthesisContent.innerHTML = `
            <div class="text-center text-muted py-5">
                <i class="bi bi-exclamation-circle fs-1"></i>
                <p class="mt-3">Aucune synthèse disponible</p>
            </div>
        `;
        return;
    }
    
    // Masquer le message "pas de synthèses"
    const noSynthesisContent = document.getElementById('noSummariesContent');
    if (noSynthesisContent) {
        noSynthesisContent.classList.add('d-none');
    }
    
    // Trier les tags par nombre d'utilisateurs (décroissant)
    const sortedTags = Object.keys(tagSummaries).sort((a, b) => 
        tagSummaries[b].nombre_utilisateurs - tagSummaries[a].nombre_utilisateurs
    );
    
    // Construire le contenu HTML
    let html = `
        <div class="row">
            <div class="col-md-12 mb-4">
                <div class="card">
                    <div class="card-header bg-white">
                        <h5 class="card-title mb-0">Résumé des retours utilisateurs</h5>
                    </div>
                    <div class="card-body">
                        <p class="card-text">
                            Voici une synthèse des retours utilisateurs regroupés par thématique.
                            Chaque synthèse inclut le nombre d'utilisateurs concernés et des verbatims représentatifs.
                        </p>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="row">
            ${sortedTags.map(tag => {
                const summary = tagSummaries[tag];
                return `
                    <div class="col-md-6 mb-4">
                        <div class="card h-100">
                            <div class="card-header py-2 bg-light">
                                <div class="d-flex justify-content-between align-items-center">
                                    <span class="badge bg-success fs-5 p-2">${escapeHtml(tag)}</span>
                                    <span class="badge bg-secondary">${summary.nombre_utilisateurs} utilisateur(s)</span>
                                </div>
                            </div>
                            <div class="card-body">
                                <p class="card-text">${escapeHtml(summary.synthèse)}</p>
                                ${summary.verbatims && summary.verbatims.length > 0 ? 
                                    `<div class="verbatims mt-3">
                                        <h6 class="text-muted">Verbatims:</h6>
                                        <ul class="list-group list-group-flush">
                                            ${summary.verbatims.map(verbatim => 
                                                `<li class="list-group-item bg-light fst-italic">"${escapeHtml(verbatim)}"</li>`
                                            ).join('')}
                                        </ul>
                                    </div>` : 
                                    ''
                                }
                            </div>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
    
    synthesisContent.innerHTML = html;
}

// Fonction pour basculer vers l'onglet "Synthèses"
function showSynthesisTab() {
    const synthesisTab = document.getElementById('synthesis-tab');
    if (synthesisTab) {
        const tabInstance = new bootstrap.Tab(synthesisTab);
        tabInstance.show();
    }
}

document.addEventListener('DOMContentLoaded', function() {
    // Fonction utilitaire pour vérifier si un élément existe
    function getElement(id) {
        const element = document.getElementById(id);
        return element;
    }

    // Éléments DOM
    const uploadForm = getElement('uploadForm');
    const fileInput = getElement('file');
    const fileInfo = getElement('fileInfo');
    const rowCount = getElement('rowCount');
    const columnList = getElement('columnList');
    const columnSelectContainer = getElement('columnSelectContainer');
    const columnSelect = getElement('columnSelect');
    const processBtn = getElement('processBtn');
    const exportCsvBtn = getElement('exportCsvBtn');
    const exportJsonBtn = getElement('exportJsonBtn');
    const analyzeBtn = getElement('analyzeBtn');
    const testBtn = getElement('testBtn');
    
    // Éléments pour l'analyse individuelle
    const responseForm = getElement('responseForm');
    const responseText = getElement('responseText');
    const singlePrompt = getElement('singlePrompt');
    const singleResultCard = getElement('singleResultCard');
    const originalResponse = getElement('originalResponse');
    const analysisResult = getElement('analysisResult');
    
    console.log("Initialisation des éléments DOM");
    console.log("Bouton de test trouvé:", testBtn);

    if (!testBtn) {
        console.error("Le bouton de test n'a pas été trouvé dans le DOM");
        return;
    }

    // Onglets de résultats
    const loadingTags = getElement('loadingTags');
    const loadingSummaries = getElement('loadingSummaries');
    const tagsContent = getElement('tagsContent');
    const summariesContent = getElement('summariesContent');
    const dataContent = getElement('dataContent');
    const noTagsContent = getElement('noTagsContent');
    const noSummariesContent = getElement('noSummariesContent');
    const noDataContent = getElement('noDataContent');
    
    // Éléments pour les synthèses
    const tagSelector = getElement('tagSelector');
    const tagSummaryContainer = getElement('tagSummaryContainer');
    const currentTagName = getElement('currentTagName');
    const tagSummaryContent = getElement('tagSummaryContent');
    const tagResponsesList = getElement('tagResponsesList');
    
    // Éléments pour le modal de configuration
    const configForm = getElement('configForm');
    const providerSelect = getElement('provider');
    const modelInput = getElement('model');
    const apiKeyInput = getElement('apiKey');
    const endpointInput = getElement('endpoint');
    const saveConfigBtn = getElement('saveConfigBtn');
    
    // Variables globales
    let analysisResults = null;
    let currentColumnName = 'response';
    let tagsChart = null;
    
    // Gestion du formulaire d'upload
    if (uploadForm) {
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
                    
                    // Gestion du changement de colonne
                    if (columnSelect) {
                        columnSelect.addEventListener('change', function() {
                            currentColumnName = this.value;
                            console.log(`Colonne sélectionnée: ${currentColumnName}`);
                            
                            // Activer le bouton de traitement
                            if (processBtn) {
                                processBtn.disabled = false;
                            }
                        });
                    }
                    
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
    }
    
    // Traitement des données
    if (processBtn) {
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
    }
    
    // Exportation des résultats
    if (exportCsvBtn) {
        exportCsvBtn.addEventListener('click', function() {
            if (!analysisResults || analysisResults.length === 0) {
                showAlert('Aucun résultat à exporter. Veuillez d\'abord analyser les données.', 'warning');
                return;
            }
            
            window.location.href = '/api/export/csv';
        });
    }
    
    if (exportJsonBtn) {
        exportJsonBtn.addEventListener('click', function() {
            if (!analysisResults || analysisResults.length === 0) {
                showAlert('Aucun résultat à exporter. Veuillez d\'abord analyser les données.', 'warning');
                return;
            }
            
            window.location.href = '/api/export/json';
        });
    }
    
    // Sélection d'un tag pour afficher sa synthèse
    if (tagSelector) {
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
    }
    
    // Sauvegarde de la configuration
    if (saveConfigBtn) {
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
    }
    
    // Gestion du bouton de test
    if (testBtn) {
        testBtn.addEventListener('click', async function() {
            showLoading('Test en cours...');
            
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
    }
    
    // Supprimer l'ancien gestionnaire d'événements onclick s'il existe
    testBtn.onclick = null;
    
    // Gestion du formulaire d'analyse individuelle
    if (responseForm) {
        responseForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const responseTextValue = responseText ? responseText.value.trim() : '';
            if (!responseTextValue) {
                showAlert('Veuillez saisir une réponse à analyser', 'warning');
                return;
            }
            
            // Afficher l'indicateur de chargement
            showLoading('Analyse en cours...');
            
            // Récupérer le prompt personnalisé s'il existe
            const customPrompt = singlePrompt ? singlePrompt.value.trim() : '';
            
            try {
                // Appeler l'API pour l'analyse
                const response = await fetch('/api/analyze_single', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        response: responseTextValue,
                        custom_prompt: customPrompt
                    })
                });
                
                const data = await response.json();
                hideLoading();
                
                if (data.success) {
                    // Afficher le résultat
                    if (originalResponse) originalResponse.textContent = responseTextValue;
                    if (analysisResult) analysisResult.innerHTML = formatJSON(data.analysis);
                    if (singleResultCard) singleResultCard.classList.remove('d-none');
                    
                    showAlert('Analyse terminée avec succès', 'success');
                } else {
                    showAlert(`Erreur lors de l'analyse: ${data.error}`, 'danger');
                }
            } catch (error) {
                hideLoading();
                showAlert(`Erreur lors de l'analyse: ${error.message}`, 'danger');
            }
        });
    }
    
    // Fonctions utilitaires
    
    // Affichage d'un indicateur de chargement global
    function showLoading(message) {
        const loadingElement = getElement('globalLoading');
        if (loadingElement) {
            const loadingText = loadingElement.querySelector('.loading-text');
            if (loadingText) {
                loadingText.textContent = message || 'Chargement en cours...';
            }
            loadingElement.classList.remove('d-none');
        }
    }
    
    // Masquer l'indicateur de chargement global
    function hideLoading() {
        const loadingElement = getElement('globalLoading');
        if (loadingElement) {
            loadingElement.classList.add('d-none');
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
        // Vérifier si l'élément canvas existe
        const chartCanvas = getElement('tagsChart');
        if (!chartCanvas) {
            console.error("Élément tagsChart non trouvé");
            return;
        }
        
        const ctx = chartCanvas.getContext('2d');
        
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
        const normalizedTagsList = getElement('normalizedTagsList');
        if (!normalizedTagsList) {
            console.error("Élément normalizedTagsList non trouvé");
            return;
        }
        
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
        const dataTable = getElement('dataTable');
        if (!dataTable) {
            console.error("Élément dataTable non trouvé");
            return;
        }
        
        const tbody = dataTable.getElementsByTagName('tbody')[0];
        if (!tbody) {
            console.error("Élément tbody non trouvé dans dataTable");
            return;
        }
        
        tbody.innerHTML = '';
        
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
            
            tbody.appendChild(row);
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
        if (noTagsContent) noTagsContent.classList.remove('d-none');
        if (noSummariesContent) noSummariesContent.classList.remove('d-none');
        if (noDataContent) noDataContent.classList.remove('d-none');
        
        // Créer l'élément de chargement global s'il n'existe pas
        if (!getElement('globalLoading')) {
            const loadingElement = document.createElement('div');
            loadingElement.id = 'globalLoading';
            loadingElement.className = 'position-fixed top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center d-none';
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
                    <p class="text-center mt-2 loading-text">Chargement en cours...</p>
                </div>
            `;
            
            // Ajouter à la page
            document.body.appendChild(loadingElement);
        }
    }
    
    // Lancer l'initialisation
    init();
}); 