/* DE REISUITNODIGING, GEBRUIKSKANT (hoort bij kern/reisuitnodiging.js).

   Het maken staat daar; hier staat wat er met een bestaande uitnodiging kan:
   openen (het beperkte beeld), opeisen (met de identiteitscontrole voor een
   reisgenoot), intrekken en de eigen lijst. De regels zelf -- wat er te zien is
   en waarom, en waarom een reisgenoot zich legitimeert -- staan in de kop van
   het hoofdbestand en in REIZEN.md par. 4.8. */
'use strict';

module.exports = ({ bak, save, vindCode, verlopen, invoer, idGeverifieerd, nu }) => {

  /* Het beperkte beeld. Genoeg om te herkennen dat het over jou gaat, te weinig
     om er iets mee te doen -- zie de kop. */
  function open(code) {
    const u = vindCode(code);
    if (!u) return { status: 404, error: 'Deze uitnodiging kennen we niet. Controleer de link.' };
    const telling = {};
    for (const o of u.onderdelen) telling[o.soort] = (telling[o.soort] || 0) + 1;
    return {
      ok: true,
      uitnodiging: {
        soort: u.soort, bestemming: u.bestemming, venster: u.venster,
        aantal: u.onderdelen.length, soorten: telling,
        van: u.soort === 'klaargezet' ? 'het RTG-reisbureau' : (u.doorCodenaam || 'een RTG-lid'),
        geldigTot: u.geldigTot,
        idNodig: u.soort === 'reisgenoot',
        open: !u.ingetrokken && !u.opgeeist && !verlopen(u),
        reden: u.ingetrokken ? 'Deze uitnodiging is ingetrokken.'
          : u.opgeeist ? 'Deze uitnodiging is al gebruikt.'
            : verlopen(u) ? 'Deze uitnodiging is verlopen.' : null
      }
    };
  }

  /* Opeisen. Vanaf hier is er een sessie, en dus een mens met een account. */
  function eisOp(sess, code) {
    const u = vindCode(code);
    if (!u) return { status: 404, error: 'Deze uitnodiging kennen we niet. Controleer de link.' };
    if (u.ingetrokken) return { status: 409, error: 'Deze uitnodiging is ingetrokken.' };
    if (u.opgeeist) return { status: 409, error: 'Deze uitnodiging is al gebruikt.' };
    if (verlopen(u)) return { status: 409, error: 'Deze uitnodiging is verlopen. Vraag om een nieuwe.' };
    if (u.door === sess.key) return { status: 409, error: 'Dit is uw eigen uitnodiging; die is voor iemand anders bedoeld.' };
    /* DE IDENTITEITSCONTROLE, en alleen waar zij ergens over gaat. Een
       reisgenoot komt in de reis van een ANDER; dat mag alleen als vaststaat wie
       hij is. Dat is de bestaande verificatielaag van dit huis (paspoort +
       ballotage), niet een eigen controle van deze module -- er komt geen tweede
       manier bij om iemands identiteit vast te stellen. Wie zijn EIGEN reis
       overneemt van het reisbureau hoeft dit niet: dat is zijn eigen reis. */
    if (u.soort === 'reisgenoot' && !(idGeverifieerd && idGeverifieerd(sess)))
      return { status: 403, error: 'Een medereiziger komt in de reisgegevens van iemand anders. Rond eerst de identiteitscontrole van uw account af; daarna kunt u deze uitnodiging aannemen.' };

    /* De onderdelen worden overgedragen aan de Invoerbalie: dat is de plek waar
       reisonderdelen wonen die niet uit een RTG-domein komen. Een tweede plek
       zou een tweede antwoord geven op "waar staat mijn reis" (LAT-regel 4).

       De HERKOMST verschilt per schakel, en dat is geen detail: wie een reis van
       zijn reisgenoot overneemt, heeft dat hotel niet zelf geboekt en dat
       document niet. Voor hem is de bron een ander lid. */
    const herkomst = u.soort === 'reisgenoot' ? 'gedeeld' : null;
    const r = invoer.neemOver(sess.key, {
      onderdelen: u.onderdelen, herkomst,
      bron: u.soort === 'reisgenoot' ? ('gedeeld door ' + (u.doorCodenaam || 'een RTG-lid')) : 'klaargezet door het RTG-reisbureau'
    });
    if (r && r.error) return r;
    u.opgeeist = { key: sess.key, at: nu() };
    save();
    return { ok: true, overgenomen: r.onderdelen.length, onderdelen: r.onderdelen,
      bestemming: u.bestemming, venster: u.venster };
  }

  function trekIn(door, id) {
    const u = bak()[String(id || '')];
    if (!u || u.door !== door) return { status: 404, error: 'Deze uitnodiging staat niet op uw naam.' };
    if (u.opgeeist) return { status: 409, error: 'Deze uitnodiging is al gebruikt; intrekken kan niet meer.' };
    u.ingetrokken = true;
    save();
    return { ok: true };
  }

  /* De lijst voor wie hem verstuurde. De code komt hier WEL mee: de medewerker
     of het lid moet de link kunnen kopieren. Voor iedereen anders bestaat deze
     lijst niet. */
  const lijst = (door) => Object.values(bak()).filter(u => u.door === door)
    .sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 100)
    .map(u => ({ id: u.id, soort: u.soort, bestemming: u.bestemming, venster: u.venster,
      aantal: u.onderdelen.length, geldigTot: u.geldigTot, ingetrokken: u.ingetrokken,
      opgeeist: !!u.opgeeist, link: '/apps/reisuitnodiging.html?code=' + u.code }));

  return { open, eisOp, trekIn, lijst };
};
