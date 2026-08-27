/* Het Privekantoor, deelbestand "beveiliging": de Security Office.

   Een van de drie kamers die op de plattegrond als "in aanbouw" stonden. Vier
   dingen, en ze horen bij elkaar omdat ze alle vier over hetzelfde gaan: wat er
   klaarstaat voordat er iets gebeurt.

     posten      alarm, camera's, kluizen, toegang, brand -- per woning, met het
                 contract en de keuring erbij
     reisrisico  wat er over een bestemming is vastgelegd, met een houdbaarheid
     digitaal    wachtwoordrondes, certificaten, apparaten, back-ups
     incidenten  wat er wel is gebeurd, met de zaak die eruit voortkwam

   WAT DIT UITDRUKKELIJK NIET IS, en dat is de belangrijkste zin van dit bestand:
   een dreigingsdienst. Wij halen geen reisadviezen op, wij scannen geen netwerk
   en wij beoordelen geen land. Alles hier is wat U of onze mensen hebben
   VASTGELEGD, en het scherm zegt dat erbij. Entourage doet hetzelfde met
   inreisvereisten, en om dezelfde reden: iets beweren over veiligheid wat wij
   niet kunnen naslaan is gevaarlijker dan zwijgen, want er wordt naar gehandeld.

   Vandaar ook dat reisrisico een `tot` heeft dat verplicht is. Een risico-
   inschatting zonder houdbaarheidsdatum is over een half jaar geen inschatting
   meer maar een herinnering, en die staat dan wel met een kleurtje op het scherm.

   HET INCIDENT IS DE VERBINDING. Een incident opent hier geen los dossier maar
   een ZAAK van soort 'warroom' (cases.js): team, tijdlijn, en een mens die hem
   oppakt. Zonder die koppeling zou er een tweede plek zijn waar iets loopt, en
   dan is de vraag "waar staat dit ook alweer" terug.

   Gemount via ./index.js. */
'use strict';

const POSTEN = ['alarm', 'camera', 'kluis', 'toegang', 'brand', 'overig'];
const NIVEAUS = ['laag', 'verhoogd', 'hoog'];
const DIGITAAL = ['wachtwoordronde', 'certificaat', 'apparaat', 'back-up', 'overig'];

module.exports = (ctx) => {
  const { db, save, nu, rid, schoon, isDatum, caseOpen } = ctx;
  const levens = require('../levensdossier')({ db }).voor('bureau');


  function B(key) {
    const b = levens.veld(key, 'beveiliging');
    for (const v of ['posten', 'reisrisico', 'digitaal', 'incidenten']) if (!Array.isArray(b[v])) b[v] = [];
    return b;
  }
  // lezen maakt niets aan; zie de uitleg in cases.js
  function lees(key) {
    const b = levens.leesVeld(key, 'beveiliging');
    return { posten: b.posten || [], reisrisico: b.reisrisico || [],
      digitaal: b.digitaal || [], incidenten: b.incidenten || [] };
  }

  function bvPost(key, x) {
    const waar = schoon(x.waar, 80);
    if (!waar) return { status: 400, error: 'Waar staat of hangt het?' };
    const b = B(key);
    const rec = { waar, soort: POSTEN.includes(x.soort) ? x.soort : 'overig',
      leverancier: schoon(x.leverancier, 80), contractTot: isDatum(x.contractTot) ? x.contractTot : '',
      keuringOp: isDatum(x.keuringOp) ? x.keuringOp : '', notitie: schoon(x.notitie, 200) };
    if (x.id) {
      const p = b.posten.find(y => y.id === x.id);
      if (!p) return { status: 404, error: 'Deze post staat er niet.' };
      Object.assign(p, rec); save(); return { status: 200, ok: true };
    }
    if (b.posten.length >= 300) return { status: 400, error: 'De lijst is vol.' };
    b.posten.unshift(Object.assign({ id: rid(), at: nu() }, rec)); save();
    return { status: 200, ok: true };
  }
  function bvPostWeg(key, id) { const b = B(key); b.posten = b.posten.filter(x => x.id !== id); save(); return { status: 200, ok: true }; }

  function bvRisico(key, x) {
    const land = schoon(x.land, 60);
    if (!land) return { status: 400, error: 'Over welke bestemming gaat het?' };
    /* De houdbaarheid is VERPLICHT. Zie de kop: een inschatting zonder datum
       wordt vanzelf een bewering die niemand meer heeft nagekeken. */
    if (!isDatum(x.tot)) return { status: 400, error: 'Tot wanneer geldt deze inschatting? Zonder houdbaarheid leggen wij hem niet vast.' };
    const b = B(key);
    const rec = { land, niveau: NIVEAUS.includes(x.niveau) ? x.niveau : 'laag',
      bron: schoon(x.bron, 100), tot: x.tot, notitie: schoon(x.notitie, 400) };
    if (x.id) {
      const r = b.reisrisico.find(y => y.id === x.id);
      if (!r) return { status: 404, error: 'Niet gevonden.' };
      Object.assign(r, rec); save(); return { status: 200, ok: true };
    }
    if (b.reisrisico.length >= 300) return { status: 400, error: 'De lijst is vol.' };
    b.reisrisico.unshift(Object.assign({ id: rid(), at: nu() }, rec)); save();
    return { status: 200, ok: true };
  }
  function bvRisicoWeg(key, id) { const b = B(key); b.reisrisico = b.reisrisico.filter(x => x.id !== id); save(); return { status: 200, ok: true }; }

  function bvDigitaal(key, x) {
    const wat = schoon(x.wat, 100);
    if (!wat) return { status: 400, error: 'Wat controleren wij?' };
    const b = B(key);
    const rec = { wat, soort: DIGITAAL.includes(x.soort) ? x.soort : 'overig',
      volgende: isDatum(x.volgende) ? x.volgende : '', notitie: schoon(x.notitie, 200) };
    if (x.id) {
      const d = b.digitaal.find(y => y.id === x.id);
      if (!d) return { status: 404, error: 'Niet gevonden.' };
      Object.assign(d, rec); save(); return { status: 200, ok: true };
    }
    if (b.digitaal.length >= 200) return { status: 400, error: 'De lijst is vol.' };
    b.digitaal.unshift(Object.assign({ id: rid(), at: nu() }, rec)); save();
    return { status: 200, ok: true };
  }
  function bvDigitaalWeg(key, id) { const b = B(key); b.digitaal = b.digitaal.filter(x => x.id !== id); save(); return { status: 200, ok: true }; }

  /* Een incident melden. Dit maakt GEEN eigen dossiertje maar een zaak van soort
     'warroom': daar zit het team, de tijdlijn en de mens. Wat hier blijft staan
     is de verwijzing, zodat de Security Office kan tonen wat er is gebeurd
     zonder de waarheid over de afhandeling een tweede keer te bewaren. */
  function bvIncident(key, x) {
    const wat = schoon(x.wat, 120);
    if (!wat) return { status: 400, error: 'Wat is er gebeurd?' };
    const b = B(key);
    if (b.incidenten.length >= 500) b.incidenten.pop();
    const zaak = caseOpen(key, { titel: wat, wat: schoon(x.details, 800),
      soort: 'warroom', domein: 'huishouden' });
    const rij = { id: rid(), wat, op: nu(), soort: schoon(x.soort, 40) || 'overig',
      caseId: (zaak && zaak.zaak && zaak.zaak.id) || '' };
    b.incidenten.unshift(rij); save();
    return { status: 200, ok: true, incident: rij, zaak: zaak && zaak.zaak };
  }

  function beveiliging(key) {
    const b = lees(key);
    return { status: 200, posten: b.posten, reisrisico: b.reisrisico, digitaal: b.digitaal,
      incidenten: b.incidenten.slice(0, 60), posttypen: POSTEN, niveaus: NIVEAUS, digitaalsoorten: DIGITAAL,
      bron: 'Alles hier is vastgelegd door u of door onze mensen. Wij halen geen reisadviezen op en scannen geen netwerk: wat er niet staat, weten wij niet.' };
  }

  return { beveiliging, bvPost, bvPostWeg, bvRisico, bvRisicoWeg, bvDigitaal, bvDigitaalWeg, bvIncident,
    BEVEILIGING_POSTEN: POSTEN };
};
