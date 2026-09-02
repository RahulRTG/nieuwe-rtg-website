/* ============================================================================
   HET BESLUIT OVER EEN BUURTVRAAG -- ook "nee" is een antwoord, en het draagt
   een reden.

   WAAROM DIT ER MOET ZIJN. Bewoners kunnen een vraag aandragen (./themas.js) en
   erop stemmen. Wat er daarna gebeurde was zichtbaar in precies EEN geval: als
   er een onderzoek van kwam. Alle andere vragen bleven staan zonder antwoord --
   en een lab dat vragen ophaalt en er niets over terugzegt, heeft geen trechter
   maar een la.

   DE REDEN IS EEN GESLOTEN LIJST, en dat is het hele ontwerp. Vrije tekst
   levert "hier doen we op dit moment niets mee" op: niet te vergelijken, niet te
   doorzoeken, en niet te herkennen als iemand dezelfde vraag over een jaar
   opnieuw stelt. Met een vaste lijst kan een bewoner zien dat zijn vraag NIET is
   afgewezen omdat hij onbelangrijk was, maar omdat er al onderzoek naar bestaat
   -- en dat is een ander gesprek.

   EEN VAN DE REDENEN IS DE BELANGRIJKSTE, EN HIJ STAAT ER MET OPZET IN: dat de
   gegevens die ervoor nodig zijn, niet in verhouding staan tot de vraag. Een
   instituut dat kan zeggen "dit onderzoeken wij niet, want de prijs is te hoog
   voor de mensen die het zou raken", is een instituut dat zijn ethieklaag
   werkelijk gebruikt in plaats van hem af te vinken.

   DRIE DINGEN DIE HIER NIET GEBEUREN:

   1. Een vraag wordt nooit VERWIJDERD. Hij krijgt een stand en een reden; de
      vraag zelf en de stemmen erop blijven staan. Een afgewezen vraag die
      verdwijnt, is niet te onderscheiden van een vraag die nooit is gesteld.
   2. Er komt geen ranglijst van vragen. De stemmen tellen mee in de afweging van
      een mens; ze beslissen niet. Anders is de trechter een populariteitswedstrijd
      en verdwijnt precies de vraag van de kleine groep.
   3. De AI beslist hier niets. Hij mag ordenen en samenvatten; het besluit draagt
      de naam van een mens (dezelfde regel als bij de ethiekreview).
   ========================================================================== */
'use strict';

/* De standen. Een vraag loopt van links naar rechts; er is geen weg terug behalve
   opnieuw beoordelen, en dat is met opzet zichtbaar. */
const STANDEN = ['ingediend', 'verkend', 'beoordeeld', 'gestart', 'niet-gestart'];

/* De redenen om iets NIET te onderzoeken. Elk van deze zes is een echt antwoord
   dat een bewoner iets zegt; "geen tijd" en "geen prioriteit" staan er niet in,
   want dat zegt alleen iets over ons. */
const REDENEN = [
  { reden: 'bestaat-al', naam: 'Er bestaat al onderzoek naar',
    uitleg: 'Een nieuwe studie zou deelnemers belasten zonder waarschijnlijk nieuwe kennis op te leveren.' },
  { reden: 'niet-te-scheiden', naam: 'Niet betrouwbaar te onderzoeken',
    uitleg: 'De oorzaken zijn met de middelen van dit lab niet uit elkaar te halen; een uitkomst zou meer suggereren dan zij waarmaakt.' },
  { reden: 'niet-proportioneel', naam: 'De benodigde gegevens zijn niet in verhouding',
    uitleg: 'Wat we van mensen zouden moeten weten om deze vraag te beantwoorden, weegt niet op tegen wat het antwoord oplevert.' },
  { reden: 'geen-lab-vraag', naam: 'Hier helpt onderzoek niet',
    uitleg: 'Dit is een vraag om actie of om beleid, niet om kennis. We geven hem door in plaats van er een studie van te maken.' },
  { reden: 'buiten-bereik', naam: 'Buiten het bereik van dit lab',
    uitleg: 'Deze vraag hoort bij een andere plaats, een andere instantie of een ander vakgebied.' },
  { reden: 'te-weinig-draagvlak', naam: 'Niemand wil hieraan meedoen',
    uitleg: 'Voor deze vraag zijn geen deelnemers te vinden; zonder mensen is er geen onderzoek.' }
];

const OP_REDEN = new Map(REDENEN.map(r => [r.reden, r]));

module.exports = (ctx) => {
  const { nu, rid, schoon, S, audit, vindLab, save } = ctx;

  const vind = (id) => S().themas.find(t => t.id === String(id || ''));

  /* De stand van een vraag. `gestart` wordt niet met de hand gezet: die volgt uit
     de koppeling met een studie (./themas.js, themaKoppel) -- anders staat er
     "gestart" boven een vraag waar niets mee gebeurde. */
  const standVan = (t) => (t.studieId ? 'gestart' : (t.besluit ? 'niet-gestart' : (t.stand || 'ingediend')));

  /* Verkennen: iemand van het lab heeft ernaar gekeken. Dat is geen besluit, maar
     het is wel het verschil tussen "wij hebben dit gezien" en stilte. */
  function verken(id, b, wie) {
    const t = vind(id); if (!t) return { status: 404, error: 'Deze vraag bestaat niet.' };
    if (t.studieId) return { status: 409, error: 'Deze vraag is al een onderzoek geworden.' };
    const notitie = schoon((b || {}).notitie, 400);
    t.stand = 'verkend';
    t.verkend = { at: nu(), door: schoon(wie, 80) || 'lab', notitie: notitie || null };
    audit(t.labId, 'vraag.verken', wie, t.id, notitie.slice(0, 60));
    save();
    return { ok: true, vraag: publiek(t) };
  }

  /* NIET STARTEN, met een reden uit de lijst. Dit is de functie waar dit bestand
     voor bestaat. */
  function nietStarten(id, b, wie) {
    const t = vind(id); if (!t) return { status: 404, error: 'Deze vraag bestaat niet.' };
    if (t.studieId) return { status: 409, error: 'Deze vraag is al een onderzoek geworden; die kan niet alsnog worden afgewezen.' };
    b = b || {};
    const r = OP_REDEN.get(String(b.reden || ''));
    if (!r) {
      return { status: 400, error: 'Kies een reden uit de lijst: ' + REDENEN.map(x => x.reden).join(', ')
        + '. Vrije tekst levert "hier doen we niets mee" op, en dat is geen antwoord.' };
    }
    const door = schoon(b.door, 80);
    if (!door) return { status: 400, error: 'Zet uw naam erbij: dit is een besluit van een mens en niet van het systeem.' };
    /* De toelichting is verplicht EN vrij: de reden maakt het vergelijkbaar, de
       toelichting maakt het begrijpelijk voor deze ene bewoner. */
    const toelichting = schoon(b.toelichting, 600);
    if (toelichting.length < 15) {
      return { status: 400, error: 'Schrijf er in gewone taal bij waarom, gericht aan de bewoner die deze vraag stelde. De reden alleen is een categorie, geen antwoord.' };
    }
    t.stand = 'niet-gestart';
    t.besluit = { reden: r.reden, toelichting, door, at: nu() };
    audit(t.labId, 'vraag.nietstarten', wie, t.id, r.reden);
    save();
    return { ok: true, vraag: publiek(t),
      let: 'De vraag blijft staan met dit antwoord erbij. Hij wordt niet verwijderd: een afgewezen vraag die verdwijnt, is niet te onderscheiden van een vraag die nooit is gesteld.' };
  }

  /* Een besluit terugnemen -- want een lab dat zijn eigen "nee" niet kan
     herzien, heeft een archief en geen trechter. Het oude besluit blijft staan in
     de geschiedenis van de vraag. */
  function heroverweeg(id, b, wie) {
    const t = vind(id); if (!t) return { status: 404, error: 'Deze vraag bestaat niet.' };
    if (!t.besluit) return { status: 409, error: 'Over deze vraag is nog geen besluit genomen.' };
    const reden = schoon((b || {}).reden, 400);
    if (reden.length < 10) return { status: 400, error: 'Waarom wordt dit besluit herzien? Die reden blijft staan.' };
    if (!Array.isArray(t.eerdereBesluiten)) t.eerdereBesluiten = [];
    t.eerdereBesluiten.unshift(Object.assign({}, t.besluit, { herzienOm: reden, herzienAt: nu() }));
    t.besluit = null;
    t.stand = 'verkend';
    audit(t.labId, 'vraag.heroverweeg', wie, t.id, reden.slice(0, 60));
    save();
    return { ok: true, vraag: publiek(t) };
  }

  /* Wat een BEWONER van een vraag ziet. De stemmers gaan er nooit uit -- alleen
     hun aantal. */
  function publiek(t) {
    const r = t.besluit ? OP_REDEN.get(t.besluit.reden) : null;
    return { id: t.id, labId: t.labId, vraag: t.vraag, soort: t.soort,
      stemmen: (t.stemmen || []).length, stand: standVan(t), studieId: t.studieId || null,
      verkend: t.verkend ? { at: t.verkend.at, notitie: t.verkend.notitie } : null,
      besluit: t.besluit ? { reden: t.besluit.reden, redenNaam: r ? r.naam : t.besluit.reden,
        redenUitleg: r ? r.uitleg : null, toelichting: t.besluit.toelichting,
        door: t.besluit.door, at: t.besluit.at } : null,
      eerderHerzien: (t.eerdereBesluiten || []).length,
      at: t.at };
  }

  /* De openbare lijst: alle vragen van een lab met hun stand. Ook -- juist -- de
     afgewezen. */
  function vragen(labId, { stand } = {}) {
    const lab = vindLab(labId); if (!lab) return { status: 404, error: 'Dit lab bestaat niet.' };
    let rijen = S().themas.filter(t => t.labId === lab.id).map(publiek);
    if (stand && STANDEN.includes(String(stand))) rijen = rijen.filter(r => r.stand === String(stand));
    const perStand = {};
    for (const st of STANDEN) perStand[st] = S().themas.filter(t => t.labId === lab.id && standVan(t) === st).length;
    return { ok: true, lab: { naam: lab.naam, stad: lab.stad }, vragen: rijen.slice(0, 500), perStand,
      redenen: REDENEN,
      let: 'Ook de vragen waar dit lab NIETS mee doet staan hier, met de reden. Een trechter die alleen zijn successen toont, is een etalage.' };
  }

  return { verken, nietStarten, heroverweeg, vragen, publiek, standVan, STANDEN, REDENEN };
};

module.exports.STANDEN = STANDEN;
module.exports.REDENEN = REDENEN;
