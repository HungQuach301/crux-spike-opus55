'use strict';
// Test D render page: state at time t (scene builder + camera), full frames for the exporter, and the checks contract
// window.CHECKS {seek, freeze, objects, layer} (checks/CONTRACT.md §Page). seek(t) renders the same frame as the video
// (8 subframes when anything moves), before the post grade/grain applied by the encoder.
(function () {
  const D = window.DATA, E = window.ENGINE, SC = window.SCENES, CAMS = window.CAMS;
  const scenes = D.timeline.scenes;
  const sceneAt = (t) => scenes.find((s) => t >= s.start && t < s.start + s.dur) || scenes[scenes.length - 1];
  const bgOf = (act) => D.tokens.colors[{ 'cold-open': 'bg-cold', ident: 'bg-cold', act1: 'bg-act1', act2: 'bg-act2-early', act3: 'bg-act3', method: 'bg-method', outro: 'bg-outro' }[act] || 'bg'].toLowerCase();
  const turnLocal = (sc) => { const tr = (D.timeline.turns || []).find((x) => x.scene === sc.id.replace(/-[bc]$/, '')); return tr ? tr.t - sc.start : undefined; };
  let frozen = null;
  function cameraFor(t) {
    const sc = sceneAt(t);
    return CAMS.cameraAt(sc.id, t - sc.start, sc.dur, turnLocal(sc));
  }
  function stateAt(t) {
    const sc = sceneAt(t);
    const cam = frozen !== null && sceneAt(frozen).id === sc.id ? cameraFor(frozen) : cameraFor(t);
    const camObj = E.camera(cam);
    const H = { P: (x, y, z) => camObj.project([x, y, z]), local: (abs) => abs - sc.start, sceneStartOf: (id) => (scenes.find((s) => s.id === id) || sc).start };
    // a split shot (-b/-c) without its own builder continues its parent scene's animation
    const parent = scenes.find((s) => s.id === sc.id.replace(/-[bc]$/, '')) || sc;
    const own = SC.B[sc.id];
    const build = own || SC.B[parent.id];
    if (!build) throw new Error('no builder for ' + sc.id);
    const items = own ? build(t - sc.start, sc, H) : build(t - parent.start, parent, { ...H, local: (abs) => abs - parent.start });
    const sig = JSON.stringify(items.map((it) => it.kind === 'text' ? [it.id, it.text, it.x, it.y, it.alpha] : [it.id, it.pts, it.rect, it.c, it.r, it.alpha]));
    return { camera: cam, bg: { color: bgOf(sc.act) }, items, sig, scene: sc.id };
  }
  let cur = { t: 0, objs: [] };
  function seek(t) {
    E.MODE.name = 'all'; E.MODE.ids = null;
    const r = E.frame(stateAt, t, { subframes: D.subframes || 8 });
    cur = { t, objs: r.objs, cam: r.cam };
    return r.rendered;
  }
  window.CHECKS = {
    seek,
    freeze: (t) => { frozen = t; },
    objects: () => cur.objs,
    layer: (name, ids) => {
      E.MODE.name = name || 'all';
      E.MODE.ids = ids && ids.length ? new Set(ids) : null;
      if (name === 'all') { E.MODE.ids = null; seek(cur.t); return; }
      E.frame(stateAt, cur.t, { subframes: 1 });
      E.MODE.name = 'all';
    },
  };
  window.RENDER = {
    stateAt, sceneAt, cameraFor,
    frameB64: (t) => { const n = seek(t); return { b64: E.rgbaB64(), rendered: n, objs: cur.objs.length }; },
    camera: (t) => { const c = cameraFor(t); const cam = E.camera(c); return { t, pos: c.pos, target: c.target, fovDeg: c.fovDeg, focusDist: c.focusDist, coc: +cam.coc(cam.depth([c.target[0], c.target[1], 2600])).toFixed(3) }; },
  };
  document.body.appendChild(E.canvas);
})();
