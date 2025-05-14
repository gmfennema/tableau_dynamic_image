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
    const img = document.getElementById('displayImage');
  
    const update = async () => {
      // give Tableau a bit more time, especially for server-side rendering
      await new Promise(r => setTimeout(r, 250)); 

      img.style.display = 'none'; // Hide image by default
      img.src = ''; // Clear previous src to avoid showing stale image briefly
      img.onload = null; // Clear previous handlers
      img.onerror = null;

      console.log('[ImageExt] Update triggered');

      try {
        const dataTable = await worksheet.getSummaryDataAsync();
        const columnIndex = dataTable.columns.findIndex(c => c.fieldName === config.columnName);

        if (dataTable.data.length > 0 && columnIndex >= 0) {
          const urlValue = dataTable.data[0][columnIndex].value;
          if (typeof urlValue === 'string' && /^https?:\/\//.test(urlValue)) {
            console.log(`[ImageExt] Attempting to load image from: ${urlValue}`);
            const embeddedDataUrl = await toDataURL(urlValue);

            if (embeddedDataUrl) {
              console.log(`[ImageExt] Successfully converted to dataURL. Setting image src and waiting for onload.`);
              img.onload = () => {
                console.log(`[ImageExt] Image with dataURL loaded successfully via onload. Displaying image.`);
                img.style.display = 'block';
              };
              img.onerror = () => {
                console.error(`[ImageExt] Error rendering dataURL for ${urlValue}. Image will remain hidden.`);
                img.style.display = 'none'; // Ensure it stays hidden on error
                img.src = ''; // Clear src
              };
              img.src = embeddedDataUrl;
            } else {
              console.warn(`[ImageExt] Failed to convert ${urlValue} to dataURL. Image will remain hidden.`);
            }
          } else {
            console.warn(`[ImageExt] Invalid or non-HTTP/S URL found: '${urlValue}'. Image will remain hidden.`);
          }
        } else {
          console.warn(`[ImageExt] No data found in worksheet '${config.worksheetName}' or column '${config.columnName}' not found. Image will remain hidden.`);
        }
      } catch (e) {
        console.error(`[ImageExt] Error during update sequence:`, e);
        img.style.display = 'none'; // Ensure hidden on any unexpected error
        img.src = '';
      }
    };
  
    update();
    // re-run on parameter changes
    dash.getParametersAsync()
      .then(params => params.forEach(p =>
        p.addEventListener(tableau.TableauEventType.ParameterChanged, update)));
  }