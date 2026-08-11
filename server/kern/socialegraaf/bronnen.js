/* Sociale graaf, deelbestand "bronnen": de negen sociale domeinen, elk vertaald
   naar momenten in de vaste vorm (zie ./hulp.js, `moment`).

   DIT IS EEN PROJECTIE EN GEEN TWEEDE SOCIAAL NETWERK. Elke bron leest
   uitsluitend wat zijn domein al exporteert; er wordt hier niets bewaard,
   niets geschreven en niets geteld dat een domein zelf al telt. Praten,
   plaatsen, aanmelden en matchen gebeurt in de app die het echte werk doet.

   ELKE VELDNAAM HIER IS NAGELEZEN IN HET DOMEIN, niet aangenomen. Dat staat er
   omdat het de ene fout is die deze laag echt heeft gemaakt: kern/socialewereld.js
   las `bijeenkomst.titel` (het domein levert `wat`) en `pulse.naam` (het domein
   levert `codenaam`), en toonde daardoor bijeenkomsten zonder titel en berichten
   zonder afzender. Twee lege strings, nul klachten. Wie hier een bron bijzet,
   opent het domeinbestand en kijkt -- de vorm van andermans data raad je niet.

   Elke bron valt in zijn eigen try/catch en komt bij een fout met naam in stil[].
   Een sociaal beeld waaruit een bron is weggevallen ZIET ER COMPLEET UIT, en dan
   blijft er iemand onbeantwoord.

   TWEE DOMEINEN HEBBEN EEN POORT en dat is geen fout: Vonk eist 18+ met
   geverifieerd paspoort, Rendez-vous de Lifestyle Pass. Die geven een `status`
   terug in plaats van rijen. Dat is niet stil (de bron werkt), het is leeg -- en
   het verschil tussen "stuk" en "niet voor u" hoort zichtbaar te blijven.

   De kern wordt LAAT gelezen (in de functies, nooit bij het laden), zodat de
   mountvolgorde van de kernlagen er niet toe doet. */
'use strict';

const { dagVan, lijst, moment, LINK } = require('./hulp');

module.exports = ({ kern }) => {

  /* ---- Berichten: alleen wat op mij WACHT ----
     Een inbox uitputtend herhalen is het werk van Berichten zelf; hier hoort
     alleen te staan wat onbeantwoord is. Stilgezette gesprekken tellen niet:
     die heeft het lid zelf het zwijgen opgelegd, en dat besluit respecteren we
     in plaats van het te overrulen met een teller. */
  function gesprekken(key) {
    const i = kern.comm.inbox(key) || {};
    return lijst(i.gesprekken)
      .filter(g => g.ongelezen > 0 && !g.stil)
      .slice(0, 12)
      .map(g => moment({
        soort: 'gesprek', titel: g.titel, wanneer: dagVan(g.at), tijd: g.at,
        wacht: 'ik', aantal: g.ongelezen, kenmerk: g.id,
        bron: 'Berichten', link: LINK('comm')
      }));
  }

  /* ---- Genootschap, de bijeenkomsten ----
     Het domein levert `wat` en niet `titel`; zie de kop. `mijnAntwoord` is de
     reden dat dit een wachtstand kan dragen: een bijeenkomst waar ik nog niet op
     geantwoord heb, ligt bij mij. Heb ik wel geantwoord, dan is er niets meer te
     doen en staat er ook geen wachtstand -- ook niet als de datum dichtbij is.
     Nabijheid is geen taak. */
  function bijeenkomsten(key) {
    const b = kern.bijeenkomst.mijnAgenda({ key }) || {};
    return lijst(b.komt).slice(0, 12).map(x => moment({
      soort: 'bijeenkomst', titel: x.wat, wie: x.groep,
      wanneer: x.datum, tijd: x.tijd,
      wacht: x.mijnAntwoord ? '' : 'ik', kenmerk: x.id,
      bron: 'Genootschap', link: LINK('genootschap')
    }));
  }

  /* ---- Genootschap, de uitnodigingen ----
     Een uitnodiging die voor mij klaarligt is het zuiverste "er wacht iets op
     mij" dat dit huis kent: iemand heeft een handeling gedaan en het antwoord
     ligt bij mij. Groepen waar ik al lid van ben leveren hier niets op -- dat is
     een toestand, geen moment. */
  function uitnodigingen(key) {
    const g = kern.genootschap.mijn({ key }) || {};
    return lijst(g.uitnodigingen).slice(0, 12).map(gr => moment({
      soort: 'uitnodiging', titel: gr.naam, wie: gr.naam,
      wacht: 'ik', aantal: gr.leden, kenmerk: gr.id,
      bron: 'Genootschap', link: LINK('genootschap')
    }));
  }

  /* ---- Pulse: wat er in de kring geplaatst is ----
     Het domein levert de afzender als `codenaam`; zie de kop. Dit is de enige
     bron zonder wachtstand, en met opzet: een bericht lezen is geen taak. Het
     staat er omdat een sociaal beeld zonder wat er leeft alleen nog een
     takenlijst is. */
  function kring(key) {
    const p = kern.pulseFeed(key, 'volgend') || {};
    return lijst(p.feed).slice(0, 8).map(x => moment({
      soort: 'bericht', titel: String(x.tekst || '').slice(0, 70) || 'Bericht',
      wie: x.codenaam, wanneer: dagVan(x.at), tijd: x.at,
      aantal: x.reacties ? x.reacties.length : null, kenmerk: x.id,
      bron: 'Pulse', link: LINK('pulse')
    }));
  }

  /* ---- De Salon: reacties op mijn eigen posts ----
     Alleen posts waar iets op GEBEURD is, en gearchiveerde tellen niet mee: die
     heeft het lid zelf uit de etalage gehaald. Geen wachtstand -- een reactie
     vraagt geen antwoord, en er staat hier geen mechaniek die dat suggereert
     (LIFE.md par. 4.4). */
  function salon(key) {
    const o = kern.salonInzicht.overzicht(key) || {};
    return lijst(o.posts)
      .filter(p => !p.gearchiveerd && p.reacties > 0)
      .slice(0, 8)
      .map(p => moment({
        soort: 'post', titel: p.tekst || 'Post', wanneer: dagVan(p.at), tijd: p.at,
        aantal: p.reacties, kenmerk: p.id,
        bron: 'De Salon', link: LINK('salon')
      }));
  }

  /* ---- De vriendenlaag: verzoeken en onbeantwoorde gesprekken ----
     Deze bron staat in geen enkel bestaand sociaal scherm, en hij draagt het
     scherpste signaal dat er is: een verbindingsverzoek dat aan MIJ gericht is.
     Het domein filtert zelf al op `requestedBy !== mij`, dus wat hier binnenkomt
     ligt per definitie bij mij.

     De vrienden zelf komen alleen mee als er ongelezen berichten liggen; een
     vriendenlijst is een toestand en geen moment. */
  function vrienden(key) {
    const s = kern.socialConnecties(key) || {};
    const uit = lijst(s.requests).slice(0, 12).map(r => moment({
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
    const r = kern.rvMatches(key) || {};
    if (r.error) return [];
    return lijst(r.matches).slice(0, 8).map(m => moment({
      soort: 'match', titel: m.voorstel ? 'Gedeelde plek: ' + m.voorstel : 'Match',
      wie: m.codenaam, wanneer: dagVan(m.sinds), tijd: m.sinds, kenmerk: m.id,
      bron: 'Rendez-vous', link: LINK('rendezvous')
    }));
  }

  /* ---- Meet: de kamers waar ik in mag ----
     Alleen kamers waar op dit moment iemand IN zit. Een lege vergaderkamer is
     meubilair; een kamer waar drie mensen zitten te wachten is een moment. */
  function meet(key) {
    const m = kern.meetMijn(key) || {};
    return lijst(m.kamers)
      .filter(k => lijst(k.aanwezig).length > 0)
      .slice(0, 6)
      .map(k => moment({
        soort: 'kamer', titel: k.titel || 'Vergaderkamer',
        wie: lijst(k.aanwezig).join(', '),
        wanneer: dagVan(k.laatst), tijd: k.laatst,
        aantal: lijst(k.aanwezig).length, kenmerk: k.id,
        bron: 'Meet', link: LINK('meet')
      }));
  }

  const ALLE = [
    { naam: 'gesprekken', lever: gesprekken },
    { naam: 'bijeenkomsten', lever: bijeenkomsten },
    { naam: 'uitnodigingen', lever: uitnodigingen },
    { naam: 'kring', lever: kring },
    { naam: 'salon', lever: salon },
    { naam: 'vrienden', lever: vrienden },
    { naam: 'vonk', lever: vonk },
    { naam: 'rendezvous', lever: rendezvous },
    { naam: 'meet', lever: meet }
  ];

  /* 'termijnen' staat in de namenlijst maar niet in ALLE: die komt niet uit een
     sociale app maar uit de levensgraaf (./vooruitblik.js). Hij hoort wel in de
     lijst, zodat het scherm "termijnen zijn stil" op dezelfde manier kan tonen
     als elke andere stille bron. */
  const NAMEN = ALLE.map(b => b.naam).concat(['termijnen']);

  function verzamel(key) {
    const momenten = [], stil = [];
    for (const b of ALLE) {
      try { for (const m of b.lever(key) || []) momenten.push(m); }
      catch (e) { stil.push(b.naam); }
    }
    return { momenten, stil, bronnen: NAMEN };
  }

  return { verzamel, NAMEN };
};
