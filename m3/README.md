# Test D M3 master (not a preview)

`video.mp4` = 1528861420 bytes, SHA-256 `dd6117c66fa66dffbba6ea59fb67eaa670e9f278023f8563f1d374910ffb089a`, from branch claude/opus55-cine-phase-d-jw6me1 (out/m3/root/out/video.mp4).

Rebuild and verify:

    cat m3/video.mp4.part-* > video.mp4
    sha256sum -c m3/parts.sha256        # each part
    echo "dd6117c66fa66dffbba6ea59fb67eaa670e9f278023f8563f1d374910ffb089a  video.mp4" | sha256sum -c   # the whole file
