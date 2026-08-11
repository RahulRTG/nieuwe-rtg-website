/* Magnaat: DE RISICO'S -- wat er mis kan gaan, en waarom bij jou vaker dan bij hem.

   ACHT RISICO'S, EN ELK HANGT AAN IETS WAT DE SPELER ZELF BEWEEGT. Dat is
   dezelfde toets als bij de kredietvormen: een risico dat alleen een andere kans
   is, staat er niet in. Wie zijn pand laat verslonzen brandt vaker; wie zijn
   zaak ramvol laat lopen heeft vaker een ongeluk; wie groot en zichtbaar is
   wordt vaker aangesproken.

   HET TOEVAL IS DETERMINISTISCH, en dat is de zwaarste eis van deze hele laag.
   GAMEHALL.md 12.4 zegt dat de klok BIJREKENT: tien maanden in een keer moeten
   hetzelfde geven als tien maanden los. Een `Math.random()` per maand zou dat
   breken -- dan hangt het af van je pollgedrag of je bedrijf afbrandt, en dan is
   een verzekering een weddenschap op de refreshknop.

   In plaats daarvan wordt er GETROKKEN UIT EEN HASH van (partij, maand,
   vestiging, risico). Dezelfde maand geeft altijd dezelfde uitkomst, hoe vaak
   je hem ook uitrekent, en toch is hij per bedrijf en per maand anders. Dezelfde
   truc als `spreiding()` in ./kaart.js, en om dezelfde reden.

   WAT DAT KOST, eerlijk: het toeval is in principe VOORSPELBAAR voor wie de
   formule kent en de staat kan lezen. Dat is hier acceptabel omdat de staat op
   de server staat en een speler hem niet ziet -- maar het is geen geheim dat
   veilig blijft als de wereld ooit open gaat. Staat dat ooit op het spel, dan
   hoort er een partijgeheim bij de seed. */
const { SECTOREN } = require('./sectoren');

const klem = (n, a, b) => Math.max(a, Math.min(b, n));

/* Een stabiele trekking uit een tekst: altijd hetzelfde getal in [0,1) voor
   dezelfde invoer, en toch onherkenbaar verdeeld. */
function trek(tekst) {
  let h = 2166136261;
  for (let i = 0; i < tekst.length; i++) { h ^= tekst.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 100000) / 100000;
}

/* WAT EEN RISICO RAAKT. Drie soorten schade, en het verschil is niet cosmetisch:
     pand   -- een deel van de bouwsom moet opnieuw. Kost geld EN zet de staat
               van het pand terug, dus het werkt door in kwaliteit en reputatie.
     omzet  -- je ligt stil. Kost een deel van een maandomzet en verder niets.
     claim  -- iemand spreekt je aan. Een bedrag, los van je pand en je omzet. */

const RISICOS = {
  brand: {
    naam: 'Brand', schade: 'pand', basis: 0.004, zwaarte: [0.15, 0.60],
    /* Verwaarlozing is hier de grootste knop, en dat is de bedoeling: onderhoud
       was tot nu toe een langzame kwaliteitsknop, en dit maakt er een risico
       van. Een pand op tien procent brandt vijf keer zo vaak als een pand op
       honderd. */
    weegt: (v) => 1 + (1 - v.onderhoud / 100) * 4,
    uitsluitbaar: true
  },
  storm: {
    naam: 'Storm', schade: 'pand', basis: 0.006, zwaarte: [0.04, 0.20],
    // seizoensgebonden: de winter doet dit, niet de zomer
    weegt: (v, ctx) => 1 + (ctx.winter ? 1.5 : -0.6),
    uitsluitbaar: false
  },
  machinebreuk: {
    naam: 'Machinebreuk', schade: 'omzet', basis: 0.010, zwaarte: [0.05, 0.30],
    // alleen waar machines staan, en verwaarlozing telt zwaar
    weegt: (v) => (['industrie', 'logistiek'].includes(v.sector) ? 1 : 0.15)
      * (1 + (1 - v.onderhoud / 100) * 3),
    uitsluitbaar: true
  },
  transport: {
    naam: 'Transportschade', schade: 'omzet', basis: 0.008, zwaarte: [0.03, 0.15],
    // wie veel goederen beweegt, beschadigt er meer
    weegt: (v) => 0.4 + ((SECTOREN[v.sector].koopt || {}).goederen || 0) * 2
      + ((SECTOREN[v.sector].koopt || {}).productie || 0) * 2,
    uitsluitbaar: false
  },
  cyber: {
    naam: 'Cyberincident', schade: 'omzet', basis: 0.007, zwaarte: [0.05, 0.35],
    // hoe meer je van reserveringen en kassa's leeft, hoe harder dit aankomt
    weegt: (v) => (['kantoor', 'retail', 'hotel'].includes(v.sector) ? 1.6 : 0.5),
    uitsluitbaar: false
  },
  aansprakelijkheid: {
    naam: 'Aansprakelijkheid', schade: 'claim', basis: 0.009, zwaarte: [0.02, 0.12],
    // hoe meer mensen er over de vloer komen, hoe vaker er iemand iets overkomt
    weegt: (v) => 0.5 + Math.min(2, v.omvang / 40),
    uitsluitbaar: false
  },
  personeel: {
    naam: 'Uitval van personeel', schade: 'omzet', basis: 0.012, zwaarte: [0.04, 0.18],
    /* Wie zijn mensen structureel op de toppen laat werken, ziet ze uitvallen.
       Hangt aan de BEZETTING van vorige maand -- precies het getal waarop
       kwaliteit ook al rust, want het is dezelfde overbelasting. */
    weegt: (v, ctx) => 0.4 + Math.max(0, (ctx.bezetting || 0) - 0.8) * 6,
    uitsluitbaar: false
  },
  bedrijfsschade: {
    naam: 'Bedrijfsschade', schade: 'omzet', basis: 0, zwaarte: [0.20, 0.50],
    /* GEEN EIGEN KANS: dit risico treedt alleen op ALS er iets anders aan je
       pand is gebeurd. Dat is precies wat bedrijfsschade in het echt is -- de
       gevolgschade van een brand, niet een eigen ongeluk. Zonder die koppeling
       zou het een achtste losse dobbelsteen zijn met een duur woord erop. */
    weegt: () => 0, volgtOp: ['brand', 'storm'], uitsluitbaar: false
  }
};
const RISICOLIJST = Object.keys(RISICOS);

/* De kans dat dit risico deze maand toeslaat bij deze vestiging. Begrensd, want
   een gewicht dat uit de hand loopt maakt een sector onspeelbaar in plaats van
   riskant. */
function kansOp(sleutel, v, ctx) {
  const r = RISICOS[sleutel];
  return klem(r.basis * r.weegt(v, ctx || {}), 0, 0.25);
}

/* Wat er deze maand gebeurt bij EEN vestiging. Geeft een lijst voorvallen terug
   -- meestal leeg. Volledig bepaald door (partij, maand, vestiging), dus tien
   maanden in een keer geeft dezelfde reeks als tien maanden los. */
function voorvallen(partijId, maand, v, ctx) {
  const uit = [];
  const geraakt = new Set();
  for (const sleutel of RISICOLIJST) {
    const r = RISICOS[sleutel];
    if (r.volgtOp) continue;
    const worp = trek(partijId + '|' + maand + '|' + v.id + '|' + sleutel);
    if (worp >= kansOp(sleutel, v, ctx)) continue;
    /* De ZWAARTE komt uit dezelfde worp, opgerekt over de band. Zo hoeft er geen
       tweede trekking bij en blijft het bij een getal per risico per maand. */
    const deel = r.zwaarte[0] + (worp / Math.max(1e-9, kansOp(sleutel, v, ctx))) * (r.zwaarte[1] - r.zwaarte[0]);
    uit.push({ risico: sleutel, naam: r.naam, soort: r.schade, deel: klem(deel, r.zwaarte[0], r.zwaarte[1]) });
    geraakt.add(sleutel);
  }
  // en de gevolgschade, die alleen bestaat als er iets aan het pand gebeurde
  for (const sleutel of RISICOLIJST) {
    const r = RISICOS[sleutel];
    if (!r.volgtOp || !r.volgtOp.some(x => geraakt.has(x))) continue;
    const worp = trek(partijId + '|' + maand + '|' + v.id + '|' + sleutel);
    uit.push({ risico: sleutel, naam: r.naam, soort: r.schade,
      deel: r.zwaarte[0] + worp * (r.zwaarte[1] - r.zwaarte[0]) });
  }
  return uit;
}

/* Wat een voorval KOST, in euro's. Pandschade rekent over de bouwsom, omzet- en
   claimschade over een maandomzet -- die laatste komt binnen, want de motor kent
   hem en dit bestand niet. */
function kosten(voorval, v, maandomzet) {
  if (voorval.soort === 'pand') return v.gebouwdVoor * voorval.deel;
  return Math.max(0, maandomzet) * voorval.deel;
}

/* Wat een risico gemiddeld per maand kost. De grondslag onder elke premie: een
   verzekeraar die minder vraagt dan dit, verliest geld -- en een spel waarin
   dat kan, is een spel waarin verzekeren gratis geld is. */
function verwachteSchade(sleutel, v, maandomzet, ctx) {
  const r = RISICOS[sleutel];
  if (r.volgtOp) {
    // gevolgschade: de kans van waar hij op volgt, maal zijn eigen zwaarte
    const kans = r.volgtOp.reduce((n, x) => n + kansOp(x, v, ctx), 0);
    return kans * ((r.zwaarte[0] + r.zwaarte[1]) / 2) * Math.max(0, maandomzet);
  }
  const midden = (r.zwaarte[0] + r.zwaarte[1]) / 2;
  const grondslag = r.schade === 'pand' ? v.gebouwdVoor : Math.max(0, maandomzet);
  return kansOp(sleutel, v, ctx) * midden * grondslag;
}

module.exports = { RISICOS, RISICOLIJST, kansOp, voorvallen, kosten, verwachteSchade, trek };
