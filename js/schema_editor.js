// ─── ÉDITEUR DE SCHÉMA (ENLISSAGE / ATTACHAGE / PÉDALAGE) ────────────────────

const SchemaEditor = {
  // Données des 3 grilles : tableaux 2D de booléens
  enlissage:  [],  // [row][col] — rows=cadres, cols=fils
  attachage:  [],  // [row][col] — rows=cadres, cols=pédales
  pedalage:   [],  // [row][col] — rows=duites, cols=pédales

  // Dimensions courantes
  cols: 24,      // fils de chaîne
  rows: 16,      // duites
  shafts: 4,     // cadres
  treadles: 4,   // pédales

  // État du drag
  _dragging: false,
  _paintValue: true,

  init() {
    this.readDimensions();
    this.initData();
    this.render();
  },

  readDimensions() {
    this.cols     = parseInt(document.getElementById('schema-cols')?.value)     || 24;
    this.rows     = parseInt(document.getElementById('schema-rows')?.value)     || 16;
    this.shafts   = parseInt(document.getElementById('schema-shafts')?.value)   || 4;
    this.treadles = parseInt(document.getElementById('schema-treadles')?.value) || 4;
  },

  initData(keepExisting = false) {
    const makeGrid = (r, c, existing) => {
      const g = [];
      for (let i = 0; i < r; i++) {
        g[i] = [];
        for (let j = 0; j < c; j++) {
          g[i][j] = (keepExisting && existing?.[i]?.[j]) ? true : false;
        }
      }
      return g;
    };
    // Enlissage : cadres (lignes) × fils (colonnes)
    this.enlissage  = makeGrid(this.shafts, this.cols,     keepExisting ? this.enlissage  : null);
    // Attachage : cadres (lignes) × pédales (colonnes)
    this.attachage  = makeGrid(this.shafts, this.treadles, keepExisting ? this.attachage  : null);
    // Pédalage : duites (lignes) × pédales (colonnes)
    this.pedalage   = makeGrid(this.rows,   this.treadles, keepExisting ? this.pedalage   : null);
  },

  render() {
    // Enlissage : cadres × fils
    this._renderGrid('grid-enlissage', this.enlissage, this.shafts, this.cols,     'enlissage');
    // Attachage : cadres × pédales
    this._renderGrid('grid-attachage',  this.attachage,  this.shafts, this.treadles, 'attachage');
    // Pédalage : duites × pédales
    this._renderGrid('grid-pedalage',   this.pedalage,   this.rows,   this.treadles, 'pedalage');
  },

  _renderGrid(containerId, data, rows, cols, gridName) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Taille des cellules selon le nombre de colonnes
    const cellSize = cols > 32 ? 10 : cols > 20 ? 12 : 14;

    container.innerHTML = '';
    container.style.display = 'grid';
    container.style.gridTemplateColumns = `repeat(${cols}, ${cellSize}px)`;
    container.style.gridTemplateRows    = `repeat(${rows}, ${cellSize}px)`;
    container.style.gap = '1px';
    container.style.userSelect = 'none';
    container.style.cursor = 'crosshair';

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = document.createElement('div');
        cell.className = 'schema-cell' + (data[r][c] ? ' filled' : '');
        cell.dataset.grid = gridName;
        cell.dataset.r = r;
        cell.dataset.c = c;

        cell.addEventListener('mousedown', e => {
          e.preventDefault();
          this._dragging = true;
          this._paintValue = !data[r][c];
          this._toggle(gridName, r, c, this._paintValue);
        });
        cell.addEventListener('mouseover', () => {
          if (this._dragging) this._toggle(gridName, r, c, this._paintValue);
        });
        // Support tactile mobile
        cell.addEventListener('touchstart', e => {
          e.preventDefault();
          this._dragging = true;
          this._paintValue = !data[r][c];
          this._toggle(gridName, r, c, this._paintValue);
        }, { passive: false });
        cell.addEventListener('touchmove', e => {
          e.preventDefault();
          const touch = e.touches[0];
          const el = document.elementFromPoint(touch.clientX, touch.clientY);
          if (el && el.dataset.grid) {
            const tr = parseInt(el.dataset.r);
            const tc = parseInt(el.dataset.c);
            this._toggle(el.dataset.grid, tr, tc, this._paintValue);
          }
        }, { passive: false });
        cell.addEventListener('touchend', () => { this._dragging = false; });

        container.appendChild(cell);
      }
    }

    // Stop drag on mouseup anywhere
    document.addEventListener('mouseup', () => { this._dragging = false; }, { once: false });
  },

  _toggle(gridName, r, c, value) {
    const data = this[gridName];
    if (!data?.[r]) return;

    // Règles d'exclusivité :
    // Enlissage : une seule case noire PAR COLONNE (chaque fil = 1 cadre)
    // Pédalage  : une seule case noire PAR LIGNE (chaque duite = 1 pédale)
    if (value) {
      if (gridName === 'enlissage') {
        // Effacer toute la colonne c
        for (let row = 0; row < this.shafts; row++) {
          data[row][c] = false;
        }
      } else if (gridName === 'pedalage') {
        // Effacer toute la ligne r
        for (let col = 0; col < this.treadles; col++) {
          data[r][col] = false;
        }
      }
    }

    data[r][c] = value;

    // Re-render complet de la grille concernée
    const containerId = gridName === 'enlissage'  ? 'grid-enlissage'  :
                        gridName === 'attachage'   ? 'grid-attachage'  : 'grid-pedalage';
    const rows = gridName === 'enlissage'  ? this.shafts :
                 gridName === 'attachage'  ? this.shafts : this.rows;
    const cols = gridName === 'enlissage'  ? this.cols :
                 gridName === 'attachage'  ? this.treadles : this.treadles;
    this._renderGrid(containerId, data, rows, cols, gridName);
    this.saveToHiddenField();
  },

  saveToHiddenField() {
    const field = document.getElementById('schema-data');
    if (!field) return;
    field.value = JSON.stringify({
      cols:      this.cols,
      rows:      this.rows,
      shafts:    this.shafts,
      treadles:  this.treadles,
      enlissage: this.enlissage,
      attachage: this.attachage,
      pedalage:  this.pedalage,
    });
    this.validateSchema();
  },

  // ─── VALIDATION DES TROIS GRILLES ────────────────────────────────────────────
  // Enlissage  : chaque LIGNE (cadre) doit avoir au moins 1 case pleine
  //              chaque COLONNE (fil) doit avoir exactement 1 case pleine (règle d'exclusivité)
  // Attachage  : chaque LIGNE (cadre) et chaque COLONNE (pédale) doit avoir
  //              au moins 1 case pleine ET au moins 1 case vide
  // Pédalage   : chaque LIGNE (duite) doit avoir exactement 1 case pleine (règle d'exclusivité)
  validateSchema() {
    const zone = document.getElementById('schema-validation');
    if (!zone) return;

    const warnings = [];

    // ── Enlissage ──
    const enl   = this.enlissage;
    const nEnlR = this.shafts;  // cadres = lignes
    const nEnlC = this.cols;    // fils   = colonnes

    // Chaque ligne (cadre) doit avoir au moins 1 fil enlissé
    for (let r = 0; r < nEnlR; r++) {
      const filled = enl[r].filter(v => v).length;
      if (filled === 0) {
        warnings.push(`Enlissage — cadre ${r + 1} : aucun fil enlissé (ligne entièrement vide).`);
      }
    }
    // Chaque colonne (fil) doit avoir exactement 1 case (déjà garanti par _toggle, mais on vérifie)
    for (let c = 0; c < nEnlC; c++) {
      const filled = enl.filter(row => row[c]).length;
      if (filled === 0) {
        warnings.push(`Enlissage — fil ${c + 1} : non enlissé (aucun cadre assigné).`);
      } else if (filled > 1) {
        warnings.push(`Enlissage — fil ${c + 1} : enlissé sur ${filled} cadres (1 seul autorisé).`);
      }
    }

    // ── Attachage ──
    const att   = this.attachage;
    const nAttR = this.shafts;    // cadres  = lignes
    const nAttC = this.treadles;  // pédales = colonnes

    for (let r = 0; r < nAttR; r++) {
      const filled = att[r].filter(v => v).length;
      if (filled === 0) {
        warnings.push(`Attachage — cadre ${r + 1} : aucune pédale assignée (ligne entièrement vide).`);
      } else if (filled === nAttC) {
        warnings.push(`Attachage — cadre ${r + 1} : toutes les pédales assignées (cadre toujours levé).`);
      }
    }
    for (let c = 0; c < nAttC; c++) {
      const filled = att.filter(row => row[c]).length;
      if (filled === 0) {
        warnings.push(`Attachage — pédale ${c + 1} : aucun cadre assigné (colonne entièrement vide).`);
      } else if (filled === nAttR) {
        warnings.push(`Attachage — pédale ${c + 1} : tous les cadres assignés (tous les fils levés en même temps).`);
      }
    }

    // ── Pédalage ──
    const ped   = this.pedalage;
    const nPedR = this.rows;      // duites  = lignes
    const nPedC = this.treadles;  // pédales = colonnes

    for (let r = 0; r < nPedR; r++) {
      const filled = ped[r].filter(v => v).length;
      if (filled === 0) {
        warnings.push(`Pédalage — duite ${r + 1} : aucune pédale actionnée (ligne entièrement vide).`);
      } else if (filled > 1) {
        warnings.push(`Pédalage — duite ${r + 1} : ${filled} pédales actionnées simultanément (1 seule autorisée).`);
      }
    }

    // ── Affichage ──
    if (warnings.length === 0) {
      zone.innerHTML = '<div class="schema-valid">&#10003; Schéma valide — enlissage, attachage et pédalage respectent toutes les règles.</div>';
    } else {
      zone.innerHTML = warnings
        .map(w => `<div class="schema-warning">&#9888; ${w}</div>`)
        .join('');
    }
  },

  loadFromData(data) {
    if (!data) return;
    try {
      const d = typeof data === 'string' ? JSON.parse(data) : data;
      this.cols     = d.cols     || 24;
      this.rows     = d.rows     || 16;
      this.shafts   = d.shafts   || 4;
      this.treadles = d.treadles || 4;
      // Compatibilité ascendante : ancienne clé "enlacement" → "enlissage"
      this.enlissage  = d.enlissage  || d.enlacement || [];
      this.attachage  = d.attachage  || [];
      this.pedalage   = d.pedalage   || [];
      // Sync les inputs
      const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
      setVal('schema-cols',     this.cols);
      setVal('schema-rows',     this.rows);
      setVal('schema-shafts',   this.shafts);
      setVal('schema-treadles', this.treadles);
      this.render();
      this.saveToHiddenField();
      this.validateSchema();
    } catch(e) { console.warn('Schema load error', e); }
  },

  clear() {
    this.initData(false);
    this.render();
    this.saveToHiddenField();
    this.validateSchema();
  },

  resize() {
    this.readDimensions();
    this.initData(true);
    this.render();
    this.saveToHiddenField();
  },

  // Rendu en vue détail (lecture seule)
  renderReadOnly(containerId, data) {
    if (!data) return;
    const d = typeof data === 'string' ? JSON.parse(data) : data;
    const container = document.getElementById(containerId);
    if (!container) return;

    const makeReadOnlyGrid = (parentEl, label, gridData, rows, cols) => {
      const zone = document.createElement('div');
      zone.className = 'draft-zone-readonly';
      const lbl = document.createElement('div');
      lbl.className = 'draft-label';
      lbl.textContent = label;
      zone.appendChild(lbl);

      const cellSize = cols > 32 ? 8 : cols > 20 ? 10 : 12;
      const grid = document.createElement('div');
      grid.style.display = 'grid';
      grid.style.gridTemplateColumns = `repeat(${cols}, ${cellSize}px)`;
      grid.style.gridTemplateRows    = `repeat(${rows}, ${cellSize}px)`;
      grid.style.gap = '1px';

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const cell = document.createElement('div');
          cell.className = 'schema-cell-ro' + (gridData?.[r]?.[c] ? ' filled' : '');
          grid.appendChild(cell);
        }
      }
      zone.appendChild(grid);
      parentEl.appendChild(zone);
    };

    container.innerHTML = '';
    container.className = 'draft-container draft-readonly-wrapper';

    // Enlissage : colonne 1
    const zoneEnl = document.createElement('div');
    zoneEnl.className = 'draft-zone-enlacement';
    // Compatibilité ascendante
    const enlData = d.enlissage || d.enlacement;
    makeReadOnlyGrid(zoneEnl, 'Enlissage', enlData, d.shafts, d.cols);
    container.appendChild(zoneEnl);

    // Attachage : colonne 2, ligne 1
    const zoneAtt = document.createElement('div');
    zoneAtt.className = 'draft-zone-attachage';
    makeReadOnlyGrid(zoneAtt, 'Attachage', d.attachage, d.shafts, d.treadles);
    container.appendChild(zoneAtt);

    // Pédalage : colonne 2, ligne 2
    const zonePed = document.createElement('div');
    zonePed.className = 'draft-zone-pedalage';
    makeReadOnlyGrid(zonePed, 'Pédalage', d.pedalage, d.rows, d.treadles);
    container.appendChild(zonePed);
  }
};

// Fonctions globales appelées depuis le HTML
function resizeSchemaGrids() {
  SchemaEditor.resize();
  updateSchemaPreview();
}
function clearSchema() {
  SchemaEditor.clear();
  updateSchemaPreview();
}

// Basculer l'éditeur de schéma
function toggleSchemaEditor() {
  const editorZone  = document.getElementById('schema-editor-zone');
  const previewZone = document.getElementById('schema-preview-zone');
  const btn         = document.getElementById('btn-edit-schema');
  if (!editorZone) return;

  const isOpen = editorZone.style.display !== 'none';
  if (isOpen) {
    closeSchemaEditor();
  } else {
    editorZone.style.display  = 'block';
    previewZone.style.display = 'none';
    btn.textContent = 'Fermer l\'éditeur';
    // Charger les données existantes depuis le champ caché
    const field = document.getElementById('schema-data');
    if (field && field.value) {
      SchemaEditor.loadFromData(field.value);
    } else {
      SchemaEditor.init();
    }
  }
}

// Fermer l'éditeur et afficher l'aperçu
function closeSchemaEditor() {
  const editorZone  = document.getElementById('schema-editor-zone');
  const previewZone = document.getElementById('schema-preview-zone');
  const btn         = document.getElementById('btn-edit-schema');
  if (!editorZone) return;
  editorZone.style.display  = 'none';
  previewZone.style.display = 'block';
  btn.textContent = 'Modifier le schéma';
  updateSchemaPreview();
}

// Mettre à jour l'aperçu lecture seule dans le formulaire
function updateSchemaPreview() {
  const field = document.getElementById('schema-data');
  const display = document.getElementById('schema-readonly-display');
  if (!display) return;
  const raw = field ? field.value : '';
  if (!raw) {
    display.innerHTML = '<span style="color:var(--color-text-muted); font-size:0.85rem;">Aucun schéma — cliquez sur "Modifier le schéma" pour en créer un.</span>';
    return;
  }
  try {
    const d = JSON.parse(raw);
    // Compatibilité ascendante
    const enlData = d.enlissage || d.enlacement;
    const hasData = enlData?.some(row => row.some(v => v)) ||
                    d.attachage?.some(row => row.some(v => v)) ||
                    d.pedalage?.some(row => row.some(v => v));
    if (!hasData) {
      display.innerHTML = '<span style="color:var(--color-text-muted); font-size:0.85rem;">Schéma vide — cliquez sur "Modifier le schéma" pour le remplir.</span>';
      return;
    }
    display.innerHTML = '';
    SchemaEditor.renderReadOnly('schema-readonly-display', d);
  } catch(e) {
    display.innerHTML = '<span style="color:var(--color-text-muted); font-size:0.85rem;">Schéma non lisible.</span>';
  }
}
