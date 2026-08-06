/* RTG Stadsweefsel, deel "tijdreeksen": het geheugen van de stad.

   RTG Stad kende alleen het HEDEN. Het bord keek dertig minuten terug en de
   metingenbak was een venster van 20.000 regels dat vanzelf zijn staart
   verloor. Daarmee kun je zeggen "het is nu druk", maar niet "het is drukker
   dan vorige maand", en dus ook niet of een maatregel iets heeft opgeleverd.
   Zonder geheugen is elk beleidsgesprek een mening.

   DRIE LAGEN, MET EEN TERMIJN PER LAAG.
     ruw   -- de losse meting; blijft bij kern/stad in zijn begrensde venster
     uur   -- per sensorsoort per zone een uur-emmer (n, som, min, max)
     dag   -- dezelfde emmer per dag, veel langer bewaard
   Ruwe metingen zijn duur en zelden nodig; een uur- en dagemmer is klein en
   beantwoordt bijna elke vraag. De termijnen staan hieronder en zijn met een
   omgevingsvariabele te verzetten, want een gemeente die drie jaar uurdata wil
   moet dat kunnen -- maar dan als BESLUIT, niet omdat het toevallig zo groeit.

   HOGERE GEBIEDEN WORDEN GEREKEND, NIET BEWAARD. Een buurt-, wijk- of
   stadscijfer telt bij het lezen de zones eronder op. Zou je die apart
   opslaan, dan heb je twee getallen die hetzelfde beweren en die vroeg of
   laat uiteenlopen -- en dan is de vraag welke van de twee in het jaarverslag
   stond.

   Privacy: hier komen alleen dingen langs. Een emmer draagt een sensorsoort,
   een zone, een tijdvak en getallen. Geen codenaam, geen toestel, geen
   persoon; er valt hier niets te herleiden en dat moet zo blijven.

   Krijgt de gedeelde ctx van kern/stadsweefsel/index.js. */
const UUR_MS = 3600000, DAG_MS = 86400000;

module.exports = (ctx) => {
  const { bak, save, nu, geo } = ctx;

  // de bewaartermijnen per laag, in dagen (instelbaar, met nette ondergrens)
  const dagen = (v, standaard) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 1 ? Math.round(n) : standaard;
  };
  const BEWAAR = {
    uur: dagen(process.env.RTG_WEEFSEL_UURDAGEN, 14),
    dag: dagen(process.env.RTG_WEEFSEL_DAGDAGEN, 400)
  };
  const VEEG_MS = 6 * UUR_MS;   // hooguit vier keer per dag opruimen

  const reeksen = () => bak().reeksen;
  const emmerStart = (at, laag) => laag === 'uur' ? Math.floor(at / UUR_MS) * UUR_MS : Math.floor(at / DAG_MS) * DAG_MS;
  const sleutel = (laag, sens, zone, start) => laag + '|' + sens + '|' + zone + '|' + start;

  /* De zone waar een meting bij hoort. Een Stadsdoos hangt aan een
     straatsegment; dan is de zone zijn ouder. De reeksen draaien bewust op
     zone-niveau: fijner is een tijdreeks per lantaarnpaal (dat is een andere
     vraag), grover verliest het verschil tussen de haven en het centrum. */
  function zoneVan(gebiedId) {
    const p = geo.pad(gebiedId);
    const z = p.find(g => g.niveau === 'zone');
    return z ? z.id : null;
  }

  /* Een meting bijboeken. O(1): twee emmers bijwerken, verder niets. Dit
     draait op het pad van elke binnenkomende meting, dus hier hoort geen
     enkele lus over de historie te staan. */
  function boek({ sens, gebied, waarde, at }) {
    const w = Number(waarde);
    if (!Number.isFinite(w)) return null;
    const s = String(sens || '').slice(0, 20);
    if (!s) return null;
    const zone = zoneVan(gebied);
    if (!zone) return null;
    const t = Number.isFinite(Number(at)) ? Number(at) : nu();
    const R = reeksen();
    for (const laag of ['uur', 'dag']) {
      const k = sleutel(laag, s, zone, emmerStart(t, laag));
      const e = R[k] || (R[k] = { n: 0, som: 0, min: w, max: w });
      e.n++; e.som += w;
      if (w < e.min) e.min = w;
      if (w > e.max) e.max = w;
    }
    veegSoms();
    return true;
  }

  /* Opruimen volgens de termijn. Hooguit een keer per zes uur, want dit loopt
     over alle emmers en het pad hierboven is heet. Wat verloopt gaat echt weg:
     een bewaartermijn die alleen in een document staat is geen termijn. */
  function veegSoms() {
    const b = bak();
    if (b.laatsteVeeg && nu() - b.laatsteVeeg < VEEG_MS) return;
    b.laatsteVeeg = nu();
    veeg();
  }
  function veeg() {
    const R = reeksen();
    const grens = { uur: nu() - BEWAAR.uur * DAG_MS, dag: nu() - BEWAAR.dag * DAG_MS };
    let weg = 0;
    for (const k of Object.keys(R)) {
      const [laag, , , start] = k.split('|');
      if (!grens[laag]) { delete R[k]; weg++; continue; }   // onbekende laag: geen weesdata laten staan
      if (Number(start) < grens[laag]) { delete R[k]; weg++; }
    }
    if (weg) save();
    return weg;
  }

  /* Een reeks lezen. Voor een gebied boven zone-niveau worden de zones
     eronder bij elkaar opgeteld -- gerekend, niet bewaard. */
  function reeks({ sens, gebied, laag, vanaf, tot }) {
    geo.zorgGeografie();
    const l = laag === 'uur' ? 'uur' : 'dag';
    const s = String(sens || '');
    const doel = gebied ? geo.gebied(gebied) : null;
    if (gebied && !doel) return { status: 404, error: 'Onbekend gebied.' };
    const zones = !doel ? geo.opNiveau('zone').map(z => z.id)
      : doel.niveau === 'zone' ? [doel.id]
        : geo.opNiveau('zone').filter(z => geo.binnen(doel.id, z.id)).map(z => z.id);
    const stap = l === 'uur' ? UUR_MS : DAG_MS;
    const eind = Number(tot) > 0 ? Number(tot) : nu();
    const start = Number(vanaf) > 0 ? Number(vanaf) : eind - (l === 'uur' ? 2 * DAG_MS : 30 * DAG_MS);
    const R = reeksen();
    const punten = [];
    for (let t = emmerStart(start, l); t <= eind; t += stap) {
      let n = 0, som = 0, min = null, max = null;
      for (const z of zones) {
        const e = R[sleutel(l, s, z, t)];
        if (!e) continue;
        n += e.n; som += e.som;
        if (min == null || e.min < min) min = e.min;
        if (max == null || e.max > max) max = e.max;
      }
      if (n) punten.push({ at: t, n, gem: Math.round(som / n * 10) / 10, min, max });
    }
    return { status: 200, sens: s, laag: l, gebied: doel ? { id: doel.id, naam: doel.naam } : null,
      zones: zones.length, bewaartermijnDagen: BEWAAR[l], punten };
  }

  /* De trend: dit tijdvak tegen het vorige, even lang. Geeft eerlijk "geen
     vergelijking mogelijk" terug als een van beide helften leeg is -- een
     percentage uit nul metingen is een verzinsel met een decimaal erachter. */
  function trend({ sens, gebied, dagen: d }) {
    const n = Number(d) > 0 ? Math.min(Math.round(Number(d)), BEWAAR.dag) : 7;
    const eind = nu(), midden = eind - n * DAG_MS, begin = midden - n * DAG_MS;
    const nieuw = reeks({ sens, gebied, laag: 'dag', vanaf: midden, tot: eind });
    if (nieuw.error) return nieuw;
    const oud = reeks({ sens, gebied, laag: 'dag', vanaf: begin, tot: midden });
    const gem = (r) => r.punten.length ? r.punten.reduce((s, p) => s + p.gem * p.n, 0) / r.punten.reduce((s, p) => s + p.n, 0) : null;
    const a = gem(oud), b = gem(nieuw);
    if (a == null || b == null || a === 0)
      return { status: 200, sens, dagen: n, nu: b == null ? null : Math.round(b * 10) / 10, eerder: a == null ? null : Math.round(a * 10) / 10,
        richting: 'onbekend', reden: 'te weinig geschiedenis om te vergelijken' };
    const pct = Math.round((b - a) / Math.abs(a) * 1000) / 10;
    return { status: 200, sens, dagen: n, gebied: nieuw.gebied, nu: Math.round(b * 10) / 10, eerder: Math.round(a * 10) / 10,
      verschilPct: pct, richting: pct > 2 ? 'omhoog' : pct < -2 ? 'omlaag' : 'gelijk' };
  }

  return {
    BEWAAR, boek, reeks, trend, veeg, zoneVan,
    api: {
      weefselReeks: ({ sens, gebied, laag, vanaf, tot }) => reeks({ sens, gebied, laag, vanaf, tot }),
      weefselTrend: ({ sens, gebied, dagen: d }) => trend({ sens, gebied, dagen: d }),
      weefselReeksVeeg: () => ({ status: 200, ok: true, verwijderd: veeg(), bewaartermijnen: BEWAAR })
    }
  };
};
