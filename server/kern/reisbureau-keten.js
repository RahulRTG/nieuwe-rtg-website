/* Federatieve uitvoering BINNEN het bestaande reisbureau. Geen tweede app,
   catalogus of autorisatiemotor. De route levert een opnieuw geverifieerde
   actor; iedere opslagbewerking begrenst de zaak opnieuw op die actor. */
'use strict';
const { randomUUID } = require('node:crypto');
const C = require('./reisbureau-ketencontract');
const huisklok = require('../lib/klok');
function maakReisketen({ bewerkCollectie, toegang, payVan, nu = () => huisklok.datum().toISOString() }) {
  const O = require('./reisbureau-ketenopslag')({ bewerkCollectie, nu });
  const lidMag = (a, actor) => a.customerKey === actor.actorRef;
  const aanbiederMag = (a, actor) => a.keten.leveringen.some(p => p.org === actor.org && p.supplierCode === actor.supplierCode);
  function opdrachtenbeeld(a, actor) {
    return { ref: a.ref, versie: a.keten.versie, status: a.status,
      verkoper: { naam: a.keten.verkoper.naam },
      opdrachten: a.keten.leveringen.filter(p => p.org === actor.org && p.supplierCode === actor.supplierCode)
        .map(p => ({ id: p.id, wat: p.wat, productRef: p.productRef, status: p.status,
          verschuldigdCenten: p.verschuldigdCenten, valuta: 'EUR', bewijsRef: p.bewijsRef || null })) };
  }
  async function start(actor, codenaam, b) {
    const titel = C.tekst(b.titel, 160), bestemming = C.tekst(b.bestemming, 160);
    if (!titel || !bestemming || !C.IDEM.test(b.idem || '')) return C.fout(400, 'Vul reiswens, bestemming en een idempotentiesleutel in.');
    const verkoper = toegang.ontvanger(b.supplierCode);
    if (verkoper.error) return verkoper;
    const sleutel = C.hash([actor.actorRef, 'start', b.idem]);
    const afdruk = C.hash({ titel, bestemming, verkoper });
    return O.schrijf(lijst => {
      const vorig = lijst.find(a => a.keten && a.keten.startsleutel === sleutel);
      if (vorig) return vorig.keten.startafdruk === afdruk ? { ok: true, herhaald: true, reis: C.lidbeeld(vorig) }
        : C.fout(409, 'Deze aanvraagidentiteit hoort bij een andere reiswens.');
      if (lijst.filter(a => a.keten && a.customerKey === actor.actorRef).length >= 200)
        return C.fout(409, 'Uw reisadviseur helpt u met een volgende aanvraag.');
      const a = { ref: 'RTG-R-' + randomUUID(), titel, bestemming,
        customerKey: actor.actorRef, codename: codenaam, status: 'aangevraagd', at: nu(),
        keten: { schemaVersion: 1, versie: 0, verkoper: { ...verkoper }, startsleutel: sleutel,
          startafdruk: afdruk, offerte: null, akkoord: null, leveringen: [], betaling: null,
          ontvangsten: [], gebeurtenissen: [] } };
      O.gebeurtenis(a, 'aangevraagd', actor.actorRef);
      lijst.unshift(a);
      return { ok: true, reis: C.lidbeeld(a) };
    });
  }
  function biedAan(actor, b) {
    return O.mutatie(actor, b, 'offerte', O.eigenaar, a => {
      if (!['aangevraagd', 'aangeboden'].includes(a.status)) return C.fout(409, 'Een geaccepteerde offerte kan niet worden overschreven.');
      if ((a.keten.offerteVersies || []).length >= 100) return C.fout(409, 'Deze reis vraagt menselijke beoordeling vóór een volgende offerteversie.');
      const r = C.offerte(b, a.keten.verkoper, a.keten.offerte ? a.keten.offerte.versie : 0, toegang.leverancier, nu());
      if (r.error) return r;
      if (!a.keten.offerteVersies) a.keten.offerteVersies = [];
      if (a.keten.offerte) a.keten.offerteVersies.push(C.kopie(a.keten.offerte));
      a.keten.offerte = r.offerte;
      a.status = 'aangeboden';
    }, C.verkoperbeeld);
  }
  function akkoord(actor, b) {
    return O.mutatie(actor, b, 'akkoord', lidMag, a => {
      const o = a.keten.offerte;
      if (a.status !== 'aangeboden' || !C.geldigeOfferte(o) || o.hash !== b.offerteHash || Date.parse(o.geldigTot) <= Date.parse(nu()))
        return C.fout(409, 'Deze offerte is gewijzigd, verlopen of al behandeld. Vraag de actuele offerte.');
      const verkoper = toegang.ontvanger(a.keten.verkoper.supplierCode);
      if (verkoper.error || verkoper.org !== a.keten.verkoper.org)
        return C.fout(409, 'De verkoper is gewijzigd of gesloten. Aanvaarden vraagt eerst menselijke beoordeling.');
      /* De leverancierbinding wordt bij uitzetten opnieuw gecontroleerd. Een
         oude offerte mag geen opdrachten bij een intussen gesloten zaak maken. */
      for (const p of o.onderdelen) {
        const actueel = toegang.leverancier(p.supplierCode);
        if (actueel.error || actueel.org !== p.org) return C.fout(409, 'Een aanbieder is veranderd. Vraag een nieuwe offerte.');
      }
      a.keten.akkoord = { offerteHash: o.hash, at: nu(), actorRef: actor.actorRef };
      a.keten.leveringen = o.onderdelen.map(p => ({ id: p.id, wat: p.wat, productRef: p.productRef,
        org: p.org, supplierCode: p.supplierCode, verschuldigdCenten: p.verschuldigdCenten, status: 'aangevraagd' }));
      a.status = 'geaccepteerd';
    }, C.lidbeeld);
  }
  function opdracht(actor, b) {
    return O.mutatie(actor, b, 'opdracht-' + String(b.besluit), aanbiederMag, a => {
      const p = a.keten.leveringen.find(x => x.id === b.onderdeel && x.org === actor.org && x.supplierCode === actor.supplierCode);
      if (!p) return C.fout(404, 'Opdracht niet gevonden.');
      if (a.status === 'herstel-vereist') return C.fout(409, 'De keten vraagt eerst menselijke herstelcoördinatie.');
      if (!['accepteer', 'weiger', 'lever'].includes(b.besluit) || !C.tekst(b.bewijsRef, 160))
        return C.fout(400, 'Kies accepteren, weigeren of leveren met een bronreferentie.');
      if (b.besluit === 'lever') {
        if (p.status !== 'bevestigd' || !a.keten.betaling || a.keten.betaling.status !== 'betaald')
          return C.fout(409, 'Leveringsbewijs vraagt een geaccepteerde opdracht en bevestigde betaling.');
        p.status = 'geleverd';
      } else {
        if (p.status !== 'aangevraagd') return C.fout(409, 'Deze opdracht is al behandeld.');
        p.status = b.besluit === 'accepteer' ? 'bevestigd' : 'geweigerd';
      }
      p.bewijsRef = C.tekst(b.bewijsRef, 160); p.actorRef = actor.actorRef; p.at = nu();
      p.bewijsSoort = 'verklaring-bevoegde-aanbieder';
      if (!p.bewijzen) p.bewijzen = [];
      p.bewijzen.push({ besluit: b.besluit, status: p.status, bewijsRef: p.bewijsRef,
        actorRef: p.actorRef, at: p.at, bewijsSoort: p.bewijsSoort });
      const staten = a.keten.leveringen.map(x => x.status);
      a.status = staten.includes('geweigerd') ? 'herstel-vereist' : staten.every(x => x === 'geleverd') ? 'geleverd'
        : staten.every(x => ['bevestigd', 'geleverd'].includes(x)) ? 'bevestigd' : 'gedeeltelijk-bevestigd';
    }, a => opdrachtenbeeld(a, actor));
  }
  function afronden(actor, b) {
    return O.mutatie(actor, b, 'afronden', O.eigenaar, a => {
      if (a.status !== 'geleverd') return C.fout(409, 'Niet alle onderdelen zijn aantoonbaar geleverd.');
      /* Geen nep-afsluiting: bestaande settlement/teruggavepoorten zijn nog
         niet gekwalificeerd voor deze contractvorm. Een leveringsverklaring
         is geen bankbewijs en heft een schuld niet op. */
      return C.fout(409, 'Economische afsluiting is geblokkeerd tot settlement, eventuele teruggaven en financiële aansluiting via de bestaande geldketen zijn bewezen.');
    }, C.verkoperbeeld);
  }
  const betaling = require('./reisbureau-ketenbetaling')({ O, payVan, toegang, nu });
  const nazorg = require('./reisbureau-ketennazorg')({ O, nu });
  return { start, biedAan, akkoord, opdracht, afronden, betaal: betaling.betaal, ...nazorg,
    mijn: (actor, ref) => O.lees(a => lidMag(a, actor) && (!ref || a.ref === ref), C.lidbeeld),
    zaken: (actor, ref) => O.lees(a => O.eigenaar(a, actor) && (!ref || a.ref === ref), C.verkoperbeeld),
    opdrachten: actor => O.lees(a => aanbiederMag(a, actor), a => opdrachtenbeeld(a, actor)) };
}
module.exports = { maakReisketen };
