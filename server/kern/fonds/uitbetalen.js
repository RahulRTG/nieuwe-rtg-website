/* HOE HET GELD ER DAADWERKELIJK UIT GAAT -- de rails onder de RTF-afdracht.

   ../fonds.js beslist DAT er 30% afgaat en HOEVEEL. Dit bestand brengt dat
   bedrag naar buiten, en dat is een ander onderwerp: het kent geen percentage en
   geen btw-profiel, alleen twee rails en wat er gebeurt als ze het niet doen.

   TWEE RAILS, IN DEZE VOLGORDE. Staat de boardroom-knop op "eigen", dan gaat de
   afdracht als boeking door het eigen grootboek. Anders, met een bekend IBAN, de
   opdrachtenrij in -- dezelfde als de bank-SEPA en de partneruitbetaling.

   DE TERUGGANG IS HIER MET OPZET ANDERS dan die van de bank en van Pay: er is
   GEEN dubbele boeking om terug te draaien. De afdracht IS de administratie en
   het geld stond nog bij RTG. "Terug" betekent hier dus: zet hem op te_storten,
   met de reden erbij, zodat hij opnieuw kan worden ingepland zodra de rail het
   weer doet.

   TWEE FOUTEN DIE HIER ZIJN GEMAAKT en die er zo weer in sluipen:

   1. EEN RECHTSTREEKSE AANROEP MET EEN CATCH die de afdracht op 'te_storten'
      zette en logde. Niet stil, maar er kwam nooit iemand op terug: 'te_storten'
      wachtte op een mens die het opmerkte, en het foundation-deel bleef liggen.
      Nu wordt hij herhaald en telt hij mee in hetzelfde reconciliatiegetal als
      de andere twee rails.
   2. "AFGEWIKKELD OF ANDERS INGEPLAND" als binaire regel. Geeft de rij het al
      bij de eerste poging op, dan heeft de teruggang de afdracht al op
      te_storten gezet -- en die binaire regel schreef daar 'ingepland' overheen
      en maakte van een mislukking weer een belofte. Alle standen staan nu
      uitgeschreven. */
'use strict';

/* `bankGeef` is een functie en geen waarde: de RTG Bank ontstaat pas NA het
   fonds, dus een vaste verwijzing zou hier voor altijd null zijn. Dezelfde late
   binding als koppelBank in ../fonds.js. */
function maakUitbetaling({ opdrachten, save, log, lijst, bankGeef }) {

  /* De teruggang van een afdracht, en die is met opzet anders dan die van de
     bank en van Pay: hier is GEEN dubbele boeking om terug te draaien. De
     afdracht is zelf de administratie, en het geld stond nog bij RTG. "Terug"
     betekent hier dus: zet hem op te_storten, met de reden erbij, zodat hij
     opnieuw kan worden ingepland zodra de rail het weer doet. Dat blijft
     zichtbaar in het fondsoverzicht in plaats van weg te vallen. */
  if (opdrachten) opdrachten.registreerTeruggang('rtf-afdracht', async (o) => {
    const a = lijst().find(x => x.id === o.ledgerRef);
    if (!a) return { error: 'De afdracht bij deze opdracht bestaat niet meer.' };
    a.status = 'te_storten';
    a.fout = o.laatsteFout || 'de uitbetaling is niet gelukt';
    save();
    if (log && log.warn) log.warn('rtf-afdracht terug op te_storten na een mislukte rail', { id: a.id, fout: a.fout });
    return { ok: true };
  });

  /* Een afdracht naar buiten brengen. Past de status van `afdracht` aan en
     geeft hem terug; opslaan doet de aanroeper, die de rij ook bijhoudt. */
  async function verstuur(afdracht, { centen, invoiceId, wie, best }) {
    const bankAfdracht = bankGeef();
    // In de eigen-stand loopt de afdracht over de eigen rails: een boeking van
    // de reserve naar de foundation-tegenrekening, per direct afgewikkeld.
    if (bankAfdracht) {
      try {
        const eigen = bankAfdracht({ centen, referentie: afdracht.id, oms: 'RTFoundation-afdracht ' + (invoiceId || '') });
        if (eigen && eigen.ok) {
          afdracht.status = 'gestort';
          afdracht.via = 'eigen-bank';
          afdracht.boekingId = eigen.boeking ? eigen.boeking.id : null;
          save();
          return afdracht;
        }
      } catch (e) {
        if (log && log.warn) log.warn('rtf-afdracht: eigen-bank-boeking mislukt', { invoiceId, fout: e.message });
      }
    }

    /* Met een bekend IBAN gaat de afdracht de opdrachtenrij in, dezelfde als de
       bank-SEPA en de partneruitbetaling van Pay (kern/betaalopdracht/).

       Hier stond een rechtstreekse aanroep met een catch die de afdracht op
       'te_storten' zette en logde. Dat was niet stil, maar er kwam ook nooit
       iemand op terug: 'te_storten' wachtte op een mens die het opmerkte, en het
       foundation-deel bleef zolang liggen. Nu wordt hij herhaald, telt hij mee in
       hetzelfde reconciliatiegetal als de andere twee rails, en is 'te_storten'
       weer wat het hoort te zijn -- geen bestemming bekend -- in plaats van een
       verzamelbak voor mislukte inzendingen. */
    if (best.iban && opdrachten) {
      const op = opdrachten.maak({
        soort: 'rtf-afdracht', rail: 'betaalnaad', centen, bestemming: best.iban,
        begunstigde: best.begunstigde, oms: 'RTFoundation-afdracht ' + (invoiceId || ''),
        ledgerRef: afdracht.id,
        idemSleutel: 'rtf:' + (wie || '') + ':' + invoiceId
      });
      afdracht.opdrachtId = op.id;
      const na = await opdrachten.dienIn(op);
      afdracht.uitbetaalId = na.settlementRef || null;
      /* Alle vijf de standen uitschrijven en niet "afgewikkeld of anders
         ingepland". Geeft de rij het al bij deze eerste poging op, dan heeft de
         teruggang hierboven de afdracht al op te_storten gezet -- een binaire
         regel schreef daar 'ingepland' overheen en maakte van een mislukking
         weer een belofte. */
      if (na.status === 'AFGEWIKKELD') afdracht.status = 'gestort';
      else if (na.status === 'MISLUKT' || na.status === 'TERUGGEBOEKT') afdracht.status = 'te_storten';
      else afdracht.status = 'ingepland';
      if (na.laatsteFout) afdracht.fout = na.laatsteFout;
    }
    return afdracht;
  }

  return { verstuur };
}

module.exports = { maakUitbetaling };
