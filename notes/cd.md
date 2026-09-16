# Deployment (CD)

Bot Bash is deployed to `botbash@ettin.homework.quest` with GitHub Actions,
`rsync`, and a systemd `--user` service. nginx terminates TLS for
`botbash.homework.quest` and reverse-proxies to the app on `localhost:3100`
(see [`notes/botbash.conf`](./botbash.conf)).

The CD workflow runs on every push/merge to `main` and can also be triggered by
hand. It builds the app in CI, syncs the result to the host, and restarts the
service.

CI is documented separately in [`notes/ci.md`](./ci.md).

```
push / merge to main
          |
          v
  +--------------------------+
  |  GitHub Actions CD       |
  |  build -> rsync ->       |
  |  restart systemd         |
  +--------------------------+
          |
          v
  nginx :443 --> botbash.service (systemd --user) :3100
```

## How the app runs in production

`pnpm build` typechecks the client and server (`tsc`, both `noEmit`) and runs
`vite build`, which emits the client bundle to `dist/`. The Express server is
executed directly from TypeScript with `vite-node`; when `NODE_ENV=production`,
`vite-express` serves the built files from `dist/` instead of running a Vite
dev server.

Because of that, the production host needs `vite-node` available at runtime.
This repo currently lists `vite-node` as a dev dependency and has no `start`
script, so two small changes are required before the first deploy.

## Repo changes to make first

1. Add a production start script to `package.json`:

   ```json
   "start": "NODE_ENV=production vite-node server/index.ts"
   ```

2. Move `vite-node` from `devDependencies` to `dependencies` so that a
   production-only install (`pnpm install --prod`) still has it. `vite-node`
   pulls in `vite` itself, but **not** Playwright, Biome, or TypeScript.

3. Commit the service unit at [`deploy/botbash.service`](../deploy/botbash.service)
   (already in this repo).

## CD workflow

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

concurrency:
  group: deploy-production
  cancel-in-progress: false

env:
  DEPLOY_HOST: ettin.homework.quest
  DEPLOY_USER: botbash
  DEPLOY_PATH: /home/botbash/botbash
  APP_PORT: "3100"

jobs:
  deploy:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 11

      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build
        run: pnpm build

      - name: Load deploy key
        uses: webfactory/ssh-agent@v0.9.0
        with:
          ssh-private-key: ${{ secrets.SSH_KEY }}

      - name: Trust host key
        run: ssh-keyscan -H "$DEPLOY_HOST" >> ~/.ssh/known_hosts

      - name: Sync built client
        run: |
          rsync -az --delete dist/ "$DEPLOY_USER@$DEPLOY_HOST:$DEPLOY_PATH/dist/"

      - name: Sync server sources
        run: |
          rsync -az --delete server/ "$DEPLOY_USER@$DEPLOY_HOST:$DEPLOY_PATH/server/"
          rsync -az --delete shared/ "$DEPLOY_USER@$DEPLOY_HOST:$DEPLOY_PATH/shared/"
          rsync -az package.json pnpm-lock.yaml pnpm-workspace.yaml \
            tsconfig.json tsconfig.server.json \
            "$DEPLOY_USER@$DEPLOY_HOST:$DEPLOY_PATH/"

      - name: Install dependencies and restart
        run: |
          ssh "$DEPLOY_USER@$DEPLOY_HOST" \
            "set -euo pipefail && \
             cd $DEPLOY_PATH && \
             export PATH=\$HOME/.local/share/mise/shims:\$PATH && \
             pnpm install --frozen-lockfile --prod && \
             export XDG_RUNTIME_DIR=/run/user/\$(id -u) && \
             systemctl --user restart botbash && \
             sleep 2 && \
             curl -fsS http://localhost:$APP_PORT/api/state"
```

Notes:

- Only the private key is secret (`SSH_KEY`). The host, user, and path are
  hardcoded in the workflow `env:` block, so they are easy to review and
  change.
- `dist/` is synced with `--delete` so stale hashed asset files are removed.
  `server/` and `shared/` are synced the same way. The root files are copied
  without `--delete` so `node_modules/` and any untracked files on the host are
  preserved.
- `systemctl --user` needs a session bus. Over a non-interactive SSH command,
  `XDG_RUNTIME_DIR` is usually unset, so it is set explicitly before the call.
  This relies on lingering being enabled (see below).
- `pnpm install --prod` on the host is what makes moving `vite-node` to
  `dependencies` necessary.
- The final `curl` fails the job if the service did not come back up.

## One-time server setup

All of the following is done once, as `root` or as the `botbash` user, on
`ettin.homework.quest`.

### 1. Create the user and enable lingering

```sh
sudo adduser --disabled-password --gecos "" botbash
sudo loginctl enable-linger botbash
```

Lingering is required so the `systemd --user` manager (and therefore the
service) keeps running when `botbash` is not logged in.

### 2. Install mise, Node 24, and pnpm

```sh
su - botbash
curl https://mise.run | sh
mise use -g node@24
npm install -g pnpm
```

`mise use -g` installs Node globally for the user, so the service does not
depend on a project-local `.mise.toml`. If you prefer a pinned project version,
commit a `.mise.toml` instead and use `mise use node@24` in the project.

The service unit looks for tools under `~/.local/share/mise/shims`, which is
where `mise` installs its shims.

### 3. Put the code on the host

The first CD run will create `/home/botbash/botbash` via `rsync`, but an
initial clone makes the service runnable immediately:

```sh
git clone git@github.com:NatTuck/botbash.git /home/botbash/botbash
```

The host does not need repository credentials for deploys; `rsync` pushes the
files over SSH.

### 4. Install and start the service

```sh
mkdir -p ~/.config/systemd/user
cp /home/botbash/botbash/deploy/botbash.service ~/.config/systemd/user/botbash.service
systemctl --user daemon-reload
systemctl --user enable --now botbash
systemctl --user status botbash
```

The unit runs `pnpm start` with `NODE_ENV=production` and `PORT=3100`.

### 5. nginx and TLS

Copy `notes/botbash.conf` to `/etc/nginx/sites-available/botbash.conf`, enable
it, and reload:

```sh
sudo ln -s /etc/nginx/sites-available/botbash.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d botbash.homework.quest
```

The nginx config already sets the `Upgrade`/`Connection` headers that
Socket.IO needs.

## GitHub secret setup

Generate a dedicated deploy key pair (no passphrase, so CI can use it
non-interactively):

```sh
ssh-keygen -t ed25519 -C botbash-deploy -f botbash_deploy -N ""
```

Install the public half on the host:

```sh
cat botbash_deploy.pub | ssh botbash@ettin.homework.quest \
  'mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys'
```

Store the private half as a repository secret named `SSH_KEY`:

```sh
gh secret set SSH_KEY < botbash_deploy
```

(Or use the GitHub UI: **Settings → Secrets and variables → Actions → New
repository secret**.) Then delete the local key files:

```sh
rm botbash_deploy botbash_deploy.pub
```

## Verifying a deploy

```sh
# On the host
systemctl --user status botbash
journalctl --user -u botbash -f

# From anywhere
curl -fsS https://botbash.homework.quest/api/state
```

A healthy response looks like `{"playerCount":0,"gameCount":0}`.

## Rollback

- **Re-run a previous deploy:** open **Actions → Deploy**, pick the last
  successful run before the bad change, and choose **Re-run jobs**. GitHub
  checks out that run's commit and redeploys it.
- **Revert the change:** `git revert <sha>` and push to `main`; CI and CD run
  again.
- **Stop the bleeding:** `systemctl --user stop botbash` on the host; nginx
  will return `502` until the service is restarted.

## Troubleshooting

| Symptom | Likely cause / fix |
| --- | --- |
| `systemctl --user` over SSH: "Failed to connect to bus" | Set `XDG_RUNTIME_DIR=/run/user/$(id -u)` and ensure `loginctl enable-linger botbash` was run. |
| Service exits immediately, `pnpm: command not found` | `mise` shims missing or `PATH` wrong in the unit; verify `~/.local/share/mise/shims/pnpm` exists. |
| Service exits, `vite-node: command not found` | `vite-node` is still a dev dependency; move it to `dependencies` and redeploy. |
| nginx returns `502` | The service is down or not listening on `3100`; check `journalctl --user -u botbash`. |
| `ssh-keyscan` host key mismatch | The host was reinstalled or rotated keys; update the pinned `known_hosts`. |

## Security notes

- The deploy key is deploy-only. Consider restricting it further on the host
  with `command=` and `from=` options in `authorized_keys`.
- `ssh-keyscan` trusts the host key on first contact. For stronger guarantees,
  pin the host key by storing a known `known_hosts` line as a secret and
  writing it instead of scanning.
- Secrets are never logged: the private key is injected via
  `webfactory/ssh-agent`, not written to disk in the workflow.
