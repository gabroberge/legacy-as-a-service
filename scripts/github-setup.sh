#!/usr/bin/env bash
# Configure GitHub repository security settings for legacy-as-a-service.
# Requires: gh auth login (repo scope)
set -euo pipefail

REPO="${1:-gabroberge/legacy-as-a-service}"
BRANCH="${2:-master}"
CI_CHECK="Dependencies resolve; architecture does not"

echo "→ Repository: $REPO (branch: $BRANCH)"

echo "→ Enabling Dependabot vulnerability alerts…"
gh api --method PUT "repos/${REPO}/vulnerability-alerts" >/dev/null

echo "→ Enabling Dependabot security update PRs…"
gh api --method PUT "repos/${REPO}/automated-security-fixes" >/dev/null

echo "→ Setting Actions workflow token to read-only by default…"
gh api --method PUT "repos/${REPO}/actions/permissions/workflow" \
  --input - <<'EOF'
{
  "default_workflow_permissions": "read",
  "can_approve_pull_request_reviews": false
}
EOF

echo "→ Enabling secret scanning + push protection…"
gh api --method PATCH "repos/${REPO}" --input - <<'EOF'
{
  "security_and_analysis": {
    "secret_scanning": { "status": "enabled" },
    "secret_scanning_push_protection": { "status": "enabled" }
  },
  "has_discussions": false,
  "has_projects": false,
  "allow_squash_merge": true,
  "allow_merge_commit": false,
  "allow_rebase_merge": false,
  "delete_branch_on_merge": true
}
EOF

echo "→ Restricting Actions to GitHub-owned + explicit allowlist…"
gh api --method PUT "repos/${REPO}/actions/permissions" --input - <<'EOF'
{
  "enabled": true,
  "allowed_actions": "selected",
  "github_owned_allowed": true,
  "verified_allowed": false
}
EOF

gh api --method PUT "repos/${REPO}/actions/permissions/selected-actions" --input - <<'EOF'
{
  "github_owned_allowed": true,
  "verified_allowed": false,
  "patterns_allowed": [
    "oven-sh/setup-bun@*",
    "EndBug/label-sync@*"
  ]
}
EOF

echo "→ Setting repository topics…"
gh api --method PUT "repos/${REPO}/topics" \
  --input - <<'EOF'
{
  "names": ["satire", "legacy", "astro", "technical-debt", "enterprise", "static-site"]
}
EOF

echo "→ Applying branch protection on ${BRANCH}…"
gh api --method PUT "repos/${REPO}/branches/${BRANCH}/protection" \
  --input - <<EOF
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["${CI_CHECK}"]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": null,
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "block_creations": false,
  "required_conversation_resolution": false
}
EOF

echo "→ Triggering label sync workflow…"
gh workflow run labels.yml -R "$REPO" 2>/dev/null || echo "   labels workflow not found on default branch yet"

echo "→ Enabling GitHub Pages (workflow source)…"
if gh api "repos/${REPO}/pages" >/dev/null 2>&1; then
  gh api --method PUT "repos/${REPO}/pages" --input - <<EOF >/dev/null
{ "build_type": "workflow" }
EOF
else
  gh api --method POST "repos/${REPO}/pages" --input - <<EOF
{
  "build_type": "workflow",
  "source": { "branch": "${BRANCH}", "path": "/" }
}
EOF
fi
PAGES_URL=$(gh api "repos/${REPO}/pages" -q .html_url 2>/dev/null || echo "")
echo "   Pages: ${PAGES_URL:-enable failed — set manually in Settings → Pages}"

echo "→ Triggering Pages deploy…"
gh workflow run deploy.yml -R "$REPO" 2>/dev/null || echo "   deploy workflow not on default branch yet — push first"

echo ""
echo "Done. Optional / UI-only (see SECURITY.md):"
echo "  • Settings → Actions → Fork PR workflows → require approval for outside contributors"
echo "  • Branch protection → require PR before merge (solo maintainer: optional)"
echo "  • Branch protection → enforce for administrators (stricter lockdown)"
echo ""
gh api "repos/${REPO}" -q '"Visibility: " + .visibility + " | Issues: " + (.has_issues|tostring)'
