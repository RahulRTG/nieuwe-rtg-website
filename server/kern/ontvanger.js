/* ============================================================================
   WIE KRIJGT DIT BERICHT, EN LANGS WELKE WEG? -- de ontvangeroplossing.

   DE FOUT DIE HIJ OPHEFT staat op een regel in kern/werk.js en is door de
   Adam-keten gevonden (scripts/adamproef.js, schakel 10):

       if (!a.key) return;

   `a.key` is de sleutel van een LIDsessie. Een sollicitant uit een RTF-gezin
   heeft die niet -- zijn rij draagt `rtf: { code, profielId }`. Een aangenomen
   zeventienjarige kreeg dus geen bericht, en niets zei dat. Dat is niet een
   ontbrekende tak maar een ONTBREKEND BEGRIP: de meldlaag kende maar een soort
   ontvanger, en alles wat daar niet op leek viel stil weg.

   DAAROM IS DIT GEEN `else if` MAAR EEN EIGEN LAAG. Een tweede tak voor RTF zou
   de volgende vorm (een personeelslid, een gast, een aanvrager zonder account)
   precies zo laten vallen -- dezelfde fout, een deur verder. Hier staat in
   plaats daarvan de vraag zelf: gegeven een ontvanger, welke wegen bestaan er,
   en wat gebeurde er met elk?

   VIER REGELS DIE HIER VASTLIGGEN:

   1. HIJ GEEFT ALTIJD EEN UITSLAG. Er is geen pad waarlangs deze module niets
      teruggeeft. Lukt geen enkele weg, dan staat dat in het antwoord als
      `geenEnkeleWeg` met per weg de reden. Stilte is precies de faalvorm die
      hem heeft opgeleverd.
   2. DE LIJST ONTVANGERSOORTEN IS GESLOTEN. `lid`, `gezin` en `mail`, en verder
      niets. Een soort erbij is een besluit dat je hier maakt en niet iets dat
      per ongeluk ontstaat doordat een aanroeper een nieuw veld meestuurt. Wat
      niet in de lijst staat, komt terug als `soort-onbekend` -- zichtbaar.
   3. HIJ VERZINT GEEN ONTVANGER. Hij leidt niets af uit een naam, een codenaam
      of een contactveld dat op iets lijkt. Wie er niet expliciet in gaat, komt
      er niet uit.
   4. ELKE WEG HEEFT EEN LEZER, EN DAT IS GEMETEN. Een kanaal mag hier alleen
      hangen als de ontvanger het werkelijk kan lezen. Zie de kop van
      foundation/systeembericht.js: `db.data.notifications` leek de voor de hand
      liggende bak voor een gezinslid en heeft aan die kant NUL lezers. Een
      melding daarheen schrijven ziet er in de code goed uit en komt nergens
      aan. Wie hier een vierde weg bijzet, meet eerst wie hem leest.

   WAT HIJ MET OPZET NIET DOET: bepalen of iemand iets MAG ontvangen. Dit is
   bezorging en geen bevoegdheid. De aanroeper weet wie de ontvanger is en
   waarom; deze laag weet alleen hoe je daar komt.
   ========================================================================== */
'use strict';

/* De gesloten lijst. De volgorde is de bezorgvolgorde en verder niets: er is
   geen weg die een andere uitsluit, want een lid dat ook een e-mailadres
   opgaf hoort beide te krijgen. */
const SOORTEN = Object.freeze(['lid', 'gezin', 'mail']);

/* Maakt een bezorger op de wegen die dit huis werkelijk heeft.

   `wegen` is een object met per soort een functie die `{ ok, reden }` teruggeeft
   (of iets waar `ok` uit af te lezen valt). Een ontbrekende weg is geen fout:
   dan meldt de uitslag `weg-niet-ingericht`, en dat is iets anders dan een weg
   die het probeerde en faalde. */
function maakBezorger(wegen) {
  const kanaal = wegen || {};

  /* Eén bezorging. `ontvanger` draagt nul of meer van de drie soorten:
       { lid: 'user-7' }
       { gezin: { code: 'ABC123', profielId: 'a1b2' } }
       { mail: 'adam@voorbeeld.nl' }
     Een ontvanger mag er meer dan een dragen; alle ingerichte wegen worden
     geprobeerd. */
  function bezorg(ontvanger, bericht) {
    const uit = { bezorgd: [], nietBezorgd: [], geenEnkeleWeg: true };
    const o = ontvanger && typeof ontvanger === 'object' ? ontvanger : {};

    /* Een sleutel die niet in SOORTEN staat, valt op in plaats van weg. Zonder
       deze lus is een typefout (`gezinn:`) een stille non-bezorging -- exact de
       vorm die deze module bestrijdt. */
    for (const sleutel of Object.keys(o)) {
      if (!SOORTEN.includes(sleutel)) uit.nietBezorgd.push({ weg: sleutel, reden: 'soort-onbekend' });
    }

    for (const soort of SOORTEN) {
      const doel = o[soort];
      if (doel == null || doel === '') continue;          // niet opgegeven is geen mislukking
      const fn = kanaal[soort];
      if (typeof fn !== 'function') { uit.nietBezorgd.push({ weg: soort, reden: 'weg-niet-ingericht' }); continue; }
      let r;
      /* Een kapotte weg mag de andere niet meenemen. Een pushdienst die
         stukligt hoort een e-mail niet tegen te houden -- dezelfde regel als in
         opzet/meldaan.js, waar de push daarom in een try staat. */
      try { r = fn(doel, bericht); } catch (e) { r = { ok: false, reden: 'weg-brak: ' + (e && e.message || e) }; }
      if (r && r.ok) { uit.bezorgd.push(soort); uit.geenEnkeleWeg = false; }
      else uit.nietBezorgd.push({ weg: soort, reden: (r && r.reden) || 'geweigerd' });
    }

    /* Niemand opgegeven is iets anders dan overal gefaald, en die twee worden
       nooit samengevoegd: het eerste is een aanroeper die niets wist, het
       tweede een huis dat het niet kon. */
    if (!uit.bezorgd.length && !uit.nietBezorgd.length) uit.nietBezorgd.push({ weg: null, reden: 'geen-ontvanger-opgegeven' });
    return uit;
  }

  return { bezorg, SOORTEN };
}

/* Leest een ontvanger uit een SOLLICITATIERIJ. Hij staat hier en niet in
   kern/werk.js omdat hij het bewijsstuk van deze reparatie is: de rij draagt
   twee vormen (`key` van een lid, `rtf` van een gezinslid) plus een contactveld,
   en de oude code kende er een. Wie hier een derde vorm bijzet, ziet meteen dat
   de andere twee er al staan.

   `contact` wordt alleen als mail gelezen als er een @ in staat -- dat is de
   bestaande regel uit kern/werk.js en geen nieuwe aanname; het veld draagt
   soms een telefoonnummer. */
function uitSollicitatie(a) {
  const rij = a && typeof a === 'object' ? a : {};
  const uit = {};
  if (rij.key) uit.lid = rij.key;
  if (rij.rtf && rij.rtf.code && rij.rtf.profielId) uit.gezin = { code: rij.rtf.code, profielId: rij.rtf.profielId };
  if (/@/.test(String(rij.contact || ''))) uit.mail = String(rij.contact);
  return uit;
}

module.exports = { maakBezorger, uitSollicitatie, SOORTEN };
