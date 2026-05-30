Audit git worktrees and safely remove stale ones. A worktree is a temporary
scratch copy of the repo (usually created by an agent) living under
`.claude/worktrees/`. Leftover worktrees clutter search results and can trick a
later session into editing an old copy. This command finds them, judges whether
each still matters, and deletes the ones that are safe to remove.

Run these steps:

1. List every worktree with `git worktree list`. The main checkout (this repo
   root, on `main`) is NOT a worktree to touch — only consider entries under
   `.claude/worktrees/`. If there are none, report "No agent worktrees — nothing
   to clean up" and stop.

2. For EACH worktree under `.claude/worktrees/`, gather:
   - Its branch name and tip commit.
   - Uncommitted changes: `git -C <worktree-path> status -s`
   - Commits it has that `main` does not: `git log --oneline main..<branch>`

3. Classify each worktree:
   - **SAFE to delete** — no uncommitted changes AND `git log main..<branch>` is
     empty (everything it holds is already on main, or it's just an old copy).
   - **NEEDS REVIEW** — it has uncommitted changes OR unique commits not on main.
     For these, briefly inspect what the unique work is (`git show <commit> --stat`,
     or `git -C <path> diff --stat`) and judge whether main already supersedes it.
     Often main is newer and the worktree's "unique" work is an older, abandoned
     attempt — say so plainly.

4. Present a short table: worktree, classification, one-line reason.

5. Delete the SAFE ones automatically:
   ```
   git worktree unlock <path>            # in case it's locked; ignore errors
   git worktree remove --force <path>
   git branch -D <branch>
   ```
   For NEEDS REVIEW worktrees, do NOT delete — ask the user first, summarizing
   what would be lost.

6. Also check whether any worktree path got accidentally committed into main as a
   gitlink: `git ls-files | grep worktrees`. If so, `git rm --cached -r <path>`
   those entries so they stop polluting status. (`.claude/worktrees/` should be
   gitignored — if it isn't, add it.)

7. Report the final `git worktree list` and what was removed vs. kept. Do not
   push or commit unless the user asks.
