# M3 preview after fix round 2 (2.5 Mbps, 236087907 bytes)

GitHub refuses files over 100 MB, so the preview is split:

    cat out/m3/preview/video.mp4.part-* > video.mp4
    echo "1a1e236122b7f200aa2583a8d40de78e3c8668262db6bf84d81309ea81bb74eb  video.mp4" | sha256sum -c

The master (17 Mbps) is on branch media/opus55-cine-phase-d-m3 (m3/README.md).
