/* Zelfexport binnen de bestaande persoonlijke zaakpoort. Org alleen is nooit
   voldoende: de leveranciercode begrenst óók binnen dezelfde tenant. Dit is
   een documentair archief, geen herstel van live reispaden of betaalopdrachten. */
'use strict';
const { datum } = require('../lib/klok');
const fout = (status, error) => ({ status, error });
const neem = (v, velden) => Object.fromEntries(velden.filter(k => v && v[k] != null).map(k => [k, v[k]]));
const kopie = v => JSON.parse(JSON.stringify(v));

function projecteer(a, actor, rol) {
  const k = a.keten, actoren = new Map();
  const persoon = ref => {
    if (!ref) return null;
    if (!actoren.has(ref)) actoren.set(ref, 'actor-' + (actoren.size + 1));
    return actoren.get(ref);
  };
  const bewijs = p => ({ ...neem(p, ['besluit', 'status', 'bewijsRef', 'at', 'bewijsSoort']), actor: persoon(p.actorRef) });
  const levering = p => ({ ...neem(p, ['id', 'wat', 'productRef', 'org', 'supplierCode', 'verschuldigdCenten', 'status']),
    valuta: 'EUR', ...bewijs(p), bewijzen: (p.bewijzen || []).map(bewijs) });
  if (rol === 'aanbieder') return {
    ref: a.ref, versie: k.versie, status: a.status, verkoper: { naam: k.verkoper.naam },
    opdrachten: k.leveringen.filter(p => p.org === actor.org && p.supplierCode === actor.supplierCode).map(levering)
  };
  const offerte = o => o ? { ...neem(o, ['schemaVersion', 'versie', 'hash', 'geldigTot', 'voorwaarden', 'valuta', 'totaalCenten']),
    verkoper: neem(o.verkoper, ['org', 'supplierCode']),
    rollen: neem(o.rollen, ['hoedanigheid', 'contractpartij', 'factureert', 'aansprakelijk']),
    onderdelen: (o.onderdelen || []).map(p => neem(p, ['id', 'wat', 'soort', 'productRef', 'supplierCode', 'org', 'naam', 'centen', 'verschuldigdCenten']))
  } : null;
  const nazorg = v => ({ ...neem(v, ['id', 'soort', 'status', 'offerteHash', 'offerteVersie', 'toelichting', 'at',
    'uitvoering', 'financieleUitvoering']), onderdelen: v.onderdelen.slice(), actor: persoon(v.actorRef),
    antwoord: v.antwoord ? { ...neem(v.antwoord, ['soort', 'toelichting', 'bronRef', 'at', 'bewijsSoort']),
      actor: persoon(v.antwoord.actorRef), juridischGoedgekeurd: false } : null });
  return { ...neem(a, ['ref', 'titel', 'bestemming', 'at', 'status']), versie: k.versie,
    codenaam: a.codename, verkoper: neem(k.verkoper, ['org', 'supplierCode', 'naam']),
    offerte: offerte(k.offerte), offerteVersies: (k.offerteVersies || []).map(offerte),
    akkoord: k.akkoord ? { ...neem(k.akkoord, ['offerteHash', 'at']), actor: persoon(k.akkoord.actorRef) } : null,
    leveringen: (k.leveringen || []).map(levering),
    betaling: k.betaling ? { ...neem(k.betaling, ['status', 'centen', 'at', 'boekingRef']), valuta: 'EUR' } : null,
    nazorg: (k.nazorg || []).map(nazorg),
    gebeurtenissen: (k.gebeurtenissen || []).map(g => ({ ...neem(g, ['volgnummer', 'soort', 'at']), actor: persoon(g.actorRef) })) };
}

module.exports = ({ bewerkCollectie, toegang, uitgangVan, nu = () => datum().toISOString() }) => {
  if (typeof bewerkCollectie !== 'function') throw new Error('Reisexport vereist de bestaande transactionele collectiepoort.');
  function exporteer(actor, rol) {
    // De route levert uitsluitend de actor van de bestaande persoonlijke deur.
    if (!actor || !/^user-[1-9]\d*$/.test(actor.actorRef || '') || actor.role !== 'manager' || !actor.supplierCode || !actor.org)
      return Promise.resolve(fout(403, 'Reiszelfexport vraagt uw bestaande persoonlijke zaakbevoegdheid.'));
    return bewerkCollectie({ reisAanvragen: 'lijst' }, data => {
      // Ook na wachten op opslag moet de actuele zaak nog bij deze tenant horen.
      const zaak = rol === 'verkoper' ? toegang.ontvanger(actor.supplierCode) : toegang.leverancier(actor.supplierCode);
      if (!zaak || zaak.error || zaak.org !== actor.org || zaak.supplierCode !== actor.supplierCode)
        return fout(403, 'De zaakbinding is gewijzigd of niet meer actief. Deze export is niet bevoegd.');
      const eigen = a => a.keten && (rol === 'verkoper'
        ? a.keten.verkoper.org === actor.org && a.keten.verkoper.supplierCode === actor.supplierCode
        : (a.keten.leveringen || []).some(p => p.org === actor.org && p.supplierCode === actor.supplierCode));
      const reizen = data.reisAanvragen.filter(eigen).map(a => projecteer(a, actor, rol));
      const archief = { schemaVersion: 1, status: 'documentair', operationeelHerstel: false,
        scope: { soort: 'zaak', rol, org: actor.org, supplierCode: actor.supplierCode },
        naam: zaak.naam, at: nu(), reizen,
        dekking: {
          volledig: rol === 'verkoper' ? ['Eigen reisaanvragen', 'Bewaarde offerteversies en akkoord',
            'Eigen verkoopcontracten en bronreferenties', 'Leveringsverklaringen met beslisgeschiedenis',
            'Opgeslagen inningsstatus en boekingsreferentie', 'Bewaarde reisketengebeurtenissen',
            'Nazorgvragen en onbevestigde verklaringen van de eigen verkoper']
            : ['Eigen toegewezen opdrachten', 'Eigen bron- en bedragreferenties', 'Eigen acceptatie-, weigerings- en leveringsgeschiedenis'],
          nietGedekt: ['Andere zaken, ook binnen dezelfde tenant', 'Andere persoons- of werkruimtedossiers',
            'Live provideradministratie en bankbewijzen', 'Uitgevoerde contractwijzigingen, refunds en settlement',
            'Volledige tenantuitgang en exitbevoegdheid tijdens bewaring'],
          actoren: 'Actorverwijzingen gelden alleen binnen één reis; de accountkoppeling blijft in de bevoegde bron.',
          bewijs: 'Opgeslagen verklaringen en referenties, geen onafhankelijke leveranciers- of bankvalidatie. Een nazorgbronref is een ongeverifieerde verkopersverklaring, geen contractgoedkeuring. Een checksum bewijst samenhang, geen authenticiteit.',
          invoer: 'Alleen een leesarchief. Geen rechten, leveranciersacceptaties, betaalbewijzen of uitvoerbare opdrachten worden geactiveerd.' }
      };
      const uitgang = uitgangVan();
      if (!uitgang || typeof uitgang.reisarchief !== 'function') return fout(503, 'De bestaande tenantuitgang is niet beschikbaar.');
      return uitgang.reisarchief(kopie(archief));
    });
  }
  return { zaken: actor => exporteer(actor, 'verkoper'), opdrachten: actor => exporteer(actor, 'aanbieder'),
    leesbaar: uitvoer => uitgangVan().leesbaar(uitvoer) };
};
