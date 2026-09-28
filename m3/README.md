# Test D M3 master (not a preview)

`video.mp4` = 1529868450 bytes, SHA-256 `6531f6c8e1d11473251156875ad5631ecc2b6768517eab47d4ab8756735e3b62`, from branch claude/opus55-cine-phase-d-jw6me1 (out/m3/root/out/video.mp4).

Rebuild and verify:

    cat m3/video.mp4.part-* > video.mp4
    sha256sum -c m3/parts.sha256        # each part
    echo "6531f6c8e1d11473251156875ad5631ecc2b6768517eab47d4ab8756735e3b62  video.mp4" | sha256sum -c   # the whole file

Stems: `m3/stems/` (FLAC 48 kHz, at mix level). A split stem: `cat m3/stems/<name>.flac.part-* > <name>.flac`; whole-file SHA-256 in `m3/stems/stems.sha256`.
