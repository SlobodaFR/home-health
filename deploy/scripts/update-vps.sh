#!/bin/sh
set -e

DEPLOY_DIR="${DEPLOY_DIR:-/opt/health}"
IMAGE="${IMAGE:-ghcr.io/slobodafr/home-health}"

cd "$DEPLOY_DIR/deploy"

export IMAGE
export IMAGE_TAG

# Image is public - no login needed to pull. Drop any stale/invalid cached
# credential for ghcr.io first: docker prefers a cached credential over
# anonymous access, so a leftover bad one from an earlier failed login would
# keep blocking pulls of an otherwise-public image.
docker logout ghcr.io >/dev/null 2>&1 || true

# Convention harnais image-retention : fait de la place AVANT le pull (garde keep-1 images par dépôt).
sh "$DEPLOY_DIR/deploy/scripts/prune-service-images.sh" --phase pre \
  --service health --image "$IMAGE" \
  --tag "$IMAGE_TAG" --project home-health
docker compose pull
# Convention harnais docker-nonroot-volume : l'image tourne en uid 1000 mais le volume de donnees existant appartient a root
# (cree par l'ancienne image). Le service est arrete puis le volume rendu a 1000:1000, avant le `up`. Idempotent.
# ORDRE (non verifie par l'audit) : la sauvegarde pre-deploy-backup tourne AVANT ce script (deploy-vps.yml, sous le meme
# verrou d'hote) ; ne jamais deplacer ce chown avant elle, ni apres compose-up-healthy.sh. `set -e` : pas de `||`.
sh "$DEPLOY_DIR/deploy/scripts/fix-volume-owner.sh" --service health \
  --project home-health --volume home-health-data --stop home-health
# Convention harnais deploy-wait-healthy : `docker compose up -d --wait` (repli : boucle docker inspect) ; un conteneur
# qui n'est pas sain après 180 s fait échouer le déploiement (logs, sauvegarde et restauration affichées), sans retour arrière automatique.
sh "$DEPLOY_DIR/deploy/scripts/compose-up-healthy.sh" --service health \
  --restore-args "--project home-health --volume home-health-data --mount /app/backend/data --db-path ${DATABASE_PATH:-/app/backend/data/home-health.sqlite}" \
  -- --remove-orphans
# Convention harnais image-retention : après un déploiement sain uniquement (set -e), garde 2 images par dépôt.
sh "$DEPLOY_DIR/deploy/scripts/prune-service-images.sh" --phase post \
  --service health --image "$IMAGE" \
  --tag "$IMAGE_TAG" --project home-health

if ! command -v caddy >/dev/null 2>&1; then
  sudo apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https curl
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
  sudo apt-get update -qq
  sudo apt-get install -y -qq caddy
fi

sudo mkdir -p /etc/caddy/sites
sudo cp "$DEPLOY_DIR/deploy/Caddyfile" /etc/caddy/sites/home-health.Caddyfile

if ! grep -q '^import sites/\*$' /etc/caddy/Caddyfile 2>/dev/null; then
  echo 'import sites/*' | sudo tee -a /etc/caddy/Caddyfile >/dev/null
fi

sudo caddy validate --config /etc/caddy/Caddyfile

sudo systemctl reload caddy
