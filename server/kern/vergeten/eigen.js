/* Vergeten, deelbestand "eigen": DE EERSTE SOORT uit de kop van ../vergeten.js.
   Alles wat ALLEEN over dit lid gaat -- zijn voorkeuren, zijn spullen, zijn
   geheugen, zijn eigen Salon-posts. Dat gaat weg, zonder afweging.

   De andere drie soorten hadden al hun eigen bestand (./anoniem.js voor het
   spoor in andermans werk, ./bytes.js voor wat buiten de database ligt, en
   server/bewaartermijnen.js voor wat met grond blijft staan); deze stond als
   enige nog los in de functie. Hij komt hier niet om de regels te verplaatsen
   maar omdat de LIJST het onderwerp is: elke naam erin is een tak die met dit
   lid meegaat, en dat is precies het soort opsomming dat moet kunnen groeien
   zonder dat het bestand eromheen onleesbaar wordt.

   DE EIGEN SALON-POSTS GAAN WEG, en dat is de schoonste lezing van art. 17: het
   is de inhoud van dit lid en dit lid vraagt vergetelheid. De reacties van
   anderen eronder verdwijnen mee -- dat is de prijs, en die is bewust betaald:
   een post laten staan met "(verwijderd)" erboven bewaart nog steeds wat iemand
   schreef toen hij nog niet weg wilde.

   De bezem in test/vergeten.test.js veegt na afloop door de HELE database en
   rekent af wat er nog van het lid in staat; die bewaakt dat deze lijst
   compleet blijft. */
'use strict';

/* Elke naam hier is een tak die ALLEEN over dit lid gaat. Als lijst en niet als
   losse regels: zo is in een oogopslag te zien wat er meegaat, en is er een
   plek om er een bij te zetten. */
const EIGEN_TAKKEN = [
  'fluister',           // wat Rahul van u weet: weetjes, gesprek, gebruik
  'rahulRespect',       // de teller van de pestgrens
  'favorieten',         // uw adressen
  'zorgProfielen',      // allergieen en dieet: bijzondere persoonsgegevens
  'memberTaal',         // uw taalkeuze
  'wallet',             // uw passen, tickets en sleutels
  'punten',             // uw spaarsaldo (zonder account niet meer te besteden)
  'appInstallaties', 'reisInstallaties', 'rijksInstallaties',  // wat u installeerde
  'clipsVolg',          // wie u volgt
  'lifestyle',          // uw rechterhand-voorkeuren
  'ontmoetVoorkeur', 'ontmoetPosities',   // Salon-ontmoetingen en uw positie daarin
  'accountRollen',      // uw koppelingen aan werkplekken
  'ledenBoard',         // uw eigen boardroom: wat u wel en niet deelt
  'contactPins'         // uw contactpin: het adres waarmee anderen u toevoegden
];

module.exports = ({ db, lidBoardLogWis }) => {

  /* `noteerPostBeelden` en `teWissen` komen van ./bytes.js mee: de beelden van
     een post moeten genoteerd zijn VOORDAT de post uit de lijst valt, anders
     zijn ze daarna niet meer terug te vinden en blijven ze als wees op schijf
     staan. Verzamelen voor het weggooien, want daarna is de link weg. */
  function wisEigen(key, noteerPostBeelden, teWissen) {
    // cv en live-locatie weg, gastchats weg, likes weg
    delete db.data.cvs[key];
    delete db.data.live[key];
    for (const k of Object.keys(db.data.guestChats || {})) {
      if (k.split('|')[1] === key) delete db.data.guestChats[k];
    }
    for (const p of db.data.posts) if (p.likedBy) delete p.likedBy[key];
    if (Array.isArray(db.data.posts)) {
      noteerPostBeelden(key, teWissen);
      db.data.posts = db.data.posts.filter(p => p.authorKey !== key);
    }
    // meldingen weg (bij demo-profielen is dit de gedeelde demo-bel)
    if (db.data.notifications[key]) db.data.notifications[key] = [];
    for (const tak of EIGEN_TAKKEN) { if (db.data[tak]) delete db.data[tak][key]; }
    /* En het journaal van de eigen boardroom. Dat staat apart omdat het geen tak
       op de sleutel is maar een eigen lijst; het hoort er wel bij, want het legt
       vast WIE welke knop zette -- bij een kind is dat een ouder. Blijft het
       staan na "verwijder mijn gegevens", dan houden we een spoor van iemand die
       er niet meer is. */
    if (typeof lidBoardLogWis === 'function') lidBoardLogWis(key);
  }

  return { wisEigen, EIGEN_TAKKEN };
};
