/* Cadeaukaarten: het verzilveren op EEN plek.

   Waarom dit een eigen module is en niet in de route bleef staan: sinds
   TAKEN.md 4.27 zijn er twee wegen waarlangs een kaart wordt aangesproken --
   de kassa die een bon aanslaat op betaalwijze 'cadeaukaart'
   (/api/supplier/pos/sale) en het losse innen aan de balie
   (/api/supplier/giftcard/redeem). Beide halen hetzelfde bedrag van dezelfde
   kaart af; twee kopieen van die controle lopen uiteen zodra er een derde weg
   bijkomt.

   WAT HIER NIET GEBEURT, en dat is het hele punt van 4.27: deze functie boekt
   GEEN omzet en GEEN factuur. Ze verlaagt het saldo en schrijft de
   verzilvering op de kaart, meer niet. De omzet hoort op de kassabon te staan
   die erbij hoort -- de inwisseling is de BETAALWIJZE en niet een tweede
   optelling ernaast. Zolang de maandboekhouding het bedrag zelf nog eens
   optelde, telde een zaak die de bon aansloeg en de kaart verzilverde hem twee
   keer. */

/* Verzilver `bedrag` van kaart `code` bij deze zaak.
   Geeft { error, status } of { kaart } terug -- nooit een uitzondering, want
   de aanroepers zijn routes die het antwoord in gewone taal doorgeven. */
function verzilver(db, supplierCode, code, bedrag, actor) {
  const gezocht = String(code || '').trim().toUpperCase();
  if (!gezocht) return { error: 'Voer de code van de cadeaukaart in.', status: 400 };
  const g = (db.data.giftcards || []).find(x => x.code === gezocht && x.supplierCode === supplierCode);
  if (!g) return { error: 'Deze cadeaukaart kennen we hier niet.', status: 404 };
  const bed = Math.round(Number(bedrag) * 100) / 100;
  if (!(bed > 0)) return { error: 'Geen geldig bedrag.', status: 400 };
  if (bed > g.saldo) return { error: 'Onvoldoende saldo: er staat nog € ' + g.saldo + ' op deze kaart.', status: 409 };
  g.saldo = Math.round((g.saldo - bed) * 100) / 100;
  g.verzilveringen = g.verzilveringen || [];
  g.verzilveringen.push({ bedrag: bed, at: new Date().toISOString(), actor: actor || 'kassa' });
  return { kaart: g, bedrag: bed };
}

module.exports = { verzilver };
