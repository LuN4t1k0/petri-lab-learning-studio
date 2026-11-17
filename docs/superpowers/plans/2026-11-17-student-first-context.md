# Student-first Context Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make PetriLab clearer, calmer, and visibly created for students by Cristian Venegas / LuN4t!k0 together with Claude.

**Architecture:** Modify only static presentation files and their build-level assertions. Preserve all application logic and the existing GitHub Pages deployment workflow.

**Tech Stack:** Static HTML, CSS, Node test runner

**Spec:** `docs/superpowers/specs/2026-11-17-student-first-context-design.md`

## Global Constraints

- Preserve the four laboratory modes and eight Alpha steps.
- Keep the concept map because it explains the learning flow.
- Keep author credit visible but secondary to the learning task.

## Review Focus

- Desktop and mobile headings must remain high contrast.
- The GitHub author link must be usable and accessible.
- Removing header decoration must not break header alignment.
- Increased text sizes must not overflow mode tabs or the learning rail.
- Existing Alpha and build tests must remain green.

### Task 1: Student-facing identity and readable presentation

**Files:**
- Modify: `tests/build.test.js`
- Modify: `dist/index.html`
- Modify: `dist/styles.css`

**Interfaces:**
- Consumes: existing static page structure and CSS variables
- Produces: student-first copy, creator attribution, solid title styling, simplified header

- [x] **Step 1: Write the failing build test**
- [x] **Step 2: Run it and confirm the missing identity/readability assertions fail**
- [x] **Step 3: Implement the HTML and CSS changes**
- [x] **Step 4: Run the focused test and full suite**
- [ ] **Step 5: Build, visually verify, commit, and publish**

