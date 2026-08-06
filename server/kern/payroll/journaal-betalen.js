/* Payroll OS: HET BETAALBESTAND -- hier gaat het geld het huis uit.

   Afgesplitst van ./journaal.js, dat over de 10 KB ging. De snede loopt langs
   een echte grens: daar wordt geboekt (administratie), hier wordt betaald.

   TWEE CONTROLES VOORDAT ER IETS WORDT BEWAARD, en dat "voordat" is het punt.
   Het totaal moet exact het nettoloon van de run zijn, EN het moet kloppen met
   het loonjournaal. De tweede stond in journaal.js als losse functie sluitAan()
   klaar en werd door niemand aangeroepen -- de controle uit de opzet
   ("betaalbestand wijkt af van de definitieve loonrun") bestond wel en liep
   niet. Een controle die je kunt overslaan is geen controle. Klopt er iets
   niet, dan wordt er NIETS opgeslagen: een bestand dat er eenmaal is, kan
   iemand inlezen bij de bank.

   ALLEEN UIT EEN DEFINITIEVE RUN. Dat lijkt vanzelfsprekend tot iemand "even"
   een proefbestand maakt.

   WAT HIER NIET GEBEURT: verzenden. Deze module maakt bestanden; het versturen
   naar de bank is een aparte handeling met zijn eigen goedkeuring. Een module
   die zowel opmaakt als verstuurt, is een module waar per ongeluk geld uit
   komt. */
'use strict';

const valuta = require('./valuta');

const IBAN_VORM = /^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/;

module.exports = ({ db, save, tijd, crypto, boeking, bestandenVan, tegenrekeningNetto }) => {

  /* ---------- het betaalbestand ---------- */
/* Een SEPA-overboeking per medewerker. Geen XML hier: dat is een vorm, en de
   vorm hoort bij de bankkoppeling. Wat hier gemaakt wordt is de INHOUD, met de
   controles die ertoe doen: de munt moet euro zijn, het totaal moet exact het
   uit te betalen nettoloon van de run zijn, en het geheel moet kloppen met het
   loonjournaal. Dat laatste is de controle die in de opzet stond
   ("betaalbestand wijkt af van de definitieve loonrun") en die tot nu toe in
   een losse functie zat die niemand aanriep. */
function betaalbestand(run, rekeningen) {
  if (!run) return { status: 404, error: 'Deze loonrun kennen we niet.' };
  if (run.stand !== 'definitief')
    return { status: 409, error: 'Een betaalbestand komt alleen uit een definitieve loonrun.' };

  /* SEPA IS EURO, EN DAT IS GEEN DETAIL. Dit bestand draagt IBANs en bedragen
     zonder muntaanduiding, want in SEPA is de munt de euro. Er yen in zetten
     levert geen foutmelding op bij de bank maar een BETALING: de getallen
     worden als euro's gelezen, en 300.000 yen wordt dan 300.000 euro.

     Daarom stopt het hier. Een betaalbestand voor een andere munt is een
     ander formaat (SWIFT, een lokale koppeling) en dat bouwen we als het er
     is -- niet door dit bestand te laten alsof het klopt. */
  const munt = ((run.stroken[0] || {}).strook || {}).valuta;
  if (munt && !valuta.isSepa(munt.code))
    return { status: 422, error: 'Deze loonrun staat in ' + munt.code +
      ' en een SEPA-betaalbestand kent alleen euro\'s. Er is nog geen betaalweg voor ' + munt.code +
      '; maak de betaling buiten RTG om en leg het bewijs vast.', valuta: munt.code };

  const posten = [];
  const zonderRekening = [];
  for (const s of run.stroken) {
    const iban = String((rekeningen || {})[s.staffId] || '').replace(/\s+/g, '').toUpperCase();
    if (!IBAN_VORM.test(iban)) { zonderRekening.push({ staffId: s.staffId, naam: s.naam }); continue; }
    if (s.strook.nettoCenten <= 0) continue; // niets te betalen (of een correctie die inhoudt)
    posten.push({ staffId: s.staffId, naam: s.naam, iban,
      centen: s.strook.nettoCenten,
      omschrijving: 'Salaris ' + run.periode + ' ' + run.zaak });
  }
  if (zonderRekening.length)
    return { status: 422, error: 'Van deze medewerkers ontbreekt een geldig rekeningnummer.', medewerkers: zonderRekening };

  const totaal = posten.reduce((s, p) => s + p.centen, 0);
  const verwacht = run.stroken.reduce((s, x) => s + Math.max(0, x.strook.nettoCenten), 0);
  if (totaal !== verwacht)
    return { status: 422, error: 'Het betaalbestand (' + totaal + ' cent) wijkt af van de loonrun (' + verwacht + ' cent).',
      totaal, verwacht };

  /* DE KRUISCONTROLE, VOORDAT ER IETS WORDT BEWAARD. Het loonjournaal en dit
     bestand komen uit dezelfde run en moeten elkaar niet tegenspreken. Doen ze
     dat wel, dan klopt de boekhouding niet met de bankafschriften en merkt
     niemand dat tot de accountant komt. Er wordt dan NIETS opgeslagen: een
     bestand dat er eenmaal is, kan iemand inlezen bij de bank.

     DE SOM IS NIET "GELIJK" MAAR DEZE, en dat verschil heeft me een toets
     gekost die terecht rood stond. Bij een CORRECTIERUN kan een nettobedrag
     NEGATIEF zijn: iemand heeft te veel gekregen en moet terugbetalen. Het
     journaal boekt die negatieve schuld gewoon mee; het betaalbestand slaat hem
     over, want je maakt geen min-bedrag over. Een controle op "gelijk" zou dus
     precies elke correctierun blokkeren waar iemand geld terug moet -- en dat
     is nu juist waar een correctierun voor is.

         journaal (netto schuld) = uitbetaald - terug te vorderen

     Klopt die identiteit, dan zeggen ze hetzelfde. */
  const b = boeking(run);
  if (b.error) return b;
  const nettoInBoeking = b.regels.filter(r => r.rekening === tegenrekeningNetto)
    .reduce((s, r) => s + r.creditCenten, 0);
  const terug = run.stroken.reduce((s, x) => s + Math.min(0, x.strook.nettoCenten), 0);
  if (nettoInBoeking !== totaal + terug)
    return { status: 422, error: 'Het loonjournaal (' + nettoInBoeking +
      ' cent netto) en dit betaalbestand (' + totaal + ' cent uit te betalen' +
      (terug ? ', ' + Math.abs(terug) + ' cent terug te vorderen' : '') +
      ') spreken elkaar tegen. Er is niets bewaard.',
      journaalCenten: nettoInBoeking, bestandCenten: totaal, terugCenten: terug };

  const best = { id: 'bet_' + crypto.randomBytes(4).toString('hex'), runId: run.id,
    periode: run.periode, zaak: run.zaak, posten, totaalCenten: totaal, aantal: posten.length,
    gemaaktOp: tijd(), verzonden: false,
    /* Wat er NIET wordt overgemaakt maar wel openstaat. Zonder dit veld
       verdwijnt een terugvordering uit beeld zodra het bestand er is: het
       bestand klopt, de boeking klopt, en niemand ziet meer dat er nog iets
       terug moet komen. */
    terugtevorderenCenten: terug ? Math.abs(terug) : 0,
    terugtevorderen: run.stroken.filter(x => x.strook.nettoCenten < 0)
      .map(x => ({ staffId: x.staffId, naam: x.naam, centen: Math.abs(x.strook.nettoCenten) })) };
  const rij = (db.data.payrollBetaalbestanden = db.data.payrollBetaalbestanden || []);
  rij.unshift(best);
  if (rij.length > 500) rij.length = 500;
  save();
  return { ok: true, bestand: best };
}

/* Boeken en betalen zijn twee uitgangen uit dezelfde run. Wat hier overblijft
   is het RAPPORT: boeking en bestand naast elkaar, voor wie beide wil zien.
   Het BEWAKEN gebeurt hierboven, in betaalbestand() zelf -- een controle die
   in een aparte functie zit die je moet willen aanroepen, is er geen. */
function sluitAan(run, rekeningen) {
  const b = boeking(run);
  if (b.error) return b;
  const bestaand = bestandenVan(run.id)[0];
  const bet = bestaand ? { ok: true, bestand: bestaand } : betaalbestand(run, rekeningen);
  if (bet.error) return bet;
  const nettoInBoeking = b.regels.filter(r => r.rekening === tegenrekeningNetto)
    .reduce((s, r) => s + r.creditCenten, 0);
  // dezelfde identiteit als hierboven: journaal = uitbetaald - terug te vorderen
  const terug = bet.bestand.terugtevorderenCenten || 0;
  return { ok: true, boeking: b, bestand: bet.bestand, nettoInBoeking, terugCenten: terug,
    sluitAan: nettoInBoeking === bet.bestand.totaalCenten - terug };
}

  return { betaalbestand, sluitAan, IBAN_VORM };
};
