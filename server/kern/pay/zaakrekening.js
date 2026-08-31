/* DE BANKREKENING WAAR HET SALDO VAN EEN ZAAK HEEN GAAT.

   DIT BESTOND NIET, EN DAT WAS NIET TE ZIEN. ./partner.js maakte de
   betaalopdracht zonder `bestemming`, en dat is precies het veld dat naar de
   rail gaat (server.js: `iban: o.bestemming`). Bij een lege iban RESERVEERT
   server/betaal.js en verstuurt hij niet -- maar het saldo was toen al van de
   wallet af. Wallet leeg, opdracht op INGEDIEND, geen IBAN ooit genoemd. Het
   geld was niet zoek (er is een boeking en een opdracht), maar niemand kon
   zeggen waar het heen moest. Twee toetsen in dit huis noemden dat "uitbetalen
   leegt de partnerpot" en stonden al die tijd op groen.

   WAAROM DIT IN db.data STAAT EN HET IBAN VAN EEN LID IN DE KLUIS. Die vraag
   hoort gesteld, want ./uitbetaalrekening.js zegt met zoveel woorden: een IBAN
   naast een codenaam voert die codenaam terug naar een echte naam. Dat argument
   geldt hier NIET, en wel hierom: een leverancier is in dit huis niet
   pseudoniem. Het record draagt al `name`, `city` en de contactgegevens van de
   zaak -- er is geen codenaam om te beschermen. Een zakelijk IBAN staat
   bovendien op elke factuur die de zaak zelf verstuurt.

   Waar het wel schuurt: bij een eenmanszaak is het zakelijke IBAN in de praktijk
   dat van een mens. Daarom staat het hier ook NIET open voor iedere medewerker
   -- de route eist de manager -- en daarom staat de wachttijd hieronder.

   DRIE GRENDELS:

   1. DE MOD-97-TOETS, uit ../../iban.js. Niet nagetikt: een formaatcontrole
      alleen laat 'NL91ABNA0417164301' door, en dat IBAN bestaat niet.

   2. DE WACHTTIJD STAAT OP HET WIJZIGEN EN NIET OP HET INSTELLEN. Zelfde
      redenering als bij het lid, en om dezelfde reden overgenomen in plaats van
      opnieuw bedacht: de aanval is het VERANDEREN van de bestemming op een
      zaak die al saldo heeft. Wie de manager-inlog kaapt, zet zijn eigen
      rekening erin en trekt de pot leeg; zijn hele plan hangt op snelheid. Een
      eerste registratie is die aanval niet, en iedereen een dag laten wachten
      hindert alleen de eerlijke zaken. Het getal komt uit ./uitbetaalrekening.js
      zodat er niet twee wachttijden ontstaan die uiteenlopen.

   3. WIE NOG NIET MAG, KRIJGT EEN REDEN EN GEEN LEEG ANTWOORD. `zaakRekening()`
      geeft altijd iets terug: of een iban, of waarom er geen is. ./partner.js
      zet die reden in zijn weigering, zodat op het scherm staat wat eraan
      scheelt in plaats van "er ging iets mis". */
'use strict';

const iban = require('../../iban');
const { WACHT_UUR } = require('./uitbetaalrekening');

module.exports = (ctx) => {
  const { db, save, schoon, nu } = ctx;

  const zaakVan = code => (db.data.suppliers || []).find(s => s && s.code === String(code || '')) || null;

  /* Wat ./partner.js vraagt vlak voordat hij geld aanraakt. */
  function zaakRekening(code) {
    const s = zaakVan(code);
    if (!s) return { iban: null, reden: 'zaak-onbekend' };
    const u = s.uitbetaal;
    if (!u || !u.iban) return { iban: null, reden: 'geen-rekening' };
    const klaar = Number(u.bruikbaarVanaf) || 0;
    if (klaar > Date.now()) {
      return { iban: null, reden: 'nog-in-wachttijd', bruikbaarVanaf: klaar };
    }
    return { iban: u.iban, naam: u.naam || s.name || '', sinds: u.sinds || null };
  }

  /* Zetten. De route eist de manager; dit deel gaat over de rekening zelf. */
  function zaakRekeningZet(code, b) {
    b = b || {};
    const s = zaakVan(code);
    if (!s) return { status: 404, error: 'Deze zaak bestaat niet.' };
    const nieuw = iban.normaliseer(b.iban);
    if (!iban.geldig(nieuw)) {
      return { status: 400, error: 'Dat is geen geldig IBAN. Controleer het nummer; de controlecijfers erin kloppen niet.' };
    }
    const naam = schoon(b.naam, 100) || s.name || '';
    if (!naam) return { status: 400, error: 'Op welke naam staat de rekening?' };
    const oud = s.uitbetaal || null;
    const wijziging = !!(oud && oud.iban && oud.iban !== nieuw);
    s.uitbetaal = { iban: nieuw, naam, sinds: nu ? nu() : new Date().toISOString(),
      bruikbaarVanaf: wijziging ? Date.now() + WACHT_UUR * 3600000 : Date.now(),
      vorige: wijziging ? oud.iban : (oud && oud.vorige) || null };
    save();
    return { ok: true, rekening: { iban: nieuw, naam, bruikbaarVanaf: s.uitbetaal.bruikbaarVanaf },
      melding: wijziging
        ? 'De rekening is gewijzigd. Uitbetalen kan na ' + WACHT_UUR + ' uur; die wachttijd is er om te voorkomen dat iemand die de inlog van de zaak overneemt het saldo naar zijn eigen rekening stuurt.'
        : 'De rekening staat ingesteld. Uitbetalen kan meteen.' };
  }

  return { zaakRekening, zaakRekeningZet };
};
