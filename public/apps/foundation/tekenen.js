/* Herbruikbare teken-canvas voor zowel het schoolbord als het schrift.
   Werkt met muis, touch en pen (Pointer Events). Streken worden bewaard in een
   vaste virtuele ruimte (1280x720), zodat een streek van de docent bij elke
   leerling op exact dezelfde plek terechtkomt, ongeacht de schermgrootte. */
const VW = 1280, VH = 720;

class TekenBord {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.strokes = [];
    this.onStroke = opts.onStroke || null;   // callback bij een afgeronde streek
    this.readOnly = !!opts.readOnly;         // leerlingen kijken alleen naar het bord
    this.background = opts.background || '#0f1720';
    this.tool = 'pen';
    this.kleur = opts.kleur || '#ffffff';
    this.dikte = opts.dikte || 4;
    this.huidig = null;                       // streek die nu getekend wordt
    this._bind();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  _bind() {
    const c = this.canvas;
    c.style.touchAction = 'none';
    const pos = e => {
      const r = c.getBoundingClientRect();
      return [ (e.clientX - r.left) / r.width * VW, (e.clientY - r.top) / r.height * VH ];
    };
    c.addEventListener('pointerdown', e => {
      if (this.readOnly) return;
      c.setPointerCapture(e.pointerId);
      this.huidig = { id: Math.random().toString(16).slice(2, 8), tool: this.tool,
        kleur: this.kleur, dikte: this.dikte, points: [pos(e)] };
      this._tekenStreek(this.huidig, true);
    });
    c.addEventListener('pointermove', e => {
      if (!this.huidig) return;
      const p = pos(e);
      const laatste = this.huidig.points[this.huidig.points.length - 1];
      // sla piepkleine bewegingen over (vloeiender en minder data)
      if (Math.hypot(p[0] - laatste[0], p[1] - laatste[1]) < 1.2) return;
      this.huidig.points.push(p);
      this._tekenSegment(this.huidig);
    });
    const eind = () => {
      if (!this.huidig) return;
      const s = this.huidig; this.huidig = null;
      if (s.points.length === 1) s.points.push([s.points[0][0] + 0.1, s.points[0][1] + 0.1]); // een stip
      this.strokes.push(s);
      if (this.onStroke) this.onStroke(s);
    };
    c.addEventListener('pointerup', eind);
    c.addEventListener('pointercancel', eind);
    c.addEventListener('pointerleave', eind);
  }

  resize() {
    const c = this.canvas;
    const r = c.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = Math.max(1, Math.round(r.width * dpr));
    c.height = Math.max(1, Math.round(r.height * dpr));
    this.redraw();
  }

  _scale() { return this.canvas.width / VW; }

  _stroolStyle(s) {
    const ctx = this.ctx, sc = this._scale();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (s.tool === 'gum') { ctx.globalCompositeOperation = 'destination-out'; ctx.strokeStyle = 'rgba(0,0,0,1)'; ctx.lineWidth = s.dikte * 2.4 * sc; }
    else { ctx.globalCompositeOperation = 'source-over'; ctx.strokeStyle = s.kleur; ctx.globalAlpha = s.tool === 'marker' ? 0.4 : 1; ctx.lineWidth = s.dikte * sc; }
  }
  _tekenStreek(s) {
    const ctx = this.ctx, sc = this._scale();
    this._stroolStyle(s);
    ctx.beginPath();
    s.points.forEach((p, i) => { const x = p[0] * sc, y = p[1] * sc; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.stroke();
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }
  _tekenSegment(s) {
    const ctx = this.ctx, sc = this._scale(), n = s.points.length;
    if (n < 2) return;
    this._stroolStyle(s);
    ctx.beginPath();
    ctx.moveTo(s.points[n - 2][0] * sc, s.points[n - 2][1] * sc);
    ctx.lineTo(s.points[n - 1][0] * sc, s.points[n - 1][1] * sc);
    ctx.stroke();
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }

  redraw() {
    const ctx = this.ctx;
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ctx.fillStyle = this.background;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    for (const s of this.strokes) this._tekenStreek(s);
  }

  addStroke(s) { this.strokes.push(s); this._tekenStreek(s); }
  setStrokes(list) { this.strokes = Array.isArray(list) ? list.slice() : []; this.redraw(); }
  getStrokes() { return this.strokes; }
  clear() { this.strokes = []; this.redraw(); }
  undo() { this.strokes.pop(); this.redraw(); }
  leeg() { return this.strokes.length === 0; }

  // Een foto (dataURL) van het huidige beeld, om als bordfoto in het schrift te
  // bewaren. We tekenen op een eigen canvas met witte achtergrond voor afdrukken.
  fotoDataURL() { return this.canvas.toDataURL('image/png'); }
}

window.TekenBord = TekenBord;
window.KLAS_VW = VW; window.KLAS_VH = VH;
