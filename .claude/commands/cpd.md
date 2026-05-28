Commit, push, and deploy. Run in this order:
1. Stage all modified/new project files (excluding .claude/ internals)
2. Create a commit with an appropriate message based on the diff (run git status, git diff, and recent git log first)
3. Push to origin main
4. Trigger the Render deploy hook via `curl -s -X POST "$RENDER_DEPLOY_HOOK"`

Report the deploy ID when done.
