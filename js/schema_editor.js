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
      blocs:              BlocsEnlissage.blocs,
      blocsSequence:      BlocsEnlissage._lastSequence || [],
      blocsColOverrides:  BlocsEnlissage.colOverrides || {},
      // Blocs de trame
      trameBlocs:        BlocsTrame.blocs,
      trameSequence:     BlocsTrame._lastSequence || [],
      trameRowOverrides: BlocsTrame.rowOverrides || {},
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
        // Compatibilité ascendante : ancienne clé blocsColors (occurrence-based) → colors dans chaque bloc
        if (d.blocsColors && d.blocsColors.length && d.blocs[0] && !d.blocs[0].colors) {
          const blocMap = {};
          d.blocs.forEach(b => { blocMap[b.name] = b; });
          let col = 0;
          (d.blocsSequence || []).forEach((t, i) => {
            const bloc = blocMap[t];
            if (!bloc) return;
            const bSize = bloc.size || bloc.pattern?.[0]?.length || 4;
            if (!bloc.colors) bloc.colors = Array(bSize).fill(null);
            const c = d.blocsColors[i];
            if (c) for (let j = 0; j < bSize; j++) bloc.colors[j] = bloc.colors[j] || c;
            col += bSize;
          });
        }
        // S'assurer que chaque bloc a un tableau colors
        d.blocs.forEach(b => {
          const sz = b.size || b.pattern?.[0]?.length || 4;
          if (!b.colors) b.colors = Array.from({length: sz}, (_, i) => BlocsEnlissage._defaultColors[i % BlocsEnlissage._defaultColors.length]);
        });
        BlocsEnlissage.blocs = d.blocs;
        BlocsEnlissage._lastSequence = d.blocsSequence || [];
        BlocsEnlissage.colOverrides = d.blocsColOverrides || {};
        BlocsEnlissage.render();
        BlocsEnlissage.renderBand();
        const seqInput = document.getElementById('blocs-sequence');
        if (seqInput && d.blocsSequence && d.blocsSequence.length > 0) {
          seqInput.value = d.blocsSequence.join(' ');
        }
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
        BlocsTrame.rowOverrides = d.trameRowOverrides || {};
        BlocsTrame.render();
        const trSeqInput = document.getElementById('trame-sequence');
        if (trSeqInput && d.trameSequence && d.trameSequence.length > 0) {
          // Reconstruire la séquence unique (sans répétitions)
          const uniqueSeq = [];
          let prev = null;
          for (const t of d.trameSequence) {
            if (t !== prev) { uniqueSeq.push(t); prev = t; }
          }
          trSeqInput.value = [...new Set(d.trameSequence)].join(' ');
        }
      } else if (d.trameColors && d.trameColors.length > 0) {
        // Compatibilité ascendante : ancienne clé trameColors → rowOverrides
        d.trameColors.forEach((c, i) => { BlocsTrame.rowOverrides[i] = c; });
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

    // Construire la map colonne → couleur depuis les données sauvegardées
    // Nouveau format : colors[] par fil dans chaque bloc + colOverrides
    const roColMap = {};
    if (d.blocsSequence && d.blocsSequence.length && d.blocs) {
      const blocMap = {};
      d.blocs.forEach(b => { blocMap[b.name] = b; });
      let col = 0;
      d.blocsSequence.forEach((t, i) => {
        const bloc = blocMap[t];
        if (!bloc) return;
        const bSize = bloc.size || bloc.colors?.length || bloc.pattern?.[0]?.length || 4;
        for (let c = 0; c < bSize; c++) {
          // Priorité : colOverride > couleur du fil dans le bloc > blocsColors (compat) > défaut
          const override = d.blocsColOverrides?.[col + c];
          const stepColor = bloc.colors?.[c];
          const occColor = d.blocsColors?.[i];
          roColMap[col + c] = override || stepColor || occColor || null;
        }
        col += bSize;
      });
    }

    // Enlissage : colonne 1 (direction rtl = fil 1 à droite, comme l'éditeur)
    const zoneEnl = document.createElement('div');
    zoneEnl.className = 'draft-zone-enlacement';

    // Bande colorée au-dessus (même sens rtl) — une pastille par fil
    if (d.blocsSequence && d.blocsSequence.length && d.blocs) {
      const bandRo = document.createElement('div');
      bandRo.style.cssText = 'display:flex; flex-direction:row-reverse; height:10px; gap:1px; margin-bottom:2px;';
      const cellSize = d.cols > 32 ? 8 : d.cols > 20 ? 10 : 12;
      for (let c = 0; c < d.cols; c++) {
        const color = roColMap[c];
        if (!color) continue;
        const seg = document.createElement('div');
        seg.style.cssText = `width:${cellSize}px; height:10px; background:${color}; border-radius:1px; flex-shrink:0;`;
        bandRo.appendChild(seg);
      }
      if (bandRo.children.length > 0) zoneEnl.appendChild(bandRo);
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
      const trOverrides = d.trameRowOverrides || {};
      const trDefaults = ['#4a7c9e','#c0392b','#27ae60','#8e44ad','#e67e22','#16a085','#d35400','#2c3e50'];
      for (let r = 0; r < trameRows; r++) {
        if (trOverrides[r]) { trameRowColors.push(trOverrides[r]); continue; }
        // Chercher dans la séquence
        let found = null;
        let row = 0;
        for (const t of trSeq) {
          const bloc = trBlocMap[t];
          if (!bloc) continue;
          const bSize = bloc.size || bloc.colors.length || 2;
          if (r >= row && r < row + bSize) {
            found = bloc.colors[r - row] || trDefaults[(r - row) % trDefaults.length];
            break;
          }
          row += bSize;
        }
        // Compatibilité ancienne clé trameColors
        if (!found && d.trameColors && d.trameColors[r]) found = d.trameColors[r];
        trameRowColors.push(found || trDefaults[r % trDefaults.length]);
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
// Système identique à BlocsTrame.
// Chaque bloc définit : une grille pattern (cadres × fils) + une couleur par fil.
// colOverrides[c] = couleur individuelle (prioritaire sur le bloc).
const BlocsEnlissage = {
  blocs: [],           // [{name, colors:[hex,...], size, pattern:[[bool]]}]
  _lastSequence: [],   // séquence complète après applySequence
  colOverrides: {},    // {colIndex: hex} — couleurs individuelles par fil dans la bande

  _defaultColors: ['#4a90d9','#e67e22','#27ae60','#8e44ad','#c0392b','#16a085','#f39c12','#2c3e50'],

  _nextLetter() {
    const used = new Set(this.blocs.map(b => b.name));
    let code = 65;
    while (used.has(String.fromCharCode(code))) code++;
    return String.fromCharCode(code);
  },

  // Palette commune : toutes les couleurs utilisées dans les blocs + overrides + blocs trame
  _allColors() {
    const set = new Set();
    this.blocs.forEach(b => (b.colors || []).forEach(c => { if(c) set.add(c); }));
    Object.values(this.colOverrides).forEach(c => { if(c) set.add(c); });
    if (typeof BlocsTrame !== 'undefined') {
      BlocsTrame.blocs.forEach(b => (b.colors || []).forEach(c => { if(c) set.add(c); }));
      Object.values(BlocsTrame.rowOverrides || {}).forEach(c => { if(c) set.add(c); });
    }
    return [...set];
  },

  // Calcule la couleur effective d'un fil (override > bloc > défaut)
  _colorForCol(c) {
    if (this.colOverrides[c] !== undefined) return this.colOverrides[c];
    if (this._lastSequence && this._lastSequence.length) {
      const blocMap = {};
      this.blocs.forEach(b => { blocMap[b.name] = b; });
      let col = 0;
      for (const t of this._lastSequence) {
        const bloc = blocMap[t];
        if (!bloc) continue;
        const bSize = bloc.size || bloc.colors.length || 4;
        if (c >= col && c < col + bSize) {
          return bloc.colors[c - col] || this._defaultColors[(c - col) % this._defaultColors.length];
        }
        col += bSize;
      }
    }
    return this._defaultColors[c % this._defaultColors.length];
  },

  add() {
    const name = this._nextLetter();
    const shafts = SchemaEditor.shafts;
    const size = 4;
    const colors = Array.from({length: size}, (_, i) =>
      this._defaultColors[(this.blocs.length * size + i) % this._defaultColors.length]);
    const pattern = Array.from({length: shafts}, () => Array(size).fill(false));
    this.blocs.push({ name, colors, size, pattern });
    this.render();
  },

  remove(name) {
    this.blocs = this.blocs.filter(b => b.name !== name);
    this.render();
  },

  resizeBloc(name, newSize) {
    const bloc = this.blocs.find(b => b.name === name);
    if (!bloc) return;
    const shafts = SchemaEditor.shafts;
    const prevColors  = bloc.colors.slice();
    const prevPattern = bloc.pattern.map(row => row.slice());
    bloc.size = newSize;
    bloc.colors  = Array.from({length: newSize}, (_, i) =>
      prevColors[i] || this._defaultColors[i % this._defaultColors.length]);
    bloc.pattern = Array.from({length: shafts}, (_, r) =>
      Array.from({length: newSize}, (_, c) => prevPattern[r]?.[c] || false));
    this.render();
  },

  // Modifier la couleur d'un fil dans un bloc
  setStepColor(blocName, stepIdx, color) {
    const bloc = this.blocs.find(b => b.name === blocName);
    if (!bloc) return;
    bloc.colors[stepIdx] = color;
    this.render();
    this.renderBand();
    this._applyColorsToGrid();
    SchemaEditor.saveToHiddenField();
    updateSchemaPreview();
    this._syncOurdissage();
  },

  // Couleur individuelle d'un fil (override)
  setColColor(colIdx, color) {
    this.colOverrides[colIdx] = color;
    this.renderBand();
    this._applyColorsToGrid();
    SchemaEditor.saveToHiddenField();
    updateSchemaPreview();
    this._syncOurdissage();
  },

  _syncOurdissage() {
    if (this._lastSequence && this._lastSequence.length) {
      const blocMap = {};
      this.blocs.forEach(b => { blocMap[b.name] = b; });
      // Construire occurrenceColors depuis les couleurs de blocs pour compatibilité
      const occColors = [];
      this._lastSequence.forEach((t, i) => {
        const bloc = blocMap[t];
        if (bloc) occColors[i] = bloc.colors[0] || this._defaultColors[i % this._defaultColors.length];
      });
      if (typeof syncOurdissageFromEnlissage === 'function') {
        syncOurdissageFromEnlissage();
      }
    }
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

  // Rendu de la bande colorée au-dessus de la grille d'enlissage
  renderBand() {
    const band = document.getElementById('blocs-band');
    if (!band) return;
    const cols = SchemaEditor.cols;
    const cellSize = cols > 32 ? 10 : cols > 20 ? 12 : 14;
    const allColors = this._allColors();
    band.innerHTML = '';

    for (let c = 0; c < cols; c++) {
      const color = this._colorForCol(c);
      const seg = document.createElement('div');
      seg.dataset.col = c;
      seg.style.cssText = `width:${cellSize}px; height:${cellSize}px; background:${color}; border-radius:2px; flex-shrink:0; cursor:pointer;`;
      seg.title = `Fil ${c + 1} — cliquer pour modifier`;

      const idx = c;
      seg.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('._enl-popover').forEach(p => p.remove());
        _showColorPopover(seg, color, allColors,
          (col) => { BlocsEnlissage.setColColor(idx, col); },
          `Fil ${c + 1}`,
          '_enl-popover'
        );
      });
      band.appendChild(seg);
    }
  },

  // Applique les couleurs aux cellules de la grille d'enlissage
  _applyColorsToGrid() {
    const container = document.getElementById('grid-enlissage');
    if (!container) return;
    const cols = SchemaEditor.cols;
    const cells = container.querySelectorAll('.schema-cell');
    cells.forEach(cell => {
      const c = parseInt(cell.dataset.c);
      const isFilled = cell.classList.contains('filled');
      const color = this._colorForCol(c);
      if (isFilled && color) {
        cell.style.background = color;
        cell.style.borderColor = color;
      } else {
        cell.style.background = '';
        cell.style.borderColor = '';
      }
    });
  },

  // Rendu du panneau de définition des blocs dans #blocs-list
  render() {
    const container = document.getElementById('blocs-list');
    if (!container) return;
    if (this.blocs.length === 0) {
      container.innerHTML = '<div style="font-size:0.78rem; color:var(--color-text-muted);">Aucun bloc défini.</div>';
      return;
    }
    container.innerHTML = '';
    this.blocs.forEach(bloc => {
      const shafts = bloc.pattern.length || SchemaEditor.shafts;
      const size   = bloc.size || bloc.colors.length || 4;
      const cellPx = 14;

      const wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex; align-items:flex-start; gap:0.5rem; padding:0.4rem; background:#fff; border:1px solid var(--color-border-light,#e0d8cc); border-radius:4px; flex-wrap:wrap;';

      // Label + supprimer
      const labelCol = document.createElement('div');
      labelCol.style.cssText = 'display:flex; flex-direction:column; align-items:center; gap:4px; min-width:28px;';
      const lbl = document.createElement('strong');
      lbl.style.cssText = 'font-size:1rem; line-height:1;';
      lbl.textContent = bloc.name;
      const delBtn = document.createElement('button');
      delBtn.type = 'button'; delBtn.textContent = '×';
      delBtn.title = 'Supprimer ce bloc';
      delBtn.style.cssText = 'background:none; border:none; color:#c0392b; cursor:pointer; font-size:0.9rem; padding:0;';
      delBtn.onclick = () => this.remove(bloc.name);
      labelCol.appendChild(lbl); labelCol.appendChild(delBtn);
      wrap.appendChild(labelCol);

      // Colonne centrale : pastilles de couleur + grille pattern
      const centerCol = document.createElement('div');
      centerCol.style.cssText = 'display:flex; flex-direction:column; gap:3px;';

      // Pastilles de couleur (une par fil du bloc)
      const stepsEl = document.createElement('div');
      stepsEl.style.cssText = `display:flex; gap:1px; align-items:center;`;
      for (let s = 0; s < size; s++) {
        const c = bloc.colors[s] || '#cccccc';
        const sw = document.createElement('div');
        sw.style.cssText = `width:${cellPx}px; height:${cellPx}px; background:${c}; border-radius:2px; cursor:pointer; border:1px solid #ccc; box-sizing:border-box;`;
        sw.title = `Fil ${s + 1} du bloc ${bloc.name}`;
        const bName = bloc.name, sIdx = s;
        sw.addEventListener('click', (e) => {
          e.stopPropagation();
          document.querySelectorAll('._enl-step-popover').forEach(p => p.remove());
          _showColorPopover(sw, c, BlocsEnlissage._allColors(),
            (col) => BlocsEnlissage.setStepColor(bName, sIdx, col),
            `Bloc ${bName} — fil ${sIdx + 1}`,
            '_enl-step-popover'
          );
        });
        stepsEl.appendChild(sw);
      }
      centerCol.appendChild(stepsEl);

      // Grille pattern du bloc
      const gridEl = document.createElement('div');
      gridEl.style.cssText = `display:grid; grid-template-columns:repeat(${size},${cellPx}px); grid-template-rows:repeat(${shafts},${cellPx}px); gap:1px; cursor:crosshair;`;
      for (let r = 0; r < shafts; r++) {
        for (let c = 0; c < size; c++) {
          const cell = document.createElement('div');
          const filled = bloc.pattern[r]?.[c];
          cell.className = 'schema-cell' + (filled ? ' filled' : '');
          if (filled && bloc.colors[c]) {
            cell.style.background = bloc.colors[c];
            cell.style.borderColor = bloc.colors[c];
          }
          cell.title = `Cadre ${r+1}, fil ${c+1}`;
          const bName = bloc.name, br = r, bc = c;
          cell.addEventListener('mousedown', e => { e.preventDefault(); this.toggle(bName, br, bc); });
          gridEl.appendChild(cell);
        }
      }
      centerCol.appendChild(gridEl);
      wrap.appendChild(centerCol);

      // Boutons taille
      const sizeRow = document.createElement('div');
      sizeRow.style.cssText = 'display:flex; flex-direction:column; gap:4px; font-size:0.75rem; align-items:center;';
      const sizeLbl = document.createElement('label'); sizeLbl.textContent = 'Fils';
      const sizeCtrl = document.createElement('div');
      sizeCtrl.style.cssText = 'display:flex; align-items:center; gap:3px;';
      const btnM = document.createElement('button'); btnM.type='button'; btnM.textContent='−';
      btnM.style.cssText = 'width:20px; height:20px; padding:0; font-size:0.9rem; border:1px solid #ccc; border-radius:3px; background:#f5f5f5; cursor:pointer;';
      const sizeVal = document.createElement('span');
      sizeVal.style.cssText = 'min-width:22px; text-align:center; font-size:0.85rem; font-weight:600;';
      sizeVal.textContent = size;
      const btnP = document.createElement('button'); btnP.type='button'; btnP.textContent='+';
      btnP.style.cssText = 'width:20px; height:20px; padding:0; font-size:0.9rem; border:1px solid #ccc; border-radius:3px; background:#f5f5f5; cursor:pointer;';
      const bNameSize = bloc.name;
      btnM.onclick = () => { const cur = BlocsEnlissage.blocs.find(b=>b.name===bNameSize)?.size||4; if(cur>1) BlocsEnlissage.resizeBloc(bNameSize, cur-1); };
      btnP.onclick = () => { const cur = BlocsEnlissage.blocs.find(b=>b.name===bNameSize)?.size||4; if(cur<32) BlocsEnlissage.resizeBloc(bNameSize, cur+1); };
      sizeCtrl.appendChild(btnM); sizeCtrl.appendChild(sizeVal); sizeCtrl.appendChild(btnP);
      sizeRow.appendChild(sizeLbl); sizeRow.appendChild(sizeCtrl);
      wrap.appendChild(sizeRow);
      container.appendChild(wrap);
    });
  },

  // Applique la séquence de blocs à l'enlissage
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
    this.colOverrides = {}; // Réinitialiser les overrides individuels

    // Calculer le nombre total de fils
    const totalCols = fullSeq.reduce((s, t) => s + (blocMap[t].size || blocMap[t].colors.length || 4), 0);
    const shafts = SchemaEditor.shafts;

    // Redimensionner l'enlissage si nécessaire
    if (totalCols !== SchemaEditor.cols) {
      SchemaEditor.cols = totalCols;
      const colsInput = document.getElementById('schema-cols');
      if (colsInput) colsInput.value = totalCols;
      SchemaEditor.initData(false);
    }

    // Remplir l'enlissage de gauche à droite
    for (let r = 0; r < shafts; r++)
      for (let c = 0; c < totalCols; c++)
        SchemaEditor.enlissage[r][c] = false;

    let col = 0;
    for (const t of fullSeq) {
      const bloc = blocMap[t];
      const bSize = bloc.size || bloc.colors.length || 4;
      for (let c = 0; c < bSize; c++) {
        for (let r = 0; r < shafts; r++) {
          SchemaEditor.enlissage[r][col + c] = bloc.pattern[r]?.[c] || false;
        }
      }
      col += bSize;
    }

    SchemaEditor.render();
    SchemaEditor.saveToHiddenField();
    this.renderBand();
    this._syncOurdissage();
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
// Système de blocs identique à BlocsEnlissage pour la trame.
// Chaque bloc définit une séquence de couleurs (une par duite du bloc).
// rowOverrides[r] = couleur individuelle (prioritaire sur le bloc, modifiable au clic).
const BlocsTrame = {
  blocs: [],           // [{name, colors:[hex,...], size}]
  _lastSequence: [],   // séquence complète après applySequence
  rowOverrides: {},    // {rowIndex: hex} — couleurs individuelles

  _defaultColors: ['#4a7c9e','#c0392b','#27ae60','#8e44ad','#e67e22','#16a085','#d35400','#2c3e50'],

  _nextLetter() {
    const used = new Set(this.blocs.map(b => b.name));
    let code = 65;
    while (used.has(String.fromCharCode(code))) code++;
    return String.fromCharCode(code);
  },

  // Palette commune : toutes les couleurs utilisées dans les blocs + overrides
  _allColors() {
    const set = new Set();
    this.blocs.forEach(b => (b.colors || []).forEach(c => { if(c) set.add(c); }));
    Object.values(this.rowOverrides).forEach(c => { if(c) set.add(c); });
    // Ajouter aussi les couleurs des blocs enlissage pour la palette partagée
    if (typeof BlocsEnlissage !== 'undefined') {
      BlocsEnlissage.blocs.forEach(b => (b.colors || []).forEach(c => { if(c) set.add(c); }));
      Object.values(BlocsEnlissage.colOverrides || {}).forEach(c => { if(c) set.add(c); });
    }
    return [...set];
  },

  // Calcule la couleur effective d'une duite (override > bloc > défaut)
  _colorForRow(r) {
    if (this.rowOverrides[r]) return this.rowOverrides[r];
    // Chercher dans la séquence
    if (this._lastSequence && this._lastSequence.length) {
      const blocMap = {};
      this.blocs.forEach(b => { blocMap[b.name] = b; });
      let row = 0;
      for (const t of this._lastSequence) {
        const bloc = blocMap[t];
        if (!bloc) continue;
        const bSize = bloc.size || bloc.colors.length || 2;
        if (r >= row && r < row + bSize) {
          return bloc.colors[r - row] || this._defaultColors[(r - row) % this._defaultColors.length];
        }
        row += bSize;
      }
    }
    return this._defaultColors[r % this._defaultColors.length];
  },

  add() {
    const name = this._nextLetter();
    const size = 2;
    const colors = [
      this._defaultColors[this.blocs.length % this._defaultColors.length],
      this._defaultColors[(this.blocs.length + 1) % this._defaultColors.length]
    ];
    this.blocs.push({ name, colors, size });
    this.render();
  },

  remove(name) {
    this.blocs = this.blocs.filter(b => b.name !== name);
    this.render();
  },

  resizeBloc(name, newSize) {
    const bloc = this.blocs.find(b => b.name === name);
    if (!bloc) return;
    bloc.size = newSize;
    const prev = bloc.colors.slice();
    bloc.colors = Array.from({length: newSize}, (_, i) =>
      prev[i] || this._defaultColors[i % this._defaultColors.length]);
    this.render();
  },

  setStepColor(blocName, stepIdx, color) {
    const bloc = this.blocs.find(b => b.name === blocName);
    if (!bloc) return;
    bloc.colors[stepIdx] = color;
    this.render();
    this.renderBand();
    SchemaEditor.saveToHiddenField();
    updateSchemaPreview();
  },

  // Couleur individuelle d'une duite (override)
  setRowColor(rowIdx, color) {
    this.rowOverrides[rowIdx] = color;
    this.renderBand();
    SchemaEditor.saveToHiddenField();
    updateSchemaPreview();
    // Mettre à jour le récapitulatif matières
    if (typeof syncOurdissageFromEnlissage === 'function' && BlocsEnlissage._lastSequence?.length) {
      syncOurdissageFromEnlissage();
    }
  },

  // Rendu de la bande colorée à droite du pédalage
  renderBand() {
    const band = document.getElementById('trame-band');
    if (!band) return;
    const rows = SchemaEditor.rows;
    const cellSize = rows > 32 ? 10 : rows > 20 ? 12 : 14;
    const allColors = this._allColors();
    band.innerHTML = '';

    for (let r = 0; r < rows; r++) {
      const color = this._colorForRow(r);
      const seg = document.createElement('div');
      seg.dataset.row = r;
      seg.style.cssText = `width:${cellSize}px; height:${cellSize}px; background:${color}; border-radius:2px; flex-shrink:0; cursor:pointer;`;
      seg.title = `Duite ${r + 1} — cliquer pour modifier`;

      const idx = r;
      seg.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('._trame-popover').forEach(p => p.remove());
        _showColorPopover(seg, color, allColors,
          (c) => { BlocsTrame.setRowColor(idx, c); },
          `Duite ${r + 1}`
        );
      });
      band.appendChild(seg);
    }
  },

  // Rendu du panneau de définition des blocs dans #trame-blocs-list
  render() {
    const container = document.getElementById('trame-blocs-list');
    if (!container) return;
    if (this.blocs.length === 0) {
      container.innerHTML = '<div style="font-size:0.78rem; color:var(--color-text-muted);">Aucun bloc défini.</div>';
      return;
    }
    container.innerHTML = '';
    this.blocs.forEach(bloc => {
      const size = bloc.size || bloc.colors.length || 2;
      const wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex; align-items:center; gap:0.5rem; padding:0.4rem; background:#fff; border:1px solid var(--color-border-light,#e0d8cc); border-radius:4px; flex-wrap:wrap;';

      // Label + supprimer
      const labelCol = document.createElement('div');
      labelCol.style.cssText = 'display:flex; flex-direction:column; align-items:center; gap:4px; min-width:28px;';
      const lbl = document.createElement('strong');
      lbl.textContent = bloc.name;
      const delBtn = document.createElement('button');
      delBtn.type = 'button'; delBtn.textContent = '×';
      delBtn.style.cssText = 'background:none; border:none; color:#c0392b; cursor:pointer; font-size:0.9rem; padding:0;';
      delBtn.onclick = () => BlocsTrame.remove(bloc.name);
      labelCol.appendChild(lbl); labelCol.appendChild(delBtn);
      wrap.appendChild(labelCol);

      // Pastilles de couleur pour chaque duite du bloc
      const stepsEl = document.createElement('div');
      stepsEl.style.cssText = 'display:flex; gap:3px; align-items:center; flex-wrap:wrap;';
      for (let s = 0; s < size; s++) {
        const c = bloc.colors[s] || '#cccccc';
        const sw = document.createElement('div');
        sw.style.cssText = `width:20px; height:20px; background:${c}; border-radius:3px; cursor:pointer; border:1px solid #ccc;`;
        sw.title = `Duite ${s + 1} du bloc ${bloc.name}`;
        const bName = bloc.name, sIdx = s;
        sw.addEventListener('click', (e) => {
          e.stopPropagation();
          document.querySelectorAll('._trame-step-popover').forEach(p => p.remove());
          _showColorPopover(sw, c, BlocsTrame._allColors(),
            (col) => BlocsTrame.setStepColor(bName, sIdx, col),
            `Bloc ${bName} — duite ${sIdx + 1}`,
            '_trame-step-popover'
          );
        });
        stepsEl.appendChild(sw);
      }
      wrap.appendChild(stepsEl);

      // Boutons taille
      const sizeRow = document.createElement('div');
      sizeRow.style.cssText = 'display:flex; align-items:center; gap:3px; font-size:0.75rem;';
      const sizeLbl = document.createElement('span'); sizeLbl.textContent = 'Duites :';
      const btnM = document.createElement('button'); btnM.type='button'; btnM.textContent='−';
      btnM.style.cssText = 'width:20px; height:20px; padding:0; font-size:0.9rem; border:1px solid #ccc; border-radius:3px; background:#f5f5f5; cursor:pointer;';
      const sizeVal = document.createElement('span');
      sizeVal.style.cssText = 'min-width:18px; text-align:center; font-weight:600;';
      sizeVal.textContent = size;
      const btnP = document.createElement('button'); btnP.type='button'; btnP.textContent='+';
      btnP.style.cssText = 'width:20px; height:20px; padding:0; font-size:0.9rem; border:1px solid #ccc; border-radius:3px; background:#f5f5f5; cursor:pointer;';
      const bNameSize = bloc.name;
      btnM.onclick = () => { const cur = BlocsTrame.blocs.find(b=>b.name===bNameSize)?.size||2; if(cur>1) BlocsTrame.resizeBloc(bNameSize, cur-1); };
      btnP.onclick = () => { const cur = BlocsTrame.blocs.find(b=>b.name===bNameSize)?.size||2; if(cur<32) BlocsTrame.resizeBloc(bNameSize, cur+1); };
      sizeRow.appendChild(sizeLbl); sizeRow.appendChild(btnM); sizeRow.appendChild(sizeVal); sizeRow.appendChild(btnP);
      wrap.appendChild(sizeRow);
      container.appendChild(wrap);
    });
  },

  // Applique la séquence de blocs à la bande trame
  applySequence(sequenceStr, repeat) {
    if (this.blocs.length === 0) { showToast('Définissez au moins un bloc trame avant d\'appliquer.', 'error'); return; }
    const tokens = sequenceStr.trim().toUpperCase().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) { showToast('Entrez une séquence (ex : A B A B).', 'error'); return; }
    const blocMap = {};
    this.blocs.forEach(b => { blocMap[b.name] = b; });
    for (const t of tokens) {
      if (!blocMap[t]) { showToast(`Bloc trame "${t}" non défini.`, 'error'); return; }
    }
    const fullSeq = [];
    for (let i = 0; i < repeat; i++) fullSeq.push(...tokens);
    this._lastSequence = fullSeq;
    this.rowOverrides = {}; // Réinitialiser les overrides individuels

    // Calculer le nombre total de duites
    const totalRows = fullSeq.reduce((s, t) => s + (blocMap[t].size || blocMap[t].colors.length || 2), 0);

    // Redimensionner le pédalage si nécessaire
    if (totalRows !== SchemaEditor.rows) {
      SchemaEditor.rows = totalRows;
      const rowsInput = document.getElementById('schema-rows');
      if (rowsInput) rowsInput.value = totalRows;
      SchemaEditor.initData(false);
    }

    SchemaEditor.render();
    SchemaEditor.saveToHiddenField();
    this.renderBand();
    showToast(`Trame remplie : ${totalRows} duites en ${fullSeq.length} blocs.`, 'success');
  },

  // Compatibilité avec l'ancien code (resize appelé depuis SchemaEditor.render)
  resize(rows) {
    // Rien à faire : renderBand() est appelé explicitement
  }
};

// Alias pour compatibilité avec saveToHiddenField / loadFromData
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

