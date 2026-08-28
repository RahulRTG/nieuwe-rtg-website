/* De AI-boekhouder van de zaak: kent het land, de regels en de eigen cijfers.

   Uit ./index.js geknipt op de 10 kB-grens, en op een echte naad: index.js
   REKENT de maand uit (financeVoor), dit bestand LEGT UIT. Er is geen gedeelde
   staat: alles komt uit de drie argumenten, dus dit is een verhuizing.

   De antwoorden zijn met opzet vast en niet van een model: het gaat over de
   eigen cijfers van een zaak, en die horen niet door een taalmodel te worden
   geschat. Wat hier staat komt uit fin, en fin komt uit de boekhouding.

   EEN FABRIEK EN GEEN LOSSE FUNCTIE, want hij rekent met centen() -- de
   afronding van dit huis. Die hoort meegegeven te worden en niet nagemaakt;
   zelfde vorm als ./rapporten.js hiernaast. */
'use strict';

const { zin } = require('./zekerheid');

module.exports = ({ centen }) => {

function cannedBoekhouder(vraag, fin, L) {
  const v = vraag.toLowerCase();
  if (/btw|vat|tarief|belasting|afdra/.test(v))
    return 'In ' + L.naam + ' gelden voor u deze tarieven: ' + fin.btw.map(r => r.label + ' ' + r.tarief + '%').join(', ') + '. Deze maand is de af te dragen btw € ' + fin.btwTotaal + ' over € ' + centen(fin.btw.reduce((x, r) => x + r.grondslag, 0)) + ' grondslag. ' + L.aangifte;
  if (/personeel|loon|salaris|lasten|vakantiegeld|kost/.test(v))
    return 'Deze maand: ' + fin.personeel.uren + ' geklokte uren tegen € ' + fin.personeel.uurloon + ' = € ' + fin.personeel.bruto + ' bruto. Daar komt ~' + fin.personeel.lastenPct + '% werkgeverslasten (€ ' + fin.personeel.lasten + ')' + (fin.personeel.vakantiegeld ? ' en ' + fin.personeel.vakantiegeldPct + '% vakantiegeldreserve (€ ' + fin.personeel.vakantiegeld + ')' : '') + ' bij: totaal € ' + fin.personeel.totaal + '. Indicatie minimumuurloon in ' + L.naam + ': € ' + fin.personeel.uurloonMin + '.';
  if (/cadeau|bon|kaart|voucher|gift/.test(v))
    return 'Uw cadeaukaarten zijn meervoudig inwisselbaar: de verkoop (deze maand € ' + fin.giftcards.verkocht + ') is nog geen omzet en kent geen btw. Bij betaling met een kaart draagt de kassabon omzet, btw en factuur.' + (fin.giftcards.handmatig > 0 ? ' Let op: € ' + fin.giftcards.handmatig + ' is met de hand afgeboekt zonder kassabon en staat dus NIET in uw omzet of aangifte.' : '') + ' Het openstaande saldo van € ' + fin.giftcards.open + ' staat als verplichting op de balans.';
  if (/aangifte|deadline|wanneer|termijn/.test(v))
    return L.aangifte + ' ' + L.extra;
  return 'Uw maand in ' + L.naam + ': af te dragen btw € ' + fin.btwTotaal + ', personeelskosten € ' + fin.personeel.totaal + ' (' + fin.personeel.uren + ' uur), cadeaukaarten € ' + fin.giftcards.open + ' open. Vraag me naar btw, personeelskosten, cadeaukaarten of aangiftetermijnen. ' + zin('boekhouding.advies');
}

return { cannedBoekhouder };
};
