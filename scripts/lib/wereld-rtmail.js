/* ============================================================================
   DE POSTBUSWERELD -- een bericht, een team, een concept en een regel.

   HET PROBLEEM. Tweeenzestig routes stranden op vier verschillende dingen die
   niet bestaan, verdeeld over TWEE domeinen die dezelfde postbus zijn:

     /api/member/rtmail    37  10x "Dit team bestaat niet", 8x "Dit bericht
                               bestaat niet", 3x concept, 2x regel
     /api/supplier/rtmail  25  7x bericht, 3x concept, 2x regel

   Dezelfde vier dingen, twee keer -- een lid heeft een postbus en een zaak
   ook. Vandaar een wereld die beide kanten opzet in plaats van twee werelden
   die hetzelfde doen.

   HET BERICHT MOET ER EEN ZIJN DIE JE ZELF HEBT ONTVANGEN, en dat is de enige
   stap die om een omweg vraagt: een leeg postvak heeft geen bericht om te
   lezen, te beantwoorden of te classificeren. De postbus stuurt daarom EEN
   bericht naar zichzelf. Dat is geen kunstgreep -- /api/rtmail/adres geeft het
   eigen adres, en aan jezelf schrijven is een gewone handeling.

   VIER VELDNAMEN, uit de bron gelezen:

     team     naam + adres; het adres wordt gekeurd (gereserveerde namen
              worden geweigerd) en moet vrij zijn
     regel    een `veld` uit ['van','onderwerp','tekst','soort'] en een
              `actie` uit ['opbergen','weggooien','etiket','ster','lezen'] --
              allebei gesloten lijsten die met reden weigeren
     concept  onderwerp + tekst
     bericht  het id uit het eigen postvak na de zelfzending

   WAT ER PER KANT VERSCHILT is welke routes er bestaan: de zaakkant heeft
   geen /adres en geen /team (gemeten: 404 "Onbekend eindpunt"). Dat is geen
   gebrek maar het ontwerp -- een team hoort bij een mens, een zaak heeft haar
   personeel. De wereld probeert het dus wel en meldt netjes dat het er niet
   is, in plaats van te doen alsof de kanten gelijk zijn. */
'use strict';

/* Per kant: het routevoorvoegsel, welke rol daar aanklopt, en of hij een team
   kent. Zo staat het verschil tussen de twee kanten hier en niet in de code. */
const KANTEN = [
  { naam: 'lid', pre: '/api/member/rtmail', rol: 'member', team: true,
    waarom: 'de postbus van een lid; die kent teams (rtmail-team.js)' },
  { naam: 'zaak', pre: '/api/supplier/rtmail', rol: 'supplier', team: false,
    waarom: 'de postbus van een zaak; geen /adres en geen /team -- gemeten, 404 Onbekend eindpunt' }
];

async function zetRtmailKlaar({ post, tokens }) {
  const stappen = [];
  const extra = {};

  for (const kant of KANTEN) {
    const tok = (tokens || {})[kant.rol];
    if (!tok) {
      stappen.push({ naam: kant.naam + ': sessie', pad: '-', status: 0, ok: false,
        waarom: 'geen sessie voor rol `' + kant.rol + '`' });
      continue;
    }
    const doe = async (naam, pad, lijf) => {
      let a = null;
      try { a = await post(kant.pre + pad, lijf, tok); } catch (e) { a = null; }
      const ok = a && a.status >= 200 && a.status < 300;
      stappen.push({ naam: kant.naam + ': ' + naam, pad: kant.pre + pad,
        status: a ? a.status : 0, ok,
        waarom: ok ? null : ((a && a.data && a.data.error) || 'geen antwoord') });
      return ok ? a.data : null;
    };
    const bak = (extra[kant.naam] = {});

    /* 1. Eerst het TEAM, want aan de ledenkant is er geen persoonlijke
          verzendroute -- alleen /team/stuur, en die wil een team-id. Dat is
          geen omissie maar de vorm van dit domein: een lid schrijft vanuit een
          gedeeld postvak. De zaakkant heeft /stuur wel en geen team. */
    if (kant.team) {
      const t = await doe('een team', '/team/maak', { naam: 'Proefteam', adres: 'proefteam' });
      const team = t && t.team && t.team.id;
      if (team) { bak.team = team; bak.teamId = team; bak.teamAdres = t.team.adres || null; }

      /* EN EEN RESERVETEAM, om dezelfde reden waarom de school een tweede
         medewerker heeft en het spel een tweede potje.

         /team/hef heft het team op en /team/verlaat stapt eruit. De proef
         roept elke route aan, dus zij brak haar eigen team af -- en precies de
         tien routes die alfabetisch NA `hef` komen (koppel, lid, notitie,
         overzicht, pak, postvak, prioriteit, status, stuur, verlaat) stonden
         daarna op "Dit team bestaat niet". Tien van de tien; geen toeval maar
         een volgorde.

         Dit is de derde keer dat deze vorm terugkomt, en de eerste keer dat ik
         hem herkende aan het patroon in plaats van na een sweep. */
      const r = await doe('een reserveteam voor de routes die een team opheffen',
        '/team/maak', { naam: 'Proefteam reserve', adres: 'proefteam-reserve' });
      const reserve = r && r.team && r.team.id;
      if (reserve) bak.teamReserve = reserve;
    }

    /* 2. Het adres waar het proefbericht heen gaat. Aan de ledenkant is dat
          het adres van het TEAM en niet het persoonlijke adres: de dossier-
          routes (status, prioriteit, notitie, koppel) werken op een bericht IN
          het gedeelde postvak, en daar komt niets terecht dat naar een persoon
          is gestuurd. Dat kostte deze wereld een ronde: het bericht ging weg,
          kwam netjes aan, en stond in het verkeerde postvak.
          Aan de zaakkant is er geen team en dus het eigen adres uit de inbox. */
    let adres = null;
    if (kant.team) {
      adres = bak.teamAdres || null;
      const a = await doe('het eigen adres', '/adres', {});
      if (a && a.adres) bak.eigenAdres = a.adres;
    }
    const inboxVoor = await doe('het postvak', '/inbox', {});
    if (!adres) adres = inboxVoor && inboxVoor.adres;

    /* 3. Een bericht. Het veld heet `naar` en niet `aan` (kern/rtmail.js,
          stuur), en het ANTWOORD draagt het bericht al -- het postvak
          teruglezen is niet nodig en gaf een ronde lang niets omdat er in het
          verkeerde postvak werd gekeken. */
    if (adres) {
      bak.adres = adres;
      const verstuurd = await doe('een bericht in het postvak',
        kant.team ? '/team/stuur' : '/stuur',
        { ...(bak.team ? { id: bak.team } : {}), naar: adres,
          onderwerp: 'Proefbericht', tekst: 'Een bericht om te kunnen meten.' });
      const b = verstuurd && verstuurd.bericht;
      if (b && b.id) { bak.bericht = b.id; bak.berichtId = b.id; }
    }

    /* 3. Een concept. */
    const c = await doe('een concept', '/concept/bewaar',
      { onderwerp: 'Proefconcept', tekst: 'nog niet verstuurd' });
    const concept = c && c.concept && c.concept.id;
    if (concept) { bak.concept = concept; bak.conceptId = concept; }

    /* 4. Een regel. `veld` en `actie` komen uit gesloten lijsten in
          kern/rtmail-regels.js; een andere waarde wordt geweigerd met de lijst
          erbij, en dat is precies de reden om ze hier niet te verzinnen. */
    const rg = await doe('een postvakregel', '/regel/maak',
      { naam: 'Proefregel', veld: 'onderwerp', bevat: 'proef', actie: 'ster' });
    const regel = rg && rg.regel && rg.regel.id;
    if (regel) { bak.regel = regel; bak.regelId = regel; }

  }

  const geteld = Object.values(extra).reduce((n, b) => n + Object.keys(b).length, 0);
  return { klaar: geteld > 0, extra, stappen,
    reden: geteld > 0 ? null : 'geen van beide postbussen leverde iets op; zie stappen' };
}

/* Welke kant hoort bij dit pad. Geen langste-voorvoegsel-spel nodig: de twee
   voorvoegsels overlappen niet.

   EN WELK DING IS `id` HIER. Dezelfde valkuil als bij het livinglab, en ik ben
   er zelf in gelopen: een generieke `id` in de bak liet de meting ZAKKEN
   (1938 -> 1936), want elke rtmail-route kreeg het team-id -- ook de routes
   die een BERICHT bedoelen. Het onderscheid staat daarom per deelgebied, en
   is gemeten uit de weigeringen:

     /team/...    id is een TEAM      ("Dit team bestaat niet")
     /concept/... id is een CONCEPT   ("Dit concept bestaat niet in dit postvak")
     /regel/...   id is een REGEL     ("Deze regel bestaat niet in dit postvak")
     de rest      id is een BERICHT   ("Dit bericht bestaat niet")

   Een deelgebied dat het ding niet heeft, krijgt geen `id` -- dan is 404 het
   eerlijke antwoord en geen gok. */
const { idVoor: idPerDeel } = require('./idperdeel');

/* De tabel per kant. De VORM (langste deelgebied wint, geen ding = geen id)
   staat in ./idperdeel.js; welk deelgebied wat bedoelt is een meting aan dit
   domein en staat daarom hier. */
const tabelVoor = (pre) => ({
  [pre + '/team']: 'team',
  /* De twee die het team SLOPEN krijgen de reserve. Zonder dit haalt de proef
     haar eigen team onderuit en vallen de tien routes erna om. */
  [pre + '/team/hef']: 'teamReserve',
  [pre + '/team/verlaat']: 'teamReserve',
  [pre + '/concept']: 'concept',
  [pre + '/regel']: 'regel',
  [pre]: 'bericht'
});

function idSoortVoor(pad, pre) {
  const t = tabelVoor(pre);
  let beste = null;
  for (const deel of Object.keys(t)) {
    if (!(pad === deel || String(pad).startsWith(deel + '/'))) continue;
    if (!beste || deel.length > beste.length) beste = deel;
  }
  return beste ? t[beste] : 'bericht';
}

function lijfVoor(wereld, pad) {
  if (!wereld) return {};
  for (const k of KANTEN) {
    if (!String(pad || '').startsWith(k.pre)) continue;
    const bak = wereld[k.naam];
    if (!bak) return {};
    return { ...bak, ...idPerDeel(tabelVoor(k.pre), bak, pad) };
  }
  return {};
}

module.exports = { KANTEN, zetRtmailKlaar, lijfVoor, idSoortVoor };
