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
    
    loadingElement.classList.remove('hidden');
}

// Masquer l'indicateur de chargement global
function hideLoading() {
    const loadingElement = getElement('globalLoading');
    if (loadingElement) {
        loadingElement.classList.add('hidden');
    }
}

// Créer l'élément de chargement global
function createGlobalLoadingElement() {
    // Créer l'élément de chargement s'il n'existe pas
    const loadingElement = document.createElement('div');
    loadingElement.id = 'globalLoading';
    loadingElement.className = 'fixed inset-0 flex items-center justify-center bg-white bg-opacity-75 z-50';
    
    const loadingContent = document.createElement('div');
    loadingContent.className = 'text-center p-4 bg-white rounded shadow-lg';
    
    const spinner = document.createElement('div');
    spinner.className = 'w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3';
    spinner.setAttribute('role', 'status');
    
    const spinnerText = document.createElement('span');
    spinnerText.className = 'sr-only';
    spinnerText.textContent = 'Chargement...';
    
    const message = document.createElement('div');
    message.className = 'loading-message text-gray-700 font-medium';
    message.textContent = 'Chargement en cours...';
    
    spinner.appendChild(spinnerText);
    loadingContent.appendChild(spinner);
    loadingContent.appendChild(message);
    loadingElement.appendChild(loadingContent);
    
    // Ajouter au document
    document.body.appendChild(loadingElement);
    
    // Cacher par défaut
    loadingElement.classList.add('hidden');
    
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

// Initialisation des fonctionnalités de l'interface
document.addEventListener('DOMContentLoaded', function() {
    // Initialiser le toggle de la configuration API
    initApiConfigToggle();
    
    // Initialiser la gestion des fichiers
    initFileUpload();
    
    // Initialiser la sauvegarde de la clé API
    initApiKeySave();
    
    // Initialiser le toggle des sources de données
    initDataSourceToggle();
    
    // Charger les données de test
    loadTestData();
    
    // S'assurer que l'encart de configuration API est replié par défaut
    const apiConfigContent = getElement('apiConfigContent');
    if (apiConfigContent && !apiConfigContent.classList.contains('hidden')) {
        apiConfigContent.classList.add('hidden');
    }
    
    // Initialiser les étapes de progression pour qu'elles soient visibles dès le chargement
    initializeProgressSteps();
});

// Fonction pour initialiser le toggle de la configuration API
function initApiConfigToggle() {
    const toggleBtn = getElement('toggleApiConfig');
    const apiConfigContent = getElement('apiConfigContent');
    
    if (toggleBtn && apiConfigContent) {
        toggleBtn.addEventListener('click', function() {
            // Toggle de l'affichage du contenu
            const isVisible = !apiConfigContent.classList.contains('hidden');
            const iconElement = toggleBtn.querySelector('.bi');
            
            if (isVisible) {
                apiConfigContent.classList.add('hidden');
                if (iconElement) {
                    iconElement.classList.remove('bi-chevron-up');
                    iconElement.classList.add('bi-chevron-down');
                }
            } else {
                apiConfigContent.classList.remove('hidden');
                if (iconElement) {
                    iconElement.classList.remove('bi-chevron-down');
                    iconElement.classList.add('bi-chevron-up');
                }
            }
        });
    }
}

// Fonction pour initialiser la gestion des fichiers
function initFileUpload() {
    const fileInput = getElement('fileInput');
    const dropZone = getElement('dropZone');
    const filePreview = getElement('filePreview');
    const fileName = getElement('fileName');
    const fileSize = getElement('fileSize');
    const removeFile = getElement('removeFile');
    const csvPreview = getElement('csvPreview');
    const browseFilesBtn = getElement('browseFilesBtn');
    
    // Variable pour suivre si une sélection de fichier est en cours
    let isFileSelectionInProgress = false;
    
    if (fileInput && dropZone) {
        // Gestion du clic sur le bouton "Parcourir les fichiers"
        if (browseFilesBtn) {
            browseFilesBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                // Empêcher les clics multiples rapides
                if (isFileSelectionInProgress) {
                    return;
                }
                
                isFileSelectionInProgress = true;
                fileInput.click();
                
                // Réinitialiser l'état après un court délai
                setTimeout(() => {
                    isFileSelectionInProgress = false;
                }, 500);
            });
        }
        
        // Gestion du clic sur la zone de drop (seulement si on n'a pas cliqué sur le bouton)
        dropZone.addEventListener('click', function(e) {
            // Ne pas déclencher si on a cliqué sur le bouton
            if (e.target.closest('#browseFilesBtn')) {
                return;
            }
            
            // Empêcher les clics multiples rapides
            if (isFileSelectionInProgress) {
                return;
            }
            
            isFileSelectionInProgress = true;
            fileInput.click();
            
            // Réinitialiser l'état après un court délai
            setTimeout(() => {
                isFileSelectionInProgress = false;
            }, 500); // Réduire le délai pour une meilleure réactivité
        });
        
        // Gestion du changement de fichier
        fileInput.addEventListener('change', function(e) {
            if (e.target.files && e.target.files.length > 0) {
                handleFileSelection(e.target.files[0]);
            }
        });
        
        // Gestion du drag & drop
        dropZone.addEventListener('dragover', function(e) {
            e.preventDefault();
            dropZone.classList.add('border-primary', 'bg-primary', 'bg-opacity-5');
        });
        
        dropZone.addEventListener('dragleave', function() {
            dropZone.classList.remove('border-primary', 'bg-primary', 'bg-opacity-5');
        });
        
        dropZone.addEventListener('drop', function(e) {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.remove('border-primary', 'bg-primary', 'bg-opacity-5');
            
            if (e.dataTransfer.files.length) {
                handleFileSelection(e.dataTransfer.files[0]);
            }
        });
        
        // Gestion de la suppression du fichier
        if (removeFile) {
            removeFile.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                fileInput.value = '';
                filePreview.classList.add('hidden');
                dropZone.classList.remove('hidden');
                csvPreview.innerHTML = '';
            });
        }
    }
    
    // Fonction pour gérer la sélection d'un fichier
    function handleFileSelection(file) {
        if (!file) return;
        
        // Vérifier le type de fichier
        if (!file.name.endsWith('.csv')) {
            showAlert("Le fichier doit être au format CSV", "danger");
            return;
        }
        
        // Réinitialiser l'aperçu précédent
        if (csvPreview) {
            csvPreview.innerHTML = `
                <div class="flex justify-center items-center p-4">
                    <div class="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                    <span class="ml-2 text-gray-600">Chargement de l'aperçu...</span>
                </div>
            `;
        }
        
        // Afficher les informations du fichier
        if (fileName && fileSize && filePreview && dropZone) {
            fileName.textContent = file.name;
            fileSize.textContent = formatFileSize(file.size);
            
            filePreview.classList.remove('hidden');
            dropZone.classList.add('hidden');
            
            // Traiter le fichier immédiatement
            showCsvPreview(file);
        }
    }
    
    // Fonction pour formater la taille du fichier
    function formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' octets';
        else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' Ko';
        else return (bytes / 1048576).toFixed(1) + ' Mo';
    }
    
    // Fonction pour afficher un aperçu du contenu CSV
    function showCsvPreview(file) {
        if (!csvPreview) return;
        
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const content = e.target.result;
                
                // Détecter le séparateur (virgule, point-virgule, tabulation)
                const firstLine = content.split('\n')[0];
                let separator = ','; // Par défaut
                
                if (firstLine.includes(';')) {
                    separator = ';';
                } else if (firstLine.includes('\t')) {
                    separator = '\t';
                }
                
                // Afficher jusqu'à 15 lignes pour l'aperçu
                const lines = content.split('\n').filter(line => line.trim() !== '').slice(0, 16);
                
                if (lines.length > 0) {
                    // Fonction pour parser une ligne CSV en respectant les guillemets
                    function parseCSVLine(line, sep) {
                        const result = [];
                        let current = '';
                        let inQuotes = false;
                        
                        for (let i = 0; i < line.length; i++) {
                            const char = line[i];
                            
                            if (char === '"') {
                                // Si on a un guillemet échappé (deux guillemets consécutifs)
                                if (i + 1 < line.length && line[i + 1] === '"') {
                                    current += '"';
                                    i++; // Sauter le prochain guillemet
                                } else {
                                    // Basculer l'état "dans les guillemets"
                                    inQuotes = !inQuotes;
                                }
                            } else if (char === sep && !inQuotes) {
                                // Fin d'une cellule
                                result.push(current);
                                current = '';
                            } else {
                                // Caractère normal
                                current += char;
                            }
                        }
                        
                        // Ajouter la dernière cellule
                        result.push(current);
                        
                        return result;
                    }
                    
                    // Extraire les en-têtes en respectant les guillemets
                    const headers = parseCSVLine(lines[0], separator).map(h => h.trim());
                    
                    // Trouver l'index de la colonne "response" ou "réponse"
                    const responseIndex = headers.findIndex(h => 
                        h.toLowerCase() === 'response' || 
                        h.toLowerCase() === 'réponse' || 
                        h.toLowerCase() === 'reponse'
                    );
                    
                    // Parser les lignes de données
                    const rows = lines.slice(1).map(line => {
                        const cells = parseCSVLine(line, separator).map(cell => cell.trim());
                        
                        // Si on a identifié une colonne de réponse et qu'il y a des colonnes supplémentaires
                        if (responseIndex >= 0 && cells.length > headers.length) {
                            // Fusionner les colonnes supplémentaires avec la colonne de réponse
                            const extraColumns = cells.slice(headers.length);
                            cells[responseIndex] = cells[responseIndex] + ' ' + extraColumns.join(' ');
                            // Tronquer le tableau pour qu'il corresponde au nombre d'en-têtes
                            cells.length = headers.length;
                        }
                        
                        return cells;
                    });
                    
                    // Créer le tableau HTML
                    let tableHtml = `
                        <h4 class="text-md font-medium mb-3 text-gray-700">Aperçu du fichier (${rows.length} lignes)</h4>
                        <div class="overflow-x-auto rounded-lg border border-gray-200">
                            <table class="w-full border-collapse">
                                <thead>
                                    <tr class="bg-gray-50">
                                        ${headers.map((header, index) => 
                                            `<th class="py-2 px-3 text-left text-sm font-medium text-gray-600 border-b border-gray-200">${header || `Colonne ${index + 1}`}</th>`
                                        ).join('')}
                                    </tr>
                                </thead>
                                <tbody>
                                    ${rows.map((row, rowIndex) => {
                                        // Normaliser les cellules pour qu'elles correspondent au nombre d'en-têtes
                                        const normalizedRow = [...row];
                                        while (normalizedRow.length < headers.length) {
                                            normalizedRow.push('');
                                        }
                                        
                                        return `
                                            <tr class="hover:bg-gray-50 transition-colors">
                                                ${normalizedRow.map((cell, cellIndex) => 
                                                    `<td class="py-3 px-3 border-b border-gray-200 text-gray-700">${cell}</td>`
                                                ).join('')}
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    `;
                    
                    // Mettre à jour l'aperçu
                    csvPreview.innerHTML = tableHtml;
                } else {
                    csvPreview.innerHTML = `
                        <div class="p-3 bg-yellow-50 text-yellow-700 rounded-lg border border-yellow-200">
                            <p class="flex items-center"><i class="bi bi-exclamation-triangle-fill mr-2"></i> Le fichier CSV semble être vide</p>
                        </div>
                    `;
                }
            } catch (error) {
                console.error("Erreur lors de la lecture du fichier CSV:", error);
                csvPreview.innerHTML = `
                    <div class="p-3 bg-red-50 text-red-700 rounded-lg border border-red-200">
                        <p class="flex items-center"><i class="bi bi-exclamation-triangle-fill mr-2"></i> Erreur lors de la lecture du fichier CSV: ${error.message}</p>
                    </div>
                `;
            }
        };
        
        // Forcer la lecture du fichier
        reader.readAsText(file);
    }
}

// Fonction pour initialiser la sauvegarde de la clé API
function initApiKeySave() {
    const saveApiKeyBtn = getElement('saveApiKey');
    const apiKeyInput = getElement('apiKey');
    
    if (saveApiKeyBtn && apiKeyInput) {
        saveApiKeyBtn.addEventListener('click', function() {
            const apiKey = apiKeyInput.value.trim();
            
            if (!apiKey) {
                showAlert("Veuillez entrer une clé API valide", "warning");
                return;
            }
            
            // Sauvegarder la clé API
            saveApiKey(apiKey);
        });
    }
}

// Fonction pour sauvegarder la clé API
async function saveApiKey(apiKey) {
    try {
        showLoading("Vérification de la clé API...");
        
        // Envoyer la clé API au serveur
        const response = await fetch('/save_api_key', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ api_key: apiKey })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Mettre à jour l'interface pour indiquer que l'API est configurée
            const apiStatusElement = document.querySelector('#apiConfigContent .flex.items-center.mb-2');
            if (apiStatusElement) {
                apiStatusElement.innerHTML = `
                    <div class="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
                    <span class="text-gray-600">API configurée</span>
                `;
            }
            
            // Mettre à jour l'indicateur d'état dans l'en-tête
            const apiStatusIndicator = getElement('apiStatusIndicator');
            if (apiStatusIndicator) {
                apiStatusIndicator.innerHTML = `
                    <div class="w-2 h-2 rounded-full bg-green-500"></div>
                    <span class="text-xs text-gray-500 ml-1">Configurée</span>
                `;
            }
            
            showAlert("Clé API enregistrée avec succès", "success");
            
            // Replier la section de configuration API après un court délai
            setTimeout(() => {
                const toggleBtn = getElement('toggleApiConfig');
                if (toggleBtn && !getElement('apiConfigContent').classList.contains('hidden')) {
                    toggleBtn.click();
                }
            }, 2000);
        } else {
            showAlert(data.error || "Erreur lors de l'enregistrement de la clé API", "danger");
        }
    } catch (error) {
        console.error("Erreur lors de l'enregistrement de la clé API:", error);
        showAlert("Erreur lors de l'enregistrement de la clé API", "danger");
    } finally {
        hideLoading();
    }
}

// Fonction pour afficher une alerte
function showAlert(message, type = 'info') {
    // Créer l'élément d'alerte
    const alertElement = document.createElement('div');
    alertElement.className = `fixed bottom-4 right-4 p-4 rounded-lg shadow-lg z-50 ${getAlertClass(type)}`;
    alertElement.innerHTML = `
        <div class="flex items-center">
            <i class="${getAlertIcon(type)} mr-3 text-xl"></i>
            <span>${message}</span>
            <button class="ml-4 text-current opacity-75 hover:opacity-100 transition-opacity" onclick="this.parentElement.parentElement.remove()">
                <i class="bi bi-x-lg"></i>
            </button>
        </div>
    `;
    
    // Ajouter au document
    document.body.appendChild(alertElement);
    
    // Supprimer après 5 secondes
    setTimeout(() => {
        if (alertElement.parentNode) {
            alertElement.remove();
        }
    }, 5000);
    
    // Fonctions utilitaires pour les alertes
    function getAlertClass(type) {
        switch (type) {
            case 'success': return 'bg-green-100 text-green-800 border-l-4 border-green-500';
            case 'danger': return 'bg-red-100 text-red-800 border-l-4 border-red-500';
            case 'warning': return 'bg-yellow-100 text-yellow-800 border-l-4 border-yellow-500';
            default: return 'bg-blue-100 text-blue-800 border-l-4 border-blue-500';
        }
    }
    
    function getAlertIcon(type) {
        switch (type) {
            case 'success': return 'bi bi-check-circle-fill';
            case 'danger': return 'bi bi-exclamation-circle-fill';
            case 'warning': return 'bi bi-exclamation-triangle-fill';
            default: return 'bi bi-info-circle-fill';
        }
    }
}

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
            <div class="relative pl-8 mb-6 group step-container" id="${step.id}-step">
                <div class="flex items-start">
                    <div class="flex-shrink-0 text-gray-600">
                        <i class="bi ${step.icon} text-xl"></i>
                    </div>
                    <div class="ml-3 flex-grow">
                        <div class="flex justify-between items-center">
                            <h5 class="text-base font-medium mb-1 text-gray-800">${step.title}</h5>
                            <button class="step-toggle hidden text-gray-400 hover:text-gray-600" data-step="${step.id}">
                                <i class="bi bi-chevron-down transition-transform duration-300"></i>
                            </button>
                        </div>
                        <p class="text-gray-600 text-sm mb-2">${step.description}</p>
                        <div class="step-status text-sm">
                            <span class="text-gray-500">
                                <i class="bi bi-clock mr-1"></i>En attente...
                            </span>
                        </div>
                        <!-- Conteneur pour les logs d'activité -->
                        <div class="step-activity-log mt-3 bg-gray-50 rounded-lg p-3 text-sm hidden">
                            <div class="activity-log-title font-medium text-gray-700 mb-2">
                                <i class="bi bi-list-ul mr-1"></i>Détails de l'activité
                            </div>
                            <div class="activity-log-content space-y-2">
                                <!-- Les logs d'activité seront ajoutés ici dynamiquement -->
                            </div>
                        </div>
                    </div>
                </div>
                <!-- Ligne verticale -->
                <div class="absolute left-[7px] top-0 h-full w-0.5 bg-gray-200 -z-10"></div>
                <!-- Point de l'étape -->
                <div class="absolute left-0 top-0 w-3.5 h-3.5 rounded-full bg-gray-400 border-2 border-white shadow-sm"></div>
            </div>
        `).join('');
        
        // S'assurer que toutes les étapes sont initialisées avec le statut "waiting"
        steps.forEach(step => {
            updateStepStatus(step.id, 'waiting');
        });

        // Ajouter les écouteurs d'événements pour les boutons de toggle
        document.querySelectorAll('.step-toggle').forEach(button => {
            button.addEventListener('click', function() {
                const stepId = this.getAttribute('data-step');
                const stepElement = document.getElementById(`${stepId}-step`);
                const activityLog = stepElement.querySelector('.step-activity-log');
                const icon = this.querySelector('.bi');
                
                if (activityLog.classList.contains('hidden')) {
                    activityLog.classList.remove('hidden');
                    icon.classList.remove('bi-chevron-down');
                    icon.classList.add('bi-chevron-up');
                } else {
                    activityLog.classList.add('hidden');
                    icon.classList.remove('bi-chevron-up');
                    icon.classList.add('bi-chevron-down');
                }
            });
        });
    }
}

// Fonction pour mettre à jour le statut d'une étape
function updateStepStatus(stepId, status, message = '') {
    const stepElement = document.getElementById(`${stepId}-step`);
    if (!stepElement) return;
    
    // Récupérer les éléments à modifier
    const pointElement = stepElement.querySelector('.absolute.left-0.top-0');
    const lineElement = stepElement.querySelector('.absolute.left-\\[7px\\]');
    const toggleButton = stepElement.querySelector('.step-toggle');
    const activityLog = stepElement.querySelector('.step-activity-log');
    
    // Réinitialiser les classes
    pointElement.className = 'absolute left-0 top-0 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm';
    
    // Réinitialiser toutes les lignes verticales pour éviter les confusions visuelles
    if (status === 'active') {
        // Réinitialiser toutes les lignes verticales des autres étapes
        document.querySelectorAll('.absolute.left-\\[7px\\]').forEach(line => {
            line.classList.remove('bg-accent', 'bg-secondary', 'bg-danger');
            line.classList.add('bg-gray-200');
        });
    }
    
    // Appliquer les styles en fonction du statut
    switch (status) {
        case 'waiting':
            pointElement.classList.add('bg-gray-400');
            lineElement.classList.remove('bg-accent', 'bg-secondary', 'bg-danger');
            lineElement.classList.add('bg-gray-200');
            
            // Masquer le bouton de toggle et le log d'activité
            if (toggleButton) toggleButton.classList.add('hidden');
            if (activityLog) activityLog.classList.add('hidden');
            break;
            
        case 'active':
            pointElement.classList.add('bg-accent', 'animate-pulse');
            lineElement.classList.remove('bg-gray-200', 'bg-secondary', 'bg-danger');
            lineElement.classList.add('bg-accent');
            
            // Afficher le log d'activité pour l'étape active
            if (activityLog) activityLog.classList.remove('hidden');
            break;
            
        case 'completed':
            pointElement.classList.add('bg-secondary');
            lineElement.classList.remove('bg-gray-200', 'bg-accent', 'bg-danger');
            lineElement.classList.add('bg-secondary');
            
            // Afficher le bouton de toggle pour les étapes terminées
            if (toggleButton) toggleButton.classList.remove('hidden');
            
            // Replier automatiquement le log d'activité
            if (activityLog) activityLog.classList.add('hidden');
            
            // Mettre à jour l'icône du bouton de toggle
            if (toggleButton) {
                const icon = toggleButton.querySelector('.bi');
                if (icon) {
                    icon.classList.remove('bi-chevron-up');
                    icon.classList.add('bi-chevron-down');
                }
            }
            break;
            
        case 'error':
            pointElement.classList.add('bg-danger');
            lineElement.classList.remove('bg-gray-200', 'bg-accent', 'bg-secondary');
            lineElement.classList.add('bg-danger');
            
            // Garder le log d'activité visible en cas d'erreur
            if (activityLog) activityLog.classList.remove('hidden');
            break;
    }
    
    // Mettre à jour le message de statut
    const statusElement = stepElement.querySelector('.step-status');
    if (statusElement) {
        let statusHTML = '';
        
        switch (status) {
            case 'waiting':
                statusHTML = `<span class="text-gray-500"><i class="bi bi-clock mr-1"></i>En attente...</span>`;
                break;
            case 'active':
                statusHTML = `<span class="text-accent"><i class="bi bi-arrow-clockwise mr-1 animate-spin"></i>En cours...</span>`;
                break;
            case 'completed':
                statusHTML = `<span class="text-secondary"><i class="bi bi-check-circle mr-1"></i>Terminé</span>`;
                break;
            case 'error':
                statusHTML = `<span class="text-danger"><i class="bi bi-exclamation-circle mr-1"></i>${message || 'Erreur'}</span>`;
                break;
        }
        
        statusElement.innerHTML = statusHTML;
    }
}

// Fonction pour naviguer vers un onglet spécifique
function navigateToTab(tabId) {
    // Masquer toutes les sections
    const sections = document.querySelectorAll('main > section');
    sections.forEach(section => {
        section.classList.add('hidden');
    });
    
    // Afficher la section demandée
    const targetSection = document.getElementById(`section-${tabId}`);
    if (targetSection) {
        targetSection.classList.remove('hidden');
    }
    
    // Mettre à jour les liens de navigation
    const navLinks = document.querySelectorAll('nav a');
    navLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href === `#${tabId}`) {
            link.classList.add('text-primary', 'border-b-2', 'border-primary', 'font-medium');
            link.classList.remove('text-gray-500');
        } else {
            link.classList.remove('text-primary', 'border-b-2', 'border-primary', 'font-medium');
            link.classList.add('text-gray-500');
        }
    });
}

// Fonction pour enregistrer une activité dans le log d'une étape
function logStepActivity(stepId, message, type = 'info') {
    const stepElement = document.getElementById(`${stepId}-step`);
    if (!stepElement) return;
    
    const activityLogContent = stepElement.querySelector('.activity-log-content');
    if (!activityLogContent) return;
    
    // Créer un nouvel élément de log
    const logItem = document.createElement('div');
    logItem.className = 'activity-log-item flex items-start';
    
    // Déterminer l'icône et la couleur en fonction du type
    let iconClass = 'bi-info-circle text-primary';
    
    switch (type) {
        case 'success':
            iconClass = 'bi-check-circle text-secondary';
            break;
        case 'warning':
            iconClass = 'bi-exclamation-triangle text-accent';
            break;
        case 'error':
            iconClass = 'bi-exclamation-circle text-danger';
            break;
        case 'processing':
            iconClass = 'bi-arrow-clockwise text-primary animate-spin';
            break;
    }
    
    // Ajouter l'horodatage
    const now = new Date();
    const timestamp = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    
    // Construire le contenu du log
    logItem.innerHTML = `
        <div class="flex-shrink-0 mr-2">
            <i class="bi ${iconClass}"></i>
        </div>
        <div class="flex-grow">
            <div class="text-gray-700">${message}</div>
            <div class="text-xs text-gray-500">${timestamp}</div>
        </div>
    `;
    
    // Ajouter le log au début du conteneur (pour que les plus récents soient en haut)
    activityLogContent.insertBefore(logItem, activityLogContent.firstChild);
    
    // Limiter le nombre de logs à 20 par étape pour éviter une surcharge
    const logItems = activityLogContent.querySelectorAll('.activity-log-item');
    if (logItems.length > 20) {
        activityLogContent.removeChild(logItems[logItems.length - 1]);
    }
}

// Fonction pour gérer le workflow de test
async function runAnalysisWorkflow(isTestData = true) {
    console.log("Démarrage de l'analyse");
    
    // Naviguer vers l'onglet de traitement
    navigateToTab('traitement');
    
    // Réinitialiser explicitement toutes les étapes au statut "waiting"
    const steps = ['data-loading', 'tag-extraction', 'tag-normalization', 'synthesis-generation'];
    steps.forEach(step => updateStepStatus(step, 'waiting'));
    
    // Désactiver le bouton d'analyse pendant le traitement
    const analyzeBtn = getElement('analyzeBtn');
    let originalContent = '';
    if (analyzeBtn) {
        originalContent = analyzeBtn.innerHTML;
        analyzeBtn.innerHTML = `
            <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
            Analyse en cours...
        `;
        analyzeBtn.disabled = true;
    }

    try {
        // Initialiser l'ID de session pour le suivi du traitement
        let sessionId = null;
        
        // Démarrer le traitement sur le serveur
        let response;
        if (isTestData) {
            // Utiliser les données de test
            logStepActivity('data-loading', 'Démarrage de l\'analyse avec les données de test', 'info');
            updateStepStatus('data-loading', 'active');
            
            response = await fetch('/start_analysis', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ use_test_data: true })
            });
        } else {
            // Utiliser les données importées
            const fileInput = getElement('fileInput');
            if (!fileInput || !fileInput.files.length) {
                logStepActivity('data-loading', 'Aucun fichier sélectionné', 'error');
                throw new Error("Aucun fichier sélectionné");
            }
            
            const file = fileInput.files[0];
            logStepActivity('data-loading', `Préparation du fichier: ${file.name} (${formatFileSize(file.size)})`, 'info');
            updateStepStatus('data-loading', 'active');
            
            const formData = new FormData();
            formData.append('file', file);
            
            response = await fetch('/start_analysis', {
                method: 'POST',
                body: formData
            });
        }
        
        if (!response.ok) {
            const errorText = await response.text();
            logStepActivity('data-loading', `Erreur HTTP: ${response.status} - ${errorText}`, 'error');
            throw new Error(`Erreur HTTP: ${response.status}`);
        }
        
        // Récupérer l'ID de session pour le suivi
        const startData = await response.json();
        if (startData.error) {
            throw new Error(startData.error);
        }
        
        sessionId = startData.session_id;
        console.log("Session d'analyse démarrée:", sessionId);
        
        // Fonction pour suivre l'avancement du traitement
        const pollProgress = async () => {
            const progressResponse = await fetch(`/analysis_progress/${sessionId}`);
            if (!progressResponse.ok) {
                throw new Error(`Erreur lors de la récupération de la progression: ${progressResponse.status}`);
            }
            return await progressResponse.json();
        };
        
        // Suivre l'avancement jusqu'à ce que le traitement soit terminé
        let isComplete = false;
        let currentStep = 'data-loading';
        let results = null;
        
        while (!isComplete) {
            // Attendre un court délai entre chaque vérification
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Récupérer l'état d'avancement
            const progressData = await pollProgress();
            
            // Traiter les logs d'activité
            if (progressData.logs && progressData.logs.length > 0) {
                progressData.logs.forEach(log => {
                    // Déterminer l'étape concernée par le log
                    let logStep = currentStep;
                    
                    // Détecter l'étape à partir du message de log
                    if (log.message.includes('Extraction des tags')) {
                        logStep = 'tag-extraction';
                    } else if (log.message.includes('Normalisation des tags')) {
                        logStep = 'tag-normalization';
                    } else if (log.message.includes('Génération des synthèses')) {
                        logStep = 'synthesis-generation';
                    } else if (log.message.includes('Lecture du fichier') || log.message.includes('Chargement des données')) {
                        logStep = 'data-loading';
                    }
                    
                    // Déterminer le type de log
                    let logType = 'info';
                    if (log.message.includes('terminé') || log.message.includes('succès')) {
                        logType = 'success';
                    } else if (log.message.includes('Erreur') || log.message.includes('erreur')) {
                        logType = 'error';
                    } else if (log.message.includes('en cours') || log.message.includes('démarrage')) {
                        logType = 'processing';
                    }
                    
                    // Enregistrer le log dans l'interface
                    logStepActivity(logStep, log.message, logType);
                });
            }
            
            // Mettre à jour l'étape actuelle si elle a changé
            if (progressData.current_step && progressData.current_step !== currentStep) {
                // Marquer l'étape précédente comme terminée
                updateStepStatus(currentStep, 'completed');
                
                // Passer à la nouvelle étape
                currentStep = progressData.current_step;
                updateStepStatus(currentStep, 'active');
            }
            
            // Vérifier si le traitement est terminé
            if (progressData.status === 'completed') {
                isComplete = true;
                results = progressData.results;
                
                // Marquer la dernière étape comme terminée
                updateStepStatus(currentStep, 'completed');
            } else if (progressData.status === 'error') {
                // Gérer les erreurs
                updateStepStatus(currentStep, 'error', progressData.error_message);
                throw new Error(progressData.error_message || "Une erreur est survenue lors de l'analyse");
            }
        }
        
        // Afficher les résultats
        if (results) {
            displayResults(results);
        }

        // Afficher un message de succès
        showAlert("Analyse effectuée avec succès !", "success");
        
        // Attendre un peu avant de naviguer vers l'onglet des synthèses
        setTimeout(() => {
            navigateToTab('syntheses');
        }, 1000);

    } catch (error) {
        console.error("Erreur lors de l'analyse:", error);
        
        // Mettre à jour le statut de l'étape en cours avec l'erreur
        const activeStep = steps.find(step => 
            document.getElementById(`${step}-step`)?.querySelector('.text-accent') !== null
        );
        if (activeStep) {
            logStepActivity(activeStep, `Erreur: ${error.message}`, 'error');
            updateStepStatus(activeStep, 'error', error.message);
        }

        showAlert(error.message || "Une erreur est survenue lors de l'analyse", "danger");
    } finally {
        // Restaurer l'état original du bouton dans tous les cas
        if (analyzeBtn) {
            analyzeBtn.innerHTML = originalContent;
            analyzeBtn.disabled = false;
        }
    }
}

// Fonction pour initialiser le toggle des sources de données
function initDataSourceToggle() {
    const testDataBtn = getElement('testDataBtn');
    const myDataBtn = getElement('myDataBtn');
    const testDataPreview = getElement('testDataPreview');
    const myDataUpload = getElement('myDataUpload');
    
    if (testDataBtn && myDataBtn) {
        // Gestion du clic sur le bouton Données de test
        testDataBtn.addEventListener('click', function() {
            // Mettre à jour les classes des boutons
            testDataBtn.classList.add('bg-white', 'text-primary', 'shadow');
            testDataBtn.classList.remove('text-gray-500', 'bg-transparent');
            
            myDataBtn.classList.remove('bg-white', 'text-primary', 'shadow');
            myDataBtn.classList.add('text-gray-500', 'bg-transparent');
            
            // Afficher/masquer les sections correspondantes
            if (testDataPreview) testDataPreview.classList.remove('hidden');
            if (myDataUpload) myDataUpload.classList.add('hidden');
        });
        
        // Gestion du clic sur le bouton Mes données
        myDataBtn.addEventListener('click', function() {
            // Mettre à jour les classes des boutons
            myDataBtn.classList.add('bg-white', 'text-primary', 'shadow');
            myDataBtn.classList.remove('text-gray-500', 'bg-transparent');
            
            testDataBtn.classList.remove('bg-white', 'text-primary', 'shadow');
            testDataBtn.classList.add('text-gray-500', 'bg-transparent');
            
            // Afficher/masquer les sections correspondantes
            if (myDataUpload) myDataUpload.classList.remove('hidden');
            if (testDataPreview) testDataPreview.classList.add('hidden');
        });
    }
    
    // Gestion du bouton Analyser
    const analyzeBtn = getElement('analyzeBtn');
    if (analyzeBtn) {
        analyzeBtn.addEventListener('click', function() {
            // Déterminer quelle source de données est active
            const isTestData = testDataBtn && testDataBtn.classList.contains('text-primary');
            
            // Lancer l'analyse
            runAnalysisWorkflow(isTestData);
        });
    }
}

// Initialisation de la navigation
document.addEventListener('DOMContentLoaded', function() {
    // Ajouter des gestionnaires d'événements pour les liens de navigation
    const navLinks = document.querySelectorAll('nav a');
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const href = this.getAttribute('href');
            const tabId = href.substring(1); // Enlever le # du début
            navigateToTab(tabId);
        });
    });
    
    // Initialiser la navigation sur l'onglet Démarrer par défaut
    navigateToTab('demarrer');
});

// Fonction pour formater les tags
function formatTags(tags, colorClass = 'bg-primary') {
    if (!tags || tags.length === 0) return '<span class="text-gray-400">Aucun tag</span>';
    return tags.map(tag => `
        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass} text-white mr-1 mb-1">
            ${tag}
        </span>
    `).join('');
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
    // Afficher l'onglet de synthèse
    const synthesisTab = document.getElementById('synthesis-tab');
    if (synthesisTab) {
        const tabInstance = new bootstrap.Tab(synthesisTab);
        tabInstance.show();
    }
}

// Fonction pour charger les données de test
function loadTestData() {
    const testDataTable = getElement('testDataTable');
    if (testDataTable) {
        fetch('/get_test_data_preview')
            .then(response => response.json())
            .then(data => {
                testDataTable.innerHTML = '';
                
                data.forEach(item => {
                    const row = document.createElement('tr');
                    row.className = 'hover:bg-gray-50 transition-colors';
                    
                    const idCell = document.createElement('td');
                    idCell.className = 'py-3 px-3 border-b border-gray-200';
                    idCell.textContent = item.id;
                    
                    const responseCell = document.createElement('td');
                    responseCell.className = 'py-3 px-3 border-b border-gray-200';
                    responseCell.textContent = item.response;
                    
                    row.appendChild(idCell);
                    row.appendChild(responseCell);
                    testDataTable.appendChild(row);
                });
            })
            .catch(error => {
                console.error('Erreur lors du chargement des données de test:', error);
                testDataTable.innerHTML = `
                    <tr>
                        <td colspan="2" class="py-3 px-3 text-center text-gray-500">
                            <i class="bi bi-exclamation-triangle-fill mr-2"></i>
                            Erreur lors du chargement des données de test
                        </td>
                    </tr>
                `;
            });
    }
} 