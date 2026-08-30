/* DE SPRONG -- een tik naar elke functie, vanaf elk scherm.

   WAAROM DIT ER IS. scripts/tikken.js heeft het huis afgelopen (TIKKEN.md): 119
   schermen lagen op drie tikken, 76 op vier, 24 op vijf en 52 buiten bereik. De
   belofte "elke functie binnen vijf tikken" was dus niet waar.

   Wat deze laag toevoegt is niet nog een menu maar de KORTE WEG: een greep die
   op elk scherm op dezelfde plek staat (1 tik) en een lijst van alles wat u
   kunt openen (de tweede tik). Twee tikken, overal.

   WAT HIJ NIET IS. Geen tweede navigatie: hij verzint geen bestemmingen. De
   lijst komt uit shared/sprongindex.json, AFGELEID uit MAPPEN (de enige lijst
   werelden, WERELD.md) door scripts/sprongindex.js. Wie hier ooit een eigen
   lijst ziet ontstaan, heeft LAT.md regel 4 te pakken.

   EN HIJ BOUWT GEEN TWEEDE SPOTLIGHT. Op /apps/app.html bestaat de zoeklade van
   de leden-app al (app-main-27.js), met dezelfde bron en meer kennis: hij weet
   wat uw pas opent en geeft Rahul een vraag door. Staat die op de pagina, dan
   opent deze greep hem en tekent hij niets van zichzelf.

   Typen is geen tik: wie de lijst openslaat, ziet alles staan. Het zoekveld is
   een versnelling en nooit een voorwaarde -- daarom is dit een lijst met een
   veld erboven, en geen leeg veld.

   GEEN GREEP ZONDER SESSIE. Op een inlogscherm, een publieke pagina of in de
   cel van een derde-app (APPSTORE.md) valt er niets te springen. */
(function (w, d) {
  'use strict';
  if (w.RTGSprong) return;

  var INDEX = '/shared/sprongindex.json';
  var HANDELINGEN = '/shared/handelingindex.json';
  var index = null, elders = [], laadt = null, luik = null, veld = null, lijst = null, greep = null, terugNaar = null;

  function lid() {
    try { return !!localStorage.getItem('rtg_member_token'); } catch (e) { return false; }
  }
  /* NIET IN EEN BLAD, EN NIET IN EEN CEL.

     Een werkblad van RTG Command is een iframe met een gewone pagina erin, en
     die pagina krijgt deze laag ook mee. Zonder deze regel stond er een greep in
     elk blad naast die van de schil eromheen -- dezelfde deur, twee keer, en de
     binnenste opende een lijst binnen een lijst. (Hij deed meer kwaad dan dat:
     test/appmenu.e2e.js zag een knop in een blad onder zijn handen verdwijnen
     doordat de binnenste laag zijn lijst opbouwde terwijl het blad tekende.)

     De cel van de App Store draait derdencode; daar hoort sowieso geen deur van
     RTG in die het hele huis opent. */
  function verboden() {
    if (w.top !== w.self) return true;
    return /\/apps\/appcel\.html/.test(location.pathname);
  }

