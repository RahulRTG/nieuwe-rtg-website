/* DEKKING: betaalt deze gebruiker wat hij kost?

   Het overzicht zegt wat iemand KOST. Dit zegt wat hij BETAALT, en het verschil
   ertussen. Dat verschil is de enige reden dat deze hele laag bestaat: zonder
   die twee getallen naast elkaar is een pasprijs een gok.

   ALLES EX BTW, EN DAT IS GEEN DETAIL. De nota van de hoster, het tarief van de
   modelaanbieder en de pasprijs in de boardroom staan alle drie exclusief btw;
   op de factuur van het lid komt de btw er één keer bij (kern/lid/facturen.js).
   Wie hier een bedrag inclusief btw naast een kostprijs exclusief btw legt,
   ziet 21% marge die er niet is.

   DRIE UITKOMSTEN, EN 'NIET VAST TE STELLEN' IS ER ÉÉN VAN:

     dekt        de bijdrage is hoger dan de kosten
     dekt-niet   de kosten zijn hoger dan de bijdrage
     onbekend    er is geen bijdrage die hierbij hoort, of geen kostprijs

   Die derde is niet hetzelfde als nul. De Business Pass is nadrukkelijk op maat
   (kern/pasprijs.js geeft daar null terug) en een zaak betaalt wat er in zijn
   leverancierscontract staat; dit huis kent dat bedrag hier niet. Een dekking
   van 0 zou dan "betaalt niets" zeggen, en dat is een bewering en geen meting.

   DE RTFOUNDATION IS GEEN TEKORT. Een gezin betaalt niets, dus per gezin komt er
   altijd 'dekt-niet' uit. Dat is geen probleem dat opgelost moet worden maar de
   bedoeling: de RTFoundation is gratis voor elk gezin. Daarom staat er een
   apart blok voor, met het totaal dat de RTFoundation draagt. */
'use strict';

const { maandCentenUit } = require('../pasprijs');

module.exports = (ctx) => {
  const { meter, overzicht, doorbelasting, geldPasprijzen, fonds } = ctx;

  /* Wat betaalt deze drager per maand, exclusief btw? null betekent "hier is
     geen bedrag van bekend", en dat is een antwoord. */
  function bijdrageVan(pas) {
    if (pas === 'gezin') return { centen: 0, waarom: 'De RTFoundation is gratis voor elk gezin.' };
    if (pas === 'huis') return { centen: null, waarom: 'Het huis betaalt zichzelf niets.' };
    if (pas === 'zaak') return { centen: null, waarom: 'Wat een zaak betaalt staat in zijn leverancierscontract; dat bedrag staat niet in deze laag.' };
    if (pas === 'business') return { centen: null, waarom: 'De Business Pass is op maat afgesproken; er is geen maandprijs om mee te rekenen.' };
    const c = maandCentenUit(geldPasprijzen, pas);
    if (c == null) return { centen: null, waarom: 'Voor deze pas is geen maandprijs ingesteld.' };
    return { centen: c, waarom: null };
  }

  function dekkingVoor(periode, drager, alVerdeeld) {
    const p = meter.periodeVan(periode);
    const o = overzicht.voorDrager(p, drager, alVerdeeld);
    const pas = doorbelasting.pasVan(drager, meter.kijk(p, drager));
    const b = bijdrageVan(pas);
    const kosten = o.totaal.centen;
    const uitkomst = b.centen == null ? 'onbekend' : (b.centen >= kosten ? 'dekt' : 'dekt-niet');
    return { periode: p, drager, wie: o.wie, pas,
      kostenCenten: kosten, bijdrageCenten: b.centen, waaromGeenBijdrage: b.waarom,
      verschilCenten: b.centen == null ? null : b.centen - kosten,
      uitkomst, graad: o.totaal.graad,
      /* De graad slaat op de KOSTEN. De bijdrage is een afspraak en geen
         meting; die kent geen graad en krijgt er dus ook geen. */
      graadZegtNiet: 'De bewijsgraad gaat over de kostenkant. De bijdrage komt uit de boardroom en is een afspraak, geen meting.' };
  }

  /* Het huisbeeld: kosten tegenover bijdragen, over alle gebruikers van een
     maand. Dit is de vraag "worden onze kosten gedekt", in één getal -- met de
     drie groepen eronder, want zonder die drie zegt dat ene getal te weinig. */
  function huis(periode) {
    const p = meter.periodeVan(periode);
    /* De verdeling van deze maand EEN keer; zie voorDrager in ./overzicht.js. */
    const verdeeld = overzicht.verdelingVan ? overzicht.verdelingVan(p) : null;
    const rijen = meter.dragers(p).map(dr => dekkingVoor(p, dr, verdeeld));
    const som = (f, veld) => rijen.filter(f).reduce((a, r) => a + (r[veld] || 0), 0);
    const kosten = som(() => true, 'kostenCenten');
    const bijdragen = som(r => r.bijdrageCenten != null, 'bijdrageCenten');
    const gezinnen = rijen.filter(r => r.pas === 'gezin');
    const onbekend = rijen.filter(r => r.bijdrageCenten == null);
    return {
      periode: p, gebruikers: rijen.length,
      kostenCenten: kosten, bijdragenCenten: bijdragen,
      verschilCenten: bijdragen - kosten,
      dekkingsgraad: kosten > 0 ? Math.round(bijdragen / kosten * 1000) / 1000 : null,
      /* Het percentage zegt niets zonder dit: over de gebruikers hieronder is
         geen bijdrage bekend, dus hun kosten tellen wél mee in de noemer en
         hun bijdrage niet in de teller. Dat drukt het cijfer, en dat hoort
         zichtbaar te zijn in plaats van weggerekend. */
      zonderBekendeBijdrage: { aantal: onbekend.length, kostenCenten: onbekend.reduce((a, r) => a + r.kostenCenten, 0),
        waarom: 'Business Pass (op maat), zaken (leverancierscontract) en het huis zelf.' },
      rtfoundation: {
        gezinnen: gezinnen.length, kostenCenten: gezinnen.reduce((a, r) => a + r.kostenCenten, 0),
        wieBetaalt: 'De RTFoundation. Een gezin krijgt hiervoor nooit een rekening.',
        fonds: fonds ? fondsBeeld() : null
      },
      tekort: rijen.filter(r => r.uitkomst === 'dekt-niet' && r.pas !== 'gezin')
        .sort((a, b) => a.verschilCenten - b.verschilCenten).slice(0, 25)
    };
  }

  /* Wat er in het fonds zit. Bewust NIET naast de maandkosten gelegd: dat
     totaal is een stand sinds het begin en geen maandbedrag, en twee getallen
     over een verschillende periode naast elkaar zetten leest als een
     vergelijking die er niet is. */
  function fondsBeeld() {
    try {
      /* Laat gebonden: het fonds wordt in server.js gebouwd en deze laag in een
         kernlaag ervoor. Een kopie op mountmoment zou undefined bevriezen --
         de stille breuk waar opzet/domeingrens.js over gaat. */
      const f = typeof fonds === 'function' ? fonds() : fonds;
      if (!f || typeof f.overzicht !== 'function') return null;
      const o = f.overzicht();
      return { totaalCenten: o.totaalCenten, teStortenCenten: o.teStortenCenten,
        zegtNiet: 'Dit is de stand sinds het begin, geen maandbedrag; hij is niet bedoeld om tegen de maandkosten hierboven af te zetten.' };
    } catch (e) { return null; }
  }

  return { dekkingVoor, huis, bijdrageVan };
};
