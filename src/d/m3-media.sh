#!/usr/bin/env bash
# Test D M3: publish the master (>= 16 Mbps) as parts < 95 MB on an orphan media branch, with SHA-256 of the whole file
# and of every part, and how to rebuild it. (The GitHub tools of this session cannot upload Release assets.)
set -euo pipefail
cd "$(dirname "$0")/../.."
SRC=out/m3/root/out/video.mp4
BR=media/opus55-cine-phase-d-m3
W=$(mktemp -d)
# a new master replaces the files in a new commit on the media branch (no history rewrite)
if git fetch -q origin "$BR" 2>/dev/null; then
  git worktree add --detach "$W" FETCH_HEAD >/dev/null; cd "$W"; git switch -q -C "$BR"
else
  git worktree add --detach "$W" HEAD >/dev/null; cd "$W"; git switch --orphan "$BR" >/dev/null
fi
git rm -rfq . >/dev/null 2>&1 || true
mkdir -p m3
split -b 95M -d -a 2 "$OLDPWD/$SRC" m3/video.mp4.part-
( cd m3 && sha256sum video.mp4.part-* > parts.sha256 )
FULL=$(sha256sum "$OLDPWD/$SRC" | cut -d' ' -f1)
SIZE=$(stat -c %s "$OLDPWD/$SRC")
cat > m3/README.md <<EOT
# Test D M3 master (not a preview)

\`video.mp4\` = $SIZE bytes, SHA-256 \`$FULL\`, from branch claude/opus55-cine-phase-d-jw6me1 (out/m3/root/out/video.mp4).

Rebuild and verify:

    cat m3/video.mp4.part-* > video.mp4
    sha256sum -c m3/parts.sha256        # each part
    echo "$FULL  video.mp4" | sha256sum -c   # the whole file
EOT
echo "$FULL  video.mp4" > m3/video.sha256
# the M3 stems (voice, music, sfx incl. the data sonification, whoosh, room; 48 kHz FLAC at mix level); files over
# 95 MB split like the master; SHA-256 of every file and every part. Added with -f: never blocked by an ignore rule.
STEMS="$OLDPWD/out/m3/root/out/audio/stems"
if [ -d "$STEMS" ]; then
  mkdir -p m3/stems
  for f in "$STEMS"/*.flac; do b=$(basename "$f")
    if [ "$(stat -c %s "$f")" -gt $((95*1024*1024)) ]; then split -b 95M -d -a 2 "$f" "m3/stems/$b.part-"; else cp "$f" "m3/stems/$b"; fi
    echo "$(sha256sum "$f" | cut -d' ' -f1)  $b" >> m3/stems/stems.sha256
  done
  ( cd m3/stems && sha256sum *.flac* > files.sha256 )
  printf '\nStems: `m3/stems/` (FLAC 48 kHz, at mix level). A split stem: `cat m3/stems/<name>.flac.part-* > <name>.flac`; whole-file SHA-256 in `m3/stems/stems.sha256`.\n' >> m3/README.md
fi
git add -f m3
git -c user.email="$(git -C "$OLDPWD" config user.email)" -c user.name="$(git -C "$OLDPWD" config user.name)" commit -qm "Test D M3 master${MSG:+ ($MSG)} in parts < 95 MB (SHA-256 per part and whole file)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019VjyzPVYE7if4FLwUDYa1m"
for i in 1 2 3 4; do git push -u origin "$BR" && break || sleep $((2 ** i)); done
cd "$OLDPWD"; git worktree remove --force "$W"
echo "media branch $BR: $(ls $W 2>/dev/null | wc -l) done; whole-file sha256 $FULL"
