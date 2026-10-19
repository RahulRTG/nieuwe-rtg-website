'use strict';
/* WIE GELD VAN HET LID VERPLAATST, VRAAGT EEN BEZITSBEWIJS (opdracht van de
   integrator, 19 oktober 2026, keuze (a) na de audit van de geldroutes).

   De audit vond een twintigtal ledenroutes die de eigen wallet van het lid
   belasten en buiten de zware paden vielen (server/kern/identiteit/
   bezitspaden.js): een gestolen token kon er betalen, kopen en verrekenen.
   Deze toets houdt de regel vast in twee delen.

   1. DE INVENTARIS. Elke route in server/routes waarvan de handler een van de
      BETAALWOORDEN hieronder aanroept, is zwaar -- of staat in UITZONDERINGEN
      met een reden. Een nieuwe route met een bekend betaalwoord komt er dus
      niet stil bij.
   2. DE UITZONDERINGEN ZIJN ECHT. Elke uitzondering bestaat nog als geldroute,
      en draagt een reden. Een uitzondering zonder route is een open deur in de
      lijst; een zonder reden is een gat.

   GRENS: de woordenlijst is gemeten, niet afgeleid. Een route die geld
   verplaatst via een kernfunctie met een nieuwe naam ziet deze toets niet; die
   naam hoort dan hier bij. Wat de toets wel garandeert: elke route die vandaag
   een van deze aanroepen doet, staat in de lijst of is met reden uitgezonderd. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const path = require('path');
const { zwaarPad } = require('../server/kern/identiteit/bezitsbewijs');
const { VOORWAARDELIJK } = require('../server/kern/identiteit/bezitspaden');

/* Gemeten op 19 oktober 2026 uit de kernaanroepen naar pay.boekAsync, pay.stuur,
   rekenAf, partnerIn en huisIn, terug naar de route die ze aanroept. */
const BETAALWOORDEN = /\b(betaalOrderVoor|betaalRekeningVoor|betaalRitVoor|betaalBoekingVoor|ovCheckUit|kaartKoop|aboKoop|pakketKoop|vonkBetaal|reisbetaling\.betaal|geld\(\)\.koop|winkel\.koop|gift\.bevestig|partnerIn|verzoekBetaal|tegoedKoop|tikBetaal|terugstorten|muntKoop|podiumCadeau|podiumAbonneer|podiumKaartje|podiumKoop|wbwVerreken|kasInt|kasVooraf|kasVastleg|budgetGeef|partnerUitbetaal|tegoedZaakKoop|naheffingBetaal|storingTeruggave|bankOverboek|bankNaarWallet|bankSepaUit|factuurSaldo|pay\.stuur|boekAsync)\b/;

/* De zaakkant is optie (b) en ligt bij de eigenaar: een zaakmedewerker heeft
   geen toestelbinding zoals het lid, dus eerst het besluit hoe hij er een krijgt.
   Tot dan staan ze hier, gemeld en niet afgedwongen. */
const ZAAK = 'zaakroute: hoe een zaakmedewerker een toestel bindt, is een eigenaarsbesluit (19 oktober 2026, optie (b)); tot dan gemeld en niet afgedwongen';
const UITZONDERINGEN = {
  '/api/festival/verkoop/rond': ZAAK,
  '/api/supplier/pay/budget': ZAAK,
  '/api/supplier/pay/tegoed/zet': ZAAK,
  '/api/supplier/pay/in': ZAAK,
  '/api/supplier/pay/vooraf': ZAAK,
  '/api/supplier/pay/vastleg': ZAAK,
  '/api/supplier/pay/uitbetaal': ZAAK,
  '/api/supplier/btw/naheffing/betaal': ZAAK,
  '/api/supplier/pos/checkout': ZAAK,
  '/api/supplier/refund': ZAAK,
  '/api/supplier/ticket/deurverkoop': ZAAK,
  '/api/supplier/mob/kaart/teruggave': ZAAK
};

function routesMetBetaalwoord() {
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.js') ? [path.join(d, e.name)] : []);
  const uit = new Map();
  for (const f of walk(path.join(__dirname, '..', 'server', 'routes'))) {
    const s = fs.readFileSync(f, 'utf8');
    const re = /app\.(post|put|delete|patch)\(\s*['"`]([^'"`]+)['"`]/g;
    const idx = []; let m;
    while ((m = re.exec(s))) idx.push({ pad: m[2], at: m.index });
    idx.forEach((r, i) => {
      const blok = s.slice(r.at, i + 1 < idx.length ? idx[i + 1].at : s.length);
      const w = blok.match(BETAALWOORDEN);
      if (w) uit.set(r.pad, path.relative(path.join(__dirname, '..'), f) + ' (' + w[1] + ')');
    });
  }
  return uit;
}

test('elke route die geld van het lid verplaatst, is zwaar of met reden uitgezonderd', () => {
  const routes = routesMetBetaalwoord();
  assert.ok(routes.size >= 30, 'de meting vond maar ' + routes.size + ' geldroutes; is de woordenlijst stuk?');
  const open = [...routes].filter(([pad]) => !zwaarPad(pad) && !UITZONDERINGEN[pad]).map(([pad, waar]) => pad + ' <- ' + waar);
  assert.deepEqual(open, [], 'geldroutes zonder bezitsbewijs:\n  ' + open.join('\n  '));
});

test('de uitzonderingen bestaan nog en dragen een reden', () => {
  const routes = routesMetBetaalwoord();
  for (const [pad, reden] of Object.entries(UITZONDERINGEN)) {
    assert.ok(routes.has(pad), pad + ' staat als uitzondering maar is geen geldroute (meer); haal hem weg');
    assert.ok(String(reden).length > 20, pad + ': een uitzondering zonder reden');
    assert.ok(!zwaarPad(pad), pad + ' is al zwaar; dan hoort hij hier niet');
  }
});

/* EEN "JA" OP EEN GELDVOORSTEL VAN RAHUL. /api/fluister is het gewone gesprek,
   en daar staat ook het stille codewoord (HDI.md, kern/veilig/codewoord.js):
   het hele pad zwaar maken zou een lid in nood op een toestelbewijs laten
   stranden. Daarom is /api/fluister VOORWAARDELIJK zwaar: alleen een ja op een
   openstaand voorstel dat geld verplaatst (tik, klompjes) vraagt het bewijs. */
test('een ja op een geldvoorstel van Rahul is voorwaardelijk zwaar, het gesprek zelf niet', () => {
  assert.ok(!zwaarPad('/api/fluister'), 'het gesprek met Rahul blijft licht: daar staat het stille codewoord');
  const v = (VOORWAARDELIJK || []).find(x => x.pad === '/api/fluister');
  assert.ok(v && v.reden && v.wanneer, '/api/fluister staat in VOORWAARDELIJK met reden en wanneer');
  const bron = fs.readFileSync(path.join(__dirname, '..', 'public', 'shared', 'toestelsleutel.js'), 'utf8');
  const m = bron.match(/var VOORWAARDELIJK = \[([\s\S]*?)\];/);
  assert.ok(m, 'de browser kent de voorwaardelijk zware paden, anders tekent hij de ja niet');
  assert.deepEqual(m[1].match(/'[^']+'/g).map(x => x.slice(1, -1)).sort(), VOORWAARDELIJK.map(x => x.pad).sort());
  // de browser tekent alleen een ja, en het is DEZELFDE ja als die van de server
  const ja = bron.match(/var JA = (\/.*\/i);/);
  assert.ok(ja, 'de browser kent het woord ja');
  assert.equal(ja[1], String(require('../server/kern/fluister/bevestig').JA), 'browser en server herkennen dezelfde ja');
});
