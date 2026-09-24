/* Magnaat Economische Motor -- de geldstromen.

   Elke functie hier maakt een gebalanceerde gebeurtenis en niets anders. Wat
   per bedrijf verschilt (kredietruimte, kasbuffer) komt uit het profiel; de
   motor kent geen bedrijf bij naam. */
'use strict';
const { GEBEURTENIS, rond, geld, datumOpDag } = require('./constanten');

module.exports = (m) => {
  function saldo(e, code) {
    return e.rekeningen[code] ? rond(e.rekeningen[code].saldo) : 0;
  }

  function creditWaarde(e, code) {
    return Math.max(0, -saldo(e, code));
  }

  function kas(e, actor) {
    return Math.max(0, saldo(e, actor + '.kas'));
  }

  function legUit(e, soort, titel, uitleg, effect, bron) {
    e.verklaringen.unshift({ dag: e.dag, datum: datumOpDag(e.dag), soort, titel, uitleg, effect: effect || '', bron: bron || 'economische regel' });
    if (e.verklaringen.length > 120) e.verklaringen.length = 120;
  }

  function audit(e, actor, actie, detail) {
    e.audit.unshift({ dag: e.dag, datum: datumOpDag(e.dag), actor: String(actor || 'systeem').slice(0, 100), actie, detail: String(detail || '').slice(0, 400) });
    if (e.audit.length > 300) e.audit.length = 300;
  }

  function leen(e, bedrijf, bedrag, sleutel, actor) {
    bedrag = geld(bedrag);
    if (bedrag <= 0) return null;
    const b = e.bedrijven[bedrijf];
    const limiet = m.profiel.bedrijven[bedrijf].kredietLimiet;
    const bestaand = creditWaarde(e, bedrijf + '.schuld');
    if (bestaand + bedrag > limiet) return { status: 400, error: 'De lening overschrijdt de synthetische kredietlimiet.' };
    m.boek(e, sleutel, GEBEURTENIS.LENING, 'Lening aan ' + b.naam, [
      m.regel('bank.leningen', 'bank', 'Uitstaande leningen', 'actief', 'debet', bedrag),
      m.regel('bank.depositos', 'bank', 'Gecreeerde deposito', 'schuld', 'credit', bedrag),
      m.regel(bedrijf + '.kas', bedrijf, 'Bank en kas', 'actief', 'debet', bedrag),
      m.regel(bedrijf + '.schuld', bedrijf, 'Bankschuld', 'schuld', 'credit', bedrag)
    ], ['krediet']);
    b.schuld = creditWaarde(e, bedrijf + '.schuld');
    audit(e, actor, 'lening', b.naam + ' leent ' + bedrag + ' cent');
    return { ok: true, bedrag, schuld: b.schuld };
  }

  function betaalStroom(e, sleutel, soort, omschrijving, van, naar, bedrag, kostenRekening, opbrengstRekening, labels) {
    bedrag = Math.max(0, geld(bedrag));
    if (!bedrag) return null;
    return m.boek(e, sleutel, soort, omschrijving, [
      m.regel(van + '.' + kostenRekening, van, omschrijving, 'kosten', 'debet', bedrag),
      m.regel(van + '.kas', van, 'Bank en kas', 'actief', 'credit', bedrag),
      m.regel(naar + '.kas', naar, 'Bank en kas', 'actief', 'debet', bedrag),
      m.regel(naar + '.' + opbrengstRekening, naar, omschrijving, 'opbrengsten', 'credit', bedrag)
    ], labels);
  }

  /* Voorraad is geen kostenpost op het moment van inkopen. De onderneming
     ruilt kas voor een actief; pas wanneer een eenheid wordt verkocht valt de
     kostprijs in de resultatenrekening. Dit onderscheid is essentieel voor
     voorraadsturing, liquiditeit en een balans die economen kan trainen. */
  function koopVoorraad(e, sleutel, b, levering) {
    const bedrag = Math.max(0, rond(levering * e.instellingen.inkoopPerEenheid));
    if (!bedrag) return null;
    return m.boek(e, sleutel, GEBEURTENIS.VOORRAAD_INKOOP, 'Inkoop voorraad ' + b.naam, [
      m.regel(b.id + '.voorraad', b.id, 'Voorraad', 'actief', 'debet', bedrag),
      m.regel(b.id + '.kas', b.id, 'Bank en kas', 'actief', 'credit', bedrag),
      m.regel('leverancier.kas', 'leverancier', 'Bank en kas', 'actief', 'debet', bedrag),
      m.regel('leverancier.omzet', 'leverancier', 'Omzet leveringen', 'opbrengsten', 'credit', bedrag)
    ], ['aanbod', 'keten', 'voorraad']);
  }

  function boekKostprijs(e, sleutel, b, verkoop) {
    const bedrag = Math.max(0, rond(verkoop * e.instellingen.inkoopPerEenheid));
    if (!bedrag) return null;
    return m.boek(e, sleutel, GEBEURTENIS.KOSTPRIJS, 'Kostprijs verkochte diensten ' + b.naam, [
      m.regel(b.id + '.kostprijs', b.id, 'Kostprijs omzet', 'kosten', 'debet', bedrag),
      m.regel(b.id + '.voorraad', b.id, 'Voorraad', 'actief', 'credit', bedrag)
    ], ['kostprijs', 'voorraad']);
  }

  function zorgLiquiditeit(e, bedrijf, nodig) {
    const beschikbaar = kas(e, bedrijf);
    if (beschikbaar >= nodig) return 0;
    const buffer = m.profiel.bedrijven[bedrijf].kasBuffer;
    const bedrag = Math.max(buffer, nodig - beschikbaar + buffer);
    const lening = leen(e, bedrijf, bedrag, 'dag:' + e.dag + ':noodkrediet:' + bedrijf, 'automatische liquiditeitsregel');
    if (lening && lening.ok) {
      legUit(e, 'financiering', 'Liquiditeitsbuffer geactiveerd', 'De kas was lager dan de verwachte dagverplichtingen. De bank verstrekte krediet binnen de vooraf bepaalde limiet.', '+' + bedrag + ' cent kas', 'krediet- en liquiditeitsregel');
      return bedrag;
    }
    return 0;
  }

  return { saldo, creditWaarde, kas, legUit, audit, leen, betaalStroom, koopVoorraad, boekKostprijs, zorgLiquiditeit };
};
