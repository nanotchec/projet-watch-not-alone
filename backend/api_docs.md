# Spécification API Backend (VIT-1)

Ce document sert de référence pour l'intégration Frontend. Il décrit les contrats d'interface (entrées/sorties) sans imposer d'implémentation spécifique.

## Informations Globales
-   **Base URL** : `http://localhost:3000/salon`
-   **Format d'échange** : JSON (`Content-Type: application/json`)

---

## 1. Création de Salon

Initialise un nouveau salon et inscrit l'utilisateur créateur comme "Hôte" (HOST).

### Requête
-   **Méthode** : `POST`
-   **Chemin** : `/`

#### Corps (Body)
| Champ | Type | Requis | Description |

| `nom` | `string` | Oui | Le nom affiché du salon. |
| `pseudo` | `string` | Oui | Le pseudo de l'utilisateur créateur. |

### Réponses

#### Succès : 201 Created
Retourne l'objet salon complet, l'utilisateur créé et sa participation.

```json
{
  "salon": {
    "id_salon": "number",
    "nom": "string",
    "code_partage": "string (6 caractères, ex: 'X7Y2Z9')",
    "etat_lecture": "string ('PAUSE' | 'PLAY')",
    "fournisseur": "string ('YOUTUBE')",
    "video_id": "string (vide au départ)",
    "horodatage_sec": "number (0)"
  },
  "user": {
    "id_utilisateur": "number",
    "pseudo": "string",
    "email": "string (généré)",
    "cree_le": "string (ISO Date)"
  },
  "participation": {
    "id_participation": "number",
    "role": "string ('HOST')",
    "id_salonID": "number",
    "id_utilisateurID": "number"
  }
}
```

#### Erreurs
| Code | Description | Corps de la réponse |

| **400** | Données manquantes | `{ "error": "Nom du salon et pseudo requis" }` |
| **500** | Erreur serveur | `{ "error": "Erreur lors de la création du salon" }` |

---

## 2. Rejoindre un Salon

Permet à un utilisateur de rejoindre un salon existant via son code.

### Requête
-   **Méthode** : `POST`
-   **Chemin** : `/join`

#### Corps (Body)
| Champ | Type | Requis | Description |

| `codePartage` | `string` | Oui | Le code unique du salon (6 caractères). |
| `pseudo` | `string` | Oui | Le pseudo souhaité par l'utilisateur. |

### Réponses

#### Succès : 201 Created
Retourne les mêmes informations que la création, mais avec un rôle de membre.

```json
{
  "salon": { ... },       // Voir structure ci-dessus
  "user": { ... },        // Voir structure ci-dessus
  "participation": {
    "id_participation": "number",
    "role": "string ('MEMBER')",
    ...
  }
}
```

#### Erreurs Spécifiques
Ces erreurs doivent être gérées explicitement par le frontend pour informer l'utilisateur.

| Code | Raison | Message d'erreur (JSON) | Action Frontend suggérée |

| **404** | Salon introuvable | `{ "error": "le salon n'existe pas" }` | Afficher "Code salon invalide". |
| **403** | Utilisateur banni | `{ "error": "Accès refusé : Vous êtes banni de ce salon." }` | Afficher un message bloquant rouge. |
| **409** | Pseudo déjà pris | `{ "error": "Ce pseudo est déjà utilisé dans ce salon." }` | Demander à l'utilisateur de changer de pseudo. |
| **400** | Données manquantes | `{ "error": "code partage du salon et pseudo requis" }` | Valider le formulaire avant envoi. |
