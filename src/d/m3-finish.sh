#!/usr/bin/env bash
# Test D M3 after the picture render: sfx events + render log, sound, mux (audio cut to the exact picture length),
# preview, captions, measured tension map, frame-change measure.
set -euo pipefail
cd "$(dirname "$0")/../.."
R=out/m3/root
node src/d/m3-glue.js post
PYTHONDONTWRITEBYTECODE=1 python3 audio/d_m2_audio.py $R
NF=$(ffprobe -v error -count_packets -select_streams v -show_entries stream=nb_read_packets -of csv=p=0 out/m3/picture.mp4)
DUR=$(python3 -c "print(f'{$NF/30:.6f}')")
# master: H.264 picture as encoded + AAC-LC 48 kHz stereo 320 kb/s, audio cut to the picture's length (F03)
ffmpeg -y -loglevel error -i out/m3/picture.mp4 -i $R/out/audio/master.wav -map 0:v -map 1:a -c:v copy -af "atrim=0:$DUR,asetpts=N/SR/TB" -c:a aac -b:a 320k -ar 48000 -ac 2 -t $DUR -video_track_timescale 15360 -movflags +faststart $R/out/video.mp4
# preview for git (2.5 Mbps)
ffmpeg -y -loglevel error -i $R/out/video.mp4 -c:v libx264 -preset medium -b:v 2500k -maxrate 3000k -bufsize 6000k -pix_fmt yuv420p -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv -c:a aac -b:a 160k -movflags +faststart out/m3/video.mp4
cp $R/out/captions.srt out/m3/captions.srt
PYTHONDONTWRITEBYTECODE=1 python3 audio/d_tension.py $R
python3 src/d/frame-change.py $R/out/video.mp4 --json out/m3/frame-change.json
ls -la $R/out/video.mp4 out/m3/video.mp4
