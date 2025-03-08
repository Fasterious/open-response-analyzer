// Application JavaScript pour l'Analyseur de Réponses Ouvertes

// Fonction utilitaire pour récupérer un élément par son ID
function getElement(id) {
    const element = document.getElementById(id);
    if (!element) console.warn(`Élément avec l'ID ${id} non trouvé`);
    return element;
}

// Afficher l'indicateur de chargement global
function showLoading(message) {
    // Créer ou récupérer l'élément de chargement global
    let loadingElement = getElement('globalLoading');
    if (!loadingElement) {
        loadingElement = createGlobalLoadingElement();
    }
    
    // Mettre à jour le message et afficher
    const messageElement = loadingElement.querySelector('.loading-message');
    if (messageElement) messageElement.textContent = message || 'Chargement en cours...';
    
    loadingElement.classList.remove('d-none');
}

// Masquer l'indicateur de chargement global
function hideLoading() {
    const loadingElement = getElement('globalLoading');
    if (loadingElement) {
        loadingElement.classList.add('d-none');
    }
}

// Créer l'élément de chargement global
function createGlobalLoadingElement() {
    // Créer l'élément de chargement s'il n'existe pas
    const loadingElement = document.createElement('div');
    loadingElement.id = 'globalLoading';
    loadingElement.className = 'position-fixed top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center bg-white bg-opacity-75';
    loadingElement.style.zIndex = '9999';
    
    const loadingContent = document.createElement('div');
    loadingContent.className = 'text-center p-4 bg-white rounded shadow';
    
    const spinner = document.createElement('div');
    spinner.className = 'spinner-border text-primary mb-3';
    spinner.setAttribute('role', 'status');
    
    const spinnerText = document.createElement('span');
    spinnerText.className = 'visually-hidden';
    spinnerText.textContent = 'Chargement...';
    
    const message = document.createElement('div');
    message.className = 'loading-message';
    message.textContent = 'Chargement en cours...';
    
    spinner.appendChild(spinnerText);
    loadingContent.appendChild(spinner);
    loadingContent.appendChild(message);
    loadingElement.appendChild(loadingContent);
    
    // Ajouter au document
    document.body.appendChild(loadingElement);
    
    // Cacher par défaut
    loadingElement.classList.add('d-none');
    
    return loadingElement;
}

// Créer l'élément de chargement global au chargement de la page
document.addEventListener('DOMContentLoaded', createGlobalLoadingElement);

// Fonction pour afficher les résultats
function displayResults(data) {
    console.log("Affichage des résultats:", data);
    
    if (!data || !data.results || !Array.isArray(data.results)) {
        console.error("Format de données invalide:", data);
        showAlert("Format de données invalide", "danger");
        return;
    }
    
    // Afficher les tags
    displayTagsFromResults(data.results, data.tag_mapping, data.tag_summaries);
    
    // Afficher les synthèses
    if (data.tag_summaries) {
        displaySynthesesFromResults(data.tag_summaries);
    }
    
    // Afficher les données brutes
    const dataTable = getElement('dataTable');
    if (dataTable) {
        const tbody = dataTable.querySelector('tbody');
        if (tbody) {
            tbody.innerHTML = '';
            
            data.results.forEach(item => {
                const row = document.createElement('tr');
                
                // ID
                const idCell = document.createElement('td');
                idCell.textContent = item.id;
                row.appendChild(idCell);
                
                // Réponse
                const responseCell = document.createElement('td');
                responseCell.textContent = item.response;
                row.appendChild(responseCell);
                
                // Tags originaux (colonne séparée)
                const originalTagsCell = document.createElement('td');
                if (item.original_tags && item.original_tags.length > 0) {
                    originalTagsCell.innerHTML = formatTags(item.original_tags, 'bg-secondary');
                } else {
                    originalTagsCell.innerHTML = '<span class="text-muted">Aucun tag</span>';
                }
                row.appendChild(originalTagsCell);
                
                // Tags normalisés (colonne séparée)
                const normalizedTagsCell = document.createElement('td');
                if (item.normalized_tags && item.normalized_tags.length > 0) {
                    normalizedTagsCell.innerHTML = formatTags(item.normalized_tags, 'bg-primary');
                } else {
                    normalizedTagsCell.innerHTML = '<span class="text-muted">Aucun tag</span>';
                }
                row.appendChild(normalizedTagsCell);
                
                tbody.appendChild(row);
            });
        }
        
        // Masquer le message "pas de données" et afficher le tableau
        const noDataContent = getElement('noDataContent');
        if (noDataContent) noDataContent.style.display = 'none';
        dataTable.style.display = 'table';
    }
}

// Fonction pour afficher une alerte
function showAlert(message, type = 'info') {
    // Créer l'élément d'alerte
    const alertElement = document.createElement('div');
    alertElement.className = `alert alert-${type} alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3`;
    alertElement.style.zIndex = '9999';
    alertElement.style.maxWidth = '80%';
    
    // Ajouter le contenu de l'alerte
    alertElement.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Fermer"></button>
    `;
    
    // Ajouter au document
    document.body.appendChild(alertElement);
    
    // Supprimer automatiquement après 5 secondes
    setTimeout(() => {
        alertElement.classList.remove('show');
        setTimeout(() => alertElement.remove(), 150);
    }, 5000);
}

// Fonction pour formater un objet JSON en chaîne lisible
function formatJSON(obj) {
    return JSON.stringify(obj, null, 2);
}

// Fonction pour échapper les caractères HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Fonction pour tester le workflow avec les données d'exemple
async function testWorkflow() {
    console.log("Test du workflow avec les données d'exemple");
    
    // Récupérer le bouton de test
    const testBtn = getElement('testBtn');
    if (testBtn) {
        // Sauvegarder le contenu original
        const originalContent = testBtn.innerHTML;
        
        // Afficher le spinner
        testBtn.innerHTML = `
            <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
            Test en cours...
        `;
        testBtn.disabled = true;
    }
    
    // Afficher les indicateurs de chargement
    getElement('noTagsContent').style.display = 'none';
    getElement('loadingTags').classList.remove('d-none');
    
    getElement('noSummariesContent').style.display = 'none';
    getElement('loadingSummaries').classList.remove('d-none');
    
    // Afficher un message de chargement global
    showLoading("Test du workflow avec les données d'exemple...");
    
    try {
        // Appeler l'API pour tester le workflow
        const response = await fetch('/test_workflow', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        console.log("Données reçues:", data);
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        // Masquer les indicateurs de chargement
        getElement('loadingTags').classList.add('d-none');
        getElement('loadingSummaries').classList.add('d-none');
        
        // Masquer le message de chargement global
        hideLoading();
        
        // Afficher les résultats
        displayResults(data);
        
        // Afficher un message de succès
        showAlert("Test effectué avec succès !", "success");
        
        // Activer l'onglet de synthèse
        showSynthesisTab();
    } catch (error) {
        console.error("Erreur lors du test:", error);
        
        // Masquer les indicateurs de chargement
        getElement('loadingTags').classList.add('d-none');
        getElement('loadingSummaries').classList.add('d-none');
        getElement('noTagsContent').style.display = 'block';
        getElement('noSummariesContent').style.display = 'block';
        
        // Masquer le message de chargement global
        hideLoading();
        
        // Afficher un message d'erreur
        showAlert(`Erreur lors du test: ${error.message}`, "danger");
    } finally {
        // Restaurer le bouton de test
        const testBtn = getElement('testBtn');
        if (testBtn) {
            testBtn.innerHTML = `
                <i class="bi bi-lightning-fill me-2"></i>
                Tester avec données d'exemple
            `;
            testBtn.disabled = false;
        }
    }
}

// Fonction pour formater les tags
function formatTags(tags, bgClass = 'bg-primary') {
    if (!tags || tags.length === 0) return '';
    return tags.map(tag => `<span class="badge ${bgClass} me-1">${tag}</span>`).join(' ');
}

// Fonction pour formater les synthèses de tags
function formatTagSummaries(tagSummaries) {
    if (!tagSummaries || Object.keys(tagSummaries).length === 0) {
        return '<div class="text-muted">Aucune synthèse disponible</div>';
    }
    
    let html = '';
    
    for (const [tag, summary] of Object.entries(tagSummaries)) {
        html += `
            <div class="card mb-3">
                <div class="card-header bg-white">
                    <h5 class="card-title mb-0">
                        <span class="badge bg-primary me-2">${tag}</span>
                        <small class="text-muted">${summary.nombre_utilisateurs || 0} utilisateurs</small>
                    </h5>
                </div>
                <div class="card-body">
                    <p>${summary.synthèse || 'Aucune synthèse disponible'}</p>
                    
                    ${summary.verbatims && summary.verbatims.length > 0 ? `
                        <div class="mt-3">
                            <h6>Verbatims:</h6>
                            <ul class="list-group">
                                ${summary.verbatims.map(verbatim => `
                                    <li class="list-group-item">
                                        <i class="bi bi-quote me-2 text-muted"></i>
                                        ${verbatim}
                                    </li>
                                `).join('')}
                            </ul>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }
    
    return html;
}

// Fonction pour afficher les tags à partir des résultats
function displayTagsFromResults(results, tagMapping = null, tagSummaries = null) {
    console.log("Affichage des tags à partir des résultats:", results);
    console.log("Mapping des tags:", tagMapping);
    
    // Récupérer le conteneur des tags
    const tagsContent = getElement('tagsContent');
    if (!tagsContent) {
        console.error("Conteneur des tags non trouvé");
        return;
    }
    
    // Masquer le message "pas de tags"
    const noTagsContent = getElement('noTagsContent');
    if (noTagsContent) noTagsContent.style.display = 'none';
    
    // Collecter tous les tags normalisés et leur fréquence
    const tagFrequency = {};
    let totalResponses = 0;
    
    results.forEach(item => {
        totalResponses++;
        if (item.normalized_tags && Array.isArray(item.normalized_tags)) {
            item.normalized_tags.forEach(tag => {
                tagFrequency[tag] = (tagFrequency[tag] || 0) + 1;
            });
        }
    });
    
    // Trier les tags par fréquence (du plus fréquent au moins fréquent)
    const sortedTags = Object.entries(tagFrequency)
        .sort((a, b) => b[1] - a[1])
        .map(([tag, count]) => ({ tag, count }));
    
    // Calculer les pourcentages
    sortedTags.forEach(item => {
        item.percentage = Math.round((item.count / totalResponses) * 100);
    });
    
    // Générer le HTML pour le résumé des tags
    let tagsHtml = `
        <h5 class="mb-4">Tags identifiés (${sortedTags.length})</h5>
        
        <div class="row">
            <div class="col-md-8">
                <div class="tag-summary mb-4">
                    ${sortedTags.map(item => `
                        <div class="tag-item mb-3">
                            <div class="d-flex justify-content-between align-items-center mb-1">
                                <span class="badge bg-primary">${item.tag}</span>
                                <span class="text-muted small">${item.count} réponses (${item.percentage}%)</span>
                            </div>
                            <div class="progress" style="height: 8px;">
                                <div class="progress-bar" role="progressbar" style="width: ${item.percentage}%;" 
                                    aria-valuenow="${item.percentage}" aria-valuemin="0" aria-valuemax="100"></div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <div class="col-md-4">
                <div class="card">
                    <div class="card-header bg-white">
                        <h6 class="card-title mb-0">Répartition des tags</h6>
                    </div>
                    <div class="card-body">
                        <canvas id="tagsChart"></canvas>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Afficher le mapping des tags si disponible
    if (tagMapping && Object.keys(tagMapping).length > 0) {
        tagsHtml += `
            <div class="card mt-4">
                <div class="card-header bg-white">
                    <h5 class="card-title mb-0">Normalisation des tags</h5>
                </div>
                <div class="card-body">
                    <div class="table-responsive">
                        <table class="table table-sm">
                            <thead>
                                <tr>
                                    <th>Tag normalisé</th>
                                    <th>Tags originaux</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${Object.entries(tagMapping).map(([normalizedTag, originalTags]) => `
                                    <tr>
                                        <td><span class="badge bg-primary">${normalizedTag}</span></td>
                                        <td>${Array.isArray(originalTags) ? originalTags.map(tag => 
                                            `<span class="badge bg-secondary me-1">${tag}</span>`).join(' ') : ''}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Mettre à jour le contenu
    tagsContent.innerHTML = tagsHtml;
    
    // Créer le graphique si des tags sont disponibles
    if (sortedTags.length > 0) {
        const ctx = document.getElementById('tagsChart');
        if (ctx) {
            // Limiter à 10 tags maximum pour le graphique
            const chartData = sortedTags.slice(0, 10);
            
            new Chart(ctx, {
                type: 'pie',
                data: {
                    labels: chartData.map(item => item.tag),
                    datasets: [{
                        data: chartData.map(item => item.count),
                        backgroundColor: [
                            '#4361ee', '#3a0ca3', '#7209b7', '#f72585', '#4cc9f0',
                            '#4895ef', '#560bad', '#b5179e', '#f15bb5', '#00b4d8'
                        ]
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            position: 'right',
                            labels: {
                                boxWidth: 12
                            }
                        }
                    }
                }
            });
        }
    }
}

// Fonction pour afficher les synthèses à partir des résultats
function displaySynthesesFromResults(tagSummaries) {
    console.log("Affichage des synthèses:", tagSummaries);
    
    // Récupérer le conteneur des synthèses
    const synthesisContent = getElement('synthesisContent');
    if (!synthesisContent) {
        console.error("Conteneur des synthèses non trouvé");
        return;
    }
    
    // Masquer le message "pas de synthèses"
    const noSummariesContent = getElement('noSummariesContent');
    if (noSummariesContent) noSummariesContent.style.display = 'none';
    
    // Générer le HTML pour les synthèses
    let html = `
        <h5 class="mb-4">Synthèses par tag (${Object.keys(tagSummaries).length})</h5>
        
        <div class="syntheses-container">
            ${formatTagSummaries(tagSummaries)}
        </div>
    `;
    
    // Mettre à jour le contenu
    synthesisContent.innerHTML = html;
}

// Fonction pour afficher l'onglet de synthèse
function showSynthesisTab() {
    const synthesisTab = document.getElementById('synthesis-tab');
    if (synthesisTab) {
        const tabInstance = new bootstrap.Tab(synthesisTab);
        tabInstance.show();
    }
} 