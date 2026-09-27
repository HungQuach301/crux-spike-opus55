#!/usr/bin/env bash
# Test D M3 fix round 2, after the scene renders (src/d/m3-splice.js render ...): splice the new scenes into the master
# picture, remux the round-1 sound (unchanged; cut to the picture's exact length), verify frame count and A/V length,
# then the full checks (page sampler on the whole film + every rule), with the preview and frame-change measure alongside.
set -euo pipefail
cd "$(dirname "$0")/../.."
R=out/m3/root
node src/d/m3-splice.js splice
NF=$(ffprobe -v error -count_packets -select_streams v -show_entries stream=nb_read_packets -of csv=p=0 out/m3/picture.mp4)
DUR=$(python3 -c "print(f'{$NF/30:.6f}')")
ffmpeg -y -loglevel error -i out/m3/picture.mp4 -i $R/out/audio/master.wav -map 0:v -map 1:a -c:v copy -af "atrim=0:$DUR,asetpts=N/SR/TB" -c:a aac -b:a 320k -ar 48000 -ac 2 -t $DUR -video_track_timescale 15360 -movflags +faststart $R/out/video.mp4
# sync / length check: video frames, video and audio stream durations and start times
python3 - "$R/out/video.mp4" "$NF" <<'EOF' | tee out/m3/sync-r2.json
import json, subprocess, sys
f, nf = sys.argv[1], int(sys.argv[2])
p = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-count_packets', '-show_entries', 'stream=codec_type,start_time,duration,nb_read_packets,r_frame_rate', '-of', 'json', f]))
v = [s for s in p['streams'] if s['codec_type'] == 'video'][0]; a = [s for s in p['streams'] if s['codec_type'] == 'audio'][0]
out = {'videoFrames': int(v['nb_read_packets']), 'pictureFrames': nf, 'expectedFrames': 21180, 'videoStart': float(v['start_time']), 'audioStart': float(a['start_time']),
       'videoDuration': float(v['duration']), 'audioDuration': float(a['duration'])}
out['avDurationDiffMs'] = round(1000 * (out['audioDuration'] - out['videoDuration']), 1)
out['ok'] = out['videoFrames'] == nf == 21180 and abs(out['avDurationDiffMs']) <= 25 and abs(out['audioStart'] - out['videoStart']) < 0.001
print(json.dumps(out))
sys.exit(0 if out['ok'] else 1)
EOF
cp $R/out/captions.srt out/m3/captions.srt
# preview + frame-change measure in parallel with the checks
( ffmpeg -y -loglevel error -i $R/out/video.mp4 -c:v libx264 -preset medium -b:v 2500k -maxrate 3000k -bufsize 6000k -pix_fmt yuv420p -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv -c:a aac -b:a 160k -movflags +faststart out/m3/video.mp4
  python3 src/d/frame-change.py $R/out/video.mp4 --json out/m3/frame-change.json ) > out/m3/preview-r2.log 2>&1 &
PREV=$!
rm -rf $R/out/checks/page.json
PYTHONDONTWRITEBYTECODE=1 checks/run.sh $R > out/m3/checks-run-r2.log 2>&1; echo CHECKS $? >> out/m3/checks-run-r2.log
wait $PREV; echo PREVIEW $? >> out/m3/checks-run-r2.log
date -u >> out/m3/checks-run-r2.log
