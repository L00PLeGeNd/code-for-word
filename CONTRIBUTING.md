# Contributing · 参与码文

Thanks for helping **Code for Word / 码文**. The product promise is simple: **paste highlighted code into Word and keep the frame**. Optional text/paper mode is a bonus — don’t break the code path for it.

## Before you start

1. Use Node 18+.
2. `npm install` → `npm test` → `npm run dev`.
3. For paste/RTF/DOCX changes, say whether you checked **Microsoft Word** and/or **WPS**, and prefer **Keep Source Formatting** when pasting.

## What we welcome

- Bug fixes for paste, margins, frames, captions, line numbers
- Clear repro steps (Word vs WPS, version, code/text mode, options used)
- Docs / i18n / UI polish that doesn’t change export behavior by accident
- Small, focused PRs (easier to review than one huge squash)

## What to avoid

- Drive-by refactors with no behavior change explained
- New cloud services or always-on network calls (translation stays **opt-in**)
- Expanding “auto-detect” without hard guards — false positives hurt more than missing a feature

## PR checklist

- [ ] `npm test` passes
- [ ] If you touched `src/lib/rtf.js`, `docx.js`, or `word-html.js`, add or update a unit test
- [ ] README / zh README updated only when user-facing behavior changes
- [ ] No Cursor / AI co-author trailers in commit messages (keep history clean)

## Talk to us

- Questions & tips: [Discussions](https://github.com/L00PLeGeNd/code-for-word/discussions)
- Bugs: [Issues](https://github.com/L00PLeGeNd/code-for-word/issues/new/choose)
- China mirror: [Gitee](https://gitee.com/loopisme/code-for-word)

Share blurbs: [docs/share.md](./docs/share.md)
