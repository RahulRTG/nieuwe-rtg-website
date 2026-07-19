/* De Butler-reislaag (kern/fluister/reis): Rahul regelt met EEN vraag een hele
   reis: verblijf, transfer, diner en een activiteit, als een voorstel met een
   totaalprijs dat op een enkel "ja" in zijn geheel wordt geboekt en afgerekend,
   via exact dezelfde actie-functies als de app-knoppen. Ook hier: koopt hij
   kleding (apart leggen in uw maat bij de modezaak) en voorspelt hij wat er nog
   nodig is rond wat al geboekt staat. Alles met geld of voorraad blijft achter
   de vaste drempel (eerst "ja").

   Dit is de orkestrator: de servicedag (dagplan voor zaak/personeel) en de haak
   butlerExtra wonen hier; het reisplan en de kleding/voorspelling komen uit twee
   deelbestanden op dezelfde ctx (./reisplan en ./kleding). De gedeelde helpers
   (zaken/open/caps/datumPlus) bouwt de orkestrator en geeft hij mee. */
module.exports = (ctx) => {
  const { db, save, eur, nu } = ctx;

  const zaken = () => db.data.suppliers || [];
  const open = s => !(s.settings && s.settings.ordersOpen === false);
  const caps = s => (db.data.supplierTypes[s.type] || {}).caps || [];
  const datumPlus = (d, n) => new Date(new Date(d + 'T12:00:00').getTime() + n * 86400000).toISOString().slice(0, 10);

  const deelCtx = { ...ctx, zaken, open, caps, datumPlus };
  const { bouwReisplan, voerReisUit } = require('./reisplan')(deelCtx);
  const { bouwKleding, voerKledingUit, voorspel } = require('./kleding')(deelCtx);

  /* ---- de servicedag: voor een zaak of een personeelslid bouwt Rahul uit
     de echte dagstand (reserveringen, lopende orders, activiteiten) een
     werkplan met per regel de vervolgstap. Lezen, geen geld: direct. ---- */
  function servicedag(key) {
    const code = (String(key).match(/^(?:staff|zaak):([^:]+)/) || [])[1];
    const s = code && zaken().find(x => x.code === code);
    if (!s) return null;
    const vandaag = new Date().toISOString().slice(0, 10);
    const regels = [];
    const res = (db.data.reserveringen || []).filter(r => r.supplierCode === s.code && r.datum === vandaag && ['aangevraagd', 'bevestigd'].includes(r.status));
    if (res.length) {
      const open = res.filter(r => r.status === 'aangevraagd').length;
      regels.push(res.length + ' reservering(en) vandaag, de eerste om ' + res.map(r => r.tijd).sort()[0] +
        (open ? ' (' + open + ' nog te bevestigen: doe dat eerst, gasten wachten op zekerheid)' : ''));
    }
    let orders = [];
    try { orders = require('../../../db').ordersVanZaak(s.code).filter(o => !['geserveerd', 'geweigerd', 'terugbetaald', 'bezorgd', 'opgehaald'].includes(o.status)); } catch (e) {}
    if (orders.length) regels.push(orders.length + ' lopende bestelling(en) op de lijn: houd de wachttijden kort');
    for (const a of (s.activiteiten || []).slice(0, 2))
      regels.push(a.name + ' vandaag om ' + ((a.tijden || [])[0] || '?') + ': zet de entree en het team klaar');
    if (s.settings && s.settings.ordersOpen === false) regels.push('de zaak staat DICHT voor bestellingen: vergeet niet open te zetten als de dienst begint');
    if (!regels.length) regels.push('een rustige start: geen reserveringen of lopende orders op dit moment. Goed moment voor de voorraad, het bord en de briefing');
    return 'Uw servicedag bij ' + s.name + ': ' + regels.join(' | ') + '. Vraag me gerust door per onderdeel; ik geef ook seintjes zodra er iets bijkomt.';
  }

  /* ---- de haak in fluisterZeg: herkent de vragen en zet zelf het
     voorstel klaar; geeft null terug als de vraag niet van deze laag is. ---- */
  async function butlerExtra(q, p, sess, klaar, key) {
    // fototips: Rahul als fotocoach voor iedereen (lezen, geen geld: direct)
    if (/fototip|foto ?tip|mooiere foto('s)?|perfecte foto|hoe fotografeer/i.test(q)) {
      const food = /food|eten|gerecht|bord/i.test(q);
      return klaar(food
        ? 'Voor het perfecte food-shot: recht van boven of juist op tafelhoogte, alles ertussenin maakt borden klein. Schuif het bord naar daglicht, zet uw rug naar de lamp en ruim de tafel rond het bord op. In de RTG Camera-app wordt de ring groen zodra u recht boven het bord hangt.'
        : 'Voor de perfecte vakantiefoto: zet de horizon op een rasterlijn (niet in het midden), mensen op een derde van het beeld met kijkruimte, en fotografeer in het gouden uur, net na zonsopkomst of voor zonsondergang. De RTG Camera-app helpt met het raster en de waterpas.');
    }
    if (!sess) {
      // de zaak- en personeelskant: het dagplan uit de echte dagstand
      if (/plan (mijn|onze|de) (service)?dag|dagplan|servicedag/i.test(q)) {
        const plan = servicedag(key);
        if (plan) return klaar(plan);
      }
      return null;
    }
    if (/\b(plan|regel|boek)\b/i.test(q) && /\b(reis|trip|weekend|tripje|city ?trip)\b/i.test(q)) {
      const plan = bouwReisplan(q);
      if (!plan.delen.length) return klaar('Ik zie nu geen aanbod om een reis van te bouwen; kijk anders even in Reizen.');
      const totaal = plan.delen.reduce((t, d) => t + (d.centen || 0), 0);
      p.wacht = { soort: 'reisplan', delen: plan.delen, oms: 'reis vanaf ' + plan.start, at: nu() };
      save();
      return klaar('Mijn voorstel voor uw reis vanaf ' + plan.start + ' met ' + plan.personen + ' personen: ' +
        plan.delen.map(d => d.oms).join(' | ') + '. Samen ' + eur(totaal) + ' (de transfer volgt het tarief van de vervoerder). ' +
        'Zeg "ja" en ik boek alles in een keer, inclusief uw dagschema; "nee" en het gaat niet door.', false, true);
    }
    if (/\b(koop|bestel|zoek|regel)\b/i.test(q)) {
      // de catalogus zelf is het bewijs: vindt Rahul een echt kledingstuk in
      // de vraag, dan is dit een kledingwens (anders valt de vraag gewoon
      // door naar bestellen, tickets of de rest)
      const k = bouwKleding(q, sess);
      if (k) {
        p.wacht = { soort: 'kleding', ...k, at: nu() };
        save();
        return klaar('Gevonden: ' + k.artikel + ' (' + k.kleur + ', maat ' + k.maat + ') bij ' + k.zaakNaam + ' voor ' + eur(k.centen) +
          '. Zal ik hem voor u apart laten leggen? Zeg "ja" en hij hangt klaar; "nee" en ik laat hem hangen.', false, true);
      }
      if (/\b(kleding|jurk|overhemd|shirt|jas|schoenen|outfit|broek|blazer|rok)\b/i.test(q))
        return klaar('Ik vond dit stuk niet in de collecties. Vraag het iets anders ("koop een linnen overhemd") of kijk in de catalogus.');
    }
    if (/wat heb ik nodig|wat raad je (me )?aan|voorspel|wat mis ik|denk met me mee/i.test(q)) {
      return klaar(voorspel(sess.key, sess));
    }
    return null;
  }

  return { butlerExtra, voerReisUit, voerKledingUit };
};
