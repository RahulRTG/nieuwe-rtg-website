/* EEN KASSACODE INNEN -- WELKE DRAGER DAN OOK.

   Dit bestand bestaat omdat er vier kassa-ingangen zijn en maar een manier hoort
   te zijn waarop een betaalcode binnenkomt. Sinds RTG Link draagt de QR van een
   lid een ondertekende verwijzing (kern/pay/kassacode.js) in plaats van de code
   zelf; de code van zes tekens blijft daarnaast bestaan, want een kassa zonder
   camera laat hem voorlezen. Twee dragers dus, en elke ingang moet ze allebei
   kennen.

   Het blok dat dat regelt stond eerst voluit in routes/supplier/kassa/verkoop.js.
   Toen de andere drie ingangen aan de beurt kwamen, zou het er drie keer bij
   worden overgeschreven -- en dan is de vraag niet OF ze uit elkaar gaan lopen
   maar wanneer (LAT.md regel 4). Nu staat het hier, en roepen alle vier het aan.

   WAT ER NIET VERANDERT: het innen zelf is en blijft `kasInt` in ./kassa.js.
   Ook langs de capabilityweg boekt dat bestand; wat de laag ertussen doet is de
   kaart tonen en een mens laten bevestigen. Er is EEN plek waar een kassacode
   wordt verzilverd, en die blijft het.

   DE IDEMPOTENTIESLEUTEL GAAT BIJ DE CAPABILITY NIET MEE. Die krijgt de laag van
   zichzelf, gebonden aan die ene verwijzing; een tweede sleutel van de kassa
   ernaast zou twee waarheden zijn over dezelfde vraag.

   `kern` komt hier als geheel binnen en niet als losse functies, met opzet: de
   linklaag wordt later gemonteerd dan RTG Pay, dus `kern.linkCapAanvaard` moet
   bij de AANROEP worden gelezen en niet bij het maken. Dat is dezelfde val die
   de gezinsdeur al een keer heeft laten struikelen (zie routes/link.js). */
'use strict';

const IS_TOKEN = (tekst) => String(tekst || '').slice(0, 5) === 'RTG1.';

module.exports = (kern) => {
  /* Geeft terug wat `kasInt` teruggeeft: { van, kosten, ... } of
     { status, error }. De aanroeper hoeft dus niet te weten welke drager het
     was -- en dat is precies de bedoeling. */
  return async function kasInnen({ supplierCode, supplierNaam, code, centen, oms, idem }) {
    const tekst = String(code || '');
    if (IS_TOKEN(tekst) && typeof kern.linkCapAanvaard === 'function') {
      const r = await kern.linkCapAanvaard({ soort: 'supplier', code: supplierCode }, tekst, null,
        { centen, oms: oms || supplierNaam });
      if (r.error) return r;
      /* GEEN STIL `|| {}`. Zonder uitkomst zou `betaler` leeg blijven en legde de
         kassa een bon aan die als betaald geldt zonder dat er iemand bij hoort --
         en dat valt pas op in de boekhouding. Een laag die ja zegt zonder
         uitkomst is stuk, en dat hoort te klinken (LAT.md regel 5). */
      return r.uitkomst || { status: 500, error: 'De betaling gaf geen uitkomst terug.' };
    }
    return kern.pay.kasInt({ supplierCode, code: tekst, centen, oms: oms || supplierNaam, idem });
  };
};
