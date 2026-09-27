#!/usr/bin/env bash
# Test D M3 after the partial renders: merge -> (a) page sampler on a picture-only root, in parallel with (b) the sound,
# final mux, preview, tension map, frame-change -> python rules on the final master with the sampler's page.json.
set -euo pipefail
cd "$(dirname "$0")/../.."
R=out/m3/root; P=out/m3/root-pic
node src/d/m3-merge.js 0.000-203.019 203.019-706.010
rm -rf .frames/m3   # the parts are encoded into picture.mp4 now (disk allowance)
node src/d/m3-glue.js post
# (a) picture-only root for the page sampler (same files, video without sound)
rm -rf $P; mkdir -p $P/out
for f in $R/*; do [ "$(basename $f)" = out ] || ln -s "$(realpath $f)" $P/$(basename $f); done
for f in $R/out/*; do b=$(basename $f); [ "$b" = checks ] || [ "$b" = video.mp4 ] || ln -s "$(realpath $f)" $P/out/$b; done
ffmpeg -y -loglevel error -i out/m3/picture.mp4 -f lavfi -i anullsrc=r=48000:cl=stereo -map 0:v -map 1:a -c:v copy -c:a aac -b:a 128k -shortest -video_track_timescale 15360 $P/out/video.mp4
( NODE_PATH=node_modules node checks/page/sampler.js $P > out/m3/sampler.log 2>&1; echo SAMPLER $? >> out/m3/sampler.log ) &
SAMP=$!
# (b) sound, final master, preview, measures
./src/d/m3-finish.sh > out/m3/finish.log 2>&1; echo FINISH $?
wait $SAMP || true
mkdir -p $R/out/checks; cp $P/out/checks/page.json $R/out/checks/page.json
SKIP_PAGE=1 PYTHONDONTWRITEBYTECODE=1 checks/run.sh $R > out/m3/checks-run.log 2>&1; echo CHECKS $?
date -u
