/* RTG STUDIO: zelf muziek maken.

   De kern van een muziekprogramma als FL Studio, teruggebracht tot wat een mens
   in een middag leert: een RASTER met kanalen en stappen, een NOTENROL voor wat
   een toonhoogte heeft, een MENGPANEEL, en een AI die iets neerzet waar je
   verder mee kunt. Wat er niet in zit zijn de duizend knoppen waar niemand ooit
   aankomt.

   DRIE REGELS DIE HIER NIET ONDERHANDELBAAR ZIJN.

   1. ALLES WORDT OPGEWEKT, NIETS WORDT GELEEND. Elke klank komt uit de app zelf
      (kern/muziek-instrumenten.js legt uit waarom). Daardoor zit er geen licentie
      van een ander in wat jij maakt -- en daarom mag jouw muziek wél onder je
      eigen clip, terwijl een muziekbibliotheek dat niet mocht.

   2. DE AI ZET NEER, JIJ BENT DE MAKER. Rahul levert een VOORSTEL: noten en
      stappen die als gewone, bewerkbare inhoud in je raster landen zodra jij dat
      wilt. Nooit een klaar bestand, nooit iets dat je niet kunt uit elkaar
      halen. RTG claimt niets van wat jij maakt, en Rahul evenmin.

   3. HET STUK IS VAN JOU EN BLIJFT BIJ JOU. De track is een handvol getallen
      (welke stap, welke toon), geen audiobestand -- dus hij is klein, hij is te
      lezen, en hij is mee te nemen. Wat er klinkt, rekent je eigen toestel uit.

   Wat hier NIET komt: een teller wie de meeste tracks maakt, een uitgelichte
   lijst, of een aanbeveling om "vandaag nog iets te maken". Een instrument
   hoort te wachten tot je het pakt. */
const I = require('./muziek-instrumenten');

module.exports = ({ db, save, crypto, schoon }) => {
  const nu = () => new Date().toISOString();
  const rid = () => 'm' + crypto.randomBytes(5).toString('hex');
  const getal = (v, min, max, terug) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : terug;
  };

  function T() {
    if (!Array.isArray(db.data.muziek)) db.data.muziek = [];
    return db.data.muziek;
  }
  const trackMet = (id) => T().find(t => t.id === String(id || '')) || null;

  /* Een kanaal opschonen. Alles wat niet klopt valt weg -- we weigeren geen heel
     stuk om één rare noot, want dan verliest iemand zijn werk om een detail.

     EEN ONBEKEND INSTRUMENT LEVERT GEEN KANAAL OP. De verleiding is om er dan
     maar iets van te maken (een kick, zeg), maar dan hoort de maker iets anders
     dan hij vroeg zonder dat iemand hem dat vertelt -- en een fout van Rahul
     wordt zo onhoorbaar én verkeerd. Weg is eerlijker. Een mens kan dit niet
     eens veroorzaken: het scherm biedt alleen instrumenten aan die bestaan. */
  function schoonKanaal(k, stappen) {
    if (!I.bestaat(k && k.instrument)) return null;
    const inst = k.instrument;
    const uit = { id: (k && k.id) || rid(), instrument: inst,
      naam: schoon((k && k.naam) || I.INSTRUMENTEN[inst].naam, 24),
      volume: Math.max(0, Math.min(1, Number(k && k.volume != null ? k.volume : 0.8))) || 0,
      pan: Math.max(-1, Math.min(1, Number((k && k.pan) || 0))) || 0,
      stil: !!(k && k.stil) };
    if (I.soortVan(inst) === 'slag') {
      const rij = Array.isArray(k && k.stappen) ? k.stappen : [];
      uit.stappen = Array.from(new Set(rij.map(s => getal(s, 0, stappen - 1, -1)).filter(s => s >= 0)))
        .sort((a, b) => a - b).slice(0, stappen);
    } else {
      const rij = Array.isArray(k && k.noten) ? k.noten : [];
      uit.noten = rij.map(n => ({
        stap: getal(n && n.stap, 0, stappen - 1, -1),
        toon: getal(n && n.toon, I.TOON_MIN, I.TOON_MAX, -1),
        lengte: getal(n && n.lengte, 1, stappen, 1)
      })).filter(n => n.stap >= 0 && n.toon >= 0).slice(0, I.MAX_NOTEN)
        .sort((a, b) => a.stap - b.stap || a.toon - b.toon);
    }
    return uit;
  }

  /* Een heel stuk opschonen. Dit is de enige poort waar invoer doorheen gaat;
     zowel wat een mens typt als wat Rahul voorstelt komt hierlangs. */
  function schoonTrack(basis, invoer) {
    const v = invoer || {};
    const maten = getal(v.maten, 1, I.MAX_MATEN, basis.maten || 1);
    const stappen = I.stappenVoor(maten);
    const kanalen = (Array.isArray(v.kanalen) ? v.kanalen : basis.kanalen || [])
      .slice(0, I.MAX_KANALEN).map(k => schoonKanaal(k, stappen)).filter(Boolean);
    return Object.assign({}, basis, {
      naam: schoon(v.naam != null ? v.naam : basis.naam, 60) || 'Naamloos',
      bpm: getal(v.bpm, I.BPM_MIN, I.BPM_MAX, basis.bpm || 100),
      maten, kanalen,
      // "klaar" betekent: dit stuk is af genoeg om ergens anders te gebruiken.
      // Het is een keuze van de maker, geen oordeel van ons.
      klaar: v.klaar != null ? !!v.klaar : !!basis.klaar,
      bewerkt: nu()
    });
  }

  const publiek = (t) => ({ id: t.id, naam: t.naam, bpm: t.bpm, maten: t.maten,
    stappen: I.stappenVoor(t.maten), kanalen: t.kanalen, klaar: !!t.klaar,
    at: t.at, bewerkt: t.bewerkt });
  // Voor een lijst hoeven de noten niet mee; die zijn het grootste stuk.
  const kort = (t) => ({ id: t.id, naam: t.naam, bpm: t.bpm, maten: t.maten,
    kanalen: (t.kanalen || []).length, klaar: !!t.klaar, at: t.at, bewerkt: t.bewerkt });

  function maak(key, invoer) {
    const lijst = T();
    if (lijst.filter(t => t.key === key).length >= I.MAX_TRACKS) {
      return { status: 409, error: 'U heeft ' + I.MAX_TRACKS + ' stukken; haal er eerst een weg.' };
    }
    const leeg = { id: rid(), key, naam: 'Naamloos', bpm: 100, maten: 1, kanalen: [], klaar: false, at: nu() };
    const start = (invoer && invoer.leeg)
      ? leeg
      : Object.assign({}, leeg, { kanalen: I.beginKanalen() });
    const t = schoonTrack(start, invoer || {});
    lijst.unshift(t);
    save();
    return { status: 200, ok: true, track: publiek(t) };
  }

  const mijne = (key) => T().filter(t => t.key === key);
  const mijn = (key) => ({ status: 200, tracks: mijne(key).map(kort),
    instrumenten: I.INSTRUMENTEN, stappenPerMaat: I.STAPPEN_PER_MAAT,
    maxMaten: I.MAX_MATEN, maxKanalen: I.MAX_KANALEN, bpmMin: I.BPM_MIN, bpmMax: I.BPM_MAX,
    toonMin: I.TOON_MIN, toonMax: I.TOON_MAX });

  function open(key, id) {
    const t = trackMet(id);
    if (!t || t.key !== key) return { status: 404, error: 'Dit stuk bestaat niet.' };
    return { status: 200, track: publiek(t) };
  }

  function bewaar(key, id, invoer) {
    const t = trackMet(id);
    if (!t || t.key !== key) return { status: 404, error: 'Dit stuk bestaat niet.' };
    Object.assign(t, schoonTrack(t, invoer));
    save();
    return { status: 200, ok: true, track: publiek(t) };
  }

  function weg(key, id) {
    const t = trackMet(id);
    if (!t || t.key !== key) return { status: 404, error: 'Dit stuk bestaat niet.' };
    db.data.muziek = T().filter(x => x.id !== t.id);
    save();
    return { status: 200, ok: true };
  }

  /* De vraag die Clips stelt: mag deze persoon deze muziek gebruiken?
     Het antwoord is alleen ja als het stuk VAN HEM is en hij het zelf klaar
     noemde. Zo blijft de belofte van kern/clips-studio.js overeind: onder een
     clip staat alleen muziek waar geen licentie van een ander in zit. */
  function eigenTrack(key, id) {
    const t = trackMet(id);
    if (!t || t.key !== key) return null;
    if (!t.klaar) return null;
    return { id: t.id, naam: t.naam, bpm: t.bpm, maten: t.maten };
  }

  return { muziekMaak: maak, muziekMijn: mijn, muziekOpen: open, muziekBewaar: bewaar,
    muziekWeg: weg, muziekEigenTrack: eigenTrack, muziekSchoonTrack: schoonTrack,
    muziekPubliek: publiek, muziekTrackMet: trackMet };
};
