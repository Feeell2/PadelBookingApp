## Description

<!-- Describe what this PR changes and why -->

## Type of Change

- [ ] Feature (new functionality)
- [ ] Fix (bug fix)
- [ ] Chore (dependencies, refactoring, documentation)
- [ ] Hotfix (critical production fix)

## Changes Made

<!-- List the main changes -->
-
-
-

## Testing

<!-- Describe how you tested these changes -->

- [ ] Tested locally (backend + frontend)
- [ ] Manual testing completed
- [ ] No errors in browser console
- [ ] No errors in backend logs

## Pre-merge Checklist

### Backend
- [ ] `npm run build` passes without errors
- [ ] TypeScript types are correctly defined
- [ ] Import paths use `.js` extension (ES Modules requirement)
- [ ] Environment variables documented (if new ones added)
- [ ] No `console.log` statements (except debug logging)

### Frontend
- [ ] `npm run build` passes without errors
- [ ] `npm run lint` passes
- [ ] Semantic CSS classes used (no Tailwind utility classes)
- [ ] No `console.log` statements in production code
- [ ] Components are responsive

### General
- [ ] Commit messages follow convention (`feat:`, `fix:`, etc.)
- [ ] No sensitive data (API keys, secrets) in code
- [ ] `.env` files not committed
- [ ] Changes don't break existing functionality
- [ ] Documentation updated if needed (`CLAUDE.md`, `README.md`)

## Screenshots (if applicable)

<!-- Add screenshots for UI changes -->

## Related Issues

<!-- Reference any related issues: Fixes #123, Closes #456 -->

## Additional Notes

<!-- Any additional context, deployment notes, or follow-up tasks -->
