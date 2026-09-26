'use strict';
// Muxes the picture with the mixed audio: H.264 + AAC 48 kHz stereo -> out/segment.mp4.
const path = require('path');
const { execFileSync } = require('child_process');
const FF = execFileSync('python3', ['-c', 'import imageio_ffmpeg as f; print(f.get_ffmpeg_exe())']).toString().trim();
const OUT = path.join(__dirname, '..', 'out');
execFileSync(FF, ['-y', '-loglevel', 'error', '-i', path.join(OUT, '.video-only.mp4'), '-i', path.join(OUT, 'audio', 'mix.wav'),
  '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2', '-shortest', '-movflags', '+faststart', path.join(OUT, 'segment.mp4')]);
console.log('wrote out/segment.mp4');
