/* ============================================================================
   DE ONTVANGERTOETS -- is dit adres van iemand hier?

   Apart van ./mailaanname.js omdat dat bestand er over de omvangsgrens van
   keuringsregel 13 mee ging, en de naad ligt op een echte grens: dit is een
   BESLUIT over dit huis (wie hier geen postvak heeft, krijgt geen post) en niet
   een stap in de aannameketen. Het staat daarom ook los van het protocol: SMTP
   mag bij RCPT al weigeren, de HTTP-poort krijgt een heel bericht in een keer --
   allebei stellen ze dezelfde vraag, en die hoort er maar een keer te staan.

   `servicePost` komt binnen als GETTER en niet als waarde: RTG Service hangt
   later dan deze keten (opzet/servicelaag.js), dus een verwijzing zou hier altijd
   leeg zijn.
   ========================================================================== */
'use strict';

const adresLaag = require('./rtmail-adres');

module.exports = ({ rtmail, werkmail, findSupplier, team, mailPubliek,
  schoolAdresActief, foundationAdresActief, servicePost }) => {

  /* ---- Is dit adres van iemand hier? ----

     Vier vragen, in deze volgorde, en alle vier zonder netwerk. De eerste die
     "ja" zegt wint; zegt niemand ja, dan hoort dit bericht hier niet.

     WAT HET NIET DOET: raden. Een adres in een domein dat wij voeren is nog
     geen postvak -- "vanalles@rtgpass.rtg" bestaat niet omdat het domein
     bestaat. Precies daar zou een postberg voor niemand ontstaan. */
  function kentAdres(adres) {
    const ruwAdres = rtmail.normAdres(adres);
    const publiekeAlias = mailPubliek.vind(ruwAdres);
    const publiekIntern = publiekeAlias && publiekeAlias.intern;
    const a = publiekIntern || ruwAdres;
    if (!a || a.indexOf('@') < 1) return null;
    const o = adresLaag.ontleed(a);
    const lokaal = String(o.lokaal || '');

    // 1. een zaak met een eigen domein (kern/werkmail.js): het adres moet
    //    bestaan EN aan staan -- een ingetrokken adres is geen postvak meer
    if (werkmail && typeof werkmail.zaakAdresActief === 'function' && werkmail.zaakAdresActief(a)) {
      return { soort: 'werkmail', adres: a, publiek:publiekeAlias && publiekeAlias.publiek };
    }
    if (typeof schoolAdresActief === 'function' && schoolAdresActief(a)) {
      return { soort:'schoolmail', adres:a, publiek:publiekeAlias && publiekeAlias.publiek };
    }
    // Ledenaliassen bestaan alleen als hun HMAC aan een actief account hangt.
    // Foundation-aliassen moeten daarnaast bij een levend profiel horen.
    if (publiekeAlias && publiekeAlias.soort === 'lid' && rtmail.postvak(a, { limit:1 }).length) {
      return { soort:'postvak', adres:a, publiek:publiekeAlias.publiek };
    }
    if (publiekeAlias && publiekeAlias.soort === 'foundation' &&
        typeof foundationAdresActief === 'function' && foundationAdresActief(a)) {
      return { soort:'foundation', adres:a, publiek:publiekeAlias.publiek };
    }
    // Vorm alleen maakt nooit een publiek ledenpostvak.
    if (publiekIntern) return null;
    // buiten onze eigen domeinen zijn wij niet de bestemming. Post doorsturen
    // voor een ander is precies wat een open relay doet, dus: nee.
    if (!o.binnenshuis) return null;

    /* 1b. DE SERVICEBUS. Hij bestaat vanaf de eerste dag en niet pas zodra er
           post op ligt: het adres staat op een scherm en in een handtekening, en
           de eerste melder mag geen bounce krijgen omdat wij nog niets van hem
           hadden. Het adres komt uit kern/service/post.js en wordt hier niet
           overgetypt. */
    if (servicePost() && servicePost().isHulpAdres(a)) return { soort: 'service', adres: a };
    // 2. een zaak, op haar code
    if (findSupplier && findSupplier(lokaal)) return { soort: 'zaak', adres: a };
    // 3. een gedeeld postvak (team), opgezocht op adres -- de teams bewaren hun
    //    eigen adres, en `zelfdeBus` bepaalt of twee schrijfwijzen hetzelfde zijn
    if (team && typeof team.teamOpAdres === 'function' && team.teamOpAdres(a)) return { soort: 'team', adres: a };
    /* 4. WAAR AL POST LIGT, WOONT IEMAND. Dit is de regel die de LEDEN dekt, en
          hij is exacter dan hij klinkt: elk nieuw account krijgt bij aanmelding
          een welkom in zijn postvak (test/rtmail-lid.test.js), dus een bestaand
          lid heeft altijd post. Het alternatief -- het linkerdeel terugrekenen
          naar een codenaam -- kan dit huis niet: de gids zoekt op codenaam en
          niet op de geslugde vorm ervan, en de VORM herkennen zou "lijkt op een
          codenaam" antwoorden op de vraag "bestaat deze persoon". */
    if (rtmail.postvak(a, { limit: 1 }).length) return { soort: 'postvak', adres: a };
    return null;
  }

  return kentAdres;
};
