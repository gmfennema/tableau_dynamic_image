// script.js

document.addEventListener('DOMContentLoaded', () => {
    tableau.extensions.initializeAsync().then(() => {
      const saved = tableau.extensions.settings.get('imageConfig');
      if (saved) {
        const cfg = JSON.parse(saved);
        hideConfig();
        setupImageListener(cfg);
      } else {
        showConfig();
      }
    });
  });
  
  function showConfig() {
    const dash = tableau.extensions.dashboardContent.dashboard;
    const selW = document.getElementById('worksheetSelect');
    dash.worksheets.forEach(w => {
      const o = document.createElement('option');
      o.value = w.name; o.textContent = w.name;
      selW.appendChild(o);
    });
  
    selW.addEventListener('change', async () => {
      const worksheet = dash.worksheets.find(w => w.name === selW.value);
      const cols = (await worksheet.getSummaryDataAsync()).columns.map(c => c.fieldName);
  
      const urlCol = document.getElementById('urlColumn');
      urlCol.innerHTML = '<option value="" disabled selected>Select Column</option>';
      cols.forEach(cn => {
        const o = document.createElement('option');
        o.value = cn; o.textContent = cn;
        urlCol.appendChild(o);
      });
      document.getElementById('columnSelect').style.display = 'block';
  
      urlCol.addEventListener('change', async () => {
        const config = { worksheetName: selW.value, columnName: urlCol.value };
        tableau.extensions.settings.set('imageConfig', JSON.stringify(config));
        await tableau.extensions.settings.saveAsync();
        hideConfig();
        setupImageListener(config);
      }, { once: true });
    }, { once: true });
  }
  
  function hideConfig() {
    document.getElementById('configSection').classList.add('hidden');
  }
  
  // Utility: fetch + blob → dataURL
  async function toDataURL(url) {
    try {
      const resp = await fetch(url, { mode: 'cors' });
      if (!resp.ok) {
        console.warn(`Fetch failed for ${url} with status: ${resp.status} ${resp.statusText}`);
        return null;
      }
      const blob = await resp.blob();
      if (!blob.type.startsWith('image/')) {
        console.warn(`Fetched content for ${url} is not an image. MIME type: ${blob.type}`);
        return null;
      }
      return await new Promise((res, rej) => {
        const reader = new FileReader();
        reader.onloadend = () => res(reader.result);
        reader.onerror = (error) => {
          console.error(`FileReader error for ${url}:`, error);
          rej(error);
        };
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.error(`Exception in toDataURL for ${url}:`, e);
      return null;
    }
  }
  
  function setupImageListener(config) {
    const dash = tableau.extensions.dashboardContent.dashboard;
    const worksheet = dash.worksheets.find(w => w.name === config.worksheetName);
    const imageContainer = document.getElementById('imageContainer');
  
    const update = async () => {
      await new Promise(r => setTimeout(r, 250));

      imageContainer.style.backgroundImage = 'none';

      console.log('[ImageExt] Update triggered for background image');

      try {
        const dataTable = await worksheet.getSummaryDataAsync();
        const columnIndex = dataTable.columns.findIndex(c => c.fieldName === config.columnName);

        if (dataTable.data.length > 0 && columnIndex >= 0) {
          const urlValue = dataTable.data[0][columnIndex].value;
          if (typeof urlValue === 'string' && /^https?:\/\//.test(urlValue)) {
            console.log(`[ImageExt] Attempting to load image for background: ${urlValue}`);
            const embeddedDataUrl = await toDataURL(urlValue);

            if (embeddedDataUrl) {
              console.log(`[ImageExt] Successfully converted to dataURL. Setting background image.`);
              imageContainer.style.backgroundImage = `url(${embeddedDataUrl})`;
            } else {
              console.warn(`[ImageExt] Failed to convert ${urlValue} to dataURL for background. Container will have no background image.`);
              imageContainer.style.backgroundImage = 'none';
            }
          } else {
            console.warn(`[ImageExt] Invalid or non-HTTP/S URL found for background: '${urlValue}'.`);
            imageContainer.style.backgroundImage = 'none';
          }
        } else {
          console.warn(`[ImageExt] No data found for background image. Worksheet '${config.worksheetName}', column '${config.columnName}'.`);
          imageContainer.style.backgroundImage = 'none';
        }
      } catch (e) {
        console.error(`[ImageExt] Error during background image update sequence:`, e);
        imageContainer.style.backgroundImage = 'none';
      }
    };
  
    update();
    dash.getParametersAsync()
      .then(params => params.forEach(p =>
        p.addEventListener(tableau.TableauEventType.ParameterChanged, update)));
  }