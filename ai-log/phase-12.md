Phase: 12 — Editable Username Field
Status: completed

Summary
* Added username editing to the team/admin edit row
* Backend now accepts username updates with the same normalization and validation as user creation
* Bumped app version to 1.1.1

Actions Performed
* frontend/src/components/UserTable.tsx: added username input to edit form
* frontend/src/components/UserTable.tsx: sends username in user update payload
* frontend/src/types/index.ts: added username to UserUpdate
* backend/app/modules/users/schema.py: added optional username validation to UserUpdate
* backend/app/modules/users/service.py: added duplicate username protection during updates
* frontend/package.json: bumped version from 1.1.0 to 1.1.1
* backend/app/main.py: mirrored metadata version 1.1.1

Architecture Impact
* Username edits go through the same lowercase/format rules as create user
* Duplicate usernames return 409 Conflict

New Capabilities
* Managers/admins/supervisors can edit a managed user's username from the edit row

Constraints
* Password edit remains masked-only because raw passwords are not stored

Next Step
* Continue bumping app version on every future change

Context Compression
* App version is 1.1.1
* User update payload supports username
* Username update validation and uniqueness checks live in backend users schema/service
