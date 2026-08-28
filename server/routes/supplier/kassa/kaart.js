/* DE CADEAUKAART VERZILVEREN -- de regel, op EEN plek.

   Twee ingangen halen saldo van een kaart: de losse inwisseling aan de balie
   (/api/supplier/giftcard/redeem) en de kassabon die met een kaart wordt
   betaald (/api/supplier/pos/sale met method 'cadeaukaart'). Ze doen hetzelfde
   werk en moeten dezelfde grenzen aanhouden -- de kaart is van DEZE zaak, het
   bedrag is echt een bedrag, en er kan nooit meer af dan erop staat. Twee
   kopieen van die drie regels is een kwestie van tijd (LAT.md regel 4).

   HET VERSCHIL TUSSEN DE TWEE ZIT IN DE BOEKHOUDING, en daarom draagt elke
   verzilvering `viaBon`. Komt de inwisseling van een kassabon, dan staat de
   omzet AL op die bon, met zijn eigen regels en dus het juiste btw-tarief;
   `financeVoor` telt hem dan niet nog een keer. Bij een losse inwisseling is er
   geen bon, en dan is de verzilvering zelf het omzetmoment (TAKEN.md 4.27).
   ========================================================================== */
'use strict';

/* Geeft { error, status } of { kaart, bedrag }. Schrijft zelf niet weg: de
   aanroeper bepaalt wanneer er wordt opgeslagen, want bij de kassabon hoort de
   afboeking bij dezelfde save als de bon. */
function verzilver(db, supplierCode, ruweCode, ruwBedrag, actor, viaBon) {
  const code = String(ruweCode || '').trim().toUpperCase();
  const g = (db.data.giftcards || []).find(x => x.code === code && x.supplierCode === supplierCode);
  if (!g) return { status: 404, error: 'Deze cadeaukaart kennen we hier niet.' };
  const bedrag = Math.round(Number(ruwBedrag) * 100) / 100;
  if (!(bedrag > 0)) return { status: 400, error: 'Geen geldig bedrag.' };
  if (bedrag > g.saldo) return { status: 409, error: 'Onvoldoende saldo: er staat nog € ' + g.saldo + ' op deze kaart.' };
  g.saldo = Math.round((g.saldo - bedrag) * 100) / 100;
  g.verzilveringen = g.verzilveringen || [];
  g.verzilveringen.push({ bedrag, at: new Date().toISOString(), actor,
    viaBon: viaBon || null, bron: viaBon ? 'kassa' : 'handmatig' });
  return { kaart: g, bedrag };
}

module.exports = { verzilver };
