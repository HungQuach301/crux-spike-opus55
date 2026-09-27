# Test D M3 master (not a preview)

`video.mp4` = 1528397839 bytes, SHA-256 `569def46b7460053269084732b04c48a1f516ce7ff2998e3d96751c4c2cc586b`, from branch claude/opus55-cine-phase-d-jw6me1 (out/m3/root/out/video.mp4).

Rebuild and verify:

    cat m3/video.mp4.part-* > video.mp4
    sha256sum -c m3/parts.sha256        # each part
    echo "569def46b7460053269084732b04c48a1f516ce7ff2998e3d96751c4c2cc586b  video.mp4" | sha256sum -c   # the whole file
