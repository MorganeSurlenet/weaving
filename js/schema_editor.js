// ─── ÉDITEUR DE SCHÉMA (ENLAÇAGE / ATTACHAGE / PÉDALAGE) ────────────────────

const SchemaEditor = {
  // Données des 3 grilles : tableaux 2D de booléens
  enlacement: [],  // [row][col] — rows=cadres, cols=fils
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
    // Enlaçage : cadres (lignes) × fils (colonnes)
    this.enlacement = makeGrid(this.shafts, this.cols,     keepExisting ? this.enlacement : null);
    // Attachage : cadres (lignes) × pédales (colonnes)
    this.attachage  = makeGrid(this.shafts, this.treadles, keepExisting ? this.attachage  : null);
    // Pédalage : duites (lignes) × pédales (colonnes)
    this.pedalage   = makeGrid(this.rows,   this.treadles, keepExisting ? this.pedalage   : null);
  },

  render() {
    // Enlaçage : cadres × fils
    this._renderGrid('grid-enlacement', this.enlacement, this.shafts, this.cols,     'enlacement');
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
    data[r][c] = value;
    // Mettre à jour visuellement la cellule sans re-render complet
    const container = document.getElementById(
      gridName === 'enlacement' ? 'grid-enlacement' :
      gridName === 'attachage'  ? 'grid-attachage'  : 'grid-pedalage'
    );
    if (!container) return;
    const cells = container.querySelectorAll('.schema-cell');
    const cols = gridName === 'enlacement' ? this.cols :
                 gridName === 'attachage'  ? this.treadles : this.treadles;
    const idx = r * cols + c;
    if (cells[idx]) {
      cells[idx].classList.toggle('filled', value);
    }
    this.saveToHiddenField();
  },

  saveToHiddenField() {
    const field = document.getElementById('schema-data');
    if (!field) return;
    field.value = JSON.stringify({
      cols: this.cols,
      rows: this.rows,
      shafts: this.shafts,
      treadles: this.treadles,
      enlacement: this.enlacement,
      attachage:  this.attachage,
      pedalage:   this.pedalage,
    });
  },

  loadFromData(data) {
    if (!data) return;
    try {
      const d = typeof data === 'string' ? JSON.parse(data) : data;
      this.cols     = d.cols     || 24;
      this.rows     = d.rows     || 16;
      this.shafts   = d.shafts   || 4;
      this.treadles = d.treadles || 4;
      this.enlacement = d.enlacement || [];
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
    } catch(e) { console.warn('Schema load error', e); }
  },

  clear() {
    this.initData(false);
    this.render();
    this.saveToHiddenField();
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

    // Enlaçage : colonne 1, lignes 1-2
    const zoneEnl = document.createElement('div');
    zoneEnl.className = 'draft-zone-enlacement';
    // Enlaçage : cadres × fils
    makeReadOnlyGrid(zoneEnl, 'Enlaçage', d.enlacement, d.shafts, d.cols);
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
function resizeSchemaGrids() { SchemaEditor.resize(); }
function clearSchema()       { SchemaEditor.clear(); }
