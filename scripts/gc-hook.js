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

process.on('SIGUSR2', () => {
  try {
    if (global.gc) { global.gc(); global.gc(); }
    const m = process.memoryUsage();
    const lus = Math.max(0, Math.round(lusPiek));
    lusPiek = 0; vorig = process.hrtime.bigint(); // volgend venster begint schoon
    if (process.env.RTG_GC_OUT) fs.writeFileSync(process.env.RTG_GC_OUT, JSON.stringify({ heapUsed: m.heapUsed, rss: m.rss, lusMs: lus, t: Date.now() }));
  } catch (e) {}
});
