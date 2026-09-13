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
