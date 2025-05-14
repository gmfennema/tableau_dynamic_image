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
      const resp = await fetch(url);
      const blob = await resp.blob();
      return await new Promise((res, rej) => {
        const reader = new FileReader();
        reader.onloadend = () => res(reader.result);
        reader.onerror = rej;
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.warn('Could not fetch image as blob:', e);
      return null;
    }
  }
  
  function setupImageListener(config) {
    const dash = tableau.extensions.dashboardContent.dashboard;
    const worksheet = dash.worksheets.find(w => w.name === config.worksheetName);
    const img = document.getElementById('displayImage');
  
    const update = async () => {
      // give Tableau a moment to update filters/params
      await new Promise(r => setTimeout(r, 100));
      const data = await worksheet.getSummaryDataAsync();
      const idx = data.columns.findIndex(c => c.fieldName === config.columnName);
      if (data.data.length && idx >= 0) {
        const url = data.data[0][idx].value;
        if (typeof url === 'string' && /^https?:\/\//.test(url)) {
          let dataUrl = await toDataURL(url);
          if (!dataUrl) {
            // fallback: drop-in the remote URL directly
            img.crossOrigin = 'anonymous';
            dataUrl = url;
          }
          img.src = dataUrl;
          img.style.display = 'block';
          img.onerror = () => img.style.display = 'none';
        } else {
          img.style.display = 'none';
          img.src = '';
        }
      }
    };
  
    update();
    // re-run on parameter changes
    dash.getParametersAsync()
      .then(params => params.forEach(p =>
        p.addEventListener(tableau.TableauEventType.ParameterChanged, update)));
  }