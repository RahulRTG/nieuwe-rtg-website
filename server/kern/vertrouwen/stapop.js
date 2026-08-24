/* ============================================================================
   DE STEP-UP -- laag 3 van de Trust Fabric (VERTROUWEN.md par. 6).

   Invisible when safe, unmistakable when important. Deze module beslist aan
   welke kant van die zin een handeling valt, uit twee gemeten dingen en niets
   anders: de blootstelling (laag 1) en de verificatie (laag 2).

   DE ENIGE ECHTE ONTWERPFOUT DIE HIER TE MAKEN IS, is te vaak vragen. Wie bij
   elke handeling een tweede bevestiging krijgt, klikt hem binnen een week weg
   zonder te lezen -- en dan hebben we de veiligheid VERLAAGD en de bediening
   verzwaard. Vandaar dat een lichte handeling nooit vraagt, hoe zwak de
   verificatie ook is: bij een handeling die niets raakt, is een zwakke sessie
   geen probleem dat je bij de gebruiker neerlegt.

   VIER UITSLAGEN, EN DE LAATSTE TWEE ZIJN HET INTERESSANTST:

     niet nodig     licht, of zwaar met een verse harde verificatie
     nodig          en er is iemand om het aan te vragen
     NODIG MAAR ONMOGELIJK  de handeling verdient een tweede moment, maar achter
                    deze deur staat geen mens (een beheer-token, een API-sleutel).
                    Dat is geen fout van deze module maar een bevinding OVER de
                    deur, en hij hoort geteld te worden in plaats van weggerond.
     ONZEKER        de blootstelling is ongewogen, dus we weten niet hoe groot
                    dit is. Wij vragen dan niets -- anders vraagt het systeem bij
                    elke onbekende handeling -- maar de onzekerheid reist mee als
                    veld, zodat de Trust HUD hem kan tellen. Een getal dat naar
                    nul moet, en niet een stilte die als groen leest.
   ========================================================================== */
'use strict';

const V = require('./verificatie');

/* Welke sterktes bij een zware handeling niet volstaan. 'overgenomen' staat er
   bewust bij: de provider van de klant heeft geverifieerd en wij weten niet hoe
   hard, dus bij een zware handeling vragen wij er zelf een moment bij. Dat is
   geen wantrouwen tegen die klant maar het ontbreken van een bron. */
const TE_ZACHT = new Set(['geen', 'zwak', 'overgenomen']);

function beoordeel(bloot, ver) {
  const b = bloot || {};

  if (b.gemeten === false) return {
    nodig: false, mogelijk: true, onzeker: true,
    waarom: [], zin: null,
    reden: 'Deze handeling is ongewogen (' + (b.reden || 'geen reden meegegeven') +
      '), dus er is geen omvang om een tweede moment op te baseren. Er wordt niets gevraagd, en dat is een keuze en geen oordeel.'
  };

  if (b.zwaarte === 'licht') return { nodig: false, mogelijk: true, onzeker: false, waarom: [], zin: null };

  /* Vanaf hier is de handeling zwaar of uitzonderlijk. */
  const waarom = [b.zin];
  let nodig = b.zwaarte === 'uitzonderlijk';

  if (!ver) {
    /* Niet vastgelegd is niet hetzelfde als niemand. Wij weten het niet, en dat
       is bij een zware handeling zelf een reden om te vragen. */
    nodig = true;
    waarom.push('Van deze sessie is niet vastgelegd hoe en wanneer hij is geverifieerd.');
    return { nodig, mogelijk: true, onzeker: false, waarom, zin: samen(waarom) };
  }

  if (TE_ZACHT.has(ver.sterkte)) {
    nodig = true;
    waarom.push(ver.sterkte === 'geen'
      ? 'Achter deze sleutel staat geen geverifieerde persoon.'
      : 'Deze sessie is geverifieerd met ' + ver.naam + ', en dat is voor een handeling van deze omvang niet hard genoeg.');
  }
  if (!ver.vers && ver.sterkte !== 'geen') {
    nodig = true;
    waarom.push('De verificatie van deze sessie is ' + minuten(ver.ouderdomMs) +
      ' oud; voor een handeling van deze omvang houden wij ' + Math.round(V.VERS_MS / 60000) + ' minuten aan.');
  }
  if (ver.apparaatNieuw) {
    nodig = true;
    waarom.push('Dit apparaat is nieuw voor dit account.');
  }

  /* Zwaar, maar vers en hard geverifieerd op een bekend apparaat: dan merkt de
     gebruiker hier niets van, en dat is de bedoeling van de hele laag. */
  if (!nodig) return { nodig: false, mogelijk: true, onzeker: false, waarom: [], zin: null };

  /* Vragen kan alleen aan iemand. Een sleutel heeft geen tweede moment. */
  const mogelijk = ver.sterkte !== 'geen';
  return {
    nodig: true, mogelijk, onzeker: false, waarom,
    zin: samen(waarom) + (mogelijk
      ? ' Daarom vragen wij een tweede bevestiging.'
      : ' Een tweede bevestiging is hier op zijn plaats, maar deze deur kent geen persoon om het aan te vragen.')
  };
}

const minuten = (ms) => {
  const m = Math.round((Number(ms) || 0) / 60000);
  return m < 1 ? 'minder dan een minuut' : (m === 1 ? 'een minuut' : m + ' minuten');
};

/* De zinnen aan elkaar, en niet meer dan drie. Vier redenen achter elkaar leest
   niemand, en de vierde voegt zelden iets toe aan het besluit. */
const samen = (r) => r.filter(Boolean).slice(0, 3).join(' ');

module.exports = { beoordeel, TE_ZACHT, minuten };
