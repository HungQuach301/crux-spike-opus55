# M3 preview (2.5 Mbps, 236208861 bytes)

GitHub refuses files over 100 MB, so the preview is split:

    cat out/m3/preview/video.mp4.part-* > video.mp4
    echo "fecb764f8c2cd6d9d82b6caaea46bb51924b780fa62b50efb086851ccd481b49  video.mp4" | sha256sum -c
