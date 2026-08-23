/* Alleen-lezen gastprojectie van de horecarekening. De rekening blijft de
   enige waarheid; dit bestand vertaalt toestand en klokvelden naar het
   klantscherm en schrijft nergens. */
'use strict';

module.exports = ({ horeca }) => {
  const { totaal, openstaand } = horeca;

  function tijdlijn(rek) {
    const uit = [];
    const kort = (t) => t ? String(t).slice(11, 16) : null;
    for (const r of (rek.regels || [])) {
      const naam = r.naam + (r.aantal > 1 ? ' × ' + r.aantal : '');
      if (r.at) uit.push({ om: kort(r.at), wat: 'Bestelling ontvangen', wie: naam, sleutel: r.id });
      if (r.startAt) uit.push({ om: kort(r.startAt), wat: 'De keuken is begonnen', wie: naam, sleutel: r.id });
      if (r.klaarAt) uit.push({ om: kort(r.klaarAt), wat: 'Klaar in de keuken', wie: naam, sleutel: r.id });
      if (r.uitAt) uit.push({ om: kort(r.uitAt),
        wat: rek.kanaal === 'bezorging' ? 'Overgedragen voor bezorging'
          : (rek.kanaal === 'afhaal' ? 'Uitgegeven aan de balie' : 'Geserveerd'),
        wie: naam, sleutel: r.id });
    }
    for (const b of (rek.betalingen || [])) uit.push({ om: kort(b.at),
      wat: 'Betaling ontvangen', wie: '€ ' + (b.centen / 100).toFixed(2), sleutel: b.id });
    return uit.sort((a, b) => String(a.om).localeCompare(String(b.om)));
  }

  function serviceVan(rek, regels) {
    const n = regels.length;
    const uit = regels.filter(r => r.stand === 'uitgegeven').length;
    let service = { stap:'Welkom', volgende:'Bekijk rustig de kaart of vraag de bediening.', voortgang:10 };
    if (n) service = regels.some(r => r.bevestiging === 'wacht')
      ? { stap:'Persoonlijke controle', volgende:'Een medewerker controleert uw bestelling zorgvuldig.', voortgang:28 }
      : uit === n ? { stap:'Genieten', volgende:'Alles is geserveerd. Vraag met één tik iets of bekijk de rekening.', voortgang:82 }
      : regels.some(r => r.stand === 'klaar') ? { stap:'Bijna bij u', volgende:'Uw gang wordt nu compleet gemaakt voor uitserveren.', voortgang:68 }
      : regels.some(r => r.stand === 'gestart'||r.stand === 'bereid') ? { stap:'In bereiding', volgende:'De keuken bereidt uw bestelling en stemt de gerechten op elkaar af.', voortgang:50 }
      : { stap:'Ontvangen', volgende:'Uw bestelling staat veilig bij de zaak. De keuken start op het juiste moment.', voortgang:34 };
    if (n && rek.kanaal === 'bezorging') service = regels.some(r => r.bevestiging === 'wacht')
      ? { stap:'Persoonlijke controle', volgende:'De zaak controleert uw bestelling voordat de keuken begint.', voortgang:28 }
      : uit === n ? { stap:'Overgedragen', volgende:'De zaak heeft uw bestelling uitgegeven voor bezorging.', voortgang:82 }
      : regels.some(r => r.stand === 'klaar') ? { stap:'Klaar voor vertrek', volgende:'Uw bestelling is verpakt en wacht op overdracht.', voortgang:68 }
      : regels.some(r => r.stand === 'gestart'||r.stand === 'bereid') ? { stap:'In bereiding', volgende:'De keuken bereidt en controleert uw bestelling.', voortgang:50 }
      : { stap:'Ontvangen', volgende:'Uw bestelling staat veilig bij de zaak.', voortgang:34 };
    if (n && rek.kanaal === 'afhaal') service = regels.some(r => r.bevestiging === 'wacht')
      ? { stap:'Persoonlijke controle', volgende:'De zaak controleert uw bestelling voordat de keuken begint.', voortgang:28 }
      : uit === n ? { stap:'Uitgegeven', volgende:'Uw bestelling is aan de balie uitgegeven.', voortgang:100 }
      : regels.some(r => r.stand === 'klaar') ? { stap:'Klaar om af te halen', volgende:'Neem uw afhaalcode mee naar de balie.', voortgang:82 }
      : regels.some(r => r.stand === 'gestart'||r.stand === 'bereid') ? { stap:'In bereiding', volgende:'De keuken bereidt en verpakt uw bestelling.', voortgang:50 }
      : { stap:'Ontvangen', volgende:'Uw bestelling staat veilig bij de zaak.', voortgang:34 };
    return service;
  }

  function gastBeeld(rek, deelnemer) {
    const t = totaal(rek);
    const wie = (nr) => (rek.deelnemers || []).find(d => d.nr === nr);
    const regels = rek.regels || [];
    return {
      rekeningId: rek.id, tafel: rek.tafel, kanaal: rek.kanaal, status: rek.status,
      reis: rek.reis || 'plaatsgenomen', service: serviceVan(rek, regels),
      ik: deelnemer ? { nr: deelnemer.nr, handle: deelnemer.handle } : null,
      deelnemers: (rek.deelnemers || []).map(d => ({ nr: d.nr, handle: d.handle, lid: !!d.lid })),
      regels: regels.map(r => ({
        id: r.id, naam: r.naam, aantal: r.aantal, centen: r.centen, lijstprijs: r.lijstprijs,
        happy: r.happy || null, gang: r.gang, allergie: r.allergie || null, notitie: r.notitie || null,
        itemId: r.itemId || null, opties: r.opties || [], ingredienten: r.ingredienten || [],
        allergenen: r.allergenen || [], prijsversie: r.prijsversie || null,
        stand: r.stand, gastNr: r.gastNr || null,
        doorHandle: r.gastNr && wie(r.gastNr) ? wie(r.gastNr).handle : null,
        bevestiging: r.bevestiging || null, bevestigingUitleg: r.bevestigingUitleg || null
      })),
      kortingen: (rek.kortingen || []).map(k => ({ reden: k.reden, procent: k.procent, centen: k.centen })),
      betaald: (rek.betalingen || []).map(b => ({ wijze: b.wijze, centen: b.centen, at: b.at })),
      totalen: t, openstaand: openstaand(rek), tijdlijn: tijdlijn(rek)
    };
  }

  return { tijdlijn, gastBeeld };
};
