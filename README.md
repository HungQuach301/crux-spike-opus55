# crux-spike-opus55

Two capability spikes for a US personal-finance data-analysis channel. All numbers are computed in code and traced to claims.

## Spike 2 (this branch): car loan early payoff vs investing, with motion and sound

A 127.8 s, 1080p/30 segment with procedural audio.

- `out/segment.mp4`: picture + AAC 48 kHz stereo mix
- `out/contact-sheet.png`, `out/keyframes/`: stills
- `out/motion-metrics.json`, `out/audio-metrics.json`, `out/music-ledger.json`: measured limits
- `claims.json`, `script.md`: evidence, and narration for TTS
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
