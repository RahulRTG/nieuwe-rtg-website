/* DE GEMAKSNAMEN WAAR DE ROUTES EN KERN-MODULES MEE LEZEN EN SCHRIJVEN.

   Vijf collecties maal vier bewegingen (op sleutel, van klant, van zaak,
   toevoegen), plus de grens per collectie. Ze stonden onderaan ./index.js, tegen
   de indexmachinerie aan; dat bestand kwam met de vijfde collectie over de
   10 kB-grens van de keuring, en dit is de naad waarop dat rustig kan.

   De scheiding is niet alleen omvang. Hierboven, in ./index.js, staat HOE de
   index werkt (bouwen, bijhouden, de staart veilig kappen). Hier staat WELKE
   namen dit huis daarvoor gebruikt en wat hun grens is -- de kant die verandert
   als er een collectie bij komt, terwijl de machinerie gelijk blijft.

   De grenzen zijn allemaal instelbaar via de omgeving, zoals TX_RAM_* en TX_KAP.
   Wat erbuiten valt gaat naar het grootboek als dat actief is, en anders eerst
   naar het archief -- kappen zonder bewaren gebeurt hier nergens meer. */
'use strict';

module.exports = ({ txMetRef, txVanKlant, txVanZaak, txVoegToe }) => {
  const orderMetRef = ref => txMetRef('orders', ref);
  const ordersVanKlant = key => txVanKlant('orders', key);
  const ordersVanZaak = code => txVanZaak('orders', code);
  const ordersVoegToe = (o, opties) => txVoegToe('orders', o, opties);

  const BOEK_CAP = Math.max(1, Number(process.env.TX_BOEKINGEN_CAP || 50000));
  const boekingMetRef = ref => txMetRef('boekingen', ref);
  const boekingenVanKlant = key => txVanKlant('boekingen', key);
  const boekingenVanZaak = code => txVanZaak('boekingen', code);
  const boekingenVoegToe = b => txVoegToe('boekingen', b, { cap: BOEK_CAP });

  /* ---- de twee geldcollecties van directpay ----

     directBetalingen en betaalVerzoeken werden bijgehouden met
     `db.data.X.unshift(item); db.data.X = db.data.X.slice(0, N);`. Drie dingen
     gingen daar mis, en het derde is het ergste:

     1. De slice maakte bij ELKE betaling een kopie van de hele array (tot 200.000
        items). Dat is werk in het warme pad van een betaalverzoek.
     2. Zoeken ging met .find() over diezelfde array: O(N) per aanvraag.
     3. En wat er buiten de grens viel, verdween. Geen regel in de log, geen kopie.
        Dat is boeking 50.001 nog een keer, nu met betalingen. */
  const DP_CAP = Math.max(1, Number(process.env.TX_DIRECTBETALINGEN_CAP || 200000));
  const BV_CAP = Math.max(1, Number(process.env.TX_BETAALVERZOEKEN_CAP || 100000));
  const directBetalingMetRef = ref => txMetRef('directBetalingen', ref);
  const directBetalingenVanKlant = key => txVanKlant('directBetalingen', key);
  const directBetalingenVanZaak = code => txVanZaak('directBetalingen', code);
  const directBetalingenVoegToe = b => txVoegToe('directBetalingen', b, { cap: DP_CAP });
  const betaalVerzoekMetRef = ref => txMetRef('betaalVerzoeken', ref);
  // op codenaam, in kleine letters -- zie de reden bij COLLECTIES in ./collecties.js
  const betaalVerzoekenVoorCodenaam = naam => txVanKlant('betaalVerzoeken', String(naam || '').toLowerCase());
  const betaalVerzoekenVanZaak = code => txVanZaak('betaalVerzoeken', code);
  const betaalVerzoekenVoegToe = v => txVoegToe('betaalVerzoeken', v, { cap: BV_CAP });

  /* ---- de zichtbare boekingshistorie van RTG Pay (TAKEN.md 4.39) ----

     Stond als `grootboek().unshift(rij); if (len > 50000) pop();` in
     kern/pay/index.js -- hetzelfde patroon waarmee boeking 50.001 verdween, en
     in Postgres-stand reed de hele collectie bovendien in de trage flush-laan:
     na een harde crash klopte het saldo wel en ontbrak de regel in het overzicht.

     Langs deze weg krijgt elke regel een eigen upsert in het grootboek, gaat de
     staart bij een actief grootboek daarheen in plaats van te verdwijnen, en
     gaat hij zonder grootboek eerst naar het archief. De cap blijft 50.000: dat
     is een WEERGAVEcap en geen bewaartermijn -- de saldi zijn de waarheid.

     Op ID en niet op ref: een pay-regel heeft meestal geen ref (een overdracht
     tussen twee leden verwijst nergens naar). Zie ./collecties.js. */
  const PAYBOEK_CAP = Math.max(1, Number(process.env.TX_PAYBOEKINGEN_CAP || 50000));
  const payBoekingMetId = id => txMetRef('payBoekingen', id);
  const payBoekingenVoegToe = b => txVoegToe('payBoekingen', b, { cap: PAYBOEK_CAP });

  return {
    orderMetRef, ordersVanKlant, ordersVanZaak, ordersVoegToe,
    boekingMetRef, boekingenVanKlant, boekingenVanZaak, boekingenVoegToe,
    directBetalingMetRef, directBetalingenVanKlant, directBetalingenVanZaak, directBetalingenVoegToe,
    betaalVerzoekMetRef, betaalVerzoekenVoorCodenaam, betaalVerzoekenVanZaak, betaalVerzoekenVoegToe,
    payBoekingMetId, payBoekingenVoegToe
  };
};
