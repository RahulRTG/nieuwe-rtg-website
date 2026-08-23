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

  /* DE SERVICESTAP DRAAGT GEEN PERCENTAGE MEER.

     Hier stonden vaste getallen (10 / 28 / 34 / 50 / 68 / 82 / 100) die uit een
     toestandslabel kwamen en niets maten, en op de telefoon van de gast werden
     ze een voortgangsbalk. Precies dezelfde fout als in de gastreis-toren van de
     zaak, en op deze plek erger: een gast kijkt naar die balk om te weten hoe
     lang het nog duurt, en hij zei niets.

     HORECA.md grens 7: wat niet gemeten is, wordt niet als getal getoond. Wat er
     wél te tellen valt gaat mee als `geserveerd` -- hoeveel van de bestelde
     regels op tafel staan. Het scherm tekent zijn balk uit die breuk en zet de
     twee getallen erbij; bij een tafel die nog niets besteld heeft is er geen
     balk in plaats van een balk op tien procent. */
  function serviceVan(rek, regels) {
    const n = regels.length;
    const uit = regels.filter(r => r.stand === 'uitgegeven').length;
    let service = { stap:'Welkom', volgende:'Bekijk rustig de kaart of vraag de bediening.' };
    if (n) service = regels.some(r => r.bevestiging === 'wacht')
      ? { stap:'Persoonlijke controle', volgende:'Een medewerker controleert uw bestelling zorgvuldig.' }
      : uit === n ? { stap:'Genieten', volgende:'Alles is geserveerd. Vraag met één tik iets of bekijk de rekening.' }
      : regels.some(r => r.stand === 'klaar') ? { stap:'Bijna bij u', volgende:'Uw gang wordt nu compleet gemaakt voor uitserveren.' }
      : regels.some(r => r.stand === 'gestart'||r.stand === 'bereid') ? { stap:'In bereiding', volgende:'De keuken bereidt uw bestelling en stemt de gerechten op elkaar af.' }
      : { stap:'Ontvangen', volgende:'Uw bestelling staat veilig bij de zaak. De keuken start op het juiste moment.' };
    if (n && rek.kanaal === 'bezorging') service = regels.some(r => r.bevestiging === 'wacht')
      ? { stap:'Persoonlijke controle', volgende:'De zaak controleert uw bestelling voordat de keuken begint.' }
      : uit === n ? { stap:'Overgedragen', volgende:'De zaak heeft uw bestelling uitgegeven voor bezorging.' }
      : regels.some(r => r.stand === 'klaar') ? { stap:'Klaar voor vertrek', volgende:'Uw bestelling is verpakt en wacht op overdracht.' }
      : regels.some(r => r.stand === 'gestart'||r.stand === 'bereid') ? { stap:'In bereiding', volgende:'De keuken bereidt en controleert uw bestelling.' }
      : { stap:'Ontvangen', volgende:'Uw bestelling staat veilig bij de zaak.' };
    if (n && rek.kanaal === 'afhaal') service = regels.some(r => r.bevestiging === 'wacht')
      ? { stap:'Persoonlijke controle', volgende:'De zaak controleert uw bestelling voordat de keuken begint.' }
      : uit === n ? { stap:'Uitgegeven', volgende:'Uw bestelling is aan de balie uitgegeven.' }
      : regels.some(r => r.stand === 'klaar') ? { stap:'Klaar om af te halen', volgende:'Neem uw afhaalcode mee naar de balie.' }
      : regels.some(r => r.stand === 'gestart'||r.stand === 'bereid') ? { stap:'In bereiding', volgende:'De keuken bereidt en verpakt uw bestelling.' }
      : { stap:'Ontvangen', volgende:'Uw bestelling staat veilig bij de zaak.' };
    /* De breuk gaat mee met de stap: uitgegeven op besteld. Bij nul besteld
       staat er nul van nul, en dat is voor het scherm het teken om geen balk
       te tekenen -- niet om er een van nul procent neer te zetten. */
    return Object.assign({}, service, { geserveerd: { uitgegeven: uit, besteld: n } });
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
