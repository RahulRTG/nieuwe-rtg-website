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
   2. Er is een PLAFOND (de boardroom zet het; zie hieronder). Zonder plafond
      is dit een onbegrensde
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

module.exports = ({ db, save, nu, payVan, codenaamVan }) => {
  /* Het plafond op het VERZILVERDE tegoed. Bewust anders dan het walletplafond
     en niet dezelfde constante: dit is een andere pot met een ander verhaal.
     Bij 1 punt per 10 euro en 100 punten per 10 euro tegoed hoort hier 50.000
     euro aan besteding bij -- ruim buiten bereik van een gewoon lid, en toch
     een grens, zodat de aanspraak begrensd is in plaats van open. Het BEDRAG is
     een keuze en geen wet; zie TOKEN.md par. 7. */
  /* HET PLAFOND KOMT VAN DE BOARDROOM, met dit getal als standaard tot die
     koppeling er is (kern/bankregie/instellingen.js). Het stond hier als vaste
     constante, en daarmee was de grond onder het besluit in
     kern/bevoegdheid/lijst.js alleen te verzetten door een programmeur -- terwijl
     het WEL het soort getal is dat een bestuurder hoort te kunnen kiezen.

     Per verzilvering gelezen en niet eenmalig: een plafond dat pas na een
     herstart meetelt, is een scherm dat een ander getal toont dan de grendel. */
  const STANDAARD_TEGOED_MAX = 50000;   // 500 euro aan verzilverd tegoed
  let plafondBron = () => STANDAARD_TEGOED_MAX;
  const puntenKoppelPlafond = fn => { if (typeof fn === 'function') plafondBron = fn; };
  /* Fail-closed, net als bij het walletplafond: valt de koppeling weg of levert
     hij onzin, dan is er GEEN ruimte in plaats van oneindig ruimte. */
  const tegoedMax = () => { const v = Math.round(Number(plafondBron())); return Number.isFinite(v) && v >= 0 ? v : 0; };

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
      plafondCenten: tegoedMax(), historie: p.historie.slice(0, 20) };
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
  async function verzilverPunten(key, aantal) {
    const n = parseInt(aantal, 10);
    if (!(n >= 100) || n % 100 !== 0) return { status: 400, error: 'Verzilveren kan per 100 punten (= € 10 tegoed).' };
    const p = puntenRek(key);
    if (p.saldo < n) return { status: 409, error: 'U heeft ' + p.saldo + ' punten; dat is niet genoeg.' };
    const centen = (n / 100) * 1000;

    /* VERZILVEREN LANDT IN DE WALLET, en daarmee houdt het tweede saldo op te
       bestaan. Dit stond als apart bedrag naast RTG Pay: `tegoedCenten`, een
       euro-aanspraak op RTG die alleen als KORTING kon worden ingelost, op de
       drie betaalpaden die hem kenden. Twee bedragen die allebei geld van
       hetzelfde lid voorstellen, is precies waar kern/geldwereld.js voor
       waarschuwt -- en het lid moest maar weten welk potje waar gold.

       Dat kon pas nu. Zolang bestellingen, rekeningen en ritten zelf geen geld
       verplaatsten, was verzilverd tegoed in de wallet juist ONbesteedbaar: de
       korting verdween en er kwam geen betaling voor terug. Sinds die drie
       paden via RTG Pay lopen (kern/pay/zaakbetaling.js) is het andersom, en is
       walletsaldo de enige vorm die overal werkt.

       Het geld komt van de huisrekening: RTG geeft hier iets weg, dus er hoort
       een boeking tegenover te staan en geen opgehoogd veld. En het WALLETPLAFOND
       geldt: zit de wallet vol, dan weigert dit met de reden erbij -- de punten
       blijven dan gewoon staan, want de aftrek gebeurt hieronder pas NA de
       boeking. */
    const pay = typeof payVan === 'function' ? payVan() : null;
    const codenaam = typeof codenaamVan === 'function' ? codenaamVan(key) : null;
    if (pay && pay.huisUit && codenaam) {
      const b = await pay.huisUit({ aanCodenaam: codenaam, centen,
        oms: 'RTG-punten verzilverd', idem: 'punten:' + key + ':' + p.saldo + ':' + n });
      if (b.error) return b;
      p.saldo -= n;
      p.historie.unshift({ punten: -n, reden: '€ ' + (centen / 100) + ' naar je wallet', at: nu() });
      save();
      return { ok: true, saldo: p.saldo, naarWalletCenten: centen,
        tegoedCenten: p.tegoedCenten, tegoed: p.tegoedCenten / 100 };
    }
    /* TERUGVAL: zonder pay of zonder codenaam (een gast) blijft het oude tegoed
       bestaan. Dat is geen tweede weg die we openhouden maar een vangnet -- als
       de wallet niet bereikbaar is, hoort verzilveren te weigeren of te landen
       waar het altijd landde, en niet stil te verdampen. */
    /* Het plafond valt VOOR de punten worden afgeschreven: anders zijn de
       punten weg en is het tegoed er niet. */
    if (p.tegoedCenten + centen > tegoedMax()) {
      return { status: 409, error: 'Uw tegoed zit aan het maximum van € ' + (tegoedMax() / 100) +
        '. Besteed eerst wat u heeft; uw punten blijven gewoon staan.' };
    }
    p.saldo -= n;
    p.tegoedCenten += centen;
    p.historie.unshift({ punten: -n, reden: 'verzilverd naar € ' + (centen / 100) + ' tegoed', at: nu() });
    save();
    return { ok: true, saldo: p.saldo, tegoedCenten: p.tegoedCenten, tegoed: p.tegoedCenten / 100 };
  }
  /* Het OUDE tegoed -- verrekenen bij een betaling en teruggeven als die
     mislukt -- staat in ./punten-tegoed.js. Niet om de maat, maar omdat dat het
     deel is dat op weg naar buiten is: sinds verzilveren in de wallet landt,
     vult niets dat veld nog. Loopt de laatste rekening leeg, dan kan dat hele
     bestand weg -- en dat is makkelijker te zien als het een bestand is. */
  const tegoed = require('./punten-tegoed')({ db, save, nu, puntenRek });

  return Object.assign({ puntenVan, verdienPunten, verzilverPunten, puntenKoppelPlafond }, tegoed);
};
