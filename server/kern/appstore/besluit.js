/* ============================================================================
   HET AFTEKENEN -- de wachtrij, het besluit van een MENS, en de noodrem.

   Dit is grens 2 van de App Store, en het is een eigen bestand omdat het een
   eigen verantwoordelijkheid is: ./versies.js NEEMT AAN en kan alleen afkeuren
   of doorzetten; dit bestand is de enige plek in dit huis waar een versie live
   gaat. Wie wil weten hoe een app van een derde bij een lid terechtkomt, hoeft
   maar een bestand te lezen.

   Twee dingen die hier niet weg mogen. Een besluit draagt een NAAM (`door`):
   een besluit zonder naam is een besluit dat niemand heeft genomen. En een
   uitgever tekent zijn eigen inzending niet af -- dat is dezelfde regel als bij
   de bewijspoort in CLAUDE.md, waar een werkgever zijn eigen stuk niet aftekent.
   ========================================================================== */
'use strict';

const { MACHTIGINGEN, NIET_GEBOUWD } = require('./machtigingen');
const { BUDGET } = require('./keuring');

module.exports = function maakBesluit({ S, save, nu, boek, eigen, norm, uitgever, publiekU, app, versie, publiekV }) {
  /* -------------------------------------------------------------- het aftekenen */

  const wachtrij = () => Object.values(S().versies).filter(v => v.status === 'wacht-op-mens')
    .sort((a, b) => (a.at < b.at ? -1 : 1)).map(publiekV);

  /* GRENS 2, EN DIT IS DE PLEK WAAR HIJ WORDT AFGEDWONGEN. Een besluit draagt een
     mens (`door`) en een organisatie (`doorOrg`, als die er is). Is die
     organisatie de uitgever zelf, dan is dit geen keuring maar een handtekening
     onder je eigen stuk. */
  function besluit({ versieId, besluit: keuze, reden, door, doorOrg }) {
    const v = versie(versieId);
    if (!v) return { status: 404, error: 'Deze inzending bestaat niet.' };
    if (v.status !== 'wacht-op-mens') return { status: 409, error: 'Over deze inzending is al besloten (' + v.status + ').' };
    const wie = String(door || '').trim().slice(0, 80);
    if (!wie) return { status: 400, error: 'Zet je naam erbij: een keuring hoort een mens te hebben gedaan.' };
    if (doorOrg && norm(doorOrg) === v.org) return { status: 403, error: 'Een uitgever tekent zijn eigen inzending niet af. Een mens van RTG keurt.' };
    if (!['gepubliceerd', 'geweigerd'].includes(keuze)) return { status: 400, error: 'Een besluit is gepubliceerd of geweigerd.' };
    if (keuze === 'geweigerd' && String(reden || '').trim().length < 10) return { status: 400, error: 'Een weigering draagt een reden van ten minste tien tekens; die leest de uitgever.' };
    const u = uitgever(v.org);
    if (keuze === 'gepubliceerd' && (!u || u.status !== 'toegelaten')) return { status: 409, error: 'De uitgever is inmiddels ' + (u ? u.status : 'verdwenen') + '; deze versie gaat niet live.' };

    v.status = keuze;
    v.besluit = { door: wie, at: nu(), reden: String(reden || '').trim().slice(0, 600) || null };
    const a = app(v.sleutel);
    if (keuze === 'gepubliceerd' && a) {
      /* De vorige live versie wordt niet weggegooid maar losgelaten: hij blijft
         in het journaal en op schijf tot iemand hem opruimt, zodat "wat draaide
         er vorige week" beantwoordbaar blijft. */
      if (a.live && a.live !== v.id) { const oud = versie(a.live); if (oud) oud.status = 'ingetrokken'; }
      a.live = v.id; a.naam = v.manifest.naam; a.categorie = v.manifest.categorie; a.ingetrokken = null;
    }
    boek('versie-' + keuze, v.sleutel, wie, { versie: v.manifest.versie, hash: v.hash, reden: v.besluit.reden });
    save();
    return { status: 200, ok: true, versie: publiekV(v) };
  }

  /* GRENS 5: intrekken werkt onmiddellijk en overal. Zowel RTG als de uitgever
     zelf kan hem overhalen -- een uitgever die een fout in zijn eigen app ziet,
     hoort niet te moeten wachten op een kantoor. */
  function intrekken({ sleutel, reden, door, doorOrg }) {
    const a = app(sleutel);
    if (!a) return { status: 404, error: 'Deze app bestaat niet.' };
    if (doorOrg && norm(doorOrg) !== a.org) return { status: 403, error: 'Deze app is niet van jou.' };
    if (!a.live) return { status: 409, error: 'Deze app staat niet live.' };
    const wie = String(door || '').trim().slice(0, 80) || 'onbekend';
    const v = versie(a.live);
    if (v) v.status = 'ingetrokken';
    a.live = null;
    a.ingetrokken = { at: nu(), door: wie, reden: String(reden || '').trim().slice(0, 400) || null };
    boek('app-ingetrokken', a.sleutel, wie, { reden: a.ingetrokken.reden });
    save();
    return { status: 200, ok: true, app: { sleutel: a.sleutel, live: null, ingetrokken: a.ingetrokken },
      let: 'De app is meteen weg -- ook bij de leden die hem al hadden. Wat zij in deze app hebben opgeslagen blijft staan; komt er een nieuwe versie, dan is het er weer.' };
  }

  /* Wat de uitgever van zijn eigen kant ziet. Alleen zijn eigen apps: een
     uitgever is geen kantoor. */
  function mijnUitgeverij(org) {
    const o = norm(org);
    const u = uitgever(o);
    const apps = Object.values(S().apps).filter(a => a.org === o).map(a => ({
      sleutel: a.sleutel, naam: a.naam, categorie: a.categorie, at: a.at,
      live: a.live ? publiekV(versie(a.live)) : null, ingetrokken: a.ingetrokken || null,
      versies: Object.values(S().versies).filter(v => v.sleutel === a.sleutel).sort((x, y) => (x.at < y.at ? 1 : -1)).map(publiekV)
    }));
    return { uitgever: u ? publiekU(u) : null, apps, budget: BUDGET,
      machtigingen: MACHTIGINGEN.map(m => ({ id: m.id, label: m.label, geeft: m.geeft, nooit: m.nooit, risico: m.risico })),
      nietGebouwd: NIET_GEBOUWD };
  }

  return { wachtrij, besluit, intrekken, mijnUitgeverij };
};
