/* Dezelfde reisAanvragen-collectie, dezelfde transactionele opslagpoort.
   De ketenenvelop voorkomt dat oude, globale RTG-lezers partnerreizen lezen.
   Elk antwoord is een projectie, nooit een verwijzing naar de opslagrij. */
'use strict';
const { fout, hash, IDEM, kopie } = require('./reisbureau-ketencontract');
module.exports = ({ bewerkCollectie, nu }) => {
  if (typeof bewerkCollectie !== 'function') throw new Error('Reisketen vereist transactionele collectieopslag.');
  const schrijf = werk => bewerkCollectie({ reisAanvragen: 'lijst' }, data => werk(data.reisAanvragen));
  const eigenaar = (a, actor) => a.keten.verkoper.org === actor.org &&
    (a.keten.verkoper.supplierCode || null) === (actor.supplierCode || null);
  function ketengebeurtenis(a, soort, actorRef) {
    a.keten.versie++;
    a.keten.gebeurtenissen.push({ volgnummer: a.keten.versie, soort, actorRef, at: nu() });
  }
  function mutatie(actor, b, soort, mag, werk, beeld) {
    if (!IDEM.test(b.idem || '') || !Number.isSafeInteger(b.versie))
      return Promise.resolve(fout(400, 'Een mutatie vraagt een idempotentiesleutel en exacte versie.'));
    return schrijf(lijst => {
      const a = lijst.find(x => x.keten && x.ref === b.ref && mag(x, actor));
      if (!a) return fout(404, 'Reis niet gevonden in deze werkruimte.');
      const sleutel = hash([actor.actorRef, actor.org || null, actor.supplierCode || null, soort, b.idem]);
      const afdruk = hash(b), vorig = a.keten.ontvangsten.find(x => x.sleutel === sleutel);
      if (vorig) return vorig.afdruk === afdruk ? { ok: true, herhaald: true, reis: beeld(a) }
        : fout(409, 'Deze idempotentiesleutel hoort bij andere gegevens.');
      if (a.keten.versie !== b.versie) return fout(409, 'De reis is gewijzigd. Lees de actuele versie en beoordeel opnieuw.');
      if (a.keten.ontvangsten.length >= 1000) return fout(409, 'Deze reis vraagt handmatige opvolging voordat meer wijzigingen mogelijk zijn.');
      if (a.keten.betaling && a.keten.betaling.status === 'bezig')
        return fout(409, 'De betaaluitkomst is nog niet bevestigd. Herstel eerst dezelfde betaling.');
      const r = werk(a);
      if (r && r.error) return r;
      ketengebeurtenis(a, soort, actor.actorRef);
      a.keten.ontvangsten.push({ sleutel, afdruk });
      return { ok: true, reis: beeld(a) };
    });
  }
  return { schrijf, eigenaar, gebeurtenis: ketengebeurtenis, mutatie,
    lees: async (mag, beeld) => schrijf(lijst => ({ ok: true, reizen: lijst.filter(a => a.keten && mag(a)).map(a => kopie(beeld(a))) })) };
};
