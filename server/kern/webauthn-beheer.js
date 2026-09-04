/* WebAuthn, deel "beheer": welke sleutels heeft dit account, en wat is er
   weggehaald.

   Afgesplitst uit ./webauthn.js toen dat over de 10 kB van keuringsregel 13
   ging. De naad ligt waar hij al lag: dat bestand gaat over WIE iemand is
   (registreren, inloggen), dit over WAT hij heeft. Het stond als schuld in
   NORM.json met precies deze knip erbij; hier is hij.

   HET SPOOR, en waarom het er nu pas is. Een passkey weghalen liet niets
   achter: de rij verdween uit de kaart en daarmee was elk antwoord op "welke
   sleutel is er weggegaan, en wanneer" weg. Dat is precies de vraag die je
   stelt nadat er iets is gebeurd, en dan is het te laat om hem alsnog te gaan
   bijhouden. Het spoor groeit AAN en wordt nooit herschreven; alleen de oudste
   regels vallen eraf, want een lijst zonder bodem is een lek.

   WAT ER IN HET SPOOR STAAT EN WAT NIET. Het label dat de mens zelf aan de
   sleutel gaf, de soort, wanneer hij kwam en wanneer hij ging. Geen
   credential-id: dat id is over accounts heen te herkennen, en een verwijderde
   sleutel hoort geen nieuw herkenningspunt achter te laten
   (./isolatie/apparaatsleutel.js legt uit waarom dat id nergens rondslingert).
   Geen IP en geen toestelgegevens: het spoor beantwoordt "welke sleutel", niet
   "waar was je". */
'use strict';

const SPOOR_MAX = 20;                   // per account; oudste valt eraf

module.exports = ({ lijsten, credsVan, index, spoorBak, save }) => {

  /* De publieke vorm van een sleutel. `apparaat` is het enige eerlijke
     onderscheid dat WebAuthn geeft: `singleDevice` zit vast in dit toestel,
     `multiDevice` reist mee met een sleutelhanger (iCloud, Google) en dekt dus
     meer dan een apparaat. Dat is geen vertrouwensCIJFER en er komt er ook geen
     -- een getal op een toestel zou een oordeel suggereren dat nergens gemeten
     is. De GROND staat er, en de lezer trekt de conclusie. */
  function publiekeLijst(user) {
    return credsVan(user.id).map(c => ({ id: c.id, naam: c.naam, apparaat: c.apparaat || null,
      at: c.at, laatstGebruikt: c.laatstGebruikt || null }));
  }

  function spoorVan(userId) {
    const bak = spoorBak();
    if (!Array.isArray(bak[userId])) bak[userId] = [];
    return bak[userId];
  }
  function spoorLees(user) {
    return user ? spoorVan(user.id).slice(0, SPOOR_MAX) : [];
  }

  function weg(user, id) {
    const rij = credsVan(user.id);
    const cred = rij.find(c => c.id === id);
    if (!cred) return { status: 404, error: 'Passkey niet gevonden.' };
    lijsten()[user.id] = rij.filter(c => c.id !== id);
    index().delete(id);
    const spoor = spoorVan(user.id);
    spoor.unshift({ naam: cred.naam || 'Passkey', apparaat: cred.apparaat || null,
      at: cred.at || null, weg: new Date().toISOString() });
    if (spoor.length > SPOOR_MAX) spoor.length = SPOOR_MAX;
    save();
    /* HET AANTAL DAT OVERBLIJFT gaat mee terug, want dat is de zin die het
       scherm moet kunnen zeggen: met nul sleutels valt de zware poort terug op
       het wachtwoord (../kern/zwaarbewijs.js), en dat hoort een mens te zien op
       het moment dat hij zijn laatste sleutel weghaalt -- niet erna. */
    const over = publiekeLijst(user);
    return { status: 200, ok: true, sleutels: over, spoor: spoorLees(user), laatste: over.length === 0 };
  }

  return { publiekeLijst, weg, spoorLees };
};
