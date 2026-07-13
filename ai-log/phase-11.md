Phase: 11 — Team Username Column and Password Edit UX
Status: completed

Summary
* Confirmed username is shown as a dedicated team/admin table column
* Improved edit password UX with a masked prefilled value that preserves the current password unless changed
* Bumped app version to 1.1.0

Actions Performed
* frontend/src/components/UserTable.tsx: kept username as a stable visible column
* frontend/src/components/UserTable.tsx: added horizontal table safety for narrow screens
* frontend/src/components/UserTable.tsx: fixed edit-row colspan for manager vs non-manager tables
* frontend/src/components/UserTable.tsx: prefilled edit password field with a masked unchanged value
* frontend/package.json: bumped version from 1.0.1 to 1.1.0
* backend/app/main.py: mirrored metadata version 1.1.0

Architecture Impact
* Password hashes remain non-reversible and are not exposed by the API
* Saving a user with the masked password value leaves the stored password unchanged
* Typing a new password in the edit field updates that user's password

New Capabilities
* Team/admin users can scan usernames directly in the table
* Edit forms visually show that a password exists without exposing raw credentials

Constraints
* The real current password cannot be prefilled because only password_hash is stored

Next Step
* Continue bumping app version on every future change

Context Compression
* App version is 1.1.0
* UserTable includes username column
* Edit password field uses ******** as a masked unchanged sentinel
* Backend still stores bcrypt hashes only; raw passwords are not recoverable
