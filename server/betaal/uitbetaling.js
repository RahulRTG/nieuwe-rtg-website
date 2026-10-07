'use strict';

const nietVerstuurd = error => { error.nietVerstuurd = true; return error; };

module.exports = function maakUitbetaalrail(deps) {
  const { betalenUit, haalOp, bewaar, regie, sandbox, stripe, demoBetalen,
    aanbieder, eisBetaalrail, crypto, uitgaandBewustDicht, vrijgave } = deps;
  const poort = () => vrijgave || require('../kern/vrijgave').standaard();
  return async function startUitbetaling(opdracht) {
    if (betalenUit)
      throw nietVerstuurd(new Error('Betalen staat bewust uitgeschakeld. Er is niets uitbetaald.'));
    const { bedrag, valuta = 'eur', iban, begunstigde, referentie,
      idempotentieSleutel, omschrijving } = opdracht || {};
    if (!Number.isFinite(bedrag) || bedrag <= 0)
      throw nietVerstuurd(new Error('Bedrag moet een positief bedrag in centen zijn.'));
    const sleutel = 'uit:' + (idempotentieSleutel || referentie || crypto.randomUUID());
    const bestaand = haalOp(sleutel);
    if (bestaand) return Object.assign({}, bestaand, { herhaald: true });

    let resultaat;
    if (!iban) {
      resultaat = { id: 'wacht_' + crypto.randomBytes(6).toString('hex'), status: 'te_storten',
        aanbieder: aanbieder(), bedrag: Math.round(bedrag), valuta, referentie, iban: '' };
    } else if (regie.sepaGeconfigureerd && !regie.sepaAan) {
      const error = new Error('SEPA-sandbox is door de Integratiekamer uitgezet.');
      error.code = 'SEPA_SANDBOX_UIT';
      throw nietVerstuurd(error);
    } else if (regie.sepaAan) {
      try { resultaat = sandbox.sepa({ bedrag, valuta, referentie, iban, begunstigde, omschrijving }); }
      catch (error) { throw nietVerstuurd(error); }
    } else if (stripe) {
      /* De vrijgavepoort eerst, op de capability die de AANROEPER noemt
         (`opdracht.vrijgave`: een uitbetaling naar een lid, een partner of de
         RTFoundation zijn financieel drie verschillende handelingen). Noemt hij
         er geen, dan is het antwoord dicht -- een uitbetaling waarvan niemand
         zegt wat ze is, hoort niet naar buiten te gaan. Daarna de grendel als
         bewijsas. En ook als beide open staan blijft deze tak dicht: een IBAN in
         Stripe-metadata is geen betaalbestemming (hieronder). */
      try {
        poort().eis(String((opdracht && opdracht.vrijgave) || 'geld.uitbetaling_zonder_capability'),
          { actor: { soort: 'systeem' }, provider: 'stripe', rail: 'stripe' });
      } catch (e) { throw nietVerstuurd(e); }
      require('./uitbetaalgrendel').eisOpen('uitbetaling');
      const uitleg = uitgaandBewustDicht ? ' De installatie staat bewust in deze gesloten stand.' : '';
      const error = new Error('Uitbetaling veilig geblokkeerd: een IBAN in Stripe-metadata is geen echte betaalbestemming. Koppel eerst een gecontroleerde uitbetaalrail.' + uitleg);
      error.code = 'UITBETAALRAIL_NIET_ACTIEF';
      throw nietVerstuurd(error);
    } else if (demoBetalen) {
      resultaat = { id: 'magnaat_uit_' + crypto.randomBytes(8).toString('hex'), status: 'ingepland',
        aanbieder: 'magnaat-test', bedrag: Math.round(bedrag), valuta, referentie, iban };
    } else {
      try { eisBetaalrail(); } catch (error) { throw nietVerstuurd(error); }
    }
    bewaar(sleutel, resultaat);
    return resultaat;
  };
};
