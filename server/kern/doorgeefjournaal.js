/* HET DOORGEEFJOURNAAL: wat er binnenkwam en wat er de deur uitging.

   WAAROM DIT ER KOMT. In een nacht gingen drie dingen mis die allemaal
   ONZICHTBAAR faalden: de sleutels verzonnen zichzelf opnieuw, de herstel-link
   lag op straat, en de sms met de herstelcode viel stil op de grond terwijl het
   antwoord `tweestaps: true` meldde. Bij alle drie was de vraag "wat gebeurde er
   eigenlijk?" niet te beantwoorden zonder in de code te duiken.

   Verzoeken werden al gelogd (server/log.js): id, methode, pad, status, duur.
   Twee dingen ontbraken. Ten eerste een plek om het te LEZEN -- het techniek-
   scherm toonde er alleen een grafiekje van. Ten tweede de UITGAANDE kant: post,
   sms, push en aanroepen naar buiten stonden nergens, en juist daar zat de
   storing.

   WAAROM NIET ELKE FUNCTIE. Er is gevraagd om een regel per functie. Dat is drie
   keer verkeerd: het zijn duizenden aanroepen per seconde (ruis waarin je een
   storing juist kwijtraakt), het kost snelheid op elke aanroep, en functies
   krijgen echte namen en adressen als argument -- die in een logboek schrijven
   breekt de merkregel dat klantdata op codenamen draait. Een regel per
   BINNENKOMEND verzoek en per UITGAAND bericht geeft hetzelfde inzicht zonder
   een van die drie prijzen.

   WAT ER NOOIT IN KOMT: een naam, een e-mailadres, een telefoonnummer, een
   documentnummer, een wachtwoord, een token of een herstelsleutel. Wie er iets
   deed staat op codenaam of op sleutel. test/loghygiene.test.js bewaakt dat voor
   het bestaande logboek; test/doorgeefjournaal.test.js doet het voor dit.

   TWEE LAGEN, met opzet:
   - een VENSTER in het geheugen (de laatste VENSTER regels): gratis, snel, en
     wat het scherm laat zien.
   - een BEWAARD journaal in db.data: zodat je morgen kunt terugkijken wat er
     vannacht misging. Met een termijn, via de bestaande bewaartabel -- geen
     tweede opruimmechanisme naast server/bewaarveger.js. */
'use strict';

const VENSTER = 4000;          // regels in het geheugen; genoeg voor een werkdag kijken
const BEWAARD_MAX = 20000;     // harde bovengrens op schijf, los van de termijn

/* IN BLOKKEN SNOEIEN, NIET PER REGEL. Het venster werd bijgehouden met
   `splice(0, 1)` zodra het een regel te lang was, en een splice vooraan
   verschuift de HELE array: 4.000 verplaatsingen per verzoek om er een weg te
   halen. In het CPU-profiel was dit de duurste functie van de applicatie
   (PRESTATIES.md). De grens blijft wat hij was -- de lijst gaat nooit over het
   maximum -- maar bij overschrijding gaat er een BLOK ineens af, zodat het
   snoeien geamortiseerd niets kost. Het venster houdt daardoor tussen de 3.800
   en 4.000 regels; het scherm leest er `slice(-n)` uit met een veel kleinere n. */
const BLOK = (max) => Math.max(1, Math.floor(max * 0.05));
const VENSTER_BLOK = BLOK(VENSTER);
const BEWAARD_BLOK = BLOK(BEWAARD_MAX);
/* Snoei `lijst` terug tot ten hoogste `max`, en haal er een blok extra af zodat
   de volgende snoeibeurt pas over BLOK regels nodig is. */
function snoei(lijst, max, blok) {
  if (lijst.length <= max) return;
  lijst.splice(0, lijst.length - max + blok);
}

const { padVorm, bestemmingVorm } = require('./journaalvorm');

function maakDoorgeefjournaal({ db, save, nu, bestand }) {
  const klok = nu || (() => new Date().toISOString());
  const venster = [];

  /* HET BEWAARDE DEEL WOONT IN EEN BESTAND, NIET IN EEN COLLECTIE.

     Het stond in db.data.doorgeefjournaal: een array van 20.000 regels, dus een
     blob in een rij van de opslag. Elke save() ergens in de applicatie
     serialiseerde die hele lijst opnieuw om er een regel bij te zetten. Een
     logboek is geen toestand -- er wordt alleen achteraan bij geschreven en
     vooraan afgesneden -- en hoort dus in een bestand. Zie de kop van
     kern/journaalbestand.js voor de meting en de afwegingen. */
  /* Het bestand wordt MEEGEGEVEN en niet hier gepakt. Even stond hier een
     standaardboek als er niets was meegegeven; dat scheelde een regel bij de
     aanroeper en leverde verborgen gedeelde staat op -- toetsen die geen bestand
     meegaven schreven allemaal in dezelfde map en zagen elkaars regels. Zonder
     bestand blijft het oude terugvalpad (een collectie) gelden. */
  const boek = bestand || null;

  /* De eenmalige verhuizing van een oude collectie naar het bestand staat in
     ./journaalverhuizing.js -- hij draait een keer per installatie. */
  try { require('./journaalverhuizing').verhuisOude({ db, save, boek }); }
  catch (e) { console.warn('[journaal] verhuizen mislukt:', e.message); }

  /* Zonder bestand (een toets die er geen meegeeft) blijft het oude gedrag
     bestaan, zodat deze module ook los te gebruiken is. */
  const rij = () => {
    if (!Array.isArray(db.data.doorgeefjournaal)) db.data.doorgeefjournaal = [];
    return db.data.doorgeefjournaal;
  };

  /* Schrijven doet twee dingen: het venster bijwerken (altijd) en de regel
     bewaren (alleen als hij het waard is). Alles bewaren zou de database laten
     ontploffen; niets bewaren maakt terugkijken onmogelijk. De grens: alles wat
     MISLUKT is, plus alles wat de deur uitging, plus schrijvende verzoeken.
     Een geslaagde GET van een lijstje is morgen niemand iets waard. */
  function bewaarWaard(r) {
    if (r.mislukt) return true;
    if (r.richting === 'uit') return true;
    return r.methode && r.methode !== 'GET';
  }

  /* Spoelen met een rem erop: hooguit een schrijfactie per seconde, hoeveel
     mislukkingen er ook binnenkomen. unref() zodat een wachtende spoeling het
     proces niet in de lucht houdt bij het afsluiten. */
  let spoelt = null;
  function plan() {
    if (spoelt) return;
    spoelt = setTimeout(() => { spoelt = null; try { save(); } catch (e) {} }, 1000);
    if (spoelt.unref) spoelt.unref();
  }

  function schrijf(r) {
    const regel = {
      t: klok(),
      richting: r.richting === 'uit' ? 'uit' : 'in',
      wat: String(r.wat || '').slice(0, 120),
      wie: String(r.wie || '').slice(0, 60) || null,
      methode: r.methode || null,
      status: Number.isFinite(r.status) ? r.status : null,
      ms: Number.isFinite(r.ms) ? Math.round(r.ms) : null,
      bytes: Number.isFinite(r.bytes) ? r.bytes : null,
      mislukt: !!r.mislukt,
      reden: r.reden ? String(r.reden).slice(0, 140) : null
    };
    venster.push(regel);
    snoei(venster, VENSTER, VENSTER_BLOK);
    if (bewaarWaard(regel)) {
      if (boek) {
        /* Naar het bestand: een push op een stapel die later gespoeld wordt.
           Geen snoeien, geen save() -- het bestand roteert zichzelf. */
        boek.noteerRegel(regel);
        return regel;
      }
      const lijst = rij();
      lijst.push(regel);
      snoei(lijst, BEWAARD_MAX, BEWAARD_BLOK);
      /* TERUGVALPAD: zonder bestand blijft het journaal een collectie. Dan
         geldt nog steeds niet-bij-elke-regel-save(), want dan serialiseert elke
         save de hele lijst opnieuw -- en kon een vreemde met een GET naar een
         onbekend pad een schijfschrijving afdwingen. Vandaar de rem van een
         seconde. */
      if (regel.mislukt) plan();
    }
    return regel;
  }

  const binnen = (r) => schrijf(Object.assign({ richting: 'in' }, r));
  const buiten = (r) => schrijf(Object.assign({ richting: 'uit' }, r, { wat: r.wat, wie: bestemmingVorm(r.naar) }));

  /* Lezen: het venster is de bron voor "wat gebeurt er nu", het bewaarde deel
     voor "wat gebeurde er gisteren". Standaard het venster, want dat is waar
     iemand naar kijkt als hij het scherm opent. */
  function lees({ bron, richting, alleenMislukt, zoek, max } = {}) {
    const grens = Math.min(Math.max(Number(max) || 200, 1), 1000);
    /* Uit het bestand halen we ruim: er wordt hieronder nog gefilterd, en wie
       op 'mislukt' zoekt wil niet dat de filter pas na de afkapping komt. */
    const bewaard = () => (boek ? boek.lees(grens * 20) : rij());
    const uit = (bron === 'bewaard' ? bewaard() : venster).slice();
    const f = uit.filter(r =>
      (!richting || r.richting === richting) &&
      (!alleenMislukt || r.mislukt) &&
      (!zoek || (r.wat + ' ' + (r.wie || '')).toLowerCase().includes(String(zoek).toLowerCase())));
    return { ok: true, bron: bron === 'bewaard' ? 'bewaard' : 'venster', totaal: f.length, regels: f.slice(-grens).reverse() };
  }

  /* Een samenvatting waar je in een oogopslag aan ziet of er iets speelt: hoeveel
     erin, hoeveel eruit, en vooral hoeveel er MISLUKTE. Dat laatste getal is het
     hele punt van dit journaal. */
  function beeld() {
    const tel = (f) => venster.filter(f).length;
    return {
      ok: true,
      venster: venster.length,
      bewaard: boek ? boek.aantal() : rij().length,
      in: tel(r => r.richting === 'in'),
      uit: tel(r => r.richting === 'uit'),
      mislukt: tel(r => r.mislukt),
      uitMislukt: tel(r => r.richting === 'uit' && r.mislukt),
      oudste: venster.length ? venster[0].t : null
    };
  }

  /* Aanmelden bij de haak (server/journaalhaak.js), zodat de lagen ONDER de kern
     kunnen melden zonder naar boven te hoeven reiken: mail.js meldt wat de deur
     uitgaat, de verzoekketen wat er binnenkomt. Voor die aanmelding doet melden
     niets, en dat is precies goed -- een script of een toets hoeft geen journaal. */
  try { require('../journaalhaak').zet((r) => (r && r.richting === 'uit' ? buiten(r) : binnen(r))); } catch (e) {}

  return { journaalBinnen: binnen, journaalBuiten: buiten, journaalLees: lees, journaalBeeld: beeld, journaalPadVorm: padVorm };
}

module.exports = { maakDoorgeefjournaal, padVorm, bestemmingVorm };
