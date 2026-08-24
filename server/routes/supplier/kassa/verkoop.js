/* Kassa (deelmodule): de verkoop -- de losse kassaverkoop (contant, pin, RTG
   Pay of cadeaukaart, met keukenafboeking). Krijgt de gedeelde kern en de
   herhalingslaag van de hele kassa een keer bij het opstarten vanuit
   routes/supplier/kassa.js.

   Het INNEN op een RTG-ophaalcode stond hier ook en staat nu in ./innen.js:
   daar bestaat de bestelling al, hier ontstaat de bon op dat moment. Dit
   bestand kwam op 10,4 kB en daarmee over keuringsregel 13. */
module.exports = (kern, herhaling) => {
  const { POS_METHODS, app, crypto, db, facturatie, logActivity, pickupCode, save,
          sseToSupplier, supplierAuth, pay } = kern;
  // dezelfde factuurroutine als de app-kant; zie kern/lidacties/factuur.js
  const { maakFactuurVoorLid, regelsVanItems } = require('../../../kern/lidacties/factuur');
  const factuurVoorLid = maakFactuurVoorLid(facturatie);
/* DE HELE VERKOOP STAAT BINNEN eenmalig(), en niet alleen de betaling. De
   sleutel lag hier al jaren (kassa.html stuurt `idem` mee) maar ging alleen
   naar RTG Pay, en dan nog alleen bij method 'rtgpay'. Contant en pin kenden
   dus geen herhaling: twee keer versturen gaf twee bonnen, twee keer
   voorraadafboeking en twee facturen. Wie alleen het geld ontdubbelt houdt bij
   een herhaling nog steeds een tweede bon over zonder geld erachter, dus staat
   het hele verzoek erbinnen. Zie kern/kassa/herhaling.js voor wat een
   herhaling is: dezelfde sleutel, nooit hetzelfde bedrag. */
app.post('/api/supplier/pos/sale', supplierAuth, async (req, res) => {
 const antwoord = await herhaling.eenmalig('sale', req.supplier.code, req.body, async () => {
  let total = Number(req.body.total);
  if (!(total > 0) || total > 100000) return { status: 400, error: 'Geen geldig bedrag.' };
  const method = POS_METHODS.includes(req.body.method) ? req.body.method : 'contant';
  // op de tafel zetten kan alleen op een echte tafel; afrekenen komt later
  if (method === 'tafel' && !(req.supplier.tables || []).some(t => t.name === String(req.body.room || '')))
    return { status: 400, error: 'Kies een tafel om de bon op te zetten.' };
  let items = Array.isArray(req.body.items)
    ? req.body.items.slice(0, 40).map(i => ({ name: String(i.name || '').slice(0, 80), qty: Math.max(1, parseInt(i.qty, 10) || 1), price: Math.max(0, Number(i.price) || 0) }))
    : null;
  /* Luchtzijde: de zaak staat op de luchthaven (achter security). De kassa
     rekent dan de luchthavenprijs (normale prijs + toeslag) en de bon draagt
     BEIDE prijzen: elke regel houdt zijn prijsNormaal naast de luchtprijs. */
  let luchtzijde = null;
  const stz = req.supplier.settings || {};
  if (stz.luchtzijde) {
    const pct = Number.isFinite(Number(stz.luchtToeslagPct)) ? Math.max(0, Math.min(100, Math.round(Number(stz.luchtToeslagPct)))) : 15;
    const f = 1 + pct / 100;
    luchtzijde = { pct, totaalNormaal: Math.round(total * 100) / 100 };
    total = Math.round(total * f * 100) / 100;
    if (items) items = items.map(i => ({ ...i, prijsNormaal: i.price, price: Math.round(i.price * f * 100) / 100 }));
  }
  // RTG Pay: de gast toont de betaalcode uit de app; die wordt eerst geind
  // in het grootboek. Lukt dat niet, dan is er ook geen bon.
  let betaler = null, betaaldienstKosten = 0;
  if (method === 'rtgpay') {
    const p = await pay.kasInt({
      supplierCode: req.supplier.code, code: req.body.payCode,
      centen: Math.round(total * 100), oms: req.supplier.name,
      idem: req.body.idem
    });
    if (p.error) return { status: p.status || 400, error: p.error };
    betaler = p.van;
    // de kosten van de betaaldienst, per transactie DIRECT verrekend met de zaak
    betaaldienstKosten = p.kosten || 0;
  }
  /* Cadeaukaart: als bij RTG Pay eerst het GELD, dan pas de bon. Fail-closed:
     onbekende code of te weinig saldo geeft geen bon (TAKEN.md 4.27).

     DE FOUT GAAT TERUG ALS WAARDE EN NIET ALS res.json(), en dat verschil is
     hier niet cosmetisch. Deze twee regels stonden er al voor de herhalingslaag
     eromheen kwam (kern/kassa/herhaling.js), en die eist dat `werk` het
     ANTWOORD TERUGGEEFT -- alleen zo kan een herhaling exact hetzelfde antwoord
     krijgen. Wie hier res.json() doet, geeft de Express-`res` terug als
     antwoord, en dat object verwijst naar zichzelf (res.req.res...). De
     serialisatie eromheen liep daarop vast met "Maximum call stack size
     exceeded" -- geen enkele assertie zag het, alleen de strenge poort in
     test/helper.js. Beide kanten waren los goed en samen fout; precies het
     soort naad waar een automatische samenvoeging niets van merkt. */
  let gcKaart = null;
  if (method === 'cadeaukaart') {
    const gc = String(req.body.gcCode || '').trim().toUpperCase();
    gcKaart = (db.data.giftcards || []).find(x => x.code === gc && x.supplierCode === req.supplier.code);
    if (!gcKaart) return { status: 404, error: 'Deze cadeaukaart kennen we hier niet.' };
    if (gcKaart.saldo < total)
      return { status: 409, error: 'Onvoldoende saldo: er staat nog € ' + gcKaart.saldo + ' op deze kaart.' };
  }
  const sale = {
    id: crypto.randomBytes(4).toString('hex'),
    bon: pickupCode(),
    actor: req.actor.name,
    // welke kassa van de zaak dit was (de schermnaam, bv. "Kassa bar")
    kassa: req.body.kassa ? String(req.body.kassa).slice(0, 40) : null,
    // korting op de bon (al in het totaal verrekend), met de reden erbij
    korting: req.body.korting && Number(req.body.korting.bedrag) > 0
      ? { bedrag: Math.round(Number(req.body.korting.bedrag) * 100) / 100, reden: String(req.body.korting.reden || '').slice(0, 80) } : null,
    desc: String(req.body.desc || '').slice(0, 140),
    room: req.body.room ? String(req.body.room).slice(0, 60) : null,
    items, total, method, betaler, luchtzijde,
    betaaldienstKosten: betaaldienstKosten || null,
    /* EEN BON UIT DE OFFLINE-WACHTRIJ DRAAGT ZIJN EIGEN MOMENT, maar bepaalt er
       niets mee. `at` blijft de tijd van AANKOMST, want dat is de tijd die de
       server zelf heeft gezien; `offlineVanaf` is wat de kassa erover zegt.
       Andersom zou de client de datum van de omzet kunnen kiezen, en dat is
       precies de knop waarmee je een dagrapport verschuift. Alleen als sein,
       nooit als bron. */
    offlineVanaf: req.body.offlineVanaf ? String(req.body.offlineVanaf).slice(0, 30) : null,
    at: new Date().toISOString()
  };
  const list = db.data.posSales[req.supplier.code] = (db.data.posSales[req.supplier.code] || []);
  list.unshift(sale);
  db.data.posSales[req.supplier.code] = list.slice(0, 300);
  // saldo eraf met de bon erbij; `bron` scheidt hem van de handmatige afboeking
  if (gcKaart) {
    gcKaart.saldo = Math.round((gcKaart.saldo - total) * 100) / 100;
    gcKaart.verzilveringen = gcKaart.verzilveringen || [];
    gcKaart.verzilveringen.push({ bedrag: total, at: sale.at, actor: req.actor.name, bron: 'kassa', saleId: sale.id });
    sale.gcCode = gcKaart.code;
    sale.gcRest = gcKaart.saldo;
  }
  save();
  // het keukenbrein boekt de ingredienten van de bon af via de recepten
  try { kern.keuken.boekVerkoopAf(req.supplier, items || [], 'kassa (' + req.actor.name + ')'); } catch (e) {}
  logActivity(req.supplier.code, req.actor, 'rekende € ' + total + ' af (' + method + (sale.room ? ', ' + sale.room : '') + ')');
  sseToSupplier(req.supplier.code, 'sync', { scope: 'pos' });
  // automatische factuur voor beide partijen; de koper wordt gekoppeld als er een
  // RTG-codenaam bij de betaling zat, anders krijgt alleen de zaak de bon.
  const factuurRegels = items && items.length
    ? items.map(i => ({ omschrijving: i.name || 'Artikel', aantal: i.qty, stuk: i.price || (total / items.reduce((n, x) => n + x.qty, 0)) }))
    : [{ omschrijving: sale.desc || 'Verkoop', aantal: 1, stuk: total }];
  facturatie.boekMetCodenaam({
    soort: 'verkoop', verkoperCode: req.supplier.code, verkoperNaam: req.supplier.name,
    koper: { naam: req.body.codenaam || betaler || sale.room || 'Kasklant' }, regels: factuurRegels, methode: method, ref: sale.id
  }, req.body.codenaam || betaler).catch(() => {});
  return { ok: true, sale, betaler };
 });
 if (antwoord && antwoord.error) return res.status(antwoord.status || 400).json({ error: antwoord.error });
 res.json(antwoord);
});
};
