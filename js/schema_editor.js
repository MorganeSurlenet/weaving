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
    BlocsEnlissage._applyColorsToGrid();
    // Attachage : cadres × pédales
    this._renderGrid('grid-attachage',  this.attachage,  this.shafts, this.treadles, 'attachage');
    // Pédalage : duites × pédales
    this._renderGrid('grid-pedalage',   this.pedalage,   this.rows,   this.treadles, 'pedalage');
    BlocsTrame._applyColorsToGrid();
    // Bande couleur trame
    BlocsTrame.renderBand();
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
    if (gridName === 'enlissage') BlocsEnlissage._applyColorsToGrid();
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
      // Blocs d'enlissage
      blocs:                  BlocsEnlissage.blocs,
      blocsSequence:          BlocsEnlissage._lastSequence || [],
      blocsColors:            BlocsEnlissage.occurrenceColors || [],
      blocsColOverrides:      BlocsEnlissage.colOverrideColors || {},
      // Blocs de trame
      trameBlocs:             BlocsTrame.blocs,
      trameSequence:          BlocsTrame._lastSequence || [],
      trameOccurrenceColors:  BlocsTrame.occurrenceColors || [],
      trameRowOverrides:      BlocsTrame.rowOverrideColors || {},
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
      // Restaurer les blocs d'enlissage
      if (d.blocs && d.blocs.length > 0) {
        BlocsEnlissage.blocs = d.blocs;
        BlocsEnlissage._lastSequence = d.blocsSequence || [];
        BlocsEnlissage.occurrenceColors = d.blocsColors || [];
        BlocsEnlissage.colOverrideColors = d.blocsColOverrides || {};
        BlocsEnlissage.render();
        BlocsEnlissage.renderBand();
        // Restaurer la séquence dans le champ texte
        const seqInput = document.getElementById('blocs-sequence');
        if (seqInput && d.blocsSequence && d.blocsSequence.length > 0) {
          seqInput.value = d.blocsSequence.join(' ');
        }
        // Mettre à jour la bande
        // (renderBand déjà appelé ci-dessus)
      }
      // Sync les inputs
      const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
      setVal('schema-cols',     this.cols);
      setVal('schema-rows',     this.rows);
      setVal('schema-shafts',   this.shafts);
      setVal('schema-treadles', this.treadles);
      // Restaurer les blocs de trame
      if (d.trameBlocs && d.trameBlocs.length > 0) {
        BlocsTrame.blocs = d.trameBlocs;
        BlocsTrame._lastSequence = d.trameSequence || [];
        BlocsTrame.occurrenceColors = d.trameOccurrenceColors || [];
        BlocsTrame.rowOverrideColors = d.trameRowOverrides || {};
        BlocsTrame.render();
        const trSeqInput = document.getElementById('trame-sequence');
        if (trSeqInput && d.trameSequence && d.trameSequence.length > 0) {
          const uniqueSeq = [...new Set(d.trameSequence)];
          trSeqInput.value = uniqueSeq.join(' ');
        }
      }
      this.render();
      BlocsTrame.renderBand();
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
    const prevShafts   = this.shafts;
    const prevTreadles = this.treadles;
    this.readDimensions();
    this.initData(true);
    // Mettre à jour les blocs d'enlissage si le nombre de cadres a changé
    if (this.shafts !== prevShafts) {
      BlocsEnlissage._resizeAllBlocs(this.shafts);
    }
    // Mettre à jour les blocs de trame si le nombre de pédales a changé
    if (this.treadles !== prevTreadles) {
      BlocsTrame._resizeAllBlocs(this.treadles);
    }
    this.render();
    this.saveToHiddenField();
  },

  // Rendu en vue détail (lecture seule)
  renderReadOnly(containerId, data) {
    if (!data) return;
    const d = typeof data === 'string' ? JSON.parse(data) : data;
    const container = document.getElementById(containerId);
    if (!container) return;

    const makeReadOnlyGrid = (parentEl, label, gridData, rows, cols, colColorMap, rtl) => {
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
      if (rtl) grid.style.direction = 'rtl';

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const cell = document.createElement('div');
          const filled = gridData?.[r]?.[c];
          cell.className = 'schema-cell-ro' + (filled ? ' filled' : '');
          // En mode rtl, la colonne visuelle c correspond à la colonne de données (cols-1-c)
          const dataCol = rtl ? (cols - 1 - c) : c;
          if (filled && colColorMap && colColorMap[dataCol]) {
            cell.style.background = colColorMap[dataCol];
            cell.style.borderColor = colColorMap[dataCol];
          }
          grid.appendChild(cell);
        }
      }
      zone.appendChild(grid);
      parentEl.appendChild(zone);
    };

    container.innerHTML = '';
    container.className = 'draft-container draft-readonly-wrapper';

    // Construire la map colonne → couleur effective depuis les données sauvegardées (avec surcharges)
    const roColMap = {};
    if (d.blocsSequence && d.blocsSequence.length && d.blocs && d.blocsColors) {
      const blocMap = {};
      d.blocs.forEach(b => { blocMap[b.name] = b; });
      const colOverrides = d.blocsColOverrides || {};
      let col = 0;
      d.blocsSequence.forEach((t, i) => {
        const bloc = blocMap[t];
        if (!bloc) return;
        const bSize = bloc.size || bloc.pattern?.[0]?.length || 4;
        const baseColor = d.blocsColors[i];
        for (let c = 0; c < bSize; c++) {
          const effectiveColor = colOverrides[col + c] !== undefined ? colOverrides[col + c] : baseColor;
          if (effectiveColor) roColMap[col + c] = effectiveColor;
        }
        col += bSize;
      });
    }

    // Enlissage : colonne 1 (direction rtl = fil 1 à droite, comme l'éditeur)
    const zoneEnl = document.createElement('div');
    zoneEnl.className = 'draft-zone-enlacement';

    // Bande colorée au-dessus (même sens rtl)
    if (d.blocsSequence && d.blocsSequence.length && d.blocs && d.blocsColors) {
      const bandRo = document.createElement('div');
      bandRo.style.cssText = 'display:flex; flex-direction:row-reverse; height:10px; gap:1px; margin-bottom:2px;';
      const cellSize = d.cols > 32 ? 8 : d.cols > 20 ? 10 : 12;
      const blocMapRo = {};
      d.blocs.forEach(b => { blocMapRo[b.name] = b; });
      d.blocsSequence.forEach((t, i) => {
        const bloc = blocMapRo[t];
        if (!bloc) return;
        const bSize = bloc.size || bloc.pattern?.[0]?.length || 4;
        const color = d.blocsColors[i];
        if (!color) return;
        const segW = bSize * cellSize + (bSize - 1);
        const seg = document.createElement('div');
        seg.style.cssText = `width:${segW}px; height:10px; background:${color}; border-radius:1px; flex-shrink:0; display:flex; align-items:center; justify-content:center;`;
        const lbl2 = document.createElement('span');
        lbl2.style.cssText = 'font-size:7px; font-weight:700; color:#fff; pointer-events:none;';
        lbl2.textContent = t;
        seg.appendChild(lbl2);
        bandRo.appendChild(seg);
      });
      zoneEnl.appendChild(bandRo);
    }

    const enlData = d.enlissage || d.enlacement;
    makeReadOnlyGrid(zoneEnl, 'Enlissage', enlData, d.shafts, d.cols, roColMap, true);
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

    // Bande couleur trame à droite du pédalage
    // Calculer les couleurs effectives depuis les blocs + overrides
    const trameRowColors = [];
    const trameRows = d.rows || 0;
    if (trameRows > 0) {
      const trBlocMap = {};
      (d.trameBlocs || []).forEach(b => { trBlocMap[b.name] = b; });
      const trSeq = d.trameSequence || [];
      const trOccColors = d.trameOccurrenceColors || [];
      const trDefaults = ['#4a7c9e','#c0392b','#27ae60','#8e44ad','#e67e22','#16a085','#d35400','#2c3e50'];
      // Construire la map ligne → couleur depuis les occurrences
      const trRowMap = {};
      const trRowOverrides = d.trameRowOverrides || {};
      let rowIdx = 0;
      trSeq.forEach((t, i) => {
        const bloc = trBlocMap[t];
        if (!bloc) return;
        const bSize = bloc.size || bloc.pattern?.[0]?.length || 4;
        const baseColor = trOccColors[i] || trDefaults[i % trDefaults.length];
        for (let r = 0; r < bSize; r++) {
          trRowMap[rowIdx + r] = trRowOverrides[rowIdx + r] !== undefined
            ? trRowOverrides[rowIdx + r]
            : baseColor;
        }
        rowIdx += bSize;
      });
      for (let r = 0; r < trameRows; r++) {
        trameRowColors.push(trRowMap[r] || trDefaults[r % trDefaults.length]);
      }
    }
    if (trameRowColors.length > 0) {
      const cellSize = d.treadles > 32 ? 8 : d.treadles > 20 ? 10 : 12;
      const wrapper = document.createElement('div');
      wrapper.style.cssText = 'display:flex; align-items:flex-start; gap:2px;';
      const gridEl = zonePed.querySelector('.draft-zone-readonly');
      if (gridEl) { wrapper.appendChild(gridEl); }
      const trameBandRo = document.createElement('div');
      trameBandRo.style.cssText = 'display:flex; flex-direction:column; gap:1px; margin-top:' + (cellSize + 4) + 'px;';
      trameRowColors.forEach(color => {
        const seg = document.createElement('div');
        seg.style.cssText = `width:${cellSize}px; height:${cellSize}px; background:${color}; border-radius:1px; flex-shrink:0;`;
        trameBandRo.appendChild(seg);
      });
      wrapper.appendChild(trameBandRo);
      zonePed.appendChild(wrapper);
    }

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

// ─── BLOCS D'ENLISSAGE ──────────────────────────────────────────────────────

// Retourne toutes les couleurs uniques utilisées dans les deux systèmes (chaîne + trame)
// Déclarée ici pour être accessible dans BlocsEnlissage et BlocsTrame via hoisting
function _getAllUsedColors() {
  const enlColors = (typeof BlocsEnlissage !== 'undefined' && BlocsEnlissage._lastSequence || []).map((_, i) =>
    BlocsEnlissage.occurrenceColors[i] || BlocsEnlissage._defaultColors[i % BlocsEnlissage._defaultColors.length]
  );
  const trameColors = (typeof BlocsTrame !== 'undefined' && BlocsTrame._lastSequence || []).map((_, i) =>
    BlocsTrame.occurrenceColors[i] || BlocsTrame._defaultColors[i % BlocsTrame._defaultColors.length]
  );
  return [...new Set([...enlColors, ...trameColors])];
}

// Stockage des blocs définis par l'utilisateur
// Chaque bloc : { name: 'A', pattern: [[bool, bool, ...], ...] }  (rows=cadres, cols=nb fils du bloc)
const BlocsEnlissage = {
  blocs: [],   // [{name, pattern}]
  _nextName: 65, // code ASCII de 'A'

  // Retourne la plus petite lettre disponible (repart toujours de A)
  _nextLetter() {
    const used = new Set(this.blocs.map(b => b.name));
    let code = 65; // 'A'
    while (used.has(String.fromCharCode(code))) code++;
    return String.fromCharCode(code);
  },

  // Couleurs par défaut pour les occurrences
  _defaultColors: ['#4a90d9','#e67e22','#27ae60','#8e44ad','#c0392b','#16a085','#f39c12','#2c3e50'],

  // Couleurs par occurrence dans la séquence complète (index = position dans fullSeq)
  occurrenceColors: [],

  // Surcharges individuelles : colOverrideColors[colIndex] = '#hexcolor'
  // Prioritaire sur occurrenceColors pour le fil concerné
  colOverrideColors: {},

  // Définit la couleur d'un fil individuel (surcharge)
  setColColor(colIdx, color) {
    if (color === null || color === undefined) {
      delete this.colOverrideColors[colIdx];
    } else {
      this.colOverrideColors[colIdx] = color;
    }
    this._applyColorsToGrid();
    this.renderBand();
    SchemaEditor.saveToHiddenField();
    updateSchemaPreview();
    syncOurdissageFromEnlissage();
  },

  // Ajoute un nouveau bloc vide (sans couleur propre)
  add() {
    const name = this._nextLetter();
    const shafts = SchemaEditor.shafts;
    const size = 4;
    const pattern = Array.from({length: shafts}, () => Array(size).fill(false));
    this.blocs.push({ name, pattern, size });
    this.render();
  },

  // Met à jour la couleur d'une occurrence
  setOccurrenceColor(idx, color) {
    this.occurrenceColors[idx] = color;
    this._applyColorsToGrid();
    this.renderBand();
    // Sauvegarder dans le champ caché et mettre à jour la préview
    SchemaEditor.saveToHiddenField();
    updateSchemaPreview();
    // Synchroniser le tableau d'ourdissage
    if (this._lastSequence && this._lastSequence.length) {
      const blocMap = {};
      this.blocs.forEach(b => { blocMap[b.name] = b; });
      syncOurdissageFromEnlissage();
    }
  },

  // Affiche la bande colorée au-dessus de la grille d'enlissage
  // Clic sur un segment : popover avec palette des couleurs existantes + picker natif
  renderBand() {
    const band = document.getElementById('blocs-band');
    if (!band || !this._lastSequence || !this._lastSequence.length) return;
    const cellSize = SchemaEditor.cols > 32 ? 10 : SchemaEditor.cols > 20 ? 12 : 14;
    const blocMap = {};
    this.blocs.forEach(b => { blocMap[b.name] = b; });
    band.innerHTML = '';
    band.style.gap = '1px';

    // Collecter toutes les couleurs utilisées (chaîne + trame)
    const usedColors = typeof _getAllUsedColors === 'function' ? _getAllUsedColors() : [...new Set(
      this._lastSequence.map((_, i) => this.occurrenceColors[i] || this._defaultColors[i % this._defaultColors.length])
    )];

    this._lastSequence.forEach((t, i) => {
      const bloc = blocMap[t];
      if (!bloc) return;
      const bSize = bloc.size || bloc.pattern[0]?.length || 4;
      const color = this.occurrenceColors[i] || this._defaultColors[i % this._defaultColors.length];
      const segW = bSize * cellSize + (bSize - 1);

      const seg = document.createElement('div');
      seg.title = `Cliquer pour changer la couleur (occurrence ${i + 1} — Bloc ${t})`;
      seg.style.cssText = `width:${segW}px; height:20px; background:${color}; border-radius:2px; flex-shrink:0; position:relative; cursor:pointer;`;

      const lbl = document.createElement('span');
      lbl.style.cssText = 'position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-size:9px; font-weight:700; color:#fff; text-shadow:0 0 2px rgba(0,0,0,0.6); pointer-events:none; z-index:1;';
      lbl.textContent = bloc.name;
      seg.appendChild(lbl);

      const idx = i;
      seg.addEventListener('click', (e) => {
        e.stopPropagation();
        // Fermer tout popover existant
        document.querySelectorAll('._blocs-popover').forEach(p => p.remove());

        const pop = document.createElement('div');
        pop.className = '_blocs-popover';
        pop.style.cssText = 'position:fixed; z-index:9999; background:#fff; border:1px solid #ccc; border-radius:6px; padding:8px; box-shadow:0 4px 16px rgba(0,0,0,0.18); display:flex; flex-direction:column; gap:6px; min-width:160px;';

        // Titre
        const title = document.createElement('div');
        title.style.cssText = 'font-size:0.75rem; font-weight:600; color:#555; margin-bottom:2px;';
        title.textContent = `Couleur — Bloc ${t} (occ. ${i + 1})`;
        pop.appendChild(title);

        // Palette des couleurs déjà utilisées
        if (usedColors.length > 0) {
          const palLbl = document.createElement('div');
          palLbl.style.cssText = 'font-size:0.7rem; color:#888;';
          palLbl.textContent = 'Couleurs existantes :';
          pop.appendChild(palLbl);

          const pal = document.createElement('div');
          pal.style.cssText = 'display:flex; flex-wrap:wrap; gap:4px;';
          usedColors.forEach(c => {
            const swatch = document.createElement('div');
            swatch.style.cssText = `width:22px; height:22px; background:${c}; border-radius:3px; cursor:pointer; border:2px solid ${c === color ? '#333' : 'transparent'}; box-sizing:border-box;`;
            swatch.title = c;
            swatch.addEventListener('click', (ev) => {
              ev.stopPropagation();
              seg.style.background = c;
              BlocsEnlissage.setOccurrenceColor(idx, c);
              pop.remove();
            });
            pal.appendChild(swatch);
          });
          pop.appendChild(pal);
        }

        // Bouton picker natif
        const pickerRow = document.createElement('div');
        pickerRow.style.cssText = 'display:flex; align-items:center; gap:6px; margin-top:2px;';
        const pickerLbl = document.createElement('label');
        pickerLbl.style.cssText = 'font-size:0.75rem; color:#555; cursor:pointer; display:flex; align-items:center; gap:4px;';
        pickerLbl.textContent = 'Autre couleur…';
        const pickerInp = document.createElement('input');
        pickerInp.type = 'color';
        pickerInp.value = color;
        pickerInp.style.cssText = 'width:28px; height:24px; padding:0; border:none; cursor:pointer; border-radius:3px;';
        pickerInp.addEventListener('input', () => {
          seg.style.background = pickerInp.value;
          BlocsEnlissage.setOccurrenceColor(idx, pickerInp.value);
        });
        pickerInp.addEventListener('change', () => { pop.remove(); });
        pickerLbl.appendChild(pickerInp);
        pickerRow.appendChild(pickerLbl);
        pop.appendChild(pickerRow);

        // Positionner le popover sous le segment
        document.body.appendChild(pop);
        const rect = seg.getBoundingClientRect();
        let left = rect.left;
        let top  = rect.bottom + 4;
        if (left + pop.offsetWidth > window.innerWidth - 8) left = window.innerWidth - pop.offsetWidth - 8;
        if (top + pop.offsetHeight > window.innerHeight - 8) top = rect.top - pop.offsetHeight - 4;
        pop.style.left = left + 'px';
        pop.style.top  = top  + 'px';

        // Fermer si clic en dehors du popover (avec délai pour éviter auto-fermeture)
        setTimeout(() => {
          const closeHandler = (ev) => {
            if (!pop.contains(ev.target)) {
              pop.remove();
              document.removeEventListener('mousedown', closeHandler);
            }
          };
          document.addEventListener('mousedown', closeHandler);
        }, 100);
      });

      band.appendChild(seg);
    });
  },

  // Construit la map colonne → couleur d'occurrence
  _buildColMap() {
    if (!this._lastSequence || !this._lastSequence.length) return {};
    const blocMap = {};
    this.blocs.forEach(b => { blocMap[b.name] = b; });
    const map = {}; // col index → couleur effective
    let col = 0;
    this._lastSequence.forEach((t, i) => {
      const bloc = blocMap[t];
      if (!bloc) return;
      const bSize = bloc.size || bloc.pattern[0]?.length || 4;
      const baseColor = this.occurrenceColors[i] || this._defaultColors[i % this._defaultColors.length];
      for (let c = 0; c < bSize; c++) {
        // La surcharge individuelle est prioritaire
        map[col + c] = this.colOverrideColors[col + c] !== undefined
          ? this.colOverrideColors[col + c]
          : baseColor;
      }
      col += bSize;
    });
    return map;
  },

  // Applique les couleurs d'occurrences aux cellules de la grille d'enlissage
  _applyColorsToGrid() {
    const container = document.getElementById('grid-enlissage');
    if (!container) return;
    const colMap = this._buildColMap();
    const cells = container.querySelectorAll('.schema-cell');
    const cols = SchemaEditor.cols;
    cells.forEach(cell => {
      const c = parseInt(cell.dataset.c);
      const isFilled = cell.classList.contains('filled');
      if (isFilled && colMap[c]) {
        cell.style.background = colMap[c];
        cell.style.borderColor = colMap[c];
      } else if (isFilled) {
        cell.style.background = '';
        cell.style.borderColor = '';
      } else {
        cell.style.background = '';
        cell.style.borderColor = '';
      }
    });
  },

  // Supprime un bloc par nom
  remove(name) {
    this.blocs = this.blocs.filter(b => b.name !== name);
    this.render();
  },

  // Bascule une case dans le pattern d'un bloc
  toggle(name, r, c) {
    const bloc = this.blocs.find(b => b.name === name);
    if (!bloc) return;
    // Règle enlissage : 1 seul cadre par colonne
    for (let row = 0; row < bloc.pattern.length; row++) bloc.pattern[row][c] = false;
    bloc.pattern[r][c] = true;
    this.render();
  },

  // Redimensionne un bloc (change le nombre de fils)
  resize(name, newSize) {
    const bloc = this.blocs.find(b => b.name === name);
    if (!bloc) return;
    const shafts = SchemaEditor.shafts;
    bloc.size = newSize;
    bloc.pattern = Array.from({length: shafts}, (_, r) =>
      Array.from({length: newSize}, (_, c) => bloc.pattern[r]?.[c] || false)
    );
    this.render();
  },

  // Redimensionne tous les blocs existants quand le nombre de cadres change dans SchemaEditor
  _resizeAllBlocs(newShafts) {
    if (this.blocs.length === 0) return;
    this.blocs.forEach(bloc => {
      const size = bloc.size || bloc.pattern[0]?.length || 4;
      bloc.pattern = Array.from({length: newShafts}, (_, r) =>
        Array.from({length: size}, (_, c) => bloc.pattern[r]?.[c] || false)
      );
    });
    this.render();
  },

  // Rendu de tous les blocs dans #blocs-list
  render() {
    const container = document.getElementById('blocs-list');
    if (!container) return;
    if (this.blocs.length === 0) {
      container.innerHTML = '<div style="font-size:0.78rem; color:var(--color-text-muted);">Aucun bloc défini.</div>';
      return;
    }
    container.innerHTML = '';
    this.blocs.forEach(bloc => {
      const shafts = bloc.pattern.length;
      const size   = bloc.size || bloc.pattern[0]?.length || 4;
      const cellPx = 14;

      const wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex; align-items:flex-start; gap:0.5rem; padding:0.4rem; background:#fff; border:1px solid var(--color-border-light,#e0d8cc); border-radius:4px;';

      // Label + supprimer
      const labelCol = document.createElement('div');
      labelCol.style.cssText = 'display:flex; flex-direction:column; align-items:center; gap:4px; min-width:28px;';
      const lbl = document.createElement('strong');
      lbl.style.cssText = 'font-size:1rem; line-height:1;';
      lbl.textContent = bloc.name;
      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.textContent = '×';
      delBtn.title = 'Supprimer ce bloc';
      delBtn.style.cssText = 'background:none; border:none; color:#c0392b; cursor:pointer; font-size:0.9rem; line-height:1; padding:0;';
      delBtn.onclick = () => this.remove(bloc.name);
      labelCol.appendChild(lbl);
      labelCol.appendChild(delBtn);
      wrap.appendChild(labelCol);

      // Grille du bloc
      const gridEl = document.createElement('div');
      gridEl.style.cssText = `display:grid; grid-template-columns:repeat(${size},${cellPx}px); grid-template-rows:repeat(${shafts},${cellPx}px); gap:1px; cursor:crosshair;`;
      for (let r = 0; r < shafts; r++) {
        for (let c = 0; c < size; c++) {
          const cell = document.createElement('div');
          cell.className = 'schema-cell' + (bloc.pattern[r][c] ? ' filled' : '');
          cell.title = `Cadre ${r+1}, fil ${c+1}`;
          const bName = bloc.name, br = r, bc = c;
          cell.addEventListener('mousedown', e => { e.preventDefault(); this.toggle(bName, br, bc); });
          gridEl.appendChild(cell);
        }
      }
      wrap.appendChild(gridEl);

      // Taille du bloc — boutons − / valeur / +
      const sizeCol = document.createElement('div');
      sizeCol.style.cssText = 'display:flex; flex-direction:column; gap:4px; font-size:0.75rem; align-items:center;';
      const sizeLbl = document.createElement('label');
      sizeLbl.textContent = 'Fils';
      const sizeRow = document.createElement('div');
      sizeRow.style.cssText = 'display:flex; align-items:center; gap:3px;';
      const btnMinus = document.createElement('button');
      btnMinus.type = 'button';
      btnMinus.textContent = '−';
      btnMinus.style.cssText = 'width:20px; height:20px; padding:0; font-size:0.9rem; line-height:1; cursor:pointer; border:1px solid #ccc; border-radius:3px; background:#f5f5f5;';
      const sizeVal = document.createElement('span');
      sizeVal.style.cssText = 'min-width:22px; text-align:center; font-size:0.85rem; font-weight:600;';
      sizeVal.textContent = size;
      const btnPlus = document.createElement('button');
      btnPlus.type = 'button';
      btnPlus.textContent = '+';
      btnPlus.style.cssText = 'width:20px; height:20px; padding:0; font-size:0.9rem; line-height:1; cursor:pointer; border:1px solid #ccc; border-radius:3px; background:#f5f5f5;';
      const bNameSize = bloc.name;
      btnMinus.onclick = () => {
        const cur = BlocsEnlissage.blocs.find(b => b.name === bNameSize)?.size || 4;
        if (cur > 1) { BlocsEnlissage.resize(bNameSize, cur - 1); }
      };
      btnPlus.onclick = () => {
        const cur = BlocsEnlissage.blocs.find(b => b.name === bNameSize)?.size || 4;
        if (cur < 32) { BlocsEnlissage.resize(bNameSize, cur + 1); }
      };
      sizeRow.appendChild(btnMinus);
      sizeRow.appendChild(sizeVal);
      sizeRow.appendChild(btnPlus);
      sizeCol.appendChild(sizeLbl);
      sizeCol.appendChild(sizeRow);
      wrap.appendChild(sizeCol);

      container.appendChild(wrap);
    });
  },

  // Applique la séquence de blocs à l'enlissage
  applySequence(sequenceStr, repeat) {
    if (this.blocs.length === 0) { showToast('Définissez au moins un bloc avant d\'appliquer.', 'error'); return; }
    const tokens = sequenceStr.trim().toUpperCase().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) { showToast('Entrez une séquence (ex : A B A B).', 'error'); return; }

    // Vérifier que tous les tokens correspondent à un bloc
    const blocMap = {};
    this.blocs.forEach(b => { blocMap[b.name] = b; });
    for (const t of tokens) {
      if (!blocMap[t]) { showToast(`Bloc "${t}" non défini.`, 'error'); return; }
    }

    // Construire la séquence complète
    const fullSeq = [];
    for (let i = 0; i < repeat; i++) fullSeq.push(...tokens);
    this._lastSequence = fullSeq; // mémoriser pour renderBand
    // Initialiser les couleurs d'occurrences manquantes avec les couleurs par défaut
    for (let i = 0; i < fullSeq.length; i++) {
      if (!this.occurrenceColors[i]) {
        this.occurrenceColors[i] = this._defaultColors[i % this._defaultColors.length];
      }
    }
    // Tronquer si la séquence est plus courte
    this.occurrenceColors = this.occurrenceColors.slice(0, fullSeq.length);

    // Calculer le nombre total de fils nécessaires
    const totalCols = fullSeq.reduce((s, t) => s + (blocMap[t].size || blocMap[t].pattern[0]?.length || 4), 0);
    const shafts = SchemaEditor.shafts;

    // Redimensionner l'enlissage si nécessaire
    if (totalCols !== SchemaEditor.cols) {
      SchemaEditor.cols = totalCols;
      const colsInput = document.getElementById('schema-cols');
      if (colsInput) colsInput.value = totalCols;
      SchemaEditor.initData(false);
    }

    // Remplir l'enlissage de gauche à droite (fil 0 = premier fil à gauche)
    // Réinitialiser toute la grille d'enlissage à false
    for (let r = 0; r < shafts; r++)
      for (let c = 0; c < totalCols; c++)
        SchemaEditor.enlissage[r][c] = false;

    let col = 0;
    for (const t of fullSeq) {
      const bloc = blocMap[t];
      const bSize = bloc.size || bloc.pattern[0]?.length || 4;
      for (let c = 0; c < bSize; c++) {
        for (let r = 0; r < shafts; r++) {
          // On copie le pattern tel quel : colonne 0 du bloc → fil le plus à gauche
          SchemaEditor.enlissage[r][col + c] = bloc.pattern[r]?.[c] || false;
        }
      }
      col += bSize;
    }

    // Ajouter des séparateurs visuels entre blocs (stockés dans schema_data)
    SchemaEditor._blocSeparators = [];
    col = 0;
    for (let i = 0; i < fullSeq.length - 1; i++) {
      const bloc = blocMap[fullSeq[i]];
      col += bloc.size || bloc.pattern[0]?.length || 4;
      SchemaEditor._blocSeparators.push(col);
    }

    SchemaEditor.render();
    SchemaEditor.saveToHiddenField();
    this.renderBand();
    syncOurdissageFromEnlissage();
    showToast(`Enlissage rempli : ${totalCols} fils en ${fullSeq.length} blocs.`, 'success');
  }
};

// Fonctions globales pour le HTML
function addBlocDefinition() {
  BlocsEnlissage.add();
}
function applyBlocsToEnlissage() {
  const seq    = document.getElementById('blocs-sequence')?.value || '';
  const repeat = parseInt(document.getElementById('blocs-repeat')?.value) || 1;
  BlocsEnlissage.applySequence(seq, repeat);
}

// Génère les color pickers pour chaque occurrence dans la séquence
function updateBlocsColorPickers() {
  const container = document.getElementById('blocs-color-pickers');
  if (!container) return;
  const seqStr = document.getElementById('blocs-sequence')?.value || '';
  const repeat = parseInt(document.getElementById('blocs-repeat')?.value) || 1;
  const tokens = seqStr.trim().toUpperCase().split(/\s+/).filter(Boolean);
  const fullSeq = [];
  for (let i = 0; i < repeat; i++) fullSeq.push(...tokens);

  if (fullSeq.length === 0) { container.innerHTML = ''; return; }

  container.innerHTML = '';
  fullSeq.forEach((t, i) => {
    const currentColor = BlocsEnlissage.occurrenceColors[i] || BlocsEnlissage._defaultColors[i % BlocsEnlissage._defaultColors.length];
    const wrap = document.createElement('label');
    wrap.style.cssText = 'display:flex; flex-direction:column; align-items:center; gap:2px; font-size:0.7rem; cursor:pointer;';
    const lbl = document.createElement('span');
    lbl.textContent = `${i + 1}. ${t}`;
    lbl.style.fontWeight = '600';
    const inp = document.createElement('input');
    inp.type = 'color';
    inp.value = currentColor;
    inp.style.cssText = 'width:28px; height:22px; padding:0; border:none; cursor:pointer;';
    inp.oninput = () => BlocsEnlissage.setOccurrenceColor(i, inp.value);
    wrap.appendChild(lbl);
    wrap.appendChild(inp);
    container.appendChild(wrap);
  });
}

function toggleBlocsPanel() {
  const body = document.getElementById('blocs-enlissage-body');
  const btn  = document.getElementById('btn-blocs-toggle');
  if (!body) return;
  const hidden = body.style.display === 'none';
  body.style.display = hidden ? '' : 'none';
  if (btn) btn.textContent = hidden ? 'Masquer' : 'Afficher';
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

function addBlocTrame() {
  BlocsTrame.add();
}
function applyBlocsTrame() {
  const seq    = document.getElementById('trame-sequence')?.value || '';
  const repeat = parseInt(document.getElementById('trame-repeat')?.value) || 1;
  BlocsTrame.applySequence(seq, repeat);
}
function toggleBlocsTramePanel() {
  const body = document.getElementById('blocs-trame-body');
  const btn  = document.getElementById('btn-blocs-trame-toggle');
  if (!body) return;
  const hidden = body.style.display === 'none';
  body.style.display = hidden ? '' : 'none';
  if (btn) btn.textContent = hidden ? 'Masquer' : 'Afficher';
}

// ─── BLOCS DE TRAME ──────────────────────────────────────────────────────────
// Système identique à BlocsEnlissage, adapté à la trame.
// Chaque bloc : { name, pattern[][], size }  (rows=pédales, cols=nb duites du bloc)
// occurrenceColors[i] = couleur de la i-ème occurrence dans la séquence complète
const BlocsTrame = {
  blocs: [],
  _nextName: 65,

  _nextLetter() {
    const used = new Set(this.blocs.map(b => b.name));
    let code = 65;
    while (used.has(String.fromCharCode(code))) code++;
    return String.fromCharCode(code);
  },

  _defaultColors: ['#4a7c9e','#c0392b','#27ae60','#8e44ad','#e67e22','#16a085','#d35400','#2c3e50'],

  occurrenceColors: [],

  // Surcharges individuelles : rowOverrideColors[rowIndex] = '#hexcolor'
  // Prioritaire sur occurrenceColors pour la duite concernée
  rowOverrideColors: {},

  // Définit la couleur d'une duite individuelle (surcharge)
  setRowColor(rowIdx, color) {
    if (color === null || color === undefined) {
      delete this.rowOverrideColors[rowIdx];
    } else {
      this.rowOverrideColors[rowIdx] = color;
    }
    this._applyColorsToGrid();
    this.renderBand();
    SchemaEditor.saveToHiddenField();
    updateSchemaPreview();
  },

  add() {
    const name = this._nextLetter();
    const treadles = SchemaEditor.treadles;
    const size = 4; // nb de duites
    // pattern[duite][pédale] — size lignes × treadles colonnes
    const pattern = Array.from({length: size}, () => Array(treadles).fill(false));
    this.blocs.push({ name, pattern, size });
    this.render();
  },

  setOccurrenceColor(idx, color) {
    this.occurrenceColors[idx] = color;
    this._applyColorsToGrid();
    this.renderBand();
    SchemaEditor.saveToHiddenField();
    updateSchemaPreview();
  },

  // Bande colorée à droite du pédalage (segments par occurrence) — miroir vertical de BlocsEnlissage.renderBand
  renderBand() {
    const band = document.getElementById('trame-band');
    if (!band || !this._lastSequence || !this._lastSequence.length) return;
    // cellSize identique à _renderGrid : basé sur cols (pas rows) pour que les segments
    // aient exactement la même hauteur que les cases de la grille de pédalage
    const cellSize = SchemaEditor.cols > 32 ? 10 : SchemaEditor.cols > 20 ? 12 : 14;
    const blocMap = {};
    this.blocs.forEach(b => { blocMap[b.name] = b; });
    band.innerHTML = '';
    band.style.gap = '1px';

    // Collecter toutes les couleurs utilisées (chaîne + trame)
    const usedColors = typeof _getAllUsedColors === 'function' ? _getAllUsedColors() : [...new Set(
      this._lastSequence.map((_, i) => this.occurrenceColors[i] || this._defaultColors[i % this._defaultColors.length])
    )];

    this._lastSequence.forEach((t, i) => {
      const bloc = blocMap[t];
      if (!bloc) return;
      const bSize = bloc.size || bloc.pattern.length || 4; // nb de duites
      const color = this.occurrenceColors[i] || this._defaultColors[i % this._defaultColors.length];
      // Hauteur du segment = bSize cellules + (bSize-1) gaps internes d'1px
      const segH = bSize * cellSize + (bSize - 1);

      const seg = document.createElement('div');
      seg.title = `Cliquer pour changer la couleur (occurrence ${i + 1} — Bloc ${t})`;
      seg.style.cssText = `width:20px; height:${segH}px; background:${color}; border-radius:2px; flex-shrink:0; position:relative; cursor:pointer;`;

      const lbl = document.createElement('span');
      lbl.style.cssText = 'position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-size:9px; font-weight:700; color:#fff; text-shadow:0 0 2px rgba(0,0,0,0.6); pointer-events:none; z-index:1;';
      lbl.textContent = bloc.name;
      seg.appendChild(lbl);

      const idx = i;
      seg.addEventListener('click', (e) => {
        e.stopPropagation();
        // Fermer tout popover existant
        document.querySelectorAll('._trame-popover').forEach(p => p.remove());

        const pop = document.createElement('div');
        pop.className = '_trame-popover';
        pop.style.cssText = 'position:fixed; z-index:9999; background:#fff; border:1px solid #ccc; border-radius:6px; padding:8px; box-shadow:0 4px 16px rgba(0,0,0,0.18); display:flex; flex-direction:column; gap:6px; min-width:160px;';

        // Titre
        const title = document.createElement('div');
        title.style.cssText = 'font-size:0.75rem; font-weight:600; color:#555; margin-bottom:2px;';
        title.textContent = `Couleur — Bloc ${t} (occ. ${i + 1})`;
        pop.appendChild(title);

        // Palette des couleurs déjà utilisées
        if (usedColors.length > 0) {
          const palLbl = document.createElement('div');
          palLbl.style.cssText = 'font-size:0.7rem; color:#888;';
          palLbl.textContent = 'Couleurs existantes :';
          pop.appendChild(palLbl);

          const pal = document.createElement('div');
          pal.style.cssText = 'display:flex; flex-wrap:wrap; gap:4px;';
          usedColors.forEach(c => {
            const swatch = document.createElement('div');
            swatch.style.cssText = `width:22px; height:22px; background:${c}; border-radius:3px; cursor:pointer; border:2px solid ${c === color ? '#333' : 'transparent'}; box-sizing:border-box;`;
            swatch.title = c;
            swatch.addEventListener('click', (ev) => {
              ev.stopPropagation();
              seg.style.background = c;
              BlocsTrame.setOccurrenceColor(idx, c);
              pop.remove();
            });
            pal.appendChild(swatch);
          });
          pop.appendChild(pal);
        }

        // Bouton picker natif
        const pickerRow = document.createElement('div');
        pickerRow.style.cssText = 'display:flex; align-items:center; gap:6px; margin-top:2px;';
        const pickerLbl = document.createElement('label');
        pickerLbl.style.cssText = 'font-size:0.75rem; color:#555; cursor:pointer; display:flex; align-items:center; gap:4px;';
        pickerLbl.textContent = 'Autre couleur…';
        const pickerInp = document.createElement('input');
        pickerInp.type = 'color';
        pickerInp.value = color;
        pickerInp.style.cssText = 'width:28px; height:24px; padding:0; border:none; cursor:pointer; border-radius:3px;';
        pickerInp.addEventListener('input', () => {
          seg.style.background = pickerInp.value;
          BlocsTrame.setOccurrenceColor(idx, pickerInp.value);
        });
        pickerInp.addEventListener('change', () => { pop.remove(); });
        pickerLbl.appendChild(pickerInp);
        pickerRow.appendChild(pickerLbl);
        pop.appendChild(pickerRow);

        // Positionner le popover à droite du segment
        document.body.appendChild(pop);
        const rect = seg.getBoundingClientRect();
        let left = rect.right + 4;
        let top  = rect.top;
        if (left + pop.offsetWidth > window.innerWidth - 8) left = rect.left - pop.offsetWidth - 4;
        if (top + pop.offsetHeight > window.innerHeight - 8) top = window.innerHeight - pop.offsetHeight - 8;
        pop.style.left = left + 'px';
        pop.style.top  = top  + 'px';

        // Fermer si clic en dehors du popover
        setTimeout(() => {
          const closeHandler = (ev) => {
            if (!pop.contains(ev.target)) {
              pop.remove();
              document.removeEventListener('mousedown', closeHandler);
            }
          };
          document.addEventListener('mousedown', closeHandler);
        }, 100);
      });

      band.appendChild(seg);
    });
  },

  // Map ligne → couleur effective (surcharge individuelle prioritaire sur couleur d'occurrence)
  _buildRowMap() {
    if (!this._lastSequence || !this._lastSequence.length) return {};
    const blocMap = {};
    this.blocs.forEach(b => { blocMap[b.name] = b; });
    const map = {};
    let row = 0;
    this._lastSequence.forEach((t, i) => {
      const bloc = blocMap[t];
      if (!bloc) return;
      const bSize = bloc.size || bloc.pattern.length || 4; // nb de duites
      const baseColor = this.occurrenceColors[i] || this._defaultColors[i % this._defaultColors.length];
      for (let r = 0; r < bSize; r++) {
        // La surcharge individuelle est prioritaire
        map[row + r] = this.rowOverrideColors[row + r] !== undefined
          ? this.rowOverrideColors[row + r]
          : baseColor;
      }
      row += bSize;
    });
    return map;
  },

  // Applique les couleurs d'occurrences aux cellules de la grille de pédalage
  _applyColorsToGrid() {
    const container = document.getElementById('grid-pedalage');
    if (!container) return;
    const rowMap = this._buildRowMap();
    const cells = container.querySelectorAll('.schema-cell');
    cells.forEach(cell => {
      const r = parseInt(cell.dataset.r);
      const isFilled = cell.classList.contains('filled');
      if (isFilled && rowMap[r]) {
        cell.style.background = rowMap[r];
        cell.style.borderColor = rowMap[r];
      } else {
        cell.style.background = '';
        cell.style.borderColor = '';
      }
    });
  },

  remove(name) {
    this.blocs = this.blocs.filter(b => b.name !== name);
    this.render();
  },

  toggle(name, r, c) {
    const bloc = this.blocs.find(b => b.name === name);
    if (!bloc) return;
    // Règle : 1 seule pédale par duite (1 case par ligne)
    bloc.pattern[r] = Array(bloc.pattern[r].length).fill(false);
    bloc.pattern[r][c] = true;
    this.render();
  },

  resize(name, newSize) {
    const bloc = this.blocs.find(b => b.name === name);
    if (!bloc) return;
    const treadles = SchemaEditor.treadles;
    bloc.size = newSize;
    // pattern[duite][pédale] — newSize lignes × treadles colonnes
    bloc.pattern = Array.from({length: newSize}, (_, r) =>
      Array.from({length: treadles}, (_, c) => bloc.pattern[r]?.[c] || false)
    );
    this.render();
  },

  // Redimensionne tous les blocs existants quand le nombre de pédales change dans SchemaEditor
  _resizeAllBlocs(newTreadles) {
    if (this.blocs.length === 0) return;
    this.blocs.forEach(bloc => {
      const size = bloc.size || bloc.pattern.length || 4; // nb de duites
      // Adapter chaque ligne (duite) au nouveau nombre de pédales
      bloc.pattern = Array.from({length: size}, (_, r) =>
        Array.from({length: newTreadles}, (_, c) => bloc.pattern[r]?.[c] || false)
      );
    });
    this.render();
  },

  render() {
    const container = document.getElementById('trame-blocs-list');
    if (!container) return;
    if (this.blocs.length === 0) {
      container.innerHTML = '<div style="font-size:0.78rem; color:var(--color-text-muted);">Aucun bloc défini.</div>';
      return;
    }
    container.innerHTML = '';
    this.blocs.forEach(bloc => {
      const treadles = SchemaEditor.treadles; // nb réel de pédales
      const size     = bloc.size || bloc.pattern.length || 4; // nb de duites
      const cellPx   = 14;

      const wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex; align-items:flex-start; gap:0.5rem; padding:0.4rem; background:#fff; border:1px solid var(--color-border-light,#e0d8cc); border-radius:4px;';

      // Label + supprimer
      const labelCol = document.createElement('div');
      labelCol.style.cssText = 'display:flex; flex-direction:column; align-items:center; gap:4px; min-width:28px;';
      const lbl = document.createElement('strong');
      lbl.style.cssText = 'font-size:1rem; line-height:1;';
      lbl.textContent = bloc.name;
      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.textContent = '\u00d7';
      delBtn.title = 'Supprimer ce bloc';
      delBtn.style.cssText = 'background:none; border:none; color:#c0392b; cursor:pointer; font-size:0.9rem; line-height:1; padding:0;';
      delBtn.onclick = () => BlocsTrame.remove(bloc.name);
      labelCol.appendChild(lbl);
      labelCol.appendChild(delBtn);
      wrap.appendChild(labelCol);

      // Grille du bloc (duites en lignes × pédales en colonnes)
      const gridEl = document.createElement('div');
      gridEl.style.cssText = `display:grid; grid-template-columns:repeat(${treadles},${cellPx}px); grid-template-rows:repeat(${size},${cellPx}px); gap:1px; cursor:crosshair;`;
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < treadles; c++) {
          const cell = document.createElement('div');
          cell.className = 'schema-cell' + (bloc.pattern[r]?.[c] ? ' filled' : '');
          cell.title = `Duite ${r+1}, pédale ${c+1}`;
          const bName = bloc.name, br = r, bc = c;
          cell.addEventListener('mousedown', e => { e.preventDefault(); BlocsTrame.toggle(bName, br, bc); });
          gridEl.appendChild(cell);
        }
      }
      wrap.appendChild(gridEl);

      // Taille du bloc — boutons − / valeur / +
      const sizeCol = document.createElement('div');
      sizeCol.style.cssText = 'display:flex; flex-direction:column; gap:4px; font-size:0.75rem; align-items:center;';
      const sizeLbl = document.createElement('label');
      sizeLbl.textContent = 'Duites';
      const sizeRow = document.createElement('div');
      sizeRow.style.cssText = 'display:flex; align-items:center; gap:3px;';
      const btnMinus = document.createElement('button');
      btnMinus.type = 'button';
      btnMinus.textContent = '\u2212';
      btnMinus.style.cssText = 'width:20px; height:20px; padding:0; font-size:0.9rem; line-height:1; cursor:pointer; border:1px solid #ccc; border-radius:3px; background:#f5f5f5;';
      const sizeVal = document.createElement('span');
      sizeVal.style.cssText = 'min-width:22px; text-align:center; font-size:0.85rem; font-weight:600;';
      sizeVal.textContent = size;
      const btnPlus = document.createElement('button');
      btnPlus.type = 'button';
      btnPlus.textContent = '+';
      btnPlus.style.cssText = 'width:20px; height:20px; padding:0; font-size:0.9rem; line-height:1; cursor:pointer; border:1px solid #ccc; border-radius:3px; background:#f5f5f5;';
      const bNameSize = bloc.name;
      btnMinus.onclick = () => {
        const cur = BlocsTrame.blocs.find(b => b.name === bNameSize)?.size || 4;
        if (cur > 1) { BlocsTrame.resize(bNameSize, cur - 1); }
      };
      btnPlus.onclick = () => {
        const cur = BlocsTrame.blocs.find(b => b.name === bNameSize)?.size || 4;
        if (cur < 32) { BlocsTrame.resize(bNameSize, cur + 1); }
      };
      sizeRow.appendChild(btnMinus);
      sizeRow.appendChild(sizeVal);
      sizeRow.appendChild(btnPlus);
      sizeCol.appendChild(sizeLbl);
      sizeCol.appendChild(sizeRow);
      wrap.appendChild(sizeCol);

      container.appendChild(wrap);
    });
  },

  applySequence(sequenceStr, repeat) {
    if (this.blocs.length === 0) { showToast('Définissez au moins un bloc avant d\'appliquer.', 'error'); return; }
    const tokens = sequenceStr.trim().toUpperCase().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) { showToast('Entrez une séquence (ex : A B A B).', 'error'); return; }

    const blocMap = {};
    this.blocs.forEach(b => { blocMap[b.name] = b; });
    for (const t of tokens) {
      if (!blocMap[t]) { showToast(`Bloc "${t}" non défini.`, 'error'); return; }
    }

    const fullSeq = [];
    for (let i = 0; i < repeat; i++) fullSeq.push(...tokens);
    this._lastSequence = fullSeq;

    // Initialiser les couleurs d'occurrences manquantes
    for (let i = 0; i < fullSeq.length; i++) {
      if (!this.occurrenceColors[i]) {
        this.occurrenceColors[i] = this._defaultColors[i % this._defaultColors.length];
      }
    }
    this.occurrenceColors = this.occurrenceColors.slice(0, fullSeq.length);

    // Calculer le nombre total de duites (size = nb de lignes = nb de duites)
    const totalRows = fullSeq.reduce((s, t) => s + (blocMap[t].size || blocMap[t].pattern.length || 4), 0);
    const treadles = SchemaEditor.treadles;

    // Redimensionner le pédalage si nécessaire
    if (totalRows !== SchemaEditor.rows) {
      SchemaEditor.rows = totalRows;
      const rowsInput = document.getElementById('schema-rows');
      if (rowsInput) rowsInput.value = totalRows;
      SchemaEditor.initData(false);
    }

    // Réinitialiser le pédalage
    for (let r = 0; r < totalRows; r++)
      SchemaEditor.pedalage[r] = Array(treadles).fill(false);

    // Remplir le pédalage depuis les blocs
    // pattern[duite][pédale] — on copie directement
    let row = 0;
    for (const t of fullSeq) {
      const bloc = blocMap[t];
      const bSize = bloc.size || bloc.pattern.length || 4;
      for (let d = 0; d < bSize; d++) {
        SchemaEditor.pedalage[row + d] = Array.from({length: treadles}, (_, p) => bloc.pattern[d]?.[p] || false);
      }
      row += bSize;
    }

    // Séparateurs visuels entre blocs
    SchemaEditor._trameSeparators = [];
    row = 0;
    for (let i = 0; i < fullSeq.length - 1; i++) {
      const bloc = blocMap[fullSeq[i]];
      row += bloc.size || bloc.pattern.length || 4;
      SchemaEditor._trameSeparators.push(row);
    }

    SchemaEditor.render();
    SchemaEditor.saveToHiddenField();
    this.renderBand();
    showToast(`Pédalage rempli : ${totalRows} duites en ${fullSeq.length} blocs.`, 'success');
  }
};

// Alias pour compatibilité
const TrameBand = BlocsTrame;

// ─── POPOVER COULEUR PARTAGÉ ──────────────────────────────────────────────────
// Utilisé par BlocsEnlissage (bande) et BlocsTrame (bande + blocs)
function _showColorPopover(anchorEl, currentColor, palette, onSelect, title, popClass) {
  const cls = popClass || '_color-popover';
  document.querySelectorAll('.' + cls).forEach(p => p.remove());
  const pop = document.createElement('div');
  pop.className = cls;
  pop.style.cssText = 'position:fixed; z-index:9999; background:#fff; border:1px solid #ccc; border-radius:6px; padding:8px; box-shadow:0 4px 16px rgba(0,0,0,0.18); display:flex; flex-direction:column; gap:6px; min-width:160px;';

  if (title) {
    const ttl = document.createElement('div');
    ttl.style.cssText = 'font-size:0.75rem; font-weight:600; color:#555; margin-bottom:2px;';
    ttl.textContent = title;
    pop.appendChild(ttl);
  }

  if (palette.length > 0) {
    const palLbl = document.createElement('div');
    palLbl.style.cssText = 'font-size:0.7rem; color:#888;';
    palLbl.textContent = 'Couleurs disponibles :';
    pop.appendChild(palLbl);
    const pal = document.createElement('div');
    pal.style.cssText = 'display:flex; flex-wrap:wrap; gap:4px;';
    palette.forEach(c => {
      const sw = document.createElement('div');
      sw.style.cssText = `width:22px; height:22px; background:${c}; border-radius:3px; cursor:pointer; border:2px solid ${c === currentColor ? '#333' : 'transparent'}; box-sizing:border-box;`;
      sw.addEventListener('click', (ev) => { ev.stopPropagation(); onSelect(c); pop.remove(); });
      pal.appendChild(sw);
    });
    pop.appendChild(pal);
  }

  const pickerLbl = document.createElement('label');
  pickerLbl.style.cssText = 'font-size:0.75rem; color:#555; cursor:pointer; display:flex; align-items:center; gap:4px;';
  pickerLbl.textContent = 'Autre couleur…';
  const pickerInp = document.createElement('input');
  pickerInp.type = 'color';
  pickerInp.value = currentColor || '#4a7c9e';
  pickerInp.style.cssText = 'width:28px; height:24px; padding:0; border:none; cursor:pointer; border-radius:3px;';
  pickerInp.addEventListener('input', () => { onSelect(pickerInp.value); });
  pickerInp.addEventListener('change', () => { pop.remove(); });
  pickerLbl.appendChild(pickerInp);
  pop.appendChild(pickerLbl);

  document.body.appendChild(pop);
  const rect = anchorEl.getBoundingClientRect();
  let left = rect.right + 4, top = rect.top;
  if (left + 180 > window.innerWidth - 8) left = rect.left - 184;
  if (top + 200 > window.innerHeight - 8) top = window.innerHeight - 208;
  pop.style.left = left + 'px';
  pop.style.top  = top  + 'px';

  setTimeout(() => {
    const ch = (ev) => { if (!pop.contains(ev.target)) { pop.remove(); document.removeEventListener('mousedown', ch); } };
    document.addEventListener('mousedown', ch);
  }, 100);
}

