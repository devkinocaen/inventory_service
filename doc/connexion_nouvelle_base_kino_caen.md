# Connexion d’une nouvelle base PostgreSQL à l’application Kino Caen

Ce guide décrit les étapes nécessaires pour **créer, initialiser et connecter une nouvelle base PostgreSQL** à l’infrastructure de l'application de gestion de production de **Kino Caen**.

---

## Étape 1 — Créer la base PostgreSQL sur Neon

1. **Créer un compte Neon**  
   - Allez sur [https://neon.tech](https://neon.tech) et connectez-vous (de préférence avec le même compte Google que celui du Drive).  
   - Cliquez sur **“New Project”**, nommez-le (par ex. `KINONEW`), et choisissez la région **`eu-central-1 (Frankfurt)`**.

2. **Récupérer les informations de connexion**  
   - Une fois la base créée, ouvrez l’onglet **“Connection Details”**.  
   - Copiez les paramètres suivants :
     - **Host (pooler)** : `xxxxx-pooler.c-2.eu-central-1.aws.neon.tech`  
     - **Direct host** : `xxxxx.c-2.eu-central-1.aws.neon.tech`  
     - **Password** : affiché une seule fois à la création  

3. **Exporter les variables d’environnement**  
   Définissez ces variables dans votre terminal (elles seront reprises à l’étape 4) :
   - `KINONEW_DBHOST='xxxxx-pooler.c-2.eu-central-1.aws.neon.tech'`  
   - `KINONEW_DBHOST_DIRECT='xxxxx.c-2.eu-central-1.aws.neon.tech'`  
   - `KINONEW_DBPASSWORD='xxxxxx'`

> 💡 Vous pouvez retrouver ces valeurs à tout moment depuis l’interface Neon, dans **Project → Connection details**.  

---

## Étape 2 — Créer les dossiers de sauvegarde sur le Drive de la base

- De préférence avec le même **compte Google** que celui avec lequel vous avez créé votre compte **Neon**, allez sur le Google Drive et créez les dossiers suivants:

1. **Backup des bases PostgreSQL**  
   - Sur le Google Drive de ce compte, créez un dossier pour les points de restauration de la base, par exemple `backups-db/`
   - Notez l’ID du dossier depuis l’URL (copiez-le par exemple depuis la barre d'adresse du navigateur).  
     ```
     https://drive.google.com/drive/folders/<ID_BACKUP>
     ```

2. **Photos des objets de l'inventaire**  
   - Créez un dossier `images/` et configurez-le en **partage public** en mode lecture pour que les utilisateurs puissent y accéder.  
   - Notez l’ID du dossier.


> ⚠️ Par souci de simplicité il est recommandé de créer un compte neon avec le même compte Google que ce Google Drive même si ce n'est pas requis. 


## Étape 3 — Générer le token OAuth pour Google Drive

1. **Ajouter le compte utilisateur aux testeurs**  
   - Connectez-vous à la [console Google Cloud](https://console.cloud.google.com/) sur le projet `gcloudstorage-473814` (hébergé sur le compte `devkinocaen@gmail.com`).  
   - Allez dans **API et services → Écran de consentement OAuth → Audience**.  
   - Dans la section **Utilisateurs de test**, ajoutez le compte Google qui posséde les dossiers images et backup.  

2.** Générer le token OAuth**

- Le script Python `connexion/gcloud/oauth_setup.py` sert à **générer le token OAuth (`token.json`)** pour que l’application Flask puisse accéder à Google Drive.  
- Il utilise le fichier `connexion/gcloud/client_secret_oauth.json` fourni par le projet GCloud **GCloudStorage**.
- Pour générer le token, exécutez la commande depuis la racine du projet **avec une fenêtre Chrome active du compte Google où vous avez votre Drive**:

    ```bash
    python3 connexion/gcloud/oauth_setup.py \
      --credentials connexion/gcloud/client_secret_oauth.json \
      --token connexion/gcloud/secrets/mon_token.json
    ```
    Lors de l’exécution, une fenêtre de consentement Google s’ouvre pour le compte que vous avez ajouté comme utilisateur de test. Acceptez les autorisations.
    Stockez ce token OAuth dans le dossier `connexion/gcloud/secrets`. Par exemple `mon_token.json`.

3. **Stocker le token**  
   - Le token OAuth généré (`token.json`) doit être placé dans :  
     ```
     connexion/gcloud/secrets/mon_token.json
     ```  
   Versionnez-le sous git afin que le serveur flask y ait accès (ou alors enregistrez-le dans les secrets si vous hébergez le service sous render).
     

> Ce token permettra à l’application Flask d’accéder au dossier Google Drive de la base pour y écrire les backups PostgreSQL et les images uploadées.


---

## Étape 4 — Configurer les variables d’accès
- Dans l’interface Neon, récupérer les informations de connexion (host, password, etc.).  
- Dans les sources Github, créer un dossier KINONEW et un fichier :  
  ```
  databases/neon/KINONEW/env.sh
  ```
  Ajoutez-y les identifiants de connexion à la base, comme indiqué ci-dessous:
  
  Exemple :
  ```bash
  export KINONEW_DBHOST='xxxxx-pooler.c-2.eu-central-1.aws.neon.tech'
  export KINONEW_DBHOST_DIRECT='xxxxx.c-2.eu-central-1.aws.neon.tech'
  export KINONEW_DBPASSWORD="xxxxxx"
  ```

Ce fichier servira aux scripts d'initailisation de la base.

Pour que l’application Flask puisse reconnaître et connecter cette nouvelle base, il faut également remplir le fichier `backend/databases.json.`
Chaque base y est définie par un objet avec les informations de connexion, les identifiants des dossiers Google Drive de stockage des backups et images et le token Google Drive à utiliser.

Exemple avec les bases existantes et la nouvelle KINONEW :
```
[
{...},
{
    "baseid": "KINONEW",
    "dbname": "neondb",
    "basename": "Nouvelle base Kino Caen",
    "issuer": "https://neon.com",
    "host": "xxxxx-pooler.c-2.eu-central-1.aws.neon.tech",
    "port": 5432,
    "user": "neondb_owner",
    "password": "xxxxxx",
    "auth_role": "authenticated",
    "anon_role": "anon",
    "gdrive_backup_id": "<ID_BACKUP>",
    "gdrive_inventory_id": "<ID_IMAGES>",
    "gdrive_token": "mon_token.json"
}
]
````
---


## Étape 5 — Créer les utilisateurs et leurs rôles
Dans le dossier `databases/neon/KINONEW`, ajouter les utilisateurs autorisés à se connecter à la base avec leurs rôles respectifs., sous la forme d'un petit fichier `users.csv`:
```
monemail1@monsite.com,montmotdepasse1,monrole1
monemail2@monsite.com,montmotdepasse2,monrole2
monemail3@monsite.com,montmotdepasse3,monrole3
etc...
```

Les derniers champs `monroleX` doivent être pris parmi les valeurs suivantes: `admin, dev, viewer`
Ces rôles permettent de gérer les accès RLS et les environnements applicatifs.

**Attention aux espaces! Utilisez seulement la virgule en séparateur de champs.**


## Étape 6 — Initialiser la base

- Lancer le script d’initialisation :
  ```bash
  bash scripts/reset_db.sh neon/KINONEW
  ```
  Ce script crée la structure (tables, fonctions, RLS, rôles, séquences, etc.) et la remplit avec les données constantes (compétences, nature des équipements, nom des rôles de participants etc...) dans la base postgresql hebergée par neon.

---

## Étape 7 — Connecter Flask à la nouvelle base
- Mettre à jour le service flask avec une version à jour de databases.json
- Vérifier que le site web est bien référencé dans les variables CORS, dans la variable `ALLOWED_ORIGINS`de `backend/flasklib/config/py`

---

## Étape 8 — Activer les sauvegardes automatiques
- Modifier le **workflow GitHub Actions** (`.github/workflows/backup.yml`)  et ajouter votre base à la matrix pour inclure `KINONEW` dans la liste des bases sauvegardées automatiquement vers GDrive:
```
    database: [kinocaen, kinodelta, kinonew]
```

> Le compte GitHub des sources est lié au compte devkinocaen@gmail.com.

---

