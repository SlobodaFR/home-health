# DESIGN — home-health

## 1. Objectif

Service d'ingestion et d'exposition des données Apple Health, en pont entre
l'app **Health Auto Export** (source, via webhook POST) et **home-remote-mcps**
(consommateur, via GET + OpenAPI → tools MCP).

App à part entière dans la stack `home-*`, avec son propre frontend (UI de
gestion des clés API), enregistrée comme client OAuth2 dans home-auth —
même pattern que `home-remote-mcps`, pas un service API nu.

## 2. Flux

```
Health Auto Export (iPhone)
        │  POST /health/:apiKey   (JSON, headers automation-*)
        ▼
   home-health  ──▶ SQLite (WAL) ──▶ Litestream ──▶ MinIO
        ▲
        │  GET /health/:apiKey/...
        │  GET /openapi.json
home-remote-mcps  ──▶ tools MCP  ──▶ LLM
```

## 3. Précédent : `home-remote-mcps`

Ce repo réutilise le pattern déjà en prod dans `home-remote-mcps` (repo local :
`remote-garmin-mcp`), qui a exactement le même besoin : app `home-*` avec
frontend, enregistrée comme client OAuth2 confidentiel dans home-auth pour la
session humaine (gestion des clés API), + clé API dans l'URL pour un client
tiers incapable d'envoyer un header custom (ici Health Auto Export, là-bas
Claude). Repris quasi à l'identique :

- **Repo** : workspaces npm `backend/` (NestJS) + `frontend/` (React/Vite,
  à calquer sur `home-remote-mcps/frontend`) + `package.json` racine.
- Hash de clé API : `scrypt` salé par clé (`salt:hash` hex), pas d'argon2 ni
  de pepper global — voir `domain/shared/hash.ts` chez `home-remote-mcps`.
- Clé API dans le **path**, pas un header `Authorization` : Health Auto Export
  (comme les connecteurs distants de Claude) n'expose qu'un champ "Clé"/URL
  dans son automation REST API, sans moyen d'attacher un header custom. Même
  raisonnement que `ApiKeyGuard` côté `home-remote-mcps`.
- **Auth humaine (UI)** : flow OAuth2 authorization-code complet contre
  home-auth — `OAuthClient` (login/callback/refresh), cookies
  `access_token`/`refresh_token` httpOnly, `JwtAuthGuard` (vérifie le cookie,
  retente via refresh token si expiré), `RevokedSessionRepository` +
  webhook `POST /auth/disconnect?secret=...` pour la révocation immédiate
  côté home-auth. Vérification JWT : `jose` + `createRemoteJWKSet` sur
  `{AUTH_SERVICE_URL}/.well-known/jwks.json`, payload validé sur la présence
  de `sub`/`email`/`name`/`iat` (pas de check `iss`/`aud` côté
  `home-remote-mcps` actuel — repris tel quel).
- home-health s'enregistre comme client OAuth2 confidentiel via
  `/admin/clients` sur home-auth (`AUTH_CLIENT_ID=home-health`,
  `redirect_uri` = `{PUBLIC_BASE_URL}/auth/callback`,
  `logoutWebhookUrl` = `{PUBLIC_BASE_URL}/auth/disconnect`).
- Déploiement : GHCR + GitHub Actions + 1Password + SSH + Caddy — détaillé
  en § 9, repris quasi à l'identique (une seule image ici, pas de sidecar
  type `garmin-connector`).

## 4. Authentification

### 4.1 Gestion des clés API (utilisateur humain)

- Session web via cookies `access_token`/`refresh_token` (httpOnly), posées
  après un flow OAuth2 authorization-code contre home-auth — identique à
  `home-remote-mcps` (`JwtAuthGuard`, `OAuthClient`,
  `RevokedSessionRepository`).
- `POST /api-keys` (protégé) → génère une clé aléatoire (`hh_<32 bytes
base64url>`), retournée **une seule fois**. Seul le hash `scrypt` est
  persisté.
- `GET /api-keys` → liste des clés (label, createdAt, lastUsedAt, revokedAt),
  jamais la valeur en clair.
- `DELETE /api-keys/:id` → révocation (soft, `revokedAt`), pas de suppression
  physique — cohérent avec `raw_ingestions` qui référence `userId` et pas
  `apiKeyId` (l'historique d'ingestion survit à la révocation d'une clé).

### 4.2 Auth des endpoints `/health/:apiKey/*` (machine-to-machine)

- Pas de JWT ici : l'`apiKey` dans le path fait office de secret partagé.
- Guard : hash `scrypt` de l'`apiKey` reçue comparé en temps constant
  (`verifySecret`) aux clés actives → résout `userId`, ou 404 générique (pas
  de distinction "clé invalide" vs "n'existe pas").
- Rate limiting basique sur ces routes (protéger contre le bruteforce de clé).

## 5. Modèle de données

### `api_keys`

| colonne      | type      | note                                |
| ------------ | --------- | ----------------------------------- |
| id           | uuid      | PK                                  |
| user_id      | string    | sub JWT home-auth, indexé           |
| label        | string    | ex. "iPhone Thomas"                 |
| hashed_key   | string    | `scrypt`, format `salt:hash`        |
| created_at   | datetime  |                                     |
| last_used_at | datetime? | mis à jour à chaque POST/GET réussi |
| revoked_at   | datetime? | soft delete                         |

Résolution d'une clé reçue : pas d'index direct possible (hash salé par
clé) → `listActive()` puis `verifySecret` en boucle, comme
`home-remote-mcps`. Volume de clés attendu faible (usage perso), donc
acceptable ; à revisiter si ça devient un goulot d'étranglement.

### `raw_ingestions` (audit / rejouabilité)

| colonne         | type     | note                                                |
| --------------- | -------- | --------------------------------------------------- |
| id              | uuid     | PK                                                  |
| user_id         | string   | indexé                                              |
| automation_id   | string?  | header `automation-id`                              |
| automation_name | string?  | header `automation-name`                            |
| session_id      | string?  | header `session-id`                                 |
| data_type       | string   | clé top-level détectée (`metrics`, `workouts`, ...) |
| payload         | json     | payload brut reçu                                   |
| received_at     | datetime |                                                     |

### `health_metrics`

| colonne     | type         | note                                                                                                         |
| ----------- | ------------ | ------------------------------------------------------------------------------------------------------------ |
| id          | uuid         | PK                                                                                                           |
| user_id     | string       | indexé                                                                                                       |
| name        | string       | `step_count`, `heart_rate`, ... — indexé                                                                     |
| units       | string       |                                                                                                              |
| date        | string (ISO) | indexé                                                                                                       |
| source      | string?      |                                                                                                              |
| payload     | json         | reste des champs spécifiques (qty / Min-Avg-Max / systolic-diastolic / value / mealTime / champs sommeil...) |
| ingested_at | datetime     |                                                                                                              |

Upsert sur `(user_id, name, date, source)`.

### `workouts`

| colonne        | type         | note                                                                          |
| -------------- | ------------ | ----------------------------------------------------------------------------- |
| id             | string       | PK — `id` Auto Export v2, ou hash déterministe `(user_id, name, start)` en v1 |
| user_id        | string       | indexé                                                                        |
| name           | string       |                                                                               |
| start          | string (ISO) | indexé                                                                        |
| end            | string (ISO) |                                                                               |
| duration       | int          | secondes                                                                      |
| location       | string?      |                                                                               |
| energy         | json?        | activeEnergyBurned, totalEnergy, intensity                                    |
| distance_speed | json?        | distance, speed, avgSpeed, maxSpeed                                           |
| elevation      | json?        |                                                                               |
| heart_rate     | json?        | heartRate, maxHeartRate, avgHeartRate                                         |
| route          | json?        | tableau de points GPS                                                         |
| time_series    | json?        | heartRateData, stepCount, cyclingPower, swim*...                              |
| metadata       | json?        |                                                                               |
| ingested_at    | datetime     |                                                                               |

Upsert sur `id`.

### Tables minimales pour les autres data types (structure à confirmer)

`symptoms`, `ecg_readings`, `heart_rate_notifications`, `state_of_mind_entries`,
`cycle_tracking_entries`, `medication_entries` : `id`, `user_id`, `date`,
`payload json`, `ingested_at`. À normaliser davantage une fois le format réel
observé via `raw_ingestions`.

## 6. Endpoints

```
POST   /health/:apiKey                       Ingestion (type déduit des clés
                                              présentes dans "data")

GET    /health/:apiKey/metrics               ?name=&from=&to=&limit=
GET    /health/:apiKey/metrics/:name         ?from=&to=
GET    /health/:apiKey/workouts              ?from=&to=&limit=
GET    /health/:apiKey/workouts/:id
GET    /health/:apiKey/symptoms              ?from=&to=
GET    /health/:apiKey/ecg                   ?from=&to=
GET    /health/:apiKey/heart-rate-notifications ?from=&to=
GET    /health/:apiKey/state-of-mind         ?from=&to=
GET    /health/:apiKey/cycle-tracking        ?from=&to=
GET    /health/:apiKey/medications           ?from=&to=

POST   /api-keys        (Bearer JWT home-auth)
GET    /api-keys        (Bearer JWT home-auth)
DELETE /api-keys/:id    (Bearer JWT home-auth)

GET    /openapi.json
GET    /health/status   (liveness, pas d'auth)
```

## 7. DTOs (POST d'ingestion)

Validation stricte de l'enveloppe, permissive sur le détail :

- `AutoExportPayloadDto { data: AutoExportDataDto }`
- `AutoExportDataDto { metrics?: HealthMetricDto[]; workouts?: WorkoutV2Dto[];
symptoms?: unknown[]; ecg?: unknown[]; heartRateNotifications?: unknown[];
stateOfMind?: unknown[]; cycleTracking?: unknown[]; medications?: unknown[]; }`
- `HealthMetricDto { name: string; units: string; data: MetricDataPointDto[] }`
- `MetricDataPointDto` : `date`/`startDate`/`endDate`, `source?`, reste en
  champs libres (`qty`, `Min`/`Avg`/`Max`, `systolic`/`diastolic`, `value`,
  `mealTime`, champs sommeil...)
- `WorkoutV2Dto` : champs requis (`id`, `name`, `start`, `end`, `duration`) +
  tous les champs optionnels documentés (energy, distance/speed, elevation,
  environnement, natation, heart rate, time-series, route, metadata) en
  `@IsOptional()`, reste en champs libres pour les clés non prévues.

Payload potentiellement volumineux (routes GPS, batch requests) : limite
explicite via `MAX_PAYLOAD_SIZE`, body streamé/parsé sans chargement
inutilement dupliqué en mémoire.

Idempotence : Auto Export peut envoyer plusieurs requêtes pour un même run
("Batch Requests") → tous les inserts en upsert sur clé naturelle, jamais
`INSERT` brut.

## 8. OpenAPI / intégration home-remote-mcps

- `@nestjs/swagger`, `DocumentBuilder` avec `addServer(PUBLIC_BASE_URL)`.
- `apiKey` documenté comme `@ApiParam({ name: 'apiKey', in: 'path' })` sur
  chaque route GET.
- `@ApiOperation` / `@ApiResponse` détaillés : ce texte est vu par le LLM via
  home-remote-mcps pour choisir le bon tool — soigner descriptions et exemples.
- Exposer le document brut en JSON sur `GET /openapi.json` (pas seulement
  l'UI Swagger).

## 9. Déploiement

Pattern identique à `home-remote-mcps` (confirmé, pas de `home-budget`
consulté — repo indisponible localement, mais `home-remote-mcps` suit le
même modèle `home-*` donc fait référence fiable) :

- **Image** : une seule (pas de sidecar comme `garmin-connector`), buildée
  via `docker/build-push-action`, poussée sur `ghcr.io/slobodafr/home-health`.
- **CI** (`ci.yml`) : lint + test + build sur push/PR vers `main`, plus un job
  `docker-build-check` (build sans push) sur PR.
- **Build & Publish** (`build-and-publish.yml`) : sur push `main` et release,
  tags `sha-<7>`, `latest` (sur `main`), semver sur release.
- **Deploy** (`deploy-vps.yml`) : déclenché par `workflow_run` sur succès de
  Build & Publish, secrets chargés depuis 1Password
  (`op://TECH/thomassloboda_home_secrets/...`), écriture du `.env` distant
  par SSH, sync des fichiers `deploy/` par SCP, puis
  `deploy/scripts/update-vps.sh` (pull + `docker compose up -d` +
  reload Caddy via un fichier `sites/home-health.Caddyfile`).
- **Domaine** : `health.sloboda.fr` (confirmé).
- **Port local (VPS)** : `127.0.0.1:3007` → conteneur `:3000` (`home-remote-mcps`
  utilise déjà 3006 sur le même VPS) — **à confirmer** qu'il n'entre pas en
  conflit avec un autre service `home-*` déjà déployé, voir § 12.
- Réplication SQLite → MinIO via Litestream, `litestream.yml` +
  `docker-entrypoint.sh` copiés du pattern `home-remote-mcps` (restore au
  démarrage si `MINIO_BUCKET` défini, puis `litestream replicate -exec`).

Fichiers attendus dans `deploy/` : `docker-compose.yml`, `Caddyfile`,
`scripts/update-vps.sh`.

## 10. Différences volontaires avec `home-remote-mcps`

- Pas de `credentials`/chiffrement de tokens tiers (`CREDENTIALS_ENCRYPTION_KEY`,
  domaine `credential`) : home-health ne stocke pas de session OAuth vers un
  service tiers (Garmin, YouTube...) — la seule donnée sensible est la clé
  API Health Auto Export (déjà hashée `scrypt`, jamais chiffrée/déchiffrée).
- Pas de sidecar (`garmin-connector`) : une seule image.
- Frontend minimal au départ : une seule page (liste/création/révocation des
  clés API), pas de dashboard de credentials multi-services.

## 11. Variables d'environnement (`.env`)

```
NODE_ENV=
PORT=
DATABASE_PATH=

AUTH_SERVICE_URL=https://auth.sloboda.fr
AUTH_CLIENT_ID=home-health
AUTH_CLIENT_SECRET=
AUTH_WEBHOOK_SECRET=

FRONTEND_URL=https://health.sloboda.fr
PUBLIC_BASE_URL=https://health.sloboda.fr

MINIO_ENDPOINT=
MINIO_BUCKET=
MINIO_REPLICA_PATH=health-db
MINIO_REGION=us-east-1
MINIO_ACCESS_KEY_ID=
MINIO_SECRET_ACCESS_KEY=

MAX_PAYLOAD_SIZE=
```

## 12. Questions ouvertes (à valider avant/pendant l'implémentation)

1. **Format exact des payloads** `symptoms`/`ecg`/`heartRateNotifications`/
   `stateOfMind`/`cycleTracking`/`medications` (non documenté publiquement) —
   capturés en JSON libre dans `raw_ingestions` + tables minimales, à
   normaliser avec un export réel avant de figer un schéma strict.
2. **Pattern exact de `home-budget`** non consulté (repo absent en local) :
   le pattern retenu (§ 9) vient de `home-remote-mcps`, qui suit la même
   convention `home-*`. À signaler si `home-budget` diverge sur un point
   structurant.
3. **Enregistrement du client OAuth2** `home-health` dans
   `/admin/clients` de home-auth : à faire manuellement par l'utilisateur
   avant le premier déploiement (comme pour `home-remote-mcps`), pas
   automatisable depuis ce repo.
4. **Port `127.0.0.1:3007`** côté VPS (§ 9) : choisi par élimination (3006
   déjà pris par `home-remote-mcps`), pas vérifié contre la liste réelle des
   ports déjà utilisés par les autres apps `home-*` sur le VPS — à confirmer
   avant le premier déploiement.
5. **`docker build` non vérifié dans cet environnement** : le daemon Docker
   local n'a pas d'accès réseau/DNS ici (confirmé indépendamment du
   Dockerfile, `docker run hello-world` échoue de la même façon). Le
   Dockerfile est une adaptation fidèle et relue de celui de
   `home-remote-mcps` (même version Litestream, même logique restore/
   replicate), mais un vrai `docker build` (en local ou via le job
   `docker-build-check` de la CI) reste à faire avant le premier déploiement.
6. **Champs 1Password à créer** avant le premier déploiement, dans le même
   vault que les autres apps `home-*` (`TECH/thomassloboda_home_secrets`) :
   `HEALTH_AUTH_CLIENT_ID`, `HEALTH_AUTH_SECRET`, `HEALTH_AUTH_WEBHOOK_SECRET`,
   `HEALTH_FRONTEND_URL`, `HEALTH_DATABASE_PATH`, `HEALTH_MINIO_REPLICA_PATH`
   — les autres champs référencés par `deploy-vps.yml` (`VPS_HOST`,
   `VPS_USER`, `VPS_PRIVATE_KEY`, `AUTH_BASE_URL`, `MINIO_*`) sont déjà
   partagés avec les autres apps `home-*` et n'ont pas besoin d'être recréés.
