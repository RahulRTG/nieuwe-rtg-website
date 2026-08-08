/* RTF Living Lab, deel "apparatuur": de fysieke onderzoeksomgeving. Ruimtes,
   werkbanken, camera's, sensoren, 3D-printers, laptops -- met reserveringen,
   bevoegdheden, veiligheidsinstructies, onderhoud en kalibratie.

   DE REDEN DAT DIT IN HETZELFDE SYSTEEM ZIT als het onderzoek: een meting is
   niets waard zonder te weten waarmee hij is gedaan. Een sensor die een half
   jaar niet is gekalibreerd levert getallen die er precies zo uitzien als goede
   getallen. Daarom legt een reservering de KALIBRATIESTAND vast op het moment
   van gebruik, en niet alleen "apparaat 7". Blijkt later dat de kalibratie
   ondeugde, dan is exact terug te vinden welke experimenten eraan hingen.

   TWEE POORTEN, en ze doen verschillende dingen:

   - BEVOEGDHEID. Wie het apparaat mag bedienen. Dit is een lijst per apparaat,
     niet een rol -- een projectleider is niet automatisch bevoegd op een
     lasersnijder, en een zestienjarige buurtonderzoeker kan dat juist wél zijn
     omdat hij de instructie heeft gedaan.
   - INSTRUCTIE. Of díe persoon de veiligheidsinstructie heeft gehad, en of die
     nog geldig is. Bevoegdheid zonder verloopdatum is hoe een instructie uit
     2019 een reservering in 2026 goedkeurt.

   Het REGISTER staat hier: wat er is, wie erop bevoegd is, wanneer het is
   gekalibreerd en wat eraan stuk is. Het GEBRUIK -- reserveren, uitgifte,
   innemen -- staat in ./apparatuurgebruik.js, dat hier zijn poorten vandaan
   haalt. Afgesplitst toen dit bestand de 10 KB passeerde. */
'use strict';

const SOORTEN = ['ruimte', 'werkbank', 'sensor', 'camera', 'printer3d', 'laptop', 'gereedschap', 'voertuig', 'overig'];

module.exports = (ctx) => {
  const { nu, rid, schoon, getal, S, audit, vindLab, save } = ctx;

  const A = () => S().apparatuur;
  const vind = id => A().find(a => a.id === String(id || '')) || null;
  const dag = d => { const t = String(d || '').trim(); return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : null; };
  const pub = a => ({ id: a.id, labId: a.labId, naam: a.naam, soort: a.soort, plek: a.plek, actief: a.actief,
    instructie: a.instructie, kalibratie: a.kalibratie, onderhoud: a.onderhoud,
    bevoegd: a.bevoegd.map(b => ({ wie: b.wie, tot: b.tot })), uit: a.uit, at: a.at });

  function apparaatBij(b, wie) {
    b = b || {};
    const lab = vindLab(b.labId); if (!lab) return { status: 404, error: 'Dit lab bestaat niet.' };
    const naam = schoon(b.naam, 100);
    if (naam.length < 2) return { status: 400, error: 'Hoe heet dit apparaat of deze ruimte?' };
    if (!SOORTEN.includes(b.soort)) return { status: 400, error: 'Kies een soort: ' + SOORTEN.join(', ') + '.' };
    if (A().filter(a => a.labId === lab.id).length >= 5000) return { status: 400, error: 'Het apparatuurregister van dit lab zit vol.' };
    const a = { id: rid(), labId: lab.id, naam, soort: b.soort, plek: schoon(b.plek, 100), actief: true,
      instructie: schoon(b.instructie, 1000),
      // kalibratie: laatste ijking + hoeveel maanden hij geldig is (0 = n.v.t.)
      kalibratie: { op: null, door: null, geldigMaanden: getal(b.geldigMaanden, 0, 120), stand: '' },
      onderhoud: [], bevoegd: [], uit: null, reserveringen: [], at: nu() };
    A().unshift(a);
    audit(lab.id, 'app.bij', wie, a.id, naam);
    save();
    return { ok: true, apparaat: pub(a) };
  }

  function apparatuur(labId) {
    const lab = vindLab(labId); if (!lab) return { status: 404, error: 'Dit lab bestaat niet.' };
    return { ok: true, soorten: SOORTEN, apparatuur: A().filter(a => a.labId === lab.id).map(pub) };
  }

  /* Bevoegdheid verlenen, met een einddatum. Zonder einddatum weigert hij: een
     bevoegdheid die nooit verloopt is een bevoegdheid die niemand meer nakijkt. */
  function bevoegdZet(id, b, wie) {
    const a = vind(id); if (!a) return { status: 404, error: 'Dit apparaat bestaat niet.' };
    b = b || {};
    const naam = schoon(b.wie, 80);
    if (naam.length < 2) return { status: 400, error: 'Wie wordt hier bevoegd op?' };
    if (b.weg) {
      a.bevoegd = a.bevoegd.filter(x => x.wie !== naam);
      audit(a.labId, 'app.bevoegdWeg', wie, a.id, naam);
      save();
      return { ok: true, apparaat: pub(a) };
    }
    const tot = dag(b.tot);
    if (!tot) return { status: 400, error: 'Tot wanneer geldt deze bevoegdheid? (jjjj-mm-dd) Een bevoegdheid zonder einddatum kijkt niemand meer na.' };
    if (tot <= nu().slice(0, 10)) return { status: 400, error: 'Die einddatum ligt niet in de toekomst.' };
    if (a.bevoegd.length >= 500) return { status: 400, error: 'Het bevoegdhedenregister van dit apparaat zit vol.' };
    a.bevoegd = a.bevoegd.filter(x => x.wie !== naam);
    a.bevoegd.push({ wie: naam, tot, instructieOp: dag(b.instructieOp) || nu().slice(0, 10), door: schoon(wie, 80) || 'lab' });
    audit(a.labId, 'app.bevoegd', wie, a.id, naam + ' tot ' + tot);
    save();
    return { ok: true, apparaat: pub(a) };
  }

  const magBedienen = (a, naam) => {
    const v = a.bevoegd.find(x => x.wie === schoon(naam, 80));
    return v && v.tot > nu().slice(0, 10) ? v : null;
  };

  function kalibratieZet(id, b, wie) {
    const a = vind(id); if (!a) return { status: 404, error: 'Dit apparaat bestaat niet.' };
    b = b || {};
    const door = schoon(b.door, 80);
    if (door.length < 2) return { status: 400, error: 'Wie heeft dit apparaat gekalibreerd?' };
    a.kalibratie = { op: dag(b.op) || nu().slice(0, 10), door,
      geldigMaanden: b.geldigMaanden != null ? getal(b.geldigMaanden, 0, 120) : a.kalibratie.geldigMaanden,
      stand: schoon(b.stand, 200) };
    audit(a.labId, 'app.kalibratie', door, a.id, a.kalibratie.op);
    save();
    return { ok: true, apparaat: pub(a) };
  }

  /* Is de kalibratie nog geldig? `geldigMaanden: 0` betekent "niet van
     toepassing" (een werkbank kalibreer je niet) en dat is iets anders dan
     "verlopen" -- die twee door elkaar halen is precies hoe een meter groen
     blijft terwijl er niets gemeten is. */
  function kalibratieStand(a, opDatum) {
    if (!a.kalibratie.geldigMaanden) return { nvt: true, geldig: true, tot: null };
    if (!a.kalibratie.op) return { nvt: false, geldig: false, tot: null, reden: 'nooit gekalibreerd' };
    const tot = new Date(a.kalibratie.op);
    tot.setMonth(tot.getMonth() + a.kalibratie.geldigMaanden);
    const totS = tot.toISOString().slice(0, 10);
    const ref = dag(opDatum) || nu().slice(0, 10);
    return { nvt: false, geldig: ref <= totS, tot: totS, reden: ref <= totS ? '' : 'kalibratie verlopen op ' + totS };
  }

  function onderhoudBij(id, b, wie) {
    const a = vind(id); if (!a) return { status: 404, error: 'Dit apparaat bestaat niet.' };
    b = b || {};
    const wat = schoon(b.wat, 300);
    if (wat.length < 3) return { status: 400, error: 'Wat is er aan onderhoud gedaan of nodig?' };
    const r = { id: rid(), wat, soort: b.soort === 'storing' ? 'storing' : 'onderhoud',
      open: b.soort === 'storing' && !b.opgelost, door: schoon(wie, 80) || 'lab', at: nu() };
    a.onderhoud.unshift(r);
    if (a.onderhoud.length > 200) a.onderhoud.pop();
    // een open storing haalt het apparaat uit de roulatie; dat is de hele reden
    // dat storingen hier staan en niet in een los notitieveld
    if (r.open) a.actief = false;
    audit(a.labId, 'app.onderhoud', wie, a.id, r.soort);
    save();
    return { ok: true, apparaat: pub(a) };
  }

  function storingOp(id, b, wie) {
    const a = vind(id); if (!a) return { status: 404, error: 'Dit apparaat bestaat niet.' };
    b = b || {};
    const r = a.onderhoud.find(x => x.id === String(b.meldingId || ''));
    if (!r) return { status: 404, error: 'Deze melding bestaat niet.' };
    if (!r.open) return { status: 409, error: 'Deze melding staat al dicht.' };
    r.open = false; r.opgelostDoor = schoon(wie, 80) || 'lab'; r.opgelostAt = nu();
    r.hoe = schoon(b.hoe, 300);
    if (!a.onderhoud.some(x => x.open)) a.actief = true;
    audit(a.labId, 'app.storingOp', wie, a.id, r.id);
    save();
    return { ok: true, apparaat: pub(a) };
  }

  return { apparaatBij, apparatuur, bevoegdZet, magBedienen, kalibratieZet, kalibratieStand,
    onderhoudBij, storingOp, vind, pub, SOORTEN };
};
