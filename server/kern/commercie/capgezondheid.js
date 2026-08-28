/* HOE GAAT HET MET DIT ONDERDEEL? -- per capability, en niet per platform.

   DE FOUT DIE DIT VERVANGT. Een gewone healthcheck kent een antwoord: het huis
   doet het, of het huis doet het niet. Valt de uitbetaalrail om, dan staat er
   rood -- en dan is de vraag "kan de kassa nog draaien?" niet te beantwoorden,
   terwijl het antwoord gewoon ja is. Een restaurant op vrijdagavond wordt niet
   geholpen door een lampje dat over iets anders gaat.

   Dus: een stand PER CAPABILITY.

     GROEN         het werkt, en dat is gemeten
     AMBER         het hapert -- er gaat meer mis dan gewoonlijk
     ROOD          het werkt niet
     QUARANTAINE   het is bewust dicht gezet; alleen dit onderdeel

   QUARANTAINE RAAKT EEN CAPABILITY EN NOOIT HET HUIS. `mag()` neemt een
   capability en geeft alleen daarover antwoord; er is geen enkele functie die
   "alles" dicht kan zetten. Dat is met opzet structureel en niet als afspraak:
   payout in quarantaine terwijl kassa, orders en refunds doorlopen, is precies
   het verschil tussen een storing en een uitval.

   GROEN IS NIET "GEEN NIEUWS". Een capability waar niemand iets mee deed, is
   niet gezond -- hij is ONGEMETEN, en dat is een eigen stand. Dezelfde regel als
   bij ./schaduw.js (een regel die nooit iemand tegenhield is niet veilig, alleen
   onbewezen) en bij ./voorstel.js (een nul uit "niet gekeken" is geen bewijs).
   Wie dat samenvoegt, krijgt een bord dat na een stille nacht overal groen staat.

   AUTOMATISCHE QUARANTAINE BESTAAT, EN ZIJ IS LUIDRUCHTIG. Een onderdeel dat
   lang genoeg rood staat gaat vanzelf dicht -- doorgaan met een rail die alles
   weigert kost bij elke poging geld en vertrouwen. Maar hij komt er NOOIT vanzelf
   weer uit: dat is een mens, met een naam. Een systeem dat zichzelf dicht doet en
   zichzelf weer open doet, verbergt precies de storing die je had willen zien.

   WAT DIT NIET IS: een autorisatielaag. Deze module zegt niet of iemand IETS MAG
   maar of het onderdeel het DOET. Een gequarantainede capability is dicht voor
   iedereen, ook voor wie er volledig toe bevoegd is -- en andersom opent
   gezondheid nooit een deur die de bevoegdheid dicht houdt. */
'use strict';

const klok = require('../../lib/klok');

const STAND = { GROEN: 'GROEN', AMBER: 'AMBER', ROOD: 'ROOD',
  QUARANTAINE: 'QUARANTAINE', ONGEMETEN: 'ONGEMETEN' };

/* Het venster waarover geteld wordt, en de grenzen. Een venster van een uur:
   korter en een ochtendspits ziet eruit als een storing, langer en een storing
   van tien minuten verdwijnt in het gemiddelde. */
const VENSTER_MS = 3600000;
const MIN_METINGEN = 10;          // daaronder is het ruis en geen stand
const AMBER_DEEL = 0.10;          // meer dan een op de tien mis
const ROOD_DEEL = 0.50;           // meer mis dan goed
const QUARANTAINE_NA_MS = 900000; // een kwartier onafgebroken rood

function maakGezondheid({ db, save, nu }) {
  const tijd = nu || klok.nu;

  function alles() {
    if (!db.data) db.data = {};
    if (!db.data.capGezondheid || typeof db.data.capGezondheid !== 'object') db.data.capGezondheid = {};
    return db.data.capGezondheid;
  }

  function rij(cap) {
    const k = String(cap || '');
    const R = alles();
    if (!R[k]) R[k] = { cap: k, goed: 0, mis: 0, vensterAt: tijd(), roodSinds: null,
      quarantaine: null, laatsteFout: null, verloop: [] };
    /* Het venster rolt: bij de eerste meting na een uur beginnen de tellers
       opnieuw. Geen timer, want een timer in een kernmodule is een tweede
       levenscyclus die niemand aanzet of uitzet. */
    const r = R[k];
    if (tijd() - r.vensterAt >= VENSTER_MS) { r.goed = 0; r.mis = 0; r.vensterAt = tijd(); }
    return r;
  }

  /* MELDEN. De aanroeper zegt of het lukte; deze laag telt en rekent de stand.
     `fout` hoort erbij als het misging -- een teller zonder reden is een getal
     waar niemand iets mee kan. */
  function meld(cap, gelukt, fout) {
    const r = rij(cap);
    if (gelukt) r.goed += 1;
    else { r.mis += 1; if (fout) r.laatsteFout = String(fout).slice(0, 200); }

    const s = rekenStand(r);
    if (s === STAND.ROOD) { if (!r.roodSinds) r.roodSinds = tijd(); }
    else r.roodSinds = null;

    /* AUTOMATISCHE QUARANTAINE. Alleen na onafgebroken rood, en met de reden
       erbij. Eruit komen doet een mens. */
    if (!r.quarantaine && r.roodSinds && (tijd() - r.roodSinds) >= QUARANTAINE_NA_MS)
      zetQuarantaine(r, 'automatisch: ' + Math.round((tijd() - r.roodSinds) / 60000) +
        ' minuten onafgebroken rood' + (r.laatsteFout ? ' (' + r.laatsteFout + ')' : ''), null);

    save();
    return stand(cap);
  }

  function rekenStand(r) {
    const n = r.goed + r.mis;
    if (n < MIN_METINGEN) return STAND.ONGEMETEN;
    const deel = r.mis / n;
    if (deel >= ROOD_DEEL) return STAND.ROOD;
    if (deel >= AMBER_DEEL) return STAND.AMBER;
    return STAND.GROEN;
  }

  function zetQuarantaine(r, reden, door) {
    r.quarantaine = { reden: String(reden || '').slice(0, 300),
      door: door == null ? null : String(door).slice(0, 60), at: tijd() };
    r.verloop.unshift({ at: tijd(), wat: 'quarantaine', reden: r.quarantaine.reden, door: r.quarantaine.door });
    if (r.verloop.length > 40) r.verloop.length = 40;
  }

  /* DICHT ZETTEN met de hand. Vraagt een reden, want een onderdeel dat dicht
     staat zonder reden is een storing met een nette naam. */
  function quarantaine(cap, reden, door) {
    const t = String(reden || '').trim();
    if (t.length < 10) return { status: 400, error: 'Quarantaine vraagt een reden: wat is er aan de hand?' };
    const wie = String(door || '').slice(0, 60);
    if (!wie) return { status: 400, error: 'Wie zet dit onderdeel dicht?' };
    const r = rij(cap);
    zetQuarantaine(r, t, wie);
    save();
    return { status: 200, ok: true, ...stand(cap) };
  }

  /* VRIJGEVEN. Alleen met de hand, ook als het onderdeel er automatisch in
     kwam. Een systeem dat zichzelf dicht doet en zichzelf weer open doet,
     verbergt precies de storing die je had willen zien. */
  function geefVrij(cap, door) {
    const wie = String(door || '').slice(0, 60);
    if (!wie) return { status: 400, error: 'Wie geeft dit onderdeel vrij?' };
    const r = rij(cap);
    if (!r.quarantaine) return { status: 409, error: 'Dit onderdeel staat niet in quarantaine.' };
    r.verloop.unshift({ at: tijd(), wat: 'vrijgegeven', reden: null, door: wie });
    r.quarantaine = null;
    /* De tellers gaan mee opnieuw: de vorige storing is geen bewijs meer over
       wat er hierna gebeurt. Zonder dit zou een net vrijgegeven onderdeel
       meteen weer rood staan op oude metingen. */
    r.goed = 0; r.mis = 0; r.vensterAt = tijd(); r.roodSinds = null;
    save();
    return { status: 200, ok: true, ...stand(cap) };
  }

  /* DE VRAAG VAN DE AANROEPER, en zij gaat over EEN onderdeel. Er is geen
     variant die "alles" beantwoordt; zie de kop. */
  function mag(cap) {
    const r = rij(cap);
    if (r.quarantaine)
      return { door: false, stand: STAND.QUARANTAINE,
        error: 'Dit onderdeel staat tijdelijk uit: ' + r.quarantaine.reden,
        sinds: r.quarantaine.at };
    return { door: true, stand: rekenStand(r) };
  }

  function stand(cap) {
    const r = rij(cap);
    const n = r.goed + r.mis;
    return { cap: r.cap, stand: r.quarantaine ? STAND.QUARANTAINE : rekenStand(r),
      goed: r.goed, mis: r.mis, metingen: n, deelMis: n ? r.mis / n : null,
      roodSinds: r.roodSinds, quarantaine: r.quarantaine, laatsteFout: r.laatsteFout,
      verloop: r.verloop.slice(0, 5) };
  }

  function lijst() { return Object.keys(alles()).sort().map(stand); }

  /* De twee dingen die zichtbaar horen te blijven: wat er dicht staat, en wat
     er ONGEMETEN is. Dat tweede is geen storing maar het is ook geen groen, en
     een bord dat na een stille nacht overal groen staat, is een bord dat niets
     zegt. */
  function zorgen() {
    const L = lijst();
    return {
      dicht: L.filter(r => r.stand === STAND.QUARANTAINE)
        .map(r => ({ cap: r.cap, reden: r.quarantaine.reden, door: r.quarantaine.door, sinds: r.quarantaine.at })),
      hapert: L.filter(r => r.stand === STAND.AMBER || r.stand === STAND.ROOD)
        .map(r => ({ cap: r.cap, stand: r.stand, deelMis: r.deelMis, laatsteFout: r.laatsteFout })),
      ongemeten: L.filter(r => r.stand === STAND.ONGEMETEN).map(r => ({ cap: r.cap, metingen: r.metingen })),
      automatischDicht: L.filter(r => r.quarantaine && !r.quarantaine.door).map(r => r.cap)
    };
  }

  return { meld, mag, stand, lijst, quarantaine, geefVrij, zorgen, STAND };
}

module.exports = { maakGezondheid, STAND, VENSTER_MS, MIN_METINGEN, AMBER_DEEL, ROOD_DEEL, QUARANTAINE_NA_MS };
