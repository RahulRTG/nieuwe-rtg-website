/* DE SCENARIO-ENGINE: wat gebeurt er als ik dit doe -- zonder dat er iets gebeurt.

   "Wat als ik twaalf mensen aanneem in Duitsland?" "Wat als deze vestiging twee
   miljoen omzet draait?" Dat zijn vragen waar een ondernemer een antwoord op
   wil voordat hij iets doet, en tot nu toe was het antwoord een rekenmachine en
   een gevoel.

   DE HARDE EIS: ER MAG NIETS VERANDEREN. Een doorrekening die per ongeluk een
   boeking maakt, is erger dan geen doorrekening. Dat is hier niet met discipline
   opgelost maar STRUCTUREEL: deze module krijgt geen `db`, geen `save` en geen
   enkele functie die schrijft. Hij krijgt tabellen en rekenroutines, en verder
   niets. Hij KAN niet muteren, en dat is de enige vorm van die belofte die over
   vijf jaar nog waar is.

   HIJ REKENT NIET ZELF. Elk getal komt uit een routine die elders al bestaat --
   de landentabel voor lasten en tarieven, de payroll-dekking voor de vraag of
   er in dat land uberhaupt loon te draaien valt. Een scenario dat zijn eigen
   sommen maakt, geeft andere uitkomsten dan de werkelijkheid die erop volgt, en
   dan is het erger dan nutteloos.

   EN HIJ IS ADVIES, NOOIT VASTGESTELD. Een doorrekening rust op aannames die de
   vrager doet; ./zekerheid.js zet dat op `advies` en die klasse reist mee.
   Daarom staat elke aanname met zoveel woorden in het antwoord, en staat wat we
   NIET weten er ook in -- als eigen lijst, want een aanname die je niet ziet is
   een aanname die je gelooft.

   WAT DEZE MODULE NIET DOET: een gekozen scenario doorvoeren. Dat is geen
   vergetelheid. "Klaarzetten mag, doorvoeren is een mensbesluit" loopt door dit
   hele huis, en een knop die een doorrekening in werkelijkheid omzet, zou in
   een klap twaalf arbeidsovereenkomsten en een loonadministratie aanmaken. Wie
   het scenario kiest, doorloopt de gewone wegen. */
'use strict';

const { zekerheid } = require('./zekerheid');

const centen = (n) => Math.round((Number(n) || 0) * 100) / 100;

function maakScenario({ LANDEN, dekking, jaargangen }) {
  /* De regels van een land op een datum. Met jaargangen de teruggerekende, en
     anders de lopende tabel -- dezelfde terugval als ./regelbron.js, en met
     dezelfde eerlijkheid erover in de stempel. */
  function regelsVan(land, datum) {
    const cc = String(land || '').toUpperCase();
    if (jaargangen && typeof jaargangen.regelsOp === 'function') {
      const r = jaargangen.regelsOp(cc, datum);
      if (r) return { regels: r, bron: 'jaargangen' };
    }
    return { regels: LANDEN[cc] || null, bron: 'lopend' };
  }

  /* ---- personeel: wat kost het, en KAN het daar ---- */
  function personeel({ land, aantal, brutoPerMaandCenten, datum }) {
    const cc = String(land || '').toUpperCase();
    const { regels: L, bron } = regelsVan(cc, datum);
    if (!L) return { status: 404, error: 'Dit land kennen we niet: ' + cc };
    const n = Math.max(0, Math.min(10000, Math.round(Number(aantal) || 0)));
    const bruto = Math.max(0, Math.round(Number(brutoPerMaandCenten) || 0));
    if (!n || !bruto) return { status: 400, error: 'Geef een aantal mensen en een brutoloon per maand.' };

    const perMaand = n * bruto;
    const lasten = Math.round(perMaand * L.lasten);
    const vakantie = Math.round(perMaand * (L.vakantiegeld || 0));

    /* DE VRAAG DIE EEN REKENMACHINE NIET STELT: kunnen wij daar loon draaien?
       Een kostenplaatje voor een land waar geen goedgekeurde loontabel voor
       bestaat, is een plaatje van iets dat niet kan. */
    const d = dekking && typeof dekking.voorLand === 'function' ? dekking.voorLand(cc, datum) : null;
    const onbekend = [];
    if (!d) onbekend.push({ wat: 'loondekking', let: 'De payroll-dekking is hier niet beschikbaar, dus of er in ' + cc + ' loon te draaien valt, is niet nagegaan.' });
    else if (d.stand !== 'draait') onbekend.push({ wat: 'loondekking', stand: d.stand,
      let: 'In ' + cc + ' kan vandaag geen loonrun draaien (' + d.stand + '). De kosten hieronder kloppen als rekensom, maar de uitvoering kan nog niet.' });
    else if (d.opDemoTabellen) onbekend.push({ wat: 'loontabellen',
      let: 'De loontabellen van ' + cc + ' melden zelf dat ze niet tegen de bron zijn gelegd.' });
    onbekend.push({ wat: 'individueel', let: 'Dit rekent met een gelijk brutoloon voor iedereen en zonder toeslagen, verzuim, pensioen of cao.' });

    const uurloonMin = L.uurloonMin;
    const perUurBijVoltijd = centen((bruto / 100) / 173.33);
    if (uurloonMin && perUurBijVoltijd < uurloonMin) onbekend.push({ wat: 'minimumloon',
      let: 'Bij een voltijdweek komt dit neer op ongeveer EUR ' + perUurBijVoltijd + ' per uur; het indicatieve minimum in ' + cc + ' is EUR ' + uurloonMin + '.' });

    return { ok: true, soort: 'personeel', land: cc, landNaam: L.naam,
      aannames: [
        n + ' medewerkers in ' + L.naam,
        'bruto EUR ' + centen(bruto / 100) + ' per persoon per maand',
        'werkgeverslasten ' + Math.round(L.lasten * 100) + '%' + (L.vakantiegeld ? ' en vakantiegeld ' + Math.round(L.vakantiegeld * 1000) / 10 + '%' : ' en geen vakantiegeldopbouw'),
        'regels van ' + (datum || 'vandaag') + ' (' + bron + ')'
      ],
      perMaandCenten: perMaand + lasten + vakantie,
      perJaarCenten: (perMaand + lasten + vakantie) * 12,
      opbouw: { brutoCenten: perMaand, lastenCenten: lasten, vakantiegeldCenten: vakantie },
      loondekking: d ? { stand: d.stand, pakket: d.pakket || null } : null,
      onbekend, zekerheid: zekerheid('scenario.doorrekening'),
      let: 'Een doorrekening op uw aannames. Er is niets vastgelegd en niets gewijzigd.' };
  }

  /* ---- omzet: wat gaat er aan btw af ---- */
  function omzet({ land, omzetCenten, categorie, datum }) {
    const cc = String(land || '').toUpperCase();
    const { regels: L, bron } = regelsVan(cc, datum);
    if (!L) return { status: 404, error: 'Dit land kennen we niet: ' + cc };
    const bedrag = Math.max(0, Math.round(Number(omzetCenten) || 0));
    if (!bedrag) return { status: 400, error: 'Geef een omzet.' };
    const cat = String(categorie || 'standaard');
    const t = L.tarieven && L.tarieven[cat] != null ? L.tarieven[cat] : (L.tarieven || {}).standaard;
    if (t == null) return { status: 400, error: 'Voor ' + cc + ' is geen tarief bekend voor ' + cat + '.' };

    const grondslag = Math.round(bedrag / (1 + t / 100));
    return { ok: true, soort: 'omzet', land: cc, landNaam: L.naam, categorie: cat, tarief: t,
      aannames: [
        'EUR ' + centen(bedrag / 100) + ' omzet inclusief btw',
        'categorie ' + cat + ' in ' + L.naam + ' (' + t + '%)',
        'regels van ' + (datum || 'vandaag') + ' (' + bron + ')'
      ],
      omzetCenten: bedrag, grondslagCenten: grondslag, btwCenten: bedrag - grondslag,
      onbekend: [
        { wat: 'drempels', let: 'Registratie- en afstandsverkoopdrempels zitten hier niet in; die verschillen per land en staan niet in onze tabellen.' },
        { wat: 'categorie', let: 'Welke categorie een verkoop krijgt, is per land een juridische toewijzing. Hier is de gevraagde categorie aangenomen.' },
        { wat: 'aftrek', let: 'Dit is de af te dragen btw over de omzet; wat er aan voorbelasting tegenover staat, is niet meegerekend.' }
      ],
      zekerheid: zekerheid('scenario.doorrekening'),
      let: 'Een doorrekening op uw aannames. Er is niets vastgelegd en niets gewijzigd.' };
  }

  return { scenario: { personeel, omzet } };
}

module.exports = { maakScenario };
