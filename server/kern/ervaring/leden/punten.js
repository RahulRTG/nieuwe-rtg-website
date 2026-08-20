/* Leden-deel "punten" (kern/ervaring/leden): de RTG-punten en het tegoed dat
   eruit komt. Afgesplitst van ./spaarpot.js zodra bleek dat dit geld is.

   Sparen: 1 punt per betaalde 10 euro. Verzilveren: 100 punten = 10 euro
   tegoed. Dat tegoed wordt bij de volgende betaling automatisch verrekend; RTG
   legt het verschil bij, de zaak ontvangt altijd het volle bedrag.

   DIT TEGOED IS GELD, EN DAT STOND NERGENS. Punten zelf zijn geen geld -- die
   verdien je en ze hebben geen koers -- maar zodra ze VERZILVERD zijn staat er
   een bedrag in euro's dat het lid van RTG tegoed heeft, tegen een vaste koers
   (100 punten = 10 euro). Dat is dezelfde soort aanspraak als het walletsaldo:
   alleen binnen RTG te besteden, nooit uitbetaald aan het lid. Alleen hing hij
   aan niets -- niet aan de bevoegdhedenlijst, niet aan een plafond, en het
   bedrag stond in EURO'S ALS DRIJVENDE KOMMA terwijl elk ander bedrag in dit
   huis in centen rekent. Er stond ook geen enkele toets op.

   Drie dingen zijn daaraan gedaan, en ze horen bij elkaar:

   1. Het bedrag staat in CENTEN (`tegoedCenten`). Een saldo dat herhaald wordt
      opgeteld en afgetrokken in drijvende komma, loopt weg van zichzelf; dat
      het hier om tientallen euro's gaat maakt dat niet minder waar. `tegoed`
      blijft in het ANTWOORD staan, in euro's, want daar rekent app-main.js mee
      -- de omrekening gebeurt aan de rand en niet in de opslag.
   2. Er is een PLAFOND (TEGOED_MAX). Zonder plafond is dit een onbegrensde
      aanspraak op RTG, en begrensd zijn is nu juist een van de drie
      voorwaarden waarop het besluit onder WALLET_SALDO in
      kern/bevoegdheid/lijst.js rust.
   3. De functie-schakelaar van /api/punten draagt sinds deze ronde datzelfde
      vermogen, zodat de handeling aan een vastgelegd besluit hangt in plaats
      van aan niets.

   WAT ER BEWUST NIET IS GEBEURD: dit tegoed is GEEN tweede grootboek geworden
   naast RTG Pay. Dat zou het wel moeten worden -- twee saldi die allebei geld
   van hetzelfde lid voorstellen zijn precies waar kern/geldwereld.js voor
   waarschuwt -- maar het verrekenen hangt in vijf betaalpaden, en dat omleggen
   is een productbesluit en geen opruiming. Het staat als open besluit in
   TOKEN.md.

   Deze module krijgt met opzet GEEN pay en GEEN betaal-naad mee: wat hier
   verandert kan per definitie geen geld het huis uit bewegen.
*/
'use strict';

module.exports = ({ db, save, nu }) => {
  /* Het plafond op het VERZILVERDE tegoed. Bewust anders dan het walletplafond
     en niet dezelfde constante: dit is een andere pot met een ander verhaal.
     Bij 1 punt per 10 euro en 100 punten per 10 euro tegoed hoort hier 50.000
     euro aan besteding bij -- ruim buiten bereik van een gewoon lid, en toch
     een grens, zodat de aanspraak begrensd is in plaats van open. Het BEDRAG is
     een keuze en geen wet; zie TOKEN.md par. 7. */
  const TEGOED_MAX = 50000;   // 500 euro aan verzilverd tegoed

  function puntenRek(key) {
    const p = db.data.punten[key] = db.data.punten[key] || { saldo: 0, tegoedCenten: 0, historie: [] };
    /* MIGRATIE, en met opzet hier in de accessor: db.data is een document en
       kent geen genummerde schema-migraties zoals de identiteitskluis. Een
       bestaande installatie draagt `tegoed` in euro's; die wordt EEN keer
       omgerekend en daarna is het veld weg. Zonder de save() hieronder zou de
       omrekening bij elke lezing opnieuw gebeuren en nooit landen. */
    if (p.tegoed !== undefined) {
      p.tegoedCenten = Math.max(0, Math.round((Number(p.tegoed) || 0) * 100));
      delete p.tegoed;
      save();
    }
    if (!Number.isFinite(p.tegoedCenten)) p.tegoedCenten = 0;
    return p;
  }
  function puntenVan(key) {
    const p = puntenRek(key);
    /* `tegoed` in euro's blijft in het antwoord staan: app-main.js rendert dat
       veld rechtstreeks. De opslag is centen, de rand is euro's. */
    return { saldo: p.saldo, tegoedCenten: p.tegoedCenten, tegoed: p.tegoedCenten / 100,
      plafondCenten: TEGOED_MAX, historie: p.historie.slice(0, 20) };
  }
  function verdienPunten(key, euro, reden) {
    const n = Math.floor((Number(euro) || 0) / 10);
    if (n <= 0) return 0;
    const p = puntenRek(key);
    p.saldo += n;
    p.historie.unshift({ punten: n, reden: String(reden || 'betaling').slice(0, 60), at: nu() });
    p.historie = p.historie.slice(0, 60);
    return n; // save() gebeurt in de betaal-handler
  }
  function verzilverPunten(key, aantal) {
    const n = parseInt(aantal, 10);
    if (!(n >= 100) || n % 100 !== 0) return { status: 400, error: 'Verzilveren kan per 100 punten (= € 10 tegoed).' };
    const p = puntenRek(key);
    if (p.saldo < n) return { status: 409, error: 'U heeft ' + p.saldo + ' punten; dat is niet genoeg.' };
    const centen = (n / 100) * 1000;
    /* Het plafond valt VOOR de punten worden afgeschreven: anders zijn de
       punten weg en is het tegoed er niet. */
    if (p.tegoedCenten + centen > TEGOED_MAX) {
      return { status: 409, error: 'Uw tegoed zit aan het maximum van € ' + (TEGOED_MAX / 100) +
        '. Besteed eerst wat u heeft; uw punten blijven gewoon staan.' };
    }
    p.saldo -= n;
    p.tegoedCenten += centen;
    p.historie.unshift({ punten: -n, reden: 'verzilverd naar € ' + (centen / 100) + ' tegoed', at: nu() });
    save();
    return { ok: true, saldo: p.saldo, tegoedCenten: p.tegoedCenten, tegoed: p.tegoedCenten / 100 };
  }
  // bij het betalen: verreken tegoed (RTG legt bij; de zaak ziet het volle bedrag)
  function pasTegoedToe(key, totaal) {
    if (!db.data.punten[key]) return 0;          // geen rekening: niets te verrekenen, en niets aan te maken
    const p = puntenRek(key);
    if (!(p.tegoedCenten > 0)) return 0;
    /* De aanroepers rekenen in EURO'S (o.total en r.quote zijn euro-getallen),
       dus dat blijft de vorm van het antwoord. Binnen deze functie is alles
       centen, zodat het bewaarde saldo exact blijft. */
    const kortingCenten = Math.min(p.tegoedCenten, Math.max(0, Math.round((Number(totaal) || 0) * 100)));
    if (kortingCenten <= 0) return 0;
    p.tegoedCenten -= kortingCenten;
    p.historie.unshift({ punten: 0, reden: '€ ' + (kortingCenten / 100) + ' tegoed verrekend', at: nu() });
    return kortingCenten / 100; // save() gebeurt in de betaal-handler
  }


  return { puntenVan, verdienPunten, verzilverPunten, pasTegoedToe };
};
