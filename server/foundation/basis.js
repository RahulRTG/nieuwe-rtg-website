/* RTFoundation-basis: de gedeelde primitieven van de foundation-laag, als een
   context-object voor de submodules (onderwijs, gezin, enz.). Hier wonen de
   versleuteling van gevoelige gezinsdata, de rate-limiting tegen code/pin-raden,
   de foutgeisoleerde router, de foundation-datawortel F() en de kleine helpers.
   Alles staat onder db.data.foundation, zodat het meelift op het atomische
   wegschrijven en de dagelijkse back-up van de hoofdserver. */
const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { db, save, DATA_DIR } = require('./../db');
const { eigenVeld } = require('./../kern/util'); // veilige objecttoegang (geen prototype-pollution)

module.exports = function maakBasis() {
  /* ---------- versleuteling van gevoelige gezinsdata ----------
     Locatie van kinderen, gezondheidsinfo (allergieen/medisch) en berichten liggen
     versleuteld op schijf (AES-256-GCM), zodat ze niet leesbaar zijn als het
     databasebestand ooit in verkeerde handen valt. De sleutel staat apart, buiten
     de database. Waarden krijgen een "enc:"-prefix; oude platte waarden blijven
     leesbaar (zachte migratie). */
  function laadSleutel() {
    const f = path.join(DATA_DIR, 'foundation.key');
    try { if (fs.existsSync(f)) return fs.readFileSync(f); } catch (e) {}
    const k = crypto.randomBytes(32);
    try { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(f, k, { mode: 0o600 }); } catch (e) {}
    return k;
  }
  const SLEUTEL = laadSleutel();
  function encS(text) {
    if (text == null || text === '') return text;
    try {
      const iv = crypto.randomBytes(12);
      const c = crypto.createCipheriv('aes-256-gcm', SLEUTEL, iv);
      const ct = Buffer.concat([c.update(String(text), 'utf8'), c.final()]);
      return 'enc:' + Buffer.concat([iv, c.getAuthTag(), ct]).toString('base64');
    } catch (e) { return text; }
  }
  function decS(blob) {
    if (typeof blob !== 'string' || !blob.startsWith('enc:')) return blob; // oude/onversleutelde waarde
    try {
      const buf = Buffer.from(blob.slice(4), 'base64');
      const d = crypto.createDecipheriv('aes-256-gcm', SLEUTEL, buf.subarray(0, 12));
      d.setAuthTag(buf.subarray(12, 28));
      return Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString('utf8');
    } catch (e) { return ''; }
  }

  /* ---------- rate-limiting: bescherming tegen het raden van gezinscodes en pincodes ---------- */
  const pogingen = new Map(); // bucket -> { n, until }
  const GEEN_LIMIET = process.env.NODE_ENV === 'test'; // in de testsuite delen alle gezinnen een IP; daar geen limiet
  function teVaak(res, bucket) {
    if (GEEN_LIMIET) return false;
    const f = pogingen.get(bucket);
    if (f && f.until > Date.now()) { res.status(429).json({ error: 'Te veel pogingen. Wacht een paar minuten en probeer het opnieuw.' }); return true; }
    return false;
  }
  function misluktePoging(bucket, max = 10, minuten = 5) {
    if (GEEN_LIMIET) return;
    const f = pogingen.get(bucket) || { n: 0, until: 0 };
    f.n += 1;
    if (f.n >= max) { f.until = Date.now() + minuten * 60000; f.n = 0; }
    pogingen.set(bucket, f);
  }
  function goedePoging(bucket) { pogingen.delete(bucket); }
  const ipVan = req => String((req.headers['x-forwarded-for'] || '').split(',')[0].trim() || (req.socket && req.socket.remoteAddress) || 'onbekend');

  let anthropic = null;
  if (process.env.ANTHROPIC_API_KEY) {
    try { anthropic = new (require('../anthropic'))({ apiKey: process.env.ANTHROPIC_API_KEY }); }
    catch (e) { /* zonder SDK: demo-antwoorden */ }
  }

  const router = express.Router();
  /* Zelfde foutisolatie als in server.js: de app-omhulling dekt alleen app.get/post,
     niet deze router. Een (async) fout in een handler wordt netjes next(err). */
  for (const metode of ['get', 'post', 'put', 'delete', 'patch', 'all']) {
    const orig = router[metode].bind(router);
    router[metode] = (...args) => orig(...args.map(f => {
      if (typeof f !== 'function') return f;
      return (req, res, next) => {
        try {
          const r = f(req, res, next);
          if (r && typeof r.catch === 'function') r.catch(next);
        } catch (e) { next(e); }
      };
    }));
  }
  router.use(express.json({ limit: '4mb' }));

  function F() {
    if (!db.data.foundation) db.data.foundation = { lessen: {} };
    if (!db.data.foundation.lessen) db.data.foundation.lessen = {};
    return db.data.foundation;
  }

  /* ---------- helpers ---------- */
  const nu = () => new Date().toISOString();
  const rid = (n = 3) => crypto.randomBytes(n).toString('hex');
  const schoon = (v, n = 200) => String(v == null ? '' : v).replace(/[<>]/g, '').slice(0, n).trim();
  // het alfabet voor les- en gezinscodes: zonder verwarrende tekens (I/L/O/0/1)
  const LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

  /* ---------- AI-bijles: de gedeelde toon, demo-antwoorden en dagtips ----------
     Gebruikt door de les-AI (onderwijs.js) en de gezins-buddy (foundation.js). */
  const SYSTEM = 'Je bent een warme, geduldige bijleshulp voor leerlingen van elke leeftijd in de gratis onderwijs-app van de RTFoundation. ' +
    'Help met begrijpen, niet met spieken: leg stap voor stap uit, geef een hint en een klein voorbeeld, ' +
    'en laat de leerling de laatste stap zelf zetten. Schrijf kort, bemoedigend en in helder Nederlands (max ~110 woorden). Nooit betuttelend, altijd hoopvol.';
  const DEMO = [
    'Goeie vraag! Zet eerst op een rij wat je al weet. Welke stap snap je nog niet? Dan pakken we die er samen uit. Knip het probleem in kleine stukjes, dat maakt het makkelijker.',
    'Denk eerst: wat wordt gevraagd, en wat heb je nodig? Schrijf de gegevens op. Probeer daarna een voorbeeld met kleine getallen; werkt je aanpak daar, dan werkt hij meestal ook groot.',
    'Lees de vraag rustig nog een keer en streep de belangrijke woorden aan. Leg in je eigen woorden uit wat je moet doen. Lukt dat, dan is de helft al klaar. Je kunt dit!'
  ];
  const TIPS = [
    'Neem elk uur 2 minuten pauze: opstaan, water drinken, even uit het raam kijken. Je onthoudt daarna beter.',
    'Leer in blokjes van 20 minuten. Eén blokje starten is veel makkelijker dan "alles" in één keer.',
    'Slaap is je geheime studietruc: uitgerust leer je sneller en beter.',
    'Fouten maken hoort erbij. Een fout laat precies zien wat je nog kunt leren, dat is goud waard.',
    'Vraag om hulp als je vastloopt. Dat is niet zwak, dat is slim. Je buddy staat altijd voor je klaar.',
    'Beweeg elke dag even, al is het maar een rondje lopen. Je hersenen werken beter na wat beweging.',
    'Zet je telefoon tijdens het leren in een andere kamer. Je concentreert je zo veel makkelijker.',
    'Vier je kleine successen. Een som af? Een bladzijde klaar? Dat mag je best even goed voelen.',
    'Adem rustig in door je neus en langzaam uit als je zenuwachtig bent. Drie keer helpt echt.',
    'Geld of spullen zeggen niets over hoe knap je bent. Doorzetten en oefenen brengen je verder dan wat dan ook.'
  ];

  /* Het sessietoken uit een aanvraag: eerst de Authorization-header (een token
     in een URL lekt via logs, proxies en de browsergeschiedenis), dan de body,
     en pas als laatste de query -- die blijft alleen voor de SSE-streams
     (EventSource kan geen headers sturen) en voor oudere, gecachte clients. */
  function tokenUit(req) {
    const h = ((req.get && req.get('authorization')) || '');
    return (h.startsWith('Bearer ') ? h.slice(7) : '') || (req.body && req.body.token) || req.query.token;
  }

  /* De context: alles wat de submodules delen. kiesBuddy/leeftijdInstr worden
     later door de gezinslaag op dit object gezet (aanroep gebeurt pas per
     aanvraag, dus die late binding is veilig). */
  return { db, save, DATA_DIR, eigenVeld, crypto,
    encS, decS, teVaak, misluktePoging, goedePoging, ipVan, anthropic, tokenUit,
    router, F, nu, rid, schoon, LETTERS, SYSTEM, DEMO, TIPS };
};
