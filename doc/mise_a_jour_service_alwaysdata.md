# Déploiement automatique Flask sur AlwaysData avec GitHub Actions

Ce guide résume la configuration du workflow GitHub Actions pour déployer automatiquement une application Flask sur AlwaysData, avec reload automatique et keepalive pour éviter la suppression du compte.

---

## 1. Pré-requis AlwaysData

### a. Clés SSH
1. Sur ton serveur AlwaysData, génère une clé SSH si ce n’est pas déjà fait :  
   ssh-keygen -t ed25519 -C "github@actions"
2. Ne mets pas de mot de passe pour la clé.
3. Récupère la clé privée (~/.ssh/id_ed25519) et la clé publique (~/.ssh/id_ed25519.pub).

### b. Ajouter la clé publique dans AlwaysData
- Crée ou édite le fichier ~/.ssh/authorized_keys :
  mkdir -p ~/.ssh
  touch ~/.ssh/authorized_keys
  chmod 600 ~/.ssh/authorized_keys
- Ajoute la clé publique générée dans ce fichier.

### c. Paramètres AlwaysData
- AD_USER : ton identifiant AlwaysData (ex. inventory-service)
- AD_HOST : le host SSH de ton site (ex. ssh-inventory-service.alwaysdata.net)
- AD_SERVICE_ID : ID du service Python, si nécessaire (pour adtools service restart)

### d. Paramètres avancés du service Python (AlwaysData)
Dans la configuration du site AlwaysData, section "Paramètres supplémentaires uWSGI" :

- touch-reload = /home/inventory-service/inventory_service/backend/passenger_wsgi.py  
  *Permet de forcer le reload du service Flask quand ce fichier change.*

- py-autoreload = 1  
  *Recharge automatiquement l’application quand le code Python est modifié.*

- reload-on-rss = 256  
  *Limite mémoire pour redémarrage automatique en cas de fuite mémoire.*

> Avec ces paramètres, chaque modification du fichier passenger_wsgi.py provoque le rechargement du service Flask, sans avoir besoin de commandes supplémentaires.

---

## 2. Secrets GitHub

Dans le dépôt GitHub, ajoute les secrets suivants :

- AD_SSH_KEY : la clé privée SSH générée (id_ed25519)
- AD_USER : ton identifiant AlwaysData
- AD_HOST : le host SSH AlwaysData

**Important** : ces secrets sont nécessaires pour que GitHub Actions puisse se connecter au serveur.

---

## 3. Workflow de déploiement

Fichier .github/workflows/deploy_flask_alwaysdata.yml :

- Nom du workflow : Deploy Flask app to AlwaysData

- Déclencheurs :
  - push sur la branche 0.0.12 pour un déploiement automatique
  - workflow_dispatch pour un déploiement manuel avec choix de la branche

- Jobs :
  - Setup SSH : configuration de la clé et du host SSH
  - Test SSH connection : vérification de la connexion SSH
  - Determine branch to deploy : sélection de la branche à déployer
  - Update code on AlwaysData : mise à jour du code et reload du service avec touch passenger_wsgi.py
  - Install Python dependencies : installation des dépendances Python

---

Ce résumé permet de configurer facilement ton environnement de déploiement et de keepalive sur AlwaysData, en s’assurant que le service Flask se recharge automatiquement.
