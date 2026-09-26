#!/usr/bin/env bash
# Voice pacing loop: TTS -> raw ASR -> sentence retime -> final ASR -> pace check. Scenes whose
# sentences stay above 175 wpm even at the 25% stretch limit get a new TTS take (max 3 rounds).
set -e
cd "$(dirname "$0")/.."
for round in 1 2 3 4; do
  python3 audio/av_tts.py | tail -1
  ASR_STAGE=raw python3 audio/av_asr.py > /dev/null 2>&1
  PACE_STAGE=raw node src/av/pace.js > /dev/null || true
  python3 audio/av_retime.py
  ASR_STAGE=final python3 audio/av_asr.py > /dev/null 2>&1
  if node src/av/pace.js > /tmp/pace.txt; then echo "pace ok after round $round"; cat /tmp/pace.txt; exit 0; fi
  cat /tmp/pace.txt
  [ "$round" = 4 ] && exit 1
  node -e "
    const fs=require('fs');const p=require('./out/voice/pace.json');const f='out/voice/takes.json';
    const t=fs.existsSync(f)?JSON.parse(fs.readFileSync(f)):{};
    const bad=[...new Set([...p.fastSentences.map(s=>s.scene),...p.droppedWords.map(r=>r.scene)])];
    for(const s of bad)t[s]=(t[s]||0)+1;fs.writeFileSync(f,JSON.stringify(t,null,1));console.log('new takes:',bad.join(' '));"
done
