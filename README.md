# crux-spike-opus55

Silent 86-second, 1080p/30 explainer segment: **Buying mortgage points: how long must we keep the home to break even?** It is US-only, and every number on screen is computed in `src/` and traced in `claims.json`.

- `out/segment.mp4`: the segment
- `out/frame-{normal,extreme,missing}.png`: the same layout under three datasets
- `claims.json`, `script.md`, `REPORT.md`: evidence, script and narration, and the spike report

```
npm install && pip install imageio-ffmpeg
npm run all   # tests → layout checks → render → export claims/script
```
