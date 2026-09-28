#!/usr/bin/env bash
# Test D round 3: review clips for the owner (phone-friendly, each < 90 MB, not split) in out/r3/review/.
# Each clip: the passage from the round-2 master (BEFORE) then the same passage from the round-3 master (AFTER),
# labelled on screen, 1280x720 H.264 + AAC 192k.
#   src/d/r3-review.sh <before.mp4> <after.mp4> "<h5 silence times>" "<h7 sonification starts>" "<h7 music starts>"
set -euo pipefail
cd "$(dirname "$0")/../.."
B=$1; A=$2; SIL=$3; SON=$4; MUS=$5
O=out/r3/review; T=$(mktemp -d); mkdir -p $O
FONT=/etc/alternatives/fonts-japanese-gothic.ttf
seg() { # src start dur label out
  ffmpeg -y -loglevel error -ss "$2" -i "$1" -t "$3" -vf "scale=1280:720,drawtext=fontfile=$FONT:text='$4':x=24:y=24:fontsize=30:fontcolor=white:box=1:boxcolor=black@0.6:boxborderw=10" \
    -c:v libx264 -preset medium -b:v 3500k -maxrate 4000k -bufsize 8000k -pix_fmt yuv420p -r 30 -c:a aac -b:a 192k -ar 48000 -ac 2 "$5"
}
join() { # out parts...
  local out=$1; shift; : > $T/l.txt; for p in "$@"; do echo "file '$p'" >> $T/l.txt; done
  ffmpeg -y -loglevel error -f concat -safe 0 -i $T/l.txt -c copy -movflags +faststart "$out"
}
# H2: 0:20-0:55, before then after
seg $B 20 35 "BEFORE (round 2)  0\\:20-0\\:55" $T/h2a.mp4; seg $A 20 35 "AFTER (round 3)  0\\:20-0\\:55" $T/h2b.mp4
join $O/h2-rehook.mp4 $T/h2a.mp4 $T/h2b.mp4
# H5: three silences, each +-5 s, before/after
P=(); i=0; for t in $SIL; do s=$(python3 -c "print(max(0,$t-5))"); m=$(python3 -c "t=$t;print(f'{int(t//60)}\\\\:{t%60:04.1f}')")
  seg $B $s 10 "BEFORE  silence at $m" $T/s${i}a.mp4; seg $A $s 10 "AFTER  silence at $m" $T/s${i}b.mp4; P+=($T/s${i}a.mp4 $T/s${i}b.mp4); i=$((i+1)); done
join $O/h5-silences.mp4 "${P[@]}"
# H7a: the three busiest chart passages (10 s each), before/after
P=(); i=0; for t in $SON; do m=$(python3 -c "t=$t;print(f'{int(t//60)}\\\\:{t%60:04.1f}')")
  seg $B $t 10 "BEFORE  charts from $m" $T/c${i}a.mp4; seg $A $t 10 "AFTER  data sound from $m" $T/c${i}b.mp4; P+=($T/c${i}a.mp4 $T/c${i}b.mp4); i=$((i+1)); done
join $O/h7-sonification.mp4 "${P[@]}"
# H7b: two passages where the loop showed most (15 s each), before/after
P=(); i=0; for t in $MUS; do m=$(python3 -c "t=$t;print(f'{int(t//60)}\\\\:{t%60:04.1f}')")
  seg $B $t 15 "BEFORE  music from $m" $T/m${i}a.mp4; seg $A $t 15 "AFTER  music from $m" $T/m${i}b.mp4; P+=($T/m${i}a.mp4 $T/m${i}b.mp4); i=$((i+1)); done
join $O/h7-music.mp4 "${P[@]}"
rm -rf $T
ls -la $O
