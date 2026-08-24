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

/* IN BLOKKEN SNOEIEN, NIET PER REGEL -- en dat is geen detail.

   Beide lijsten hierboven werden bijgehouden met `splice(0, 1)` zodra ze een
   regel te lang waren. Een splice vooraan verschuift de HELE array: op het
   venster is dat 4.000 verplaatsingen per verzoek, op het bewaarde deel 20.000.
   Bij een paar duizend verzoeken per seconde is dat tientallen miljoenen
   verplaatsingen per seconde voor het weggooien van EEN regel. In het
   CPU-profiel van 24 augustus 2026 was deze functie daarmee de duurste van de
   hele applicatie: 8,3% van alle rekentijd, meer dan het routeren zelf.

   De grens blijft precies wat hij was -- de lijst gaat NOOIT over het maximum
   heen. Het verschil is dat we bij overschrijding een BLOK ineens weghalen en
   dus onder het maximum uitkomen, in plaats van er telkens exact op te gaan
   zitten. Zo kost het snoeien eens per BLOK-regels wat het eerst per regel
   kostte, en dat is geamortiseerd niets.

   Wat je ervoor inlevert, eerlijk gezegd: het venster houdt geen 4.000 regels
   maar tussen de 3.800 en 4.000. Het scherm leest er `slice(-n)` uit met een n
   die daar ver onder ligt, dus dat is niet te zien -- maar het staat hier omdat
   het wel een echt verschil is en geen afronding. */
const BLOK = (max) => Math.max(1, Math.floor(max * 0.05));
const VENSTER_BLOK = BLOK(VENSTER);
const BEWAARD_BLOK = BLOK(BEWAARD_MAX);
/* Snoei `lijst` terug tot ten hoogste `max`, en haal er een blok extra af zodat
   de volgende snoeibeurt pas over BLOK regels nodig is. */
function snoei(lijst, max, blok) {
  if (lijst.length <= max) return;
  lijst.splice(0, lijst.length - max + blok);
}

/* Een pad zonder de veranderlijke stukken: /api/lid/42/pas wordt /api/lid/:id/pas.
   Zo tellen honderd verzoeken naar honderd leden als EEN regel in een overzicht,
   en staat er bovendien geen id in het journaal dat naar een persoon leidt. */
function padVorm(p) {
  return String(p || '')
    .replace(/\/[0-9a-f]{16,}/gi, '/:sleutel')
    .replace(/\/\d+/g, '/:id')
    .slice(0, 120);
}

/* Een bestemming zonder de persoon erin: 'sms:+31612345678' wordt 'sms', en een
   e-mailadres wordt het domein. Het journaal moet laten zien DAT er post uitging
   en of het lukte, niet aan wie. */
function bestemmingVorm(naar) {
  const s = String(naar || '');
  if (s.startsWith('sms:')) return 'sms';
  const at = s.indexOf('@');
  if (at > 0) return 'mail:' + s.slice(at + 1).slice(0, 40);
  return s.slice(0, 40) || 'onbekend';
}

function maakDoorgeefjournaal({ db, save, nu, bestand }) {
  const klok = nu || (() => new Date().toISOString());
  const venster = [];

  /* HET BEWAARDE DEEL WOONT IN EEN BESTAND, NIET IN EEN COLLECTIE.

     Het stond in db.data.doorgeefjournaal: een array van 20.000 regels, dus een
     blob in een rij van de opslag. Elke save() ergens in de applicatie
     serialiseerde die hele lijst opnieuw om er een regel bij te zetten -- 3,6 MB
     werk voor 200 byte nieuwe gegevens. Gemeten kostte dat gemiddeld 32,9 ms per
     save met een piek van 101 ms, synchroon op de event-loop. Zie de kop van
     kern/journaalbestand.js voor de hele meting.

     Een logboek is geen toestand: er wordt alleen achteraan bij geschreven en
     vooraan afgesneden. Dat hoort in een bestand. */
  const boek = bestand || null;

  /* De verhuizing gebeurt EEN keer, bij het aanmaken, en alleen als er nog een
     oude collectie ligt. Zonder dit zou een bestaande installatie zijn
     geschiedenis kwijtraken op het moment van bijwerken -- stil, want niemand
     kijkt elke dag in het journaal. */
  function verhuisOude() {
    if (!boek) return 0;
    const oud = db.data && db.data.doorgeefjournaal;
    if (!Array.isArray(oud) || !oud.length) return 0;
    let n = 0;
    for (const r of oud) if (boek.voegToe(r)) n++;
    boek.spoelNu();
    delete db.data.doorgeefjournaal;
    try { save(); } catch (e) {}
    console.log('[journaal] ' + n + ' bewaarde regels verhuisd van de database naar ' + boek.stand().map);
    return n;
  }
  try { verhuisOude(); } catch (e) { console.warn('[journaal] verhuizen mislukt:', e.message); }

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
        boek.voegToe(regel);
        return regel;
      }
      const lijst = rij();
      lijst.push(regel);
      snoei(lijst, BEWAARD_MAX, BEWAARD_BLOK);
      /* NIET bij elke regel save(): dat zou van elk verzoek een schrijfactie
         maken.

         EN BIJ EEN MISLUKKING OOK NIET METEEN, en dat is een correctie op wat
         hier stond. De gedachte was goed -- juist die regel wil je terugvinden
         als de server daarna omvalt -- maar de prijs was fout: het journaal is
         EEN blob in EEN rij, dus elke save() serialiseert en versleutelt de hele
         lijst opnieuw. Nagemeten op een verse installatie: 500 verzoeken naar
         een onbekend pad gaven 1002 schrijfacties en lieten de WAL met 4,18 MB
         groeien (13,9 kB per verzoek), en de prijs LIEP OP met de lijst: 0,72 ms
         bij 159 kB journaal, 3,63 ms bij 1114 kB. Bij de eigen bovengrens van
         20.000 regels is dat ~10 ms geblokkeerde lus per mislukt verzoek, en het
         zakt daarna nooit meer.

         Erger dan traag: een willekeurige bezoeker kon met een GET naar een
         niet-bestaand pad een schijfschrijving afdwingen. Dat is de enige plek
         in het huis waar dat kon.

         Nu: hooguit EEN keer per seconde spoelen. Een mislukking is daarmee
         hooguit een seconde later op schijf -- en een server die precies in dat
         venster omvalt, laat een regel liggen die in het VENSTER wel stond. Die
         ruil is de goede kant op: een journaal dat de server traag maakt, is
         zelf de storing geworden. */
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
