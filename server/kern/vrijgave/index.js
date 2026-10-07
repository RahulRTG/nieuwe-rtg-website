/* DE VRIJGAVEPOORT: een oordeel per capability, per verzoek, op vijf assen.

   Het register staat in ./register.js, het bewijs in ./bewijs.js, de stand in
   ./stand.js. Dit bestand zet ze achter elkaar en is de ENIGE plek die
   "beschikbaar" uitrekent. Iedere route of kernmodule die een release-gestuurde
   capability raakt, vraagt het hier -- `eis()` -- en nergens anders. Een tweede
   plek die het zelf uitrekent, heeft binnen een jaar een eigen definitie van aan.

   DRIE REGELS DIE HIER IN CODE STAAN EN NIET IN EEN AFSPRAAK:

   1. ONBEKEND IS DICHT. Een id die niet in het register staat, een stand die
      niet bestaat, een bevoegdheidslaag die niet is gekoppeld, een provider
      waarvan de gezondheid niet te bepalen is, een actor zonder vastgesteld
      recht: allemaal `beschikbaar: false`, ieder met een eigen interne reden.
      CONTROLPLANE.md zegt dat ONBEKEND geen WEIGEREN is, en dat klopt voor de
      REDEN -- het antwoord aan een lid zegt "tijdelijk uit" en niet "verboden".
      Maar voor wat waarde verplaatst valt ONBEKEND dicht (`veiligeUitkomst`
      daar), en dit zijn allemaal handelingen die waarde verplaatsen.

   2. SLEUTELS ZIJN GEEN SCHAKELAAR. Dat er een Stripe-sleutel in de omgeving
      staat, zegt alleen iets over de gezondheidsas (kan de provider bereikt
      worden). Aan of uit komt uit ./stand.js en nergens anders.

   3. HET OORDEEL WORDT PER VERZOEK GEVELD, nooit per sessie of per login. Een
      sessie die openging toen iets aan stond, heeft na het uitzetten bij het
      eerstvolgende verzoek dezelfde dichte deur als een nieuwe.

   WAT DE BUITENKANT TE HOREN KRIJGT. Zes codes, en geen configuratie:
     bestaat-niet-voor-dit-product  niet gebouwd, of bewust niet aangeboden
     tijdelijk-uit                  stilgezet, noodstop, of een configuratiefout
     niet-geautoriseerd             RTG mag dit (nog) niet
     provider-niet-beschikbaar      de provider of een afhankelijkheid is er niet
     compliance-ontbreekt           het bewijs of een extern besluit ontbreekt
     geen-recht                     deze gebruiker heeft hier geen recht op
   De interne reden (welk dossier, welke controle, welke versie) staat in
   `intern` en gaat alleen naar het kantoor en het log. */
'use strict';
const reg = require('./register');
const { maakStand } = require('./stand');
const { maakBewijs } = require('./bewijs');
const { CODES, ZIN, STATUS, providerUitOmgeving } = require('./antwoord');

function maakVrijgave({ env = process.env, stand, bewijs, bevoegd = null, gezondheid = null,
  providerGezond = null, audit = null, openbaar = null, lokaal = null, sandbox = null, register = reg } = {}) {
  const st = stand || maakStand({ env });
  const bw = bewijs || maakBewijs({});
  const pg = providerGezond || providerUitOmgeving(env);
  const isOpenbaar = typeof openbaar === 'function' ? openbaar
    : () => { try { return require('../../config/openbaar').isOpenbaar(env); } catch (e) { return true; } };
  /* De lokale regel (./lokaal.js). Beide lezen de OMGEVING, per oordeel opnieuw:
     een proces dat zijn omgeving niet verandert, krijgt steeds hetzelfde
     antwoord, en een toets die een productieomgeving nabootst, krijgt het
     productieantwoord. `openbaar` (als een toets hem meegeeft) telt in beide
     mee: een installatie die openbaar is, is nooit lokaal. */
  const L = require('./lokaal');
  const isLokaal = typeof lokaal === 'function' ? lokaal
    : () => !isOpenbaar() && L.lokaleInstallatie(env).ja === true;
  const sandboxMag = typeof sandbox === 'function' ? sandbox
    : () => !isOpenbaar() && L.sandboxMag(env).ja === true;
  /* Late koppeling: de bevoegdheidslaag en de capability-gezondheid leven in de
     kern-tas en zijn er pas na de montage. Tot dan: onbekend, dus dicht. */
  const k = { bevoegd, gezondheid, audit };
  const schaduw = new Map();   // id -> { zouDoor, zouDicht }

  const { beoordeel, eis, eisHttp } = require('./oordeel')({ st, bw, pg, isOpenbaar, k, register, schaduw,
    lokaal: isLokaal, sandboxMag });
  const { zet, besluitVastleggen, besluitIntrekken } = require('./schakelen')({ st, register, isOpenbaar, sandboxMag, k });

  /* Het beeld voor het kantoor en het standrapport: per capability de assen,
     gevraagd namens een rechthebbende (de actor-as is daar niet van toepassing
     en staat er dan ook als `beschikbaarVoorRechthebbende`). */
  function overzicht(ctx = {}) {
    const l = st.lees();
    const B = require('./baseline');
    return {
      versie: l.fout ? null : l.staat.versie,
      configuratiefout: l.fout || null,
      lokaleInstallatie: (() => { try { return isLokaal() === true; } catch (e) { return false; } })(),
      baseline: { naam: B.NAAM, vastgesteld: B.VASTGESTELD, bron: B.BRON },
      besluiten: Object.keys(reg.BESLUITEN).map(n => ({ besluit: n, uitleg: reg.BESLUITEN[n],
        vastgelegd: !!st.besluit(n) })),
      capabilities: register.REGISTER.map(c => {
        const o = beoordeel(c.id, Object.assign({ recht: true }, ctx));
        /* Een capability die per verzoek een provider kiest, is zonder provider
           altijd dicht (`provider-onbekend`). Het overzicht zegt daarom ook per
           ECHTE provider wat het oordeel zou zijn; de baseline (./baseline.js)
           leest daaruit "via Stripe" in plaats van een oordeel zonder provider. */
        const perProvider = c.provider === 'per-verzoek'
          ? Object.fromEntries(['stripe', 'mollie', 'adyen'].map(p => {
            const x = beoordeel(c.id, Object.assign({ recht: true }, ctx, { provider: p, rail: p }));
            return [p, { beschikbaarVoorRechthebbende: x.beschikbaarVoorRechthebbende, geimplementeerd: x.geimplementeerd,
              geverifieerd: x.geverifieerd, geautoriseerd: x.geautoriseerd, ingeschakeld: x.ingeschakeld,
              afhankelijkhedenGezond: x.afhankelijkhedenGezond, code: x.code || null, intern: x.intern }];
          }))
          : null;
        return Object.assign({ naam: c.naam, eigenaar: c.eigenaar, standen: c.standen }, o,
          { schaduw: schaduw.get(c.id) || null, baseline: B.vanCapability(c.id), perProvider });
      })
    };
  }

  /* De opstartcontrole: het register moet kloppen en het standbestand moet te
     lezen zijn. In een openbare installatie is een fout hier een weigering om
     te starten; daarbuiten een waarschuwing, en de oordelen staan toch dicht. */
  function valideer() {
    const vermogens = (() => { try { return require('../bevoegdheid/lijst').VERMOGENS; } catch (e) { return null; } })();
    const controles = (() => { try { return require('../../config/external-release').ALLE_CONTROLES; } catch (e) { return null; } })();
    const r = reg.valideerRegister(register.REGISTER, { vermogens, controles });
    const l = st.lees();
    const fouten = r.fouten.slice();
    if (l.fout) fouten.push('standbestand: ' + l.fout);
    return { ok: fouten.length === 0, fouten, openbaar: isOpenbaar() };
  }

  function koppel(deps = {}) {
    for (const n of ['bevoegd', 'gezondheid', 'audit']) if (deps[n] !== undefined) k[n] = deps[n];
  }

  return { beoordeel, eis, eisHttp, zet, besluitVastleggen, besluitIntrekken, overzicht, valideer, koppel,
    schaduwTelling: () => Object.fromEntries(schaduw), standbestand: st.pad };
}


/* Een exemplaar per proces. De betaalnaad (server/betaal/*) zit niet in de
   kern-tas en vraagt hem hier op; het kantoor koppelt de bevoegdheidslaag erin
   bij de montage. Twee exemplaren zouden twee schaduwtellingen en twee caches
   hebben -- de stand zelf blijft in het bestand wel een. */
let EEN = null;
function standaard() { if (!EEN) EEN = maakVrijgave({}); return EEN; }

/* BIJ HET STARTEN: in een openbare installatie is een kapot register of een
   onleesbaar standbestand een weigering om te starten, geen waarschuwing. Elders
   een waarschuwing -- en de oordelen staan dan toch dicht. Wordt aangeroepen in
   server/opzet/startcontrole.js, in ELKE stand en niet alleen in productie: een
   kapot register op een ontwikkelmachine hoort net zo goed te klinken. */
function keurBijStart(v = standaard(), log = console) {
  const r = v.valideer();
  if (r.ok) return r;
  const zin = 'Vrijgavepoort: configuratiefout -- ' + r.fouten.join('; ');
  if (r.openbaar) { const e = new Error(zin); e.code = 'VRIJGAVE_CONFIGURATIEFOUT'; throw e; }
  try { (log.warn || log.log).call(log, zin + ' (alles staat dicht)'); } catch (e) { /* een waarschuwing mag de start niet breken */ }
  return r;
}

/* VOOR KERNMODULES DIE GEEN FOUT GOOIEN maar een antwoord teruggeven (de vorm
   van kern/pay: `{ status, error }`): null als het mag, anders het antwoord dat
   de route ongewijzigd kan doorgeven. Dezelfde evaluator als eis(); dit is
   alleen een andere vorm van "nee". */
function weigering(id, ctx, v = standaard()) {
  try { v.eis(id, ctx); return null; }
  catch (e) {
    if (e.code !== 'VRIJGAVE_DICHT') throw e;
    return { status: e.status, error: e.message, code: e.vrijgaveCode, capability: e.capability };
  }
}

module.exports = { maakVrijgave, standaard, keurBijStart, weigering, providerUitOmgeving, CODES, ZIN, STATUS };
