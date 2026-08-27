/* ============================================================================
   DE STANDENMACHINE VAN EEN RETOUR -- wie mag wat, en in welke volgorde.

   Afgesplitst van ./retour.js omdat die met dit blok erbij op 12097 byte kwam,
   over de omvangregel van scripts/check.js. De knip loopt langs een echte grens:
   ./retour.js gaat over het ONTSTAAN van een retour (de aanvraag, het bevriezen
   van bedrag en tarief) en dit bestand over het BEWEGEN ervan.

   DRIE CONTROLES EN GEEN VIERDE. Mag deze stand na de huidige (de tabel NA in
   ./retourlijst.js), is de aanroeper de partij die hem hoort te zetten (het veld
   `door`), en is meegegeven wat bij die stand hoort. Wat er niet bij zit is een
   oordeel: deze laag beslist nergens iets namens de verkoper -- dat is
   COMMERCE.md grens 6 en de reden dat `door` in de standentabel staat en niet
   hier.
   ========================================================================== */
'use strict';

const { NA, STAND, STAATOP, UITKOMST } = require('./retourlijst');

module.exports = ({ save, klok, tekst, bij, ruim, publiek }) => {
  /* EEN STAND ZETTEN IS EEN HANDELING VAN EEN PARTIJ, en welke partij dat is
     staat in ./retourlijst.js. Deze functie controleert drie dingen en verzint
     er geen vierde bij: mag deze stand na de huidige, is de aanroeper de partij
     die hem hoort te zetten, en is wat er bij die stand hoort meegegeven. */
  function zet({ id, naar, door, wie, staat, uitkomst, bedragCenten, reden, orderKenmerk, verkoper, sleutel }) {
    ruim();
    const r = bij(id);
    if (!r) return { status: 404, error: 'Deze retouraanvraag bestaat niet.' };
    /* WIENS RETOUR IS DIT. Zonder deze twee regels beweegt elke verkoper de
       retour van de buurman en elk lid die van een ander -- de standentabel
       zegt namelijk alleen WELKE PARTIJ een stand zet, niet WELKE verkoper.
       Dat onderscheid stond er niet, en het is precies het gat waar een
       zaakcode-in-het-lijf altijd doorheen komt (zie de kop van
       routes/supplier/btw.js).

       Meegeven is optioneel omdat de kern ook zonder deur wordt gebruikt (een
       toets, een kantoorhandeling); wie hem WEL meegeeft, wordt eraan gehouden.
       De deuren in routes/ geven hem altijd mee, en nooit uit het verzoek. */
    if (verkoper != null && r.verkoper !== String(verkoper)) {
      return { status: 403, error: 'Deze retouraanvraag hoort niet bij deze zaak.' };
    }
    if (sleutel != null && r.sleutel !== String(sleutel)) {
      return { status: 403, error: 'Deze retouraanvraag is niet van jou.' };
    }
    const doel = STAND.get(tekst(naar, 30));
    if (!doel) return { status: 400, error: 'Die stand bestaat niet.' };
    if (!(NA[r.stand] || []).includes(doel.id)) {
      return { status: 409, error: 'Van "' + (STAND.get(r.stand) || {}).label + '" kan het niet naar "' + doel.label + '".' };
    }
    /* `termijn` zet zichzelf; niemand anders mag die stand kiezen. */
    if (doel.door === 'termijn') return { status: 403, error: 'Vervallen doet de termijn, niet een mens.' };
    if (String(door || '') !== doel.door) {
      return { status: 403, error: 'Deze stand zet de ' + doel.door + ', niet de ' + (door || 'onbekende partij') + '.' };
    }

    const stap = { stand: doel.id, door: doel.door, at: klok(), wie: tekst(wie, 80) || null };

    if (doel.id === 'aanvaard') {
      /* HET MOMENT WAAROP DE ORDER WORDT NAGEKEKEN, en de enige plek waar dat
         kan: de verkoper heeft de administratie waarin die order staat. */
      r.orderGecontroleerd = true;
      r.orderKenmerk = tekst(orderKenmerk, 80) || null;
    }
    if (doel.id === 'afgewezen') {
      const w = tekst(reden, 300);
      if (!w) return { status: 400, error: 'Afwijzen kan niet zonder reden; de koper hoort te weten waarom.' };
      stap.reden = w; r.besluit = { soort: 'afgewezen', reden: w, at: klok() };
    }
    if (doel.id === 'beoordeeld') {
      const st = STAATOP.get(tekst(staat, 30));
      if (!st) return { status: 400, error: 'Noteer in welke staat het is teruggekomen.' };
      r.staat = st.id;
      stap.staat = st.id;
      /* WAT ER MET DE VOORRAAD GEBEURT, GEBEURT NIET HIER. Deze laag zegt
         alleen of het TERUG KAN; de voorraad is van het domein (kern/retail,
         kern/keuken) en er komt geen vijfde voorraad bij -- zie de kop van
         kern/onderneming/voorraad.js. */
      r.voorraadKan = st.terugInVoorraad;
      r.voorraadGeboekt = false;
    }
    if (doel.id === 'afgehandeld') {
      const u = UITKOMST.get(tekst(uitkomst, 30));
      if (!u) return { status: 400, error: 'Kies een uitkomst uit de lijst.' };
      let terug = 0;
      if (u.geldTerug) {
        terug = u.id === 'deels-terug' ? Math.max(0, Math.round(Number(bedragCenten) || 0)) : r.centen;
        if (u.id === 'deels-terug' && (terug <= 0 || terug >= r.centen)) {
          return { status: 400, error: 'Een deelteruggave is meer dan nul en minder dan het hele bedrag.' };
        }
        if (!tekst(reden, 300) && u.id === 'deels-terug') {
          return { status: 400, error: 'Zeg waarom het maar een deel is; anders staat er een bedrag zonder uitleg.' };
        }
      }
      r.uitkomst = u.id;
      /* HET GELDBESLUIT STAAT KLAAR EN IS NIET UITGEVOERD. `uitgevoerd` blijft
         false tot een mens het langs kern/pay doet; deze laag heeft daar geen
         weg heen en die komt er ook niet (grens 2). */
      r.besluit = {
        soort: u.id, geldTerug: !!u.geldTerug, centen: terug,
        /* De btw-splitsing van de teruggave rust op het BEVROREN tarief van de
           aanvraag; zie de kop. Bij een deelteruggave naar rato. */
        btwCenten: (u.geldTerug && r.btw && r.centen > 0) ? Math.round(r.btw.btwCenten * (terug / r.centen)) : 0,
        tariefProcent: r.btw ? r.btw.tariefProcent : null,
        reden: tekst(reden, 300) || null,
        klaargezetOp: klok(), uitgevoerd: false, uitgevoerdOp: null
      };
      stap.uitkomst = u.id; stap.centen = terug;
    }

    r.stand = doel.id; r.bij = klok();
    r.stappen.push(stap);
    save();
    return { ok: true, retour: publiek(r) };
  }

  return { zet };
};
