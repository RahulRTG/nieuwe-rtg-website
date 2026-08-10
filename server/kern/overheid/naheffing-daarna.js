/* Overheid-domein "naheffing" (deelmodule): WAT ER NA HET OPMAKEN GEBEURT --
   intrekken, bezwaar, het besluit daarop, en het teruglezen.

   Afgesplitst van ./naheffing.js, dat over de 10 kB-lat ging, en op de naad die
   er toch al lag: daar wordt een besluit GENOMEN, hier wordt het ingetrokken,
   aangevochten of heroverwogen. Andere bevoegdheden, andere ogen.

   DE DERDE OGEN. Wie de naheffing opmaakte of vaststelde, beslist niet op het
   bezwaar ertegen. Dat is geen formaliteit: een besluit laten heroverwegen door
   dezelfde persoon is geen heroverweging. Dezelfde regel als in
   kern/uitgifte.js, waar dezelfde ogen ook nooit dubbel tellen.

   EN EEN GRENS DIE HIER NIET MAG VERVAGEN: intrekken kan alleen bij een
   CONCEPT. Een vastgestelde naheffing is bekendgemaakt aan de zaak; die laat je
   niet stilletjes verdwijnen, die gaat via bezwaar -- met een motivering die de
   zaak kan lezen.

   De opslag en de vorm komen uit het moederbestand mee (bak, vind, publiek,
   gelijk); ze hier opnieuw schrijven zou twee plekken geven die dezelfde
   waarheid vasthouden (LAT.md regel 4). */
'use strict';

module.exports = (ctx, { bak, vind, publiek, gelijk, naheffingTerugbetaal }) => {
  const { save, nu, schoon, notifySupplier } = ctx;

  /* ---- intrekken: alleen een concept ---- */
  function naheffingIntrek(id, door, reden) {
    const n = vind(id);
    if (!n) return { status: 404, error: 'Deze naheffing kennen we niet.' };
    if (n.status !== 'concept') return { status: 409,
      error: 'Alleen een concept trekt u zo in. Een vastgestelde naheffing gaat via bezwaar; die is bekendgemaakt.' };
    const r = schoon(reden, 300);
    if (r.length < 6) return { status: 400, error: 'Noteer waarom u de naheffing intrekt.' };
    n.status = 'ingetrokken'; n.ingetrokkenDoor = schoon(door, 60); n.reden = r;
    save();
    return { ok: true, naheffing: publiek(n) };
  }

  /* ---- bezwaar: de zaak ---- */
  function naheffingBezwaar(code, id, reden) {
    const n = vind(id);
    if (!n || n.code !== String(code || '').toUpperCase())
      return { status: 404, error: 'Deze naheffing kennen we niet.' };
    if (n.status !== 'vastgesteld') return { status: 409,
      error: n.status === 'bezwaar' ? 'Uw bezwaar loopt al.'
        : n.status === 'concept' ? 'Deze naheffing is nog een concept en dus geen besluit; daar staat geen bezwaar tegen open.'
        : 'Tegen een naheffing met de stand "' + n.status + '" staat geen bezwaar open.' };
    const r = schoon(reden, 800);
    if (r.length < 6) return { status: 400, error: 'Schrijf op waarom u het er niet mee eens bent.' };
    n.status = 'bezwaar'; n.bezwaar = { reden: r, at: nu() };
    save();
    return { ok: true, naheffing: publiek(n),
      let: 'Uw bezwaar is geregistreerd. Een andere inspecteur dan wie de naheffing oplegde beoordeelt het.' };
  }

  /* ---- op het bezwaar beslissen: de derde ogen ---- */
  async function naheffingBeslisBezwaar(door, id, data) {
    data = data || {};
    const n = vind(id);
    if (!n) return { status: 404, error: 'Deze naheffing kennen we niet.' };
    if (n.status !== 'bezwaar') return { status: 409, error: 'Tegen deze naheffing loopt geen bezwaar.' };
    const wie = schoon(door, 60);
    if (wie.length < 2) return { status: 400, error: 'Een besluit op bezwaar staat altijd op naam.' };
    if (gelijk(wie, n.opgemaaktDoor) || gelijk(wie, n.vastgesteldDoor)) return { status: 409,
      error: 'Wie de naheffing opmaakte of vaststelde beslist niet op het bezwaar ertegen; dat is geen heroverweging.' };
    const motivering = schoon(data.motivering, 600);
    if (motivering.length < 6) return { status: 400, error: 'Een besluit op bezwaar draagt altijd een motivering.' };

    const toe = data.toewijzen === true;
    n.status = toe ? 'vernietigd' : 'gehandhaafd';
    n.bezwaar.besluit = toe ? 'toegewezen' : 'afgewezen';
    n.bezwaar.motivering = motivering; n.bezwaar.door = wie; n.bezwaar.op = nu();
    /* Een toegewezen bezwaar laat NIETS staan. Half terugdraaien zou betekenen
       dat er een bedrag blijft hangen waar geen besluit meer onder ligt. */
    if (toe) { n.naheffingCenten = 0; n.boeteCenten = 0; }
    save();
    /* En als er al BETAALD was, moet het geld terug. Een besluit dat de aanslag
       vernietigt en het bedrag laat staan, is een besluit dat niets doet. Het
       besluit zelf staat ook als de terugboeking hapert; dat wordt dan gemeld en
       niet verzwegen (./naheffing-betalen.js). */
    let geld = null;
    if (toe && naheffingTerugbetaal) geld = await naheffingTerugbetaal(n);
    if (notifySupplier) notifySupplier(n.code, { icon: 'overheid', title: 'Besluit op uw bezwaar',
      body: n.kenmerk + ': het bezwaar is ' + n.bezwaar.besluit + '. ' + motivering.slice(0, 160), scope: 'overheid' });
    return Object.assign({ ok: true, naheffing: publiek(n) }, geld ? { let: geld } : {});
  }

  /* ---- teruglezen ---- */
  function naheffingenLijst(filter) {
    filter = filter || {};
    let lijst = bak();
    if (filter.status) lijst = lijst.filter(n => n.status === String(filter.status));
    if (filter.periode) lijst = lijst.filter(n => n.periode === String(filter.periode).toUpperCase());
    return { ok: true, naheffingen: lijst.slice(0, 200).map(publiek),
      openBezwaren: bak().filter(n => n.status === 'bezwaar').length };
  }
  const naheffingVanZaak = (code) => ({ ok: true,
    naheffingen: bak().filter(n => n.code === String(code || '').toUpperCase() && n.status !== 'concept')
      .slice(0, 60).map(publiek) });

  return { naheffingIntrek, naheffingBezwaar, naheffingBeslisBezwaar,
    naheffingenLijst, naheffingVanZaak };
};
