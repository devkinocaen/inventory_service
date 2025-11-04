/html5
│
├── styles/                ← Répertoire des fichiers CSS organisés
│   ├── variables.css      ← Variables globales (couleurs, tailles, polices…)
│   ├── base.css           ← Reset / styles de base HTML (body, h1, p…)
│   ├── layout.css         ← Grilles, flex, bandeaux, containers
│   ├── components.css     ← Onglets, boutons, formulaires, modals…
│   ├── tables.css         ← Styles pour tableaux et colonnes
│   ├── pages.css          ← Styles spécifiques à certaines pages
│   ├── utilities.css      ← Classes rapides (.mt-1, .text-center…)
│   └── main.css           ← Importe TOUTES les feuilles ci-dessus
│
└── pages/
    ├── styles.css         ← Importe ../styles/main.css
    └── page1.html
    └── page2.html
       ...



1️⃣ _components.css

But : styles réutilisables dans plusieurs pages, indépendants du contenu spécifique.
Exemples :

Boutons génériques (button, .add-button, .remove-button, .record-button)

Formulaires et inputs (.form-grid, .form-section, input, select, textarea)

Onglets (.tabs, .tab, .content)

Checkbox, inline selects (.checkbox-group, .inline-selects)

Grid et flex utilitaires (.flex-row, .flex-item, .half-width)

Ne contient pas : modals spécifiques à un projet ou pages particulières, tables de page spécifique, messages inline.

2️⃣ _pages.css

But : styles spécifiques à certaines pages.
Exemples :

.import-page

.compact-row

.progress-bar-container, .progress-bar

.edit-modal (modal spécifique à cette page, si pas global)

.session-bloc-centered

Ne contient pas : styles réutilisables globaux (.form-section, .add-button, .tabs, etc.)

3️⃣ _modal.css (nouveau fichier à créer)

But : styles spécifiques aux modals, réutilisables sur toutes les pages.
