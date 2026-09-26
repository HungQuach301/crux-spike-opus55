'use strict';
// Muxes test C: 1080p30 H.264 picture + mastered audio (AAC 48 kHz stereo) -> out/video.mp4.
// Subtitles ship as a sidecar (out/captions.srt) and as a soft mov_text track.
const path = require('path');
const { execFileSync } = require('child_process');
const OUT = path.join(__dirname, '..', 'out');
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(OUT, '.video-only.mp4'), '-i', path.join(OUT, 'audio', 'master.wav'), '-i', path.join(OUT, 'captions.srt'),
  '-map', '0:v:0', '-map', '1:a:0', '-map', '2:s:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2', '-c:s', 'mov_text', '-metadata:s:s:0', 'language=eng',
  '-movflags', '+faststart', path.join(OUT, 'video.mp4')]);
console.log('wrote out/video.mp4');
