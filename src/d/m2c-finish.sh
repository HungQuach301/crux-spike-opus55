#!/usr/bin/env bash
# Test D M2c animatic after the picture: sound (voice, music, physical sounds ducked under the voice), mux, ASR of numbers.
set -euo pipefail
cd "$(dirname "$0")/../.."
PYTHONDONTWRITEBYTECODE=1 python3 audio/d_m2_audio.py out/m2c/root
ffmpeg -y -loglevel error -i out/m2c/animatic-picture.mp4 -i out/m2c/root/out/audio/master.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k -ar 48000 -ac 2 -shortest -movflags +faststart out/m2c/animatic.mp4
PYTHONDONTWRITEBYTECODE=1 python3 src/d/m2c-asr.py out/m2c/animatic.mp4
ls -la out/m2c/animatic.mp4
