/* Boardroom van het lid, deel "werkbeleid": wat een WERKGEVER mag dichtzetten.

   Het zakelijke scenario. Een bedrijf neemt Business Passen voor zijn mensen en
   moet kunnen zeggen: op deze passen geen Salon, geen AI, geen paspoort delen.
   Dat is een echte eis -- compliance, een sector met geheimhouding, een
   ondernemingsraad die er iets van vindt. Zonder die knop is de pas voor zulke
   organisaties simpelweg niet bruikbaar.

   MAAR: dit bord regelt of iemands locatie gedeeld wordt, of zijn paspoort
   opvraagbaar is en of hij vindbaar is voor anderen. Een werkgever die daar
   dingen kan AANzetten, heeft geen beleidsinstrument maar een afluisterknop.
   Daarom staat er één regel boven alles, en die is niet configureerbaar:

       EEN WERKGEVER KAN ALLEEN DICHTZETTEN, NOOIT OPENZETTEN.

   Het beleid is dus een lijst van functies die DICHT staan, en verder niets.
   Er is geen "verplicht aan". Wat dat oplevert:

     - een werkgever kan nooit afdwingen dat een medewerker zijn locatie deelt,
       zijn GPS aanzet, of zijn paspoort beschikbaar stelt. De enige richting
       waarin hij die schakelaars kan bewegen is dicht, en dat is voor de
       medewerker altijd de veilige kant;
     - de medewerker kan alles wat de werkgever NIET dichtzet, nog steeds zelf
       uitzetten. Het beleid is een bovengrens, geen dictaat over de rest;
     - en wat dicht staat, staat er zichtbaar bij met de naam van het bedrijf.
       Stille voogdij bestaat hier niet: je hoort te weten wie je knop vasthoudt.

   Wat een werkgever helemaal niet raakt: functies die als vast staan gemarkeerd
   (je wallet met je ledenpas). Die kun je niet uitzetten, ook niet namens een
   ander -- anders is je pas op je eigen toestel weg omdat je baas dat vond.

   Wie is je werkgever? De rollen aan je ene RTG-account (kern/eenaccount):
   elke koppeling als 'personeel' of 'zaak' wijst een zaak-code aan. Werk je voor
   twee bedrijven, dan gelden beide beleiden bij elkaar opgeteld -- de strengste
   wint, want anders zou de ene werkgever de regel van de andere openbreken.

   Opslag: db.data.werkbeleid[<zaakcode>] = { uit:[id,...], at, door }. */

const { OP_ID } = require('./catalogus');

function maakWerkbeleid({ db, save }) {
  function store() {
    if (!db.data.werkbeleid || typeof db.data.werkbeleid !== 'object') db.data.werkbeleid = {};
    return db.data.werkbeleid;
  }
  const norm = code => String(code || '').toUpperCase();

  /* Het beleid van EEN zaak: de functies die dicht staan. */
  function beleid(zaakcode) {
    const b = store()[norm(zaakcode)];
    const uit = (b && Array.isArray(b.uit)) ? b.uit.filter(id => OP_ID[id] && !OP_ID[id].vast) : [];
    return { uit, at: (b && b.at) || null, door: (b && b.door) || null };
  }

  /* Het beleid zetten. Alleen dichtzetten bestaat: `uit` is de volledige lijst
     van wat dicht moet, alles wat er niet in staat is weer vrij. Een vaste
     functie of een onbekende id weigeren we hard -- dan weet de beheerder dat
     zijn regel niet is aangekomen, in plaats van dat hij stil verdwijnt. */
  function zet(zaakcode, uit, door) {
    const code = norm(zaakcode);
    if (!code) return { status: 400, error: 'Geen zaak.' };
    if (!Array.isArray(uit)) return { status: 400, error: 'Geef een lijst met functies die dicht moeten.' };
    if (uit.length > Object.keys(OP_ID).length) return { status: 400, error: 'Te veel functies in een keer.' };
    const schoon = [];
    for (const ruw of uit) {
      const id = String(ruw || '');
      const c = OP_ID[id];
      if (!c) return { status: 400, error: 'Onbekende functie: ' + id };
      if (c.vast) return { status: 409, error: '"' + c.naam + '" hoort bij de basis van het toestel en kan niet door een werkgever dicht.' };
      if (schoon.indexOf(id) < 0) schoon.push(id);
    }
    const s = store();
    s[code] = { uit: schoon, at: new Date().toISOString(), door: String(door || '').slice(0, 60) || null };
    save();
    return { status: 200, ok: true, beleid: overzicht(code) };
  }

  /* Wat een beheerder te zien krijgt: alle functies, met per functie of het
     beleid hem dichtzet. Zo is het een lijst om te bedienen, geen rijtje id's. */
  function overzicht(zaakcode) {
    const dicht = new Set(beleid(zaakcode).uit);
    const b = store()[norm(zaakcode)] || {};
    return {
      gewijzigd: b.at || null,
      door: b.door || null,
      regel: 'Een werkgever kan functies alleen dichtzetten, nooit openzetten. Verplicht aanzetten van locatie, GPS of paspoort delen bestaat hier bewust niet.',
      functies: Object.values(OP_ID)
        .filter(c => !c.vast)
        .map(c => ({ id: c.id, naam: c.naam, uitleg: c.uitleg, dicht: dicht.has(c.id) }))
    };
  }

  /* De werkgevers achter een lid: de zaak-codes uit de rollen van het ene
     account. Geen rollen, geen werkgever, geen beleid. */
  function werkgeversVan(key) {
    const rollen = (db.data.accountRollen && db.data.accountRollen[key]) || [];
    const uit = [];
    for (const r of rollen) {
      if (!r || !r.code) continue;
      if (r.rol !== 'personeel' && r.rol !== 'zaak') continue;
      const code = norm(r.code);
      if (uit.some(x => x.code === code)) continue;
      uit.push({ code, naam: r.zaakNaam || r.naam || code });
    }
    return uit;
  }

  /* Zet een werkgever deze functie dicht voor dit lid? Geeft de zaak terug die
     hem dichthoudt (voor de uitleg op het bord), of null. Werk je voor twee
     bedrijven, dan wint de eerste die hem dichtzet: samen opgeteld is dat de
     strengste stand. */
  function dichtVoor(key, id) {
    for (const w of werkgeversVan(key)) {
      if (beleid(w.code).uit.indexOf(id) >= 0) return w;
    }
    return null;
  }

  return { werkbeleid: beleid, werkbeleidZet: zet, werkbeleidOverzicht: overzicht,
    werkgeversVan, werkbeleidDicht: dichtVoor };
}

module.exports = { maakWerkbeleid };
