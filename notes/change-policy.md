# Change policy

This document defines how changes land on `main` and how the policy is
enforced. The goal is that nothing reaches `main` unless CI passes and the
change has been reviewed, while still giving the repository owner an emergency
escape hatch.

## Policy

1. **No direct pushes to `main`.** All changes go through a pull request from a
   feature branch.
2. **CI must pass.** The required status check is **`test`**, the single job in
   [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) (lint, unit tests,
   build, and Playwright e2e).
3. **Independent review.** A pull request needs **one approving review from
   someone other than the contributor**. GitHub never counts an author's own
   approval.
4. **Squash merges only.** Merge and rebase merges are disabled.
5. **Admin bypass.** The repository owner (`NatTuck`) may bypass the rules for
   emergencies. This is required because there is currently only one
   maintainer, so the independent-review rule cannot otherwise be satisfied.

## Enforcement

The policy is implemented as a **repository ruleset** named `main protection`,
targeting the default branch `main`.

| Setting | Value |
| --- | --- |
| Target | Branch `main` |
| Enforcement | Active |
| Require a pull request | Yes |
| Required approvals | 1 (author's approval does not count) |
| Allowed merge methods | Squash only |
| Dismiss stale approvals on push | Yes |
| Require approval of the most recent push | Yes |
| Require conversation resolution | Yes |
| Require status checks | `test` |
| Require branches to be up to date | No (keeps CI runs down) |
| Block force pushes | Yes |
| Restrict deletions | Yes |
| Bypass actors | `NatTuck` (user), mode `always` |

### Apply in the web UI

**Settings → Rules → Rulesets → New branch ruleset**

- Name: `main protection`; Enforcement: **Active**; Target branches: add
  `main`.
- **Require a pull request before merging**:
  - Required approvals: **1**
  - Allowed merge methods: **Squash** only (uncheck Merge and Rebase)
  - Check **Dismiss stale pull request approvals when new commits are pushed**
  - Check **Require approval of the most recent reviewable push**
  - Check **Require conversation resolution before merging**
- **Require status checks to pass** → add **`test`**
- **Block force pushes**
- **Restrict deletions**
- **Bypass list** → add **NatTuck** (the repository owner).

### Repository merge settings

A ruleset can only restrict the merge methods the repository already allows; it
cannot enable one that is disabled. Make sure squash merging is turned on under
**Settings → General → Pull Requests**: check **Allow squash merging** and
uncheck **Allow merge commits** and **Allow rebase merging** if you want squash
to be the only option everywhere.

### Apply via the API

Requires a token with admin access to the repository. `NatTuck`'s user id is
`1311959`.

```sh
curl -X POST https://api.github.com/repos/NatTuck/botbash/rulesets \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/vnd.github+json" \
  -d '{
    "name": "main protection",
    "target": "branch",
    "enforcement": "active",
    "bypass_actors": [
      { "actor_id": 1311959, "actor_type": "User", "bypass_mode": "always" }
    ],
    "conditions": { "ref_name": { "include": ["refs/heads/main"] } },
    "rules": [
      { "type": "pull_request", "parameters": {
          "required_approving_review_count": 1,
          "allowed_merge_methods": ["squash"],
          "dismiss_stale_reviews_on_push": true,
          "require_last_push_approval": true,
          "required_review_thread_resolution": true
      }},
      { "type": "required_status_checks", "parameters": {
          "required_status_checks": [{ "context": "test" }],
          "strict_required_status_checks_policy": false
      }},
      { "type": "non_fast_forward" },
      { "type": "deletion" }
    ]
  }'
```

## Verifying the policy

- `git push origin main` is rejected for non-bypass users.
- On a pull request, the merge button stays disabled until `test` is green and
  a non-author has approved.
- Only **Squash and merge** is offered.
- As `NatTuck`, the bypass option is available for emergencies.

## CI before review (fork pull requests)

Workflows triggered by `pull_request` normally start as soon as a pull request
is opened or updated, which is *before* any review. There is one exception:
for pull requests from public forks, GitHub holds the run in `action_required`
until a maintainer approves it. Until then the required `test` check has not
run, so it can look like CI only happens after review even though the required
review is a separate, later gate.

To let CI start automatically, set:

**Settings → Actions → General → "Approval for running fork pull request
workflows from contributors" → Require approval for first-time contributors who
are new to GitHub → Save.**

Effects and limits:

- Established GitHub users who have not contributed here trigger `test`
  immediately on `opened`/`synchronize`/`reopened`, before any review.
- Brand-new GitHub accounts still need a one-time approval. There is no option
  to disable the gate entirely for public forks.
- GitHub stops treating a contributor as first-time once *any* commit or pull
  request of theirs has been merged, so this is a trust heuristic rather than a
  strict allowlist.
- The setting is UI-only; it is not exposed by the REST API.
- Auto-running fork workflows spends runner minutes on untrusted code. The
  `pull_request` context is the safe one (read-only `GITHUB_TOKEN`, no secrets,
  ephemeral runner); do not run untrusted test code from `pull_request_target`.

Manually approving a held run (this is not a code review):

- Pull request → **Files changed** → **Approve workflows to run**
- `gh api -X POST repos/NatTuck/botbash/actions/runs/<run-id>/approve`

This makes CI start earlier; it does **not** order CI before review. Required
status checks and required reviews remain independent gates that are both
evaluated at merge.

## Caveats

- **Check name coupling.** The required check is the job name `test`. Renaming
  that job in `.github/workflows/ci.yml` silently removes the required check
  until the ruleset is updated.
- **Single maintainer.** Because there is only one maintainer, the
  independent-review requirement is enforced for outside contributors but the
  owner relies on the bypass. If a second collaborator is added, the bypass
  should be narrowed or removed.
- **Not absolute.** A repository owner can always edit or delete the ruleset,
  so this is an operational guardrail rather than an immutable policy.
