/* Onderneming-deelmodule "catalogus": de WENSEN om in de RTG-catalogus te komen,
   en wat het kantoor ermee doet.

   WAAROM DIT ER IS. De onboarding vraagt een nieuw lid of het een bedrijf heeft,
   en met een vinkje legt het de wens vast om in de catalogus te komen
   (kern/onboarding/meebouwen.js). Die wens stond op de onderneming en werd door
   niemand gelezen: het lid kreeg te horen dat RTG ernaar kijkt, en er was geen
   scherm waar iemand keek. Een wens zonder lezer is een belofte die de code niet
   waarmaakt (LAT-regel 6). Dit bestand is die lezer.

   WAT HET NADRUKKELIJK NIET DOET: een zaak maken. Een partnerplek komt er langs
   de bestaande weg, met een ledenbewijs bij de aanvraag en een besluit van de
   boardroom (routes/office/partners.js). Zou dit besluit dat ook kunnen, dan
   waren er twee deuren naar dezelfde catalogus en sloeg de ene de eis van de
   andere over.
   Hier wordt alleen bijgehouden of er iemand naar gekeken heeft, wie dat was en
   wat eruit kwam -- meer belooft de onboarding ook niet.

   OP CODENAAM, NOOIT OP NAAM. Deze lijst hangt achter de kantoorpoort, maar dat
   is geen reden om er echte namen in te zetten: klantdata draait in dit huis op
   codenamen en de echte naam ligt in de gescheiden kluis. Het kantoor ziet dus
   wie het is zoals de rest van het huis dat ziet.

   DE PAS STAAT ERBIJ ALS INLICHTING, NIET ALS DREMPEL. Elk lid met een pas mag
   een bedrijf aanmelden -- een RTG Pass net zo goed als een Business Pass. Een
   pas is een lidmaatschapsniveau en geen vergunning om te ondernemen; wie hier
   weer een eis van maakt, bouwt de grens terug die routes/member/partnerkanaal.js
   nu juist heeft opgeruimd. Hij staat erbij omdat de beoordelaar wil weten met
   wie hij spreekt, en verder niet. */
'use strict';

const BESLUITEN = ['opgepakt', 'afgewezen'];

module.exports = ({ bak, save, nu, scho, codenaamVan, tierVan }) => {

  const wensen = () => bak().filter(o => o && o.catalogusWens);

  /* Het beeld voor het kantoor. `open` is wat nog niemand heeft aangeraakt; de
     afgehandelde blijven staan met hun besluit erbij, want "wie heeft dit
     weggeklikt" is precies de vraag die je later stelt. */
  function catalogusWensen() {
    const rij = wensen().map(o => {
      const w = o.catalogusWens || {};
      const tier = tierVan ? tierVan(o.eigenaar) : null;
      return {
        id: o.id,
        naam: o.naam,
        // codenaam, nooit de echte naam: die ligt in de kluis en hoort niet in een lijst
        eigenaar: codenaamVan ? codenaamVan(o.eigenaar) : o.eigenaar,
        // inlichting, geen drempel: elk lid met een pas mag een bedrijf aanmelden
        pas: tier || null,
        rechtsvorm: (o.rechtsvorm || null),
        gevraagd: w.at || null,
        besluit: w.besluit || null,
        door: w.door || null,
        besloten: w.beslotenAt || null,
        notitie: w.notitie || null
      };
    });
    rij.sort((a, b) => String(b.gevraagd || '').localeCompare(String(a.gevraagd || '')));
    const open = rij.filter(r => !r.besluit);
    return { ok: true, aantal: rij.length, open: open.length, wensen: rij.slice(0, 200) };
  }

  /* Het besluit van een mens. 'opgepakt' betekent: we hebben contact, het
     gesprek loopt -- niet dat er iets in de catalogus staat. 'afgewezen' vraagt
     een reden, om dezelfde redenen als elders in dit huis: een deur die
     dichtgaat hoort een naam en een grond te hebben. */
  function catalogusWensBesluit(id, besluit, door, notitie) {
    const o = bak().find(x => x && x.id === String(id || ''));
    if (!o || !o.catalogusWens) return { status: 404, error: 'Deze wens bestaat niet.' };
    if (o.catalogusWens.besluit) return { status: 409, error: 'Deze wens is al behandeld.' };
    const b = String(besluit || '').toLowerCase();
    if (!BESLUITEN.includes(b)) return { status: 400, error: 'Kies opgepakt of afgewezen.' };
    const reden = scho(notitie, 300);
    if (b === 'afgewezen' && !reden) return { status: 400, error: 'Leg vast waarom deze wens is afgewezen.' };
    o.catalogusWens.besluit = b;
    o.catalogusWens.door = String(door || 'kantoor').slice(0, 60);
    o.catalogusWens.beslotenAt = nu();
    o.catalogusWens.notitie = reden || null;
    save();
    return { ok: true, id: o.id, besluit: b };
  }

  return { catalogusWensen, catalogusWensBesluit, CATALOGUS_BESLUITEN: BESLUITEN };
};
