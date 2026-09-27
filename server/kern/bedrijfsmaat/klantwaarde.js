/* KLANTWAARDE PER WERELD -- besluit C3 van de eigenaar (27 september 2026,
   AUTONOMIE.md par. 2.5).

   Een geslaagde uitkomst per wereld, en vier maten NAAST elkaar. Er is met opzet
   geen functie die ze optelt: een rit, een thuisgekomen reis, een loonrun en een
   afgeronde hulpvraag zijn geen eenheden van hetzelfde, en een totaal erover zou
   precies het samengestelde cijfer zijn dat INT-04 verbiedt. Elke maat heeft ook
   zijn eigen economische wereld (C1), dus de vier kunnen niet eens samen in een
   maat staan.

   Elke functie geeft { aantal, n }: `aantal` is wat er gebeurde, `n` is het aantal
   mensen, zaken of gezinnen waarover het ging -- dat is waar de groepspoort naar
   kijkt, want tien ritten van een lid zijn een lid.

   WAT HIER NIET STAAT: of de uitkomst GOED was. Een reis die thuis is, is een reis
   die plaatsvond; een afgeronde casus is een casus waar een hulpactie in staat.
   Tevredenheid is geen veld en wordt hier niet geraden. */
'use strict';

const inMaand = (x, m) => String(x || '').slice(0, 7) === m;
const lijst = (x) => (Array.isArray(x) ? x : []);

/* LivingOS: een rit die de keten afmaakte of een bestelling die bezorgd of
   opgehaald werd -- dezelfde uitkomsten als activatie. */
function living(ritten, bestellingen, m) {
  const wie = new Set(); let aantal = 0;
  for (const r of lijst(ritten)) if (r && ['afgerond', 'gearriveerd'].includes(r.status) && inMaand(r.finishedAt || r.at, m)) {
    aantal += 1; if (r.customerCodename) wie.add(r.customerCodename);
  }
  for (const o of lijst(bestellingen)) if (o && ['bezorgd', 'opgehaald'].includes(o.status) && inMaand(o.finishedAt || o.at, m)) {
    aantal += 1; if (o.customerCodename) wie.add(o.customerCodename);
  }
  return { aantal, n: wie.size };
}

/* TravelOS: een reis die thuis is (kern/reisbureau-thuis.js), in de maand van
   thuiskomst. */
function travel(aanvragen, m) {
  const wie = new Set(); let aantal = 0;
  for (const a of lijst(aanvragen)) if (a && a.status === 'thuis' && a.thuis && inMaand(a.thuis.at, m)) {
    aantal += 1; if (a.customerKey) wie.add(a.customerKey);
  }
  return { aantal, n: wie.size };
}

/* WorkOS: een loonrun die definitief werd (kern/payroll/run.js). De groep is
   het aantal ZAKEN, niet het aantal medewerkers op de strook. */
function work(runs, m) {
  const zaken = new Set(); let aantal = 0;
  for (const r of lijst(runs)) if (r && r.stand === 'definitief' && inMaand(r.definitiefOp, m)) {
    aantal += 1; if (r.code) zaken.add(r.code);
  }
  return { aantal, n: zaken.size };
}

/* FoundationOS: een hulpvraag afgerond (kern/rtfos/casus-keten.js), op de dag van
   afronden -- ook als hij daarna in nazorg ging. Een casus is een hulpvraag van een
   gezin; de groep is het aantal casussen. */
function foundation(casussen, m) {
  let aantal = 0;
  for (const c of lijst(casussen)) if (c && inMaand(c.afgerondOp, m)) aantal += 1;
  return { aantal, n: aantal };
}

module.exports = { living, travel, work, foundation };
