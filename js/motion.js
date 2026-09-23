/**
 * Animaciones visuales del hero (canvas). Sin dependencias.
 * “Video de fondo” del producto en paleta verde SimplexLab.
 */

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Fondo amplio del hero */
export function startHeroCanvas(canvas) {
  if (!canvas || prefersReducedMotion()) return () => {};
  const ctx = canvas.getContext('2d');
  let raf = 0;
  let w = 0;
  let h = 0;
  let t = 0;
  const particles = Array.from({ length: 42 }, () => ({
    x: Math.random(),
    y: Math.random(),
    r: 1 + Math.random() * 2.4,
    s: 0.12 + Math.random() * 0.4,
    a: 0.18 + Math.random() * 0.4,
  }));

  const resize = () => {
    const parent = canvas.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = Math.max(1, Math.floor(rect.width));
    h = Math.max(1, Math.floor(rect.height));
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const draw = () => {
    t += 0.008;
    ctx.clearRect(0, 0, w, h);

    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, 'rgba(233, 248, 231, 0.45)');
    g.addColorStop(0.5, 'rgba(192, 230, 185, 0.18)');
    g.addColorStop(1, 'rgba(78, 166, 116, 0.12)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // Aurora orbs
    const orbs = [
      { x: 0.78 + Math.sin(t * 0.7) * 0.04, y: 0.28 + Math.cos(t * 0.5) * 0.05, r: 0.22, c: 'rgba(78, 166, 116, 0.22)' },
      { x: 0.62 + Math.cos(t * 0.4) * 0.05, y: 0.62 + Math.sin(t * 0.6) * 0.04, r: 0.18, c: 'rgba(2, 51, 55, 0.12)' },
      { x: 0.88 + Math.sin(t * 0.55) * 0.03, y: 0.72 + Math.cos(t * 0.45) * 0.04, r: 0.14, c: 'rgba(192, 230, 185, 0.35)' },
    ];
    orbs.forEach((o) => {
      const grd = ctx.createRadialGradient(o.x * w, o.y * h, 0, o.x * w, o.y * h, o.r * Math.min(w, h));
      grd.addColorStop(0, o.c);
      grd.addColorStop(1, 'transparent');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(o.x * w, o.y * h, o.r * Math.min(w, h), 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.strokeStyle = 'rgba(2, 51, 55, 0.07)';
    ctx.lineWidth = 1;
    const gap = 44;
    const ox = (t * 18) % gap;
    for (let x = -gap + ox; x < w + gap; x += gap) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = -gap + ox; y < h + gap; y += gap) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    particles.forEach((p) => {
      p.y -= p.s * 0.002;
      if (p.y < -0.05) {
        p.y = 1.05;
        p.x = Math.random();
      }
      ctx.beginPath();
      ctx.fillStyle = `rgba(78, 166, 116, ${p.a})`;
      ctx.arc(p.x * w, p.y * h, p.r, 0, Math.PI * 2);
      ctx.fill();
    });

    raf = requestAnimationFrame(draw);
  };

  resize();
  draw();
  window.addEventListener('resize', resize);
  const ro = typeof ResizeObserver !== 'undefined'
    ? new ResizeObserver(() => resize())
    : null;
  if (ro && canvas.parentElement) ro.observe(canvas.parentElement);
  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
    if (ro) ro.disconnect();
  };
}

/** Demo dentro del marco (camino Simplex animado) */
export function startDemoCanvas(canvas) {
  if (!canvas) return () => {};
  const body = canvas.closest('.demo-body');
  if (prefersReducedMotion()) {
    if (body) body.classList.add('is-static');
    return () => {};
  }
  if (body) body.classList.remove('is-static');

  const ctx = canvas.getContext('2d');
  let raf = 0;
  let w = 0;
  let h = 0;
  let t = 0;

  const verts = [
    { x: 0.14, y: 0.78 },
    { x: 0.14, y: 0.26 },
    { x: 0.46, y: 0.36 },
    { x: 0.78, y: 0.78 },
  ];
  const path = [verts[0], verts[1], verts[2]];

  const resize = () => {
    // El wrap fija el alto; no usar el body completo (evita crecer sin control en móvil)
    const box = canvas.parentElement;
    if (!box) return;
    const rect = box.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = Math.max(1, Math.floor(rect.width));
    h = Math.max(1, Math.floor(rect.height));
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const px = (v) => v.x * w;
  const py = (v) => v.y * h;

  const draw = () => {
    t += 0.014;
    ctx.clearRect(0, 0, w, h);

    const bg = ctx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, '#e9f8e7');
    bg.addColorStop(0.5, '#f7fdf6');
    bg.addColorStop(1, '#c0e6b9');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(2, 51, 55, 0.08)';
    ctx.lineWidth = 1;
    const gap = 28;
    for (let x = 0; x < w; x += gap) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y < h; y += gap) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    ctx.strokeStyle = '#5a9a72';
    ctx.lineWidth = 1.75;
    ctx.beginPath();
    ctx.moveTo(w * 0.08, h * 0.12);
    ctx.lineTo(w * 0.08, h * 0.86);
    ctx.lineTo(w * 0.92, h * 0.86);
    ctx.stroke();

    ctx.beginPath();
    verts.forEach((v, i) => {
      if (i === 0) ctx.moveTo(px(v), py(v));
      else ctx.lineTo(px(v), py(v));
    });
    ctx.closePath();
    ctx.fillStyle = 'rgba(78, 166, 116, 0.35)';
    ctx.fill();
    ctx.strokeStyle = '#023337';
    ctx.lineWidth = 2.25;
    ctx.stroke();

    const seg = Math.floor(t) % (path.length - 1);
    const local = t % 1;
    const a = path[seg];
    const b = path[seg + 1];
    const cx = a.x + (b.x - a.x) * local;
    const cy = a.y + (b.y - a.y) * local;

    ctx.strokeStyle = '#1a6b75';
    ctx.lineWidth = 2.75;
    ctx.setLineDash([7, 5]);
    ctx.beginPath();
    path.forEach((v, i) => {
      if (i === 0) ctx.moveTo(px(v), py(v));
      else ctx.lineTo(px(v), py(v));
    });
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.beginPath();
    ctx.fillStyle = 'rgba(78, 166, 116, 0.28)';
    ctx.arc(cx * w, cy * h, 16 + Math.sin(t * 3) * 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.fillStyle = '#023337';
    ctx.arc(cx * w, cy * h, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.fillStyle = '#e9f8e7';
    ctx.arc(cx * w, cy * h, 3.2, 0, Math.PI * 2);
    ctx.fill();

    const opt = path[path.length - 1];
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(78, 166, 116, 0.55)';
    ctx.lineWidth = 2;
    ctx.arc(px(opt), py(opt), 14 + Math.sin(t * 2.2) * 4, 0, Math.PI * 2);
    ctx.stroke();

    raf = requestAnimationFrame(draw);
  };

  resize();
  draw();
  window.addEventListener('resize', resize);
  const ro = typeof ResizeObserver !== 'undefined'
    ? new ResizeObserver(() => resize())
    : null;
  if (ro && canvas.parentElement) ro.observe(canvas.parentElement);
  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
    if (ro) ro.disconnect();
  };
}
