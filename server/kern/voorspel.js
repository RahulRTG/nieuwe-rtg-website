/* De voorspeller: RTG leert het ritme van elk lid en elke zaak uit het
   eigen grootboek en zet klaar wat waarschijnlijk komt. Elke transactie in
   het huis (eten, ritten, tickets, care, dates) landt als boeking in RTG
   Pay; daardoor is een bron genoeg om over alle apps heen te leren.

   Het leren is bewust doorzichtig (geen zwarte doos): per gewoonte tellen
   we hoe vaak, het gebruikelijke uur en de gebruikelijke dag, en het
   gemiddelde aantal dagen ertussen. De zekerheid groeit met het aantal
   waarnemingen en met hoe "rijp" het volgende bezoek is. Bij te weinig
   geschiedenis zeggen we dat eerlijk, in plaats van te gokken (liever te
   hard dan een liegbeest). De AI mag deze paden zelf aanroepen via het
   stuur, en de apps tonen de beste verwachting als stille kaart. */
const DAGEN = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];

/* puur: het stille seintje. Alleen als de beste gewoonte echt rijp is
   (het gebruikelijke ritme is bijna of helemaal verstreken) fluistert de
   voorspeller een keer mee in "Rahul ziet"; nooit een schreeuwende melding. */
function seintjeVoor(voorLidResultaat) {
  const v = voorLidResultaat && (voorLidResultaat.verwachtingen || [])[0];
  if (!v || v.rijp < 0.6 || v.zekerheid < 0.2) return null;
  return { icoon: '\u{1F52E}', tekst: 'Rond deze tijd, als u wilt: ' + v.wat + ' (' + v.waarom + ')' };
}

function modus(arr) {
  const tel = {}; let beste = arr[0], n = 0;
  for (const x of arr) { tel[x] = (tel[x] || 0) + 1; if (tel[x] > n) { n = tel[x]; beste = x; } }
  return { waarde: beste, aandeel: n / arr.length };
}

/* puur: leer gewoontes uit grootboekrijen van een lid-rekening */
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

function maakVoorspel({ db, findSupplier }) {
  const boek = () => Array.isArray(db.data.payBoekingen) ? db.data.payBoekingen : [];
  const naamVan = (code) => { const z = findSupplier(code); return z ? z.name : code; };

  function voorLid(codenaam, nu = new Date()) {
    const rek = 'lid:' + codenaam;
    const rijen = boek().filter(r => r.van === rek).slice(0, 400);
    const gewoonten = gewoontenUit(rijen, rek, nu);
    const verwachtingen = gewoonten.slice(0, 3).map(g => ({
      zaak: naamVan(g.code), code: g.code, zekerheid: g.zekerheid, rijp: g.rijp,
      wat: naamVan(g.code) + ' rond ' + g.uur + ':00' +
        (g.tussenDagen >= 4 ? ', meestal op ' + g.dagNaam : ''),
      waarom: g.n + ' eerdere bezoeken, gemiddeld elke ' +
        (g.tussenDagen < 1 ? 'dag' : Math.round(g.tussenDagen) + ' dagen'),
      vraag: 'Zet mijn gebruikelijke bezoek aan ' + naamVan(g.code) +
        ' klaar, rond ' + g.uur + ':00.'
    }));
    return {
      ok: true, verwachtingen, geleerdUit: rijen.length,
      uitleg: verwachtingen.length ? null :
        'Nog te weinig geschiedenis om eerlijk te voorspellen; RTG leert met elk bezoek.'
    };
  }

  function voorZaak(code, nu = new Date()) {
    const rek = 'partner:' + code;
    const rijen = boek().filter(r => r.naar === rek && /^lid:/.test(r.van)).slice(0, 2000);
    if (rijen.length < 5) {
      return { ok: true, morgen: null, vasteGasten: [], geleerdUit: rijen.length,
        uitleg: 'Nog te weinig geschiedenis om eerlijk te voorspellen; het beeld groeit met elke transactie.' };
    }
    const oudste = Math.min(...rijen.map(r => new Date(r.at).getTime()));
    const weken = Math.max(1, (nu.getTime() - oudste) / (7 * 86400000));
    const morgenDag = (nu.getDay() + 1) % 7;
    const opDag = rijen.filter(r => new Date(r.at).getDay() === morgenDag);
    const perUur = {};
    for (const r of opDag) { const u = new Date(r.at).getHours(); perUur[u] = (perUur[u] || 0) + 1; }
    const drukUren = Object.entries(perUur).sort((a, b) => b[1] - a[1]).slice(0, 3)
      .map(([u, n]) => ({ uur: +u, n }));
    const perGast = {};
    for (const r of rijen) { const c = r.van.slice(4); perGast[c] = (perGast[c] || 0) + 1; }
    const vasteGasten = Object.entries(perGast).filter(([, n]) => n >= 2)
      .sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c, n]) => ({ codenaam: c, n }));
    const advies = drukUren.length
      ? 'Plan de bezetting rond ' + drukUren.map(u => u.uur + ':00').join(' en ') +
        ' en zet de voorbereiding ruim daarvoor klaar.'
      : 'Nog geen duidelijke piek op deze weekdag; het beeld groeit met elke transactie.';
    return {
      ok: true, geleerdUit: rijen.length, weken: +weken.toFixed(1),
      morgen: {
        dagNaam: DAGEN[morgenDag],
        verwachtTransacties: Math.round(opDag.length / weken),
        verwachtCenten: Math.round(opDag.reduce((s, r) => s + r.centen, 0) / weken),
        drukUren, advies
      },
      vasteGasten
    };
  }

  return { voorspel: { voorLid, voorZaak, gewoontenUit, seintjeVoor } };
}

module.exports = { maakVoorspel, gewoontenUit, seintjeVoor, DAGEN };
