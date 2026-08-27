/* Het Privekantoor, deelbestand "reisdek": een vlucht is een gebeurtenis, geen
   agenda-item.

   Het Reisboek dekte de voorbereiding: legs, verblijven, documenten, programma.
   Wat eromheen ontbrak zijn de twee helften waar een reisbureau zijn geld
   verdient.

     TIJDENS   verstoringen. Een vlucht die 74 minuten later gaat, is niet een
               nieuwe tijd in een schermpje: het is een chauffeur die anders moet
               rijden, een restaurant dat bericht krijgt en een hotel dat een
               late aankomst noteert. Een verstoring krijgt daarom GEVOLGEN als
               eigen regels, elk met een eigen stand: genoteerd, geregeld of
               vervallen. Zo is te zien wat er nog open staat in plaats van
               alleen dat er iets mis is.
     NA        de nazorg. Bonnen, wat er is blijven liggen, en de punten die nog
               moeten worden bijgeschreven. Alle drie dingen die iedereen zich
               voorneemt en niemand doet, en die precies daarom in een kantoor
               horen en niet in iemands hoofd.

   WAT HIER NIET GEBEURT: vluchtstatus ophalen. Er is geen koppeling met een
   luchtvaartmaatschappij, dus een verstoring komt binnen doordat U of onze
   mensen hem noteren. Hetzelfde voorbehoud als bij Entourage en de Security
   Office, en om dezelfde reden: doen alsof wij het vanzelf zien, is de manier
   om te zorgen dat niemand meer kijkt.

   EEN VERGETEN VOORWERP DAT NIET TERUG IS, GAAT NAAR DE CONTROL TOWER. Dat is de
   reden dat dit bestand meer is dan een notitieblok: een jas die in een hotel
   hangt heeft een datum waarop iemand ernaar moet vragen, en die datum loopt
   langs dezelfde weg als een verzekering.

   Gemount via ./index.js. */
'use strict';

const GEVOLG_STANDEN = ['genoteerd', 'geregeld', 'vervallen'];
const VERGETEN = ['gezocht', 'gevonden', 'onderweg', 'terug', 'opgegeven'];

module.exports = (ctx) => {
  const { db, save, nu, rid, schoon, isDatum, getal } = ctx;
  const levens = require('../levensdossier')({ db }).voor('bureau');

  const reizenVan = key => {
    /* VREEMDE SECTIE: `reizen` is van kern/rechterhand. */
    return levens.leesVeld(key, 'reizen');
  };
  function reis(key, reisId, maak) {
    const r = reizenVan(key).find(x => x.id === reisId);
    if (!r) return null;
    if (maak) {
      if (!Array.isArray(r.verstoringen)) r.verstoringen = [];
      if (!r.nazorg || typeof r.nazorg !== 'object') r.nazorg = { bonnen: [], vergeten: [], punten: [] };
      for (const v of ['bonnen', 'vergeten', 'punten']) if (!Array.isArray(r.nazorg[v])) r.nazorg[v] = [];
    }
    return r;
  }
  const geenReis = { status: 404, error: 'Deze reis staat niet in uw reisboek.' };

  /* Een verstoring, met de gevolgen erbij. De gevolgen worden hier niet
     verzonnen: het lid of het kantoor noemt ze. Wat het systeem wel doet is ze
     als losse regels bijhouden, want "vlucht vertraagd" afvinken terwijl de
     chauffeur nog niet is verzet, is precies de fout die je wilt voorkomen. */
  function rdVerstoring(key, x) {
    const r = reis(key, String(x.reisId || ''), true);
    if (!r) return geenReis;
    const wat = schoon(x.wat, 160);
    if (!wat) return { status: 400, error: 'Wat is er misgegaan?' };
    if (r.verstoringen.length >= 200) return { status: 400, error: 'Er staan al veel verstoringen.' };
    const gevolgen = (Array.isArray(x.gevolgen) ? x.gevolgen : []).slice(0, 20)
      .map(g => ({ id: rid(), wat: schoon(g, 120), stand: 'genoteerd' })).filter(g => g.wat);
    r.verstoringen.unshift({ id: rid(), wat, op: nu(),
      soort: schoon(x.soort, 40) || 'overig', minuten: getal(x.minuten, 100000),
      notitie: schoon(x.notitie, 400), gevolgen });
    save();
    return { status: 200, ok: true };
  }
  function rdGevolg(key, x) {
    const r = reis(key, String(x.reisId || ''), false);
    if (!r) return geenReis;
    const v = (r.verstoringen || []).find(y => y.id === x.verstoringId);
    if (!v) return { status: 404, error: 'Deze verstoring staat er niet.' };
    const g = (v.gevolgen || []).find(y => y.id === x.id);
    if (!g) return { status: 404, error: 'Dit gevolg staat er niet.' };
    if (!GEVOLG_STANDEN.includes(x.stand)) return { status: 400, error: 'Onbekende stand.' };
    g.stand = x.stand; g.op = nu(); g.notitie = schoon(x.notitie, 200);
    save();
    return { status: 200, ok: true };
  }
  function rdVerstoringWeg(key, x) {
    const r = reis(key, String(x.reisId || ''), false);
    if (!r) return geenReis;
    r.verstoringen = (r.verstoringen || []).filter(y => y.id !== x.id); save();
    return { status: 200, ok: true };
  }

  function rdBon(key, x) {
    const r = reis(key, String(x.reisId || ''), true);
    if (!r) return geenReis;
    const wat = schoon(x.wat, 120);
    if (!wat) return { status: 400, error: 'Waarvoor was het?' };
    if (r.nazorg.bonnen.length >= 500) return { status: 400, error: 'Er staan al veel bonnen.' };
    r.nazorg.bonnen.unshift({ id: rid(), wat, bedragCenten: getal(x.bedragCenten, 1e10),
      op: isDatum(x.op) ? x.op : '', zakelijk: x.zakelijk === true, notitie: schoon(x.notitie, 200) });
    save();
    return { status: 200, ok: true };
  }

  /* Iets vergeten. `terugOp` is de datum waarop wij er weer achteraan gaan, en
     die gaat naar de Control Tower zolang het voorwerp niet terug is. */
  function rdVergeten(key, x) {
    const r = reis(key, String(x.reisId || ''), true);
    if (!r) return geenReis;
    const wat = schoon(x.wat, 120);
    if (!wat) return { status: 400, error: 'Wat is er blijven liggen?' };
    if (x.id) {
      const v = r.nazorg.vergeten.find(y => y.id === x.id);
      if (!v) return { status: 404, error: 'Niet gevonden.' };
      v.wat = wat; v.waar = schoon(x.waar, 100);
      if (VERGETEN.includes(x.stand)) v.stand = x.stand;
      v.terugOp = isDatum(x.terugOp) ? x.terugOp : v.terugOp || '';
      save(); return { status: 200, ok: true };
    }
    if (r.nazorg.vergeten.length >= 100) return { status: 400, error: 'De lijst is vol.' };
    r.nazorg.vergeten.unshift({ id: rid(), wat, waar: schoon(x.waar, 100), stand: 'gezocht',
      terugOp: isDatum(x.terugOp) ? x.terugOp : '', at: nu() });
    save();
    return { status: 200, ok: true };
  }

  function rdPunten(key, x) {
    const r = reis(key, String(x.reisId || ''), true);
    if (!r) return geenReis;
    const programma = schoon(x.programma, 80);
    if (!programma) return { status: 400, error: 'Welk programma?' };
    if (r.nazorg.punten.length >= 100) return { status: 400, error: 'De lijst is vol.' };
    r.nazorg.punten.unshift({ id: rid(), programma, aantal: getal(x.aantal, 1e9),
      bijgeschreven: x.bijgeschreven === true, at: nu() });
    save();
    return { status: 200, ok: true };
  }

  function reisdek(key, reisId) {
    const alle = reizenVan(key);
    const kop = alle.map(r => {
      const open = (r.verstoringen || []).reduce((a, v) =>
        a + (v.gevolgen || []).filter(g => g.stand === 'genoteerd').length, 0);
      const nz = r.nazorg || {};
      return { id: r.id, naam: r.naam, van: r.van, tot: r.tot,
        verstoringen: (r.verstoringen || []).length, openGevolgen: open,
        bonnen: (nz.bonnen || []).length,
        kwijt: (nz.vergeten || []).filter(v => v.stand !== 'terug' && v.stand !== 'opgegeven').length,
        puntenOpen: (nz.punten || []).filter(p => !p.bijgeschreven).length };
    });
    if (!reisId) return { status: 200, reizen: kop, gekozen: null, standen: GEVOLG_STANDEN, vergetenStanden: VERGETEN };
    const r = alle.find(x => x.id === reisId);
    if (!r) return geenReis;
    return { status: 200, reizen: kop, standen: GEVOLG_STANDEN, vergetenStanden: VERGETEN,
      gekozen: { id: r.id, naam: r.naam, van: r.van, tot: r.tot,
        verstoringen: r.verstoringen || [], nazorg: r.nazorg || { bonnen: [], vergeten: [], punten: [] },
        bonTotaal: ((r.nazorg || {}).bonnen || []).reduce((a, b) => a + (b.bedragCenten || 0), 0) } };
  }

  return { reisdek, rdVerstoring, rdGevolg, rdVerstoringWeg, rdBon, rdVergeten, rdPunten,
    REISDEK_STANDEN: GEVOLG_STANDEN };
};
