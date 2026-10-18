/* ============================================================================
   DE WERELD VAN EEN VOLTOOIPROEF -- een wegwerpserver die je mag herstarten,
   laten crashen en daarna in de opslag mag nakijken.

   Wat dit toevoegt boven scripts/lib/wegwerpserver.js is precies wat bewijs 5
   (persistent) en bewijs 7 (herstelbaar) uit BETROUWBAARHEID.md nodig hebben en
   een ketenproef niet heeft (scripts/lib/appcontract.js, kop):

     herstart()   een NETTE stop (SIGTERM, wachten tot het proces weg is) en
                  dezelfde datamap opnieuw starten. Dat is een deploy.
     crash()      SIGKILL en opnieuw starten. Dat is een stroomstoring: de server
                  krijgt geen kans iets weg te schrijven. Die twee zijn met opzet
                  twee functies -- wie een garantie over herstarts met een
                  stroomstoring toetst (of andersom) slaagt om de verkeerde reden
                  (zie de kop van stopNetjes in test/helper.js).
     opslag()     een tabel lezen UIT HET BESTAND, met een eigen verbinding die
                  alleen leest. Niet via een route: "na de herstart geeft de route
                  het juiste antwoord" en "het staat op schijf" zijn twee
                  beweringen, en een cache kan de eerste waar maken terwijl de
                  tweede vals is.
     berichten()  de postvanger uitlezen (./postvanger.js).

   DE TESTWERELD IS FAIL-CLOSED. Voordat er iets start, vraagt deze module aan de
   postvanger of er in DEZE omgeving post naar buiten kan; zo ja, dan weigert hij
   te meten met de reden. Een proef die "wij hebben u gemaild" afmaakt en daarbij
   echte post verstuurt, is een ongeluk en geen meting.
   ========================================================================== */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { start, gereedschapsomgeving } = require('./wegwerpserver');
const postvanger = require('./postvanger');

const WACHT_STOP_MS = 30000;

function wachtOpEinde(kind, ms) {
  if (kind.exitCode !== null || kind.signalCode !== null) return Promise.resolve(true);
  return new Promise((res) => {
    const t = setTimeout(() => res(false), ms);
    kind.once('exit', () => { clearTimeout(t); res(true); });
  });
}

async function maakWereld(naam, eigenEnv) {
  const datamap = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-voltooi-' + naam + '-'));
  const env = Object.assign({ NODE_ENV: 'test' }, eigenEnv || {}, postvanger.omgeving());
  /* Dezelfde omgeving die het kind krijgt, en dezelfde waaromNiet() die de
     server leest: de vraag "kan hier post naar buiten" heeft een antwoord. */
  postvanger.eis(gereedschapsomgeving({ poort: 0, datamap }, env));
  let srv = await start({ naam: 'voltooi-' + naam, datamap, env, gereed: 'ready' });
  const herstarts = { netjes: 0, crash: 0 };

  /* `koppen`: extra kopregels, zoals het bezitsbewijs van een gebonden toestel. */
  async function post(pad, lijf, tok, koppen) {
    const h = Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}, koppen || {});
    let r;
    try { r = await fetch(srv.basis + pad, { method: 'POST', headers: h, body: JSON.stringify(lijf || {}) }); }
    catch (e) { return { status: 0, data: null, fout: String(e && e.message || e) }; }
    return { status: r.status, data: await r.json().catch(() => null) };
  }

  /* Een verzoek dat de client halverwege opgeeft. Het lijf is verstuurd; het
     antwoord wordt niet afgewacht. Wat de server ermee deed, is precies wat de
     proef daarna moet uitzoeken -- het kan beide zijn. */
  async function afgebroken(pad, lijf, tok, kop) {
    const ac = new AbortController();
    const h = Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}, kop || {});
    const belofte = fetch(srv.basis + pad, { method: 'POST', headers: h, body: JSON.stringify(lijf || {}), signal: ac.signal })
      .then((r) => ({ status: r.status }), (e) => ({ status: 0, afgebroken: /abort/i.test(String(e && e.name || e)) }));
    setTimeout(() => ac.abort(), 2);
    const uit = await belofte;
    /* Geef de server even de tijd om af te maken wat hij eventueel begon,
       zodat de volgende stap niet met een half verzoek racet. */
    await new Promise((r) => setTimeout(r, 300));
    return uit;
  }

  /* EEN DUBBELTIK: hetzelfde verzoek twee keer TEGELIJK, zoals een tweede tik
     op een trage verbinding aankomt terwijl de eerste nog loopt. Achter elkaar
     sturen is een andere (mildere) proef: dan is de eerste al klaar. */
  async function dubbel(pad, lijf, tok, koppen) {
    return Promise.all([post(pad, lijf, tok, koppen), post(pad, lijf, tok, koppen)]);
  }

  async function opnieuw() {
    srv = await start({ naam: 'voltooi-' + naam, datamap, env, gereed: 'ready' });
  }

  async function herstart() {
    srv.kind.kill('SIGTERM');
    const weg = await wachtOpEinde(srv.kind, WACHT_STOP_MS);
    if (!weg) {
      srv.kind.kill('SIGKILL');
      await wachtOpEinde(srv.kind, 5000);
      throw new Error('de server stopte niet binnen ' + (WACHT_STOP_MS / 1000) + ' s na SIGTERM; een nette herstart is dan niet te meten');
    }
    herstarts.netjes++;
    await opnieuw();
  }

  async function crash() {
    srv.kind.kill('SIGKILL');
    await wachtOpEinde(srv.kind, 5000);
    herstarts.crash++;
    await opnieuw();
  }

  /* Een tabel lezen uit het bestand zelf. node:sqlite met readOnly, zodat de
     meting niets kan schrijven in de wereld die hij meet. */
  function opslag(bestand, sql, ...args) {
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(path.join(datamap, bestand), { readOnly: true });
    try { return db.prepare(sql).all(...args); } finally { db.close(); }
  }

  /* Een collectie uit de kv-opslag (server/db/sqlite.js), ontsleuteld met
     dezelfde kluis als de server. null als hij er niet staat. */
  function collectie(naamCollectie) {
    const rij = opslag('store.db', 'SELECT val FROM kv WHERE key = ? AND deleted = 0', naamCollectie)[0];
    if (!rij) return null;
    return JSON.parse(require('../../server/kluis').ontsleutel(rij.val));
  }

  /* WAAR STAAT DIT MERKTEKEN OP SCHIJF? Een scenario dat zijn uitkomst met een
     uniek merkteken maakt (een reisnaam, een notitie), kan zonder de
     opslagvorm van elk domein te kennen nagaan dat het ERGENS in de opslag
     staat -- en, net zo belangrijk, dat het na een verwijdering NERGENS meer
     staat. Gelezen uit de bestanden zelf, readOnly, met dezelfde kluis als de
     server (zonder RTG_ENC_KEY is dat een doorgeefluik). Elke rij van elke
     tabel in elk .db-bestand van de datamap; bij de kv-opslag de sleutel erbij,
     zodat de uitslag zegt WELKE collectie het draagt. Een kluis- of
     auditspoor telt mee als vindplaats: dat het daar staat is waar, en een
     scenario dat "weg" bewijst, moet zelf zeggen welke vindplaats het bedoelt. */
  function vindInOpslag(merk) {
    const { DatabaseSync } = require('node:sqlite');
    const kluis = require('../../server/kluis');
    const uit = [];
    for (const bestand of fs.readdirSync(datamap).filter((f) => f.endsWith('.db')).sort()) {
      const db = new DatabaseSync(path.join(datamap, bestand), { readOnly: true });
      try {
        const tabellen = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((t) => t.name);
        for (const tabel of tabellen) {
          for (const rij of db.prepare('SELECT * FROM "' + tabel.replace(/"/g, '') + '"').all()) {
            if (bestand === 'store.db' && tabel === 'kv') {
              if (rij.deleted) continue;
              let val = rij.val;
              try { val = kluis.ontsleutel(val); } catch (e) { /* onleesbaar is niet gevonden */ }
              if (String(val).includes(merk)) uit.push({ bestand, tabel, sleutel: rij.key });
              continue;
            }
            const tekst = Object.values(rij).map((v) => {
              if (typeof v !== 'string') return String(v);
              try { return kluis.ontsleutel(v); } catch (e) { return v; }
            }).join('\u0000');
            if (tekst.includes(merk)) uit.push({ bestand, tabel });
          }
        }
      } finally { db.close(); }
    }
    return uit;
  }

  function klaar() {
    try { srv.kind.kill('SIGKILL'); } catch (e) { /* al weg */ }
    try { fs.rmSync(datamap, { recursive: true, force: true }); } catch (e) { /* al weg */ }
  }
  process.on('exit', klaar);

  return { post, dubbel, afgebroken, herstart, crash, opslag, collectie, vindInOpslag, klaar, datamap, herstarts,
    berichten: () => postvanger.berichten(datamap),
    get basis() { return srv.basis; } };
}

/* Een vers lid langs de echte registratie, met een eigen account (de
   sessiepagina en de postpagina eisen dat; een demo-persona heeft er geen). */
async function nieuwLid(w, merk) {
  const u = Date.now().toString().slice(-8) + Math.floor(Math.random() * 90 + 10);
  const email = (merk || 'vp') + u + '@voorbeeld.nl';
  const wachtwoord = 'geheim12345';
  const r = await w.post('/api/auth/register', { name: 'Voltooilid', email, phone: '06' + u.slice(0, 8),
    password: wachtwoord, geboortedatum: '1985-05-05', tier: 'rtg' });
  if (r.status !== 200 || !r.data || !r.data.token) throw new Error('registratie lukte niet (' + r.status + ')');
  return { token: r.data.token, email, wachtwoord };
}

async function inloggen(w, lid) {
  const r = await w.post('/api/auth/login', { login: lid.email, password: lid.wachtwoord });
  if (r.status !== 200 || !r.data || !r.data.token) throw new Error('inloggen lukte niet (' + r.status + ')');
  return r.data.token;
}

/* DE KANTOORWERELD: een wegwerpserver waarin een HERLEIDBAAR mens van RTG kan
   beslissen. Een Lifestyle- of Business Pass ontstaat uitsluitend na menselijke
   goedkeuring (kern/aanmeldingen/besluit.js), en de gedeelde kantoorcode is geen
   mens -- die weigert het besluit terecht. De testomgeving (NODE_ENV=test met
   RTG_DEMO=1, server/testomgeving.js) maakt bij de opstart het
   eigenaarsaccount aan; met DIE inlog beslist de proef, precies zoals
   scripts/toelatingsproef.js. Geen nieuwe deur en geen vlag in de poort: in
   productie weigert de configuratie RTG_DEMO (server/config/productie-lokaal.js),
   en de sleutel hieronder gaat alleen naar deze wegwerpserver. */
const EIGENAAR = { email: process.env.RTG_OWNER_EMAIL || 'roellie.i@gmail.com',
  wachtwoord: process.env.DEMO_PASS || 'Imran' };
const KANTOORWERELD = { RTG_DEMO: '1', RTG_OWNER_BOOTSTRAP: 'proefsleutel-voltooiwereld-2026',
  OFFICE_CODE: 'RTG-VOLTOOI-KANTOOR' };

async function eigenaarSessie(w) {
  const r = await w.post('/api/auth/login', { login: EIGENAAR.email, password: EIGENAAR.wachtwoord });
  if (r.status !== 200 || !r.data || !r.data.token) {
    throw new Error('geen eigenaarssessie (status ' + r.status + ') -- draait het scenario in de kantoorwereld (omgeving: KANTOORWERELD)?');
  }
  return r.data.token;
}

/* Een lid met een Lifestyle Pass, langs de ENIGE weg die die pas geeft: een
   vers RTG-lid vraagt hem aan, en een herleidbaar mens van het kantoor
   accepteert met een afgesproken contractbedrag. Daarna logt het lid opnieuw in
   (de pas hoort bij de nieuwe sessie). Lukt een stap niet, dan gooit dit met de
   stap erbij: een scenario dat op een Lifestyle-lid bouwt, mag niet stil met een
   RTG-lid verder. */
async function lifestyleLid(w, merk) {
  const lid = await nieuwLid(w, merk);
  const a = await w.post('/api/aanmelding/aanvraag', { pas: 'lifestyle', naam: 'Voltooilid ' + merk,
    contact: lid.email, viaUitnodiging: true }, lid.token);
  const id = a.data && a.data.aanmelding && a.data.aanmelding.id;
  if (a.status !== 200 || !id) throw new Error('de Lifestyle-aanvraag lukte niet (' + a.status + ')');
  const K = await eigenaarSessie(w);
  const b = await w.post('/api/aanmelding/beslis', { id, besluit: 'geaccepteerd', contractEuro: 20000 }, K);
  if (b.status !== 200) throw new Error('het kantoor kon de Lifestyle Pass niet toekennen (' + b.status + ': ' + (b.data && b.data.error) + ')');
  lid.token = await inloggen(w, lid);
  lid.aanmelding = id;
  return lid;
}

module.exports = { maakWereld, nieuwLid, inloggen, eigenaarSessie, lifestyleLid, KANTOORWERELD };
