/* Magnaat: DE AI-MANAGER -- je zaken laten draaien terwijl je er niet bent.

   WAAROM DIT PAS NU KAN. Een manager is alleen zinvol als er iets te beheren
   valt, en dat is er sinds fase B: contractverplichtingen, financiering, risico,
   onderzoek, prijsstelling, onderhoud en capaciteit. Een AI-manager op de
   economie van fase A zou een knop zijn die het onderhoudsbudget zet.

   VIER WETTEN, en ze zijn alle vier een grens en geen instelling:

   1. DE MANAGER DOET NIETS WAT JIJ NIET OOK KUNT. Hij loopt door dezelfde
      ACTIES als de speler -- geen eigen ingang, geen eigen tarief, geen enkele
      bevoegdheid die op het scherm niet bestaat. Dat is de reden dat deze module
      de actietabel INJECTED krijgt en niet zelf aan de staat zit: een tweede
      manier om een vestiging te veranderen is een tweede economie.

   2. HIJ ONDERHOUDT, HIJ GROEIT NIET. Openen, uitbreiden, lenen, tekenen en
      onderzoeken staan standaard UIT en gaan alleen aan als de speler ze
      expliciet aanzet. Dat is de Safe Management Policy: wie terugkomt van
      vakantie hoort zijn bedrijf terug te vinden zoals hij het achterliet, niet
      als een concern met vier ton schuld. Een manager die zelf mag uitbreiden is
      geen hulp maar een tweede speler op jouw stoel.

   3. HIJ KOST GELD. Beheer is een dienst en geen gratis verbetering: elke maand
      gaat er een deel van de omzet af van elke vestiging die hij draait. Zonder
      die post is delegeren strikt beter dan opletten, en dan speelt het spel
      zichzelf. Met die post is het een AFWEGING -- je betaalt om niet te hoeven
      kijken -- en dat is precies wat het hoort te zijn.

   4. ALLES WAT HIJ DOET STAAT IN HET LOG, met de reden erbij. Een manager die
      stil dingen verandert is geen manager maar een verrassing.

   HIJ IS DETERMINISTISCH, net als de rest. Hij kijkt naar de stand aan het begin
   van de maand en beslist daarop; tien maanden in een keer geeft dezelfde reeks
   besluiten als tien maanden los (GAMEHALL.md 12.4). */
/* WAT IEMAND MAG BESLISSEN EN TOT HOEVER staat in ./mandaat.js. Dit bestand
   gaat over WAT de manager doet; dat over hoe ver hij daarin mag gaan. */
const M = require('./mandaat');

const rond = (n) => Math.round(n);
const klem = (n, a, b) => Math.max(a, Math.min(b, n));

/* WAT BEHEER KOST, als deel van de maandomzet per beheerde vestiging. Het geld
   verlaat de wereld -- het gaat naar een beheerder buiten de tafel -- en telt
   dus mee als LEK in scripts/magnaat-pomp.js, net als rente en premie. */
const TARIEF = 0.025;
const MINTARIEF = 400;   // ook een stille zaak kost aandacht

/* DE STANDAARDREGELS, en ze zijn met opzet voorzichtig. Alles wat de omvang van
   je bedrijf verandert staat uit; wat er aan staat is huishouding. */
const STANDAARD = {
  onderhoudsdoel: 70,      // hierboven houden, niet hoger poetsen dan nodig
  bezettingsdoel: 0.85,    // waarboven de kwaliteit begint te zakken (./maat.js)
  kasbuffer: 25000,        // hieronder geeft hij niets meer uit
  /* HET MANDAAT, standaard overal DICHT. Delegeren is een handeling en geen
     beginwaarde, en dat staat er met opzet uitgeschreven in plaats van als leeg
     object: een lijst waarop je ziet WAT er dicht staat, is leesbaarder dan een
     afwezigheid waar je zelf uit moet afleiden wat er had kunnen staan.

     De lijst met wat er te delegeren VALT komt uit ./mandaat.js en niet van
     hier -- hij stond hier ooit als tweede vocabulaire, met `investeren` naast
     `uitbreiden` als gevolg. */
  mag: null            // hieronder ingevuld, want hij hangt aan MAGLIJST
};
const MAGLIJST = M.SOORTLIJST.filter(k => M.SOORTEN[k].niveau !== 'persoonlijk');
STANDAARD.mag = Object.fromEntries(MAGLIJST.map(k => [k, false]));

/* WELKE ACTIES DEZE MANAGER GEBRUIKT, met naam. Deze lijst bestaat om een fout
   te vangen die hier echt is gemaakt: de manager kreeg een halve actietabel mee,
   elke zet viel op een `undefined`, en hij keek acht maanden lang toe hoe het
   onderhoud wegzakte -- zonder een enkele foutmelding, want een actie die niet
   bestaat doet gewoon niets. Nu telt `test/spelbeheer.test.js` na dat elke naam
   hieronder in de echte tabel van de motor zit. Wie hier een actie bij zet en
   hem niet aansluit, ziet dat meteen. */
const GEBRUIKT = ['beleid', 'krediet-opnemen', 'storing-verhelpen'];

/* De regels van deze speler, aangevuld met de standaard. Nooit de opgeslagen
   waarde rechtstreeks lezen: een partij die begon voordat een regel bestond
   heeft hem niet, en dan valt de manager stil op een `undefined`. */
function regelsVan(st, h) {
  const eigen = ((st.beheer || {})[h] || {}).regels || {};
  return {
    onderhoudsdoel: klem(Number(eigen.onderhoudsdoel ?? STANDAARD.onderhoudsdoel), 0, 100),
    bezettingsdoel: klem(Number(eigen.bezettingsdoel ?? STANDAARD.bezettingsdoel), 0.5, 1),
    kasbuffer: Math.max(0, Number(eigen.kasbuffer ?? STANDAARD.kasbuffer)),
    /* HET MANDAAT (./mandaat.js). Hij was een map van JA of NEE en draagt nu
       ook BEDRAGEN: "mag lenen" is een categorie, "mag lenen tot 500.000" is een
       bevoegdheid. `true` blijft werken en betekent nog steeds "onbegrensd",
       zodat een partij die begon voordat grenzen bestonden gewoon doorloopt.

       De booleanvorm blijft ernaast staan als `mag`, want ./beheer-besluit.js
       stelt op twee plekken een JA-of-NEE-vraag waar geen bedrag bij hoort. Een
       tweede lezing van hetzelfde veld en niet een tweede veld: zou het mandaat
       ergens anders wonen dan de regels, dan kun je ze uit elkaar zetten. */
    mandaat: M.schoon(eigen.mag || {}),
    mag: Object.fromEntries(MAGLIJST.map(k => [k, !!(eigen.mag || {})[k]]))
  };
}
const staatAan = (st, h) => !!((st.beheer || {})[h] || {}).aan;

/* Het log. Kort gehouden: het is een verantwoording en geen archief, en een
   lijst die een campagne lang doorgroeit is niet meer te lezen. */
const LOGLENGTE = 60;

/* DE VASTE GEGEVENS STAAN VOOR DE FABRIEK, en dat is geen stijlkwestie. Ze
   stonden erin, en ./beheer-acties.js las ze als `B.MINTARIEF` van de MODULE --
   dat is de fabriek zelf, dus `undefined`. Het tarief werd `NaN`, en dat werd
   van de kas afgetrokken: een speler met een manager had binnen een maand geen
   getal meer maar een `NaN` als vermogen. Een constante die twee bestanden
   delen, hoort op het niveau te staan waarop hij gedeeld wordt. */
module.exports = ({ ACTIES }) => {
  function meld(st, h, maand, wat, waarom, extra) {
    const b = st.beheer[h];
    b.log = b.log || [];
    b.log.unshift(Object.assign({ maand, wat, waarom }, extra || {}));
    if (b.log.length > LOGLENGTE) b.log.length = LOGLENGTE;
  }

  /* Een actie namens de speler. Door dezelfde tabel als het scherm -- zie wet 1.
     `zet` van ../economie.js wordt met opzet NIET gebruikt: die doet save() en
     stuurt duwtjes rond, en dat hoort bij een mens die op een knop drukt. */
  const doe = (potje, h, z) => ACTIES[z.actie] ? ACTIES[z.actie](potje, h, z) : { error: 'onbekend' };

  /* DE BESLUITEN staan in ./beheer-besluit.js: onderhoud, bezetting, prijs en
     rood staan. Die lijst groeit met elke laag mee; de wetten hierboven niet. */
  const besluit = require('./beheer-besluit')({ doe });

  /* ---------- de maand ----------
     Wat de manager deze maand doet, voor elke vestiging die hij draait. Geeft de
     regels voor het maandoverzicht terug plus wat het beheer gekost heeft. */
  function maandVoorSpeler(potje, h) {
    const st = potje.staat;
    if (!staatAan(st, h)) return { regels: [], kosten: 0, gedaan: 0 };
    const regels = regelsVan(st, h);
    const vorige = (st.laatste[h] || {}).regels || [];
    const uit = [];
    for (const v of st.vestigingen[h] || []) {
      const r = vorige.find(x => x.id === v.id);
      besluit.onderhoud(potje, h, v, r, regels, uit);
      besluit.bezetting(potje, h, v, r, regels, uit);
      besluit.prijs(potje, h, v, r, regels, uit);
      besluit.storing(potje, h, v, r, regels, uit);
    }
    besluit.rood(potje, h, regels, uit);
    for (const m of uit) meld(st, h, st.maand, m.wat, m.waarom, m);
    /* HET TARIEF. Over de omzet van vorige maand, want de manager heeft die
       maand gedraaid; een percentage over een maand die nog moet komen is een
       voorschot op werk dat nog niet gedaan is. */
    let kosten = 0;
    for (const v of st.vestigingen[h] || []) {
      const r = vorige.find(x => x.id === v.id);
      kosten += Math.max(MINTARIEF, (r ? r.omzet : 0) * TARIEF);
    }
    kosten = rond(kosten);
    if (kosten > 0) st.geld[h] -= kosten;
    return {
      regels: kosten > 0 ? [{ id: 'beheer', naam: 'Beheer', soort: 'beheer',
        besluiten: uit.length, resultaat: -kosten }] : [],
      kosten, gedaan: uit.length
    };
  }

  return { maandVoorSpeler };
};
/* `regelsVan` en `staatAan` zijn zuivere functies van de STAAT en hangen niet
   aan de actietabel; ze staan daarom naast de fabriek en niet erin. Zo kan
   ./beheer-acties.js ze lezen zonder de manager zelf te hoeven maken -- en dat
   is precies de scheiding die de fout hierboven veroorzaakte toen ze wel binnen
   stonden. */
Object.assign(module.exports, { regelsVan, staatAan,
  STANDAARD, MAGLIJST, GEBRUIKT, TARIEF, MINTARIEF, LOGLENGTE });
