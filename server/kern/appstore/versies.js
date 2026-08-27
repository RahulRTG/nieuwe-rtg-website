/* ============================================================================
   DE VERSIES -- inzenden, keuren, aftekenen, intrekken.

   Apart van ./index.js omdat dat bestand met beide helften over de
   10 kB-keuringsgrens van dit huis ging, en omdat de naad hier ook echt loopt:
   index.js gaat over WIE er mag inzenden (de uitgever, en de mens van RTG die
   hem toelaat), dit bestand gaat over WAT er wordt ingezonden.

   De regel die dit bestand stuurt staat in index.js als grens 2 en wordt HIER
   afgedwongen: de machinepoort keurt nooit goed. inzenden() kan alleen afkeuren
   of doorzetten naar `wacht-op-mens`; besluit() is de enige functie in dit huis
   die een versie live zet, en die weigert een handtekening van de uitgever zelf.

   De motor wordt als geheel doorgegeven en niet als losse functies: dit deel
   leest de opslag, het journaal en de uitgeverslijst van index.js, en een kopie
   op montagemoment zou die bevriezen (zie de kop van opzet/domeingrens.js voor
   waarom dat hier vaker fout is gegaan).
   ========================================================================== */
'use strict';

const manifestLezer = require('./manifest');
const { keur, BUDGET } = require('./keuring');
const { neem, versiehash } = require('./bundel');
const { MACHTIGINGEN, toonbaar, NIET_GEBOUWD } = require('./machtigingen');

const INZENDINGEN_PER_UUR = 12;

module.exports = function maakVersies({ S, save, nu, boek, opslag, eigen, norm, uitgever, magInzenden, magPrijsVragen, antivirus }) {
  /* Het versie-id woont hier en niet in ./index.js: een versie wordt in dit
     bestand gemaakt en nergens anders. */
  const id = () => 'v-' + require('crypto').randomBytes(6).toString('hex');
  /* --------------------------------------------------------------- inzendingen */

  const app = (sleutel) => eigen(S().apps, String(sleutel || '').toLowerCase());
  const versie = (vid) => eigen(S().versies, String(vid || ''));

  function remGehaald(org) {
    const grens = Date.parse(nu()) - 3600000;
    const n = Object.values(S().versies).filter(v => v.org === org && Date.parse(v.at) > grens).length;
    return n >= INZENDINGEN_PER_UUR;
  }

  /* EEN INZENDING IS EEN VERSIE. Zij wordt nooit overschreven en nooit stilletjes
     gelijkgesteld aan een vorige: dezelfde bundel opnieuw insturen levert
     dezelfde hash en dat wordt gezegd, niet verzwegen. */
  function inzenden({ org, manifest: ruwM, bestanden: ruwB }) {
    const o = norm(org);
    if (!magInzenden(o)) {
      const u = uitgever(o);
      return { status: 403, error: !u ? 'Deze organisatie is geen toegelaten uitgever. Vraag eerst een uitgeversplek aan.'
        : u.status === 'aangevraagd' ? 'Je aanvraag ligt bij RTG; een mens kijkt ernaar. Zolang dat loopt, kun je nog niet inzenden.'
        : 'Deze uitgever mag niet inzenden (' + u.status + ')' + (u.reden ? ': ' + u.reden : '') + '.' };
    }
    if (remGehaald(o)) return { status: 429, error: 'Meer dan ' + INZENDINGEN_PER_UUR + ' inzendingen per uur houdt de poort tegen. Keur je bundel lokaal met dezelfde regels voordat je hem stuurt.' };

    const m = manifestLezer.lees(ruwM);
    if (!m.ok) return { status: 400, error: 'Het manifest klopt nog niet.', fouten: m.fouten };

    /* MAG DEZE UITGEVER GELD VRAGEN? (besluit 27 augustus 2026) Een geverifieerd
       PERSOON publiceert gratis; betaalde distributie vraagt een rechtspersoon.
       De regel zelf staat in ./uitgevers.js en niet hier -- dit is het moment
       waarop hij knelt, niet de plek waar hij woont (LAT-regel 4).

       Hij staat hier en niet bij het publiceren, om twee redenen. Het manifest
       met de prijs komt HIER binnen, dus dit is het vroegste eerlijke moment;
       en een uitgever die het pas bij het aftekenen hoort, heeft een bundel
       gebouwd die nooit kon. */
    if (Number(m.manifest.prijsCenten || 0) > 0 && magPrijsVragen) {
      const geld = magPrijsVragen(o);
      if (!geld.mag) return { status: 403, error: geld.reden };
    }

    const bestaandeApp = app(m.manifest.sleutel);
    if (bestaandeApp && bestaandeApp.org !== o) return { status: 409, error: 'De sleutel "' + m.manifest.sleutel + '" is al van een andere uitgever. Kies een andere.' };

    const b = neem(ruwB);
    if (!b.ok) return { status: 400, error: 'De bundel klopt nog niet.', fouten: b.fouten };

    const hash = versiehash(b.bestanden);
    const eerder = Object.values(S().versies).find(v => v.sleutel === m.manifest.sleutel && v.hash === hash && v.status !== 'geweigerd');
    if (eerder) return { status: 409, error: 'Deze bundel is byte voor byte gelijk aan versie ' + eerder.manifest.versie + ' (' + eerder.status + '). Wijzig iets, of gebruik die versie.', versie: publiekV(eerder) };

    const k = keur({ bestanden: b.bestanden, manifest: m.manifest, antivirus });
    if (!k.door) {
      boek('inzending-afgekeurd-machine', m.manifest.sleutel, o, { blokkades: k.bevindingen.filter(x => x.ernst === 'blokkeert').length });
      save();
      return { status: 422, error: 'De poort houdt deze bundel tegen. Hieronder staat per bestand en regel wat er aan de hand is en hoe het wel kan.', bevindingen: k.bevindingen, maten: k.maten, budget: BUDGET };
    }

    opslag.schrijf(m.manifest.sleutel, hash, b.bestanden);
    const v = { id: id(), sleutel: m.manifest.sleutel, org: o, manifest: m.manifest, hash,
      maten: k.maten, bevindingen: k.bevindingen, status: 'wacht-op-mens', at: nu(), besluit: null };
    S().versies[v.id] = v;
    if (!bestaandeApp) S().apps[m.manifest.sleutel] = { sleutel: m.manifest.sleutel, org: o, naam: m.manifest.naam, categorie: m.manifest.categorie, at: nu(), live: null, ingetrokken: null };
    boek('inzending-door-naar-mens', m.manifest.sleutel, o, { versie: m.manifest.versie, hash });
    save();
    return { status: 200, ok: true, versie: publiekV(v),
      let: 'De machinepoort is door. Die keurt nooit goed -- een mens van RTG kijkt nu naar wat je app DOET. Je hoort het via het contactadres van je uitgeversplek.' };
  }


  /* DE PROEFKEURING: dezelfde machinepoort, zonder dat er iets wordt bewaard.
     Hij bestaat omdat een uitgever moet kunnen LEREN waar de poort staat. Zonder
     hem is de enige manier om dat te ontdekken een echte inzending, en dan
     bewaakt de rem (twaalf per uur) niet het misbruik maar het leren. */
  function proef({ manifest: ruwM, bestanden: ruwB }) {
    const m = manifestLezer.lees(ruwM);
    if (!m.ok) return { door: false, fouten: m.fouten, bevindingen: [], budget: BUDGET };
    const b = neem(ruwB);
    if (!b.ok) return { door: false, fouten: b.fouten, bevindingen: [], budget: BUDGET };
    const k = keur({ bestanden: b.bestanden, manifest: m.manifest, antivirus });
    return { door: k.door, fouten: [], bevindingen: k.bevindingen, maten: k.maten, budget: BUDGET,
      hash: versiehash(b.bestanden),
      let: k.door
        ? 'De machinepoort laat dit door. Dat is geen goedkeuring: een mens van RTG kijkt daarna naar wat je app DOET.'
        : 'Zo komt deze bundel de poort niet door. Hieronder staat per bestand en regel wat er is gevonden en hoe het wel kan.' };
  }

  function publiekV(v) {
    return { id: v.id, sleutel: v.sleutel, org: v.org, naam: v.manifest.naam, versie: v.manifest.versie,
      uitleg: v.manifest.uitleg, categorie: v.manifest.categorie, taal: v.manifest.taal,
      prijsCenten: Number(v.manifest.prijsCenten || 0),
      vraagt: toonbaar(v.manifest.machtigingen, v.manifest.doelen), hash: v.hash, maten: v.maten,
      bevindingen: v.bevindingen, status: v.status, at: v.at, besluit: v.besluit || null,
      /* DE TOEGANKELIJKHEIDSUITSLAG REIST MEE, en alleen als hij bij DEZE bytes
         hoort. Een uitslag van een vorige bundel is geen uitslag (zie
         ./toegankelijk.js), dus hij hoort hier ook niet te verschijnen -- anders
         leest een mens op het keuringsscherm een groen vinkje dat over iets
         anders gaat. Dit is TONEN en geen beslissen: de poort blijft
         toegankelijk.belet() in ./besluit.js (LAT-regel 4). */
      toegankelijk: v.toegankelijk && v.toegankelijk.hash === v.hash ? v.toegankelijk : null };
  }

  return { app, versie, inzenden, proef, publiekV, remGehaald, INZENDINGEN_PER_UUR };
};
module.exports.INZENDINGEN_PER_UUR = INZENDINGEN_PER_UUR;
