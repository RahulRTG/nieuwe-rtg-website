/* THUIS -- de reis is voorbij en de reiziger is terug.

   WAAROM DIT BESTAAT. Een reisaanvraag stopte bij `bevestigd`, en daarna gebeurde
   er in het systeem niets meer: of de reis doorging, en of de reiziger heelhuids
   terug is, stond nergens. Daardoor kon TravelOS geen geslaagde uitkomst tellen
   (besluit C3 van de eigenaar, 27 september 2026, AUTONOMIE.md par. 2.5): een
   bevestiging is een toezegging, geen geleverde reis.

   DRIE REGELS.

   1. ALLEEN NA EEN BEVESTIGDE REIS DIE VERTROKKEN IS. Een reis die nog moet
      beginnen kan niet thuis zijn, en een aanvraag, een lopende wijziging of een
      afgezegde reis ook niet. De vertrekdatum is de ondergrens; de eind-datum kent
      een reisaanvraag niet, en die wordt hier niet geraden.
   2. HET LID OF HET KANTOOR, en het spoor zegt wie. Het lid weet het als eerste;
      het kantoor zet het als het lid het niet doet. Een lid kan alleen zijn eigen
      reis thuis melden.
   3. THUIS IS EEN EINDE EN GEEN OORDEEL. Het zegt dat de reis plaatsvond, niet dat
      ze goed was -- een tevredenheidscijfer is hier met opzet geen veld. En het
      verplaatst geen geld: de geldstand van de reis blijft wat hij was.

   Een tweede melding wordt geweigerd (409, de reis is al thuis): dat is een
   toestandscontrole, en de stand verandert er niet door. */
'use strict';

module.exports = ({ pak, spoor, schoon, nu, save }) => {
  function markeerThuis({ ref, doorLid, key, door }) {
    const wie = doorLid ? 'lid' : schoon(door, 60);
    if (!doorLid && !wie) return { status: 400, error: 'Een melding zonder naam eronder is geen melding.' };
    const g = pak(ref, ['bevestigd'], 'thuis kan alleen na een bevestigde reis.');
    if (g.error) return g;
    const a = g.aanvraag;
    if (doorLid && a.customerKey !== key) return { status: 404, error: 'Reisaanvraag niet gevonden.' };
    const vertrek = Date.parse(String(a.vertrek || '') + 'T00:00:00Z');
    const nuMs = Date.parse(nu());
    if (!Number.isFinite(vertrek) || !Number.isFinite(nuMs) || vertrek > nuMs)
      return { status: 409, error: 'Een reis die nog niet vertrokken is, kan niet thuis zijn.' };
    a.status = 'thuis';
    a.thuis = { door: doorLid ? 'lid' : 'reisbureau', at: nu() };
    spoor(a, 'thuis', wie);
    save();
    return { ok: true, aanvraag: a };
  }
  return { markeerThuis };
};
