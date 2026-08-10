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

module.exports = { SIGNALEN, RANG, bron, betekenisVan };
