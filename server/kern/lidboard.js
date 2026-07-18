/* Kern-module "lidboard": de eigen boardroom van elk lid. Net als een zaak zijn
   eigen mini-boardroom heeft (kern/zaak.js), krijgt elk lid hier een
   professioneel schakelbord waarop het zijn eigen functies aan- en uitzet,
   netjes geordend in vier groepen: app-onderdelen, privacy & sociaal, AI &
   meldingen, en verbindingen (toestel).

   Eén generieke sleutel per boardroom: voor een RTG-lid is dat de sessiesleutel
   (req.session.key), voor een beschermd kind de RTF-handle. Zo kan een ouder/
   beheerder via dezelfde motor de boardroom van zijn minderjarige kind
   bijsturen (de route bewaakt dat het echt zijn kind is).

   Privacy by design: de gevoelige deel-functies (locatie, GPS, paspoort delen,
   Bluetooth) staan STANDAARD UIT; de rest staat aan zodat de app draait zoals
   altijd tot iemand bewust iets omzet. De stand staat in db.data.ledenBoard:
     { <sleutel>: { <functie-id>: true|false } }
   Wat er niet in staat volgt de standaard van de functie. */

function maakLidboard({ db, save }) {
  // De categorieën in de volgorde waarin ze op het bord verschijnen.
  const CATEGORIEEN = [
    { id: 'app',        naam: 'App-onderdelen',    uitleg: 'De hoofdmodules van je app.' },
    { id: 'privacy',    naam: 'Privacy & sociaal', uitleg: 'Wie mag wat zien en vragen.' },
    { id: 'ai',         naam: 'AI & meldingen',    uitleg: 'De slimme en attente laag.' },
    { id: 'verbinding', naam: 'Verbindingen',      uitleg: 'De toestel- en verbindingskant.' }
  ];

  // Elke functie: id, categorie, naam, uitleg, standaard (aan tenzij anders),
  // en kind (of hij ook zichtbaar is op de boardroom van een beschermd kind).
  const CAPS = [
    // --- App-onderdelen ---
    { id: 'reizen',    cat: 'app', naam: 'Reizen & boekingen', uitleg: 'Reizen zoeken, boeken en beheren.' },
    { id: 'salon',     cat: 'app', naam: 'De Salon',           uitleg: 'Het besloten sociale netwerk.' },
    { id: 'spelen',    cat: 'app', naam: 'Spelen',             uitleg: 'Spellen met vrienden.' },
    { id: 'bestellen', cat: 'app', naam: 'Bestellen',          uitleg: 'Ophalen en bezorgen bij partners.' },
    { id: 'care',      cat: 'app', naam: 'RTG Care',           uitleg: 'Zorg, spa en wellness.', kind: false },
    { id: 'werk',      cat: 'app', naam: 'Werk & vacatures',   uitleg: 'Solliciteren bij partners.' },
    { id: 'tickets',   cat: 'app', naam: 'Tickets & entree',   uitleg: 'Activiteiten en evenementen.' },
    { id: 'vervoer',   cat: 'app', naam: 'Vervoer & ritten',   uitleg: 'Ritten en transfers.' },
    { id: 'pay',       cat: 'app', naam: 'RTG Pay',            uitleg: 'Betalen en tikken tussen vrienden.', kind: false },
    // --- Privacy & sociaal (gevoelige deel-functies standaard uit) ---
    { id: 'gids',      cat: 'privacy', naam: 'Zichtbaar in de gids',      uitleg: 'Vindbaar voor andere leden.' },
    { id: 'verzoeken', cat: 'privacy', naam: 'Vriendschapsverzoeken',     uitleg: 'Anderen mogen je een verzoek sturen.' },
    { id: 'dm',        cat: 'privacy', naam: 'Directe berichten',         uitleg: 'Privéberichten ontvangen.' },
    { id: 'locatie',   cat: 'privacy', naam: 'Locatie delen',             uitleg: 'Je live locatie met wie jij kiest.', standaard: false },
    { id: 'paspoort',  cat: 'privacy', naam: 'Paspoort / ID delen',       uitleg: 'Geverifieerde identiteit op verzoek delen.', standaard: false, kind: false },
    // --- AI & meldingen ---
    { id: 'rahul',     cat: 'ai', naam: 'Rahul (AI-hulp)',   uitleg: 'Je persoonlijke reis-AI.' },
    { id: 'spraak',    cat: 'ai', naam: 'Spraakbediening',   uitleg: 'Rahul met je stem bedienen.' },
    { id: 'push',      cat: 'ai', naam: 'Pushmeldingen',     uitleg: 'Meldingen op je toestel.' },
    { id: 'streak',    cat: 'ai', naam: 'Dag-opdracht & vuurtjes', uitleg: 'De dagelijkse opdracht en streaks.' },
    // --- Verbindingen (toestel; deel standaard uit) ---
    { id: 'gps',       cat: 'verbinding', naam: 'GPS-tracking',       uitleg: 'Locatiebepaling door het toestel.', standaard: false },
    { id: 'wifi',      cat: 'verbinding', naam: 'Wifi-koppeling',     uitleg: 'Koppelen met lokale wifi (bijv. een Zaakdoos).' },
    { id: 'bluetooth', cat: 'verbinding', naam: 'Bluetooth-koppeling', uitleg: 'Koppelen met Bluetooth-apparaten.', standaard: false }
  ];
  const OP_ID = Object.fromEntries(CAPS.map(c => [c.id, c]));
  const standaardAan = c => c.standaard !== false;

  function store() { if (!db.data.ledenBoard || typeof db.data.ledenBoard !== 'object') db.data.ledenBoard = {}; return db.data.ledenBoard; }
  function eigen(sleutel) { const s = store(); return (s[sleutel] && typeof s[sleutel] === 'object') ? s[sleutel] : {}; }

  // Staat functie <id> aan voor deze boardroom? (voor handhaving elders)
  function aan(sleutel, id) {
    const c = OP_ID[id]; if (!c) return true;
    const eig = eigen(sleutel);
    return Object.prototype.hasOwnProperty.call(eig, id) ? eig[id] !== false : standaardAan(c);
  }

  // Het bord: functies per categorie, met hun huidige stand. voorKind laat de
  // functies weg die niet bij een beschermd kind horen (kind:false).
  function bord(sleutel, opts) {
    const voorKind = !!(opts && opts.kind);
    const caps = voorKind ? CAPS.filter(c => c.kind !== false) : CAPS;
    return {
      categorieen: CATEGORIEEN.map(cat => ({
        id: cat.id, naam: cat.naam, uitleg: cat.uitleg,
        functies: caps.filter(c => c.cat === cat.id).map(c => ({
          id: c.id, naam: c.naam, uitleg: c.uitleg, aan: aan(sleutel, c.id), standaard: standaardAan(c)
        }))
      })).filter(cat => cat.functies.length)
    };
  }

  // Een functie omzetten. voorKind begrenst tot de kind-functies.
  function zet(sleutel, id, waarde, opts) {
    const c = OP_ID[id];
    if (!c) return { status: 400, error: 'Onbekende functie.' };
    if (opts && opts.kind && c.kind === false) return { status: 403, error: 'Deze functie hoort niet bij een kinder-boardroom.' };
    const s = store();
    if (!s[sleutel] || typeof s[sleutel] !== 'object') s[sleutel] = {};
    s[sleutel][id] = waarde !== false;
    save();
    return { status: 200, ok: true, bord: bord(sleutel, opts) };
  }

  return { LIDBOARD_CAPS: CAPS, lidBoard: bord, lidBoardZet: zet, lidBoardAan: aan };
}

module.exports = { maakLidboard };
