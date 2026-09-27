/* WAT DE LEDENKANT EN DE ZAAKKANT VAN HET TEGOED DELEN
   (kern/pay/tegoed-gedeeld.js): de bon, de saga, de migratie en de uitgifte,
   een keer gebouwd op de ctx van kern/pay/index.js. ./tegoed.js en
   ./tegoed-zaak.js verschillen alleen in WIE betaalt en WIE terugkrijgt;
   alles daaronder is hier.

   HET BOEKEN UIT DE ESCROW gaat altijd via ../betaalopdracht/terugboeking.js
   met sleutelsoort `pay-tegoed`: in PostgreSQL en SQLite commit de sleutel
   samen met beide grootboekprojecties, in motorstand ontdubbelt de Rust-motor
   op dezelfde sleutel, en in productie zonder duurzame opslag weigert hij. */
'use strict';

const boekTerugEenmaal = require('../betaalopdracht/terugboeking');

module.exports = (ctx) => {
  const { crypto, save, nu, d, grootboek, boek, boekAsync, economischeBoekingEenmaal,
    geldModus, bewerkCollectie } = ctx;
  const bon = require('./tegoed-bon')({ d, save, crypto, nu, bewerkCollectie });
  const boekEenmaal = args => boekTerugEenmaal(Object.assign({ domein: 'pay', grootboek, boek,
    boekAsync, boekEenmaal: economischeBoekingEenmaal, geldModus, sleutelSoort: 'pay-tegoed' }, args));
  const claim = require('./tegoed-claim')({ bon, crypto, boekEenmaal });
  const migratie = require('./tegoed-migratie')({ d, save, bon, bewerkCollectie, grootboek, nu });
  const uitgifte = require('./tegoed-uitgifte')({ bon, crypto });

  /* Een NIEUWE bon landt binnen de metIdem-bundel van de koop, naast de
     boeking en de idem-sleutel: een commit, dus nooit geld op de escrow zonder
     bon of een bon zonder geld. Een nieuw id botst met niemand; elke volgende
     overgang van deze bon loopt door de collectietransactie. */
  function bewaarNieuw(t) {
    const k = d()[bon.COL];
    if (!k || typeof k !== 'object' || Array.isArray(k)) d()[bon.COL] = {};
    d()[bon.COL][t.id] = t;
    save();
  }

  /* Terugnemen (na de vervaldatum) en intrekken (ervoor) voor beide kanten. */
  async function terug({ vind, door, naar, intrekken, idem, saldo }) {
    await migratie.zorg();
    const soort = intrekken ? 'intrek' : 'terug';
    const r = await claim.neem({ vind, soort, door, naar, idem,
      mag: t => {
        if (t.status !== 'open') return { status: 409, error: 'Dit tegoed staat niet meer open.' };
        if (!intrekken && !bon.verlopen(t))
          return { status: 409, error: 'Dit tegoed loopt nog; terugnemen kan pas na de vervaldatum. Trek het in als de code niet meer mag werken.' };
        return null;
      },
      oms: s => (s === 'intrek' ? 'Ingetrokken tegoed terug' : 'Verlopen tegoed terug'),
      onbekend: { status: 404, error: 'Dit tegoed is niet van jou.' } });
    if (!r.ok) return r;
    return { ok: true, herhaald: !!r.herhaald, centen: r.tegoed.centen, saldo: saldo(),
      tegoed: bon.naarBuiten(r.tegoed) };
  }

  async function roteer(args) {
    await migratie.zorg();
    return uitgifte.roteer(args);
  }

  return { bon, claim, migratie, uitgifte, bewaarNieuw, terug, roteer };
};
