# crux-spike-opus55

Capability spikes for a US personal-finance data-analysis channel. All numbers are computed in code and traced to claims.

## Test C (this branch, `spike/opus55-av`): full video with voice

A 6:04 video in 5 chapters with TTS narration (sentence-level pacing), per-lot capital-gains tax
(NIIT in the 32% bracket), a voice-driven timeline, 12 machine-checked composition rules,
subtitles, a -14 LUFS master and packaging. Report: `out/report.md`.

- `out/video.mp4`, `out/captions.srt`: the video (1080p30 H.264, AAC 48 kHz) and subtitles
- `out/conventions.md`: tokens, series colours, shot sizes, counter rules, pronunciation dictionary
- `claims.json`: every number shown or spoken; `out/script.md`: narration with timings
- `out/rules-b.json` / `out/rules-c.json`: the composition rules run on test B and on test C
- `out/asr-numbers.json`, `out/number-sync.json`, `out/audio-metrics.json`, `out/motion-metrics.json`, `out/captions-check.json`, `out/voice/pace.json`
- `out/package/`: title, description, thumbnail

Code layout:
- `src/av/`: per-lot tax model, claims, script, text normalizer, voice-driven timeline, subtitles, ASR checks
- `render-av/`: renderer (test B's canvas + camera), composition rules, checker, exporter
- `audio/av_*.py`: TTS, faster-whisper word timings, mix (test B's generator + voice + sidechain + master), measurements

```
npm install && pip install numpy scipy faster-whisper requests
npm run av:all
npm run av:rules-b
```

Test B's deliverables moved to `out/b/` (their code is unchanged in `render-motion/`, `src/car/`).

## Spike 2: car loan early payoff vs investing, with motion and sound

A 127.8 s, 1080p/30 segment with procedural audio.

- `out/b/segment.mp4`: picture + AAC 48 kHz stereo mix
- `out/b/contact-sheet.png`, `out/b/keyframes/`: stills
- `out/b/motion-metrics.json`, `out/b/audio-metrics.json`, `out/b/music-ledger.json`: measured limits
- `out/b/claims.json`, `out/b/script.md`: evidence, and narration for TTS
- `REPORT.md`: report and self-score

Code layout:
- `src/car/`: model, claims, shared timeline, narration
- `render-motion/`: canvas + camera renderer, checker, exporter
- `audio/`: DSP generator, BS.1770 meter, measurements

```
npm install && pip install imageio-ffmpeg numpy scipy
npm run motion:all
```

## Spike 1: mortgage points break-even

See `REPORT-spike1.md`; that code lives in `src/calc.js`, `src/data.js` and `render/`. Branch `spike/opus55` holds its deliverables.
