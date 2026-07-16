/* De tiener-tools (RTF Tiener, 12 t/m 15): een toetsplanner die het leren
   over de dagen spreidt, en een zakgeldpotje met spaardoelen. Alles is van het
   profiel zelf (p.tiener), blijft binnen het gezin en is dicht voor gasten.
   De planner is bewust een vaste, uitlegbare verdeler (geen AI nodig): per
   vaktype een andere leerroute, met een knipoog naar de Overhoren-tool. */

module.exports = ({ save, crypto }) => {

  const fout = (status, error) => ({ status, error });
  const schoon = (v, max) => String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, max);
  const DAG = 86400000;

  function bak(p) {
    if (!p.tiener) p.tiener = { toetsen: [], transacties: [], doelen: [] };
    return p.tiener;
  }
  function vandaag() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  const dagStr = ms => {
    const d = new Date(ms);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };
  const dagenTot = datum => Math.round((new Date(datum + 'T12:00:00') - new Date(vandaag() + 'T12:00:00')) / DAG);

  /* ---------- de toetsplanner ---------- */
  // per vaktype een eigen leerroute; de laatste stap is altijd rustig herhalen
  const ROUTES = [
    { her: /frans|engels|duits|spaans|nederlands|latijn|grieks|woordjes|taal/i, taken: [
      'Lees de woordjes en zinnen een keer rustig door',
      'Maak er een lijst van in Overhoren en oefen hem',
      'Oefen alleen je foutjes nog een keer',
      'Laat iemand je overhoren, of daag een vriend uit voor een duel',
      'Herhaal alles nog een keer en ga op tijd slapen'
    ] },
    { her: /wis|reken|natuur|schei|econom|somm/i, taken: [
      'Zet de formules en regels onder elkaar op een blaadje',
      'Maak vijf oefenopgaven uit je boek',
      'Kijk je fouten na en zoek uit waarom het zo moet',
      'Maak nog vijf opgaven, nu op tijd',
      'Loop je formuleblaadje nog een keer door en ga op tijd slapen'
    ] },
    { her: /geschiedenis|aardrijks|biologie|maatschappij|godsdienst|verzorging|topo/i, taken: [
      'Lees de paragrafen en onderstreep de kernwoorden',
      'Maak een samenvatting of een mindmap',
      'Leer je samenvatting en dek hem af: wat weet je al uit je hoofd?',
      'Zet de begrippen in Overhoren en oefen ze',
      'Vertel het hoofdstuk in je eigen woorden aan iemand thuis'
    ] }
  ];
  const ROUTE_ANDERS = [
    'Bekijk wat je precies moet kennen en verzamel je spullen',
    'Leer het eerste deel en schrijf de lastige stukken op',
    'Leer de rest en herhaal de lastige stukken',
    'Oefen jezelf: dek af, vertel het na of maak een overhoorlijst',
    'Herhaal alles nog een keer rustig en ga op tijd slapen'
  ];
  function leerplan(vak, datum) {
    const route = (ROUTES.find(r => r.her.test(vak)) || { taken: ROUTE_ANDERS }).taken;
    const tot = dagenTot(datum);
    const n = Math.max(1, Math.min(route.length, tot)); // leerdagen: hooguit de route, minstens vandaag
    const start = new Date(vandaag() + 'T12:00:00').getTime();
    const laatste = new Date(datum + 'T12:00:00').getTime() - DAG; // de dag voor de toets is de laatste leerdag
    const items = [];
    for (let i = 0; i < n; i++) {
      // gelijkmatig gespreid van vandaag tot de dag voor de toets
      const ms = n === 1 ? Math.max(start, laatste) : start + Math.round((laatste - start) * i / (n - 1));
      const taak = n === route.length ? route[i] : route[Math.round(i * (route.length - 1) / Math.max(1, n - 1))];
      items.push({ dag: dagStr(Math.min(Math.max(ms, start), Math.max(start, laatste))), taak, af: false });
    }
    return items;
  }

  function toetsen(s) {
    const b = bak(s.p);
    b.toetsen = b.toetsen.filter(t => dagenTot(t.datum) >= -14); // twee weken na de toets ruimt hij zichzelf op
    const uit = b.toetsen.map(t => Object.assign({}, t, { dagenTot: dagenTot(t.datum) }))
      .sort((a, z) => a.datum < z.datum ? -1 : 1);
    return { ok: true, toetsen: uit, vandaag: vandaag() };
  }
  function toetsMaak(s, { vak, wat, datum }) {
    const b = bak(s.p);
    const v = schoon(vak, 40), w = schoon(wat, 120);
    if (!v) return fout(400, 'Welk vak is het?');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(datum || ''))) return fout(400, 'Kies de datum van de toets.');
    if (dagenTot(datum) < 0) return fout(400, 'Die datum is al geweest.');
    if (b.toetsen.length >= 50) return fout(400, 'Je planner is vol. Ruim eerst een oude toets op.');
    const t = { id: crypto.randomBytes(6).toString('hex'), vak: v, wat: w, datum, plan: leerplan(v, datum), at: Date.now() };
    b.toetsen.push(t);
    save();
    return { ok: true, toets: Object.assign({}, t, { dagenTot: dagenTot(datum) }) };
  }
  function toetsStap(s, { id, dag, af }) {
    const b = bak(s.p);
    const t = b.toetsen.find(x => x.id === id);
    if (!t) return fout(404, 'Deze toets staat er niet meer.');
    const stap = t.plan.find(x => x.dag === dag);
    if (!stap) return fout(404, 'Die leerdag hoort niet bij deze toets.');
    stap.af = af === true;
    save();
    return { ok: true };
  }
  function toetsWeg(s, id) {
    const b = bak(s.p);
    if (!b.toetsen.some(x => x.id === id)) return fout(404, 'Deze toets staat er niet meer.');
    b.toetsen = b.toetsen.filter(x => x.id !== id);
    save();
    return { ok: true };
  }

  /* ---------- het zakgeldpotje ---------- */
  const saldoCenten = b =>
    b.transacties.reduce((som, t) => som + t.centen, 0) - b.doelen.reduce((som, d) => som + d.gespaard, 0);

  function potje(s) {
    const b = bak(s.p);
    return {
      ok: true, saldoCenten: saldoCenten(b),
      transacties: b.transacties.slice(0, 30),
      doelen: b.doelen.map(d => Object.assign({}, d, { behaald: d.gespaard >= d.doelCenten }))
    };
  }
  function boek(s, { centen, wat }) {
    const b = bak(s.p);
    const c = Math.round(Number(centen));
    if (!Number.isFinite(c) || c === 0 || Math.abs(c) > 100000) return fout(400, 'Vul een bedrag in (tot 1000 euro).');
    if (c < 0 && saldoCenten(b) + c < 0) return fout(400, 'Zoveel zit er niet in je potje.');
    b.transacties.unshift({ id: crypto.randomBytes(6).toString('hex'), centen: c, wat: schoon(wat, 60) || (c > 0 ? 'Erbij' : 'Uitgegeven'), at: Date.now() });
    b.transacties = b.transacties.slice(0, 500);
    save();
    return { ok: true, saldoCenten: saldoCenten(b) };
  }
  function doelMaak(s, { naam, doelCenten }) {
    const b = bak(s.p);
    const n = schoon(naam, 40);
    const d = Math.round(Number(doelCenten));
    if (!n) return fout(400, 'Waar spaar je voor?');
    if (!Number.isFinite(d) || d < 100 || d > 500000) return fout(400, 'Kies een spaarbedrag tussen 1 en 5000 euro.');
    if (b.doelen.length >= 10) return fout(400, 'Tien spaardoelen is genoeg; maak er eerst eentje af.');
    b.doelen.push({ id: crypto.randomBytes(6).toString('hex'), naam: n, doelCenten: d, gespaard: 0, at: Date.now() });
    save();
    return potje(s);
  }
  function doelInleg(s, { id, centen }) {
    const b = bak(s.p);
    const d = b.doelen.find(x => x.id === id);
    if (!d) return fout(404, 'Dit spaardoel staat er niet meer.');
    const c = Math.round(Number(centen));
    if (!Number.isFinite(c) || c === 0) return fout(400, 'Vul een bedrag in.');
    if (c > 0 && c > saldoCenten(b)) return fout(400, 'Zoveel zit er niet in je potje.');
    if (c < 0 && d.gespaard + c < 0) return fout(400, 'Zoveel zit er niet in dit doel.');
    d.gespaard += c; // positief: uit het potje in het doel; negatief: weer terug
    save();
    return potje(s);
  }
  function doelWeg(s, id) {
    const b = bak(s.p);
    const d = b.doelen.find(x => x.id === id);
    if (!d) return fout(404, 'Dit spaardoel staat er niet meer.');
    b.doelen = b.doelen.filter(x => x.id !== id); // het gespaarde valt vanzelf terug in het potje
    save();
    return potje(s);
  }

  return { tiener: { toetsen, toetsMaak, toetsStap, toetsWeg, potje, boek, doelMaak, doelInleg, doelWeg } };
};
