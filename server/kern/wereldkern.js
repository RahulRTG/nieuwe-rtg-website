/* De wereldkern: de taal die alle samenhanglagen delen (PLATFORM.md, het
   wereldpatroon).

   WAAROM DIT BESTAAT. De vier samenhanglagen (reiswereld, kantoorwereld,
   socialewereld, geldwereld) horen dezelfde taal te spreken, en dat deden ze
   ook -- door copy-paste. De functie `bron` stond er vier keer LETTERLIJK, de
   rangtabel drie keer, en de vier signalen in elk bestand opnieuw. Zolang
   niemand ze aanraakt gaat dat goed; de eerste die er een verandert, maakt
   drie werelden die iets anders bedoelen met hetzelfde woord. Dat is precies
   de vorm waarvan LAT.md regel 4 zegt dat hij uiteenloopt zonder dat iets
   klaagt.

   WAT HIER BEWUST NIET IN STAAT, en dat is de belangrijkste zin van dit
   bestand. Bij het opzetten leek het logisch om ook het sorteren en de
   telling hierheen te halen -- ze lijken op elkaar. Nagemeten bleken ze te
   VERSCHILLEN, en met reden: sociaal sorteert met de klok als derde sleutel
   omdat er meerdere dingen op een dag gebeuren, reizen sorteert op vertrekdag
   en niet op signaal, en de telling van reizen telt komende reizen waar de
   andere drie regels tellen. Die verschillen zijn geen slordigheid maar de
   wereld zelf. Ze hierheen halen zou van vier werelden een grijze middelmaat
   maken, en dat is erger dan drie stukjes dubbele code.

   Hier staat dus alleen de GRAMMATICA: welke signalen bestaan, in welke
   volgorde ze wegen, en hoe een bron stukgaat zonder de rest mee te nemen.
   Het WOORDENBOEK (welke statussen een wereld kent) blijft bij de wereld.

   DE VIER SIGNALEN, en meer zijn het er niet:
     incident   er is iets stuk of verlopen; dit vraagt vandaag aandacht
     aandacht   dit speelt nu of vandaag
     actief     dit loopt, en meestal wacht er iemand op iets
     gezond     dit is in orde; hier hoeft niemand iets mee
   Een vijfde signaal verzinnen is geen uitbreiding maar een tweede taal. */
'use strict';

const SIGNALEN = ['incident', 'aandacht', 'actief', 'gezond'];

/* De volgorde waarin een mens ze wil zien: wat stuk is bovenaan, wat gezond
   is onderaan, en wat geen signaal heeft helemaal achteraan -- dat is geen
   toestand maar een gat, en een gat hoort niet tussen de echte regels. */
const RANG = { incident: 0, aandacht: 1, actief: 2, gezond: 3, '': 4 };

/* Een bron die stukgaat mag de andere niet meenemen, en mag ook niet stil
   verdwijnen. Dat tweede weegt het zwaarst: een beeld waaruit een bron is
   weggevallen ZIET ER COMPLEET UIT, en dan denkt iemand dat er niets speelt.
   Vandaar dat de naam in stil[] belandt en doorreist tot op het scherm. */
function bron(naam, fn, uit, stil) {
  try { for (const r of fn() || []) uit.push(r); }
  catch (e) { stil.push(naam); }
}

/* Het woordenboek van EEN wereld, gecontroleerd tegen de grammatica. Geeft
   een opzoeker terug; een onbekende status levert een lege betekenis op (dat
   mag -- niet elke status heeft een signaal, en de telling rekent zulke
   regels als 'onbekend'), maar een status die een signaal noemt dat niet
   bestaat is een fout in de code en hoort meteen te knallen.

   Waarom hardop en niet stil: een onbekend signaal gaf `RANG[sig]` undefined,
   en `undefined - 0` is NaN. Een vergelijkfunctie die NaN teruggeeft sorteert
   niet -- de rij blijft staan zoals hij was, zonder klacht. Zo'n fout vind je
   nooit terug vanaf het scherm. */
function betekenisVan(tabel) {
  for (const [status, b] of Object.entries(tabel || {})) {
    if (!b || !SIGNALEN.includes(b.sig)) {
      throw new Error('wereldkern: status "' + status + '" gebruikt het onbekende signaal "' +
        (b && b.sig) + '"; de taal kent er vier: ' + SIGNALEN.join(', '));
    }
  }
  return (status) => tabel[String(status || '').toLowerCase()] || {};
}

/* ---------------------------------------------------------------------------
   LAAG 0 VAN HET COMMAND CANVAS: DE STAND (CANVAS.md).

   Elke wereld opent met een oordeel in EEN woord. Dat woord is geen sierstrook
   en geen samenvatting van de drukte: het is de vraag "is er iets aan de hand?"
   beantwoord voordat iemand hoeft te lezen.

   DE ENIGE REGEL DIE ERTOE DOET: DE STAND LIEGT NOOIT. Een stand die altijd
   groen is, is versiering; erger nog is een stand die groen is terwijl er een
   bron zweeg, want dan verkoopt hij een storing als rust. Daarom telt hier niet
   alleen wat er MIS is maar ook wat er NIET GEMETEN is, en dat weegt zwaarder
   dan wat er wel gemeten kon worden.

   De vier niveaus, in de volgorde waarin ze elkaar overstemmen:

     verstoord   er staat een incident tussen; er is iets stuk of verlopen
     onbekend    dit beeld is niet compleet -- een bron zweeg, of een regel
                 heeft een status die deze wereld niet kent
     aandacht    er speelt iets vandaag
     gezond      niets aan de hand, en dat is gemeten en niet gehoopt

   Waarom 'verstoord' boven 'onbekend' staat, en niet andersom: bij een incident
   weet je iets ERGERS dan dat je iets niet weet, en dat hoort voor te gaan. De
   ontbrekende bron verdwijnt daarmee niet -- hij reist mee in `stil` en in
   `reden`, zodat het scherm hem alsnog bij naam noemt.

   WAT EEN WERELD ZELF BENOEMT, EN WAT NIET. De drie woorden voor verstoord,
   aandacht en gezond komen van de wereld zelf: Kantoor is 'Operationeel' waar
   Sociaal 'Rustig' is, en die verschillen zijn de werelden zelf (zie de kop van
   dit bestand). Het woord voor 'onbekend' is met opzet NIET van de wereld. Wie
   zijn eigen onwetendheid mag benoemen, noemt hem vroeg of laat 'Prima'. */
const NIVEAUS = ['verstoord', 'onbekend', 'aandacht', 'gezond'];
const EIGEN = ['verstoord', 'aandacht', 'gezond'];   // de drie die een wereld zelf benoemt
const WOORD_ONBEKEND = 'Onbekend';

function standVan(woorden) {
  const w = woorden || {};
  for (const n of EIGEN) {
    if (typeof w[n] !== 'string' || !w[n].trim()) {
      throw new Error('wereldkern: de stand mist het woord voor "' + n + '"; een wereld die er ' +
        'een weglaat valt bij dat niveau stil, en een stand die zwijgt is een stand die liegt');
    }
  }
  if (w.onbekend !== undefined) {
    throw new Error('wereldkern: "onbekend" is geen woord van de wereld maar van de kern (' +
      WOORD_ONBEKEND + '); wie zijn eigen onwetendheid mag benoemen, noemt hem vroeg of laat mooier');
  }
  return function stand(regels, stil) {
    const r = regels || [], s = stil || [];
    const incident = r.filter((x) => x.sig === 'incident').length;
    const aandacht = r.filter((x) => x.sig === 'aandacht').length;
    /* Een regel zonder signaal is niet 'in orde'. Hij heeft een status die deze
       wereld niet kent, en dat is een gat in de meting -- precies het soort gat
       dat zich als rust voordoet zolang niemand het apart telt. */
    const ongemeten = r.filter((x) => !x.sig).length;
    const niveau = incident ? 'verstoord'
      : (s.length || ongemeten) ? 'onbekend'
        : aandacht ? 'aandacht' : 'gezond';
    return {
      niveau,
      woord: niveau === 'onbekend' ? WOORD_ONBEKEND : w[niveau],
      incident, aandacht, ongemeten,
      /* WAAROM het onbekend is, zodat het scherm de juiste zin kan zetten.
         Niet WELKE bron zweeg: die staat al in `stil` naast deze stand, en
         dezelfde waarheid op twee plekken loopt uiteen (LAT.md regel 4). */
      reden: niveau !== 'onbekend' ? '' : (s.length ? 'bron' : 'status')
    };
  };
}

module.exports = { SIGNALEN, RANG, bron, betekenisVan, NIVEAUS, WOORD_ONBEKEND, standVan };
