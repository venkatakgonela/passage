# Manual release checklist

Version 0.1.0 is prepared, **not a claim that a tag, hosted release or public repository exists**. Only the maintainer performs these steps after reviewing the local branch. Commands below are comments for reference; no script runs them.

- [ ] Review the diff and local/fresh-clone evidence. Run tests, lint, browser checks and pre-publish scan. Confirm tested-platform claims; Windows, Firefox and Safari remain untested.
- [ ] Merge the reviewed changes and push only with explicit authorization. Confirm hosted checks are green on the chosen release commit.
- [ ] Set description/topics. Inspect the repository settings and upload `docs/images/hero.png` as a social preview (GitHub Settings → General → Social preview; no supported CLI upload is assumed).

```sh
# gh repo edit venkatakgonela/passage --description "Local read-only Markdown reader for technical document sets" --add-topic markdown --add-topic documentation --add-topic local-first --add-topic python --add-topic javascript
```

- [ ] Inspect Security → vulnerability reporting. Enable private vulnerability reporting as soon as repository visibility permits it. If unavailable on the private repository, make the visibility change only in the controlled launch window, then immediately enable and verify reporting **before announcing or distributing the release**. Check that Security → Report a vulnerability actually works for another account. Do not claim the setting is enabled merely because SECURITY.md exists.

```sh
# gh api repos/venkatakgonela/passage/private-vulnerability-reporting
# gh api --method PUT repos/venkatakgonela/passage/private-vulnerability-reporting
```

- [ ] Inspect the media contact sheet, probe/decode both formats and verify byte limits. Confirm no personal document text or private filesystem paths. Choose the exact reviewed commit and recheck version/notes.
- [ ] Create an annotated tag on that commit, push the tag, and create a draft release with the video attached. Replace `<reviewed-commit>` with the verified commit ID; never tag an unreviewed moving branch by accident.

```sh
# git tag -a v0.1.0 <reviewed-commit> -m "Passage 0.1.0"
# git push origin v0.1.0
# gh release create v0.1.0 docs/media/passage-demo.mp4 --repo venkatakgonela/passage --verify-tag --draft --title "Passage 0.1.0" --notes-file docs/release-notes-0.1.0.md
```

- [ ] Deliberately decide visibility; review GitHub's warnings about public history, forks, Actions logs and attached assets. Nothing in this checklist authorizes changing visibility automatically.

```sh
# gh repo edit venkatakgonela/passage --visibility public --accept-visibility-change-consequences
```

- [ ] Verify private reporting, social preview, topics, anonymous clone/ZIP, README links, workflow badge and media playback on GitHub. Then publish the draft and announce only if every required check passed.

```sh
# gh release edit v0.1.0 --repo venkatakgonela/passage --draft=false
```

CLI commands were checked against installed help; the reporting endpoint follows GitHub's repository API. Hosted permissions and available settings must be rechecked at execution time. References: [repository editing](https://cli.github.com/manual/gh_repo_edit), [release creation](https://cli.github.com/manual/gh_release_create), [private reporting API](https://docs.github.com/en/rest/repos/repos#enable-private-vulnerability-reporting-for-a-repository).
