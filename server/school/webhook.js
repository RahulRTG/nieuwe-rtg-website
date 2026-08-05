/* School (deelmodule): de webhook-BEZORGER. Tot deze ronde registreerde
   school/koppelingen.js abonnementen die niemand afleverde -- een lijst met
   beloftes (TAKEN.md 4.10). Dit bestand maakt ze waar.

   Vier keuzes die hier in zitten:

   1. EEN GEBEURTENIS MELDT DAT, NIET WAT. In het lijf zitten ids, een
      tijdstempel en hooguit een handvol niet-gevoelige velden -- geen namen,
      geen cijfers, geen zorg, geen incidentinhoud. Wie de inhoud nodig heeft,
      haalt hem daarna op via de API met zijn eigen recht en zijn eigen poort.
      Zo kan een webhook nooit een sluiproute om de rechtenmatrix heen worden.
   2. ELKE LEVERING IS ONDERTEKEND. `X-RTG-Handtekening` is een HMAC-SHA256 over
      het exacte lijf met het geheim dat bij registratie een keer is getoond.
      Zonder dat kan iedereen die het adres kent een schoolgebeurtenis verzinnen.
   3. NIETS SLAAT STIL OVER (LAT-regel 5). Mislukte bezorgingen worden geteld op
      de webhook zelf, met de laatste fout en het moment erbij, en ze schrijven
      een waarschuwing in het log -- die komt op het techniekbord terecht via de
      gewone foutaggregatie. Na tien mislukkingen op rij gaat de webhook op
      'stil': dan blijft een dood adres niet eeuwig verkeer trekken. Aanzetten
      doet de school zelf weer.
   4. DE SSRF-AFWEER GELDT OOK BIJ HET VERZENDEN, niet alleen bij registratie.
      Een adres kan tussentijds veranderen van betekenis (DNS), dus wordt het
      vlak voor de POST opnieuw gekeurd. Een interne collector is mogelijk met
      RTG_SCHOOL_WEBHOOK_INTERN=1, precies zoals bij de fout-melder. */
'use strict';
const https = require('https');
const http = require('http');
const { URL } = require('url');
const { veiligeWebhookUrl } = require('../kern/ssrf');
const { log } = require('../log');

const POGINGEN = 3;                 // een keer proberen, twee keer opnieuw
const WACHT = [250, 1500];          // oplopend, in ms
const STIL_NA = 10;                 // zoveel mislukkingen op rij en hij zwijgt

module.exports = (sctx) => {
  const { router, save, nu, crypto, poort } = sctx;
  const intern = () => String(process.env.RTG_SCHOOL_WEBHOOK_INTERN || '') === '1';

  function post(url, lijf, geheim, tijd) {
    return new Promise((klaar) => {
      const keur = veiligeWebhookUrl(url, { intern: intern() });
      if (!keur.ok) return klaar({ ok: false, fout: 'adres geweigerd: ' + keur.reden });
      let u;
      try { u = new URL(url); } catch (e) { return klaar({ ok: false, fout: 'geen geldige URL' }); }
      const handtekening = crypto.createHmac('sha256', String(geheim || '')).update(lijf).digest('hex');
      const mod = u.protocol === 'http:' ? http : https;
      const verzoek = mod.request({
        method: 'POST', hostname: u.hostname, port: u.port || (u.protocol === 'http:' ? 80 : 443),
        path: u.pathname + u.search,
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(lijf),
          'X-RTG-Handtekening': 'sha256=' + handtekening, 'User-Agent': 'RTG-School/1' },
        timeout: Math.min(15000, Number(tijd) || 5000)
      }, (res) => {
        res.resume(); // lijf weggooien, maar wel legen: anders blijft de socket hangen
        klaar(res.statusCode >= 200 && res.statusCode < 300
          ? { ok: true, status: res.statusCode }
          : { ok: false, status: res.statusCode, fout: 'HTTP ' + res.statusCode });
      });
      verzoek.on('timeout', () => { verzoek.destroy(new Error('tijd verstreken')); });
      verzoek.on('error', (e) => klaar({ ok: false, fout: (e && e.message) || 'verbinding mislukt' }));
      verzoek.end(lijf);
    });
  }

  const slaap = (ms) => new Promise(r => setTimeout(r, ms));

  /* Een levering met herhalingen. Geeft de UITKOMST terug (voor de proefknop);
     de gewone meldweg gooit die weg en wacht nergens op. */
  async function bezorg(sch, w, gebeurtenis, data) {
    const lijf = JSON.stringify({ gebeurtenis, school: sch.code, at: nu(), gegevens: data || {} });
    let uit = { ok: false, fout: 'niet geprobeerd' };
    for (let poging = 1; poging <= POGINGEN; poging++) {
      uit = await post(w.url, lijf, w.geheim);
      if (uit.ok) break;
      if (poging < POGINGEN) await slaap(WACHT[poging - 1]);
    }
    if (uit.ok) {
      w.mislukt = 0; w.laatsteFout = null; w.laatsteAt = nu(); w.geleverd = (w.geleverd || 0) + 1;
      if (w.status === 'geregistreerd') w.status = 'aan';
    } else {
      w.mislukt = (w.mislukt || 0) + 1;
      w.laatsteFout = String(uit.fout || 'onbekend').slice(0, 120);
      w.laatsteFoutAt = nu();
      if (w.mislukt >= STIL_NA) w.status = 'stil';
      log.warn('school-webhook mislukt', { school: sch.code, webhook: w.id, gebeurtenis,
        fout: w.laatsteFout, opRij: w.mislukt, stil: w.status === 'stil' });
    }
    save();
    return uit;
  }

  /* De meldweg voor de rest van de schoollaag: nooit awaiten, nooit een
     verzoek ophouden. Een webhook die traag is, mag een leraar niet laten
     wachten met het zetten van zijn presentielijst. */
  function meld(sch, gebeurtenis, data) {
    if (!sch || !Array.isArray(sch.webhooks)) return 0;
    const doel = sch.webhooks.filter(w => w.status !== 'uit' && w.status !== 'stil'
      && (w.gebeurtenissen || []).includes(gebeurtenis));
    for (const w of doel) bezorg(sch, w, gebeurtenis, data).catch(() => {});
    return doel.length;
  }
  sctx.meld = meld;

  /* De proefknop: dezelfde weg, maar dan wachten we wel en zeggen we precies
     wat eruit kwam. Zonder dit moet een beheerder raden of zijn adres klopt,
     en dat is precies hoe een webhook maanden stil kapot staat. */
  router.post('/school/webhook/proef', async (req, res) => {
    const g = poort(req, res, 'koppeling'); if (!g) return;
    const w = (g.sch.webhooks || []).find(x => x.id === String(req.body.webhookId || ''));
    if (!w) return res.status(404).json({ error: 'Die webhook kennen we niet.' });
    const uit = await bezorg(g.sch, w, 'proef', { proef: true });
    res.json({ ok: uit.ok, status: uit.status || null, fout: uit.fout || null,
      mislukt: w.mislukt || 0, stand: w.status,
      uitleg: uit.ok
        ? 'Afgeleverd en met een geldige handtekening ondertekend (X-RTG-Handtekening).'
        : 'Niet afgeleverd. De fout staat ook in het log en telt mee; na ' + STIL_NA + ' mislukkingen op rij valt de webhook stil.' });
  });

  // een stilgevallen webhook weer aanzetten (en de teller op nul)
  router.post('/school/webhook/wek', (req, res) => {
    const g = poort(req, res, 'koppeling'); if (!g) return;
    const w = (g.sch.webhooks || []).find(x => x.id === String(req.body.webhookId || ''));
    if (!w) return res.status(404).json({ error: 'Die webhook kennen we niet.' });
    w.status = 'aan'; w.mislukt = 0; w.laatsteFout = null;
    save();
    res.json({ ok: true, webhook: { id: w.id, status: w.status } });
  });

  return { meld, bezorg, STIL_NA };
};
