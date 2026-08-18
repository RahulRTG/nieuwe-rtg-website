/* Aanmeldingen-deel "klaarzetten": van een geaccepteerde aanvraag naar een zaak.

   AFGESPLITST OMDAT DE NAAD ER ECHT ZIT, en niet alleen omdat het bestand over
   de 10 kB ging. ../aanmeldingen.js gaat over de aanvraag die BINNENKOMT -- de
   intake, de stapel, het besluit van een mens. Dit gaat over wat er daarna
   gebeurt: de zaak klaarzetten, en de poort die dat kan tegenhouden.

   Die knip stond met naam op de NOG-lijst in scripts/check.js ("er zit een
   duidelijke naad in, tussen de AANVRAAG en het BESLUIT"), en hij is nu
   gemaakt.

   DE BEWIJSPOORT ZIT IN provisioneer() ZELF en niet hier. Dat is bewust: deze
   module is een van drie aanroepers, en een poort die elke aanroeper moet
   onthouden is een poort die er ooit een keer niet staat. Wat hier staat is de
   BEDIENING ervan -- indienen, aftekenen, de stand opvragen. */
'use strict';

module.exports = ({ A, bedrijfMod }) => {

  const vind = (id) => A().find(x => x.id === id) || null;

  /* De boardroom-knop: een geaccepteerde aanmelding meteen provisioneren.
     MUTEERT de aanmelding (a.gezaakt) en is idempotent -- een tweede aanroep
     levert 409 en geen tweede zaak. */
  function provisioneerId(id) {
    const a = vind(id);
    if (!a) return { status: 404, error: 'Deze aanmelding bestaat niet.' };
    if (!a.bedrijf) return { status: 409, error: 'Deze aanmelding draagt geen bedrijfsgegevens.' };
    const r = bedrijfMod.provisioneer(a);
    if (r) return r;
    /* NULL BETEKENT TWEE DINGEN, EN DIE MOETEN UIT ELKAAR. Ofwel de zaak stond
       er al, ofwel de bewijspoort houdt hem tegen -- en dat tweede is geen fout
       maar een wachtstand met een handeling eraan. Ze allebei "de zaak stond al
       klaar" noemen zou een medewerker laten zoeken naar een zaak die met opzet
       niet bestaat. */
    const stand = bedrijfMod.bewijsStand(a);
    if (stand.nodig && stand.stand !== 'gezien') {
      return { status: 409, error: 'Deze zaak wacht op het bewijsstuk.',
        uitleg: stand.uitleg, bewijs: stand };
    }
    return { status: 409, error: 'De zaak stond al klaar.' };
  }

  /* ---- de bediening van de bewijsstap ---- */
  function bewijsIndienId(id, data) {
    const a = vind(id);
    if (!a) return { status: 404, error: 'Deze aanmelding bestaat niet.' };
    return bedrijfMod.bewijsIndien(a, data);
  }
  function bewijsTekenId(id, door) {
    const a = vind(id);
    if (!a) return { status: 404, error: 'Deze aanmelding bestaat niet.' };
    return bedrijfMod.bewijsTeken(a, door);
  }
  function bewijsStandId(id) {
    const a = vind(id);
    if (!a) return { status: 404, error: 'Deze aanmelding bestaat niet.' };
    return Object.assign({ ok: true }, bedrijfMod.bewijsStand(a));
  }

  /* De herkeuringslijst: welke afgetekende stukken zijn verlopen of lopen bijna
     af. Hij hoort hier bij de andere bewijs-ingangen, en niet in ./bewijs.js:
     die module redeneert PER aanmelding en dit is de vraag over de hele stapel. */
  function bewijsHerkeuring(dagen) { return bedrijfMod.bewijsHerkeuring(A(), dagen); }

  return { provisioneerId, bewijsIndienId, bewijsTekenId, bewijsStandId, bewijsHerkeuring };
};
