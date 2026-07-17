/* Test-only voorlaadhaakje voor de geheugenmeting van de chaos-soak.

   De harnas (scripts/mega65-storm.js) start de server met node -r scripts/gc-hook.js
   en --expose-gc. Krijgt het proces SIGUSR2, dan draait het een volledige GC en
   schrijft het daarna het LEVENDE geheugen (heapUsed) naar het bestand in
   RTG_GC_OUT. Dat is de eerlijke lek-maat: RSS overschat het levende geheugen
   want V8 geeft vrijgekomen pagina's niet meteen terug aan de OS, ook niet na een
   volledige GC. heapUsed na een major GC = werkelijk bereikbare objecten.

   Dit raakt de productieserver niet: het zit in de test-preload, niet in de
   servercode, en doet niets zonder RTG_GC_OUT + --expose-gc. */
const fs = require('fs');
process.on('SIGUSR2', () => {
  try {
    if (global.gc) { global.gc(); global.gc(); }
    const m = process.memoryUsage();
    if (process.env.RTG_GC_OUT) fs.writeFileSync(process.env.RTG_GC_OUT, JSON.stringify({ heapUsed: m.heapUsed, rss: m.rss, t: Date.now() }));
  } catch (e) {}
});
