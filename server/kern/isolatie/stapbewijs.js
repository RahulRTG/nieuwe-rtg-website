/* HET BEWIJS ONDER EEN CEREMONIESTAP -- de enige plek die weet welke stap echt
   iets vraagt en hoe dat bewijs eruitziet.

   WAAROM DIT NIET IN ./ontsluiting.js STAAT. Die module mag niet zelf kunnen
   besluiten dat er is ingelogd; zou hij de webauthn-laag aanroepen, dan is de
   ceremonie een module die haar eigen bewijs levert. Deze module besluit dat
   ook niet -- hij VRAAGT het aan de webauthn-laag en geeft het antwoord door aan
   de route, en de route overhandigt het pas daarna aan `ontsluiting.stap()`.
   Drie schakels, en elke schakel kan maar een ding.

   WAT HIER GEREPAREERD IS. De stap `passkey` werd GENOTEERD en niet
   GECONTROLEERD: de routes gaven `bewijs` rechtstreeks uit het verzoekslijf door
   en dat werd opgeslagen als een string van maximaal 120 tekens. Een aanvaller
   met alleen een gestolen sessie tekende daarmee de zwaarste eis van de hele
   laag af met het woord "proef". De machinerie lag er al -- kern/webauthn-stapop.js
   bindt een assertie aan een account EN aan een doel -- alleen riep niemand hem
   aan.

   DE BINDING IS HET HELE PUNT. Zonder `doel` past een assertie die voor de ene
   handeling is afgegeven ook op de andere, en dan bewijst een vinger op een
   toestel alleen dat er ooit een vinger op een toestel lag. Het doel komt uit
   ./ceremonie-eisen.js (`doelVoor`) en draagt zowel het VERZOEK als de STAP:
   een ceremonie voor verzoek A werkt niet op verzoek B, en een ceremonie voor
   `passkey` niet op een toekomstige `apparaat`. */
'use strict';

const { STAPPEN, doelVoor } = require('./ceremonie-eisen');

module.exports = function maakStapbewijs({ stapOpOpties, stapOpMaak }) {

  function fout(status, tekst) { const e = new Error(tekst); e.status = status; throw e; }

  /* Vraagt deze stap ECHT bewijs? De vraag wordt hier niet beantwoord maar
     opgezocht: ./ceremonie-eisen.js draagt per stap `uitgevoerd`, en een tweede
     lijst hier zou binnen een jaar iets anders zeggen (LAT.md regel 4). */
  function vraagtBewijs(soort) {
    const s = STAPPEN[String(soort)];
    return !!(s && s.uitgevoerd && String(soort) === 'passkey');
  }

  /* De reden waarom een stap GEEN bewijs vraagt, letterlijk uit het register.
     Nooit een lege waarde: een aftekening zonder reden ziet er van buiten
     precies zo uit als een controle. */
  function waaromGeenBewijs(soort) {
    const s = STAPPEN[String(soort)] || {};
    if (s.nietUitgevoerd) return s.nietUitgevoerd;
    return 'deze stap wordt door de aanvrager zelf geleverd en niet met een sleutel bewezen';
  }

  /* DE CEREMONIE AANVRAGEN. De aanroeper heeft het verzoek al op eigendom
     gecontroleerd; deze module doet dat niet nog eens en kan dat ook niet -- hij
     kent de sessie niet. Wat hij wel doet is weigeren als de stap niet bij dit
     verzoek hoort: anders levert een geraden stapnaam een geldige ceremonie op
     met een doel dat nergens op slaat. */
  /* Hoort deze stap bij dit verzoek? De vraag staat apart omdat hij VOOR het
     crypto-werk moet komen, aan allebei de kanten. Zonder die volgorde levert
     een stap die de ceremonie helemaal niet vraagt een 401 op ("de bevestiging
     mislukte") in plaats van een 400 ("die stap vraagt deze ceremonie niet"), en
     dat is een onbegrijpelijk antwoord: er ging niets mis met een bevestiging,
     er was er geen nodig. */
  function hoortErbij(verzoek, s) {
    if (!verzoek || !Array.isArray(verzoek.vereisten) || !verzoek.vereisten.includes(s)) {
      fout(400, 'Deze ceremonie vraagt geen stap "' + s + '".');
    }
  }

  async function opties({ user, verzoek, soort, hostnaam }) {
    const s = String(soort || '');
    hoortErbij(verzoek, s);
    if (!vraagtBewijs(s)) fout(400, 'Voor de stap "' + s + '" is geen bevestiging nodig: ' + waaromGeenBewijs(s));
    if (!user) fout(403, 'Bevestigen met een passkey hoort bij een eigen RTG-account.');
    const r = await stapOpOpties(user, hostnaam, doelVoor(verzoek.id, s));
    /* "U heeft er nog geen" is geen gewone fout maar een toestand met een knop
       erachter; de aanroeper moet het verschil kunnen zien. Hij komt hier
       ongewijzigd doorheen. */
    return r;
  }

  /* HET BEWIJS CONTROLEREN. Geeft bij succes de tekst terug die in het spoor
     komt -- een verwijzing naar WELKE sleutel tekende, want met twee passkeys op
     een account is dat achteraf altijd de vraag. Faalt de controle, dan gooit
     hij: er is geen pad waarlangs een mislukte verificatie alsnog een aftekening
     oplevert. */
  async function controleer({ user, verzoek, soort, ceremonie, antwoord, origin, hostnaam }) {
    const s = String(soort || '');
    hoortErbij(verzoek, s);
    if (!user) fout(403, 'Bevestigen met een passkey hoort bij een eigen RTG-account.');
    const r = await stapOpMaak(user, ceremonie, antwoord, origin, hostnaam, doelVoor(verzoek.id, s));
    if (!r || r.status !== 200 || !r.ok) fout((r && r.status) || 401, (r && r.error) || 'De bevestiging mislukte.');
    return 'passkey ' + String(r.credentialId || 'onbekend').slice(0, 40);
  }

  return { vraagtBewijs, waaromGeenBewijs, opties, controleer };
};
