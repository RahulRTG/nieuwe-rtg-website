/* Kantoren, deel "reisteruggave": HET TERUGGAVERECHT VAN EEN REIS UITVOEREN.

   Een betaalde reis die wordt afgezegd of teruggeboekt, laat een RECHT achter
   (kern/reisbureau-teruggave.js). Dat recht stond klaar met "een mens van het
   kantoor voert hem uit langs kern/pay" -- en er was geen deur om dat te doen
   (Fase 0, defect D8). Dit is die deur.

   DRIE REGELS, alle drie besluiten van de eigenaar:
   - WIE het doet komt uit de sessie, nooit uit het lijf: kluisAuth, dus de
     gedeelde kantoorcode komt er niet in (AUTHORITY.md, P0b).
   - Geld op kantoor gaat met een PASSKEY, zonder terugval (25 september 2026),
     gebonden aan dit ene recht ('teruggave:' + id).
   - Vanaf DUIZEND EURO tekent een TWEEDE mens (4 oktober 2026; dezelfde grens
     als BELEID.goedkeuringBovenCenten in kern/commercie/besluit.js). Die tekent
     bij de bestaande bevestigroute van de tweede handtekening, met zijn eigen
     passkey (./bank-passkey.js) -- er komt hier geen tweede vier-ogenmechanisme.
     Dat pad loopt sinds 11 oktober 2026 door de geldketen (MACHINE.md, de tweede
     keten en de eerste van de klasse `geld-eenmalig`); het dossier staat op
     /api/office/bank/incasso/dossier, per voornemen.

   Afwijzen beweegt geen geld en vraagt daarom geen passkey, wel een naam en een
   reden die het lid leest. */
'use strict';

const { BELEID } = require('../../kern/commercie/besluit');
const { wie: envelopWie } = require('../../opzet/envelop');

module.exports = (ctx) => {
  const { app, kluisAuth, veilig, afdelingen, kern, zwaar, boardroomUser, tweedeHand } = ctx;
  const rb = () => kern.reisbetaling;
  const VIER_OGEN_VANAF = BELEID.goedkeuringBovenCenten;
  /* Dezelfde naam als in ./bank.js: uit de envelop van de sessie, nooit uit het lijf. */
  const naam = req => envelopWie(req) || 'backoffice (gedeelde code)';

  /* Wat er gebeurt zodra de tweede mens tekent, staat in ./reisteruggave-keten.js. */
  require('./reisteruggave-keten')(ctx);

  // wat er klaarstaat: open rechten, nieuwste laatst
  app.post('/api/office/reisbureau/teruggaven', kluisAuth, (req, res) => veilig(res, () => ({
    open: rb().teruggavenOpen(), vierOgenVanafCenten: VIER_OGEN_VANAF,
    let: 'Een afgezegde of teruggeboekte reis laat een recht achter. Uitvoeren of afwijzen is een besluit van een mens; er gebeurt hier niets vanzelf.' })));

  // de ceremonie, gebonden aan dit ene recht
  app.post('/api/office/reisbureau/teruggave/opties', kluisAuth, async (req, res) => {
    const id = String((req.body || {}).id || '');
    if (!rb().teruggaveVan(id)) return res.status(404).json({ error: 'Dit teruggaverecht bestaat niet.' });
    const r = await zwaar.opties(boardroomUser(req), 'reisbureau.teruggave', 'teruggave:' + id, req);
    if (r.error) return res.status(r.status || 400).json({ error: r.error });
    res.json(r);
  });

  app.post('/api/office/reisbureau/teruggave', kluisAuth, async (req, res) => {
    const b = req.body || {};
    const id = String(b.id || '');
    const recht = rb().teruggaveVan(id);
    if (!recht) return res.status(404).json({ error: 'Dit teruggaverecht bestaat niet.' });
    /* EERST DE STAND: anders opent een besloten recht een nieuwe aanvraag voor
       een tweede mens, die pas bij het tekenen zou zakken. */
    if (recht.uitgevoerd || recht.besluit) return res.status(409).json({ error: 'Hierover is al besloten (' + (recht.uitgevoerd ? 'uitgevoerd' : 'afgewezen') + ').' });
    if (b.besluit === 'afgewezen') {
      return veilig(res, () => {
        const r = rb().teruggaveAfwijzen({ id, door: req.officeKey, reden: b.reden });
        if (r.ok) afdelingen.audit(req.officeKey, 'Reisbureau: teruggave ' + id + ' afgewezen');
        return r;
      });
    }
    if (b.besluit !== 'uitvoeren') return res.status(400).json({ error: 'Een besluit is "uitvoeren" of "afgewezen".' });
    const zw = await zwaar.eis(boardroomUser(req), 'reisbureau.teruggave', 'teruggave:' + id, req,
      'Een teruggave van een reis', { zonderTerugval: true });
    if (!zw.ok) return zwaar.stuur(res, zw);
    if (recht.centen >= VIER_OGEN_VANAF) {
      const ketenlaag = kern.geldketen;
      if (!ketenlaag) return veilig(res, () => ({ status: 503,
        error: 'De geldketen is niet gemount; een teruggave vanaf de vier-ogengrens gaat niet buiten de keten om.' }));
      /* DE BAAN TOT HET BESLUIT (kern/kantoor/geldketen.js). De economische sleutel is
         het RECHT en niet iets van de client: twee medewerkers die allebei drukken,
         krijgen hetzelfde voornemen. */
      /* EEN OPEN AANVRAAG IS GENOEG. Een tweede knopdruk opende een tweede aanvraag op
         hetzelfde voornemen; die tweede handtekening ging nergens meer over. */
      const al = (tweedeHand.open().aanvragen || []).find(a => a.actie === 'reisbureau.teruggave' && a.onderwerp === id);
      if (al) return veilig(res, () => ({ status: 409,
        error: 'Voor deze teruggave staat al een aanvraag voor een tweede mens open (' + al.id + '). Die tekent een collega bij RTG Bank, of u trekt hem daar in.' }));
      /* EEN NIEUWE POGING NA EEN MISLUKTE UITVOERING. Liep de uitvoering vast (de
         betaallaag gaf een fout, de kas was te krap), dan staat het voornemen op GESTAAKT
         en het recht nog open. Met dezelfde sleutel kwam dan steeds dat gestaakte voornemen
         terug en zat de teruggave voorgoed vast. Een nieuwe poging krijgt daarom een sleutel
         die het gestaakte voornemen noemt -- nog steeds idempotent: twee keer drukken na
         dezelfde mislukking is dezelfde nieuwe poging. Een AFGEWEZEN voornemen krijgt geen
         nieuwe poging: een nee wordt geen ja door het nog eens te vragen. */
      let sleutel = 'teruggave:' + id, klaar = null;
      for (let poging = 0; poging < 20; poging++) {
        klaar = zetKlaar(sleutel);
        if (klaar.eindstand && klaar.voornemen && klaar.voornemen.stand === 'GESTAAKT') {
          sleutel = 'teruggave:' + id + ':na:' + klaar.voornemen.id;
          continue;
        }
        break;
      }
      if (!klaar.ok) return veilig(res, () => klaar);
      return veilig(res, () => {
        const vraag = tweedeHand.vraag({ actie: 'reisbureau.teruggave', lijf: { id, voornemen: klaar.voornemen.id },
          onderwerp: id, door: req.officeKey });
        return vraag.ok ? { ...vraag, voornemen: klaar.voornemen, dossier: klaar.dossier } : vraag;
      });
    }
    function zetKlaar(sleutel) {
      return kern.geldketen.klaarzet({
        klasse: 'geld-eenmalig', handeling: 'GELD_TERUGGEVEN', pad: '/api/office/reisbureau/teruggave',
        doel: 'teruggave ' + recht.id + ' van reis ' + recht.ref,
        mens: { naam: naam(req), sleutel: req.officeKey },
        assurance: zw,
        streefstand: 'het lid heeft ' + (recht.centen / 100).toFixed(2) + ' EUR terug op het betaaladres van ' +
          'de bon, en het recht ' + recht.id + ' staat op uitgevoerd met de boeking erbij',
        /* Het tegenfeit is hier GEEN bovengrens maar het bevroren bedrag van het recht:
           dat werd vastgezet bij het klaarzetten en verandert niet meer. `over` is de
           weg die het geld werkelijk beweegt (zie geldketen/gevolgpoort.js). */
        tegenfeit: { graad: 'gemeten', uitslag: { centen: recht.centen, valuta: recht.valuta || 'EUR', naar: 'betaaladres van de bon' },
          reden: 'het bedrag is bevroren in het teruggaverecht (kern/reisbureau-teruggave.js#terugboeken)',
          over: '/api/office/bank/handtekening/bevestig', effecten: ['GELD_BEWEGEN', 'SCHRIJVEN_ANDERMANS'] },
        stappen: [{ wat: 'teruggave', doel: recht.ref, centen: recht.centen, gegevens: { id } }],
        totaalCenten: recht.centen,
        sleutel,
        /* Of een teruggave omkeerbaar is, zegt kern/commercie/geldomkeer.js -- niet deze route. */
        /* DE BELOFTE VAN DE UITVOERING, en voor deze klasse is dat ATOMAIR. */
        uitvoerbelofte: { graad: 'gemeten', uitslag: 'atomair: een boeking',
          reden: 'kern/reisbureau-teruggave.js#uitvoeren geeft kern/pay#terugGave precies EEN deel ' +
            '(rtg:reisbureau, partner nul), en een boeking past debet en credit in een keer toe ' +
            '(kern/pay/boeking.js#pasToe) of weigert zonder iets te veranderen. Een herhaling na een storing ' +
            'tussen boeking en markering boekt niet nog eens: de idem-sleutel is het id van het recht.' },
      });
    }
    const r = await rb().teruggaveUitvoeren({ id, door: req.officeKey });
    veilig(res, () => {
      if (r.ok) afdelingen.audit(req.officeKey, 'Reisbureau: teruggave ' + id + ' uitgevoerd (' + (recht.centen / 100).toFixed(2) + ' EUR)');
      return r;
    });
  });
};
