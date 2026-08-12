/* De objectlaag, deelbestand "samen": de relatieruimte (LIFE.md fase 3).

   WAT DIT IS. Bij een persoon hoort niet alleen wat u met hem KUNT (de caps),
   maar ook wat u met hem HEEFT: de bijeenkomsten waar u allebei ja op zei, het
   potje dat loopt, het lijstje dat u samen bijhoudt. Dat is de relatieruimte.

   WAT DIT NIET IS, EN WAAROM DAT DE HELE OPZET BEPAALT. Geen opslag. Er is geen
   collectie "relatie", geen gedeelde tijdlijn die wordt bijgehouden, geen
   toestemmingslaag erbovenop. Alles hier komt uit domeinen waar BEIDE mensen
   deelnemer zijn -- en daar zit de clou:

   > LIFE.md par. 4.2 zegt dat een relatieruimte van twee mensen is en niet van
   > een. Als de ruimte een PROJECTIE is over dingen waar allebei in zitten, dan
   > is die regel geen controle die je kunt vergeten maar een eigenschap van de
   > constructie. Er kan hier niets in staan dat de ander niet ook ziet, want
   > het staat er alleen omdat hij meedoet.

   Een eigen opslag zou dat weggooien: dan bestaat er een ruimte die van EEN
   kant gevuld is, met gegevens over een ander mens, en dan is elke waarborg
   weer een regel die iemand moet handhaven.

   WAAROM NIET OP kern/levensband. Het faseplan in LIFE.md zei "de relatieruimte
   op levensband", en dat is bij het bouwen nagemeten en fout gebleken. Een band
   daar is structureel `{ lid, profiel }`: een RTG-lid tegenover een
   GEZINSPROFIEL van de RTFoundation, met soorten als ouder, kind, leerkracht en
   vertrouwenspersoon (LEVEN.md par. 2.8). Dat is de toestemmingsbrug tussen twee
   sessiewerelden, niet de relatie tussen twee leden. Er een lid-lid-ruimte op
   bouwen zou een laag forceren die iets anders bewaart -- precies de fout waar
   PLATFORM.md voor waarschuwt bij Cercle en Entourage: twee dingen die hetzelfde
   KLINKEN en andere data en werkstromen hebben.

   WAT ER DUS NIET IN KAN, en dat hoort hier te staan: een gedeeld fotoalbum,
   een gedeelde notitie of een gedeelde kas tussen twee leden. Die bestaan niet
   als domein, en ze verzinnen zou betekenen dat deze laag alsnog gaat bewaren.
   Wie ze wil, bouwt eerst het domein; de ruimte projecteert het daarna gratis. */
'use strict';

/* Uit levensgraaf/hulp, waar ze wonen -- niet uit socialegraaf/hulp (die heeft
   een eigen `moment`-vorm die hier niet past) en niet overgetikt. */
const { dagVan, lijst } = require('../levensgraaf/hulp');

/* Hoeveel gedeelde groepen we nalopen voor bijeenkomsten. Wie er meer heeft,
   heeft geen kring meer maar een agenda -- en de ruimte is een beeld, geen
   archief. */
const GROEP_MAX = 12;
const REGELS_MAX = 20;

module.exports = ({ kern }) => {

  const regel = (o) => ({
    soort: String(o.soort || ''),
    wat: String(o.wat == null ? '' : o.wat).slice(0, 120),
    wanneer: o.wanneer || null,
    waar: String(o.waar || '').slice(0, 80),
    bron: String(o.bron || ''),
    /* GEWEEST OF KOMEND, en niets ertussenin. Geen "over 3 dagen" en geen
       telling: dat is de taal van een aftelklok, en die hoort niet op het leven
       tussen mensen (LIFE.md par. 4.4). */
    komt: !!o.komt
  });

  /* De bijeenkomsten waar u ALLEBEI ja op zei, uit de groepen die u deelt.
     `komen` levert het domein zelf (kern/genootschap/bijeenkomst.js, publiek());
     hier wordt alleen gefilterd. Een bijeenkomst waar de ander niet op
     geantwoord heeft, is geen gedeeld moment maar een hoop. */
  function bijeenkomsten(key, codenaam) {
    const vandaag = new Date().toISOString().slice(0, 10);
    const uit = [];
    const sess = { key };
    for (const gr of lijst(kern.genootschap.mijne(key)).slice(0, GROEP_MAX)) {
      const p = kern.genootschap.publiek(gr, key);
      if (!lijst(p.ledenlijst).some(l => l.codenaam === codenaam)) continue;
      for (const b of lijst(kern.bijeenkomst.lijstVan(gr.id))) {
        const v = kern.bijeenkomst.publiek(b, sess);
        if (v.afgelast) continue;
        if (v.mijnAntwoord !== 'ja') continue;
        if (!lijst(v.komen).includes(codenaam)) continue;
        uit.push(regel({ soort: 'bijeenkomst', wat: v.wat, wanneer: v.datum, waar: v.waar,
          bron: p.naam, komt: v.datum >= vandaag }));
      }
    }
    return uit;
  }

  /* Het lopende potje. Een uitslag komt hier NIET in: alles wat een prestatie
     buiten het potje bewaart hangt aan kern/spellen/grens.js (18+), en een
     winst-verliesbalans tussen twee mensen is bovendien precies de score die
     LIFE.md par. 4.4 verbiedt. Een lopend potje is een bezigheid. */
  function spellen(key, codenaam) {
    const s = kern.mijnSpellen(key) || {};
    return lijst(s.potjes)
      .filter(p => p.status === 'bezig' && lijst(p.spelers).includes(codenaam))
      .map(p => regel({ soort: 'spel', wat: p.naam, wanneer: dagVan(p.at),
        bron: 'RTG Spelen', komt: true }));
  }

  /* De lijstjes die u samen bijhoudt. Het SALDO komt hier niet in beeld: dat
     is de taal van RTG Geld en het staat daar al, en een bedrag naast iemands
     naam in een sociale ruimte maakt van een vriend een debiteur. De ruimte
     zegt dat u iets samen bijhoudt en wijst de weg erheen. */
  function lijstjes(key, codenaam) {
    const m = kern.wbwMijn(key) || {};
    const uit = [];
    for (const g of lijst(m.groepen).slice(0, GROEP_MAX)) {
      const d = kern.wbwGroep(key, g.id) || {};
      const leden = (d.groep && d.groep.leden) || [];
      if (!leden.some(l => l.codenaam === codenaam)) continue;
      uit.push(regel({ soort: 'lijstje', wat: g.naam, wanneer: dagVan(g.at),
        bron: 'Wie betaalt wat', komt: true }));
    }
    return uit;
  }

  const BRONNEN = [
    { naam: 'bijeenkomsten', lever: bijeenkomsten },
    { naam: 'spellen', lever: spellen },
    { naam: 'lijstjes', lever: lijstjes }
  ];

  /* Wat komt bovenaan, in oplopende tijd; wat geweest is eronder, aflopend --
     zoals een mens zijn eigen agenda leest. Een bron die stukgaat neemt de
     andere niet mee en komt met naam terug. */
  function samen(key, codenaam) {
    const alles = [], stil = [];
    for (const b of BRONNEN) {
      try { for (const r of b.lever(key, codenaam) || []) alles.push(r); }
      catch (e) { stil.push(b.naam); }
    }
    const komt = alles.filter(r => r.komt)
      .sort((a, b) => String(a.wanneer || '9999').localeCompare(String(b.wanneer || '9999')));
    const geweest = alles.filter(r => !r.komt)
      .sort((a, b) => String(b.wanneer || '').localeCompare(String(a.wanneer || '')));
    return {
      samen: komt.concat(geweest).slice(0, REGELS_MAX),
      /* Een telling van DINGEN, niet van de relatie. "2 groepen, 1 lopend spel"
         is een feit; een cijfer dat zegt hoe goed het gaat tussen twee mensen
         is een oordeel en komt hier nooit (LIFE.md par. 4.4). */
      telling: { komt: komt.length, geweest: geweest.length },
      stil
    };
  }

  return { samen, BRONNEN };
};
