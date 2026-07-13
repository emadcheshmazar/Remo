Phase: 09 — App Version Badge
Status: completed

Summary
* Added an always-visible app version badge: 1.0.0
* Established the version bump rule for future AI changes

Actions Performed
* frontend/package.json: bumped version to 1.0.0
* frontend/src/config/version.ts: exposes APP_VERSION from package metadata
* frontend/src/components/AppVersion.tsx: fixed tiny version badge
* frontend/src/app/layout.tsx: renders the badge globally
* backend/app/main.py: FastAPI metadata mirrors version 1.0.0

Architecture Impact
* Visible app version has a single frontend source: frontend/package.json
* Badge is global through RootLayout and appears on login/authenticated pages

New Capabilities
* Users can always see the current app version in the bottom-left corner
* Future changes must bump app version according to SemVer:
  PATCH for fixes/copy/internal improvements, MINOR for new backward-compatible capabilities, MAJOR for breaking workflow/API/data changes

Constraints
* Backend API version is metadata only and should be kept aligned when API behavior changes

Next Step
* On every future change, update frontend/package.json version and any mirrored metadata/version log before finishing

Context Compression
* App version is 1.0.0
* Visible badge: RootLayout -> AppVersion -> APP_VERSION from frontend/package.json
* Version bump is now part of AI history: every future change must update version
* Keep backend FastAPI metadata aligned when API behavior changes
