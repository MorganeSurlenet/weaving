/* ============================================================
   TISSAGE — Application de fiches techniques
   Stockage : API GitHub (fichier data/fiches.json dans le dépôt)
   ============================================================ */

'use strict';

// ─── ÉTAT GLOBAL ────────────────────────────────────────────
const App = {
  fiches: [],
  github: {
    token: '',
    owner: '',
    repo: '',
    branch: 'main',
    filePath: 'data/fiches.json',
    fileSha: ''
  },
  currentFicheId: null,
  editMode: false
};

// ─── UTILITAIRES ────────────────────────────────────────────
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function showToast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

function $(sel, ctx = document) { return ctx.querySelector(sel); }
function $$(sel, ctx = document) { return [...ctx.querySelectorAll(sel)]; }

// ─── PERSISTANCE LOCALE (fallback) ──────────────────────────
function saveLocal() {
  localStorage.setItem('tissage_fiches', JSON.stringify(App.fiches));
}

function loadLocal() {
  try {
    const raw = localStorage.getItem('tissage_fiches');
    if (raw) App.fiches = JSON.parse(raw);
  } catch (e) { App.fiches = []; }
}

// ─── CONFIG GITHUB ──────────────────────────────────────────
function loadGithubConfig() {
  try {
    const raw = localStorage.getItem('tissage_github');
    if (raw) Object.assign(App.github, JSON.parse(raw));
  } catch (e) {}
}

function saveGithubConfig() {
  localStorage.setItem('tissage_github', JSON.stringify({
    token: App.github.token,
    owner: App.github.owner,
    repo: App.github.repo,
    branch: App.github.branch
  }));
}

function isGithubConfigured() {
  return App.github.token && App.github.owner && App.github.repo;
}

function updateConfigStatus() {
  const el = document.getElementById('config-status');
  if (!el) return;
  if (isGithubConfigured()) {
    el.className = 'config-status connected';
    el.querySelector('.label').textContent = `${App.github.owner}/${App.github.repo}`;
  } else {
    el.className = 'config-status';
    el.querySelector('.label').textContent = 'Configurer GitHub';
  }
}

// ─── API GITHUB ─────────────────────────────────────────────
async function githubFetch(path, options = {}) {
  const url = `https://api.github.com/repos/${App.github.owner}/${App.github.repo}/${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${App.github.token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.headers || {})
    }
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Erreur GitHub ${res.status}`);
  }
  return res.json();
}

async function loadFichesFromGithub() {
  if (!isGithubConfigured()) { loadLocal(); return; }
  try {
    const data = await githubFetch(`contents/${App.github.filePath}?ref=${App.github.branch}`);
    App.github.fileSha = data.sha;
    const raw = atob(data.content.replace(/\n/g, ''));
    const decoded = decodeURIComponent(escape(raw));
    App.fiches = JSON.parse(decoded) || [];
    saveLocal();
    showToast('Fiches chargées depuis GitHub', 'success');
  } catch (e) {
    if (e.message.includes('404')) {
      App.fiches = [];
      App.github.fileSha = '';
      showToast('Nouveau dépôt — aucune fiche pour l\'instant', 'info');
    } else {
      showToast(`Erreur GitHub : ${e.message}`, 'error');
      loadLocal();
    }
  }
}

async function saveFichesToGithub() {
  if (!isGithubConfigured()) { saveLocal(); return; }
  const content = btoa(unescape(encodeURIComponent(JSON.stringify(App.fiches, null, 2))));
  const body = {
    message: `Mise à jour fiches — ${new Date().toLocaleString('fr-FR')}`,
    content,
    branch: App.github.branch
  };
  if (App.github.fileSha) body.sha = App.github.fileSha;
  try {
    const res = await githubFetch(`contents/${App.github.filePath}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    App.github.fileSha = res.content.sha;
    saveLocal();
    showToast('Fiche sauvegardée sur GitHub ✓', 'success');
  } catch (e) {
    showToast(`Erreur sauvegarde : ${e.message}`, 'error');
    saveLocal();
  }
}

// ─── NAVIGATION ─────────────────────────────────────────────
function showView(viewId) {
  $$('.view').forEach(v => v.classList.remove('active'));
  $$('nav a').forEach(a => a.classList.remove('active'));
  const view = document.getElementById(viewId);
  if (view) view.classList.add('active');
  const link = $(`nav a[data-view="${viewId}"]`);
  if (link) link.classList.add('active');
}

// ─── VUE LISTE ──────────────────────────────────────────────
function renderFichesList(filter = '') {
  const container = document.getElementById('fiches-grid');
  const fiches = filter
    ? App.fiches.filter(f =>
        (f.projet || '').toLowerCase().includes(filter.toLowerCase()) ||
        (f.armure || '').toLowerCase().includes(filter.toLowerCase()) ||
        (f.fil_chaine || '').toLowerCase().includes(filter.toLowerCase())
      )
    : App.fiches;

  if (fiches.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <p>${filter ? 'Aucune fiche ne correspond à votre recherche.' : 'Aucune fiche pour l\'instant.'}</p>
        ${!filter ? '<button class="btn btn-primary" onclick="openNewFiche()">+ Créer ma première fiche</button>' : ''}
      </div>`;
    return;
  }

  container.innerHTML = fiches.map(f => `
    <div class="fiche-card" onclick="openFicheDetail('${f.id}')">
      <div class="card-actions">
        <button class="btn-icon" title="Modifier" onclick="event.stopPropagation(); openEditFiche('${f.id}')">✏️</button>
        <button class="btn-icon" title="Supprimer" onclick="event.stopPropagation(); confirmDelete('${f.id}')">🗑️</button>
      </div>
      <h3>${f.projet || 'Sans titre'}</h3>
      <div class="meta">
        ${f.armure ? `<span>${f.armure}</span>` : ''}
        ${f.fil_chaine ? `<span>${f.fil_chaine}</span>` : ''}
        ${f.date_creation ? `<span>${formatDate(f.date_creation)}</span>` : ''}
      </div>
    </div>
  `).join('');
}

// ─── VUE DÉTAIL ─────────────────────────────────────────────
function openFicheDetail(id) {
  const fiche = App.fiches.find(f => f.id === id);
  if (!fiche) return;
  App.currentFicheId = id;

  const container = document.getElementById('detail-content');
  container.innerHTML = renderFicheDetailHTML(fiche);
  document.getElementById('detail-title').textContent = fiche.projet || 'Fiche sans titre';
  document.getElementById('btn-edit-detail').onclick = () => openEditFiche(id);
  document.getElementById('btn-print-detail').onclick = () => window.print();
  // Rendu lecture seule du schéma
  if (typeof SchemaEditor !== 'undefined' && fiche.schema_data) {
    SchemaEditor.renderReadOnly('schema-readonly-container', fiche.schema_data);
  } else {
    const el = document.getElementById('schema-readonly-container');
    if (el) el.innerHTML = '<p style="color:var(--color-text-muted); text-align:center; font-style:italic;">Aucun schéma enregistré.</p>';
  }
  showView('view-detail');
}

function renderFicheDetailHTML(f) {
  const val = (v, unit = '') => v !== undefined && v !== '' && v !== null
    ? `<strong>${v}</strong>${unit ? ' ' + unit : ''}`
    : '<span style="color:#bbb">—</span>';

  // Calculs chaîne
  const larg_brut = calcLargBrut(f);
  const larg_peigne = calcLargPeigne(f);
  const long_metier = calcLongMetier(f);
  const long_chaine_article = calcLongChaineArticle(f);
  const long_chaine_necessaire_article = calcLongChaineNecessaireArticle(f);
  const long_chaine_totale = calcLongChaineTotale(f);
  const nb_fils_chaine = calcNbFilsChaine(f);
  const qte_fils_m = calcQteFils_m(f);
  const qte_fils_kg = calcQteFils_kg(f);
  const cout_chaine = calcCoutChaine(f);

  // Calculs trame
  const nb_fils_trame = calcNbFilsTrame(f);
  const qte_trame_m = calcQteTrame_m(f);
  const qte_trame_kg = calcQteTrame_kg(f);
  const cout_trame = calcCoutTrame(f);

  return `
  <!-- Infos générales -->
  <div class="fiche-section">
    <table class="data-table">
      <tr><td class="row-label">Projet du tissu</td><td colspan="3">${val(f.projet)}</td></tr>
      <tr><td class="row-label">Source d'inspiration</td><td colspan="3">${val(f.source_inspiration)}</td></tr>
      <tr>
        <td class="row-label">Fil de chaîne</td><td>${val(f.fil_chaine)}</td>
        <td class="row-label">Titrage</td><td>${
          f.titrage_chaine_mode === 'mkg' || f.titrage_chaine_sys === 'mkg'
            ? (f.titrage_chaine ? `<strong>${Math.round(f.titrage_chaine).toLocaleString('fr-FR')} m/kg</strong>` : val(null))
            : (f.titrage_chaine_val ? `<strong>${f.titrage_chaine_val} ${f.titrage_chaine_sys||'Nm'}</strong> <span style="color:var(--color-text-muted);font-size:0.8em;">(${f.titrage_chaine ? Math.round(f.titrage_chaine).toLocaleString('fr-FR') + ' m/kg' : '—'})</span>` : val(null))
        }</td>
      </tr>
      <tr>
        <td class="row-label">Fil de trame</td><td>${val(f.fil_trame)}</td>
        <td class="row-label">Titrage</td><td>${
          f.titrage_trame_mode === 'mkg' || f.titrage_trame_sys === 'mkg'
            ? (f.titrage_trame ? `<strong>${Math.round(f.titrage_trame).toLocaleString('fr-FR')} m/kg</strong>` : val(null))
            : (f.titrage_trame_val ? `<strong>${f.titrage_trame_val} ${f.titrage_trame_sys||'Nm'}</strong> <span style="color:var(--color-text-muted);font-size:0.8em;">(${f.titrage_trame ? Math.round(f.titrage_trame).toLocaleString('fr-FR') + ' m/kg' : '—'})</span>` : val(null))
        }</td>
      </tr>
      <tr><td class="row-label">Armure</td><td colspan="3">${val(f.armure)}</td></tr>
      <tr>
        <td class="row-label">Densité chaîne</td><td>${val(f.densite_chaine, 'fils/cm')}</td>
        <td class="row-label">Densité trame</td><td>${val(f.densite_trame, 'fils/cm')}</td>
      </tr>
      <tr>
        <td class="row-label">Peigne</td><td>${val(f.peigne_dents, 'dents/cm')}</td>
        <td class="row-label">Fils par dent</td><td>${val(f.fils_par_dent)}</td>
      </tr>
    </table>
  </div>

  <!-- Calcul chaîne -->
  <div class="fiche-section">
    <div class="fiche-section-title">Calcul de la chaîne</div>
    <table class="data-table">
      <tr><th colspan="4" style="text-align:center">Largeur de la chaîne</th></tr>
      <tr><td class="row-label">Largeur souhaitée du tissu fini</td><td class="formula-cell"></td><td class="result-cell">${val(f.larg_souhaitee, 'cm')}</td></tr>
      <tr><td class="row-label">+ ajout traitement</td><td class="formula-cell">${val(f.larg_ajout_traitement_pct, '%')}</td><td class="result-cell">${larg_brut !== null ? val(larg_brut.toFixed(1), 'cm') : val(null)}</td></tr>
      <tr><td class="row-label">= largeur tissu brut tombé du métier</td><td class="formula-cell"></td><td class="result-cell">${larg_brut !== null ? val(larg_brut.toFixed(1), 'cm') : val(null)}</td></tr>
      <tr><td class="row-label">+ ajout retrait</td><td class="formula-cell">${val(f.larg_ajout_retrait_pct, '%')}</td><td class="result-cell">${larg_peigne !== null ? val((larg_peigne - (larg_brut || 0)).toFixed(1), 'cm') : val(null)}</td></tr>
      <tr><td class="row-label"><strong>= largeur de chaîne en peigne</strong></td><td class="formula-cell"></td><td class="result-cell">${larg_peigne !== null ? val(larg_peigne.toFixed(1), 'cm') : val(null)}</td></tr>

      <tr><th colspan="4" style="text-align:center">Longueur de la chaîne</th></tr>
      <tr><td class="row-label">Longueur souhaitée du tissu fini</td><td class="formula-cell"></td><td class="result-cell">${val(f.long_souhaitee, 'cm')}</td></tr>
      <tr><td class="row-label">+ ajout traitement</td><td class="formula-cell">${val(f.long_ajout_traitement_pct, '%')}</td><td class="result-cell">${long_metier !== null ? val(long_metier.toFixed(1), 'cm') : val(null)}</td></tr>
      <tr><td class="row-label">= longueur tissu tombé du métier</td><td class="formula-cell"></td><td class="result-cell">${long_metier !== null ? val(long_metier.toFixed(1), 'cm') : val(null)}</td></tr>
      <tr><td class="row-label">+ ajout retrait</td><td class="formula-cell">${val(f.long_ajout_retrait_pct, '%')}</td><td class="result-cell">${long_chaine_article !== null ? val((long_chaine_article - (long_metier || 0)).toFixed(1), 'cm') : val(null)}</td></tr>
      <tr><td class="row-label"><strong>= longueur de chaîne tissée par article</strong></td><td class="formula-cell"></td><td class="result-cell">${long_chaine_article !== null ? val(long_chaine_article.toFixed(1), 'cm') : val(null)}</td></tr>
      <tr><td class="row-label">+ franges</td><td class="formula-cell"></td><td class="result-cell">${val(f.franges, 'cm')}</td></tr>
      <tr><td class="row-label">= longueur de chaîne nécessaire par article</td><td class="formula-cell"></td><td class="result-cell">${long_chaine_necessaire_article !== null ? val(long_chaine_necessaire_article.toFixed(1), 'cm') : val(null)}</td></tr>
      <tr><td class="row-label">× nombre d'articles</td><td class="formula-cell"></td><td class="result-cell">${val(f.nb_articles)}</td></tr>
      <tr><td class="row-label">+ pertes attachages (60 cm)</td><td class="formula-cell">20 + 40 = 60 cm</td><td class="result-cell">60 cm</td></tr>
      <tr><td class="row-label"><strong>= longueur de chaîne nécessaire</strong></td><td class="formula-cell"></td><td class="result-cell">${long_chaine_totale !== null ? val(long_chaine_totale.toFixed(2), 'm') : val(null)}</td></tr>

      <tr><th colspan="4" style="text-align:center">Quantités chaîne</th></tr>
      <tr><td class="row-label">Nombre de fils de chaîne</td><td class="formula-cell">${f.larg_peigne_calc || larg_peigne ? (f.larg_peigne_calc || (larg_peigne||0).toFixed(1)) + ' cm × ' + (f.densite_chaine||'?') + ' fils/cm' : ''}</td><td class="result-cell">${nb_fils_chaine !== null ? val(Math.round(nb_fils_chaine), 'fils') : val(null)}</td></tr>
      <tr><td class="row-label">Quantité en mètres</td><td class="formula-cell">${nb_fils_chaine && long_chaine_totale ? Math.round(nb_fils_chaine) + ' fils × ' + long_chaine_totale.toFixed(2) + ' m' : ''}</td><td class="result-cell">${qte_fils_m !== null ? val(qte_fils_m.toFixed(1), 'm') : val(null)}</td></tr>
      <tr><td class="row-label">Quantité en kilos</td><td class="formula-cell">${f.titrage_chaine ? '÷ ' + f.titrage_chaine + ' m/kg' : ''}</td><td class="result-cell">${qte_fils_kg !== null ? val(qte_fils_kg.toFixed(3), 'kg') : val(null)}</td></tr>
      <tr><td class="row-label">Coût de la chaîne</td><td class="formula-cell">${f.prix_chaine_kg ? '× ' + f.prix_chaine_kg + ' €/kg' : ''}</td><td class="result-cell">${cout_chaine !== null ? val(cout_chaine.toFixed(2), '€') : val(null)}</td></tr>
    </table>
  </div>

  <!-- Calcul trame -->
  <div class="fiche-section">
    <div class="fiche-section-title">Calcul de la trame</div>
    <table class="data-table">
      <tr><td class="row-label">Nombre de fils de trame (duites)</td><td class="formula-cell">${f.long_chaine_tissee_calc || long_chaine_article ? (f.long_chaine_tissee_calc || (long_chaine_article||0).toFixed(1)) + ' cm × ' + (f.densite_trame||'?') + ' × ' + (f.nb_articles||'?') : ''}</td><td class="result-cell">${nb_fils_trame !== null ? val(Math.round(nb_fils_trame), 'duites') : val(null)}</td></tr>
      <tr><td class="row-label">Quantité en mètres</td><td class="formula-cell">${nb_fils_trame && larg_peigne ? Math.round(nb_fils_trame) + ' × ' + (larg_peigne||0).toFixed(1) + ' cm' : ''}</td><td class="result-cell">${qte_trame_m !== null ? val(qte_trame_m.toFixed(1), 'm') : val(null)}</td></tr>
      <tr><td class="row-label">Quantité en kilos</td><td class="formula-cell">${f.titrage_trame ? '÷ ' + f.titrage_trame + ' m/kg' : ''}</td><td class="result-cell">${qte_trame_kg !== null ? val(qte_trame_kg.toFixed(3), 'kg') : val(null)}</td></tr>
      <tr><td class="row-label">Coût de la trame</td><td class="formula-cell">${f.prix_trame_kg ? '× ' + f.prix_trame_kg + ' €/kg' : ''}</td><td class="result-cell">${cout_trame !== null ? val(cout_trame.toFixed(2), '€') : val(null)}</td></tr>
    </table>
  </div>

  <!-- Récapitulatif matières par couleur -->
  ${renderRecapMatieres(f)}

  <!-- Tableau ourdissage -->
  <div class="fiche-section">
    <div class="fiche-section-title">Tableau d'ourdissage des fils de chaîne</div>
    ${renderOurdissageDetail(f.ourdissage || [])}
  </div>

  <!-- Tableau lisses -->
  <div class="fiche-section">
    <div class="fiche-section-title">Tableau de comptage de lisses</div>
    ${renderLissesDetail(f.lisses || {})}
  </div>

  <!-- Schéma -->
  <div class="fiche-section">
    <div class="fiche-section-title">Schéma d'enlissage, d'attachage et de pédalage</div>
    <div id="schema-readonly-container"></div>
    ${f.notes ? `<div style="margin-top:1rem; padding:0.75rem; background:var(--color-accent-bg); border-radius:4px; font-size:0.875rem;"><strong>Notes :</strong> ${f.notes}</div>` : ''}
  </div>`;
}

// ─── RÉCAPITULATIF MATIÈRES PAR COULEUR ────────────────────────────────────
function calcRecapMatieres(f) {
  const recap = []; // { couleur, hex, usage, nbFils, longTotale_m, poids_g }

  // ── Chaîne : depuis le tableau d'ourdissage ──
  const longChaine = calcLongChaineTotale(f); // en mètres
  const mkg_chaine = f.titrage_chaine ? parseFloat(f.titrage_chaine) : null;
  if (f.ourdissage && f.ourdissage.length > 0 && longChaine) {
    f.ourdissage.forEach(row => {
      const total = parseInt(row.total) || (row.sequence || []).reduce((s, v) => s + (parseInt(v) || 0), 0);
      if (!total) return;
      const longTotale = total * longChaine;
      const poids_g = mkg_chaine ? (longTotale / mkg_chaine) * 1000 : null;
      recap.push({
        couleur: row.couleur || '',
        hex: row.hex || '',
        usage: 'Chaîne',
        nbFils: total,
        longTotale_m: longTotale,
        poids_g
      });
    });
  }

  // ── Trame : depuis les blocs de trame du schéma ──
  const larg_peigne = calcLargPeigne(f); // en cm
  const mkg_trame = f.titrage_trame ? parseFloat(f.titrage_trame) : null;
  if (f.schema_data) {
    try {
      const sd = typeof f.schema_data === 'string' ? JSON.parse(f.schema_data) : f.schema_data;
      const trameRows = sd.rows || 0;
      if (trameRows > 0 && larg_peigne) {
        // Calculer la couleur effective de chaque duite (nouveau modèle occurrenceColors)
        const trBlocMap = {};
        (sd.trameBlocs || []).forEach(b => { trBlocMap[b.name] = b; });
        const trSeq = sd.trameSequence || [];
        const trOccColors = sd.trameOccurrenceColors || [];
        const trDefaults = ['#4a7c9e','#c0392b','#27ae60','#8e44ad','#e67e22','#16a085','#d35400','#2c3e50'];
        // Construire la map ligne → couleur depuis les occurrences
        const trRowMap = {};
        let trRowIdx = 0;
        trSeq.forEach((t, i) => {
          const bloc = trBlocMap[t];
          if (!bloc) return;
          const bSize = bloc.size || bloc.pattern?.length || 4; // nb de duites = nb de lignes
          const color = trOccColors[i] || trDefaults[i % trDefaults.length];
          for (let r = 0; r < bSize; r++) trRowMap[trRowIdx + r] = color;
          trRowIdx += bSize;
        });
        const rowColors = [];
        for (let r = 0; r < trameRows; r++) {
          rowColors.push(trRowMap[r] || trDefaults[r % trDefaults.length]);
        }
        // Agréger par couleur unique
        const colorMap = {};
        rowColors.forEach(c => {
          if (!colorMap[c]) colorMap[c] = { hex: c, count: 0 };
          colorMap[c].count++;
        });
        Object.values(colorMap).forEach(g => {
          const longTotale = g.count * (larg_peigne / 100); // cm → m
          const poids_g = mkg_trame ? (longTotale / mkg_trame) * 1000 : null;
          recap.push({
            couleur: '',
            hex: g.hex,
            usage: 'Trame',
            nbFils: g.count,
            longTotale_m: longTotale,
            poids_g
          });
        });
      }
    } catch(e) {}
  }

  return recap;
}

function renderRecapMatieres(f) {
  const recap = calcRecapMatieres(f);
  if (!recap.length) return '';
  const rows = recap.map(r => `
    <tr>
      <td style="white-space:nowrap;">
        ${r.hex ? `<span style="display:inline-block;width:14px;height:14px;background:${r.hex};border-radius:2px;margin-right:4px;vertical-align:middle;"></span>` : ''}
        ${r.couleur || r.hex || ''}
      </td>
      <td style="text-align:center;">${r.usage}</td>
      <td style="text-align:right;">${r.nbFils}</td>
      <td style="text-align:right;">${r.longTotale_m ? r.longTotale_m.toFixed(1) + ' m' : '—'}</td>
      <td style="text-align:right;">${r.poids_g !== null && r.poids_g !== undefined ? Math.round(r.poids_g) + ' g' : '—'}</td>
    </tr>`).join('');
  return `
  <div class="fiche-section">
    <div class="fiche-section-title">Récapitulatif des matières par couleur</div>
    <table class="data-table" style="width:100%;">
      <thead>
        <tr style="background:var(--color-accent-bg);">
          <th style="text-align:left;">Couleur</th>
          <th style="text-align:center;">Usage</th>
          <th style="text-align:right;">Quantité</th>
          <th style="text-align:right;">Longueur totale</th>
          <th style="text-align:right;">Poids estimé</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

function renderOurdissageDetail(ourdissage) {
  if (!ourdissage || ourdissage.length === 0) {
    return '<p style="color:var(--color-text-muted); text-align:center; font-style:italic;">Non renseigné.</p>';
  }
  const cols = Math.max(...ourdissage.map(r => (r.sequence || []).length), 10);
  return `<table class="ourdissage-table">
    <thead><tr><th>Couleur</th>${Array.from({length: cols}, (_, i) => `<th>${i+1}</th>`).join('')}<th>=</th></tr></thead>
    <tbody>
      ${ourdissage.map(row => `
        <tr>
          <td class="color-label" style="white-space:nowrap;">
            ${row.hex && row.hex !== '#cccccc' ? `<span style="display:inline-block; width:14px; height:14px; background:${row.hex}; border-radius:2px; margin-right:4px; vertical-align:middle;"></span>` : ''}
            ${row.couleur || ''}
          </td>
          ${Array.from({length: cols}, (_, i) => `<td>${row.sequence?.[i] || ''}</td>`).join('')}
          <td><strong>${row.total || ''}</strong></td>
        </tr>`).join('')}
    </tbody>
  </table>`;
}

function renderLissesDetail(lisses) {
  const cadres = [8,7,6,5,4,3,2,1];
  return `<table class="lisses-table">
    <thead>
      <tr>
        <th rowspan="2">Cadres</th>
        <th colspan="3">Lisses par groupe</th>
        <th colspan="3">× nb répétitions</th>
        <th rowspan="2">+ reste hors motif</th>
        <th rowspan="2">= total lisses/cadre</th>
      </tr>
      <tr>
        <th>Motif 1</th><th>Motif 2</th><th>Motif 3</th>
        <th>Motif 1</th><th>Motif 2</th><th>Motif 3</th>
      </tr>
    </thead>
    <tbody>
      ${cadres.map(c => {
        const row = lisses[c] || {};
        return `<tr>
          <td class="cadre-label">${c}</td>
          <td>${row.lisse_m1 || ''}</td><td>${row.lisse_m2 || ''}</td><td>${row.lisse_m3 || ''}</td>
          <td>${row.rep_m1 || ''}</td><td>${row.rep_m2 || ''}</td><td>${row.rep_m3 || ''}</td>
          <td>${row.reste || ''}</td>
          <td><strong>${row.total || ''}</strong></td>
        </tr>`;
      }).join('')}
      <tr class="total-row">
        <td>Total</td>
        <td colspan="7"></td>
        <td>${lisses.total_lisses || ''} lisses</td>
      </tr>
    </tbody>
  </table>`;
}

// ─── CONVERSION TITRAGE ────────────────────────────────────
// Notation X/Y : le titrage réel = X ÷ Y
// Nm  (laine, soie)       : m/kg = Nm × 1000
// NeC (coton)             : m/kg = NeC × 1693.6
// NeL (lin, cotolin)      : m/kg = NeL × 1500
function parseTitrageVal(raw) {
  // Accepte "16/2", "16.5/2", "16" etc.
  const s = String(raw).trim();
  const slash = s.indexOf('/');
  if (slash !== -1) {
    const num = parseFloat(s.slice(0, slash));
    const den = parseFloat(s.slice(slash + 1));
    if (!isNaN(num) && !isNaN(den) && den !== 0) return num / den;
    return null;
  }
  const v = parseFloat(s);
  return isNaN(v) ? null : v;
}

function titrageToMkg(val, sys) {
  const v = parseTitrageVal(val);
  if (v === null || v <= 0) return null;
  if (sys === 'Nm')  return v * 1000;      // Nm × 1000 = m/kg
  if (sys === 'NeC') return v * 1693.6;   // NeC × 1693.6 = m/kg
  if (sys === 'NeL') return v * 1500;     // NeL × 1500 = m/kg
  return v * 1000;
}

function convertTitrage(type) {
  const valEl  = document.getElementById(`f-titrage-${type}-val`);
  const sysEl  = document.getElementById(`f-titrage-${type}-sys`);
  const hidEl  = document.getElementById(`f-titrage-${type}`);
  const dispEl = document.getElementById(`titrage-${type}-mkg`);
  if (!valEl || !sysEl || !hidEl || !dispEl) return;
  const mkg = titrageToMkg(valEl.value, sysEl.value);
  if (mkg !== null) {
    hidEl.value = mkg.toFixed(0);
    dispEl.textContent = Math.round(mkg).toLocaleString('fr-FR');
  } else {
    hidEl.value = '';
    dispEl.textContent = '—';
  }
  updateFormCalcs();
}

// Bascule entre le mode saisie Nm et le mode saisie directe m/kg
function toggleTitrageMode(type) {
  const nmZone   = document.getElementById(`titrage-${type}-nm-zone`);
  const mkgZone  = document.getElementById(`titrage-${type}-mkg-zone`);
  const btn      = document.getElementById(`btn-titrage-mode-${type}`);
  const label    = document.getElementById(`label-titrage-${type}`);
  const dispEl   = document.getElementById(`titrage-${type}-mkg`);
  const dispRow  = dispEl ? dispEl.closest('div') : null;
  if (!nmZone || !mkgZone) return;

  const isMkgMode = mkgZone.style.display !== 'none';
  if (isMkgMode) {
    // Repasser en mode Nm
    mkgZone.style.display = 'none';
    nmZone.style.display  = 'flex';
    btn.textContent = 'Saisir en m/kg';
    if (label) label.textContent = 'Titrage (Nm)';
    if (dispRow) dispRow.style.display = '';
    convertTitrage(type);
  } else {
    // Passer en mode m/kg direct
    nmZone.style.display  = 'none';
    mkgZone.style.display = 'block';
    btn.textContent = 'Saisir en Nm';
    if (label) label.textContent = 'Titrage (m/kg)';
    // Masquer la ligne "= X m/kg" redondante en mode m/kg
    if (dispRow) dispRow.style.display = 'none';
    convertTitrageFromMkg(type);
  }
}

// Saisie directe en m/kg : alimente le champ caché titrage_{type}
function convertTitrageFromMkg(type) {
  const directEl = document.getElementById(`f-titrage-${type}-mkg-direct`);
  const hidEl    = document.getElementById(`f-titrage-${type}`);
  const valEl    = document.getElementById(`f-titrage-${type}-val`);
  const sysEl    = document.getElementById(`f-titrage-${type}-sys`);
  if (!directEl || !hidEl) return;
  const mkg = parseFloat(directEl.value);
  if (!isNaN(mkg) && mkg > 0) {
    hidEl.value = mkg.toFixed(0);
    // Vider titrage_val pour signaler que la saisie est en m/kg direct
    if (valEl) valEl.value = '';
    if (sysEl) sysEl.value = 'mkg';
  } else {
    hidEl.value = '';
    if (valEl) valEl.value = '';
    if (sysEl) sysEl.value = 'mkg';
  }
  updateFormCalcs();
}

// ─── CALCULS ────────────────────────────────────────────────
function n(v) { const x = parseFloat(v); return isNaN(x) ? null : x; }

function calcLargBrut(f) {
  const ls = n(f.larg_souhaitee), pct = n(f.larg_ajout_traitement_pct);
  if (ls === null) return null;
  return ls + ls * (pct || 0) / 100;
}
function calcLargPeigne(f) {
  const lb = calcLargBrut(f), pct = n(f.larg_ajout_retrait_pct);
  if (lb === null) return null;
  return lb + lb * (pct || 0) / 100;
}
function calcLongMetier(f) {
  const ls = n(f.long_souhaitee), pct = n(f.long_ajout_traitement_pct);
  if (ls === null) return null;
  return ls + ls * (pct || 0) / 100;
}
function calcLongChaineArticle(f) {
  const lm = calcLongMetier(f), pct = n(f.long_ajout_retrait_pct);
  if (lm === null) return null;
  return lm + lm * (pct || 0) / 100;
}
function calcLongChaineNecessaireArticle(f) {
  const lca = calcLongChaineArticle(f), franges = n(f.franges) || 0;
  if (lca === null) return null;
  return lca + franges;
}
function calcLongChaineTotale(f) {
  const lcna = calcLongChaineNecessaireArticle(f), nb = n(f.nb_articles) || 1;
  if (lcna === null) return null;
  return (lcna * nb + 60) / 100;
}
function calcNbFilsChaine(f) {
  const lp = calcLargPeigne(f), d = n(f.densite_chaine);
  if (lp === null || d === null) return null;
  return lp * d;
}
function calcQteFils_m(f) {
  const nb = calcNbFilsChaine(f), l = calcLongChaineTotale(f);
  if (nb === null || l === null) return null;
  return nb * l;
}
function calcQteFils_kg(f) {
  const qm = calcQteFils_m(f), t = n(f.titrage_chaine);
  if (qm === null || t === null || t === 0) return null;
  return qm / t;
}
function calcCoutChaine(f) {
  const kg = calcQteFils_kg(f), p = n(f.prix_chaine_kg);
  if (kg === null || p === null) return null;
  return kg * p;
}
function calcNbFilsTrame(f) {
  const lca = calcLongChaineArticle(f), d = n(f.densite_trame), nb = n(f.nb_articles) || 1;
  if (lca === null || d === null) return null;
  return lca * d * nb;
}
function calcQteTrame_m(f) {
  const nb = calcNbFilsTrame(f), lp = calcLargPeigne(f);
  if (nb === null || lp === null) return null;
  return nb * lp / 100;
}
function calcQteTrame_kg(f) {
  const qm = calcQteTrame_m(f), t = n(f.titrage_trame);
  if (qm === null || t === null || t === 0) return null;
  return qm / t;
}
function calcCoutTrame(f) {
  const kg = calcQteTrame_kg(f), p = n(f.prix_trame_kg);
  if (kg === null || p === null) return null;
  return kg * p;
}

// ─── VUE FORMULAIRE ─────────────────────────────────────────
function openNewFiche() {
  App.currentFicheId = null;
  App.editMode = false;
  resetForm();
  document.getElementById('form-title').textContent = 'Nouvelle fiche';
  showView('view-form');
}

function openEditFiche(id) {
  const fiche = App.fiches.find(f => f.id === id);
  if (!fiche) return;
  App.currentFicheId = id;
  App.editMode = true;
  fillForm(fiche);
  document.getElementById('form-title').textContent = 'Modifier la fiche';
  showView('view-form');
}

function resetForm() {
  document.getElementById('fiche-form').reset();
  // Réinitialiser les tableaux dynamiques
  initOurdissageForm([]);
  initLissesForm({});
  // Réinitialiser le schéma : fermer l'éditeur et vider l'aperçu
  const editorZone  = document.getElementById('schema-editor-zone');
  const previewZone = document.getElementById('schema-preview-zone');
  const btn         = document.getElementById('btn-edit-schema');
  if (editorZone)  editorZone.style.display  = 'none';
  if (previewZone) previewZone.style.display = 'block';
  if (btn)         btn.textContent = 'Modifier le schéma';
  const schemaField = document.getElementById('schema-data');
  if (schemaField) schemaField.value = '';
  if (typeof updateSchemaPreview === 'function') updateSchemaPreview();
  updateFormCalcs();
}

function fillForm(f) {
  const form = document.getElementById('fiche-form');
  const fields = [
    'projet','source_inspiration',
    'fil_chaine','titrage_chaine_val','titrage_chaine_sys','titrage_chaine',
    'fil_trame','titrage_trame_val','titrage_trame_sys','titrage_trame',
    'armure','densite_chaine','densite_trame','peigne_dents','fils_par_dent',
    'larg_souhaitee','larg_ajout_traitement_pct','larg_ajout_retrait_pct',
    'long_souhaitee','long_ajout_traitement_pct','long_ajout_retrait_pct',
    'franges','nb_articles',
    'prix_chaine_kg','prix_trame_kg','notes'
  ];
  fields.forEach(field => {
    const el = form.querySelector(`[name="${field}"]`);
    if (el && f[field] !== undefined) el.value = f[field];
  });
  // Restaurer le mode m/kg si la valeur Nm n'est pas renseignée mais que titrage est présent
  ['chaine', 'trame'].forEach(type => {
    const valEl    = document.getElementById(`f-titrage-${type}-val`);
    const directEl = document.getElementById(`f-titrage-${type}-mkg-direct`);
    const hidEl    = document.getElementById(`f-titrage-${type}`);
    const nmZone   = document.getElementById(`titrage-${type}-nm-zone`);
    const mkgZone  = document.getElementById(`titrage-${type}-mkg-zone`);
    const btn      = document.getElementById(`btn-titrage-mode-${type}`);
    const label    = document.getElementById(`label-titrage-${type}`);
    const dispEl   = document.getElementById(`titrage-${type}-mkg`);
    const dispRow  = dispEl ? dispEl.closest('div') : null;
    // Si pas de valeur Nm mais une valeur m/kg directe sauvegardée
    const hasNm  = valEl && valEl.value && valEl.value.trim() !== '';
    const hasMkg = hidEl && hidEl.value && hidEl.value.trim() !== '';
    const savedMode = f[`titrage_${type}_mode`] || (f[`titrage_${type}_sys`] === 'mkg' ? 'mkg' : 'nm');
    const savedDirect = f[`titrage_${type}_mkg_direct`] || '';
    if ((savedMode === 'mkg' || (!hasNm && hasMkg)) && directEl) {
      // Basculer en mode m/kg
      if (nmZone)  nmZone.style.display  = 'none';
      if (mkgZone) mkgZone.style.display = 'block';
      if (btn)     btn.textContent = 'Saisir en Nm';
      if (label)   label.textContent = 'Titrage (m/kg)';
      if (dispRow) dispRow.style.display = 'none';
      directEl.value = savedDirect || (hidEl ? hidEl.value : '');
    } else {
      // Mode Nm par défaut
      if (nmZone)  nmZone.style.display  = 'flex';
      if (mkgZone) mkgZone.style.display = 'none';
      if (btn)     btn.textContent = 'Saisir en m/kg';
      if (label)   label.textContent = 'Titrage (Nm)';
      if (dispRow) dispRow.style.display = '';
      if (directEl) directEl.value = '';
    }
  });
  // Mettre à jour l'affichage m/kg après chargement
  convertTitrage('chaine');
  convertTitrage('trame');
  initOurdissageForm(f.ourdissage || []);
  initLissesForm(f.lisses || {});
  // Charger le schéma : fermer l'éditeur, afficher l'aperçu
  const editorZone2  = document.getElementById('schema-editor-zone');
  const previewZone2 = document.getElementById('schema-preview-zone');
  const btn2         = document.getElementById('btn-edit-schema');
  if (editorZone2)  editorZone2.style.display  = 'none';
  if (previewZone2) previewZone2.style.display = 'block';
  if (btn2)         btn2.textContent = 'Modifier le schéma';
  const schemaField2 = document.getElementById('schema-data');
  if (schemaField2 && f.schema_data) {
    schemaField2.value = typeof f.schema_data === 'string' ? f.schema_data : JSON.stringify(f.schema_data);
    // Pré-charger les données dans SchemaEditor pour édition ultérieure
    if (typeof SchemaEditor !== 'undefined') SchemaEditor.loadFromData(f.schema_data);
  } else if (schemaField2) {
    schemaField2.value = '';
  }
  if (typeof updateSchemaPreview === 'function') updateSchemaPreview();
  updateFormCalcs();
}

function collectFormData() {
  const form = document.getElementById('fiche-form');
  const data = {};
  const fields = [
    'projet','source_inspiration',
    'fil_chaine','titrage_chaine_val','titrage_chaine_sys','titrage_chaine',
    'fil_trame','titrage_trame_val','titrage_trame_sys','titrage_trame',
    'armure','densite_chaine','densite_trame','peigne_dents','fils_par_dent',
    'larg_souhaitee','larg_ajout_traitement_pct','larg_ajout_retrait_pct',
    'long_souhaitee','long_ajout_traitement_pct','long_ajout_retrait_pct',
    'franges','nb_articles',
    'prix_chaine_kg','prix_trame_kg','notes'
  ];
  fields.forEach(field => {
    const el = form.querySelector(`[name="${field}"]`);
    if (el) data[field] = el.value;
  });
  // Sauvegarder le mode de saisie titrage (Nm ou mkg) et la valeur m/kg directe
  ['chaine', 'trame'].forEach(type => {
    const mkgZone  = document.getElementById(`titrage-${type}-mkg-zone`);
    const directEl = document.getElementById(`f-titrage-${type}-mkg-direct`);
    const isMkg = mkgZone && mkgZone.style.display !== 'none';
    data[`titrage_${type}_mode`] = isMkg ? 'mkg' : 'nm';
    data[`titrage_${type}_mkg_direct`] = (isMkg && directEl) ? directEl.value : '';
  });
  data.ourdissage = collectOurdissageData();
  data.lisses = collectLissesData();
  // Sauvegarder le schéma interactif
  if (typeof SchemaEditor !== 'undefined') {
    SchemaEditor.saveToHiddenField();
  }
  const schemaField = document.getElementById('schema-data');
  data.schema_data = schemaField ? schemaField.value : '';
  data.schema_image = '';
  return data;
}

async function saveFiche() {
  const data = collectFormData();
  if (!data.projet) { showToast('Le nom du projet est obligatoire.', 'error'); return; }

  if (App.editMode && App.currentFicheId) {
    const idx = App.fiches.findIndex(f => f.id === App.currentFicheId);
    if (idx !== -1) {
      App.fiches[idx] = { ...App.fiches[idx], ...data, date_modification: new Date().toISOString() };
    }
  } else {
    App.fiches.push({ id: generateId(), date_creation: new Date().toISOString(), ...data });
  }

  await saveFichesToGithub();
  renderFichesList();
  showView('view-list');
}

function confirmDelete(id) {
  App.currentFicheId = id;
  const fiche = App.fiches.find(f => f.id === id);
  document.getElementById('delete-fiche-name').textContent = fiche?.projet || 'cette fiche';
  document.getElementById('modal-delete').classList.add('open');
}

async function deleteFiche() {
  App.fiches = App.fiches.filter(f => f.id !== App.currentFicheId);
  await saveFichesToGithub();
  renderFichesList();
  document.getElementById('modal-delete').classList.remove('open');
  if ($('.view.active')?.id === 'view-detail') showView('view-list');
}

// ─── TABLEAU OURDISSAGE (formulaire) ────────────────────────
let NB_OURDISSAGE_COLS = 16;

// Génère le thead du tableau d'ourdissage
function _renderOurdissageThead(cols) {
  const thead = document.getElementById('ourdissage-thead');
  if (!thead) return;
  let ths = '<th>Couleur</th>';
  for (let i = 1; i <= cols; i++) ths += `<th>${i}</th>`;
  ths += '<th>=</th><th></th>';
  thead.innerHTML = `<tr>${ths}</tr>`;
}

// Redimensionne le tableau (change le nombre de colonnes en conservant les données)
function resizeOurdissage() {
  const input = document.getElementById('ourdissage-nb-cols');
  if (!input) return;
  const newCols = Math.max(4, Math.min(48, parseInt(input.value) || 16));
  input.value = newCols;
  // Sauvegarder les données actuelles
  const current = collectOurdissageData();
  NB_OURDISSAGE_COLS = newCols;
  _renderOurdissageThead(newCols);
  initOurdissageForm(current);
}

// Synchronise le tableau d'ourdissage depuis BlocsEnlissage (chaîne uniquement).
// Utilise les couleurs par occurrence (occurrenceColors[i]).
// Groupe les fils CONSÉCUTIFS de même couleur en colonnes distinctes.
// L'ordre des colonnes est de gauche à droite (groupe 0 = colonne 0).
function syncOurdissageFromEnlissage() {
  if (!BlocsEnlissage || !BlocsEnlissage._lastSequence || !BlocsEnlissage._lastSequence.length) return;

  const fullSeq  = BlocsEnlissage._lastSequence;
  const blocMap  = {};
  BlocsEnlissage.blocs.forEach(b => { blocMap[b.name] = b; });
  const defaults = BlocsEnlissage._defaultColors;
  const occColors = BlocsEnlissage.occurrenceColors || [];

  // Étape 1 : construire la liste des fils avec leur couleur par occurrence
  // Chaque occurrence dans fullSeq a sa propre couleur (occColors[i])
  const filColors = []; // [{color, blocName}]
  fullSeq.forEach((t, i) => {
    const bloc = blocMap[t];
    if (!bloc) return;
    const bSize = bloc.size || bloc.pattern?.[0]?.length || 4;
    const color = occColors[i] || defaults[i % defaults.length];
    for (let c = 0; c < bSize; c++) {
      filColors.push({ color, blocName: t });
    }
  });

  // Étape 2 : grouper les fils CONSÉCUTIFS de même couleur
  const groups = []; // [{color, nbFils, label}]
  filColors.forEach(({ color, blocName }) => {
    const last = groups[groups.length - 1];
    if (last && last.color === color) {
      last.nbFils++;
    } else {
      groups.push({ color, nbFils: 1, label: `Bloc ${blocName}` });
    }
  });

  const nbCols = groups.length;

  // Adapter le nombre de colonnes
  if (NB_OURDISSAGE_COLS !== nbCols) {
    NB_OURDISSAGE_COLS = nbCols;
    _renderOurdissageThead(nbCols);
    const inp = document.getElementById('ourdissage-nb-cols');
    if (inp) inp.value = nbCols;
  }

  // Étape 3 : construire une ligne par couleur unique
  // sequence[colIdx] = nbFils si ce groupe appartient à cette couleur, sinon ''
  const colorMap = {}; // hex -> { couleur, hex, sequence[] }
  groups.forEach((g, gi) => {
    if (!colorMap[g.color]) {
      colorMap[g.color] = {
        couleur: g.label,
        hex: g.color,
        sequence: Array(nbCols).fill('')
      };
    }
    colorMap[g.color].sequence[gi] = g.nbFils.toString();
  });

  const newRows = Object.values(colorMap);
  initOurdissageForm(newRows);
  showToast('Tableau d\'ourdissage synchronisé.', 'info');
}

// Crée une ligne du tableau d'ourdissage
function _makeOurdissageRow(row, ri) {
  const couleur = row.couleur || '';
  const hex     = row.hex     || '#cccccc';
  const seq     = row.sequence || [];
  // Calcul auto du total : somme des valeurs numériques de la séquence
  const autoTotal = seq.reduce((s, v) => s + (parseFloat(v) || 0), 0);
  const total = row.total !== undefined && row.total !== '' ? row.total : (autoTotal > 0 ? autoTotal : '');
  return `<tr>
    <td style="white-space:nowrap; display:flex; align-items:center; gap:4px; border:none; padding:2px 4px;">
      <input type="color" value="${hex}" style="width:26px; height:26px; padding:0; border:none; cursor:pointer; flex-shrink:0;" title="Couleur">
      <input type="text" value="${couleur}" placeholder="Couleur ${ri+1}" style="width:80px;">
    </td>
    ${Array.from({length: NB_OURDISSAGE_COLS}, (_, ci) =>
      `<td><input type="text" value="${seq[ci] || ''}" style="width:28px;" oninput="_updateOurdissageTotal(this)"></td>`
    ).join('')}
    <td><input type="number" value="${total}" style="width:50px; font-weight:600;" placeholder="=" readonly title="Total calculé automatiquement"></td>
    <td style="border:none; padding:2px;"><button type="button" onclick="_removeOurdissageRow(this)" style="background:none; border:none; color:#c0392b; cursor:pointer; font-size:1rem; line-height:1;" title="Supprimer cette ligne">×</button></td>
  </tr>`;
}

// Met à jour le total de la ligne quand une cellule change
function _updateOurdissageTotal(inputEl) {
  const tr = inputEl.closest('tr');
  if (!tr) return;
  const seqInputs = Array.from(tr.querySelectorAll('td:not(:first-child):not(:last-child):not(:nth-last-child(2)) input'));
  const sum = seqInputs.reduce((s, el) => s + (parseFloat(el.value) || 0), 0);
  const totalInput = tr.querySelector('td:nth-last-child(2) input');
  if (totalInput) totalInput.value = sum > 0 ? sum : '';
}

// Supprime une ligne du tableau d'ourdissage
function _removeOurdissageRow(btn) {
  const tr = btn.closest('tr');
  if (tr) tr.remove();
}

// Ajoute une ligne vide au tableau d'ourdissage
function addOurdissageRow() {
  const tbody = document.getElementById('ourdissage-tbody');
  if (!tbody) return;
  const ri = tbody.rows.length;
  const div = document.createElement('tbody');
  div.innerHTML = _makeOurdissageRow({ couleur: '', hex: '#cccccc', sequence: [], total: '' }, ri);
  tbody.appendChild(div.firstElementChild);
}

function initOurdissageForm(data) {
  const tbody = document.getElementById('ourdissage-tbody');
  const defaultRows = [
    { couleur: 'Couleur 1', hex: '#cccccc', sequence: [], total: '' },
    { couleur: 'Couleur 2', hex: '#cccccc', sequence: [], total: '' },
    { couleur: 'Couleur 3', hex: '#cccccc', sequence: [], total: '' },
  ];
  const rows = data.length > 0 ? data : defaultRows;
  // Adapter NB_OURDISSAGE_COLS au nombre de colonnes sauvegardées
  if (data.length > 0) {
    const maxSeq = Math.max(...data.map(r => (r.sequence || []).length), NB_OURDISSAGE_COLS);
    if (maxSeq !== NB_OURDISSAGE_COLS) {
      NB_OURDISSAGE_COLS = maxSeq;
      const input = document.getElementById('ourdissage-nb-cols');
      if (input) input.value = maxSeq;
    }
  }
  _renderOurdissageThead(NB_OURDISSAGE_COLS);
  tbody.innerHTML = rows.map((row, ri) => _makeOurdissageRow(row, ri)).join('');
}

function collectOurdissageData() {
  const rows = $$('#ourdissage-tbody tr');
  return rows.map(tr => {
    const allInputs = $$('input', tr);
    // allInputs[0] = color picker (type=color), allInputs[1] = nom couleur,
    // allInputs[2..17] = séquence, allInputs[18] = total
    const hex      = allInputs[0] ? allInputs[0].value : '#cccccc';
    const couleur  = allInputs[1] ? allInputs[1].value : '';
    const sequence = Array.from({length: NB_OURDISSAGE_COLS}, (_, i) => allInputs[i + 2] ? allInputs[i + 2].value : '');
    const total    = allInputs[NB_OURDISSAGE_COLS + 2] ? allInputs[NB_OURDISSAGE_COLS + 2].value : '';
    return { hex, couleur, sequence, total };
  }).filter(r => r.couleur || r.sequence.some(v => v) || r.total);
}

// ─── TABLEAU LISSES (formulaire) ────────────────────────────
function initLissesForm(data) {
  const tbody = document.getElementById('lisses-tbody');
  const cadres = [8,7,6,5,4,3,2,1];
  tbody.innerHTML = cadres.map(c => {
    const row = data[c] || {};
    return `<tr data-cadre="${c}">
      <td class="cadre-label">${c}</td>
      <td><input type="number" name="lisse_m1" value="${row.lisse_m1||''}" style="width:45px"></td>
      <td><input type="number" name="lisse_m2" value="${row.lisse_m2||''}" style="width:45px"></td>
      <td><input type="number" name="lisse_m3" value="${row.lisse_m3||''}" style="width:45px"></td>
      <td><input type="number" name="rep_m1" value="${row.rep_m1||''}" style="width:45px"></td>
      <td><input type="number" name="rep_m2" value="${row.rep_m2||''}" style="width:45px"></td>
      <td><input type="number" name="rep_m3" value="${row.rep_m3||''}" style="width:45px"></td>
      <td><input type="number" name="reste" value="${row.reste||''}" style="width:45px"></td>
      <td><input type="number" name="total" value="${row.total||''}" style="width:55px"></td>
    </tr>`;
  }).join('');
  const totalRow = data.total_lisses || '';
  document.getElementById('lisses-total').value = totalRow;
}

function collectLissesData() {
  const cadres = [8,7,6,5,4,3,2,1];
  const result = {};
  cadres.forEach(c => {
    const tr = $(`#lisses-tbody tr[data-cadre="${c}"]`);
    if (!tr) return;
    result[c] = {
      lisse_m1: $('[name="lisse_m1"]', tr).value,
      lisse_m2: $('[name="lisse_m2"]', tr).value,
      lisse_m3: $('[name="lisse_m3"]', tr).value,
      rep_m1: $('[name="rep_m1"]', tr).value,
      rep_m2: $('[name="rep_m2"]', tr).value,
      rep_m3: $('[name="rep_m3"]', tr).value,
      reste: $('[name="reste"]', tr).value,
      total: $('[name="total"]', tr).value
    };
  });
  result.total_lisses = document.getElementById('lisses-total').value;
  return result;
}

// ─── CALCULS EN TEMPS RÉEL (formulaire) ─────────────────────
function updateFormCalcs() {
  const form = document.getElementById('fiche-form');
  const g = name => { const el = form.querySelector(`[name="${name}"]`); return el ? el.value : ''; };
  const fTemp = {};
  ['larg_souhaitee','larg_ajout_traitement_pct','larg_ajout_retrait_pct',
   'long_souhaitee','long_ajout_traitement_pct','long_ajout_retrait_pct',
   'franges','nb_articles','densite_chaine','densite_trame',
   'titrage_chaine','titrage_trame','prix_chaine_kg','prix_trame_kg'].forEach(k => fTemp[k] = g(k));

  const set = (id, val, unit = '') => {
    const el = document.getElementById(id);
    if (el) el.textContent = val !== null ? `${parseFloat(val).toFixed(val < 1 ? 3 : 1)} ${unit}` : '—';
  };

  const lb = calcLargBrut(fTemp);
  const lp = calcLargPeigne(fTemp);
  const lm = calcLongMetier(fTemp);
  const lca = calcLongChaineArticle(fTemp);
  const lcna = calcLongChaineNecessaireArticle(fTemp);
  const lct = calcLongChaineTotale(fTemp);
  const nfc = calcNbFilsChaine(fTemp);
  const qfm = calcQteFils_m(fTemp);
  const qfkg = calcQteFils_kg(fTemp);
  const cc = calcCoutChaine(fTemp);
  const nft = calcNbFilsTrame(fTemp);
  const qtm = calcQteTrame_m(fTemp);
  const qtkg = calcQteTrame_kg(fTemp);
  const ct = calcCoutTrame(fTemp);

  set('calc-larg-brut', lb, 'cm');
  set('calc-larg-peigne', lp, 'cm');
  set('calc-long-metier', lm, 'cm');
  set('calc-long-chaine-article', lca, 'cm');
  set('calc-long-chaine-necessaire-article', lcna, 'cm');
  set('calc-long-chaine-totale', lct, 'm');
  set('calc-nb-fils-chaine', nfc !== null ? Math.round(nfc) : null, 'fils');
  set('calc-qte-fils-m', qfm, 'm');
  set('calc-qte-fils-kg', qfkg, 'kg');
  set('calc-cout-chaine', cc, '€');
  set('calc-nb-fils-trame', nft !== null ? Math.round(nft) : null, 'duites');
  set('calc-qte-trame-m', qtm, 'm');
  set('calc-qte-trame-kg', qtkg, 'kg');
  set('calc-cout-trame', ct, '€');
}

// ─── UPLOAD SCHÉMA ──────────────────────────────────────────
function handleSchemaUpload(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const b64 = e.target.result;
    document.getElementById('schema-b64').value = b64;
    document.getElementById('schema-preview').innerHTML = `<img src="${b64}" alt="Schéma">`;
  };
  reader.readAsDataURL(file);
}

// ─── MODAL CONFIG GITHUB ────────────────────────────────────
function openConfigModal() {
  document.getElementById('input-gh-token').value = App.github.token;
  document.getElementById('input-gh-owner').value = App.github.owner;
  document.getElementById('input-gh-repo').value = App.github.repo;
  document.getElementById('input-gh-branch').value = App.github.branch || 'main';
  document.getElementById('modal-config').classList.add('open');
}

function saveConfig() {
  App.github.token = document.getElementById('input-gh-token').value.trim();
  App.github.owner = document.getElementById('input-gh-owner').value.trim();
  App.github.repo = document.getElementById('input-gh-repo').value.trim();
  App.github.branch = document.getElementById('input-gh-branch').value.trim() || 'main';
  saveGithubConfig();
  updateConfigStatus();
  document.getElementById('modal-config').classList.remove('open');
  loadFichesFromGithub().then(() => renderFichesList());
  if (typeof FilsLib !== 'undefined') {
    FilsLib.load().then(() => { refreshFilsSelects(); renderFilsView(); });
  }
}

// ─── CONVERTISSEUR TITRAGE (NeC/NeL → Nm) ──────────────────────────────────
let _convTarget = null;

function openConvertisseur(target) {
  _convTarget = target;
  document.getElementById('conv-val').value = '';
  document.getElementById('conv-sys').value = 'NeC';
  document.getElementById('conv-result').innerHTML = '<span style="color:var(--color-text-muted);">Entrez un titrage ci-dessus…</span>';
  document.getElementById('conv-use-chaine').style.display = target === 'chaine' ? 'inline-flex' : 'none';
  document.getElementById('conv-use-trame').style.display  = target === 'trame'  ? 'inline-flex' : 'none';
  document.getElementById('modal-convertisseur').classList.add('open');
  setTimeout(() => document.getElementById('conv-val').focus(), 100);
}

function closeConvertisseur() {
  document.getElementById('modal-convertisseur').classList.remove('open');
  _convTarget = null;
}

function calcConvertisseur() {
  const raw = document.getElementById('conv-val').value.trim();
  const sys = document.getElementById('conv-sys').value;
  const v   = parseTitrageVal(raw);
  const resEl = document.getElementById('conv-result');

  if (v === null || v <= 0) {
    resEl.innerHTML = '<span style="color:var(--color-text-muted);">Entrez un titrage ci-dessus…</span>';
    document.getElementById('conv-use-chaine').style.display = 'none';
    document.getElementById('conv-use-trame').style.display  = 'none';
    return;
  }

  const facteur = sys === 'NeC' ? 1.6936 : 1.5;
  const nm = v * facteur;
  const label = sys === 'NeC' ? 'NeC (coton)' : 'NeL (lin/cotolin)';

  resEl.innerHTML = `
    <div style="margin-bottom:0.3rem; color:var(--color-text-muted); font-size:0.8rem;">${raw} ${label}</div>
    <div style="font-size:1.05rem;"><strong>${nm.toFixed(2)} Nm</strong></div>
    <div style="font-size:0.75rem; color:var(--color-text-muted); margin-top:0.2rem;">soit ${Math.round(nm * 1000).toLocaleString('fr-FR')} m/kg</div>
  `;

  document.getElementById('conv-use-chaine').style.display = _convTarget === 'chaine' ? 'inline-flex' : 'none';
  document.getElementById('conv-use-trame').style.display  = _convTarget === 'trame'  ? 'inline-flex' : 'none';
}

function useConvertisseur(target) {
  const raw = document.getElementById('conv-val').value.trim();
  const sys = document.getElementById('conv-sys').value;
  const v   = parseTitrageVal(raw);
  if (v === null || v <= 0) return;
  const facteur = sys === 'NeC' ? 1.6936 : 1.5;
  const nm = v * facteur;
  const nmStr = Number.isInteger(nm) ? String(nm) : nm.toFixed(2);
  const valEl = document.getElementById(`f-titrage-${target}-val`);
  if (valEl) {
    valEl.value = nmStr;
    convertTitrage(target);
  }
  closeConvertisseur();
  showToast(`Titrage ${nmStr} Nm appliqué au fil de ${target === 'chaine' ? 'chaîne' : 'trame'}`, 'success');
}

// ─── INITIALISATION ─────────────────────────────────────────
async function init() {
  loadGithubConfig();
  updateConfigStatus();
  await loadFichesFromGithub();
  renderFichesList();
  // Charger la bibliothèque de fils
  if (typeof FilsLib !== 'undefined') {
    await FilsLib.load();
    refreshFilsSelects();
  }

  // Écouteurs navigation
  $$('nav a[data-view]').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      const view = a.dataset.view;
      if (view === 'view-form') { openNewFiche(); return; }
      showView(view);
      if (view === 'view-list') renderFichesList();
      if (view === 'view-fils') renderFilsView();
    });
  });

  // Recherche
  document.getElementById('search-input').addEventListener('input', e => {
    renderFichesList(e.target.value);
  });

  // Calculs temps réel
  document.getElementById('fiche-form').addEventListener('input', updateFormCalcs);

  // Fermeture modals
  $$('.modal-overlay').forEach(m => {
    m.addEventListener('click', e => {
      if (e.target === m) m.classList.remove('open');
    });
  });

  showView('view-list');
}

document.addEventListener('DOMContentLoaded', init);
