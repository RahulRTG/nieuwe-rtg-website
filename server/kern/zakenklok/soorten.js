/* DE VIER SOORTEN PERIODE DIE ER VANDAAG ZIJN.

   Ze staan BUITEN index.js, en dat is niet alleen omvang: ze worden aangemeld
   met dezelfde meld() die iedereen kan gebruiken, en dat is pas te geloven als
   ze ook echt buiten de kern staan. Een vijfde komt er precies zo bij.

   Elke soort brengt mee: sleutel/naam/uitleg, `standaard` (wat geldt als niemand
   iets instelde), `standaardVoor(zaak)` (het voorstel van RTG per genre),
   `keur(instelling)` (welke velden onbruikbaar zijn), `keuzes` (wat een scherm
   mag aanbieden) en `periodeVan(...)` (de rekenregel). */
'use strict';

module.exports = function meldSoorten(klok) {
  const { meld } = klok;

  /* 1. DE HORECADAG. Een strandclub sluit om drie uur 's nachts; de omzet van
     01:30 hoort bij de avond ervoor -- vraag het aan wie de kassa afsluit. De
     standaard is 00:00 (de kalenderdag) en RTG stelt per genre iets anders voor:
     een winkel die niets instelt hoort geen verschoven dag te krijgen, een club
     die niets instelt niet elke nacht zijn omzet te zien splitsen. */
  meld({
    sleutel: 'horecadag',
    naam: 'Bedrijfsdag',
    uitleg: 'Tot hoe laat telt een omzet mee met de dag ervoor. Een club die om 03:00 sluit, boekt '
      + 'de laatste ronde op de avond en niet op de nieuwe kalenderdag.',
    standaard: { omslag: '00:00' },
    keuzes: { omslag: ['00:00', '02:00', '03:00', '04:00', '05:00', '06:00'] },
    keur: (i) => (i.omslag !== undefined && !/^([01]?\d|2[0-3]):[0-5]\d$/.test(String(i.omslag))) ? ['omslag'] : [],
    // Het VOORSTEL van RTG per genre; de zaak overschrijft het en dan wint dat.
    standaardVoor: (zaak) => {
      const t = String((zaak && zaak.type) || '');
      if (t === 'club' || t === 'beachclub' || t === 'nachtclub') return { omslag: '05:00' };
      if (t === 'restaurant' || t === 'bar' || t === 'horeca' || t === 'hotel') return { omslag: '04:00' };
      return {};
    },
    periodeVan: (datum, instelling, h) => {
      const omslag = h.naarMinuten(instelling.omslag, 0);
      const d = h.delenIn(datum, h.zone);
      const minuten = d.uur * 60 + d.minuut;
      const dag = minuten < omslag ? h.dagPlus(d.jaar, d.maand, d.dag, -1) : { jaar: d.jaar, maand: d.maand, dag: d.dag };
      const volgend = h.dagPlus(dag.jaar, dag.maand, dag.dag, 1);
      return {
        sleutel: h.isoDag(dag.jaar, dag.maand, dag.dag),
        label: h.isoDag(dag.jaar, dag.maand, dag.dag) + (omslag ? ' (tot ' + instelling.omslag + ')' : ''),
        vanLokaal: h.isoDag(dag.jaar, dag.maand, dag.dag) + 'T' + (instelling.omslag || '00:00'),
        totLokaal: h.isoDag(volgend.jaar, volgend.maand, volgend.dag) + 'T' + (instelling.omslag || '00:00')
      };
    }
  });

  /* 2. DE BOEKHOUDPERIODE. Per maand, kwartaal, jaar of vier weken, met een
     boekjaar dat niet in januari hoeft te beginnen -- een schoolbedrijf begint in
     augustus. Precies waarom dit per zaak instelbaar is en niet per huis. */
  meld({
    sleutel: 'boekhoudperiode',
    naam: 'Boekhoudperiode',
    uitleg: 'De eenheid waarin deze zaak zijn cijfers telt, en in welke maand zijn boekjaar begint.',
    standaard: { eenheid: 'maand', boekjaarStart: 1, ankerdag: null },
    keuzes: { eenheid: ['maand', 'kwartaal', 'jaar', 'vierwekelijks'], boekjaarStart: [1,2,3,4,5,6,7,8,9,10,11,12] },
    keur: (i) => keurBlok(i, ['maand', 'kwartaal', 'jaar', 'vierwekelijks']),
    periodeVan: (datum, instelling, h) => periodeBlok(datum, instelling, h, 'boekjaarStart')
  });

  /* 3. DE PAYROLLPERIODE. Dezelfde rekenkunde als de boekhouding en TOCH een
     eigen soort: een zaak die per kwartaal boekhoudt betaalt vaak per maand uit.
     Ze samen instellen zou een boekhouder de loonstroken laten verzetten. */
  meld({
    sleutel: 'payrollperiode',
    naam: 'Loonperiode',
    uitleg: 'Per welke periode het loon wordt vastgesteld. Vierwekelijks en per week rekenen vanaf '
      + 'een ankerdag, want die perioden liggen niet op de kalender vast.',
    standaard: { eenheid: 'maand', boekjaarStart: 1, ankerdag: '2026-01-05' },
    keuzes: { eenheid: ['maand', 'vierwekelijks', 'week'] },
    keur: (i) => keurBlok(i, ['maand', 'vierwekelijks', 'week']),
    periodeVan: (datum, instelling, h) => periodeBlok(datum, instelling, h, 'boekjaarStart')
  });

  /* 4. DE SCHOOLDAG. Begint vroeg, en een schooljaar begint niet in januari.
     LEVEN.md: leren is geen wedstrijd -- deze periode telt geen prestaties, hij
     zegt alleen bij welke dag en welk jaar iets hoort. */
  meld({
    sleutel: 'schooldag',
    naam: 'Schooldag',
    uitleg: 'Vanaf hoe laat een schooldag telt, en in welke maand het schooljaar begint.',
    standaard: { omslag: '05:00', schooljaarStart: 8 },
    keuzes: { omslag: ['00:00', '04:00', '05:00', '06:00'], schooljaarStart: [1,7,8,9] },
    keur: (i) => {
      const fout = [];
      if (i.omslag !== undefined && !/^([01]?\d|2[0-3]):[0-5]\d$/.test(String(i.omslag))) fout.push('omslag');
      if (i.schooljaarStart !== undefined && !(Number(i.schooljaarStart) >= 1 && Number(i.schooljaarStart) <= 12)) fout.push('schooljaarStart');
      return fout;
    },
    periodeVan: (datum, instelling, h) => {
      const omslag = h.naarMinuten(instelling.omslag, 300);
      const d = h.delenIn(datum, h.zone);
      const minuten = d.uur * 60 + d.minuut;
      const dag = minuten < omslag ? h.dagPlus(d.jaar, d.maand, d.dag, -1) : { jaar: d.jaar, maand: d.maand, dag: d.dag };
      const start = Math.min(12, Math.max(1, Number(instelling.schooljaarStart) || 8));
      const jaar = dag.maand >= start ? dag.jaar : dag.jaar - 1;
      return {
        sleutel: h.isoDag(dag.jaar, dag.maand, dag.dag),
        label: h.isoDag(dag.jaar, dag.maand, dag.dag),
        schooljaar: jaar + '/' + (jaar + 1)
      };
    }
  });

  /* Welke velden van een blokinstelling zijn onbruikbaar? Een lege lijst betekent
     "allemaal goed"; wat erin staat wordt genegeerd alsof het niet was ingevuld. */
  function keurBlok(i, eenheden) {
    const fout = [];
    if (i.eenheid !== undefined && !eenheden.includes(String(i.eenheid))) fout.push('eenheid');
    const s = Number(i.boekjaarStart);
    if (i.boekjaarStart !== undefined && !(s >= 1 && s <= 12)) fout.push('boekjaarStart');
    if (i.ankerdag !== undefined && i.ankerdag !== null && !/^\d{4}-\d{2}-\d{2}$/.test(String(i.ankerdag))) fout.push('ankerdag');
    return fout;
  }

  /* De gedeelde rekenregel voor blokperioden. Een functie en geen kopie per
     soort: boekhouding en payroll tellen hetzelfde, ze KIEZEN alleen anders. */
  function periodeBlok(datum, instelling, h, startVeld) {
    const d = h.delenIn(datum, h.zone);
    const eenheid = String(instelling.eenheid || 'maand');
    const start = Math.min(12, Math.max(1, Number(instelling[startVeld]) || 1));

    if (eenheid === 'jaar') {
      const jaar = d.maand >= start ? d.jaar : d.jaar - 1;
      return { sleutel: 'FY' + jaar, label: 'boekjaar ' + jaar + (start === 1 ? '' : '/' + (jaar + 1)),
        vanLokaal: h.isoDag(jaar, start, 1) };
    }
    if (eenheid === 'kwartaal') {
      /* Geteld VANAF de boekjaarstart, niet vanaf januari: een boekjaar dat in
         augustus begint heeft zijn eerste kwartaal in augustus. Wie hier
         `Math.ceil(maand/3)` zou schrijven, telt de kalenderkwartalen en geeft
         een zaak met een verschoven boekjaar stil het verkeerde vak. */
      const jaar = d.maand >= start ? d.jaar : d.jaar - 1;
      const sinds = (d.maand - start + 12) % 12;
      const k = Math.floor(sinds / 3) + 1;
      /* Expliciet uitpakken en geen Object.values(): dat leunt op de volgorde
         waarin de sleutels toevallig zijn gezet, en dat is geen contract. */
      const b = schuifMaand(jaar, start, (k - 1) * 3);
      return { sleutel: jaar + '-K' + k, label: 'K' + k + ' ' + jaar,
        vanLokaal: h.isoDag(b.jaar, b.maand, 1) };
    }
    if (eenheid === 'vierwekelijks' || eenheid === 'week') {
      const lengte = eenheid === 'week' ? 7 : 28;
      const anker = /^\d{4}-\d{2}-\d{2}$/.test(String(instelling.ankerdag || '')) ? instelling.ankerdag : '2026-01-05';
      const [aj, am, ad] = anker.split('-').map(Number);
      const dagen = Math.floor((Date.UTC(d.jaar, d.maand - 1, d.dag) - Date.UTC(aj, am - 1, ad)) / 86400000);
      /* Math.floor en geen deling met afkappen: voor een datum VOOR het anker is
         het quotient negatief, en dan rondt afkappen de verkeerde kant op --
         periode 0 zou dan twee keer zo lang zijn als alle andere. */
      const n = Math.floor(dagen / lengte);
      const beginDagen = n * lengte;
      const van = new Date(Date.UTC(aj, am - 1, ad + beginDagen));
      const tot = new Date(Date.UTC(aj, am - 1, ad + beginDagen + lengte));
      const woord = eenheid === 'week' ? 'week' : 'periode';
      return { sleutel: woord + ':' + van.toISOString().slice(0, 10),
        label: woord + ' van ' + van.toISOString().slice(0, 10),
        vanLokaal: van.toISOString().slice(0, 10), totLokaal: tot.toISOString().slice(0, 10) };
    }
    // maand: de eenvoudigste, en de standaard
    return { sleutel: h.isoDag(d.jaar, d.maand, 1).slice(0, 7),
      label: h.isoDag(d.jaar, d.maand, 1).slice(0, 7), vanLokaal: h.isoDag(d.jaar, d.maand, 1) };
  }

  function schuifMaand(jaar, maand, n) {
    const m = maand - 1 + n;
    return { jaar: jaar + Math.floor(m / 12), maand: (m % 12) + 1 };
  }
};
