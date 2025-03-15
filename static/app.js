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

// Variables globales pour la pagination et la recherche
let currentPage = 1;
let pageSize = 5;
let allResults = [];
let filteredResults = [];
let searchQuery = '';

// Fonction pour afficher les résultats
function displayResults(data) {
    console.log("Affichage des résultats:", data);
    
    if (!data || !data.results || !Array.isArray(data.results)) {
        console.error("Format de données invalide:", data);
        showAlert("Format de données invalide", "danger");
        return;
    }
    
    // Vérifier et corriger les données si nécessaire
    const correctedResults = validateAndCorrectResults(data.results);
    
    // Stocker tous les résultats pour la pagination
    allResults = correctedResults;
    filteredResults = [...allResults]; // Copie pour la recherche
    
    // Afficher les tags
    displayTagsFromResults(correctedResults, data.tag_mapping, data.tag_summaries);
    
    // Afficher les synthèses
    if (data.tag_summaries) {
        displaySynthesesFromResults(data.tag_summaries);
    }
    
    // Afficher les données brutes avec pagination
    displayDataWithPagination();
    
    // Initialiser les contrôles de pagination
    initPagination();
    
    // Initialiser la recherche
    initSearch();
    
    // Afficher un message avec le nombre de résultats
    showAlert(`${correctedResults.length} réponses chargées avec succès.`, "success");
}

// Fonction pour valider et corriger les résultats
function validateAndCorrectResults(results) {
    if (!results || !Array.isArray(results)) {
        return [];
    }
    
    return results.map((item, index) => {
        // S'assurer que chaque élément a un ID de réponse
        if (!item.response_id) {
            item.response_id = index + 1;
        }
        
        // S'assurer que la réponse est une chaîne de caractères
        if (!item.response) {
            item.response = '';
        }
        
        // S'assurer que les tags sont des tableaux
        if (!item.tags || !Array.isArray(item.tags)) {
            item.tags = [];
        }
        
        // S'assurer que les tags normalisés sont des tableaux
        if (!item.normalized_tags || !Array.isArray(item.normalized_tags)) {
            item.normalized_tags = [];
        }
        
        return item;
    });
}

// Fonction pour initialiser la recherche
function initSearch() {
    const searchInput = getElement('dataSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value.toLowerCase().trim();
            filterResults();
        });
    }
}

// Fonction pour filtrer les résultats
function filterResults() {
    if (!searchQuery) {
        filteredResults = [...allResults];
    } else {
        filteredResults = allResults.filter(item => {
            // Recherche dans la réponse
            if (item.response && item.response.toLowerCase().includes(searchQuery)) {
                return true;
            }
            
            // Recherche dans les tags originaux
            if (item.tags && Array.isArray(item.tags)) {
                if (item.tags.some(tag => tag.toLowerCase().includes(searchQuery))) {
                    return true;
                }
            }
            
            // Recherche dans les tags normalisés
            if (item.normalized_tags && Array.isArray(item.normalized_tags)) {
                if (item.normalized_tags.some(tag => tag.toLowerCase().includes(searchQuery))) {
                    return true;
                }
            }
            
            return false;
        });
    }
    
    // Réinitialiser la pagination
    currentPage = 1;
    
    // Mettre à jour l'affichage
    displayDataWithPagination();
    updatePaginationControls();
}

// Fonction pour afficher les données avec pagination
function displayDataWithPagination() {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, filteredResults.length);
    const currentPageData = filteredResults.slice(startIndex, endIndex);
    
    // Afficher les données de la page actuelle
    const tbody = document.getElementById('dataTableBody');
    if (tbody) {
        tbody.innerHTML = '';
        
        if (currentPageData.length === 0) {
            // Aucun résultat
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            cell.colSpan = 4;
            cell.className = 'text-center py-4 text-gray-500';
            
            if (searchQuery) {
                cell.innerHTML = `<i class="bi bi-search me-2"></i>Aucun résultat pour "${searchQuery}"`;
            } else {
                cell.innerHTML = 'Aucune donnée disponible';
            }
            
            row.appendChild(cell);
            tbody.appendChild(row);
        } else {
            // Afficher les résultats
            currentPageData.forEach(item => {
                const row = document.createElement('tr');
                
                // Colonne ID
                const idCell = document.createElement('td');
                idCell.textContent = item.response_id || '';
                row.appendChild(idCell);
                
                // Colonne Réponse
                const responseCell = document.createElement('td');
                responseCell.textContent = item.response || '';
                responseCell.classList.add('response-cell');
                row.appendChild(responseCell);
                
                // Colonne Tags Originaux
                const originalTagsCell = document.createElement('td');
                if (item.tags && Array.isArray(item.tags)) {
                    originalTagsCell.innerHTML = formatTags(item.tags, 'bg-gray-200');
                }
                row.appendChild(originalTagsCell);
                
                // Colonne Tags Normalisés
                const normalizedTagsCell = document.createElement('td');
                if (item.normalized_tags && Array.isArray(item.normalized_tags)) {
                    normalizedTagsCell.innerHTML = formatTags(item.normalized_tags);
                }
                row.appendChild(normalizedTagsCell);
                
                tbody.appendChild(row);
            });
        }
        
        // Afficher la section des données
        const dataContent = getElement('dataContent');
        const noDataContent = getElement('noDataContent');
        if (dataContent && noDataContent) {
            dataContent.style.display = 'block';
            noDataContent.style.display = 'none';
        }
        
        // Mettre à jour les informations de pagination
        updatePaginationInfo();
    }
}

// Fonction pour initialiser les contrôles de pagination
function initPagination() {
    // Réinitialiser la page courante
    currentPage = 1;
    
    // Récupérer les éléments de pagination
    const prevPageBtn = getElement('prevPageBtn');
    const nextPageBtn = getElement('nextPageBtn');
    const pageSizeSelect = getElement('pageSizeSelect');
    
    // Ajouter les écouteurs d'événements
    if (prevPageBtn) {
        prevPageBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                displayDataWithPagination();
                updatePaginationControls();
            }
        });
    }
    
    if (nextPageBtn) {
        nextPageBtn.addEventListener('click', () => {
            const totalPages = Math.ceil(filteredResults.length / pageSize);
            if (currentPage < totalPages) {
                currentPage++;
                displayDataWithPagination();
                updatePaginationControls();
            }
        });
    }
    
    if (pageSizeSelect) {
        pageSizeSelect.addEventListener('change', () => {
            pageSize = parseInt(pageSizeSelect.value);
            currentPage = 1; // Revenir à la première page
            displayDataWithPagination();
            updatePaginationControls();
        });
    }
    
    // Initialiser les contrôles
    updatePaginationControls();
}

// Fonction pour mettre à jour les informations de pagination
function updatePaginationInfo() {
    const paginationInfo = getElement('paginationInfo');
    if (paginationInfo) {
        if (filteredResults.length === 0) {
            paginationInfo.textContent = 'Aucun résultat';
        } else {
            const startIndex = (currentPage - 1) * pageSize + 1;
            const endIndex = Math.min(startIndex + pageSize - 1, filteredResults.length);
            paginationInfo.textContent = `Affichage de ${startIndex}-${endIndex} sur ${filteredResults.length} résultats`;
        }
    }
}

// Fonction pour mettre à jour les contrôles de pagination
function updatePaginationControls() {
    const prevPageBtn = getElement('prevPageBtn');
    const nextPageBtn = getElement('nextPageBtn');
    const pageNumbers = getElement('pageNumbers');
    
    // Mettre à jour l'état des boutons précédent/suivant
    if (prevPageBtn) {
        prevPageBtn.disabled = currentPage === 1;
    }
    
    const totalPages = Math.ceil(filteredResults.length / pageSize);
    if (nextPageBtn) {
        nextPageBtn.disabled = currentPage === totalPages || totalPages === 0;
    }
    
    // Générer les numéros de page
    if (pageNumbers) {
        pageNumbers.innerHTML = '';
        
        if (totalPages > 0) {
            // Déterminer la plage de pages à afficher
            let startPage = Math.max(1, currentPage - 2);
            let endPage = Math.min(totalPages, startPage + 4);
            
            // Ajuster si on est près de la fin
            if (endPage - startPage < 4) {
                startPage = Math.max(1, endPage - 4);
            }
            
            // Ajouter la première page si nécessaire
            if (startPage > 1) {
                addPageNumber(pageNumbers, 1);
                if (startPage > 2) {
                    addEllipsis(pageNumbers);
                }
            }
            
            // Ajouter les pages numérotées
            for (let i = startPage; i <= endPage; i++) {
                addPageNumber(pageNumbers, i);
            }
            
            // Ajouter la dernière page si nécessaire
            if (endPage < totalPages) {
                if (endPage < totalPages - 1) {
                    addEllipsis(pageNumbers);
                }
                addPageNumber(pageNumbers, totalPages);
            }
        }
    }
}

// Fonction pour ajouter un numéro de page
function addPageNumber(container, pageNum) {
    const pageElement = document.createElement('button');
    pageElement.className = `page-number ${pageNum === currentPage ? 'active' : ''}`;
    pageElement.textContent = pageNum;
    pageElement.addEventListener('click', () => {
        currentPage = pageNum;
        displayDataWithPagination();
        updatePaginationControls();
    });
    container.appendChild(pageElement);
}

// Fonction pour ajouter des points de suspension
function addEllipsis(container) {
    const ellipsis = document.createElement('span');
    ellipsis.className = 'px-2 py-1 text-gray-500';
    ellipsis.textContent = '...';
    container.appendChild(ellipsis);
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

// Fonction pour initialiser les étapes de progression
function initializeProgressSteps() {
    const steps = [
        {
            id: 'data-loading',
            title: 'Chargement des données',
            description: 'Préparation et validation des données d\'entrée',
            icon: 'bi-file-earmark-text'
        },
        {
            id: 'tag-extraction',
            title: 'Extraction des tags',
            description: 'Analyse des réponses et identification des tags',
            icon: 'bi-tags'
        },
        {
            id: 'tag-normalization',
            title: 'Normalisation des tags',
            description: 'Uniformisation et regroupement des tags similaires',
            icon: 'bi-arrow-repeat'
        },
        {
            id: 'synthesis-generation',
            title: 'Génération des synthèses',
            description: 'Création des résumés pour chaque groupe de tags',
            icon: 'bi-journal-text'
        }
    ];

    const progressStepsContainer = getElement('progressStepsDetailed');
    if (progressStepsContainer) {
        progressStepsContainer.innerHTML = steps.map(step => `
            <div class="process-step" id="${step.id}-step">
                <div class="flex items-start">
                    <div class="flex-shrink-0">
                        <i class="bi ${step.icon} text-xl"></i>
                    </div>
                    <div class="ml-3">
                        <h5 class="text-base font-medium mb-1">${step.title}</h5>
                        <p class="text-gray-600 text-sm mb-2">${step.description}</p>
                        <div class="step-status text-sm">
                            <span class="text-gray-500">
                                <i class="bi bi-clock mr-1"></i>En attente...
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
    }
}

// Fonction pour mettre à jour le statut d'une étape
function updateStepStatus(stepId, status, message = '') {
    const step = document.getElementById(`${stepId}-step`);
    if (!step) return;

    const statusElement = step.querySelector('.step-status');
    if (!statusElement) return;

    let statusHtml = '';
    step.classList.remove('completed', 'active', 'error');

    switch (status) {
        case 'waiting':
            statusHtml = `<span class="text-gray-500"><i class="bi bi-clock mr-1"></i>En attente...</span>`;
            break;
        case 'active':
            statusHtml = `<span class="text-accent"><i class="bi bi-arrow-clockwise mr-1 pulse-animation"></i>En cours...</span>`;
            step.classList.add('active');
            break;
        case 'completed':
            statusHtml = `<span class="text-secondary"><i class="bi bi-check-circle mr-1"></i>Terminé</span>`;
            step.classList.add('completed');
            break;
        case 'error':
            statusHtml = `<span class="text-danger"><i class="bi bi-exclamation-circle mr-1"></i>${message || 'Erreur'}</span>`;
            step.classList.add('error');
            break;
    }

    statusElement.innerHTML = statusHtml;
}

// Modifier la fonction testWorkflow pour utiliser les étapes de progression
async function testWorkflow() {
    console.log("Test du workflow avec les données d'exemple");
    
    // Initialiser les étapes de progression
    initializeProgressSteps();
    
    // Afficher l'onglet de progression
    const progressTab = new bootstrap.Tab(document.getElementById('progress-tab'));
    progressTab.show();
    
    // Récupérer le bouton de test
    const testBtn = getElement('testBtn');
    let originalContent = '';
    if (testBtn) {
        originalContent = testBtn.innerHTML;
        testBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Test en cours...`;
        testBtn.disabled = true;
    }

    try {
        // Étape 1: Chargement des données
        updateStepStatus('data-loading', 'active');
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulation de délai
        updateStepStatus('data-loading', 'completed');

        // Étape 2: Extraction des tags
        updateStepStatus('tag-extraction', 'active');
        const response = await fetch('/test_workflow', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status}`);
        }

        updateStepStatus('tag-extraction', 'completed');

        // Étape 3: Normalisation des tags
        updateStepStatus('tag-normalization', 'active');
        const data = await response.json();
        if (data.error) {
            throw new Error(data.error);
        }
        updateStepStatus('tag-normalization', 'completed');

        // Étape 4: Génération des synthèses
        updateStepStatus('synthesis-generation', 'active');
        displayResults(data);
        updateStepStatus('synthesis-generation', 'completed');

        // Afficher un message de succès
        showAlert("Test effectué avec succès !", "success");
        
        // Activer l'onglet de synthèse après un court délai
        setTimeout(() => {
            showSynthesisTab();
        }, 2000);

    } catch (error) {
        console.error("Erreur lors du test:", error);
        
        // Mettre à jour le statut de l'étape en cours avec l'erreur
        const steps = ['data-loading', 'tag-extraction', 'tag-normalization', 'synthesis-generation'];
        const activeStep = steps.find(step => 
            document.getElementById(`${step}-step`).classList.contains('active')
        );
        if (activeStep) {
            updateStepStatus(activeStep, 'error', error.message);
        }

        showAlert(error.message || "Une erreur est survenue lors du test", "danger");
    } finally {
        // Restaurer l'état original du bouton dans tous les cas
        if (testBtn) {
            testBtn.innerHTML = `<i class="bi bi-lightning-fill mr-2"></i>Tester avec données d'exemple`;
            testBtn.disabled = false;
        }
    }
}

// Fonction pour formater les tags
function formatTags(tags, bgClass = 'bg-primary') {
    if (!tags || tags.length === 0) return '<span class="text-gray-400">Aucun tag</span>';
    return tags.map(tag => `<span class="badge ${bgClass} text-white me-1 mb-1">${tag}</span>`).join(' ');
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
                        <div class="tag-count-list">
                            ${sortedTags.slice(0, 10).map(item => `
                                <div class="d-flex justify-content-between align-items-center mb-2">
                                    <span class="badge bg-primary">${item.tag}</span>
                                    <span class="badge bg-secondary">${item.count}</span>
                                </div>
                            `).join('')}
                        </div>
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
        <h5 class="mb-2">Synthèses par tag (${Object.keys(tagSummaries).length})</h5>
        
        <div class="mb-4">
            <a class="text-muted small" data-bs-toggle="collapse" href="#noteCollapse-global" role="button" aria-expanded="false">
                <i class="bi bi-info-circle me-1"></i>Note sur le nombre de verbatims
            </a>
            <div class="collapse" id="noteCollapse-global">
                <div class="card card-body py-2 px-3 mt-1 bg-light small">
                    Le nombre d'utilisateurs peut différer du nombre de verbatims car l'analyse initiale regroupe les réponses par thème, mais seuls les passages véritablement représentatifs sont extraits comme verbatims.
                </div>
            </div>
        </div>
        
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

// Fonction pour sauvegarder la clé API
async function saveApiKey() {
    const apiKey = document.getElementById('apiKey').value.trim();
    const apiKeyStatus = document.getElementById('apiKeyStatus');
    const apiConfigStatus = document.querySelector('.d-flex.align-items-center.gap-2 span');
    
    if (!apiKey) {
        showAlert("Veuillez entrer une clé API", "warning");
        return;
    }
    
    try {
        const response = await fetch('/save_api_key', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ api_key: apiKey })
        });
        
        const data = await response.json();
        
        if (data.success) {
            if (apiConfigStatus) {
                apiConfigStatus.innerHTML = `
                    <i class="bi bi-circle-fill text-success me-1"></i>
                    API configurée
                `;
                apiConfigStatus.classList.remove('text-danger');
                apiConfigStatus.classList.add('text-success');
            }
            if (apiKeyStatus) {
                apiKeyStatus.innerHTML = `
                    <i class="bi bi-check-circle text-success me-1"></i>
                    API configurée avec succès
                `;
            }
            showAlert("Clé API sauvegardée avec succès", "success");
            
            // Masquer l'encart après la sauvegarde réussie
            const apiConfigContent = document.getElementById('apiConfigContent');
            const toggleApiConfig = document.getElementById('toggleApiConfig');
            if (apiConfigContent) {
                apiConfigContent.style.display = 'none';
                if (toggleApiConfig) {
                    toggleApiConfig.querySelector('i').classList.remove('bi-chevron-up');
                    toggleApiConfig.querySelector('i').classList.add('bi-chevron-down');
                }
            }
        } else {
            throw new Error(data.error || "Erreur lors de la sauvegarde de la clé API");
        }
    } catch (error) {
        console.error("Erreur lors de la sauvegarde de la clé API:", error);
        showAlert(error.message || "Erreur lors de la sauvegarde de la clé API", "danger");
        
        if (apiConfigStatus) {
            apiConfigStatus.innerHTML = `
                <i class="bi bi-circle-fill text-danger me-1"></i>
                API non configurée
            `;
            apiConfigStatus.classList.remove('text-success');
            apiConfigStatus.classList.add('text-danger');
        }
        if (apiKeyStatus) {
            apiKeyStatus.innerHTML = `
                <i class="bi bi-exclamation-circle text-danger me-1"></i>
                Erreur de configuration
            `;
        }
    }
}

// Gestionnaires d'événements pour l'importation de fichiers
document.addEventListener('DOMContentLoaded', function() {
    // Gestion simple de l'affichage/masquage de l'encart de configuration API
    const apiConfigContent = document.getElementById('apiConfigContent');
    const toggleApiConfig = document.getElementById('toggleApiConfig');
    const saveApiKeyBtn = document.getElementById('saveApiKey');
    
    if (apiConfigContent && toggleApiConfig) {
        toggleApiConfig.addEventListener('click', function() {
            // Toggle l'affichage
            if (apiConfigContent.style.display === 'none') {
                apiConfigContent.style.display = 'block';
                toggleApiConfig.querySelector('i').classList.remove('bi-chevron-down');
                toggleApiConfig.querySelector('i').classList.add('bi-chevron-up');
            } else {
                apiConfigContent.style.display = 'none';
                toggleApiConfig.querySelector('i').classList.remove('bi-chevron-up');
                toggleApiConfig.querySelector('i').classList.add('bi-chevron-down');
            }
        });
    }
    
    // Gestionnaire pour le bouton de sauvegarde de la clé API
    if (saveApiKeyBtn) {
        saveApiKeyBtn.addEventListener('click', saveApiKey);
    }

    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('csvFile');
    const browseButton = document.getElementById('browseButton');
    const selectedFileName = document.getElementById('selectedFileName');
    const dataSearchInput = document.getElementById('dataSearchInput');

    // Initialiser la recherche
    if (dataSearchInput) {
        dataSearchInput.value = '';
    }

    // Gestionnaire pour le bouton Parcourir
    if (browseButton) {
        browseButton.addEventListener('click', () => {
            fileInput.click();
        });
    }

    // Gestionnaire pour le changement de fichier
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                updateSelectedFile(file);
            }
        });
    }

    // Gestionnaire pour le champ de recherche
    if (dataSearchInput) {
        dataSearchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value.toLowerCase().trim();
            filterResults();
        });
    }

    // Gestionnaire pour le fileInput principal (dans la page, pas dans le modal)
    const mainFileInput = document.getElementById('fileInput');
    if (mainFileInput) {
        mainFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                if (file.name.toLowerCase().endsWith('.csv')) {
                    // Afficher le nom du fichier
                    const fileNameDisplay = document.createElement('div');
                    fileNameDisplay.className = 'mt-2 text-sm text-primary';
                    fileNameDisplay.innerHTML = `<i class="bi bi-file-earmark-text me-1"></i>${file.name} (${formatFileSize(file.size)})`;
                    
                    // Trouver l'endroit où afficher le nom du fichier
                    const container = mainFileInput.parentElement;
                    if (container) {
                        // Supprimer l'ancien affichage s'il existe
                        const oldDisplay = container.querySelector('.text-primary');
                        if (oldDisplay) {
                            oldDisplay.remove();
                        }
                        container.appendChild(fileNameDisplay);
                    }
                    
                    // Charger l'aperçu du fichier
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        try {
                            const lines = e.target.result.split('\n').slice(0, 6); // En-tête + 5 lignes
                            if (lines.length > 0) {
                                const headers = lines[0].split(',').map(h => h.trim());
                                const rows = lines.slice(1).map(line => 
                                    line.split(',').map(cell => cell.trim())
                                );
                                updatePreviewTable(headers, rows);
                            }
                        } catch (error) {
                            console.error("Erreur lors de la lecture du fichier CSV:", error);
                            showAlert("Erreur lors de la lecture du fichier CSV", "danger");
                        }
                    };
                    reader.readAsText(file);
                } else {
                    showAlert("Le fichier doit être au format CSV", "warning");
                }
            }
        });
    }

    // Gestionnaires pour le glisser-déposer
    if (dropZone) {
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('border-primary');
        });

        dropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dropZone.classList.remove('border-primary');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('border-primary');
            
            const file = e.dataTransfer.files[0];
            if (file) {
                if (file.name.toLowerCase().endsWith('.csv')) {
                    fileInput.files = e.dataTransfer.files;
                    updateSelectedFile(file);
                } else {
                    showAlert("Veuillez sélectionner un fichier CSV", "warning");
                }
            }
        });
    }

    // Fonction pour mettre à jour l'affichage du fichier sélectionné
    function updateSelectedFile(file) {
        if (selectedFileName) {
            if (file.name.toLowerCase().endsWith('.csv')) {
                selectedFileName.innerHTML = `
                    <i class="bi bi-file-earmark-text text-primary"></i>
                    ${file.name} (${formatFileSize(file.size)})
                `;
                selectedFileName.classList.remove('text-danger');
                selectedFileName.classList.add('text-primary');
                
                // Afficher l'aperçu si possible
                showCsvPreview(file);
            } else {
                selectedFileName.innerHTML = `
                    <i class="bi bi-exclamation-circle text-danger"></i>
                    Veuillez sélectionner un fichier CSV
                `;
                selectedFileName.classList.remove('text-primary');
                selectedFileName.classList.add('text-danger');
            }
        }
    }

    // Fonction pour formater la taille du fichier
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Fonction pour afficher un aperçu du CSV
    function showCsvPreview(file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                // Lire les premières lignes du fichier
                const lines = e.target.result.split('\n').slice(0, 5);
                if (lines.length > 0) {
                    const headers = lines[0].split(',').map(h => h.trim());
                    
                    // Générer le HTML pour l'aperçu
                    const previewTable = document.getElementById('previewTable');
                    if (previewTable) {
                        // En-têtes
                        const thead = previewTable.querySelector('thead');
                        thead.innerHTML = `
                            <tr>
                                ${headers.map(header => `<th class="px-4 py-2 bg-gray-50">${header}</th>`).join('')}
                            </tr>
                        `;
                        
                        // Données
                        const tbody = previewTable.querySelector('tbody');
                        tbody.innerHTML = lines.slice(1).map(line => `
                            <tr>
                                ${line.split(',').map(cell => `<td class="px-4 py-2 border-t">${cell.trim()}</td>`).join('')}
                            </tr>
                        `).join('');
                        
                        // Afficher la section d'aperçu
                        document.getElementById('csvPreview').classList.remove('hidden');
                    }
                }
            } catch (error) {
                console.error("Erreur lors de la lecture du fichier CSV:", error);
                showAlert("Erreur lors de la lecture du fichier CSV", "danger");
            }
        };
        reader.readAsText(file);
    }
}); 