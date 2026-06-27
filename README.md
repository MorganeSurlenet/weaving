# Fiches Techniques de Tissage

Application web statique pour créer, consulter et modifier des fiches techniques de tissage selon le modèle de Betty Briand (*L'Art du Tissage*). Hébergeable gratuitement sur **GitHub Pages**, avec les données stockées directement dans le dépôt via l'API GitHub.

---

## Fonctionnalités

- **Création et modification** de fiches techniques complètes
- **Calculs automatiques** en temps réel : largeur/longueur de chaîne, quantités en mètres et kilos, coûts
- **Tableau d'ourdissage** des fils de chaîne (couleurs et séquences)
- **Tableau de comptage de lisses** (8 cadres, 3 motifs)
- **Upload de schéma** (photo ou scan de votre schéma d'enlaçage/attachage/pédalage)
- **Recherche** par projet, armure ou fil
- **Impression** de chaque fiche
- **Synchronisation GitHub** : vos fiches sont sauvegardées dans `data/fiches.json`

---

## Déploiement sur GitHub Pages (étape par étape)

### Étape 1 — Créer le dépôt GitHub

1. Connectez-vous sur [github.com](https://github.com)
2. Cliquez sur **New repository**
3. Nommez-le par exemple `fiches-tissage`
4. Choisissez **Public** (requis pour GitHub Pages gratuit)
5. Cochez **Add a README file**
6. Cliquez **Create repository**

### Étape 2 — Uploader les fichiers

Uploadez tous les fichiers du projet dans votre dépôt :

```
index.html
css/
  style.css
js/
  app.js
data/
  fiches.json
README.md
```

Vous pouvez le faire via l'interface web GitHub (glisser-déposer) ou via Git en ligne de commande :

```bash
git clone https://github.com/VOTRE-PSEUDO/fiches-tissage.git
# Copiez les fichiers dans le dossier cloné
git add .
git commit -m "Premier déploiement"
git push
```

### Étape 3 — Activer GitHub Pages

1. Dans votre dépôt, allez dans **Settings** → **Pages**
2. Sous *Source*, choisissez **Deploy from a branch**
3. Sélectionnez la branche **main** et le dossier **/ (root)**
4. Cliquez **Save**

Votre application sera accessible à l'adresse :
`https://VOTRE-PSEUDO.github.io/fiches-tissage/`

---

## Connexion GitHub dans l'application

Pour que l'application puisse lire et écrire vos fiches, vous devez lui fournir un **Personal Access Token** GitHub.

### Créer un token

1. Allez sur [github.com/settings/tokens](https://github.com/settings/tokens)
2. Cliquez **Generate new token (classic)**
3. Donnez-lui un nom (ex : `fiches-tissage`)
4. Cochez la permission **repo** (accès complet aux dépôts)
5. Cliquez **Generate token** et copiez-le (il ne s'affiche qu'une fois)

### Configurer l'application

1. Ouvrez votre application sur GitHub Pages
2. Cliquez sur le bouton **Configurer GitHub** en haut à droite
3. Renseignez :
   - **Token** : votre Personal Access Token
   - **Nom d'utilisateur** : votre pseudo GitHub
   - **Nom du dépôt** : `fiches-tissage` (ou le nom que vous avez choisi)
   - **Branche** : `main`
4. Cliquez **Connecter**

> Le token est stocké uniquement dans le `localStorage` de votre navigateur, il ne transite pas par un serveur tiers.

---

## Structure des données

Chaque fiche est un objet JSON dans `data/fiches.json` :

```json
{
  "id": "abc123",
  "date_creation": "2024-01-15T10:30:00.000Z",
  "projet": "Écharpe en lin naturel",
  "source_inspiration": "L'Art du Tissage p.42",
  "armure": "Toile",
  "fil_chaine": "Lin 16/2",
  "titrage_chaine": 3200,
  "fil_trame": "Coton 8/2",
  "titrage_trame": 1600,
  "densite_chaine": 12,
  "densite_trame": 10,
  "larg_souhaitee": 30,
  "long_souhaitee": 180,
  "ourdissage": [...],
  "lisses": {...},
  "schema_image": "data:image/jpeg;base64,..."
}
```

---

## Structure du projet

```
fiches-tissage/
├── index.html          Application principale (page unique)
├── css/
│   └── style.css       Styles (palette sobre, tons lin et terre)
├── js/
│   └── app.js          Logique, calculs, API GitHub
├── data/
│   └── fiches.json     Base de données des fiches
└── README.md           Ce fichier
```

---

## Référence

Modèle de fiche issu de **Betty Briand**, *L'Art du Tissage*, Éditions de Saxe.
