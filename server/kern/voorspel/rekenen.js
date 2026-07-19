/* De voorspeller, deelbestand "rekenen": de pure rekenkern. Alles hier is zonder
   database of state, puur en los te testen: het stille seintje, de reisketen vooruit,
   het leren van gewoontes uit grootboekrijen en het combinatiegedrag (de grondstof
   voor een Synergie-deal). De runtime (voorLid/voorZaak) woont in index.js en roept
   deze functies aan. */
const DAGEN = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];

/* het stille seintje. Alleen als de beste verwachting echt rijp is (het
   gebruikelijke ritme is bijna of helemaal verstreken, of er staat een keten
   klaar rond een vaste boeking) fluistert de voorspeller een keer mee in
   "Rahul ziet"; nooit een schreeuwende melding. */
function seintjeVoor(voorLidResultaat) {
  const v = voorLidResultaat && (voorLidResultaat.verwachtingen || [])[0];
  if (!v || v.rijp < 0.6 || v.zekerheid < 0.2) return null;
  return { icoon: '\u{1F52E}', tekst: (v.soort === 'keten' ? 'Uw keten kan klaargezet: ' : 'Rond deze tijd, als u wilt: ') +
    v.wat + ' (' + v.waarom + ')' };
}

/* de reisketen vooruit. Een vaste boeking (verblijf of tafel) is geen gok maar
   een zeker feit; de voorspeller kijkt of de rest van de keten er al omheen
   staat en stelt anders EEN samenhangend voorstel voor dat Rahul met een enkel
   "ja" kan uitvoeren. */
function ketenUit(bronnen, nu = new Date()) {
  const vandaag = nu.toISOString().slice(0, 10);
  const binnen = (datum, dagen) => datum >= vandaag &&
    (Date.parse(datum) - Date.parse(vandaag)) / 86400000 <= dagen;
  const keten = [];
  const vb = (bronnen.verblijven || [])
    .filter(v => v.status === 'bevestigd' && binnen(v.aankomst, 14))
    .sort((a, b) => a.aankomst.localeCompare(b.aankomst))[0];
  if (vb) {
    const tafelStaat = (bronnen.reserveringen || []).some(r =>
      ['aangevraagd', 'bevestigd'].includes(r.status) && r.datum === vb.aankomst);
    if (!tafelStaat) keten.push({
      soort: 'keten', zekerheid: 0.9, rijp: 1,
      zaak: vb.supplierName, code: vb.supplierCode || null,
      wat: 'uw aankomst bij ' + vb.supplierName + ' op ' + vb.aankomst,
      waarom: 'de check-in staat vast, de rest van de keten nog niet',
      vraag: 'Zet mijn aankomstketen voor ' + vb.aankomst + ' klaar: een transfer naar ' +
        vb.supplierName + ' en een tafel voor die avond.'
    });
  }
  return keten;
}

function modus(arr) {
  const tel = {}; let beste = arr[0], n = 0;
  for (const x of arr) { tel[x] = (tel[x] || 0) + 1; if (tel[x] > n) { n = tel[x]; beste = x; } }
  return { waarde: beste, aandeel: n / arr.length };
}

/* leer gewoontes uit grootboekrijen van een lid-rekening */
function gewoontenUit(rijen, rek, nu = new Date()) {
  const per = new Map();
  for (const r of rijen) {
    if (r.van !== rek || !/^partner:/.test(r.naar)) continue;
    const code = r.naar.slice(8);
    if (!per.has(code)) per.set(code, []);
    per.get(code).push(r);
  }
  const lijst = [];
  for (const [code, rs] of per) {
    if (rs.length < 3) continue;
    const tijden = rs.map(r => new Date(r.at).getTime()).sort((a, b) => a - b);
    const uur = modus(rs.map(r => new Date(r.at).getHours()));
    const dag = modus(rs.map(r => new Date(r.at).getDay()));
    let som = 0;
    for (let i = 1; i < tijden.length; i++) som += tijden[i] - tijden[i - 1];
    const tussenDagen = som / (tijden.length - 1) / 86400000;
    const sindsDagen = (nu.getTime() - tijden[tijden.length - 1]) / 86400000;
    const rijp = tussenDagen > 0.04 ? Math.min(1, sindsDagen / tussenDagen) : 1;
    const zekerheid = Math.min(1, rs.length / 8) *
      (0.35 + 0.35 * rijp + 0.15 * uur.aandeel + 0.15 * dag.aandeel);
    lijst.push({
      code, n: rs.length, uur: uur.waarde, dag: dag.waarde, dagNaam: DAGEN[dag.waarde],
      tussenDagen: +tussenDagen.toFixed(2), sindsDagen: +sindsDagen.toFixed(2),
      gemCenten: Math.round(rs.reduce((s, r) => s + r.centen, 0) / rs.length),
      rijp: +rijp.toFixed(2), zekerheid: +zekerheid.toFixed(2)
    });
  }
  return lijst.sort((a, b) => b.zekerheid - a.zekerheid);
}

/* combinatiegedrag. Twee zaken die door dezelfde leden binnen een dagdeel (6 uur)
   na elkaar worden bezocht, horen blijkbaar bij elkaar; dat is de grondstof voor
   een Synergie-deal. Telt per paar hoe vaak en wat er gemiddeld per zaak wordt
   besteed. */
function combinatiesUit(rijen) {
  const perLid = new Map();
  for (const r of rijen) {
    if (!/^lid:/.test(r.van) || !/^partner:/.test(r.naar)) continue;
    if (!perLid.has(r.van)) perLid.set(r.van, []);
    perLid.get(r.van).push({ t: Date.parse(r.at), code: r.naar.slice(8), centen: r.centen });
  }
  const paren = new Map();
  for (const lijst of perLid.values()) {
    lijst.sort((a, b) => a.t - b.t);
    for (let i = 0; i < lijst.length; i++) {
      for (let j = i + 1; j < lijst.length; j++) {
        if (lijst[j].t - lijst[i].t > 6 * 3600000) break;
        if (lijst[i].code === lijst[j].code) continue;
        const [x, y] = lijst[i].code < lijst[j].code ? [lijst[i], lijst[j]] : [lijst[j], lijst[i]];
        const k = x.code + '|' + y.code;
        const p = paren.get(k) || { a: x.code, b: y.code, n: 0, somA: 0, somB: 0 };
        p.n += 1; p.somA += x.centen; p.somB += y.centen;
        paren.set(k, p);
      }
    }
  }
  return [...paren.values()].map(p => ({ a: p.a, b: p.b, n: p.n,
    gemA: Math.round(p.somA / p.n), gemB: Math.round(p.somB / p.n) })).sort((x, y) => y.n - x.n);
}

module.exports = { DAGEN, seintjeVoor, ketenUit, modus, gewoontenUit, combinatiesUit };
