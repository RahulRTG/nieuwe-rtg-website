/* RTG Festival (deelmodule): DE GASTENKANT.

   TOT NU TOE HAD DEZE WERELD ALLEEN EEN ORGANISATIEKANT. Er stonden zes routes
   voor een lid (de groep) en er was geen enkel scherm dat ze gebruikte; wie een
   pas kocht aan de kassa, kon zijn eigen pascode daarna nergens meer zien. Dat
   is niet "nog geen scherm" maar een gat: par. 10 van FESTIVAL.md vraagt of een
   gast een heel weekend kan beleven zonder organisatorisch gedoe, en het
   antwoord was dat hij zijn kaartje niet eens kon vinden.

   EEN GAST ZIET ZIJN EIGEN DINGEN EN VERDER NIETS. Geen bezetting, geen
   uitzonderingen, geen gereedheid, geen namen van andere passen. Wat hier
   uitkomt hangt aan EEN codenaam, en die komt uit de sessie (routes/festival/
   gast.js) en nooit uit het lichaam.

   ALLEEN BEVESTIGDE SETS. Het programma dat een gast ziet, bevat geen
   voornemens. Een artiest tonen die nog niet heeft getekend, is precies wat
   CLAUDE.md verbiedt -- doen alsof een boeking rond is -- en het is bovendien de
   ene plek waar dat een echte gedupeerde heeft: iemand koopt een kaartje voor
   een naam die er niet staat.

   HIJ ZOEKT ZIJN FESTIVAL NIET OP, HIJ HEEFT ER EEN. Er is geen publieke lijst
   met festivals en die komt er hier niet bij (dat zou een marketingpagina zijn,
   en die zijn er bewust uit). Een editie verschijnt voor een gast als hij er
   iets heeft: een pas op zijn codenaam, of een groep waar hij in zit. */
'use strict';

module.exports = (ctx) => {
  const { schoon, festivalAlle, editieVind, dagVind, plekVind, groepenVan } = ctx;

  const mijnPassen = (e, wie) => Object.values(e.passen || {})
    .filter(p => !p.ingetrokken && p.drager === wie);

  /* De edities waar deze gast iets heeft. Dit loopt over alle festivals, en dat
     is met opzet de saaie manier: een index op codenaam zou een tweede plek zijn
     die weet wie waar een pas heeft, en die loopt uit de pas zodra er een pas
     wordt ingetrokken (LAT-regel 4). */
  function gastEdities(codenaam) {
    const wie = schoon(codenaam, 60);
    if (!wie) return { status: 400, error: 'Geen codenaam in deze sessie.' };
    const uit = [];
    for (const f of festivalAlle()) {
      for (const e of Object.values(f.edities || {})) {
        const passen = mijnPassen(e, wie).length;
        const groepen = groepenVan(e, wie).length;
        if (!passen && !groepen) continue;
        uit.push({ festival: f.id, naam: f.naam, editie: e.id, jaar: e.jaar,
          dagen: (e.dagen || []).map(d => ({ id: d.id, datum: d.datum, open: d.open, sluit: d.sluit })),
          passen, groepen });
      }
    }
    uit.sort((a, b) => b.jaar - a.jaar);
    return { ok: true, edities: uit };
  }

  /* De passen van deze gast, met de rechten in leesbare vorm. De CODE staat
     erbij -- dat is het hele punt van dit scherm -- en die is van hem: hij komt
     alleen langs zijn eigen codenaam naar buiten. */
  function gastPassen(fid, eid, codenaam) {
    const e = editieVind(fid, eid);
    if (!e) return { status: 404, error: 'Deze editie bestaat niet.' };
    const wie = schoon(codenaam, 60);
    if (!wie) return { status: 400, error: 'Geen codenaam in deze sessie.' };

    const uit = mijnPassen(e, wie).map(p => ({
      code: p.code, soort: p.soort, at: p.at,
      rechten: (p.rechten || []).map(r => ({
        soort: r.soort,
        dagen: (r.dagen || []).map(id => (dagVind(e, id) || {}).datum).filter(Boolean),
        plek: r.plek ? (plekVind(e, r.plek) || {}).naam || null : null,
        van: r.van || null, tot: r.tot || null
      }))
    }));
    return { ok: true, passen: uit };
  }

  /* Het programma van een dag, zoals een gast het mag zien. */
  function gastProgramma(fid, eid, dagId) {
    const e = editieVind(fid, eid);
    if (!e) return { status: 404, error: 'Deze editie bestaat niet.' };
    const dag = dagVind(e, dagId);
    if (!dag) return { status: 404, error: 'Deze dag staat niet in de editie.' };
    const uit = Object.values(e.boekingen || {})
      .filter(b => b.dag === dag.id && b.stand === 'bevestigd')
      .map(b => ({ artiest: b.artiest, van: b.van, tot: b.tot,
        podium: (plekVind(e, b.podium) || {}).naam || null }))
      .sort((a, b) => a.van.localeCompare(b.van));
    /* HOEVEEL ER NIET STAAN, STAAT ER WEL. Anders lijkt een programma dat voor
       de helft nog niet rond is op een programma dat af is, en dan is stilte
       weer een uitspraak (dezelfde regel als `ongemeten` in ./uitzondering.js). */
    const nogNiet = Object.values(e.boekingen || {})
      .filter(b => b.dag === dag.id && b.stand === 'voornemen').length;
    return { ok: true, dag: dag.id, datum: dag.datum, programma: uit, nogNiet };
  }

  return { gastEdities, gastPassen, gastProgramma };
};
