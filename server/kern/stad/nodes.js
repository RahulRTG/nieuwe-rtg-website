/* RTG Stad, deel "nodes": de Stadsdoos-vloot -- de EIGEN hardware van de stad,
   dezelfde familie als de Zaakdoos in de zaken. Elke doos meldt zich met een
   serienummer en een apparaat-sleutel; de sleutel wordt EEN keer getoond bij de
   aanmelding en daarna alleen als hash bewaard (zelfde tucht als wachtwoorden).
   De doos stuurt hartslagen en metingen; wat te laat komt of buiten bereik valt
   wordt geweigerd. Zolang er geen echte hardware hangt, leeft een demovloot mee
   met een begrensde random walk, zodat het bord nooit leeg oogt.
   Krijgt de gedeelde ctx van kern/stad/index.js. */
module.exports = (ctx) => {
  const { d, save, crypto, schoon, nu, zones, nodes, metingen, MAX_METINGEN, DOMEINEN, seintje } = ctx;

  const MAX_NODES = 500;
  const MAX_PER_POST = 50;
  const SENSOREN = Object.fromEntries(DOMEINEN.map(x => [x.sens, x]));
  const BEREIK = { verkeer: [0, 20000], licht: [0, 100], lucht: [0, 500], geluid: [20, 130],
    energie: [0, 5000], water: [0, 1000], afval: [0, 100], parkeer: [0, 5000] };

  const hash = s => crypto.createHash('sha256').update(String(s)).digest('hex');

  /* De demoseed: zes zones en acht Stadsdozen, alleen als de stad nog leeg is.
     De demodozen dragen demo:true; hun sleutels bestaan niet (niemand kan
     namens ze insturen), hun waarden komen uit de simulator hieronder. */
  function zorgBasis() {
    if (zones().length) return;
    d().stadZones = ['Centrum', 'Marina', 'Oud-West', 'Bedrijvenkwartier', 'Groenzone', 'Boulevard'];
    const demo = [
      ['Stadsdoos Plein',      'Centrum',          ['verkeer', 'lucht', 'geluid', 'licht']],
      ['Stadsdoos Haven',      'Marina',           ['verkeer', 'water', 'parkeer']],
      ['Stadsdoos Molenstraat','Oud-West',         ['verkeer', 'geluid', 'afval', 'licht']],
      ['Stadsdoos Fabriek',    'Bedrijvenkwartier',['energie', 'lucht', 'afval']],
      ['Stadsdoos Park',       'Groenzone',        ['lucht', 'geluid', 'water']],
      ['Stadsdoos Strand',     'Boulevard',        ['verkeer', 'parkeer', 'licht']],
      ['Stadsdoos Markt',      'Centrum',          ['afval', 'parkeer', 'energie']],
      ['Stadsdoos Sluis',      'Marina',           ['water', 'energie', 'licht']]
    ];
    const START = { verkeer: 420, licht: 62, lucht: 38, geluid: 52, energie: 120, water: 22, afval: 35, parkeer: 90 };
    for (const [naam, zone, sens] of demo) {
      const serial = 'SD-' + crypto.randomBytes(3).toString('hex').toUpperCase();
      nodes()[serial] = { serial, naam, zone, sensoren: sens, demo: true, actief: true,
        sleutelHash: null, laatsteContact: nu(), waarden: Object.fromEntries(sens.map(s => [s, START[s]])) };
    }
    save();
  }

  // de demovloot leeft: hooguit elke vijf minuten een nieuwe, licht verschoven meting
  function simuleer() {
    const grens = nu() - 5 * 60 * 1000;
    for (const n of Object.values(nodes())) {
      if (!n.demo || !n.actief || (n.laatsteMeting || 0) > grens) continue;
      for (const s of n.sensoren) {
        const [lo, hi] = BEREIK[s];
        const stap = (hi - lo) * 0.04;
        const v = Math.min(hi, Math.max(lo, (n.waarden[s] || lo) + (Math.random() * 2 - 1) * stap));
        n.waarden[s] = Math.round(v * 10) / 10;
        metingen().unshift({ node: n.serial, zone: n.zone, sens: s, waarde: n.waarden[s], at: nu() });
      }
      n.laatsteMeting = nu(); n.laatsteContact = nu();
    }
    if (metingen().length > MAX_METINGEN) metingen().length = MAX_METINGEN;
    save();
  }

  /* Een echte Stadsdoos aanmelden: de boardroom krijgt het serienummer en de
     apparaat-sleutel EEN keer te zien; daarna staat alleen de hash in de db. */
  function aanmeld({ naam, zone, sensoren, wie }) {
    zorgBasis();
    if (Object.keys(nodes()).length >= MAX_NODES) return { status: 429, error: 'Het maximale aantal Stadsdozen is bereikt.' };
    const z = String(zone || '').trim();
    if (!zones().includes(z)) return { status: 400, error: 'Kies een bestaande zone: ' + zones().join(', ') + '.' };
    const sens = (Array.isArray(sensoren) ? sensoren : []).map(s => String(s)).filter(s => SENSOREN[s]);
    if (!sens.length) return { status: 400, error: 'Kies minstens een sensor: ' + Object.keys(SENSOREN).join(', ') + '.' };
    const serial = 'SD-' + crypto.randomBytes(3).toString('hex').toUpperCase();
    const sleutel = crypto.randomBytes(16).toString('hex');
    nodes()[serial] = { serial, naam: schoon(naam, 60) || serial, zone: z, sensoren: sens, demo: false,
      actief: true, sleutelHash: hash(sleutel), laatsteContact: null, waarden: {}, door: wie || 'boardroom', at: nu() };
    save(); seintje();
    return { ok: true, serial, sleutel, let_op: 'Bewaar de sleutel nu; hij wordt niet nog eens getoond.' };
  }

  function stop({ serial, wie }) {
    const n = nodes()[String(serial || '')];
    if (!n) return { status: 404, error: 'Onbekende Stadsdoos.' };
    n.actief = false; save(); seintje();
    return { ok: true, serial: n.serial, wie: wie || 'boardroom' };
  }

  // de poort voor de hardware zelf: alleen met een geldige apparaat-sleutel
  function poort(serial, sleutel) {
    const n = nodes()[String(serial || '')];
    if (!n || !n.actief || !n.sleutelHash) return null;
    return n.sleutelHash === hash(sleutel) ? n : null;
  }

  function hartslag({ serial, sleutel }) {
    const n = poort(serial, sleutel);
    if (!n) return { status: 401, error: 'Onbekende doos of verkeerde sleutel.' };
    n.laatsteContact = nu(); save();
    return { ok: true, serial: n.serial };
  }

  function meting({ serial, sleutel, metingen: rij }) {
    const n = poort(serial, sleutel);
    if (!n) return { status: 401, error: 'Onbekende doos of verkeerde sleutel.' };
    if (!Array.isArray(rij) || !rij.length) return { status: 400, error: 'Stuur minstens een meting.' };
    if (rij.length > MAX_PER_POST) return { status: 400, error: 'Hooguit ' + MAX_PER_POST + ' metingen per bericht.' };
    let geboekt = 0;
    for (const m of rij) {
      const s = String((m && m.sens) || '');
      const w = Number(m && m.waarde);
      if (!n.sensoren.includes(s) || !SENSOREN[s]) continue;      // alleen de eigen sensoren
      const [lo, hi] = BEREIK[s];
      if (!Number.isFinite(w) || w < lo || w > hi) continue;      // buiten bereik = weg
      const waarde = Math.round(w * 10) / 10;
      n.waarden[s] = waarde;
      metingen().unshift({ node: n.serial, zone: n.zone, sens: s, waarde, at: nu() });
      geboekt++;
    }
    if (metingen().length > MAX_METINGEN) metingen().length = MAX_METINGEN;
    n.laatsteContact = nu(); n.laatsteMeting = nu();
    save(); seintje();
    return { ok: true, geboekt, geweigerd: rij.length - geboekt };
  }

  return { zorgBasis, simuleer,
    api: { stadNodeAanmeld: aanmeld, stadNodeStop: stop, stadDoosHartslag: hartslag, stadDoosMeting: meting } };
};
