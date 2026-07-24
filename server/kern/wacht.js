/* Kern-module "De Wacht": het immuunsysteem én de raadkamer van het platform.

   Vier taken, allemaal zichtbaar op het beveiligde techniek-bord (de boardroom):

   1. METERS & GRAFIEK. Een ringbuffer van momentopnames (verzoeken, bans,
      actieve IP's, open alarmen, quarantaines, geheugen). Zo zie je op het bord
      live meters en een grafiek van de laatste ~30 minuten.

   2. AFWEER (quarantaine). Een binnendringer -- een IP/sessie/account dat zich
      als aanvaller gedraagt -- wordt in QUARANTAINE gezet: het schild snijdt al
      zijn verkeer af (403). Dat is de eerlijke betekenis van "onschadelijk
      maken" in een webserver: de indringer kan niets meer, niet dat we een
      OS-virus doden. Quarantaine verloopt vanzelf na een uur (of de eigenaar
      geeft eerder vrij).

   3. HYGIENE (zelf opruimen). Een veegbeurt die verlopen quarantaines, oude
      besluiten en een te lange grafiek opruimt en rapporteert wat er weg ging.

   4. RAADKAMER (bestuur). De AI KAUWT alles uit en doet VOORSTELLEN, maar voert
      niets zelf uit: een gemachtigde in de boardroom beslist per voorstel
      ACCEPTEREN / AFWIJZEN / INCONCLAAF (napraten met de AI). En zelfs bij
      "accepteren" draait alleen een actie uit een vaste, veilige lijst
      (quarantaine, vrijgeven, opruimen, een bekende zekering, een drempel) --
      nooit willekeurige code. Zo blijft de mens de baas en kan de AI het
      systeem niet stiekem herschrijven.

   Zuiver en testbaar: alle afhankelijkheden komen via ctx binnen. */
const crypto = require('crypto');

const RING = 180;                       // metingen in de grafiek (~30 min bij 10s)
const QUARANTAINE_MS = 60 * 60000;      // een indringer een uur afgesneden
const RAAD_MAX = 100;                   // audit-staart van voorstellen
const OUD_BESLUIT_MS = 24 * 60 * 60000; // afgehandeld voorstel ouder dan een dag -> opruimbaar
const AANVAL_DREMPEL = 3;               // vanaf zoveel treffers stelt de AI afsnijden voor

// De enige acties die "accepteren" mag uitvoeren. Alles daarbuiten wordt
// geweigerd: de AI kan dus niets draaien wat hier niet expliciet in staat.
const TOEGESTAAN = new Set(['quarantaine', 'vrij', 'hygiene', 'zekering', 'drempel']);

module.exports = (ctx) => {
  const { db, save } = ctx;
  const beveilig = ctx.beveilig || null;
  // Live-signaallezers (injecteerbaar voor tests); veilige defaults zonder server.
  const lees = Object.assign({
    verzoeken: () => 0,          // monotone teller sinds opstart
    bans: () => 0,               // aantal IP's op de banlijst
    actieveIps: () => 0,         // IP's met verkeer in het venster
    verdachteBronnen: () => [],  // [{ bron, treffers }] uit het schild
    geheugenMB: () => Math.round((process.memoryUsage().rss || 0) / 1e6)
  }, ctx.lees || {});
  let vorigeVerzoeken = null;

  function W() {
    if (!db.data.wacht) db.data.wacht = {};
    const w = db.data.wacht;
    if (!Array.isArray(w.grafiek)) w.grafiek = [];
    if (!w.quarantaine) w.quarantaine = {};       // bron -> { reden, sinds, tot }
    if (!Array.isArray(w.raad)) w.raad = [];      // voorstellen
    if (!w.hygiene) w.hygiene = { laatst: null, totaalOpgeruimd: 0 };
    if (!w.drempels) w.drempels = {};
    return w;
  }

  /* ---------------- Meters & grafiek ---------------- */
  function meet() {
    const w = W();
    const totaal = lees.verzoeken();
    const delta = vorigeVerzoeken == null ? 0 : Math.max(0, totaal - vorigeVerzoeken);
    vorigeVerzoeken = totaal;
    const alarm = beveilig ? beveilig.samenvatting(1) : { open: 0, kritiek: 0 };
    const sample = {
      t: Date.now(),
      verzoeken: delta,
      bans: lees.bans(),
      ips: lees.actieveIps(),
      alarm: alarm.open || 0,
      kritiek: alarm.kritiek || 0,
      quarantaine: Object.keys(w.quarantaine).length,
      geheugen: lees.geheugenMB()
    };
    w.grafiek.push(sample);
    if (w.grafiek.length > RING) w.grafiek.splice(0, w.grafiek.length - RING);
    return sample;
  }
  function meters() {
    const w = W();
    const laatste = w.grafiek[w.grafiek.length - 1] || { verzoeken: 0, bans: 0, ips: 0, alarm: 0, kritiek: 0, geheugen: lees.geheugenMB() };
    return {
      verzoeken: laatste.verzoeken, bans: laatste.bans, ips: laatste.ips,
      alarm: laatste.alarm, kritiek: laatste.kritiek, geheugen: laatste.geheugen,
      quarantaine: Object.keys(w.quarantaine).length,
      openVoorstellen: w.raad.filter(v => v.status === 'open' || v.status === 'inconclaaf').length
    };
  }
  function grafiek() { return W().grafiek.slice(); }

  /* ---------------- Afweer (quarantaine) ---------------- */
  function isoleer(bron, reden) {
    bron = String(bron || '').slice(0, 120);
    if (!bron) return null;
    const w = W();
    w.quarantaine[bron] = { reden: String(reden || 'handmatig').slice(0, 160), sinds: Date.now(), tot: Date.now() + QUARANTAINE_MS };
    save();
    if (beveilig) beveilig.meld('quarantaine', 'kritiek',
      'Bron ' + bron + ' is in quarantaine gezet (' + (reden || '') + '). Al het verkeer van deze bron wordt afgesneden.',
      { bron: 'quarantaine:' + bron });
    return w.quarantaine[bron];
  }
  function vrij(bron) {
    const w = W(); const had = !!w.quarantaine[String(bron || '')];
    delete w.quarantaine[String(bron || '')];
    if (had) save();
    return had;
  }
  // Het schild raadpleegt dit per verzoek; verlopen quarantaine dooft vanzelf.
  function inQuarantaine(bron) {
    const w = W(); const q = w.quarantaine[String(bron || '')];
    if (!q) return false;
    if (q.tot && q.tot <= Date.now()) { delete w.quarantaine[String(bron)]; save(); return false; }
    return true;
  }
  function quarantaineLijst() {
    const w = W(); const nu = Date.now();
    return Object.entries(w.quarantaine).map(([bron, q]) => ({
      bron, reden: q.reden, sinds: q.sinds, tot: q.tot,
      resterend: Math.max(0, Math.round(((q.tot || nu) - nu) / 1000))
    }));
  }

  /* ---------------- Hygiene (zelf opruimen) ---------------- */
  function opruimen() {
    const w = W(); const nu = Date.now(); let n = 0;
    for (const [bron, q] of Object.entries(w.quarantaine)) if (q.tot && q.tot <= nu) { delete w.quarantaine[bron]; n++; }
    if (w.grafiek.length > RING) { const weg = w.grafiek.length - RING; w.grafiek.splice(0, weg); n += weg; }
    const voor = w.raad.length;
    w.raad = w.raad.filter(v => !(['geaccepteerd', 'afgewezen'].includes(v.status) && v.beslistOp && (nu - v.beslistOp) > OUD_BESLUIT_MS));
    n += voor - w.raad.length;
    w.hygiene = { laatst: nu, totaalOpgeruimd: (w.hygiene.totaalOpgeruimd || 0) + n, laatstAantal: n };
    save();
    return { opgeruimd: n, quarantaine: Object.keys(w.quarantaine).length, voorstellen: w.raad.length };
  }

  /* ---------------- Raadkamer (bestuur) ---------------- */
  // Voer een voorstel-actie uit, maar ALLEEN als hij in de veilige lijst staat.
  function voerUit(actie) {
    if (!actie || !TOEGESTAAN.has(actie.soort)) return { ok: false, uitleg: 'Onbekende of niet-toegestane actie; er is niets uitgevoerd.' };
    if (actie.soort === 'quarantaine') { isoleer(actie.bron, actie.reden); return { ok: true, uitleg: 'Bron ' + actie.bron + ' in quarantaine gezet.' }; }
    if (actie.soort === 'vrij') { const had = vrij(actie.bron); return { ok: true, uitleg: had ? 'Bron vrijgegeven.' : 'Bron stond niet in quarantaine.' }; }
    if (actie.soort === 'hygiene') { const r = opruimen(); return { ok: true, uitleg: 'Opgeruimd: ' + r.opgeruimd + ' item(s).' }; }
    if (actie.soort === 'zekering') {
      const z = db.data.techniek && db.data.techniek.zekeringen && db.data.techniek.zekeringen[actie.id];
      if (!z) return { ok: false, uitleg: 'Onbekende zekering; niets gedaan.' };
      z.aan = !!actie.aan; z.reden = actie.aan ? null : 'via raadkamer'; z.sindsGesprongen = actie.aan ? null : Date.now();
      save();
      return { ok: true, uitleg: 'Zekering "' + actie.id + '" ' + (actie.aan ? 'er weer in' : 'eruit') + '.' };
    }
    if (actie.soort === 'drempel') {
      const w = W(); w.drempels[String(actie.sleutel || '').slice(0, 40)] = Number(actie.waarde) || 0; save();
      return { ok: true, uitleg: 'Drempel ' + actie.sleutel + ' = ' + (Number(actie.waarde) || 0) + '.' };
    }
    return { ok: false, uitleg: 'Niets uitgevoerd.' };
  }

  // De AI (of het bord) legt een voorstel neer. Voert NIETS uit -- dat gebeurt
  // pas als een gemachtigde het accepteert.
  function voorstel({ soort, titel, uitleg, actie }) {
    const w = W();
    const v = {
      id: crypto.randomBytes(4).toString('hex'),
      soort: soort || 'advies',
      titel: String(titel || 'Voorstel').slice(0, 120),
      uitleg: String(uitleg || '').slice(0, 600),
      actie: actie && TOEGESTAAN.has(actie.soort) ? actie : null,
      status: 'open',
      at: new Date().toISOString(), atMs: Date.now(),
      overleg: []
    };
    w.raad.unshift(v);
    if (w.raad.length > RAAD_MAX) w.raad.length = RAAD_MAX;
    save();
    return v;
  }

  // De boardroom-gemachtigde beslist: accepteren / afwijzen / inconclaaf.
  function beslis(id, verdict, notitie, wie) {
    const w = W();
    const v = w.raad.find(x => x.id === id);
    if (!v) return { ok: false, error: 'Onbekend voorstel.' };
    const note = (t) => { if (t) v.overleg.push({ door: wie || 'eigenaar', tekst: String(t).slice(0, 400), at: new Date().toISOString() }); };
    if (verdict === 'accepteren') {
      const r = v.actie ? voerUit(v.actie) : { ok: true, uitleg: 'Geen actie gekoppeld; genoteerd als akkoord.' };
      v.status = 'geaccepteerd'; v.resultaat = r.uitleg; v.beslistOp = Date.now(); v.beslistDoor = wie || null;
      note(notitie); save();
      return { ok: true, status: v.status, resultaat: r.uitleg, uitgevoerd: r.ok };
    }
    if (verdict === 'afwijzen') {
      v.status = 'afgewezen'; v.beslistOp = Date.now(); v.beslistDoor = wie || null;
      note(notitie); save();
      return { ok: true, status: v.status };
    }
    if (verdict === 'inconclaaf') {
      v.status = 'inconclaaf';
      note(notitie || 'Napraten met de AI.'); save();
      return { ok: true, status: v.status };
    }
    return { ok: false, error: 'Verdict moet accepteren, afwijzen of inconclaaf zijn.' };
  }

  /* De AI "kauwt uit": leidt uit de live-signalen concrete voorstellen af. Werkt
     ook zonder API-sleutel (deterministische heuristiek), net als de rest van het
     platform; een echte-AI-laag mag de tekst later verrijken. Maakt nooit
     dubbele open voorstellen voor dezelfde bron/actie. */
  function analyseer() {
    const w = W(); const nu = Date.now(); const gemaakt = [];
    // A. Verdachte bronnen (herhaalde aanvalstreffers) die nog niet zijn afgesneden.
    for (const s of (lees.verdachteBronnen() || [])) {
      if (!s || !s.bron || inQuarantaine(s.bron) || (s.treffers || 0) < AANVAL_DREMPEL) continue;
      if (w.raad.some(v => v.status === 'open' && v.actie && v.actie.soort === 'quarantaine' && v.actie.bron === s.bron)) continue;
      gemaakt.push(voorstel({
        soort: 'afweer', titel: 'Indringer afsnijden: ' + s.bron,
        uitleg: 'Deze bron gaf ' + s.treffers + ' aanvals-/WAF-treffers. Voorstel: in quarantaine zetten zodat al het verkeer wordt afgesneden.',
        actie: { soort: 'quarantaine', bron: s.bron, reden: 'herhaalde aanvalstreffers (' + s.treffers + ')' }
      }));
    }
    // B. Zelf opruimen als er verlopen quarantaines of oude besluiten liggen.
    const verlopen = Object.values(w.quarantaine).filter(q => q.tot && q.tot <= nu).length;
    const oud = w.raad.filter(v => ['geaccepteerd', 'afgewezen'].includes(v.status) && v.beslistOp && (nu - v.beslistOp) > OUD_BESLUIT_MS).length;
    if ((verlopen + oud) > 0 && !w.raad.some(v => v.status === 'open' && v.actie && v.actie.soort === 'hygiene')) {
      gemaakt.push(voorstel({
        soort: 'hygiene', titel: 'Zelf opruimen',
        uitleg: 'Er staan ' + verlopen + ' verlopen quarantaine(s) en ' + oud + ' oude besluiten klaar om op te ruimen.',
        actie: { soort: 'hygiene' }
      }));
    }
    return gemaakt;
  }

  // Alles wat het bord nodig heeft in één lezing.
  function bord() {
    const w = W();
    return {
      meters: meters(),
      grafiek: grafiek(),
      quarantaine: quarantaineLijst(),
      hygiene: w.hygiene,
      drempels: w.drempels,
      raad: w.raad.slice(0, 40),
      openVoorstellen: w.raad.filter(v => v.status === 'open' || v.status === 'inconclaaf').length
    };
  }

  return { meet, meters, grafiek, isoleer, vrij, inQuarantaine, quarantaineLijst,
    opruimen, voorstel, beslis, analyseer, bord, TOEGESTAAN };
};
