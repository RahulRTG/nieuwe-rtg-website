/* Sociale graaf, deelbestand "bronnen achter een poort": de drie bronnen die
   niet zomaar leveren. Ze zijn hier weggehaald bij ./bronnen.js omdat dat
   bestand over de 10 kB kwam, en de grens wees precies de goede naad aan: deze
   drie hebben iets wat de andere zes niet hebben, namelijk een vraag vooraf.

   TWEE SOORTEN "NIET NU", en het verschil hoort zichtbaar te blijven:
   - een POORT bij het domein zelf: Vonk eist 18+ met geverifieerd paspoort,
     Rendez-vous de Lifestyle Pass. Die geven een `status` terug in plaats van
     rijen. Dat is niet stil (de bron werkt), het is leeg -- "stuk" en "niet
     voor u" zijn twee verschillende antwoorden;
   - een SCHAKELAAR van het lid zelf (kern/socialebeleid): matches blijven uit
     het beeld, bijvoorbeeld op een gedeeld toestel. De app blijft gewoon
     werken; dit gaat alleen over wat er in dit beeld terechtkomt.

   Verder gelden de regels van ./bronnen.js onverkort: dit is een projectie en
   geen tweede sociaal netwerk, er wordt niets bewaard, en elke veldnaam is
   nagelezen in het domein en niet aangenomen. De kern wordt LAAT gelezen (in de
   functies, nooit bij het laden), zodat de mountvolgorde niet uitmaakt. */
'use strict';

const { dagVan, lijst, moment, LINK } = require('./hulp');

module.exports = ({ kern }) => {

  /* ---- De vriendenlaag: verzoeken en onbeantwoorde gesprekken ----
     Deze bron staat in geen enkel bestaand sociaal scherm, en hij draagt het
     scherpste signaal dat er is: een verbindingsverzoek dat aan MIJ gericht is.
     Het domein filtert zelf al op `requestedBy !== mij`, dus wat hier binnenkomt
     ligt per definitie bij mij.

     De vrienden zelf komen alleen mee als er ongelezen berichten liggen; een
     vriendenlijst is een toestand en geen moment. */
  function vrienden(key) {
    const s = kern.socialConnecties(key) || {};
    /* HET BEREIK-FILTER (kern/socialebeleid). Staat de schakelaar uit, dan komen
       alleen verzoeken in beeld van mensen met wie het lid een genootschap
       deelt. Dit is een FILTER en geen blokkade: blokkeren woont in
       kern/sociaal en blijft daar -- twee lijsten van "wie mag mij bereiken"
       zouden uiteenlopen (LAT.md regel 4). */
    const B = kern.socialebeleid;
    let verzoeken = lijst(s.requests);
    if (B && B.knopAan && !B.knopAan(key, 'bereik')) {
      const bekend = new Set();
      for (const gr of lijst(kern.genootschap.mijne(key))) {
        for (const l of lijst(kern.genootschap.publiek(gr, key).ledenlijst)) bekend.add(l.codenaam);
      }
      verzoeken = verzoeken.filter(r => bekend.has(r.codename));
    }
    const uit = verzoeken.slice(0, 12).map(r => moment({
      soort: 'verzoek', titel: 'Verbindingsverzoek', wie: r.codename,
      wanneer: dagVan(r.at), tijd: r.at, wacht: 'ik', kenmerk: r.key,
      bron: 'Vrienden', link: LINK('app')
    }));
    for (const c of lijst(s.connections)) {
      if (!(c.unread > 0)) continue;
      uit.push(moment({
        soort: 'gesprek', titel: c.last || 'Bericht', wie: c.codename,
        wanneer: dagVan(c.lastAt), tijd: c.lastAt, wacht: 'ik', aantal: c.unread,
        kenmerk: c.key, bron: 'Vrienden', link: LINK('app')
      }));
    }
    return uit.slice(0, 16);
  }

  /* ---- Vonk: de matches ----
     Achter een poort (18+ met geverifieerd paspoort); die geeft een status terug
     in plaats van matches, en dat is leeg en niet stuk. Een match waar nog niet
     betaald is, wacht op mij -- dat is de enige handeling die het domein kent en
     die het lid zelf moet doen. */
  function vonk(key) {
    /* Uitgezet: matches blijven uit het sociale beeld -- bijvoorbeeld op een
       gedeeld toestel. De app zelf blijft gewoon werken; dit gaat alleen over
       wat er in dit beeld terechtkomt. */
    if (kern.socialebeleid && kern.socialebeleid.knopAan && !kern.socialebeleid.knopAan(key, 'vonk')) return [];
    const v = kern.vonkMijn(key) || {};
    if (v.error) return [];
    return lijst(v.matches).slice(0, 8).map(m => moment({
      soort: 'match', titel: m.tafel ? 'Tafel gereserveerd' : 'Match', wie: m.met,
      wanneer: dagVan(m.at), tijd: m.at,
      wacht: m.ikBetaalde ? '' : 'ik',
      aantal: lijst(m.berichten).length, kenmerk: m.id,
      bron: 'Vonk', link: LINK('vonk')
    }));
  }

  /* ---- Rendez-vous: de wederzijdse matches ---- */
  function rendezvous(key) {
    if (kern.socialebeleid && kern.socialebeleid.knopAan && !kern.socialebeleid.knopAan(key, 'vonk')) return [];
    const r = kern.rvMatches(key) || {};
    if (r.error) return [];
    return lijst(r.matches).slice(0, 8).map(m => moment({
      soort: 'match', titel: m.voorstel ? 'Gedeelde plek: ' + m.voorstel : 'Match',
      wie: m.codenaam, wanneer: dagVan(m.sinds), tijd: m.sinds, kenmerk: m.id,
      bron: 'Rendez-vous', link: LINK('rendezvous')
    }));
  }

  return { vrienden, vonk, rendezvous };
};
