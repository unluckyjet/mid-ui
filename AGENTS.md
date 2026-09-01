<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Git delivery

After each user-requested project change is complete and verified, commit the
in-scope changes using Conventional Commits and push the current branch to its
configured `origin` upstream. Do not push when verification fails, secrets or
unrelated changes would be included, the push would overwrite remote history,
or the user explicitly asks to keep the work local.
