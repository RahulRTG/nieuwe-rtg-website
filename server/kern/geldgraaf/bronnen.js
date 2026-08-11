/* Geldgraaf, deelbestand "bronnen": de vijf gelddomeinen, elk vertaald naar
   feiten in de vaste vorm (zie ./hulp.js, `feit`).

   De regel van kern/geldwereld.js geldt hier onverkort: dit is een projectie
   en geen tweede boekhouding. Elke bron leest UITSLUITEND wat zijn domein
   exporteert -- pay telt zijn eigen saldi, wbw zijn eigen verrekeningen,
   mecenaat zijn eigen sommen -- en er wordt hier niets opgeteld dat een
   domein al optelt. Waar een alleen-lezen export ontbrak, is die in het
   domein zelf toegevoegd (pay.boekingenVan, labfonds.mijnBijdragen), zodat
   de vorm van andermans data nooit op een tweede plek wordt nagelezen.

   Elke bron valt in zijn eigen try/catch en komt bij een fout met naam in
   stil[]. Bij geld weegt dat het zwaarst van alles: een geldbeeld zonder een
   van zijn bronnen LIJKT gezond, en dan doet iemand een uitgave die hij met
   het volledige beeld niet had gedaan.

   De kern wordt LAAT gelezen (in de functies, nooit bij het laden), zodat de
   mountvolgorde van de kernlagen er niet toe doet -- zelfde reden als in
   kern/geldwereld.js. */
'use strict';

const { vandaag, dagVan, plusDagen, dagenTussen, feit, LINK } = require('./hulp');

module.exports = ({ kern }) => {

  /* Een tegenrekening leesbaar maken zonder de kluis aan te raken: codenamen
     en zaakcodes ZIJN hier de identiteit (privacy by design); echte namen
     bestaan in deze laag niet. */
  const tegenNaam = (rek) => {
    const r = String(rek || '');
    if (r === 'extern:oplaad') return 'Opladen';
    if (r === 'extern:uitbetaald') return 'Uitbetaling';
    if (r.startsWith('extern:')) return 'Extern';
    const i = r.indexOf(':');
    return i > -1 ? r.slice(i + 1) : r;
  };

  /* WALLET: het saldo plus de boekingen van de lidrekening. De rekeningnaam
     komt uit pay.rekLid en wordt niet nagetikt; de historie komt uit
     pay.boekingenVan (daar toegevoegd, alleen-lezen). 400 boekingen is ruim
     een jaar maandelijkse posten plus dagelijks verkeer: genoeg voor de
     patroonherkenning, en begrensd zodat een druk grootboek de cockpit niet
     traag maakt. */
  function walletFeiten(key) {
    const rek = kern.pay.rekLid(kern.codenaamVan(key));
    const uit = [feit({
      soort: 'saldo', titel: 'RTG-wallet', centen: kern.pay.saldoVan(rek),
      richting: '', bron: 'wallet', link: LINK('wallet')
    })];
    for (const b of kern.pay.boekingenVan(rek, 400)) {
      const richting = b.van === rek ? 'uit' : 'in';
      uit.push(feit({
        soort: 'transactie',
        titel: b.oms || tegenNaam(richting === 'uit' ? b.naar : b.van),
        centen: b.centen, richting,
        wanneer: dagVan(b.at), tijd: new Date(b.at).toISOString(),
        bron: 'wallet', link: LINK('wallet')
      }));
    }
    return uit;
  }

  /* WIE BETAALT WAT: alleen lijstjes waar het eigen saldo niet nul is; een
     lijstje dat glad staat is geen openstaande zaak. Het saldo komt uit
     wbwMijn (het domein rekent zelf), hier alleen omgezet naar richting plus
     absoluut bedrag omdat de feitvorm geen negatieve bedragen kent. Geen
     `wanneer`: een openstaande verrekening heeft geen datum, en de
     vooruitblik telt hem daarom bewust niet mee. */
  function wbwFeiten(key) {
    const w = kern.wbwMijn(key) || {};
    return (w.groepen || []).filter(g => g.mijnSaldo !== 0).map(g => feit({
      soort: 'verrekening', titel: g.naam,
      centen: Math.abs(g.mijnSaldo),
      richting: g.mijnSaldo > 0 ? 'in' : 'uit',
      bron: 'wbw', link: LINK('wbw')
    }));
  }

  /* MECENAAT: de open toezeggingen. Betaalde giften blijven bij het domein
     zelf (het mecenaat-scherm toont ze al; de graaf hoeft niets dubbel te
     tonen). Alleen periode 'maand' wordt herhaling 'maandelijks': de
     feitvorm kent geen kwartaal of jaar, en een kwartaalgift als maandelijks
     projecteren zou drie keer te veel lasten verzinnen -- dan liever
     eenmalig op zijn datum. */
  function mecenaatFeiten(key) {
    /* kijk-variant: kern.mecenaat() gaat via L() en ZET het lifestyle-dossier
       op voor wie alleen keek (zie het waarom in kern/rechterhand/mecenaat.js).
       Een graaf die belooft alleen te lezen, hoort dat ook te doen. */
    const giften = kern.mecenaatKijk(key);
    const uit = [];
    for (const g of giften) {
      if (g.betaald) continue;
      uit.push(feit({
        /* MAAL HONDERD, en dat is geen slordigheid maar de uitzondering die
           dit huis heeft: mecenaat bewaart HELE EURO'S, niet centen (zie
           kern/rechterhand/mecenaat.js en de opmerking in
           public/apps/geld/mecenaat.js). Stond het er rauw, dan telde een
           toezegging van 500 euro als vijf euro mee in de lasten, de
           vooruitblik en de verwachtingszin, en ging de gift-bevestiging van
           het beleid vrijwel nooit af. De omzetting hoort bij de bron, hier,
           een keer -- precies zoals payroll dat hierboven ook doet. */
        soort: 'toezegging', titel: g.doel, centen: Math.round((Number(g.bedrag) || 0) * 100), richting: 'uit',
        wanneer: g.datum || null,
        herhaling: g.periode === 'maand' ? 'maandelijks' : null,
        tijd: g.at, bron: 'mecenaat', link: LINK('mecenaat')
      }));
    }
    return uit;
  }

  /* LAB-FONDS: de eigen bijdragen, als gebeurtenissen voor de tijdlijn. Ze
     lopen niet door de wallet (het fonds houdt een eigen toezegging-grootboek
     bij), dus dit is geen dubbeltelling. Begrensd: de tijdlijn toont er toch
     hooguit twintig van alles samen. */
  function labfondsFeiten(key) {
    return (kern.labfonds.mijnBijdragen(key) || []).slice(0, 50).map(b => feit({
      soort: 'bijdrage', titel: 'Lab-fonds ' + b.locNaam, centen: b.centen,
      richting: 'uit', wanneer: dagVan(b.at), tijd: b.at,
      bron: 'labfonds', link: LINK('labfonds')
    }));
  }

  /* PAYROLL: verwacht inkomen, voor zover het domein het ECHT kent. Het kent
     loonstroken (uitgedraaide runs), geen toekomst; wat hier als verwachting
     uitkomt is daarom aan strikte eisen gebonden: minstens twee stroken, in
     opeenvolgende maandperiodes, en de reeks niet langer dan een maand
     gestopt -- anders is er geen reeks en verzinnen we geen loon.

     De stroken zelf gaan als gebeurtenissen mee (soort 'loon'), het
     verwachte volgende loon als soort 'loon-verwacht' met herhaling
     maandelijks. Payroll rekent in euro's (afgerond op twee decimalen); de
     omzetting naar centen gebeurt hier een keer, bij de bron, zodat de rest
     van de graaf nooit een euro-bedrag te zien krijgt. */
  const maandIndex = (p) => Number(String(p).slice(0, 4)) * 12 + Number(String(p).slice(5, 7));
  const opeenvolgend = (jong, ouder) =>
    /^\d{4}-\d{2}$/.test(String(jong)) && /^\d{4}-\d{2}$/.test(String(ouder)) &&
    maandIndex(jong) - maandIndex(ouder) === 1;

  function payrollFeiten(key) {
    const uit = [];
    const rollen = ((kern.accRollen(key) || {}).rollen || [])
      .filter(r => r && r.rol === 'personeel' && r.code && r.staffId != null);
    for (const rol of rollen) {
      const stroken = kern.payroll.strokenVan(rol.code, rol.staffId) || []; // nieuwste eerst
      for (const s of stroken.slice(0, 6)) {
        const netto = Math.round(Number(s.regel && s.regel.netto) * 100);
        if (!Number.isFinite(netto)) continue;
        uit.push(feit({
          soort: 'loon', titel: 'Loon ' + s.zaak + ' (' + s.periode + ')',
          centen: netto, richting: 'in',
          wanneer: dagVan(s.at), tijd: s.at,
          bron: 'payroll', link: LINK('metier')
        }));
      }
      if (stroken.length >= 2 && opeenvolgend(stroken[0].periode, stroken[1].periode)) {
        const jongsteDag = dagVan(stroken[0].at);
        const netto = Math.round(Number(stroken[0].regel && stroken[0].regel.netto) * 100);
        if (jongsteDag && Number.isFinite(netto)) {
          const volgende = plusDagen(jongsteDag, 30);
          /* Hooguit een maand voorbij: daarna is de reeks gestopt en zou de
             graaf inkomen beloven dat er niet komt -- de gevaarlijkste
             richting om in te liegen. */
          if (dagenTussen(volgende, vandaag()) <= 30) {
            uit.push(feit({
              soort: 'loon-verwacht', titel: 'Verwacht loon ' + stroken[0].zaak,
              centen: netto, richting: 'in', wanneer: volgende,
              herhaling: 'maandelijks', bron: 'payroll', link: LINK('metier')
            }));
          }
        }
      }
    }
    return uit;
  }

  const ALLE = [
    { naam: 'wallet', lever: walletFeiten },
    { naam: 'wbw', lever: wbwFeiten },
    { naam: 'mecenaat', lever: mecenaatFeiten },
    { naam: 'labfonds', lever: labfondsFeiten },
    { naam: 'payroll', lever: payrollFeiten }
  ];

  /* 'beleid' staat in de bronnenlijst maar niet in ALLE: de zusterlaag
     (kern/geldbeleid) levert geen feiten maar potten en regeloordelen, en
     wordt door index.js zelf aangesproken. Hij hoort wel in de lijst, zodat
     het scherm "beleid is stil" op dezelfde manier kan tonen als elke
     andere stille bron. */
  const NAMEN = ALLE.map(b => b.naam).concat(['beleid']);

  function verzamel(key) {
    const feiten = [], stil = [];
    for (const b of ALLE) {
      try { for (const f of b.lever(key) || []) feiten.push(f); }
      catch (e) { stil.push(b.naam); }
    }
    return { feiten, stil, bronnen: NAMEN };
  }

  return { verzamel, NAMEN };
};
