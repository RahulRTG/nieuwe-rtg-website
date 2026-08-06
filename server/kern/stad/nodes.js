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
  // een doos die vaker instuurt dan dit is stuk of kwaadwillend: de poort remt
  const MIN_TUSSEN_MS = Number(process.env.STAD_DOOS_MIN_MS || 2000);
  /* De sensorsoorten die een Stadsdoos mag insturen. De acht domeinen van het
     BORD, plus de klimaatmeters van het weefsel (regen, grondwater, riool,
     waterstand, hitte). Die vijf horen niet op het bord -- daar staan standen
     en regimes -- maar wel op de doos, want het is dezelfde hardware met
     dezelfde sleutel. Zonder deze regel zou een doos met een regenmeter zijn
     metingen geweigerd zien en bleef de klimaatlaag leeg. */
  const KLIMAAT = ctx.weefsel.weefselKlimaatMeters();
  const SENSOREN = Object.fromEntries([...DOMEINEN.map(x => [x.sens, x]),
    ...Object.keys(KLIMAAT).map(s => [s, { sens: s, klimaat: true }])]);
  const BEREIK = { verkeer: [0, 20000], licht: [0, 100], lucht: [0, 500], geluid: [20, 130],
    energie: [0, 5000], water: [0, 1000], afval: [0, 100], parkeer: [0, 5000], ...KLIMAAT };

  const hash = s => crypto.createHash('sha256').update(String(s)).digest('hex');

  /* Elke doos krijgt een plaats in het objectregister van het weefsel: een
     Stadsdoos is een asset als elke andere (hij hangt ergens, hij heeft een
     beheerder, hij gaat kapot) en zijn metingen horen bij een gebied. Zonder
     deze stap weet het bord wel dat "Stadsdoos Haven" iets meet, maar niet
     waar dat is -- en dan kan niets in het weefsel er iets mee.
     Dit loopt ook over BESTAANDE dozen, zodat een installatie die er al stond
     alsnog op de kaart komt in plaats van onzichtbaar te blijven. */
  function zorgPlaats() {
    let geraakt = false;
    for (const n of Object.values(nodes())) {
      if (!n.actief || n.objectId) continue;
      const plek = ctx.weefsel.weefselDoosPlaats(n);
      if (!plek) continue;
      n.objectId = plek.objectId; n.gebied = plek.gebied;
      geraakt = true;
    }
    if (geraakt) save();
  }

  /* De demovloot (zaaien en laten meebewegen) staat in ./demovloot.js: dat
     gaat over een stad zonder hardware, dit bestand over de hardware zelf. */
  const { zorgBasis, simuleer } = require('./demovloot')(ctx, { BEREIK, zorgPlaats, boekReeks });

  /* Een meting het geheugen in. Elke meting -- van de demovloot en van echte
     hardware -- rolt op in de uur- en dagemmers van het weefsel, zodat de stad
     morgen nog weet wat er vandaag gebeurde.

     Een doos ZONDER plaats wordt hier niet stil overgeslagen. Dat was mijn
     eerste versie (`if (!n.gebied) return;`) en dat is precies de vorm waar de
     lat regel 5 over gaat: een doos die door een misconfiguratie nooit op de
     kaart kwam, zou dan maandenlang meten zonder dat er iets in het geheugen
     landt, en niets zou klagen. Nu gaat hij mee als gemiste meting en staat de
     teller op het weefselbord. */
  function boekReeks(n, sens, waarde, at) {
    ctx.weefsel.weefselBoek({ sens, gebied: n.gebied || null, waarde, at });
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
    zorgPlaats();   // ook een echte doos staat meteen op de kaart
    save(); seintje();
    return { ok: true, serial, sleutel, let_op: 'Bewaar de sleutel nu; hij wordt niet nog eens getoond.' };
  }

  function stop({ serial, wie }) {
    const n = nodes()[String(serial || '')];
    if (!n) return { status: 404, error: 'Onbekende Stadsdoos.' };
    n.actief = false; save(); seintje();
    return { ok: true, serial: n.serial, wie: wie || 'boardroom' };
  }

  /* De poort voor de hardware zelf: alleen met een geldige apparaat-sleutel.
     Sinds de sleutelrotatie (kern/stad/apparaat.js) telt ook de VORIGE sleutel
     nog even mee -- anders sluit je precies de dozen buiten die op het moment
     van rotatie offline waren, en dat zijn in het veld altijd de dozen waar je
     het slechtst bij kunt. */
  function poort(serial, sleutel) {
    const n = nodes()[String(serial || '')];
    if (!n || !n.actief || !n.sleutelHash) return null;
    const h = hash(sleutel);
    if (n.sleutelHash === h) return n;
    if (n.oudeSleutel && n.oudeSleutel.hash === h && n.oudeSleutel.tot > nu()) { n.oudSleutelGebruikt = nu(); return n; }
    return null;
  }

  /* De hartslag draagt meer dan een teken van leven: de doos meldt welke
     firmware hij draait, of hij is opengebroken, en hoe zijn voeding ervoor
     staat. Dat is precies de informatie die je bij een kastje buiten alleen
     krijgt als het kastje hem zelf stuurt. */
  function hartslag({ serial, sleutel, firmware, sabotage, accu }) {
    const n = poort(serial, sleutel);
    if (!n) return { status: 401, error: 'Onbekende doos of verkeerde sleutel.' };
    n.laatsteContact = nu();
    const a = Number(accu);
    if (Number.isFinite(a) && a >= 0 && a <= 100) n.accu = Math.round(a);
    if (firmware && ctx.apparaat) ctx.apparaat.firmwareGemeld(n, firmware);
    if (sabotage && ctx.apparaat) ctx.apparaat.sabotage(n, typeof sabotage === 'string' ? sabotage : null);
    save();
    const up = ctx.apparaat ? ctx.apparaat.updateVoor(n) : { update: null };
    return { ok: true, serial: n.serial, update: up.update || null, let_op: up.let_op || null };
  }

  function meting({ serial, sleutel, metingen: rij }) {
    const n = poort(serial, sleutel);
    if (!n) return { status: 401, error: 'Onbekende doos of verkeerde sleutel.' };
    // de rem op de poort: een kapotte (of gekaapte) doos kan de opslag niet
    // volpompen; batchen mag, spammen niet
    if (n.laatsteMeting && nu() - n.laatsteMeting < MIN_TUSSEN_MS)
      return { status: 429, error: 'Rustig aan: hooguit een meetbericht per ' + Math.round(MIN_TUSSEN_MS / 1000) + ' seconde(n); bundel metingen in een bericht.' };
    if (!Array.isArray(rij) || !rij.length) return { status: 400, error: 'Stuur minstens een meting.' };
    if (rij.length > MAX_PER_POST) return { status: 400, error: 'Hooguit ' + MAX_PER_POST + ' metingen per bericht.' };
    let geboekt = 0, nabesteld = 0;
    for (const m of rij) {
      const s = String((m && m.sens) || '');
      const w = Number(m && m.waarde);
      if (!n.sensoren.includes(s) || !SENSOREN[s]) continue;      // alleen de eigen sensoren
      const [lo, hi] = BEREIK[s];
      if (!Number.isFinite(w) || w < lo || w > hi) continue;      // buiten bereik = weg
      // de kalibratie van deze sensor wordt HIER toegepast, zodat er nooit twee
      // getallen bestaan voor dezelfde meting (kern/stad/apparaat.js)
      const waarde = ctx.apparaat ? ctx.apparaat.corrigeer(n.serial, s, Math.round(w * 10) / 10) : Math.round(w * 10) / 10;
      /* DE BUFFER. Een doos die dagen zonder netwerk zat, heeft metingen met
         hun EIGEN tijdstempel. Die stempelen met "nu" zou de geschiedenis
         vervalsen: drie dagen stilte gevolgd door een piek die er nooit was.
         Vandaar dat een doos zijn eigen tijd mag meesturen -- begrensd: niet
         in de toekomst, en niet ouder dan BUFFER_DAGEN. */
      const eigen = Number(m && m.at);
      const grens = nu() - (ctx.apparaat ? ctx.apparaat.BUFFER_DAGEN : 30) * 86400000;
      const at = Number.isFinite(eigen) && eigen > grens && eigen <= nu() ? Math.round(eigen) : nu();
      if (at !== nu()) nabesteld++;
      // alleen de nieuwste meting bepaalt de huidige stand van het bord
      if (at >= (n.laatsteMeting || 0)) n.waarden[s] = waarde;
      metingen().unshift({ node: n.serial, zone: n.zone, sens: s, waarde, at });
      boekReeks(n, s, waarde, at);
      geboekt++;
    }
    if (metingen().length > MAX_METINGEN) metingen().length = MAX_METINGEN;
    n.laatsteContact = nu(); n.laatsteMeting = nu();
    save(); seintje();
    return { ok: true, geboekt, geweigerd: rij.length - geboekt,
      nabesteld, let_op: nabesteld ? nabesteld + ' meting(en) droegen hun eigen tijdstempel (buffer na netwerkuitval).' : null };
  }

  return { zorgBasis, simuleer,
    api: { stadNodeAanmeld: aanmeld, stadNodeStop: stop, stadDoosHartslag: hartslag, stadDoosMeting: meting } };
};
