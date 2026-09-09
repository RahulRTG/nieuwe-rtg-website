/* Test-only voorlaadhaakje voor de geheugenmeting van De Beproeving.

   De harnas (scripts/beproeving.js) start de server met node -r scripts/gc-hook.js
   en --expose-gc. Krijgt het proces SIGUSR2, dan draait het een volledige GC en
   schrijft het daarna het LEVENDE geheugen (heapUsed) naar het bestand in
   RTG_GC_OUT. Dat is de eerlijke lek-maat: RSS overschat het levende geheugen
   want V8 geeft vrijgekomen pagina's niet meteen terug aan de OS, ook niet na een
   volledige GC. heapUsed na een major GC = werkelijk bereikbare objecten.

   ER STAAT NOG EEN TWEEDE METER IN: DE EVENT-LOOP VAN DE SERVER ZELF.
   Een belastingharnas dat van buiten kijkt kan niet zien WIE de rem is. Zakt de
   doorvoer in, dan kan dat de server zijn (loop vol, hij komt er niet doorheen)
   of de client (te veel sockets, hij krijgt de verzoeken niet meer weg). Van
   buiten zien die twee er identiek uit -- en scripts/tot-crash.js heeft daar
   uren op zitten liegen: hij bleef "ronde gehaald" melden voor rondes waarin hij
   acht verzoeken had gedaan. De enige meting die het onderscheid maakt komt uit
   het serverproces zelf: hoe lang stond zijn event-loop stil. Die telt hier mee
   en gaat bij elke dump mee naar buiten, waarna de teller weer op nul gaat --
   zo is elke waarde de PIEK SINDS DE VORIGE DUMP, en niet sinds het opstarten.

   Dit raakt de productieserver niet: het zit in de test-preload, niet in de
   servercode, en doet niets zonder RTG_GC_OUT + --expose-gc. */
const fs = require('fs');

/* De loop-meter. Een timer die elke TIK ms hoort te vuren; alles wat hij LATER
   vuurt dan dat is tijd waarin de loop bezet was. We houden de piek bij, niet
   het gemiddelde: een server die 99% van de tijd vlot is en periodiek twee
   seconden stilstaat, is stuk, en dat middelt weg. */
const TIK = 100;
let lusPiek = 0;
let vorig = process.hrtime.bigint();
const meter = setInterval(() => {
  const nu = process.hrtime.bigint();
  const laat = Number(nu - vorig) / 1e6 - TIK;
  if (laat > lusPiek) lusPiek = laat;
  vorig = nu;
}, TIK);
if (meter.unref) meter.unref(); // nooit een reden om het proces open te houden

/* HET IJKLEK -- ALLEEN OM DE METER TE CONTROLEREN.

   Een geheugenmeter die je nooit hebt zien AANSLAAN, meet niets: hij zegt
   "stabiel" over een server die lekt en over een server die dat niet doet, en
   die twee zien er dan identiek uit. Met RTG_LEK_MBMIN houdt dit proces bewust
   een bekend tempo aan geheugen vast, en scripts/heapproef.js MOET dat lek dan
   vinden -- vindt hij het niet, dan eindigt hij met een foutcode.

   Dit is een test-preload en geen servercode: zonder de omgevingsvariabele
   gebeurt er niets, en de variabele wordt alleen gezet door de ijkronde. De
   DE BROKKEN ZIJN JS-ARRAYS EN GEEN BUFFERS, en dat is geen smaak. Deze meter
   leest `heapUsed`, en de opslag van een Buffer ligt BUITEN de V8-heap: 50 MB
   aan Buffers bewoog heapUsed hier met 1 MB. Een ijklek van Buffers zou dus
   onzichtbaar zijn en de meter ten onrechte blind verklaren. Een array van
   131072 doubles is ongeveer 1 MB en staat wel in de heap (gemeten: 50 stuks
   gaven +50 MB). Ze blijven in `vast` staan, dus een major GC kan ze niet
   opruimen -- precies wat een echt lek doet. */
const lekTempo = Number(process.env.RTG_LEK_MBMIN || 0);
if (lekTempo > 0) {
  const vast = [];
  global.__rtgIjkLek = vast;                     // ook een harde verwijzing buiten de closure
  const perTik = Math.max(1, Math.round(lekTempo / 12));   // twaalf tikken per minuut
  const lek = setInterval(() => {
    for (let i = 0; i < perTik; i++) {
      const a = new Array(131072).fill(1.5);     // doubles: ~1 MB, en in de heap
      a[0] = vast.length;                        // aanraken, anders mag V8 hem uitstellen
      vast.push(a);
    }
  }, 5000);
  if (lek.unref) lek.unref();
}

process.on('SIGUSR2', () => {
  try {
    if (global.gc) { global.gc(); global.gc(); }
    const m = process.memoryUsage();
    const lus = Math.max(0, Math.round(lusPiek));
    lusPiek = 0; vorig = process.hrtime.bigint(); // volgend venster begint schoon
    if (process.env.RTG_GC_OUT) fs.writeFileSync(process.env.RTG_GC_OUT, JSON.stringify({ heapUsed: m.heapUsed, rss: m.rss, lusMs: lus, t: Date.now() }));
  } catch (e) {}
});
