/* Routes "festival" (deelmodule): DE VERKOOP.

   DE VOLGORDE IS DE HELE BEVEILIGING. Reserveren verbruikt de plek synchroon,
   dan pas gaat er geld heen en weer, en pas daarna komt de pas. Draai je dat om
   -- eerst betalen, dan kijken of er nog plek is -- dan verkoop je de laatste
   plek twee keer aan twee mensen die allebei betaald hebben, en dan mag er
   iemand aan de poort uitleggen wie er niet naar binnen mag.

   MISLUKT DE BETALING, DAN GAAT DE PLEK TERUG. Meteen, en niet pas als de
   reservering vervalt: een koper die zijn code verkeerd typt, hoort de zaal
   niet een kwartier bezet te houden.

   HET GELD LOOPT OVER DE BETAALLAAG EN NERGENS ANDERS. kern/pay/kassa.js
   consumeert de kascode voor zijn eigen awaits en is idempotent; deze route
   voegt daar niets aan toe en houdt vooral geen tweede saldo bij.

   DE KLOK KOMT VAN DE SERVER, om dezelfde reden als bij de scan: wie het moment
   mag meesturen, maakt een verlopen reservering weer geldig. */
'use strict';

module.exports = (kern, deur) => {
  const { app, festival, logActivity, pay, supplierAuth } = kern;
  const { mijn, editieVan, geenFestival, stuur } = deur;

  const nu = () => new Date().toISOString();

  app.post('/api/festival/ruimte', supplierAuth, (req, res) => {
    const f = mijn(req);
    if (!f) return stuur(res, geenFestival);
    stuur(res, festival.ruimte(f.id, editieVan(req), (req.body || {}).product, nu()));
  });

  /* Stap 1: de plek vastzetten. Elk personeelslid mag verkopen -- dat is het
     werk aan de kassa en aan de deur. */
  app.post('/api/festival/verkoop', supplierAuth, (req, res) => {
    const f = mijn(req);
    if (!f) return stuur(res, geenFestival);
    const b = req.body || {};
    const r = festival.reserveer(f.id, editieVan(req), {
      product: b.product, koper: b.koper, minuten: b.minuten, moment: nu()
    });
    stuur(res, r);
  });

  app.post('/api/festival/verkoop/los', supplierAuth, (req, res) => {
    const f = mijn(req);
    if (!f) return stuur(res, geenFestival);
    stuur(res, festival.verkoopLos(f.id, editieVan(req), { id: (req.body || {}).id }));
  });

  /* Stap 2: betalen en de pas uitgeven. */
  app.post('/api/festival/verkoop/rond', supplierAuth, async (req, res) => {
    const f = mijn(req);
    if (!f) return stuur(res, geenFestival);
    const eid = editieVan(req);
    const b = req.body || {};
    const id = String(b.id || '');

    /* Wat er te betalen valt, komt uit de RESERVERING en niet uit het lichaam:
       een prijs die de koper meestuurt is geen prijs. */
    const staat = festival.verkopenVan(f.id, eid, nu());
    if (staat.error) return stuur(res, staat);
    const v = (staat.verkopen || []).find(x => x.id === id);
    if (!v) return stuur(res, { status: 404, error: 'Deze reservering bestaat niet.' });
    if (v.stand !== 'gereserveerd') return stuur(res, { status: 409, error: 'Deze verkoop staat op ' + v.stand + '.' });

    const methode = b.methode === 'rtgpay' ? 'rtgpay' : 'contant';
    const centen = Math.round(Number(v.prijs) * 100);
    let betaler = null;
    if (methode === 'rtgpay' && centen > 0) {
      const p = await pay.kasInt({ supplierCode: req.supplier.code, code: b.payCode, centen,
        oms: 'Festival ' + f.naam, idem: b.idem });
      if (p.error) {
        /* DE PLEK METEEN TERUG. Een mislukte betaling hoort geen kwartier
           voorraad vast te houden. */
        festival.verkoopLos(f.id, eid, { id });
        return stuur(res, { status: p.status || 400, error: p.error, losgelaten: true });
      }
      betaler = p.van;
    }

    const r = festival.verkoopRond(f.id, eid, { id, moment: nu(),
      betaald: { methode, betaler, centen } });
    if (r.ok) logActivity(req.supplier.code, req.actor, 'verkocht een pas aan ' + r.verkoop.koper);
    stuur(res, r);
  });
};
