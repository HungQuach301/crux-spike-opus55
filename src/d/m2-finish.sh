#!/usr/bin/env bash
# Test D M2 after the picture render: sfx events + render log, sound, mux, preview, checks.
set -euo pipefail
cd "$(dirname "$0")/../.."
R=out/m2/root
node src/d/m2-glue.js post
PYTHONDONTWRITEBYTECODE=1 python3 audio/d_m2_audio.py $R
# master mux: H.264 picture (already graded/encoded) + AAC-LC 48 kHz stereo 320 kb/s
ffmpeg -y -loglevel error -i out/m2/picture.mp4 -i $R/out/audio/master.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 320k -ar 48000 -ac 2 -shortest -video_track_timescale 15360 -movflags +faststart $R/out/video.mp4
# preview small enough for git (< 100 MB): same picture and sound at a lower bitrate
ffmpeg -y -loglevel error -i $R/out/video.mp4 -c:v libx264 -preset medium -b:v 2600k -maxrate 3000k -bufsize 6000k -pix_fmt yuv420p -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv -c:a aac -b:a 192k -movflags +faststart out/m2/video.mp4
cp $R/out/captions.srt out/m2/captions.srt
ls -la $R/out/video.mp4 out/m2/video.mp4
