/* EEN NAGEMAAKTE STRIPE, ALLEEN VOOR TOETSEN -- en geen bewijs van iets in
   productie.

   Hij doet precies wat de partnerafrekening (server/betaal/connect/) aan
   Stripe vraagt: transfers maken en ophalen, payouts maken en ophalen (met de
   Stripe-Account-kop), en de Idempotency-Key eren zoals Stripe dat doet --
   dezelfde sleutel geeft het EERSTE antwoord terug, ook als dat een fout was.
   Daarbovenop knoppen om het mis te laten gaan: een storing NA het uitvoeren
   (het verzoek is gedaan, het antwoord gaat verloren), een definitieve weigering,
   een vertraging, en het achteraf veranderen van een payout of transfer zodat de
   reconciliatie iets te vinden heeft.

   WAT DIT NIET IS. Een nagemaakte provider bewijst dat onze code doet wat WIJ
   denken dat Stripe verwacht. Of Stripe het ook zo verwacht, bewijst alleen een
   echte sandbox (scripts/extern-bewijs-stripe-connect.js). */
'use strict';
const http = require('node:http');

function nepStripe() {
  const transfers = new Map(), payouts = new Map(), idem = new Map();
  const verzoeken = [];
  const knop = { faalNaUitvoeren: 0, weiger: null, vertraging: 0 };
  let n = 0;
  const lees = req => new Promise(r => { let b = ''; req.on('data', c => { b += c; }); req.on('end', () => r(b)); });
  const form = b => { const o = {}; for (const [k, v] of new URLSearchParams(b)) o[k] = v; return o; };

  const server = http.createServer(async (req, res) => {
    const body = form(await lees(req));
    const kop = { idem: req.headers['idempotency-key'] || null, account: req.headers['stripe-account'] || null };
    verzoeken.push({ methode: req.method, pad: req.url, body, ...kop });
    const stuur = (status, obj) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };
    if (knop.vertraging) await new Promise(r => setTimeout(r, knop.vertraging));
    if (req.method === 'POST' && kop.idem && idem.has(kop.idem)) {
      /* Ook de herhaling kan zijn antwoord kwijtraken; het werk blijft gedaan. */
      if (knop.faalNaUitvoeren > 0) { knop.faalNaUitvoeren -= 1; res.destroy(); return; }
      const v = idem.get(kop.idem); return stuur(v.status, v.obj);
    }
    const bewaar = (status, obj) => { if (kop.idem) idem.set(kop.idem, { status, obj }); return stuur(status, obj); };
    const doe = (maak) => {
      if (knop.weiger) { const w = knop.weiger; knop.weiger = null; return bewaar(w.status, { error: { message: w.bericht, type: 'invalid_request_error' } }); }
      const obj = maak();
      /* Uitgevoerd, maar het antwoord gaat verloren: zo ziet een time-out na het
         versturen eruit. NIET onder de idempotentiesleutel bewaard als fout --
         Stripe heeft het werk gedaan, en een herhaling krijgt het echte object. */
      if (knop.faalNaUitvoeren > 0) { knop.faalNaUitvoeren -= 1; if (kop.idem) idem.set(kop.idem, { status: 200, obj }); res.destroy(); return; }
      return bewaar(200, obj);
    };
    let m;
    if (req.method === 'POST' && req.url === '/v1/transfers') return doe(() => {
      const t = { id: 'tr_nep' + (++n), object: 'transfer', amount: Number(body.amount), currency: body.currency,
        destination: body.destination, transfer_group: body.transfer_group, reversed: false, amount_reversed: 0,
        metadata: { afrekening: body['metadata[afrekening]'] } };
      transfers.set(t.id, t); return t;
    });
    if (req.method === 'POST' && req.url === '/v1/payouts') {
      if (!kop.account) return stuur(400, { error: { message: 'geen verbonden account' } });
      return doe(() => {
        const p = { id: 'po_nep' + (++n), object: 'payout', amount: Number(body.amount), currency: body.currency,
          status: 'pending', account: kop.account, metadata: { afrekening: body['metadata[afrekening]'] } };
        payouts.set(p.id, p); return p;
      });
    }
    if (req.method === 'GET' && (m = req.url.match(/^\/v1\/transfers\/([^/?]+)$/))) {
      const t = transfers.get(decodeURIComponent(m[1])); return t ? stuur(200, t) : stuur(404, { error: { message: 'weg' } });
    }
    if (req.method === 'GET' && (m = req.url.match(/^\/v1\/payouts\/([^/?]+)$/))) {
      const p = payouts.get(decodeURIComponent(m[1]));
      if (!p || p.account !== kop.account) return stuur(404, { error: { message: 'weg' } });
      return stuur(200, p);
    }
    return stuur(404, { error: { message: 'onbekend pad ' + req.url } });
  });

  return {
    transfers, payouts, verzoeken, knop,
    start: () => new Promise(r => server.listen(0, '127.0.0.1', () => r('http://127.0.0.1:' + server.address().port))),
    stop: () => new Promise(r => server.close(() => r())),
    /* Een gebeurtenis zoals Stripe hem stuurt, over een payout of transfer. */
    gebeurtenis: (type, obj, account) => ({ id: 'evt_nep' + (++n), type, account: account || undefined,
      created: Math.floor(Date.now() / 1000), data: { object: obj } })
  };
}

module.exports = { nepStripe };
