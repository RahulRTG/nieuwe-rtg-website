/* WAT RTG OFFICE OVER ZIJN EIGEN TOESTAND TE ZEGGEN HEEFT.

   apps/office/adaptief.js leest de werkbalk uit en maakt van elke knop een
   handeling. Dit bestand gaat over het DOCUMENT: hoe het ervoor staat, wie het
   ziet, en de twee handelingen die zwaarder wegen dan vet maken.

   ALLES HIER IS GEMETEN, EN DAT IS DE HELE VOORWAARDE. De Trust Rail mag niets
   geruststellends zeggen wat niemand heeft nagekeken (CANVAS.md). Wat er staat
   komt daarom van drie plekken die het echt weten, en alle drie stonden ze er al:

     #staat                 de opslagstand, gezet door bewaarNu()
     #beheerClassificatie   de classificatie die aan dit stuk hangt
     #samenLabel            wie er meeleest, uit de aanwezigheidslaag

   Zou een van die drie ontbreken, dan staat dat onderdeel er gewoon niet. Een
   lege plek is eerlijker dan een aangenomen "Opgeslagen".

   EN HIER STAAT DE MOOISTE VERHINDERING VAN HET HUIS. Een document kan als
   "Strikt · niet delen" geclassificeerd zijn. Delen is dan geen grijze knop maar
   een knop die zegt waarom: lang drukken geeft de reden, de bron, en dat je er
   zelf niets aan kunt veranderen. Dat is precies wat GRAMMATICA.md bedoelt met
   "een verhindering draagt altijd een reden".

   Levert window.RTGOfficeAdaptiefStaat(o); office/adaptief.js roept hem aan. */
(function (w, d) {
  'use strict';
  w.RTGOfficeAdaptiefStaat = function (o) {
    var A = w.RTGAdaptief, tik = o.tik;
    function $(s) { return d.querySelector(s); }
    function zichtbaar(el) { return !!(el && el.offsetParent !== null); }

    var CLASSNAAM = { intern: 'Intern', vertrouwelijk: 'Vertrouwelijk', strikt: 'Strikt' };

    function classificatie() {
      var k = $('#beheerClassificatie');
      return (k && k.value) || '';
    }

    /* ------------------------------------------------------------ de rail --
       Drie onderdelen, elk met de uitleg erachter. Een onderdeel zonder uitleg
       zou hier een dood woord zijn: de rail is een INGANG, geen mededeling. */
    function rail() {
      var uit = [];
      var st = $('#staat'), tekst = st ? (st.textContent || '').trim() : '';
      if (tekst) {
        /* "Opslaan…" is een werkwoord in de tegenwoordige tijd en dus `bezig`;
           een conflictmelding vraagt aandacht. De rest is rustig. */
        var bezig = /opslaan|bewaren/i.test(tekst);
        var aandacht = /nieuwere|conflict|niet opgeslagen|mislukt/i.test(tekst);
        uit.push({ sleutel: 'opslag', tekst: tekst,  teken: aandacht ? '!' : (bezig ? '' : '✓'),
          staat: aandacht ? 'aandacht' : (bezig ? 'bezig' : 'rustig'),
          uitleg: [aandacht ? 'Uw werk staat nog op dit toestel en is niet overschreven.'
                       : 'Uw wijzigingen worden vanzelf bewaard terwijl u werkt.',
            'RTG Office bewaart ongeveer een seconde nadat u stopt met typen.'] });
      }
      var k = classificatie();
      if (k) {
        uit.push({ sleutel: 'classificatie', tekst: CLASSNAAM[k] || k,
          staat: k === 'strikt' ? 'aandacht' : 'rustig',
          uitleg: [k === 'strikt'
            ? 'Dit stuk is geclassificeerd als Strikt. Het mag niet buiten RTG gedeeld worden.'
            : (k === 'vertrouwelijk'
              ? 'Dit stuk is Vertrouwelijk. Deel het alleen met wie het nodig heeft.'
              : 'Dit stuk is Intern. Het blijft binnen RTG.'),
            'De classificatie staat in het documentbeleid en wordt door een mens gezet.'] });
      }
      var sam = $('#samenLabel'), wie = sam ? (sam.textContent || '').trim() : '';
      if (wie) {
        uit.push({ sleutel: 'samen', tekst: wie, staat: 'rustig',
          uitleg: [wie === 'Alleen u' ? 'Er kijkt op dit moment niemand anders mee.'
            : 'Er wordt nu door meer mensen aan dit stuk gewerkt.',
            'Aanwezigheid loopt op codenamen; echte namen staan in de identiteitskluis.'] });
      }
      return uit;
    }

    /* ------------------------------------------------------- de handelingen --
       Twee, en allebei wegen ze meer dan een werkbalkknop.

       DELEN is `bewust`: je ziet eerst welke classificatie eraan hangt voordat
       het weggaat. Niet "weet u het zeker?" -- een vraag met inhoud, waar je een
       fout aan kunt zien.

       TER BEOORDELING is ook `bewust`, want anderen zien het gevolg. Hij is in de
       app terug te draaien (heropenen als concept), maar niet vanuit hier: en een
       weg terug beloven die deze laag niet kan waarmaken, is erger dan hem niet
       beloven (GRAMMATICA.md). Dus vooraf laten zien in plaats van achteraf
       aanbieden. */
    function caps() {
      var uit = [];
      var deel = $('#deelBtn');
      if (deel) {
        var k = classificatie();
        var dicht = k === 'strikt';
        A.declareer({ id: 'office.doc.delen', naam: 'Delen', label: '↗', groep: 'Document',
          gewicht: 'bewust',
          telefoon: ['balk', 'lade'], tablet: ['werkbalk', 'lade'], bureau: ['werkbalk'],
          verhinderd: dicht ? {
            reden: 'Delen is uitgeschakeld omdat dit document als Strikt · niet delen is geclassificeerd.',
            bron: 'classificatie',
            stap: 'Een beheerder kan de classificatie in het documentbeleid aanpassen.'
          } : null,
          doe: function () { tik(deel); } });
        uit.push({ id: 'office.doc.delen', knop: deel, sleutel: 'delen',
          bevestiging: {
            watGebeurt: 'Dit document wordt gedeeld op codenaam. De ontvanger kan het openen zolang u de toegang niet intrekt.',
            classificatie: CLASSNAAM[k] || 'Onbekend',
            knop: 'Delen' } });
      }
      var fase = $('#faseHoofd');
      if (fase && zichtbaar(fase)) {
        var doel = (fase.textContent || '').trim();
        A.declareer({ id: 'office.doc.fase', naam: doel, label: '⇧', groep: 'Document',
          gewicht: 'bewust',
          telefoon: ['balk', 'lade'], tablet: ['werkbalk', 'lade'], bureau: ['werkbalk'],
          doe: function () { tik(fase); } });
        uit.push({ id: 'office.doc.fase', knop: fase, sleutel: 'fase',
          bevestiging: {
            watGebeurt: 'Dit document gaat naar "' + doel + '". Wie meekijkt ziet die stand meteen.',
            knop: doel } });
      }
      return uit;
    }

    return { rail: rail, caps: caps };
  };
})(window, document);
