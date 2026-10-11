/* WIE STAAT ER INDIVIDUEEL ACHTER EEN KANTOORSESSIE, EN HOE HARD -- besluit 3a
   van de eigenaar (11 oktober 2026). Afgesplitst van ./productiedeur.js, die
   de VORM van een geldig passkeybewijs bezit (bewijsGeldig): er is een
   definitie van "bewezen" en die wordt hier geleend, niet nagebouwd.

   Vier antwoorden, en ze worden nooit samengevoegd:
     passkey        kantoorsessie op naam MET een passkeyceremonie aan de deur
                    -- een bewezen individu (methode cryptografisch, graad
                    bewezen; kern/identiteit/sessievelden.js METHODEN).
     opNaam         kantoorsessie op een eigen account, zonder passkey aan de
                    deur: er hangt een individu aan, maar de deur heeft hem
                    niet met een sleutel gezien (graad gemeten: een inlog die
                    wij waarnamen, niet een handtekening die wij controleerden).
     eigenaarToken  het kale lid-token van de eigenaar (buiten productie; in
                    productie weigert eigenaarDirect() hem). Een individu, maar
                    de deur weet niet waarmee dat token ontstond.
     gedeeld        de gedeelde kantoorcode: GEEN individu. Een gedeelde code
                    geldt nooit als bewijs van een individuele uitvoerder.
   `bewezen` is alleen waar voor `passkey`, en dat is de eis van ENFORCE_EXECUTE.
   Er gaat geen naam en geen sleutel uit deze functie: alleen de soort. */
'use strict';

/* bewijsGeldig wordt pas bij het aanroepen opgehaald: ./productiedeur.js laadt
   dit bestand zelf, en een kringverwijzing levert anders een half object. */
const bewijsGeldig = (b) => require('./productiedeur').bewijsGeldig(b);

const IDENTITEIT = Object.freeze({
  passkey: { individueel: true, bewezen: true, graad: 'bewezen',
    uitleg: 'Op naam, en aan de deur met een passkey bewezen.' },
  opNaam: { individueel: true, bewezen: false, graad: 'gemeten',
    uitleg: 'Op naam (eigen RTG-account), maar zonder passkey aan de deur.' },
  eigenaarToken: { individueel: true, bewezen: false, graad: 'gemeten',
    uitleg: 'Het eigen lid-token van de eigenaar; de deur zag geen passkey.' },
  gedeeld: { individueel: false, bewezen: false, graad: 'onbekend',
    uitleg: 'De gedeelde kantoorcode: geen individu, en dus nooit een individuele uitvoerder.' }
});
function identiteitVan(sess, { eigenaarToken } = {}) {
  let via;
  if (sess && sess.role === 'office') via = !sess.lidKey ? 'gedeeld' : (bewijsGeldig(sess.kantoorBewijs) ? 'passkey' : 'opNaam');
  else if (eigenaarToken) via = 'eigenaarToken';
  else return null;
  return Object.assign({ via }, IDENTITEIT[via]);
}

module.exports = { IDENTITEIT, identiteitVan };
