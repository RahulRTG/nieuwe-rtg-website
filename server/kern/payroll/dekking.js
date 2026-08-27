/* Payroll OS: DEKKING PER LAND -- waar kan er loon gedraaid worden, en waar niet?

   WAAROM DIT HET BELANGRIJKSTE SCHERM VAN DE HELE LAAG IS. RTG heeft zaken in
   tientallen landen. De loonmotor is landneutraal: hij vraagt het regelpakket
   van het land van de zaak en rekent daarmee. Ligt dat pakket er niet, dan komt
   er geen loonrun -- en dat is precies goed, want met Nederlandse tarieven
   Spaans loon rekenen is erger dan niet rekenen.

   Maar "er komt geen loonrun" mag geen STILTE zijn. Zonder dit overzicht merkt
   niemand dat er in tweeenzeventig zaken personeel werkt waarvoor geen enkele
   tabel ligt; je ontdekt het op de dag dat iemand vraagt waar zijn loonstrook
   blijft. Dit bestand maakt van die stilte een lijst.

   DRIE STANDEN, EN ZE ZEGGEN ALLE DRIE IETS ANDERS:

     draait          er ligt een goedgekeurd pakket dat geldt op de peildatum
     wacht_op_mens   er ligt een pakket, maar niemand heeft het aangemerkt;
                     een proefrun mag, een definitieve niet
     geen_tabel      er ligt niets dat geldt -- hier kan geen loon gedraaid
                     worden, en dat hoort in kapitalen op het scherm

   WAT ER WEL IS ALS ER GEEN TABEL IS. De fiscaal-tabel (kern/fiscaal/landen.js)
   kent van 189 landen het minimumuurloon, het vakantiegeldpercentage en de
   werkgeverslasten. Dat is echte kennis en die tonen we, met de peiljaar-
   waarschuwing erbij -- maar het is GEEN regelpakket, want de loonheffing
   ontbreekt en die verzinnen we niet. Het overzicht zegt daarom precies wat er
   nog moet komen per land, in plaats van "niet beschikbaar".

   WAT HIER GEEN BEDRAGEN STAAN: geen enkel. Alles komt uit het regelpakket of
   uit de fiscaal-tabel, met vermelding van waar het vandaan komt. */
'use strict';

/* De velden die een regelpakket nodig heeft en die de fiscaal-tabel NIET kent.
   Dit is de kern van het antwoord "wat ontbreekt er nog voor dit land". */
const UIT_FISCAAL = { minimumUurloon: 'uurloonMin', vakantiegeld: 'vakantiegeld', premies: 'lasten' };
const NIET_UIT_FISCAAL = ['loonheffing', 'zvw'];

function maakDekking({ opslag, save, nu, regelpakket, LANDEN, accounts }) {
  const tijd = nu || (() => new Date().toISOString());
  const norm = (l) => String(l || 'NL').toUpperCase();

  /* ---------- waar werkt RTG eigenlijk? ----------
     Uit de zaken zelf, niet uit een lijst die iemand bijhoudt. Een lijst die
     met de hand wordt bijgewerkt loopt achter op de werkelijkheid, en dan mist
     het overzicht precies het land waar net een zaak is bijgekomen. */
  function landenMetWerk() {
    const per = new Map();
    for (const s of opslag.vreemd.leveranciers()) {
      const land = norm((s.settings && s.settings.land) || 'NL');
      if (!per.has(land)) per.set(land, { land, zaken: 0, personeel: 0, codes: [] });
      const r = per.get(land);
      r.zaken++;
      r.codes.push(s.code);
      try { r.personeel += accounts && accounts.countStaff ? accounts.countStaff(s.code) : 0; } catch (e) { /* telt dan niet mee */ }
    }
    return [...per.values()].sort((a, b) => b.personeel - a.personeel || b.zaken - a.zaken);
  }

  /* Het BRONNENREGISTER (welk adres levert het regelpakket van welk land) staat
     in ./dekking-bronnen.js: een eigen onderwerp naast de vraag of een land kan
     draaien, en dit bestand ging over de 10 KB. */
  const bronnen = require('./dekking-bronnen')({ opslag, save, tijd });
  const { bronnenVan, alleBronnen, zetBron, haalBronWeg, noteerBron } = bronnen;

  /* ---------- de dekking ---------- */
  /* Wat de fiscaal-tabel van dit land weet. Echte kennis, maar met een
     peiljaar: een minimumloon van vorig jaar is geen minimumloon. */
  function uitFiscaal(land) {
    const f = (LANDEN || {})[norm(land)];
    if (!f) return null;
    return {
      naam: f.naam || norm(land),
      minimumUurloonCenten: Number.isFinite(f.uurloonMin) ? Math.round(f.uurloonMin * 100) : null,
      /* IN EURO'S, EN DAT MOET ERBIJ. De fiscaal-tabel noteert het minimumloon
         van elk land omgerekend naar euro's -- Japan staat er op 6,70 terwijl
         de wet daar in yen spreekt. Als richtgetal is dat bruikbaar; als
         loonregel is het onbruikbaar, want het beweegt met de wisselkoers mee
         en een loonstrook mag dat niet. Zonder dit veld leest een scherm het
         als de wettelijke waarde, en dan gaat iemand ermee rekenen. */
      valutaVanBedragen: 'EUR',
      let: 'De bedragen hieronder staan omgerekend in euro\'s en zijn richtgetallen, geen wettelijke waarden in de eigen munt. Een loonrun draait er niet op.',
      vakantiegeld: Number.isFinite(f.vakantiegeld) ? f.vakantiegeld : null,
      werkgeverslasten: Number.isFinite(f.lasten) ? f.lasten : null,
      aangifte: f.aangifte || null
    };
  }

  /* Wat er nog moet komen voordat dit land loon kan draaien. Geen "niet
     beschikbaar" maar een lijst met namen, want dat is het verschil tussen een
     blokkade en een opdracht. */
  function ontbreekt(land) {
    const f = uitFiscaal(land);
    const uit = [];
    for (const veld of NIET_UIT_FISCAAL) uit.push(veld);
    for (const veld of Object.keys(UIT_FISCAAL)) {
      const bron = f && f[veld === 'minimumUurloon' ? 'minimumUurloonCenten'
        : veld === 'premies' ? 'werkgeverslasten' : 'vakantiegeld'];
      if (bron == null) uit.push(veld);
    }
    return uit;
  }

  function voorLand(land, peildatum) {
    const l = norm(land);
    const dag = String(peildatum || tijd()).slice(0, 10);
    const geldend = regelpakket.opDatum(l, dag);
    const alle = regelpakket.alle(l);
    const f = uitFiscaal(l);

    let stand = 'geen_tabel';
    if (geldend && geldend.stand === 'goedgekeurd') stand = 'draait';
    else if (geldend) stand = 'wacht_op_mens';
    /* 'draait' zegt niet WAAROP. Een land kan draaien op tabellen die zelf
       melden dat ze niet tegen de bron zijn gelegd; iemand heeft ze
       uitdrukkelijk aangemerkt en dat mag, maar op een dekkingsoverzicht is
       "draait" dan een half antwoord. Geen vierde stand -- die zou elke lezer
       van deze lijst opnieuw moeten leren -- maar een vlag naast de stand. */
    const opDemoTabellen = !!(geldend && geldend.opDemoTabellen);

    return {
      land: l, naam: (f && f.naam) || l, stand, opDemoTabellen,
      pakket: geldend ? { versie: geldend.versie, geldigVan: geldend.geldigVan,
        geldigTot: geldend.geldigTot, stand: geldend.stand,
        goedgekeurdDoor: geldend.goedgekeurdDoor, bron: geldend.bron,
        waarschuwing: geldend.waarschuwing || null, ondanksWaarschuwing: geldend.ondanksWaarschuwing || null } : null,
      pakketten: alle.length,
      bronnen: bronnenVan(l).map(b => ({ naam: b.naam, url: b.url, laatst: b.laatst, laatsteFout: b.laatsteFout })),
      /* Alleen invullen als er GEEN pakket is. Ligt er wel een, dan is de
         fiscaal-tabel niet meer de waarheid en zou hem tonen twee bronnen naast
         elkaar zetten -- precies waar dit hele ontwerp tegen is. */
      fiscaal: geldend ? null : f,
      ontbreekt: geldend ? [] : ontbreekt(l)
    };
  }

  /* Het wereldbeeld: elk land waar RTG werk heeft, met zijn stand. Landen
     zonder zaken staan er niet bij -- een dekkingslijst van 189 landen waarvan
     er 170 leeg zijn, leest niemand. */
  function wereld(peildatum) {
    const werk = landenMetWerk();
    const rijen = werk.map(w => Object.assign(voorLand(w.land, peildatum),
      { zaken: w.zaken, personeel: w.personeel }));
    const telling = { draait: 0, wacht_op_mens: 0, geen_tabel: 0,
      personeelZonderTabel: 0, zakenZonderTabel: 0 };
    for (const r of rijen) {
      telling[r.stand]++;
      if (r.stand !== 'draait') { telling.personeelZonderTabel += r.personeel; telling.zakenZonderTabel += r.zaken; }
    }
    return { at: tijd(), peildatum: String(peildatum || tijd()).slice(0, 10), landen: rijen, telling };
  }

  /* Welke jaargang binnenkort afloopt zonder opvolger: ./dekking-verval.
     Vooruitkijken is een eigen vraag naast "kan dit land vandaag draaien". */
  const { verlooptBinnen } = require('./dekking-verval')({ tijd, regelpakket, landenMetWerk });

  return { wereld, voorLand, landenMetWerk, verlooptBinnen,
    bronnenVan, alleBronnen, zetBron, haalBronWeg, noteerBron, UIT_FISCAAL, NIET_UIT_FISCAAL };
}

module.exports = { maakDekking, UIT_FISCAAL, NIET_UIT_FISCAAL };
