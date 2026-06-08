<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project status — READ FIRST

**`PROJECT_STATUS.md`** is the single source of truth for what this project is, which modules
exist, which SQL migrations have been written, and the changelog/roadmap. Read it at the start
of every session.

**Maintenance loop (do this without being asked):** whenever you finish a module, add a
migration, or make a couple of meaningful edits — and always before the session ends — update
`PROJECT_STATUS.md` (Modules table, SQL list, Changelog newest-first, Roadmap). Keep it accurate.

**Hard rule:** never bulk-edit source files with PowerShell `Set-Content`/`Out-File` — it
corrupts emojis/special chars into mojibake. Use the Edit/Write tools only.
