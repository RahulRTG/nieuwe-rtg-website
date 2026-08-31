/* DE WAARDELAAG: elke positie in het grootboek weet wat hij is.

   RTG Pay boekt centen van de ene rekening naar de andere en dat blijft zo --
   deze laag boekt niets en houdt geen saldo bij (GELD.md par. 1: geen tweede
   boekhouding). Wat hij toevoegt is BETEKENIS aan een rekening: welke klasse,
   van welke uitgever, met welk beleid, tot wanneer, en met welk plafond.

   DE POORT is waar het op aankomt. `poort()` is de enige functie die RTG Pay
   aanroept, en hij beantwoordt in EEN keer de drie vragen die voor een boeking
   uit elkaar gehouden moeten worden:

     1. is er genoeg BESCHIKBAAR (saldo min wat vastgezet staat)?
     2. MAG deze waarde hiervoor worden gebruikt (de beleidstoets)?
     3. past het bedrag nog binnen het PLAFOND van de ontvangende positie?

   Die derde vraag is de reden dat dit bestand bestaat. Het besluit onder
   WALLET_SALDO in kern/bevoegdheid/lijst.js zegt sinds zijn eerste regel dat
   het gesloten circuit "een maximum per wallet en per boeking" kent, en dat de
   grond onder het besluit wegvalt als die plafonds worden losgelaten. Er was
   alleen nooit een maximum per wallet: kern/pay/stand.js kent MAX_CENTEN (per
   boeking) en KASCODE_MAX, en verder niets. Een lid kon dus onbeperkt opladen.
   Het besluit beschreef een werkelijkheid die de code niet had.

   WAT HIER GEEN OORDEEL IS. Deze laag zegt niet of RTG BEVOEGD is -- dat is
   kern/bevoegdheid, en die vraag gaat over RTG. Deze gaat over de waarde zelf.
   Ze staan naast elkaar en vervangen elkaar niet: een uitbetaling die van de
   klasse mag, kan nog steeds op een ontbrekende vergunning stuklopen. */
'use strict';

const { KLASSEN, SOORTEN, STANDAARD, ONBEKEND } = require('./klassen');
/* De tijd komt uit de huisklok en niet uit het besturingssysteem: een
   vervaldatum die zich van RTG_KLOK niets aantrekt, is niet te beproeven.
   Wie zelf een klok meegeeft (de toetsen doen dat) houdt die gewoon. */
const { nu: klokNu } = require('../../lib/klok');
const { toets } = require('./policy');
const { maakReserve } = require('./reserve');

/* Welke rekeningen zijn een waardepositie? De extern-rekeningen NIET: die zijn
   de tegenkant van het dubbel boekhouden (daar staat de echte kaartbetaling of
   payout tegenover) en mogen juist negatief staan. Een plafond of een
   beleidstoets daarop zou het grootboek laten klemmen op zijn eigen sluitpost. */
function klasseVan(rek) {
  const r = String(rek || '');
  if (r.startsWith('lid:')) return 'PERSONAL_FUNDED';
  if (r.startsWith('partner:')) return 'PARTNER_SETTLEMENT';
  /* Een uitgegeven positie hoort altijd geregistreerd te zijn -- ./uitgifte.js
     maakt de registratie en de rekening in dezelfde handeling. Staat er toch
     eentje zonder, dan is dat een fout, en dan valt hij terug op ONBEKEND: de
     strengste klasse, niet op "geen regels" en ook niet op de klasse van een
     gewone wallet. Sinds die laatste uitbetaalbaar is, zou dat een onbekende
     positie stilzwijgend uitbetaalbaar maken. Wat we niet kennen, kan niets. */
  if (r.startsWith('waarde:')) return ONBEKEND;
  return null;
}

/* HET WALLETPLAFOND KOMT VAN BUITEN, en dat is een samenvoegbesluit van
   26 augustus 2026. ./klassen.js draagt per klasse een plafondCenten, en voor
   PERSOONLIJK SALDO stond daar 500000 hard ingevuld. Tegelijk kent dit huis al
   een INSTELBAAR walletplafond: de boardroom verzet het via
   /api/office/bank/instellingen en kern/pay/plafond.js leest het per boeking.
   Twee getallen over hetzelfde, en dat liep meteen uit elkaar -- de boardroom
   verzette het naar 10.000 en deze laag weigerde nog steeds op 5.000, met een
   melding die een ander bedrag noemde dan het scherm van het lid.
   Nu is er EEN bron: koppelWalletPlafond() bindt de live waarde, precies zoals
   pay.koppelPlafond dat doet. Zonder koppeling blijft het getal uit de tabel
   staan, dus een losse waardelaag gedraagt zich exact als voorheen. */
function maakWaarde({ db, save, crypto, nu = klokNu }) {
  const eigen = require('../eigencollectie')({ db, domein: 'kern/waarde', bezit: { waardePosities: 'kaart' } });
  let walletPlafondBron = null;
  const koppelWalletPlafond = (fn) => { walletPlafondBron = typeof fn === 'function' ? fn : null; };
  const reserve = maakReserve({ db, save, crypto, nu });
  /* Oormerken (./oormerk.js) zijn de tweede manier waarop geld vaststaat, en
     met opzet een ander begrip dan een reservering: iemand anders houdt uw geld
     vast (reservering, vervalt) tegenover u zet uw eigen geld apart (oormerk,
     blijft). Zie de kop daar voor waarom die twee niet samen mogen vallen. */
  const oormerk = require('./oormerk').maakOormerk({ db, save, crypto, nu });

  function posities() {
    return eigen.bak('waardePosities');
  }

  /* De positie van een rekening. Staat er niets geregistreerd, dan volgt de
     klasse uit de naam van de rekening -- zo hoeven de duizenden bestaande
     wallets niet eerst een registratie te krijgen om onder een plafond te
     vallen. Een lege registratie mag nooit "geen regels" betekenen. */
  function positie(rek) {
    const eigen = posities()[rek];
    const klasse = (eigen && KLASSEN[eigen.klasse]) ? eigen.klasse : klasseVan(rek);
    if (!klasse) return null;
    /* Het plafond van de PERSOONLIJKE wallet komt uit de koppeling als die er is;
       de rest van de spec blijft de tabel. Een kapotte bron mag het plafond nooit
       OPENEN, dus een onbruikbare waarde valt terug op de tabel. */
    let spec = KLASSEN[klasse];
    if (klasse === 'PERSONAL_FUNDED' && walletPlafondBron) {
      const v = Math.round(Number(walletPlafondBron()));
      if (Number.isFinite(v) && v > 0) spec = Object.assign({}, spec, { plafondCenten: v });
    }
    return { rek, klasse, spec,
      uitgever: (eigen && eigen.uitgever) || null,
      eigenaar: (eigen && eigen.eigenaar) || (rek.startsWith('lid:') ? rek.slice(4) : null),
      beleid: (eigen && eigen.beleid) || {},
      vervaltOp: (eigen && Number.isFinite(eigen.vervaltOp)) ? eigen.vervaltOp : null,
      sinds: (eigen && eigen.sinds) || null, geregistreerd: !!eigen };
  }

  function registreer({ rek, klasse, uitgever, eigenaar, beleid, vervaltOp }) {
    if (!rek) return { status: 400, error: 'Welke rekening?' };
    if (!KLASSEN[klasse]) return { status: 400, error: 'Kies een klasse: ' + SOORTEN.join(', ') + '.' };
    const spec = KLASSEN[klasse];
    const verval = Number.isFinite(vervaltOp) ? vervaltOp
      : (spec.vervaltNaDagen ? nu() + spec.vervaltNaDagen * 86400000 : null);
    posities()[rek] = { klasse, uitgever: uitgever || null, eigenaar: eigenaar || null,
      beleid: beleid || {}, vervaltOp: verval, sinds: nu() };
    save();
    return { ok: true, positie: positie(rek) };
  }

  /* EEN REGISTRATIE TERUGNEMEN, en dit is met opzet het smalste wat er bestaat.

     Waarom hij er is: kern/pay/budget.js zet eerst de positie klaar en boekt
     daarna. Faalt de boeking, dan blijft er een lege positie achter -- en dat
     stond daar als een bewuste keuze, met de redenering "kost niemand geld,
     verwarrend hooguit". Die redenering miste een tweede regel: uitgifte.js
     laat maar 25 open posities per lid toe. Gemeten op 31 augustus 2026: 24
     mislukte pogingen van EEN werkgever met te weinig saldo, en daarna krijgt
     dat lid van NIEMAND meer een budget -- "Dit lid heeft te veel open
     posities". Twee besluiten die elk apart kloppen en samen een lid buiten
     sluiten.

     Waarom hij zo smal is: een grootboek hoort niet te kunnen vergeten. Deze
     functie neemt daarom alleen een registratie terug, nooit een boeking, en
     de aanroeper moet AANTONEN dat er nooit geld op stond -- deze laag houdt
     zelf geen saldo bij (zie de kop) en kan dat dus niet zelf zien. Wie hem
     aanroept zonder dat bewijs, krijgt een weigering en geen stilte. */
  function registratieTerug(rek, { saldoCenten } = {}) {
    if (!rek) return { status: 400, error: 'Welke rekening?' };
    if (!posities()[rek]) return { status: 404, error: 'Deze positie is niet geregistreerd.' };
    if (saldoCenten === undefined || saldoCenten === null) {
      return { status: 400, error: 'Toon aan dat deze positie leeg is; deze laag houdt geen saldo bij.' };
    }
    if (Math.round(Number(saldoCenten)) !== 0) {
      return { status: 409, error: 'Op deze positie staat geld; een registratie met saldo wordt niet teruggenomen.' };
    }
    delete posities()[rek];
    save();
    return { ok: true, teruggenomen: rek };
  }

  /* Beschikbaar is saldo min wat vastgezet staat. Dit is het getal waar een
     bestedingsvraag tegenaan hoort, en niet het saldo -- zie ./reserve.js. */
  function beschikbaar(rek, saldo) {
    return Math.round(Number(saldo) || 0) - reserve.vastgezet(rek) - oormerk.apart(rek);
  }

  /* Ruimte onder het plafond van de ONTVANGENDE positie. Geen positie of geen
     plafond (een zaak int een dag lang door) -> oneindig, en dan is dit een
     no-op in plaats van een grens die niemand heeft besloten. */
  function ruimte(rek, saldo) {
    const p = positie(rek);
    if (!p || !Number.isFinite(p.spec.plafondCenten)) return Infinity;
    return p.spec.plafondCenten - Math.round(Number(saldo) || 0);
  }

  /* DE POORT staat in ./beslis.js -- drie vragen (beschikbaar, mag het, past het
     binnen het plafond) en dat is het stuk met de meeste redenering per regel.
     Hier houden we de opbouw: registratie, saldi-rekenwerk en de deelmodules. */
  const poort = require('./beslis')({ positie, beschikbaar, ruimte, reserve, toets, nu });

  /* De alleen-lezen kant (./kijken.js): wat een lid heeft en wat er op een
     positie staat. Daar komen save noch registreer binnen -- wie er iets
     verandert kan per definitie niets aan een positie wijzigen. Zelfde reden
     als kern/pay/kijken.js. */
  const kijk = require('./kijken')({ posities, positie, beschikbaar, ruimte, reserve, oormerk, KLASSEN });

  const api = { KLASSEN, SOORTEN, STANDAARD, positie, registreer, registratieTerug, beschikbaar, ruimte, poort, toets,
    koppelWalletPlafond,
    positiesVan: kijk.positiesVan, overzicht: kijk.overzicht, portefeuille: kijk.portefeuille,
    reserveer: reserve.reserveer, vastleggen: reserve.vastleggen, vrijgeven: reserve.vrijgeven,
    gereserveerd: reserve.vastgezet, reserveringen: reserve.open,
    reserveringenVan: reserve.voorRef, reservering: reserve.vind,
    oormerken: oormerk.oormerken, apart: oormerk.apart,
    oormerkZet: oormerk.oormerkZet, oormerkVrij: oormerk.oormerkVrij };
  Object.assign(api, require('./uitgifte')({ api, crypto, nu }));
  /* De samenstelling (./samenstellen.js): uit welke potjes komt deze betaling,
     en in welke volgorde. Rekent alleen uit; boeken doet kern/pay/samen.js,
     langs dezelfde poort als elke andere betaling. */
  Object.assign(api, require('./samenstellen')({ KLASSEN, positie: api.positie,
    positiesVan: api.positiesVan, beschikbaar: api.beschikbaar, toets }));
  return { waarde: api };
}

module.exports = { maakWaarde, klasseVan };
