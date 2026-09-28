# M3 preview after fix round 3 (2.5 Mbps, 236077733 bytes)

GitHub refuses files over 100 MB, so the preview is split:

    cat out/m3/preview/video.mp4.part-* > video.mp4
    echo "6b93a3bbf533c39f57d693ae8077dc23e2923d129d06bfefded60a616539ba48  video.mp4" | sha256sum -c

The master (17 Mbps) is on branch media/opus55-cine-phase-d-m3 (m3/README.md).
