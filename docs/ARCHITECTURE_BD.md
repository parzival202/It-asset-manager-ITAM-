# Architecture Base de Données (BD) Indépendante

## Vue d'ensemble

La base de données est maintenant **indépendante** de l'application. Cela signifie :
- ✅ Les tables se créent automatiquement au démarrage
- ❌ Le seed n'est **pas** appelé automatiquement
- ✅ Vous pouvez développer sans réinitialiser la BD
- ✅ Ajouter des données via API sans redémarrer

## Structure

```
lib/db.js              ← Gestion BD (initDb, seedDb, getDb)
pages/api/meta.js      ← Endpoint lecture seule (tables seulement)
pages/api/admin/       ← Endpoints d'administration
  └─ departments.js    ← Ajouter/lister les départements
scripts/
  └─ seed-db.js        ← Script indépendant pour initialiser
```

## Utilisation

### 1️⃣ Première fois (initialisation)

```bash
# Créer les tables + peupler données initiales
node scripts/seed-db.js
```

Ce script :
- Crée les tables si absent
- Ajoute 3 sites, 43 départements, 2 users, 3 équipements
- S'arrête si la base est déjà peuplée (sécurité)

### 2️⃣ Pendant le développement

**L'app n'appelle plus `seedDb()`**, donc vous pouvez :
- Redémarrer le serveur autant que vous voulez
- Vos données restent intactes
- Modifier le code sans toucher à la BD

### 3️⃣ Ajouter des données après

Utiliser l'**API d'administration** :

```bash
# Ajouter un département
curl -X POST http://localhost:3000/api/admin/departments \
  -H "Content-Type: application/json" \
  -d '{ "site_id": 1, "name": "Nouveau Service" }'
```

Ou via le UI futur (formulaire admin).

## Endpoints Admin

### GET `/api/admin/departments`
Liste tous les départements avec leurs sites.

**Réponse:**
```json
{
  "departments": [
    { "id": 1, "site_id": 1, "name": "Informatique", "site_name": "Cosmétique" },
    ...
  ]
}
```

### POST `/api/admin/departments`
Ajouter un nouveau département.

**Payload:**
```json
{
  "site_id": 1,
  "name": "GMS"
}
```

**Sécurité:** Admin seulement

## Points clés

| Avant | Après |
|--------|-------|
| `seedDb()` appelé à chaque requête `/meta` | Appelé manuellement une seule fois |
| Réinitialiser BD = perdre données | BD indépendante = données persistantes |
| Pas d'endpoint pour ajouter departments | API `/api/admin/departments` disponible |
| Logique mélangée app + BD | Logique séparée & testable |

## Prochaines étapes (optionnel)

- [ ] Créer UI admin pour gérer departments
- [ ] Système de migrations avec numérotation (001, 002...)
- [ ] Endpoint CRUD complet (PUT, DELETE departments)
- [ ] Export/Import données
