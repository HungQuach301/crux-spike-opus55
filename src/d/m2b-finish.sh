#!/usr/bin/env bash
# Test D M2b after the lookdev picture render: sfx events + render log, sound (incl. physical sounds), mux, deliverable,
# measured tension map, frame-change measure, style frames.
set -euo pipefail
cd "$(dirname "$0")/../.."
R=out/m2b/root
node src/d/m2b-glue.js post
PYTHONDONTWRITEBYTECODE=1 python3 audio/d_m2_audio.py $R
# contract master: H.264 20 Mbps picture + AAC-LC 48 kHz stereo 320 kb/s
ffmpeg -y -loglevel error -i out/m2b/picture.mp4 -i $R/out/audio/master.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 320k -ar 48000 -ac 2 -shortest -video_track_timescale 15360 -movflags +faststart $R/out/video.mp4
# deliverable in git (< 100 MB): same picture re-encoded at 14 Mbps, same sound
ffmpeg -y -loglevel error -i $R/out/video.mp4 -c:v libx264 -profile:v high -preset slow -tune grain -b:v 14M -maxrate 16M -bufsize 28M -pix_fmt yuv420p -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv -c:a copy -movflags +faststart out/m2b/lookdev.mp4
cp $R/out/captions.srt out/m2b/captions.srt
PYTHONDONTWRITEBYTECODE=1 python3 audio/d_tension.py $R
python3 src/d/frame-change.py out/m2b/lookdev.mp4 --json out/m2b/frame-change.json
rm -rf .frames/boards
node src/d/m2b-boards.js out/m2b/lookdev.mp4
ls -la $R/out/video.mp4 out/m2b/lookdev.mp4
