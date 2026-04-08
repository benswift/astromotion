---
id: TASK-3
title: Make link checker base-path-aware
status: To Do
assignee: []
created_date: '2026-04-08 22:01'
labels:
  - bugfix
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The link-checker.ts builds routes from the dist directory (e.g. /decks/00-intro/) but the rendered HTML contains base-prefixed links (e.g. /comp2710-lens/decks/00-intro/). The checker should strip the base path before comparing, or add base-prefixed routes to the known set. Currently all sites with a non-root base must disable the link checker. Found while fixing hardcoded links in teaching-archive-new.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Link checker correctly validates internal links when site uses a non-root base path
- [ ] #2 Sites with base paths no longer need to disable the link checker
<!-- AC:END -->
