/* ECON-01 -- GELDRICHTING IS NIET HETZELFDE ALS ECONOMISCHE EIGENDOM.

   De regel, in een zin:

       Bij een omkering draait de RICHTING om en blijft de EIGENAAR staan.

   Uitgeschreven aan een voorbeeld dat echt is gemeten (15 september 2026, de
   terugboeking van een reis):

       heen   eigenaar = HOTEL    richting = lid -> RTG (RTG int)
       terug  eigenaar = HOTEL    richting = RTG -> lid

   De economische oorzaak wordt NIET achteraf herschreven omdat het geld
   terugloopt. Een hotelnacht van EUR 960 terugdraaien is min EUR 960
   DOORBELASTING; het is geen schuld aan de klant die uit het niets ontstaat.

   ================== WAAROM DIT EEN REGEL IS EN GEEN TRUC ==================

   De verleidelijke redenering is: "het geld gaat naar het lid, dus de eigenaar
   is het lid." Die klopt over de KASSTROOM en is onwaar over de EIGENDOM, en het
   verraderlijke is dat het totaal er niet door verandert. Bij een volledige
   terugbetaling van EUR 1.950 geeft de foute lezing:

       bruto 0            (klopt)
       doorbelasting      1800   (liegt -- er is niets meer aan derden verschuldigd)
       bijdragebasis       120   (liegt -- RTG heeft niets overgehouden)
       aan de klant      -1950   (een post die er economisch niet is)

   Drie getallen die samen nul zijn en elk afzonderlijk onwaar. Precies daarom
   kan deze fout maanden blijven staan: elke controle op het TOTAAL slaagt.

   ================== WAAR HIJ OVERAL GELDT ==================

   Niet alleen bij een reisterugboeking. Dezelfde vorm komt terug bij:

     terugbetaling (geheel of gedeeltelijk), terugboeking door de bank
     (chargeback), het inwisselen of vervallen van een voucher, een
     correctieboeking, een storno, en de afwikkeling met een leverancier
     (settlement).

   Bij elk daarvan is de vraag dezelfde: loopt het geld de andere kant op, of is
   de economische eigendom werkelijk verschoven? Alleen in het tweede geval hoort
   de eigenaar te veranderen -- en dan is het geen omkering maar een nieuwe
   gebeurtenis met een eigen grond.

   ================== WAT DEZE MODULE NIET DOET ==================

   Geld verplaatsen. Hij rekent een spiegelrij uit en handhaaft de regel; wat er
   met het geld gebeurt is aan kern/pay en aan een mens (GELD.md). */
'use strict';

const { geldrij, ONBEKEND } = require('./economischeherkomst');

/* De naam staat als constante zodat een toets, een foutmelding en een document
   naar hetzelfde kunnen wijzen zonder de tekst over te typen. */
const REGEL = 'ECON-01';
const REGELTEKST = 'geldrichting is niet hetzelfde als economische eigendom: bij een omkering ' +
  'draait de richting om en blijft de eigenaar staan';

/* De gevallen waarvoor deze regel is bedoeld. Een gesloten lijst, want "een
   omkering" is een economisch oordeel en geen vrije tekst -- wie een zevende
   geval tegenkomt, hoort te beslissen of het een omkering is of een NIEUWE
   gebeurtenis met een eigen grond. */
const GRONDEN = Object.freeze({
  terugbetaling: 'de verkoper betaalt terug, geheel of gedeeltelijk',
  terugboeking: 'de bank draait de betaling terug (chargeback)',
  storno: 'een incasso wordt teruggedraaid',
  correctie: 'een boeking was onjuist en wordt rechtgezet',
  voucher: 'een tegoed wordt ingewisseld of vervalt',
  afwikkeling: 'de afrekening met een leverancier (settlement)'
});

/* ---------- de spiegel ----------
   Puur: er gaat een geldrij in en er komt een geldrij uit. Geen db, geen pay. */
function keerOm(rij, { grond, reden, bronObject, bewijs } = {}) {
  if (!rij || rij.bedragCenten == null) {
    return { ok: false, waarom: 'geen geldrij met een bedrag om om te keren', rij: null };
  }
  if (!Object.prototype.hasOwnProperty.call(GRONDEN, String(grond || ''))) {
    return { ok: false, rij: null,
      waarom: 'een omkering draagt een grond uit de gesloten lijst (' +
        Object.keys(GRONDEN).join(', ') + '); "' + grond + '" staat er niet bij' };
  }
  const toelichting = String(reden || '').trim();
  if (toelichting.length < 4) {
    /* Een bedrag dat terugloopt zonder opgeschreven reden, ziet er bij controle
       hetzelfde uit als een fout. */
    return { ok: false, rij: null, waarom: 'een omkering draagt een reden, en die ontbreekt' };
  }

  return {
    ok: true, waarom: null,
    rij: geldrij({
      bedragCenten: -rij.bedragCenten,
      valuta: rij.valuta,
      /* DE RICHTING DRAAIT OM: wie de waarde ontving wordt de bron, en andersom. */
      economischeHerkomst: rij.naarWie,
      naarWie: rij.economischeHerkomst,
      /* EN DE EIGENDOM BLIJFT STAAN. Dit is ECON-01 en de hele reden dat deze
         module bestaat. */
      economischeEigenaar: rij.economischeEigenaar,
      grond: grond + ' (' + toelichting + '): ' + (rij.grond || ''),
      bronObject: bronObject || rij.bronObject,
      relatie: rij.relatie, land: rij.land,
      bewijs: bewijs || (REGEL + ': omkering van ' + (rij.bronObject || 'een geldrij'))
    })
  };
}

/* ---------- de handhaver ----------
   Geeft de SCHENDINGEN terug, niet een boolean: wie een regel overtreedt hoort
   te lezen welke helft, en een lege lijst leest als "in orde" zonder dat er een
   tweede woord voor nodig is. */
function schendingen(origineel, spiegel) {
  const uit = [];
  if (!origineel || !spiegel) return [REGEL + ': er is geen paar om te toetsen'];

  if (spiegel.economischeEigenaar !== origineel.economischeEigenaar) {
    uit.push(REGEL + ': de eigenaar veranderde van "' + origineel.economischeEigenaar +
      '" naar "' + spiegel.economischeEigenaar + '". ' + REGELTEKST + '. Loopt het geld de ' +
      'andere kant op, of is de eigendom werkelijk verschoven? Alleen in het tweede geval is ' +
      'dit geen omkering maar een nieuwe gebeurtenis met een eigen grond.');
  }
  if (spiegel.economischeHerkomst !== origineel.naarWie || spiegel.naarWie !== origineel.economischeHerkomst) {
    uit.push(REGEL + ': de richting draaide niet om (' + origineel.economischeHerkomst + ' -> ' +
      origineel.naarWie + ' werd ' + spiegel.economischeHerkomst + ' -> ' + spiegel.naarWie + ')');
  }
  if (origineel.bedragCenten != null && spiegel.bedragCenten !== -origineel.bedragCenten) {
    uit.push(REGEL + ': het bedrag spiegelt niet (' + origineel.bedragCenten + ' tegenover ' +
      spiegel.bedragCenten + ')');
  }
  if (spiegel.valuta !== origineel.valuta) {
    uit.push(REGEL + ': de valuta veranderde; een omkering rekent niet om');
  }
  /* EEN OMKERING VAN IETS ONBEKENDS IS GEEN OMKERING. Wie een rij spiegelt
     waarvan de eigenaar niet vaststaat, verdubbelt de onwetendheid in plaats van
     hem terug te draaien. */
  if (origineel.economischeEigenaar === ONBEKEND) {
    uit.push(REGEL + ': het origineel heeft geen vastgestelde eigenaar; een omkering daarvan ' +
      'verdubbelt de onwetendheid in plaats van hem terug te draaien');
  }
  return uit;
}

module.exports = { REGEL, REGELTEKST, GRONDEN, keerOm, schendingen };
