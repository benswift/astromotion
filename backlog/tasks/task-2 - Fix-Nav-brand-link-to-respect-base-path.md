---
id: TASK-2
title: Fix Nav brand link to respect base path
status: To Do
assignee: []
created_date: '2026-04-08 22:01'
labels:
  - bugfix
  - navigation
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The Nav.astro component has a hardcoded href="/" for the brand/home link. When a site uses a base path (e.g. base: "/comp2710-lens/"), this link points to the root instead of the site's base. It should use import.meta.env.BASE_URL or similar. Found while fixing hardcoded links in teaching-archive-new.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Nav brand link uses BASE_URL instead of hardcoded /
- [ ] #2 Sites with non-root base paths navigate to the correct home page
<!-- AC:END -->
