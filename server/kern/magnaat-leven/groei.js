/* Magnaat na 1.0: GROEIEN, als je van je eigen bedrijf leeft (MAGNAAT.md, "Na
   1.0: groeien"). Pas als je je baan kon opzeggen, gaan er drie deuren open:

     - KREDIET. De Oudwijkse Bank leent op wat je bedrijf de laatste acht weken
       aantoonbaar binnenhaalde -- niet op wat je verwacht. Het geld komt als een
       schuld aan de financier in je boeken, en elke vier weken gaat er een
       aflossing en een deel rente af. Rente is een kostenpost, aflossen niet:
       zo zie je in je resultaat wat lenen je echt kost.
     - EEN FILIAAL. Een tweede plek met een eigen huur, en iemand van je team die
       er staat. Je wordt er zichtbaarder van (./bereik.js).
     - EEN OVERNAME. Je koopt een concurrent voor wat zijn marktaandeel waard is.
       Hij verdwijnt van de markt, en zijn klanten zoeken voortaan jou. Er blijft
       altijd minstens een concurrent over: een stad met een bedrijf is geen markt.

   Alles loopt door het grootboek; een weigering zegt waarom en wat wel kan. */
'use strict';
const G = require('./regels-groei');
const M = require('./regels-markt');
const R = require('./regels');
const { meld, post, euro } = require('./staat');
const { boekVan } = require('./boek');
const { betaalWatVervalt, ontvangen } = require('./geld');
const { mijlpaal } = require('./gids');
const { aandelen, marktklant } = require('./markt');
const { concurrenten, teamMax } = require('./bereik');
const { komtErbij } = require('./team');

const fout = (error) => ({ status: 400, error });
const groei = (st) => (st.groei = st.groei || { overgenomen: [], filiaal: null, krediet: null });
const eerst = (st) => st.zelfstandig ? null : fout('Groeien kan als je van je eigen bedrijf leeft: zeg eerst je baan op.');

/* Wat de bank je nu wil lenen. */
function kredietRuimte(st) {
  return Math.min(G.KREDIET.max, G.KREDIET.omzetFactor * ontvangen(st, G.KREDIET.omzetDagen));
}

function krediet(st, z) {
  const nee = eerst(st);
  if (nee) return nee;
  const g = groei(st), K = G.KREDIET;
  if (g.krediet) return fout('Je hebt al een krediet bij de ' + K.bank + ' lopen: nog ' + euro(g.krediet.open) + ' af te lossen.');
  const ruimte = kredietRuimte(st);
  if (ruimte < K.minimum) return fout('De ' + K.bank + ' leent op wat je bedrijf binnenhaalde: de laatste acht weken ' + euro(ontvangen(st, K.omzetDagen)) + ', dat is te weinig voor ' + euro(K.minimum) + '.');
  const n = Number(z.bedrag), bedrag = Number.isInteger(n) ? n * 100 : 0;
  if (bedrag < K.minimum || bedrag > ruimte) return fout('De ' + K.bank + ' leent je ' + euro(K.minimum) + ' tot ' + euro(ruimte) + '.');
  boekVan(st).boekOver(st, { soort: 'LENING', van: ['schuld', 'financier'], naar: ['kas'], bedrag, omschrijving: 'Krediet van de ' + K.bank, sleutel: 'krediet:' + st.dag });
  const rente = Math.round(bedrag * K.rente / 100);
  g.krediet = { bedrag, rente, open: bedrag, sinds: st.dag };
  for (let i = 1, over = bedrag, r = rente; i <= K.termijnen; i++) {
    const t = i === K.termijnen ? over : Math.round(bedrag / K.termijnen), ri = i === K.termijnen ? r : Math.round(rente / K.termijnen);
    over -= t; r -= ri;
    post(st, { soort: 'krediet', naam: 'Aflossing krediet ' + i + '/' + K.termijnen, bedrag: t, dag: st.dag + i * K.elke, leverancier: 'de ' + K.bank, naar: ['schuld', 'financier'], boekSoort: 'AFLOSSING' });
    post(st, { soort: 'rente', naam: 'Rente krediet ' + i + '/' + K.termijnen, bedrag: ri, dag: st.dag + i * K.elke, leverancier: 'de ' + K.bank, naar: ['kosten', 'rente'], boekSoort: 'RENTE' });
  }
  mijlpaal(st, 'krediet', 'Je eerste krediet van de bank: ' + euro(bedrag) + '.');
  meld(st, 'De ' + K.bank + ' leent je ' + euro(bedrag) + ' tegen ' + K.rente + '% rente: ' + euro(rente) + ' in totaal. Je lost af in ' + K.termijnen +
    ' termijnen van vier weken. De rente is een kostenpost, de aflossing niet.', 'vraag');
  return { ok: true };
}

function filiaal(st, z) {
  const nee = eerst(st);
  if (nee) return nee;
  const g = groei(st), w = M.WIJKEN[z.wijk];
  if (g.filiaal) return fout('Je hebt al een filiaal in ' + M.WIJKEN[g.filiaal.wijk].naam + '.');
  if (st.vestiging.wijk === 'thuis') return fout('Een filiaal naast je huiskamer bestaat niet: huur eerst een bedrijfsruimte.');
  if (!w || !w.huur) return fout('Kies een wijk met een bedrijfsruimte voor je filiaal.');
  if (z.wijk === st.vestiging.wijk) return fout('Je zit al in ' + w.naam + '; een filiaal staat ergens anders.');
  if ((st.team || []).filter(m => !m.weg).length < G.FILIAAL.teamMin) return fout('Een filiaal heeft iemand nodig die er staat: neem eerst iemand aan.');
  if (st.kas < w.verhuis + w.huur) return fout('Een filiaal in ' + w.naam + ' kost ' + euro(w.verhuis) + ' inrichten plus de eerste huur van ' + euro(w.huur) + ', en er staat ' + euro(st.kas) + ' op je rekening.');
  boekVan(st).boekOver(st, { soort: 'VERHUIZING', van: ['kas'], naar: ['kosten', 'huisvesting'], bedrag: w.verhuis, omschrijving: 'Inrichting filiaal ' + w.naam, sleutel: 'filiaal:' + st.dag });
  g.filiaal = { wijk: z.wijk, sinds: st.dag, volgende: null };
  filiaalHuur(st);
  betaalWatVervalt(st);
  mijlpaal(st, 'filiaal', 'Je tweede plek: een filiaal in ' + w.naam + '.');
  meld(st, 'Je opent een filiaal in ' + w.naam + '. Huur ' + euro(w.huur) + ' per vier weken; meer mensen zien je bedrijf.', 'goed');
  return { ok: true };
}

function filiaalHuur(st) {
  const f = st.groei.filiaal, w = M.WIJKEN[f.wijk];
  post(st, { soort: 'filiaal', naam: 'Huur filiaal ' + w.naam, bedrag: w.huur, dag: st.dag, leverancier: 'verhuurder ' + w.naam, naar: ['kosten', 'huisvesting'], boekSoort: 'HUUR_BEDRIJF' });
  f.volgende = st.dag + R.PERIODE;
}

/* Wat een concurrent kost: zijn marktaandeel, met een bodem. */
function prijsVan(st, c) {
  return Math.max(G.OVERNAME.minimum, (aandelen(st)[c.id] || 0) * G.OVERNAME.perPromille);
}

function overname(st, z) {
  const nee = eerst(st);
  if (nee) return nee;
  const g = groei(st), nog = concurrenten(st), c = nog.find(x => x.id === z.bedrijf);
  if (!c) return fout('Kies een concurrent om over te nemen: ' + nog.map(x => x.naam).join(', ') + '.');
  if (nog.length <= G.OVERNAME.overblijven) return fout(c.naam + ' is je laatste concurrent: een stad met een bedrijf is geen markt.');
  const prijs = prijsVan(st, c), mens = G.OVERNAME.mensen[c.id];
  if ((st.team || []).filter(m => !m.weg).length >= teamMax(st)) return fout(mens + ' van ' + c.naam + ' komt mee, en je team is vol: open een filiaal of zeg iemand op.');
  if (st.kas < prijs) return fout(c.naam + ' overnemen kost ' + euro(prijs) + ', en er staat ' + euro(st.kas) + ' op je rekening. Een krediet van de bank kan helpen.');
  boekVan(st).boekOver(st, { soort: 'OVERNAME', van: ['kas'], naar: ['kosten', 'overname'], bedrag: prijs, omschrijving: 'Overname van ' + c.naam, sleutel: 'overname:' + c.id });
  g.overgenomen.push(c.id);
  mijlpaal(st, 'overname', 'Je eerste overname: ' + c.naam + '.');
  meld(st, 'Je neemt ' + c.naam + ' over voor ' + euro(prijs) + '. Het bedrijf verdwijnt van de markt, ' + mens + ' komt bij je werken, en zijn klanten zoeken voortaan jou.', 'goed');
  komtErbij(st, Object.assign({ id: 'o-' + c.id, naam: mens }, G.OVERNAME.mens));
  marktklant(st, { id: c.id, naam: c.naam, overname: true });
  return { ok: true };
}

/* Elke dag: de huur van je filiaal, en of je krediet is afgelost; en of je de grootste bent. */
function groeiDag(st) {
  const g = st.groei;
  if (!g) return;
  if (g.filiaal && g.filiaal.volgende != null && g.filiaal.volgende <= st.dag) filiaalHuur(st);
  if (g.krediet) {
    g.krediet.open = st.posten.filter(p => p.soort === 'krediet').reduce((s, p) => s + p.bedrag, 0);
    if (!st.posten.some(p => p.soort === 'krediet' || p.soort === 'rente')) {
      g.krediet = null;
      meld(st, 'Je krediet bij de ' + G.KREDIET.bank + ' is afgelost.', 'goed');
    }
  }
  if (st.handel && st.zelfstandig) {
    const a = aandelen(st);
    if (concurrenten(st).every(c => (a.jij || 0) > (a[c.id] || 0))) mijlpaal(st, 'marktleider', 'Je bent de grootste in Oudwijk: meer kopers kiezen jou dan wie ook.');
  }
}

/* Wat de speler van groeien ziet. */
function groeiBeeld(st) {
  const g = st.groei || {};
  return {
    open: !!st.zelfstandig, krediet: g.krediet || null, kredietRuimte: st.zelfstandig ? kredietRuimte(st) : 0,
    filiaal: g.filiaal ? { wijk: g.filiaal.wijk, naam: M.WIJKEN[g.filiaal.wijk].naam, huur: M.WIJKEN[g.filiaal.wijk].huur } : null,
    overgenomen: (g.overgenomen || []).map(id => (M.CONCURRENTEN[st.aanbod] || []).find(c => c.id === id)).filter(Boolean).map(c => c.naam),
    overnames: st.aanbod ? concurrenten(st).map(c => ({ id: c.id, naam: c.naam, prijs: prijsVan(st, c) })) : []
  };
}

module.exports = { krediet, filiaal, overname, groeiDag, groeiBeeld, kredietRuimte, prijsVan };
