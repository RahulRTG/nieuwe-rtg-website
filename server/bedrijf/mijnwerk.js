/* RTG Werk OS (deellaag): waar was ik gebleven.

   "Je bent nu bezig met Project Europa, klant BMW, ticket 483 -- zal ik het
   contract, de agenda en het budget ernaast openen?" Dat is een prettige app.
   Het is ook, aan de andere kant van dezelfde tafel, een volgsysteem: dezelfde
   gegevens vertellen een werkgever waar iemand de hele dag mee bezig was.

   DIT HUIS HEEFT DIE GRENS AL EEN KEER GETROKKEN. Bij de kijkplicht van de
   Media OS meet RTG geen weergaven, geen kijktijd en geen bereik; de medewerker
   TEKENT ZELF AF. Diezelfde regel geldt hier, en hij staat niet in een
   instelling maar in de VORM VAN DE ROUTE:

     ER IS GEEN PARAMETER OM NAAR IEMAND ANDERS TE VRAGEN.

   Deze module kent geen `lidId`. Wie er aanklopt krijgt zijn eigen werk, en er
   bestaat geen aanroep die het werk van een collega oplevert -- niet omdat er
   een controle op staat die iemand kan vergeten, maar omdat er geen pad is. Dat
   is dezelfde bouwvorm als het zaakregister: weglaten in plaats van filteren.

   HET BEHEER-TOKEN KOMT HIER OOK NIET BINNEN. Dat token is directie en draagt
   alle rechten -- precies daarom. Een beheerder die dit scherm kan openen, zou
   het werk van iedereen kunnen lezen, en dan is de regel hierboven een leuze.
   Hij krijgt een 403 met die reden erbij.

   WAT ER NIET WORDT BIJGEHOUDEN. Er komt geen nieuwe meting bij: geen
   schermtijd, geen kliks, geen "laatst geopend". Deze module LEEST het
   werkjournaal dat de modules zelf al schrijven en de rijen die uw naam
   dragen. Wat u hier ziet, had een collega met genoeg rechten ook al kunnen
   zien in de modules zelf; er wordt niets nieuws over u vastgelegd. */
'use strict';

module.exports = (sctx) => {
  const { app, dag, werkPoort } = sctx;
  const { naamgrens } = require('../kern/werkcommand/naamgrens');

  app.post('/api/bedrijf/mijnwerk', (req, res) => {
    const g = werkPoort(req, res); if (!g) return;
    if (g.directie) return res.status(403).json({
      error: 'Dit scherm is van een mens, en het beheer-token is geen mens.',
      let: 'Zou het beheer-token hier binnenkomen, dan kon een beheerder het werk van iedereen lezen -- en dan is "er is geen parameter om naar een ander te vragen" een leuze in plaats van een grendel.' });

    const naam = g.l.naam;
    const w = g.w;

    /* Uw eigen sporen in het werkjournaal. Op `wieId` en niet op naam: het
       journaal legt het lid-id vast, en dat is hier wel een sleutel. */
    const mijn = (w.journaal || []).filter(j => j && j.wieId === g.l.id).slice(0, 15)
      .map(j => ({ wat: j.wat, waarover: j.waarover, at: j.at }));

    /* Wat er op uw naam openstaat -- en sinds bedrijf/wieis.js met een ID waar
       dat kon. `mij()` pakt eerst het id (exact) en valt alleen terug op de naam
       als de rij geen id draagt: dat zijn de rijen van voor die ronde, en die
       kunnen van een naamgenoot zijn. De telling van allebei staat in de
       uitslag, zodat zichtbaar is hoeveel van deze lijst nog een gok is. */
    let exact = 0, opNaam = 0;
    const mij = (r, veld) => {
      if (r[veld + 'Id']) { const raak = r[veld + 'Id'] === g.l.id; if (raak) exact++; return raak; }
      const raak = String(r[veld] || '') === naam; if (raak) opNaam++; return raak;
    };
    const taken = Object.values(w.taken || {})
      .filter(t => t.kolom !== 'klaar' && mij(t, 'wie'))
      .sort((a, b) => String(a.deadline || '9999').localeCompare(String(b.deadline || '9999')));
    const tickets = Object.values(w.tickets || {})
      .filter(t => t.status !== 'gesloten' && mij(t, 'wie'));
    const projecten = Object.values(w.projecten || {})
      .filter(p => p.status === 'loopt' && mij(p, 'eigenaar'));
    const kansen = Object.values(w.kansen || {})
      .filter(k => k.fase !== 'gewonnen' && k.fase !== 'verloren' && mij(k, 'eigenaar'));

    res.json({ ok: true,
      wie: { naam, rollen: g.rechten },
      openstaand: {
        taken: taken.slice(0, 10).map(t => ({ id: t.id, titel: t.titel, deadline: t.deadline,
          teLaat: !!(t.deadline && t.deadline < dag()), projectId: t.projectId })),
        tickets: tickets.slice(0, 10).map(t => ({ id: t.id, onderwerp: t.onderwerp, prioriteit: t.prioriteit })),
        projecten: projecten.map(p => ({ id: p.id, naam: p.naam, eind: p.eind })),
        kansen: kansen.slice(0, 10).map(k => ({ id: k.id, titel: k.titel, klant: k.klant, fase: k.fase })),
        aantallen: { taken: taken.length, tickets: tickets.length,
          projecten: projecten.length, kansen: kansen.length }
      },
      laatstGedaan: mijn,
      gevonden: { opId: exact, opNaam,
        let: opNaam
          ? opNaam + ' rij(en) zijn op NAAM gevonden en niet op een id: die dragen geen lid-id (van voor die laag bestond) en kunnen dus van een naamgenoot zijn. ' + exact + ' rij(en) zijn exact.'
          : 'Alle rijen zijn op lid-id gevonden; er zit geen naamgok in deze lijst.' },
      naamgrens: naamgrens(w.leden, naam),
      let: 'Dit is uw eigen werk. Er bestaat geen aanroep waarmee u hier het werk van een collega uit haalt -- deze route kent geen veld om iemand anders in te vullen, en dat is met opzet de grendel in plaats van een controle die iemand kan vergeten. Er wordt voor dit scherm ook niets nieuws over u vastgelegd: het leest het journaal dat de modules zelf al schrijven.' });
  });
};
