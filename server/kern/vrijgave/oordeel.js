/* HET OORDEEL VAN DE VRIJGAVEPOORT: de vijf assen, de afhankelijkheden, het
   recht van de actor, en de handhaver die er een veilige fout van maakt. De
   regels die dit bestand draagt staan in de kop van ./index.js; hier staat hoe
   ze worden uitgerekend. Een bestand dat dit niet zelf doet, vraagt het hier. */
'use strict';
const reg = require('./register');
const { ZIN, STATUS } = require('./antwoord');

module.exports = function maakOordeel({ st, bw, pg, isOpenbaar, k, register, schaduw, lokaal, sandboxMag }) {
  const isLokaalFn = typeof lokaal === 'function' ? lokaal : () => false;
  const sandboxMagFn = typeof sandboxMag === 'function' ? sandboxMag : () => !isOpenbaar();
  /* De autorisatie-as (bevoegdheidslaag en vastgelegde besluiten): ./autorisatie.js. */
  const autorisatie = require('./autorisatie')({ st, k });

  /* Het hart. `diepte` begrenst de afhankelijkheden (het register is kringvrij
     gevalideerd; dit is de vangrail voor een register dat dat niet was). */
  function beoordeel(id, ctx = {}, diepte = 0) {
    const cap = register.vind(id);
    const basis = { id: String(id), geimplementeerd: false, geverifieerd: false, geautoriseerd: false,
      ingeschakeld: false, afhankelijkhedenGezond: false, actorGerechtigd: false, beschikbaar: false };
    if (!cap) return Object.assign(basis, { code: 'bestaat-niet-voor-dit-product', intern: 'onbekende-capability' });
    if (diepte > 8) return Object.assign(basis, { code: 'tijdelijk-uit', intern: 'afhankelijkheden-te-diep' });

    const redenen = [];
    const s = st.standVan(id);
    /* DE LOKALE STANDAARD (./lokaal.js): niets vastgelegd voor deze capability,
       en dit is aantoonbaar een lokale ontwikkel- of toetsinstallatie -- dan
       begint hij op `sandbox`. Wat een mens wel vastlegde, gaat altijd voor. */
    const isLokaal = (() => { try { return isLokaalFn() === true; } catch (e) { return false; } })();
    const lokaleStandaard = !s.fout && s.standaard === true && isLokaal;
    const stand = s.fout ? null : (lokaleStandaard ? 'sandbox' : s.stand);
    const configFout = s.fout || (stand && !cap.standen.includes(stand) ? 'stand ' + stand + ' is voor deze capability niet toegestaan' : null);

    const rail = ctx.rail ? String(ctx.rail) : null;
    const neprail = rail ? (reg.NEPRAILS.includes(rail) || (isLokaal && reg.LOKALE_NEPRAILS.includes(rail))) : false;
    let ingeschakeld = false, standReden = null;
    if (configFout) standReden = 'configuratiefout: ' + configFout;
    else if (stand === 'enabled') ingeschakeld = true;
    else if (stand === 'sandbox') {
      let mag; try { mag = sandboxMagFn() === true; } catch (e) { mag = false; }
      if (!mag) standReden = 'sandbox-niet-toegestaan-in-deze-installatie';
      else if (!neprail) standReden = 'sandbox-alleen-op-neprail';
      else ingeschakeld = true;
    } else standReden = 'stand:' + stand;
    const sandboxActief = stand === 'sandbox' && ingeschakeld;

    const bewijsOordeel = sandboxActief
      /* Op een neprail beweegt geen echt geld; het externe dossier gaat over
         echte rails en is daar geen voorwaarde. De sandbox draagt dat in zijn
         reden, zodat niemand een sandboxvrijgave voor een echte aanziet. */
      ? { geverifieerd: true, reden: 'sandbox-zonder-echt-geld' }
      : bw.oordeel(cap);
    const aut = autorisatie(cap, ctx, sandboxActief);

    // afhankelijkheden: andere capabilities, en de provider van DIT verzoek
    let depsOk = true, depCode = null;
    const deps = cap.afhankelijk.slice();
    /* Alleen een ACTIEVE sandbox slaat de providervraag over: op `enabled` mag
       geen `rail` uit het verzoek een laag overslaan (test/vrijgave-rangorde.test.js). */
    if (cap.provider === 'per-verzoek' && !sandboxActief) {
      const p = ctx.provider || rail;
      if (!p) { depsOk = false; depCode = 'provider-niet-beschikbaar'; redenen.push('provider-onbekend'); }
      else if (!register.vind('geld.provider.' + p)) { depsOk = false; depCode = 'provider-niet-beschikbaar'; redenen.push('provider-niet-in-register:' + p); }
      else deps.push('geld.provider.' + p);
    }
    for (const d of deps) {
      const o = beoordeel(d, Object.assign({}, ctx, { actor: { soort: 'systeem' }, recht: undefined }), diepte + 1);
      if (!o.beschikbaar) {
        depsOk = false;
        /* Wat de klant hoort over een afhankelijkheid: een provider is een
           provider; een ontbrekende autorisatie of compliance van de onderlaag
           IS er een van deze capability; al het andere (de onderlaag staat uit)
           maakt deze tijdelijk onbruikbaar -- nooit "bestaat niet", want naar
           deze capability werd gevraagd en die bestaat wel. */
        depCode = depCode || (d.startsWith('geld.provider.') ? 'provider-niet-beschikbaar'
          : ['niet-geautoriseerd', 'compliance-ontbreekt'].includes(o.code) ? o.code : 'tijdelijk-uit');
        redenen.push('afhankelijk:' + d + ':' + o.code);
      }
    }
    if (cap.provider && cap.provider !== 'per-verzoek' && sandboxActief) {
      redenen.push('provider-' + cap.provider + ':niet-gevraagd-op-neprail');
    } else if (cap.provider && cap.provider !== 'per-verzoek') {
      let g; try { g = pg(cap.provider); } catch (e) { g = null; }
      if (!g || g.gezond !== true) { depsOk = false; depCode = depCode || 'provider-niet-beschikbaar'; redenen.push('provider-ongezond:' + ((g && g.reden) || 'onbekend')); }
    }
    if (k.gezondheid) {
      let g; try { g = k.gezondheid(id); } catch (e) { g = { door: false, error: 'gezondheid onleesbaar' }; }
      if (g && g.door === false) { depsOk = false; depCode = depCode || 'tijdelijk-uit'; redenen.push('quarantaine:' + (g.error || '')); }
    }

    /* Precies `true`, of het systeem zelf (een veeg, een melding, een naad die
       geen mensen kent en waarvan de route het recht al vaststelde). Een
       waarheidsachtige waarde is geen vastgesteld recht. */
    const systeem = !!(ctx.actor && ctx.actor.soort === 'systeem');
    const gerechtigd = ctx.recht === true || systeem;

    const uit = Object.assign(basis, {
      geimplementeerd: cap.geimplementeerd === true,
      geverifieerd: bewijsOordeel.geverifieerd === true,
      geautoriseerd: aut.ok === true,
      ingeschakeld,
      afhankelijkhedenGezond: depsOk,
      actorGerechtigd: gerechtigd,
      stand: stand || null,
      standBron: s.fout ? null : (lokaleStandaard ? 'lokale-standaard' : (s.standaard ? 'veilige-standaard' : 'vastgelegd')),
      standVersie: s.versie != null ? s.versie : null,
      bewijs: { reden: bewijsOordeel.reden, commit: bewijsOordeel.commit || null, inhoudSha256: bewijsOordeel.inhoudSha256 || null }
    });
    uit.beschikbaarVoorRechthebbende = uit.geimplementeerd === true && uit.geverifieerd === true &&
      uit.geautoriseerd === true && uit.ingeschakeld === true && uit.afhankelijkhedenGezond === true;
    uit.beschikbaar = uit.beschikbaarVoorRechthebbende && uit.actorGerechtigd === true;

    /* De VOLGORDE van de code: de eerste as die faalt, in de volgorde waarin een
       mens hem zou oplossen. Niet gebouwd gaat voor uitgezet; uitgezet gaat voor
       ontbrekend bewijs (anders leest een stilgezette functie als een
       compliancegat); en het recht van de actor komt als laatste, want dat gaat
       over hem en niet over het huis. */
    let code = null;
    if (!uit.geimplementeerd) { code = 'bestaat-niet-voor-dit-product'; redenen.unshift('niet-geimplementeerd'); }
    else if (!uit.ingeschakeld) { code = configFout || stand !== 'disabled' ? 'tijdelijk-uit' : 'bestaat-niet-voor-dit-product'; redenen.unshift(standReden); }
    else if (!uit.geverifieerd) { code = 'compliance-ontbreekt'; redenen.unshift('bewijs:' + bewijsOordeel.reden); }
    else if (!uit.geautoriseerd) { code = aut.code; redenen.unshift('autorisatie:' + aut.reden); }
    else if (!uit.afhankelijkhedenGezond) code = depCode || 'provider-niet-beschikbaar';
    else if (!uit.actorGerechtigd) { code = 'geen-recht'; redenen.push('actor-zonder-vastgesteld-recht'); }
    /* De interne reden noemt ALLE assen die ontbreken, niet alleen de eerste:
       een bestuurder die alleen "staat uit" leest, zet hem aan en ontdekt dan
       pas dat ook het bewijs ontbreekt. */
    if (code) {
      if (!uit.geverifieerd && !redenen.some(x => String(x).startsWith('bewijs:'))) redenen.push('bewijs:' + bewijsOordeel.reden);
      if (!uit.geautoriseerd && !redenen.some(x => String(x).startsWith('autorisatie:'))) redenen.push('autorisatie:' + aut.reden);
      uit.code = code; uit.intern = redenen.filter(Boolean).join(' | ') || code;
    }
    else uit.intern = 'beschikbaar' + (aut.reden ? ' (' + aut.reden + ')' : '');

    if (stand === 'shadow' && diepte === 0) {
      /* Wat er ZOU zijn gebeurd als hij aan stond: alle assen behalve de stand.
         Geteld, nooit doorgelaten -- schaduw is meten en niet een zachte aan. */
      const t = schaduw.get(id) || { zouDoor: 0, zouDicht: 0 };
      if (uit.geimplementeerd && uit.geverifieerd && uit.geautoriseerd && uit.afhankelijkhedenGezond && uit.actorGerechtigd) t.zouDoor++;
      else t.zouDicht++;
      schaduw.set(id, t);
    }
    return uit;
  }

  /* DE HANDHAVER voor routes en kernmodules. Gooit een fout met een veilige
     code en een zin voor de klant; de interne reden zit erop voor het log. */
  function eis(id, ctx = {}) {
    const o = beoordeel(id, ctx);
    if (o.beschikbaar) return o;
    const e = new Error(ZIN[o.code] || ZIN['tijdelijk-uit']);
    e.code = 'VRIJGAVE_DICHT';
    e.vrijgaveCode = o.code;
    e.status = STATUS[o.code] || 503;
    e.capability = o.id;
    e.intern = o.intern;
    e.nietVerstuurd = true;
    throw e;
  }

  /* Dezelfde handhaver als middleware-achtig hulpje: true als het mag, anders
     staat het antwoord al op `res` en geeft hij false. Het antwoord noemt de
     capability en de code, en NOOIT de interne reden. */
  function eisHttp(res, id, ctx) {
    try { eis(id, ctx); return true; }
    catch (e) {
      if (e.code !== 'VRIJGAVE_DICHT') throw e;
      res.status(e.status).json({ error: e.message, code: e.vrijgaveCode, capability: e.capability });
      return false;
    }
  }

  return { beoordeel, eis, eisHttp };
};
