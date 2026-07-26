/* "Niet storen tot thuis", en de andere rustopties.

   De vondst hier is de VEILIGHEIDSBAAN. Gewone niet-storen-standen zetten
   alles dicht, en juist daarom durven mensen ze niet aan te zetten: stel dat
   er iets is met een kind, of met je moeder. Hier staat de baan van je kring
   altijd open. De wereld is stil, de mensen die ertoe doen komen erdoor.

   Dat is ook waarom dit bij de veiligheidsapps hoort en niet bij "focus": het
   maakt rust mogelijk zonder de verbinding op te geven. Precies de twee
   dingen tegelijk.

   Verder eindigt elke stand vanzelf. Geen enkele rustoptie blijft per ongeluk
   dagen aan staan, en een stand die aan een thuiskomst hangt gaat uit zodra
   je incheckt in de Thuiswacht. */
module.exports = ({ db, save, schoon }) => {
  const nu = () => new Date().toISOString();

  /* De standen. Bewust een korte lijst met een duidelijk verschil; niet
     twintig varianten waar niemand meer uitkomt. */
  const STANDEN = [
    { id: 'thuis', naam: 'Tot ik thuis ben', uitleg: 'Alles stil totdat je incheckt in de Thuiswacht. Je kring komt er altijd doorheen.', hangtAanWacht: true },
    { id: 'avond', naam: 'Avond met het gezin', uitleg: 'Werk en zaken zwijgen; huis, kring en school komen door.', standaardMin: 240 },
    { id: 'slaap', naam: 'Slapen', uitleg: 'Alles stil tot morgenochtend, behalve je kring.', standaardMin: 480 },
    { id: 'werk', naam: 'Diep werk', uitleg: 'Sociaal en Salon zwijgen; werk en kring komen door.', standaardMin: 120 },
    { id: 'reis', naam: 'Onderweg', uitleg: 'Alleen wat met deze reis te maken heeft, plus je kring.', standaardMin: 180 }
  ];

  // welke soorten meldingen elke stand doorlaat (de kring staat er NOOIT in,
  // want die komt er per definitie altijd doorheen)
  const DOOR = {
    thuis: ['veiligheid'],
    avond: ['veiligheid', 'gezin', 'school'],
    slaap: ['veiligheid'],
    werk: ['veiligheid', 'werk', 'zaak'],
    reis: ['veiligheid', 'reis', 'rit', 'verblijf']
  };

  function lijsten() {
    if (!db.data.veilig) db.data.veilig = {};
    if (!db.data.veilig.rust) db.data.veilig.rust = {};
    return db.data.veilig.rust;
  }

  function rustStand(handle) {
    const R = lijsten()[handle];
    if (!R || !R.aan) return { aan: false, standen: STANDEN };
    if (R.tot && new Date(R.tot).getTime() <= Date.now()) {
      R.aan = false; save();
      return { aan: false, standen: STANDEN, netAf: true };
    }
    const s = STANDEN.find(x => x.id === R.stand) || STANDEN[0];
    return {
      aan: true, stand: R.stand, naam: s.naam, uitleg: s.uitleg,
      tot: R.tot, hangtAanWacht: !!R.hangtAanWacht, notitie: R.notitie || '',
      doorlaat: DOOR[R.stand] || ['veiligheid'],
      standen: STANDEN
    };
  }

  function rustAan(handle, body) {
    const R = lijsten();
    const s = STANDEN.find(x => x.id === body.stand);
    if (!s) return { status: 400, error: 'Deze stand kennen we niet.' };
    const min = Math.max(5, Math.min(24 * 60, Math.round(Number(body.minuten) || s.standaardMin || 120)));
    R[handle] = {
      aan: true, stand: s.id,
      // Ook een stand die aan de thuiskomst hangt krijgt een harde einddatum.
      // Anders blijft hij staan als je die dag vergeet in te checken, en dat
      // is precies hoe mensen dit soort standen kwijtraken.
      tot: new Date(Date.now() + min * 60000).toISOString(),
      hangtAanWacht: !!s.hangtAanWacht,
      notitie: schoon(body.notitie, 120),
      van: nu()
    };
    save();
    return { status: 200, ok: true, rust: rustStand(handle) };
  }

  function rustUit(handle) {
    const R = lijsten();
    if (R[handle]) { R[handle].aan = false; R[handle].tot = nu(); save(); }
    return { status: 200, ok: true, rust: rustStand(handle) };
  }

  /* Thuisgekomen: de Thuiswacht roept dit aan bij het inchecken. Alleen
     standen die daaraan hangen gaan uit; "slapen" blijft gewoon staan. */
  function rustThuis(handle) {
    const R = lijsten();
    if (R[handle] && R[handle].aan && R[handle].hangtAanWacht) {
      R[handle].aan = false; R[handle].tot = nu();
      save();
      return true;
    }
    return false;
  }

  /* De poortwachter: mag deze melding erdoor? De veiligheidsbaan (scope
     'veiligheid' en alles wat uit de kring komt) komt er altijd doorheen,
     ongeacht de stand. Dat is de hele afspraak. */
  function magDoor(handle, note) {
    const st = rustStand(handle);
    if (!st.aan) return true;
    const scope = String((note && note.scope) || '');
    if (scope === 'veiligheid' || (note && note.uitKring)) return true;
    return (DOOR[st.stand] || []).includes(scope);
  }

  return { rustStand, rustAan, rustUit, rustThuis, magDoor, STANDEN };
};
