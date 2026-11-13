/* Een wijziging of annulering VRAGEN is geen reis of geld veranderen.
   De huidige eigenaar antwoordt binnen dezelfde zaak. Het antwoord verleent
   geen refundrecht, provideracceptatie of nieuw financieel mandaat. */
'use strict';
const { randomUUID } = require('node:crypto');
const C = require('./reisbureau-ketencontract');
module.exports = ({ O, nu }) => {
  function vraag(actor, b) {
    return O.mutatie(actor, b, 'nazorg-vraag', (a, wie) => a.customerKey === wie.actorRef, a => {
      const k = a.keten, o = k.offerte;
      if (!k.akkoord || !C.geldigeOfferte(o) || k.akkoord.offerteHash !== o.hash || b.offerteHash !== o.hash)
        return C.fout(409, 'Nazorg vraagt de actuele, geaccepteerde offerte. Lees uw reis opnieuw.');
      const tekst = C.tekst(b.toelichting, 2000, true), ids = b.onderdelen;
      if (!['wijziging', 'annulering'].includes(b.soort) || tekst.length < 8 ||
          !Array.isArray(ids) || !ids.length || ids.length > 20 || new Set(ids).size !== ids.length ||
          ids.some(id => typeof id !== 'string' || !o.onderdelen.some(p => p.id === id)))
        return C.fout(400, 'Kies wijziging of annulering, bestaande onderdelen en een duidelijke toelichting.');
      const lijst = k.nazorg || [];
      if (lijst.length >= 50) return C.fout(409, 'Uw reisadviseur moet de bestaande nazorg eerst verder begeleiden.');
      if (lijst.some(v => v.status === 'aangevraagd' && v.onderdelen.some(id => ids.includes(id))))
        return C.fout(409, 'Voor dit onderdeel staat al een vraag open. Uw reisadviseur moet die eerst beantwoorden.');
      const v = { id: 'RN-' + randomUUID(), soort: b.soort, status: 'aangevraagd',
        offerteHash: o.hash, offerteVersie: o.versie, onderdelen: ids.slice(),
        toelichting: tekst, actorRef: actor.actorRef, at: nu(), antwoord: null,
        uitvoering: 'niet-uitgevoerd', financieleUitvoering: 'geblokkeerd' };
      k.nazorg = [...lijst, v];
    }, C.lidbeeld);
  }
  function antwoord(actor, b) {
    return O.mutatie(actor, b, 'nazorg-antwoord', O.eigenaar, a => {
      const v = (a.keten.nazorg || []).find(x => x.id === b.nazorgId);
      if (!v) return C.fout(404, 'Deze nazorgvraag hoort niet bij deze reis.');
      if (v.status !== 'aangevraagd') return C.fout(409, 'Dit antwoord is al vastgelegd. Overschrijven is niet toegestaan.');
      const tekst = C.tekst(b.toelichting, 2000, true), bronRef = C.tekst(b.bronRef, 160);
      if (tekst.length < 8 || !bronRef || !['voorstel', 'toelichting'].includes(b.soort))
        return C.fout(400, 'Geef een voorstel of toelichting met een controleerbare bronreferentie.');
      v.antwoord = { soort: b.soort, toelichting: tekst, bronRef, actorRef: actor.actorRef,
        at: nu(), bewijsSoort: 'verklaring-eigen-verkoper', juridischGoedgekeurd: false };
      v.status = 'beantwoord';
      // Het oorspronkelijke reiscontract, de opdracht en het geld blijven
      // exact staan. Een getypte bronref is geen geverifieerd contractbewijs.
    }, C.verkoperbeeld);
  }
  return { vraagNazorg: vraag, antwoordNazorg: antwoord };
};
