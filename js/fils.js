/* ─── BIBLIOTHÈQUE DE FILS ─────────────────────────────────────────────────── */

'use strict';

const FilsLib = {
  fils: [],
  filsSha: '',

  // ── Chargement depuis GitHub ──────────────────────────────────────────────
  async load() {
    const { token, owner, repo, branch } = App.github;
    if (!token || !owner || !repo) return;
    try {
      const r = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/data/fils.json?ref=${branch}&t=${Date.now()}`,
        { headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' } }
      );
      if (!r.ok) { this.fils = []; return; }
      const data = await r.json();
      this.filsSha = data.sha;
      this.fils = JSON.parse(atob(data.content.replace(/\n/g, '')));
    } catch(e) {
      console.warn('FilsLib.load error', e);
      this.fils = [];
    }
  },

  // ── Sauvegarde sur GitHub ─────────────────────────────────────────────────
  async save() {
    const { token, owner, repo, branch } = App.github;
    if (!token || !owner || !repo) { showToast('Configurez GitHub d\'abord', 'error'); return false; }
    try {
      const content = btoa(unescape(encodeURIComponent(JSON.stringify(this.fils, null, 2))));
      const payload = { message: 'Mise à jour bibliothèque de fils', content, branch };
      if (this.filsSha) payload.sha = this.filsSha;
      const r = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/data/fils.json`,
        { method: 'PUT', headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json', 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
      );
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      this.filsSha = data.content.sha;
      return true;
    } catch(e) {
      console.error('FilsLib.save error', e);
      showToast('Erreur de sauvegarde : ' + e.message, 'error');
      return false;
    }
  },

  // ── CRUD ──────────────────────────────────────────────────────────────────
  getById(id) { return this.fils.find(f => f.id === id); },

  add(fil) {
    fil.id = 'fil_' + Date.now().toString(36);
    fil.nm_calc = this.parseNm(fil.nm);
    this.fils.push(fil);
  },

  update(id, fil) {
    const idx = this.fils.findIndex(f => f.id === id);
    if (idx === -1) return;
    fil.id = id;
    fil.nm_calc = this.parseNm(fil.nm);
    this.fils[idx] = fil;
  },

  remove(id) {
    this.fils = this.fils.filter(f => f.id !== id);
  },

  // ── Conversion Nm (notation X/Y) → m/kg ──────────────────────────────────
  parseNm(val) {
    if (!val) return 0;
    const s = String(val).trim();
    if (s.includes('/')) {
      const [a, b] = s.split('/').map(Number);
      if (b && b > 0) return Math.round((a / b) * 1000);
    }
    const n = parseFloat(s);
    return isNaN(n) ? 0 : Math.round(n * 1000);
  }
};

// ── Rendu de la vue bibliothèque ──────────────────────────────────────────────
function renderFilsView() {
  const container = document.getElementById('fils-list');
  if (!container) return;

  if (FilsLib.fils.length === 0) {
    container.innerHTML = '<p class="empty-state">Aucun fil dans la bibliothèque.<br>Cliquez sur <strong>+ Nouveau fil</strong> pour commencer.</p>';
    return;
  }

  // Grouper par matière
  const grouped = {};
  FilsLib.fils.forEach(f => {
    const key = f.matiere || 'Autre';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(f);
  });

  let html = '';
  Object.keys(grouped).sort().forEach(matiere => {
    html += `<div class="fils-group">
      <div class="fils-group-title">${matiere}</div>
      <div class="fils-cards">`;
    grouped[matiere].forEach(fil => {
      const nmDisplay = fil.nm ? `Nm ${fil.nm}` : '';
      const prixDisplay = fil.prix_kg ? `${fil.prix_kg} €/kg` : '';
      html += `
        <div class="fil-card" data-id="${fil.id}">
          <div class="fil-card-color" style="background:${fil.couleur || '#ccc'};" title="${fil.coloris || ''}"></div>
          <div class="fil-card-body">
            <div class="fil-card-name">${fil.marque || ''} <span>${fil.reference || ''}</span></div>
            <div class="fil-card-meta">${[fil.coloris, nmDisplay, prixDisplay].filter(Boolean).join(' · ')}</div>
            ${fil.lien ? `<a href="${fil.lien}" target="_blank" rel="noopener" class="fil-card-lien">🛒 Acheter en ligne</a>` : ''}
          </div>
          <div class="fil-card-actions">
            <button class="btn btn-sm" onclick="openEditFilModal('${fil.id}')" title="Modifier">✎</button>
            <button class="btn btn-sm btn-danger" onclick="deleteFil('${fil.id}')" title="Supprimer">✕</button>
          </div>
        </div>`;
    });
    html += `</div></div>`;
  });
  container.innerHTML = html;
}

// ── Modal ajout / modification ────────────────────────────────────────────────
function openNewFilModal() {
  document.getElementById('fil-modal-title').textContent = 'Nouveau fil';
  document.getElementById('fil-form').reset();
  document.getElementById('fil-id').value = '';
  document.getElementById('fil-couleur').value = '#cccccc';
  document.getElementById('fil-modal').style.display = 'flex';
}

function openEditFilModal(id) {
  const fil = FilsLib.getById(id);
  if (!fil) return;
  document.getElementById('fil-modal-title').textContent = 'Modifier le fil';
  document.getElementById('fil-id').value = fil.id;
  document.getElementById('fil-marque').value    = fil.marque    || '';
  document.getElementById('fil-reference').value = fil.reference || '';
  document.getElementById('fil-matiere').value   = fil.matiere   || '';
  document.getElementById('fil-coloris').value   = fil.coloris   || '';
  document.getElementById('fil-couleur').value   = fil.couleur   || '#cccccc';
  document.getElementById('fil-nm').value        = fil.nm        || '';
  document.getElementById('fil-prix-kg').value   = fil.prix_kg   || '';
  document.getElementById('fil-notes').value     = fil.notes     || '';
  document.getElementById('fil-lien').value      = fil.lien      || '';
  document.getElementById('fil-modal').style.display = 'flex';
}

function closeFilModal() {
  document.getElementById('fil-modal').style.display = 'none';
}

async function saveFilModal() {
  const id = document.getElementById('fil-id').value;
  const fil = {
    marque:    document.getElementById('fil-marque').value.trim(),
    reference: document.getElementById('fil-reference').value.trim(),
    matiere:   document.getElementById('fil-matiere').value.trim(),
    coloris:   document.getElementById('fil-coloris').value.trim(),
    couleur:   document.getElementById('fil-couleur').value,
    nm:        document.getElementById('fil-nm').value.trim(),
    prix_kg:   parseFloat(document.getElementById('fil-prix-kg').value) || 0,
    notes:     document.getElementById('fil-notes').value.trim(),
    lien:      document.getElementById('fil-lien').value.trim(),
  };
  if (!fil.marque && !fil.reference) { showToast('Renseignez au moins la marque ou la référence', 'error'); return; }

  if (id) { FilsLib.update(id, fil); } else { FilsLib.add(fil); }

  const ok = await FilsLib.save();
  if (ok) {
    showToast('Fil sauvegardé !');
    closeFilModal();
    renderFilsView();
    refreshFilsSelects();
  }
}

async function deleteFil(id) {
  const fil = FilsLib.getById(id);
  if (!fil) return;
  const name = [fil.marque, fil.reference, fil.coloris].filter(Boolean).join(' ');
  if (!confirm(`Supprimer "${name}" ?`)) return;
  FilsLib.remove(id);
  const ok = await FilsLib.save();
  if (ok) {
    showToast('Fil supprimé');
    renderFilsView();
    refreshFilsSelects();
  }
}

// ── Sélects dans la fiche technique ──────────────────────────────────────────
function refreshFilsSelects() {
  ['chaine', 'trame'].forEach(type => {
    const sel = document.getElementById(`fil-select-${type}`);
    if (!sel) return;
    const currentVal = sel.value;
    sel.innerHTML = '<option value="">— Choisir dans la bibliothèque —</option>';
    FilsLib.fils.forEach(f => {
      const label = [f.marque, f.reference, f.coloris].filter(Boolean).join(' · ');
      const opt = document.createElement('option');
      opt.value = f.id;
      opt.textContent = label;
      if (f.couleur) opt.style.borderLeft = `4px solid ${f.couleur}`;
      sel.appendChild(opt);
    });
    if (currentVal) sel.value = currentVal;
  });
}

function applyFilToForm(type) {
  const sel = document.getElementById(`fil-select-${type}`);
  if (!sel || !sel.value) return;
  const fil = FilsLib.getById(sel.value);
  if (!fil) return;

  const form = document.getElementById('fiche-form');
  const setField = (name, val) => {
    const el = form.querySelector(`[name="${name}"]`);
    if (el) el.value = val || '';
  };

  setField(`fil_${type}`, fil.matiere || '');
  setField(`titrage_${type}_val`, fil.nm || '');
  setField(`prix_${type}_kg`, fil.prix_kg || '');

  // Déclencher la conversion Nm
  if (typeof convertTitrage === 'function') convertTitrage(type);
  if (typeof updateFormCalcs === 'function') updateFormCalcs();

  showToast(`Fil "${[fil.marque, fil.reference].filter(Boolean).join(' ')}" appliqué`);
}

// ── Créer un nouveau fil directement depuis la fiche technique ────────────────
let _filFromFicheTarget = null; // 'chaine' ou 'trame'

function openNewFilFromFiche(type) {
  _filFromFicheTarget = type;
  openNewFilModal();
}

// Surcharge de saveFilModal pour gérer le retour vers la fiche
const _origSaveFilModal = saveFilModal;
saveFilModal = async function() {
  const id = document.getElementById('fil-id').value;
  const fil = {
    marque:    document.getElementById('fil-marque').value.trim(),
    reference: document.getElementById('fil-reference').value.trim(),
    matiere:   document.getElementById('fil-matiere').value.trim(),
    coloris:   document.getElementById('fil-coloris').value.trim(),
    couleur:   document.getElementById('fil-couleur').value,
    nm:        document.getElementById('fil-nm').value.trim(),
    prix_kg:   parseFloat(document.getElementById('fil-prix-kg').value) || 0,
    notes:     document.getElementById('fil-notes').value.trim(),
    lien:      document.getElementById('fil-lien').value.trim(),
  };
  if (!fil.marque && !fil.reference) { showToast('Renseignez au moins la marque ou la référence', 'error'); return; }
  let newId;
  if (id) { FilsLib.update(id, fil); newId = id; }
  else { newId = FilsLib.add(fil); }
  const ok = await FilsLib.save();
  if (ok) {
    showToast('Fil sauvegardé !');
    closeFilModal();
    renderFilsView();
    refreshFilsSelects();
    // Si ouvert depuis la fiche, sélectionner et appliquer automatiquement
    if (_filFromFicheTarget) {
      const sel = document.getElementById(`fil-select-${_filFromFicheTarget}`);
      if (sel) {
        sel.value = newId;
        applyFilToForm(_filFromFicheTarget);
      }
      _filFromFicheTarget = null;
    }
  }
};
