/* DE INGESCHAKELD-AS: wat een mens voor DEZE omgeving heeft aangezet.

   WAAROM EEN EIGEN BESTAND EN NIET db.data. De werkkopie van db.data is per
   instantie een geheugenobject met een write-behind save(); een tweede instantie
   ziet een wijziging pas als zijn eigen kopie wordt ververst. Voor een noodknop
   is "pas als" geen antwoord. Deze stand staat daarom in een eigen bestand in de
   datamap, wordt atomair geschreven (tijdelijk bestand, fsync, rename, fsync van
   de map) en wordt bij IEDER oordeel opnieuw aangekeken: een stat van een
   bestand, en alleen bij een ander merk (grootte, tijd, inode) of na de TTL een
   nieuwe lezing.

   DE GRENS, uitgeschreven zodat niemand hem hoeft te raden:
     - op de instantie die schrijft: het volgende oordeel ziet het (de cache
       wordt bij het schrijven vervangen);
     - op een andere instantie op DEZELFDE datamap: het eerstvolgende oordeel,
       want de stat ziet een nieuwe inode (rename) -- en in het slechtste geval
       (een bestandssysteem dat het merk niet ververst) na TTL_MS;
     - deactiveren is NOOIT trager dan activeren: dezelfde weg, dezelfde TTL,
       en geen enkele cache die "aan" langer vasthoudt dan "uit".
   Draaien instanties op VERSCHILLENDE hosts zonder gedeelde datamap, dan is deze
   grens er niet; dan hoort er een `achterkant` met dezelfde twee functies in
   (lees/schrijf met versie) op de gedeelde database. Dat is een
   integratiepunt, geen stille aanname: zie VRIJGAVE in het eindverslag.

   WAT ER IN STAAT: per capability een stand met wie, wanneer, waarom en een
   versie; de vastgelegde externe besluiten (de autorisatie-as voor wat geen
   bevoegdheidsvermogen heeft); en een geschiedenis die alleen aangroeit.

   ONBEKEND IS EEN CONFIGURATIEFOUT, GEEN STAND. Een stand die niet in
   ./register.js STANDEN staat, of een bestand dat niet te lezen is, maakt het
   hele bestand ongeldig: dan geldt voor IEDERE capability dicht, met de reden
   `configuratiefout`. Een kapot bestand dat "voor de rest" gewoon gelezen werd,
   zou een half bestand laten gelden -- en welke helft dat is, beslist dan de
   parser.

   TERUGROLLEN. Iedere schrijfactie verhoogt `versie`. Een instantie onthoudt de
   hoogste versie die hij ooit zag; leest hij daarna een LAGERE, dan is het
   bestand teruggezet en geldt dicht (configuratiefout) tot een mens opnieuw
   schrijft. Over een herstart heen onthoudt dit geheugen niets -- daar
   beschermt de bewijsas (een teruggezette stand kan geen ontbrekend bewijs
   maken) en de geschiedenis (die laat zien wat er werkelijk is gezet). */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { vind } = require('./register');

const TTL_MS = 1000;
const SLOT_MS = 10000;
const SLAAP = new Int32Array(new SharedArrayBuffer(4));

function datamap(env = process.env) {
  return env.RTG_DATA_DIR || path.join(__dirname, '..', '..', 'data');
}

function leeg() { return { formaat: FORMAAT, versie: 0, standen: {}, besluiten: {}, geschiedenis: [] }; }

/* De vorm van het bestand nalopen, en welke velden er mogen staan:
   ./standkeur.js. */
const { FORMAAT, VELDEN, keur } = require('./standkeur');

function maakStand({ env = process.env, bestand, nu = () => Date.now() } = {}) {
  const pad = bestand || path.join(datamap(env), 'vrijgave-stand.json');
  let cache = null;            // { merk, op, staat|fout }
  let hoogsteVersie = 0;

  const merkVan = () => {
    try { const s = fs.statSync(pad); return [s.size, s.mtimeMs, s.ino].join(':'); }
    catch (e) { return e && e.code === 'ENOENT' ? 'geen' : 'stat-fout'; }
  };

  function leesVers() {
    const m = merkVan();
    if (m === 'geen') return { merk: m, staat: leeg() };
    if (m === 'stat-fout') return { merk: m, fout: 'standbestand niet te bekijken' };
    try {
      const staat = keur(JSON.parse(fs.readFileSync(pad, 'utf8')));
      if (staat.versie < hoogsteVersie)
        return { merk: m, fout: 'standbestand is teruggezet (versie ' + staat.versie + ' na ' + hoogsteVersie + ')' };
      hoogsteVersie = staat.versie;
      return { merk: m, staat };
    } catch (e) { return { merk: m, fout: String(e && e.message || e) }; }
  }

  /* De lezing voor een oordeel. Geeft { staat } of { fout }; nooit allebei. */
  function lees() {
    const m = merkVan();
    if (cache && cache.merk === m && nu() - cache.op < TTL_MS) return cache;
    const vers = leesVers();
    cache = Object.assign({ op: nu() }, vers);
    return cache;
  }

  function standVan(id) {
    const l = lees();
    if (l.fout) return { fout: l.fout };
    const c = vind(id);
    const s = l.staat.standen[id];
    if (!s) return { stand: c ? c.veiligeStand : 'disabled', standaard: true, versie: l.staat.versie };
    return { stand: s.stand, wie: s.wie, sinds: s.sinds, reden: s.reden, versie: l.staat.versie };
  }

  function besluit(id) {
    const l = lees();
    if (l.fout) return null;
    const b = l.staat.besluiten[id];
    return b && !b.ingetrokken ? b : null;
  }

  /* SCHRIJVEN: een slot (O_EXCL), de huidige versie lezen, de verwachte versie
     vergelijken, en atomair wegzetten. Twee mensen die tegelijk schakelen kunnen
     daardoor niet elkaars keuze ongezien overschrijven: de tweede krijgt een
     botsing en ziet wat de eerste deed. Een slot ouder dan SLOT_MS is van een
     gecrashte schrijver en wordt opgeruimd. */
  function muteer(verwachteVersie, werk) {
    fs.mkdirSync(path.dirname(pad), { recursive: true });
    const slot = pad + '.slot';
    let fd = null;
    for (let i = 0; i < 200 && fd === null; i++) {
      try { fd = fs.openSync(slot, 'wx'); }
      catch (e) {
        if (e.code !== 'EEXIST') throw e;
        try { if (nu() - fs.statSync(slot).mtimeMs > SLOT_MS) fs.unlinkSync(slot); } catch (x) { /* een ander ruimde al op */ }
        Atomics.wait(SLAAP, 0, 0, 5);   // vijf ms wachten op de andere schrijver, zonder de CPU te branden
      }
    }
    if (fd === null) return { ok: false, status: 409, reden: 'slot', error: 'Een andere schakeling is nog bezig; probeer het zo opnieuw.' };
    try {
      const vers = leesVers();
      /* Een kapot of teruggezet bestand mag een mens OVERSCHRIJVEN, maar alleen
         als hij dat uitdrukkelijk zegt (verwachteVersie 'herstel'); anders zou
         de eerste de beste schakeling een configuratiefout stil wegpoetsen. */
      if (vers.fout && verwachteVersie !== 'herstel')
        return { ok: false, status: 409, reden: 'configuratiefout', error: 'Het standbestand is ongeldig: ' + vers.fout };
      const staat = vers.fout ? leeg() : vers.staat;
      if (vers.fout) staat.versie = Math.max(hoogsteVersie, staat.versie);
      if (verwachteVersie !== undefined && verwachteVersie !== null && verwachteVersie !== 'herstel' &&
          Number(verwachteVersie) !== staat.versie)
        return { ok: false, status: 409, reden: 'botsing', versie: staat.versie,
          error: 'De stand is intussen veranderd (versie ' + staat.versie + '). Bekijk hem opnieuw voordat u schakelt.' };
      const uit = werk(staat);
      if (!uit || !uit.ok) return uit || { ok: false, status: 400, error: 'Geen wijziging.' };
      staat.versie += 1;
      const tmp = pad + '.' + process.pid + '.' + Date.now() + '.tmp';
      const bytes = JSON.stringify(staat, null, 1) + '\n';
      const tf = fs.openSync(tmp, 'w', 0o600);
      try { fs.writeSync(tf, bytes); fs.fsyncSync(tf); } finally { fs.closeSync(tf); }
      fs.renameSync(tmp, pad);
      try { const df = fs.openSync(path.dirname(pad), 'r'); try { fs.fsyncSync(df); } finally { fs.closeSync(df); } }
      catch (e) { /* niet elk platform staat fsync op een map toe; de rename is dan het beste wat er is */ }
      hoogsteVersie = staat.versie;
      cache = { merk: merkVan(), op: nu(), staat };
      return Object.assign({ versie: staat.versie }, uit);
    } finally {
      try { fs.closeSync(fd); } catch (e) { /* al dicht */ }
      try { fs.unlinkSync(slot); } catch (e) { /* al weg */ }
    }
  }

  return { lees, standVan, besluit, muteer, pad, TTL_MS };
}

module.exports = { maakStand, TTL_MS, FORMAAT, VELDEN, keur, leeg };
