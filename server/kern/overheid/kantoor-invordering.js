/* Overheid-domein "kantoor" (deelmodule): DE INVORDERING VAN DE IB-AANSLAG.

   Drie handelingen op een openstaande aanslag inkomstenbelasting: herinneren,
   een betalingsregeling treffen, en kwijtschelden. Ze lopen alle drie via de
   Berichtenbox, en er beslist altijd een mens.

   WAAROM DIT UIT ./kantoor.js IS GEHAALD: dat bestand zat tegen de 10 kB-grens
   en de vier-ogen-regel hieronder paste er niet meer bij. De naad is dezelfde
   als aan de btw-kant, waar de invordering ook een eigen bestand heeft
   (./naheffing-invordering.js).

   EN WAAROM ER NU VIER OGEN OP DE KWIJTSCHELDING ZITTEN.

   Er draaiden twee invorderingsregimes naast elkaar in hetzelfde kantoor. De
   naheffing omzetbelasting had vier ogen op elke stap die geld raakt: een
   andere inspecteur stelt vast dan opmaakt, een derde beslist op het bezwaar,
   en wie het dwangbevel tekende legt het beslag niet. Deze kant -- de oudere
   IB-aanslag -- had er nul. Een inspecteur kon in zijn eentje een schuld
   wegstrepen.

   Dat is niet "minder streng", dat is inconsistent op precies het punt waar het
   ertoe doet: kwijtschelding is de enige handeling in dit hele bestand die
   ONOMKEERBAAR geld weggeeft. Een herinnering kun je opnieuw sturen en een
   regeling kun je intrekken; een kwijtgescholden aanslag komt niet terug.

   Het werkt als bij de naheffing, in twee stappen:
     bdKwijtVoorstel  een inspecteur DRAAGT VOOR, met een reden. De burger
                      hoort hier nog niets: een voorstel is geen besluit.
     bdKwijtBesluit   een ANDERE inspecteur beslist. Pas dan gaat het bedrag
                      eraf en pas dan gaat het bericht uit.
   Afwijzen kan ook, en dan verdwijnt het voorstel -- een voordracht die
   blijft hangen zou een aanslag stil onaantastbaar maken.

   WAT HIER (NOG) NIET IS, en dat is een echt verschil met de naheffingskant:
   TERMIJNEN. De naheffing rekent na of de vervaldatum echt is verstreken
   voordat de volgende invorderingsstap mag; hier is een herinnering een bericht
   zonder klok erachter, en er is geen aanmaning, dwangbevel of beslag. Dat
   staat als open eindje in TAKEN.md en wordt hier niet stilzwijgend nagebootst:
   een halve termijnenketen is misleidender dan geen.

   Krijgt de gedeelde ctx van ./kantoor.js. */
'use strict';

module.exports = ({ nu, save, schoon, bericht, aanslagen, open }) => {
  const pak = (r) => aanslagen().find(x => x.ref === String(r || ''));
  // dezelfde vergelijking als kern/uitgifte.js en de naheffing: naam op naam,
  // hoofdletters en spaties tellen niet mee
  const gelijk = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

  /* De drie voorwaarden die alle handelingen delen, op EEN plek: bestaat hij,
     staat er iets open, en staat er een naam onder. Een besluit zonder naam is
     bij de overheid geen besluit. */
  function poort(r, actor, watNu) {
    const a = pak(r);
    if (!a) return { nee: { status: 404, error: 'Aanslag niet gevonden.' } };
    if (!open(a)) return { nee: { status: 409, error: 'Voor deze aanslag staat niets open.' } };
    const wie = schoon(actor, 60);
    if (wie.length < 2) return { nee: { status: 400, error: watNu + ' gebeurt altijd op naam.' } };
    return { a, wie };
  }

  function bdHerinnering(actor, r) {
    const { a, wie, nee } = poort(r, actor, 'Een herinnering sturen'); if (nee) return nee;
    a.herinnerd = nu(); a.herinnerdDoor = wie;
    bericht(a.key, 'Belastingdienst', 'Betalingsherinnering ' + a.jaar,
      'Er staat nog € ' + a.saldo + ' open voor je aanslag ' + a.jaar + ' (' + a.ref + '). Betaal via MijnOverheid, of vraag een betalingsregeling aan.', 'belasting');
    save();
    return { ok: true };
  }

  function bdRegeling(actor, r, maanden) {
    const { a, wie, nee } = poort(r, actor, 'Een regeling treffen'); if (nee) return nee;
    const m = Math.round(Number(maanden) || 0);
    if (m < 2 || m > 24) return { status: 400, error: 'Kies een regeling van 2 tot 24 maanden.' };
    a.regeling = { maanden: m, per: Math.ceil(a.saldo / m), door: wie, at: nu() };
    bericht(a.key, 'Belastingdienst', 'Betalingsregeling toegekend',
      'Voor je aanslag ' + a.jaar + ' is een regeling getroffen: ' + m + ' maanden van € ' + a.regeling.per + '.', 'belasting');
    save();
    return { ok: true, regeling: a.regeling };
  }

  /* ---- kwijtschelding, in twee stappen en door twee mensen ---- */
  function bdKwijtVoorstel(actor, r, reden) {
    const { a, wie, nee } = poort(r, actor, 'Een voordracht'); if (nee) return nee;
    if (a.kwijtVoorstel) return { status: 409,
      error: 'Er ligt al een voordracht van ' + a.kwijtVoorstel.door + ' (' + a.kwijtVoorstel.at.slice(0, 10) + '). Een ander beslist erop.' };
    const grond = schoon(reden, 200);
    /* Een reden is verplicht en "op besluit van de inspecteur" was er geen. Die
       stond hier als STANDAARDWAARDE, dus een kwijtschelding zonder opgaaf van
       reden kreeg er automatisch een die niets zegt. Wie later vraagt waarom
       deze schuld is weggestreept, verdient een antwoord. */
    if (grond.length < 4) return { status: 400,
      error: 'Noem de grond voor de kwijtschelding; een kwijtschelding zonder leesbare reden is niet te verantwoorden.' };
    a.kwijtVoorstel = { reden: grond, door: wie, at: nu() };
    save();
    return { ok: true, voorstel: a.kwijtVoorstel,
      let: 'Voorgedragen voor kwijtschelding. Een ANDERE inspecteur beslist; de burger hoort hier nog niets van.' };
  }

  function bdKwijtBesluit(actor, r, akkoord) {
    const { a, wie, nee } = poort(r, actor, 'Een besluit'); if (nee) return nee;
    if (!a.kwijtVoorstel) return { status: 409,
      error: 'Er ligt geen voordracht voor kwijtschelding op deze aanslag.' };
    if (gelijk(wie, a.kwijtVoorstel.door)) return { status: 409,
      error: 'Dezelfde ogen tellen niet dubbel: wie voordroeg beslist niet zelf.' };

    if (!akkoord) {
      const van = a.kwijtVoorstel.door;
      a.kwijtVoorstel = null; save();
      return { ok: true, kwijtgescholden: false,
        let: 'De voordracht van ' + van + ' is afgewezen; de aanslag blijft openstaan.' };
    }
    a.kwijtgescholden = true;
    a.kwijt = { reden: a.kwijtVoorstel.reden, door: a.kwijtVoorstel.door, besloten: wie, at: nu() };
    a.kwijtVoorstel = null;
    // pas NU hoort de burger ervan: een voordracht is geen besluit
    bericht(a.key, 'Belastingdienst', 'Kwijtschelding',
      'De openstaande € ' + a.saldo + ' van je aanslag ' + a.jaar + ' is kwijtgescholden (' + a.kwijt.reden + '). Je hoeft niets meer te betalen.', 'belasting');
    save();
    return { ok: true, kwijtgescholden: true, kwijt: a.kwijt };
  }

  return { bdHerinnering, bdRegeling, bdKwijtVoorstel, bdKwijtBesluit };
};
