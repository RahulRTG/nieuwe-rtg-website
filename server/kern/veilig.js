/* De 9+-poort: een gedeelde inhoudskeuring die alle sociale lagen (Pulse, De
   Salon, de vriendenchat) geschikt houdt voor iedereen vanaf 9 jaar -- de
   App Store-leeftijdsgrens waar het hele sociale deel op mikt. Grof taalgebruik,
   expliciete termen en het delen van telefoonnummers worden geweigerd met een
   vriendelijke uitleg (niet stiekem gemaskeerd: de schrijver ziet wat er niet
   mag en waarom). Bewust een korte, onderhoudbare lijst met woordgrenzen, geen
   zwarte doos. Pure functies, geen state. */
const GROF = [
  // NL grof/expliciet (woordstammen, klein gehouden en duidelijk)
  'kanker', 'tering', 'tyfus', 'kut', 'lul', 'hoer', 'slet', 'neuk', 'pik',
  'godver', 'gvd', 'klootzak', 'eikel', 'mongool', 'debiel', 'flikker', 'homo',
  // EN grof/expliciet
  'fuck', 'shit', 'bitch', 'cunt', 'dick', 'whore', 'slut', 'porn', 'nigger', 'faggot',
  // geweld/onveilig richting kinderen
  'zelfmoord', 'suicide', 'kys'
];
const GRENS = new RegExp('(?:^|[^a-z])(' + GROF.join('|') + ')', 'i');
// 06-nummers en internationale nummers horen niet in een 9+-feed (privacy van
// kinderen); een gewoon getal ("30 graden") blijft gewoon toegestaan.
const TELEFOON = /(?:\+31|0031|06)[\s-]?\d{8}|\+\d{10,}/;

function keur(tekst) {
  const t = String(tekst == null ? '' : tekst);
  const m = t.match(GRENS);
  if (m) return { ok: false, reden: 'Dit woord ("' + m[1] + '") past niet in een 9+-omgeving. Zeg het anders, dan mag het gewoon.' };
  if (TELEFOON.test(t)) return { ok: false, reden: 'Deel geen telefoonnummers in het openbaar; stuur ze via een priveband of helemaal niet.' };
  return { ok: true };
}

module.exports = { keur, LEEFTIJD: '9+' };
