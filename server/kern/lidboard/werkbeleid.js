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

   En sinds deze ronde een tweede regel, die net zo hard is:

       ALLEEN TIJDENS JE DIENST, EN NIET IN JE PAUZE.

   Het beleid gold hiervoor VIERENTWINTIG UUR PER DAG: dichtVoor() keek alleen
   of je een werkkoppeling met die zaak had, niet of je aan het werk was. Dat
   betekende dat je baas je pas ook op zondag dichthield. Nu geldt het beleid
   alleen zolang je INGEKLOKT staat, en daarbinnen heb je 45 minuten pauze
   waarin het even niet geldt -- de rookpauze, de grote pauze.

   Wat we daarvoor NIET doen: meten wanneer je kijkt. Zou het budget aftellen
   op je gebruik van De Salon, dan zou dit systeem precies bijhouden hoeveel
   minuten je op sociale media zat, en dat is exact de meting waar deze module
   tegen beschermt. De teller loopt dus op PAUZEMINUTEN en niet op wat je in
   die minuten doet. Pauze nemen mag altijd; is het budget op, dan geldt het
   beleid weer -- RTG gaat niet over je pauzerecht, alleen over wanneer de
   werkgever iets te zeggen heeft.

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

/* De pauze-armslag per dienst. Een getal op een plek; de route en het bord
   lezen het hier, zodat er nooit twee waarheden over kunnen ontstaan. */
const PAUZE_MINUTEN = 45;

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
      uit.push({ code, naam: r.zaakNaam || r.naam || code, staffId: r.staffId != null ? r.staffId : null });
    }
    return uit;
  }

  /* Draait deze persoon op dit moment een dienst bij die zaak? Dat is de open
     regel op de prikklok: een in-tijd zonder uit-tijd.

     db.data.klok draagt twee soorten bewoners: onder een ZAAKCODE staat de
     prikklok (een lijst), onder 'lid:<key>' het wekkertje van een lid (een
     object met wekkers en timers). Vandaar de Array-controle -- zonder die
     regel zou een lid met een wekker hier een uitzondering opleveren. */
  function dienstNu(zaakcode, staffId) {
    if (staffId == null) return null;
    const lijst = (db.data.klok && db.data.klok[norm(zaakcode)]) || null;
    if (!Array.isArray(lijst)) return null;
    return lijst.find(e => e && e.staffId === staffId && e.in && !e.out) || null;
  }

  const minuten = (van, tot) => Math.max(0, (new Date(tot) - new Date(van)) / 60000);

  /* Hoeveel pauzeminuten zijn er in deze dienst al gebruikt, de lopende pauze
     meegerekend? Alleen minuten; nooit waar ze aan besteed zijn. */
  function pauzeGebruikt(dienst, nu) {
    const nuMs = nu || new Date().toISOString();
    return ((dienst && dienst.pauzes) || []).reduce(
      (n, p) => n + (p && p.in ? minuten(p.in, p.uit || nuMs) : 0), 0);
  }

  /* Staat deze dienst NU in een pauze die nog binnen het budget valt? Is het
     budget op, dan blijft de pauze gewoon lopen -- die is van de medewerker --
     maar geldt het beleid weer. */
  function pauzeNu(dienst) {
    const p = ((dienst && dienst.pauzes) || []).find(x => x && x.in && !x.uit);
    if (!p) return null;
    return pauzeGebruikt(dienst) <= PAUZE_MINUTEN ? p : null;
  }

  /* De stand voor een medewerker: loopt er een dienst, staat hij in pauze, en
     hoeveel armslag is er nog? Voor het scherm en voor de route. */
  function pauzeStand(zaakcode, staffId) {
    const d = dienstNu(zaakcode, staffId);
    if (!d) return { ingeklokt: false, pauze: false, restMinuten: PAUZE_MINUTEN, budget: PAUZE_MINUTEN };
    const gebruikt = pauzeGebruikt(d);
    return {
      ingeklokt: true,
      pauze: !!((d.pauzes || []).find(x => x && x.in && !x.uit)),
      binnenBudget: !!pauzeNu(d),
      gebruikteMinuten: Math.round(gebruikt),
      restMinuten: Math.max(0, Math.round(PAUZE_MINUTEN - gebruikt)),
      budget: PAUZE_MINUTEN
    };
  }

  /* Zet een werkgever deze functie dicht voor dit lid? Geeft de zaak terug die
     hem dichthoudt (voor de uitleg op het bord), of null. Werk je voor twee
     bedrijven, dan wint de eerste die hem dichtzet: samen opgeteld is dat de
     strengste stand.

     Twee redenen om hem juist NIET dicht te houden, allebei nieuw: je staat
     niet ingeklokt (dan gaat je werkgever niet over je pas), of je staat in
     een pauze die nog binnen de armslag valt. */
  function dichtVoor(key, id) {
    for (const w of werkgeversVan(key)) {
      if (beleid(w.code).uit.indexOf(id) < 0) continue;
      const dienst = dienstNu(w.code, w.staffId);
      if (!dienst) continue;
      if (pauzeNu(dienst)) continue;
      return w;
    }
    return null;
  }

  return { werkbeleid: beleid, werkbeleidZet: zet, werkbeleidOverzicht: overzicht,
    werkgeversVan, werkbeleidDicht: dichtVoor,
    werkbeleidPauzeStand: pauzeStand, WERKBELEID_PAUZE_MINUTEN: PAUZE_MINUTEN };
}

module.exports = { maakWerkbeleid };
