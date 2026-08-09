/* De betaalopdrachten als RIJ: alles wat over de verzameling gaat in plaats van
   over één opdracht. Wat een opdracht is staat in ./index, het aanbieden bij de
   rail in ./inzending; hier staat wie er aan de beurt is, wat er nog openstaat,
   en de bevestiging van buiten.

   De snede zit op die grens en niet op een willekeurige regel: die kant weet hoe
   een betaling zich gedraagt, deze kant weet alleen dat het er meer dan een
   zijn. Krijgt de gedeelde ctx van ./index. */
'use strict';

module.exports = (ctx) => {
  const { rij, save, nu, STATUS, AF, OPEN, publiek, zet, klacht, ramMax } = ctx;
  // dienIn wordt door ./index pas NA dit bestand op de ctx gezet (de twee delen
  // kennen elkaar over en weer), dus lezen we hem per aanroep en niet hier
  const dienIn = (o) => ctx.dienIn(o);

  /* Een nieuwe opdracht in de rij zetten, en de rij op maat houden. Opruimen mag
     ALLEEN wat af is: de staart afknippen zonder te kijken is precies hoe boeking
     50.001 verdween (LAT.md regel 1), en hier zou het een openstaande betaling
     zijn die niemand meer indient. Blijven er te veel onafgeronde staan, dan is
     dat een storing en geen opslagprobleem -- dus klagen, niet wissen. */
  function plaats(o) {
    const r = rij();
    r.push(o);
    if (r.length > ramMax) {
      const teveel = r.length - ramMax;
      let weg = 0;
      for (let i = 0; i < r.length && weg < teveel; i++) { if (AF.has(r[i].status)) { r.splice(i, 1); i--; weg++; } }
      if (weg < teveel) klacht('de opdrachtenrij loopt vol met onafgeronde opdrachten', { open: r.length - weg, ram: ramMax });
    }
    save();
    return o;
  }

  /* De ronde: alles wat aan de beurt is opnieuw indienen. Draait niet over
     zichzelf heen (een tweede ronde tijdens een lopende doet niets), want twee
     rondes zouden dezelfde opdracht twee keer bij de rail aanbieden -- de
     idempotentiesleutel vangt dat op, maar erop leunen is geen ontwerp.

     Een opgegeven opdracht (MISLUKT) blijft liggen: die is al zes keer
     geprobeerd en het geld is terug. Hem weer oppakken is een besluit van het
     kantoor, geen werk van een tik. */
  let bezig = false;
  async function ronde({ tot } = {}) {
    if (bezig) return { ok: true, overgeslagen: true, reden: 'er loopt al een ronde' };
    bezig = true;
    const grens = Number.isFinite(tot) ? tot : nu();
    let gedaan = 0, gelukt = 0, opgegeven = 0;
    try {
      for (const o of rij().filter(x => !AF.has(x.status) && x.status !== STATUS.MISLUKT && (x.volgendeAt || 0) <= grens)) {
        const voor = o.status;
        await dienIn(o);
        gedaan++;
        if ((o.status === STATUS.INGEDIEND || o.status === STATUS.AFGEWIKKELD) && voor === STATUS.GEBOEKT) gelukt++;
        if (o.status === STATUS.MISLUKT || o.status === STATUS.TERUGGEBOEKT) opgegeven++;
      }
    } finally { bezig = false; }
    return { ok: true, gedaan, gelukt, opgegeven };
  }

  /* De bevestiging van buiten (de provider-webhook): pas hier gaat een opdracht
     van "aangenomen" naar "definitief". Nog niet aangesloten -- de webhook van
     server/betaal.js kent vandaag alleen inkomende betalingen; dat is TAKEN.md
     4.23. Tot die tijd blijft een ingediende opdracht ingediend, en dat is
     eerlijker dan hem bij inzending al afgewikkeld noemen. */
  function bevestig({ id, settlementRef, gelukt = true, reden }) {
    const o = vind(id);
    if (!o) return { status: 404, error: 'Die betaalopdracht bestaat niet.' };
    if (gelukt) { zet(o, STATUS.AFGEWIKKELD, { settlementRef: settlementRef || o.settlementRef }); save(); return publiek(o); }
    zet(o, STATUS.MISLUKT, { laatsteFout: String(reden || 'de rail meldde een mislukking').slice(0, 300), volgendeAt: null });
    save();
    return publiek(o);
  }

  /* De reconciliatie: wat staat er in het grootboek als "weg" terwijl de rail
     het nog niet heeft afgerond? Dat getal hoort bij een gezonde bank klein te
     zijn en vanzelf leeg te lopen. Loopt het op, dan is er iets met de rail --
     en dat is precies wat de sluitcontrole NIET kan zien, want een boeking naar
     extern:sepa sluit ook als er buiten RTG niets is gebeurd. */
  function openstaand() {
    const uit = { status: 200, aantal: 0, centen: 0, perStatus: {}, oudsteAt: null, mislukt: 0, mislukteCenten: 0, zonderTerugboeking: 0 };
    for (const o of rij()) {
      uit.perStatus[o.status] = (uit.perStatus[o.status] || 0) + 1;
      if (!OPEN.has(o.status)) continue;
      uit.aantal++; uit.centen += o.centen;
      if (uit.oudsteAt === null || o.at < uit.oudsteAt) uit.oudsteAt = o.at;
      if (o.status === STATUS.MISLUKT) { uit.mislukt++; uit.mislukteCenten += o.centen; if (o.terugboekFout) uit.zonderTerugboeking++; }
    }
    return uit;
  }

  function vind(id) { return rij().find(o => o.id === String(id || '')) || null; }
  function lijst({ limit = 50, status, ledgerRef, bron } = {}) {
    let r = rij().slice().reverse();
    if (status) r = r.filter(o => o.status === status);
    if (ledgerRef) r = r.filter(o => o.ledgerRef === ledgerRef);
    if (bron) r = r.filter(o => o.bron === bron);
    return { status: 200, aantal: r.length, opdrachten: r.slice(0, Math.min(500, Math.max(1, limit))).map(publiek) };
  }

  return { plaats, ronde, bevestig, openstaand, vind, lijst };
};
