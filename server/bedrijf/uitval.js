/* RTG Werk OS (deellaag): wat valt er om als DIT wegvalt.

   "Welke klanten lopen risico als deze leverancier uitvalt?" is de vraag waar
   een organisatie een middag voor gaat zitten met een spreadsheet. Hier is hij
   gemeten, en de meting is eerlijk over de plek waar hij dun is.

   HET PROBLEEM DAT DE VORM BEPAALT: EEN LEVERANCIER BESTAAT HIER NIET. Er is
   geen leverancier-object met een id. Wat er wél is, is `wederpartij` op een
   contract -- een vrij tekstveld met een naam erin. Deze analyse zoekt dus op
   NAAM, en dat is precies dezelfde uitzondering die de soort `lid` in het
   register maakt: hij levert antwoorden die anders niet bestaan, en hij kan
   ernaast zitten. Dus reist dezelfde waarschuwing mee, met de telling erbij --
   hoeveel wederpartijen er zijn met deze naam, en of de naam ook een gewone
   waarde is.

   WAT ER VANAF DAAR WEL GEMETEN IS. Zodra de contracten gevonden zijn, loopt de
   rest over ECHTE sleutels: het contract draagt een `klantId`, en de klant
   draagt zijn tickets en kansen. Die stap is dus geen naamgok maar dezelfde
   samenhang die het objectdossier ook vindt. Het antwoord zegt per stap welke
   van de twee het was, want anders krijgt de hele keten de hardheid van de
   zwakste schakel zonder dat je kunt zien welke dat is.

   OVER `besluiten: null`. Wie het recht 'besluit' mist krijgt null en niet een
   lege lijst -- "ik heb niet gekeken" is iets anders dan "er is niets". Met de
   rollen van vandaag is die tak onbereikbaar: elke rol die contracten mag zien
   (jurist, directie) draagt ook 'besluit'. Hij staat er als grendel voor een
   rollenmodel dat verandert, en niet als een pad dat nu bestaat -- dat hoort
   hier te staan in plaats van in een toets die doet alsof het wel zo is.

   EN DE BESLUITEN KOMEN MEE. Waarom deze leverancier ooit is gekozen, staat in
   het besluitgeheugen (bedrijf/geheugen.js) als er iemand een koppeling heeft
   gelegd. Dat is de vraag die je stelt op de dag dat hij omvalt.

   WAT DIT NIET IS: geen kansberekening en geen schade-in-euro's. Er staat wat
   eraan hangt en wat het waard is volgens de contracten zelf; hoe waarschijnlijk
   uitval is en wat het zou kosten, weet dit huis niet en verzint het niet. */
'use strict';

const { naamgrens } = require('../kern/werkcommand/naamgrens');

module.exports = (sctx) => {
  const { app, schoon, werkPoort } = sctx;

  app.post('/api/bedrijf/uitval', (req, res) => {
    const g = werkPoort(req, res, 'recht'); if (!g) return;
    const naam = schoon(req.body.wederpartij, 80);
    if (!naam) return res.status(400).json({ error: 'Welke wederpartij valt uit?' });
    const klein = naam.toLowerCase();

    const alle = Object.values(sctx.CONTRACTEN(g.w));
    const raak = alle.filter(c => String(c.wederpartij || '').toLowerCase() === klein);
    if (!raak.length) return res.json({ ok: true, wederpartij: naam, contracten: [],
      let: 'Geen enkel contract staat op deze wederpartij. Dat is een uitslag en geen geruststelling: een leverancier zonder contract kan er wel degelijk zijn -- hij staat dan alleen nergens vastgelegd.' });

    const magKlant = g.rechten.includes('klant');
    const magService = g.rechten.includes('service');
    const magBesluit = g.rechten.includes('besluit');

    const klanten = [], tickets = [], kansen = [], besluiten = [];
    for (const c of raak) {
      if (magBesluit) {
        for (const b of sctx.besluitenOver(g.w, 'contract', c.id)) {
          if (!besluiten.some(x => x.id === b.id)) besluiten.push(b);
        }
      }
      if (!c.klantId || !magKlant) continue;
      const k = sctx.eigenVeld(sctx.KLANTEN ? sctx.KLANTEN(g.w) : (g.w.klanten || {}), c.klantId);
      if (!k || klanten.some(x => x.id === k.id)) continue;
      klanten.push({ id: k.id, naam: k.naam, branche: k.branche, via: 'klantId op het contract' });
      if (magService) {
        for (const t of Object.values(g.w.tickets || {})) {
          if (t.klantId === k.id && t.status !== 'gesloten') tickets.push({ id: t.id, onderwerp: t.onderwerp, klant: k.naam });
        }
      }
      for (const ka of Object.values(g.w.kansen || {})) {
        if (ka.klantId === k.id && ka.fase !== 'gewonnen' && ka.fase !== 'verloren') {
          kansen.push({ id: ka.id, titel: ka.titel, klant: k.naam, bedragCenten: ka.bedragCenten });
        }
      }
    }

    const wederpartijen = new Set(alle.map(c => String(c.wederpartij || '')).filter(Boolean));
    res.json({ ok: true, wederpartij: naam,
      contracten: raak.map(c => ({ id: c.id, titel: c.titel, status: c.status, eindigt: c.eindigt,
        waardeCenten: c.waardeCenten, via: 'wederpartij op naam' })),
      waardeCenten: raak.reduce((n, c) => n + Number(c.waardeCenten || 0), 0),
      klanten, tickets, kansen,
      besluiten: magBesluit ? besluiten : null,
      naamgrens: Object.assign(naamgrens({}, naam), {
        gelijkeWederpartijen: [...wederpartijen].filter(x => x.toLowerCase() === klein).length,
        let: 'Een leverancier bestaat in deze laag NIET als object: er is geen id, alleen het veld "wederpartij" op een contract. De eerste stap van deze analyse gaat dus op naam en kan ernaast zitten. Alles daarna loopt over echte sleutels (klantId), en per rij staat er met "via" bij welke van de twee het was.' }),
      nietGemeten: [
        { wat: 'hoe waarschijnlijk uitval is', reden: 'daar is geen enkel gegeven voor; een kans invullen zou een mening met een cijfer eromheen zijn' },
        { wat: 'wat uitval zou kosten', reden: 'er staat wat de contracten waard zijn, niet wat vervanging kost of wat er aan omzet wegvalt' },
        { wat: 'onderaannemers van deze partij', reden: 'een contract kent geen keten; wie achter deze wederpartij zit, staat hier nergens' }
      ],
      let: 'Wat hier staat is geteld, niet geschat: ' + raak.length + ' contract(en), ' + klanten.length +
        ' klant(en) die eraan hangen' + (magBesluit ? ', en de besluiten waarin deze keuze is gemaakt' : '') +
        '. Wat u niet mag zien is weggelaten en niet als nul geteld.' });
  });
};
