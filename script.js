document.addEventListener('DOMContentLoaded', () => {
    tableau.extensions.initializeAsync().then(() => {
        const savedConfig = tableau.extensions.settings.get('imageConfig');
        if (savedConfig) {
            const config = JSON.parse(savedConfig);
            hideConfig();
            setupImageListener(config);
        } else {
            showConfig();
        }
    });
});

function showConfig() {
    const configSection = document.getElementById('configSection');
    configSection.classList.remove('hidden');
    
    // Populate worksheet dropdown
    const worksheetSelect = document.getElementById('worksheetSelect');
    const dashboard = tableau.extensions.dashboardContent.dashboard;
    dashboard.worksheets.forEach(worksheet => {
        const option = document.createElement('option');
        option.value = worksheet.name;
        option.textContent = worksheet.name;
        worksheetSelect.appendChild(option);
    });

    // Handle worksheet selection
    worksheetSelect.addEventListener('change', async () => {
        const worksheet = dashboard.worksheets.find(w => w.name === worksheetSelect.value);
        const columns = await getWorksheetColumns(worksheet);
        
        const columnSelect = document.getElementById('columnSelect');
        const urlColumn = document.getElementById('urlColumn');
        
        urlColumn.innerHTML = '<option value="" disabled selected>Select Column</option>';
        columns.forEach(column => {
            const option = document.createElement('option');
            option.value = column;
            option.textContent = column;
            urlColumn.appendChild(option);
        });
        
        columnSelect.style.display = 'block';
        
        // Handle column selection
        urlColumn.addEventListener('change', () => {
            const config = {
                worksheetName: worksheetSelect.value,
                columnName: urlColumn.value
            };
            
            // Save configuration
            tableau.extensions.settings.set('imageConfig', JSON.stringify(config));
            tableau.extensions.settings.saveAsync().then(() => {
                hideConfig();
                setupImageListener(config);
            });
        });
    });
}

async function getWorksheetColumns(worksheet) {
    const dataTable = await worksheet.getSummaryDataAsync();
    return dataTable.columns.map(column => column.fieldName);
}

function hideConfig() {
    document.getElementById('configSection').classList.add('hidden');
}

function setupImageListener(config) {
    const dashboard = tableau.extensions.dashboardContent.dashboard;
    const worksheet = dashboard.worksheets.find(w => w.name === config.worksheetName);
    
    const updateImage = async () => {
        try {
            const dataTable = await worksheet.getSummaryDataAsync();
            const columnIndex = dataTable.columns.findIndex(col => col.fieldName === config.columnName);
            
            if (dataTable.data.length > 0 && columnIndex !== -1) {
                const imageUrl = dataTable.data[0][columnIndex].value;
                const img = document.getElementById('displayImage');
                img.src = imageUrl;
                img.style.display = 'block';
                
                // Handle load errors
                img.onerror = () => {
                    img.style.display = 'none';
                };
            }
        } catch (error) {
            console.error('Error updating image:', error);
        }
    };

    // Initial update
    updateImage();
    
    // Listen for changes
    worksheet.addEventListener(tableau.TableauEventType.MarkSelectionChanged, updateImage);
    worksheet.addEventListener(tableau.TableauEventType.FilterChanged, updateImage);
    worksheet.addEventListener(tableau.TableauEventType.ParameterChanged, updateImage);
}