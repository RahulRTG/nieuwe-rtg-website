/* Foundation OS, deel "bestuur-notulen": vaststellen, lezen en terugvinden.

   NOTULEN WORDEN IN EEN VOLGENDE VERGADERING VASTGESTELD, en dat is de hele
   reden dat dit een aparte handeling is. Een vergadering die zichzelf vaststelt
   stelt niets vast: de mensen die er waren zeggen dan dat er stond wat zij
   zeiden. Pas als een volgend gezelschap het stuk aanneemt, is het een
   document. Daarna weigert alles wat wijzigt -- zie de grendels in bestuur.js.

   EN ER IS EEN OPZOEKFUNCTIE VOOR EEN BESLUIT, want daar hangt de rest aan: een
   jaarverslag mag alleen worden vastgesteld met verwijzing naar een AANGENOMEN
   besluit uit een VASTGESTELDE vergadering. Die drie voorwaarden staan hier op
   een plek, niet in elke module die ernaar vraagt (LAT.md regel 4).

   Afgesplitst uit bestuur.js op de 10 KB van keuringsregel 13. */

module.exports = (ctx, eigen) => {
  const { nu, S, audit, wie, save, schoon } = ctx;
  const { vind, beeld, mag, quorumVan } = eigen;

  /* Vaststellen: door een LATERE vergadering van hetzelfde orgaan, die zelf
     quorum had. Zonder die twee voorwaarden is vaststellen een stempel. */
  function stelVast(req, id, doorId) {
    const v = vind(id);
    if (!v) return { status: 404, error: 'Deze vergadering bestaat niet.' };
    if (v.vastgesteld) return { status: 400, error: 'Deze notulen zijn al vastgesteld op ' + String(v.vastgesteld.at).slice(0, 10) + '.' };
    const g = mag(req, v.soort, v.stad);
    if (!g.ok) return g;

    const door = vind(doorId);
    if (!door) return { status: 404, error: 'De vergadering die vaststelt, bestaat niet. Notulen worden in een VOLGENDE vergadering vastgesteld.' };
    if (door.id === v.id) {
      return { status: 400, error: 'Een vergadering kan haar eigen notulen niet vaststellen. Dan zeggen de mensen die er waren ' +
        'dat er stond wat zij zeiden; daar wordt een verslag geen document van.' };
    }
    if (door.soort !== v.soort || String(door.stad || '') !== String(v.stad || '')) {
      return { status: 400, error: 'Notulen worden vastgesteld door hetzelfde orgaan, niet door een ander.' };
    }
    if (Date.parse(door.datum) <= Date.parse(v.datum)) {
      return { status: 400, error: 'De vaststellende vergadering (' + door.datum + ') ligt niet na de vergadering die wordt vastgesteld (' +
        v.datum + ').' };
    }
    const q = quorumVan(door);
    if (!q || (door.aanwezig || []).length < q) {
      return { status: 400, error: 'De vergadering van ' + door.datum + ' had zelf geen quorum en kan dus niets vaststellen.' };
    }
    v.vastgesteld = { doorId: door.id, datum: door.datum, door: g.w.key, at: nu() };
    audit(g.w.key, 'bestuur.vastgesteld', v.id, 'vastgesteld in de vergadering van ' + door.datum);
    save();
    return { ok: true, vergadering: beeld(v),
      melding: 'Vastgesteld. De besluiten van ' + v.datum + ' liggen hiermee vast; wijzigen kan niet meer.' };
  }

  /* De opzoekfunctie waar de rest van het OS op leunt: bestaat dit besluit, is
     het AANGENOMEN, en staat het in VASTGESTELDE notulen. Drie voorwaarden, een
     plek. */
  function besluitVindbaar(besluitId, opts) {
    const id = String(besluitId || '');
    for (const v of S().vergaderingen) {
      const b = (v.besluiten || []).find(x => x.id === id);
      if (!b) continue;
      if (!b.aangenomen) return { status: 400, error: 'Dat besluit is niet aangenomen (' + b.voor.length + ' voor, ' + b.tegen.length + ' tegen).' };
      if (!v.vastgesteld) {
        return { status: 400, error: 'Het besluit van ' + v.datum + ' staat in notulen die nog niet zijn vastgesteld. ' +
          'Een concept is geen bevoegdheidsbewijs.' };
      }
      if (opts && opts.soort && v.soort !== opts.soort) {
        return { status: 400, error: 'Dit besluit komt uit een ' + v.soort + 'svergadering; hier is een besluit van het ' + opts.soort + 'e orgaan nodig.' };
      }
      return { ok: true, besluit: b, vergadering: v };
    }
    return { status: 404, error: 'Dat besluit staat niet in een van de vergaderingen.' };
  }

  function lijst(req, filter) {
    const f = filter || {};
    const w = wie(req);
    const stad = f.stad ? String(f.stad) : null;
    let rijen = S().vergaderingen.filter(v => {
      if (v.soort === 'landelijk') return w.landelijk;
      if (stad && v.stad !== stad) return false;
      return w.landelijk || w.zetels.some(z => z.stad === v.stad);
    });
    if (f.soort) rijen = rijen.filter(v => v.soort === String(f.soort));
    rijen = rijen.slice().sort((a, b) => String(b.datum).localeCompare(String(a.datum)));
    /* De open notulen apart tellen: een stapel concepten die niemand vaststelt
       is precies het gat waar een bestuur in valt, en een lijst zonder dat
       getal laat het onopgemerkt groeien. */
    return { ok: true, aantal: rijen.length,
      nietVastgesteld: rijen.filter(v => !v.vastgesteld).length,
      vergaderingen: rijen.slice(0, 200).map(beeld) };
  }

  function een(req, id) {
    const v = vind(id);
    if (!v) return { status: 404, error: 'Deze vergadering bestaat niet.' };
    const g = mag(req, v.soort, v.stad);
    if (!g.ok) return g;
    return { ok: true, vergadering: beeld(v) };
  }

  /* Een agendapunt bijschrijven kan tot de vaststelling; daarna niet meer. Dat
     lijkt klein en is het niet: "even een punt toevoegen aan de notulen van
     vorige maand" is hoe een besluitenlijst onbetrouwbaar wordt. */
  function agendaBij(req, id, punt) {
    const v = vind(id);
    if (!v) return { status: 404, error: 'Deze vergadering bestaat niet.' };
    if (v.vastgesteld) return { status: 400, error: 'De notulen zijn vastgesteld; de agenda ligt vast.' };
    const g = mag(req, v.soort, v.stad);
    if (!g.ok) return g;
    const t = schoon(punt, 120);
    if (!t) return { status: 400, error: 'Wat is het agendapunt?' };
    if (!Array.isArray(v.agenda)) v.agenda = [];
    if (v.agenda.length >= 30) return { status: 400, error: 'Dertig agendapunten is genoeg voor een vergadering.' };
    v.agenda.push(t);
    save();
    return { ok: true, vergadering: beeld(v) };
  }

  return { stelVast, besluitVindbaar, lijst, een, agendaBij };
};
