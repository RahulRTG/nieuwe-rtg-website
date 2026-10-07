/* Productiekeuring van de herstelkanalen. De module controleert alleen routes
   die de verzendlaag werkelijk leest; een ingevuld maar ongebruikt veld mag
   nooit een groen productiebewijs opleveren. */
'use strict';

const OUD_MAILVELD = 'SMTP_' + 'HOST';
const turn = require('./turn');

function keurCommunicatie(env, fouten, waarschuwingen, priveBeta) {
  /* mail.js leest SMTP_URL (of de afzonderlijke MAIL_DIRECT-route), niet het
     historische SMTP_HOST-veld. */
  if (!env.SMTP_URL) {
    if (priveBeta) {
      waarschuwingen.push('Geen mailprovider in private beta: herstel- en bevestigingsmail blijft zichtbaar in de lokale outbox.');
    } else if (env[OUD_MAILVELD]) {
      fouten.push(OUD_MAILVELD + ' wordt niet door de verzendlaag gelezen. Zet de werkelijke mailroute met SMTP_URL.');
    } else {
      fouten.push('Geen echte mailprovider ingesteld: herstel- en bevestigingsmail zou alleen in de lokale outbox belanden. Zet SMTP_URL.');
    }
  }
  if (env.SMTP_URL && env.MAIL_PROVIDER_DKIM !== '1' && !(env.DKIM_PRIVATE_KEY && env.MAIL_DOMEIN)) {
    waarschuwingen.push('RTG ondertekent smarthost-mail niet zelf met DKIM. Bevestig dat de SMTP-provider DKIM met uitlijning op MAIL_FROM zet, of configureer MAIL_DOMEIN en DKIM_PRIVATE_KEY.');
  }
  const publiekeDomeinen=[env.RTG_MAIL_PUBLIEK_BASIS, env.RTF_MAIL_PUBLIEK_DOMEIN]
    .filter(Boolean).map(x => String(x).toLowerCase().replace(/^\.+|\.+$/g, ''));
  if (publiekeDomeinen.length) {
    const basis=publiekeDomeinen[0];
    const dkim=String(env.MAIL_DOMEIN || '').toLowerCase().replace(/^\.+|\.+$/g, '');
    if (!env.SMTP_URL) fouten.push('Publieke persoonlijke mail staat aan zonder SMTP-provider. Zet eerst SMTP_URL.');
    const inkomend=String(env.MAIL_INBOUND_PROVIDER || '').toLowerCase();
    if (inkomend !== 'aws-ses' && !env.MAIL_IN_POORT)
      fouten.push('Publieke persoonlijke mail staat aan zonder inkomende mailroute. Zet MAIL_INBOUND_PROVIDER=aws-ses of richt MAIL_IN_POORT veilig in.');
    if (inkomend === 'aws-ses' && String(env.SES_INBOUND_SECRET || '').length < 32)
      fouten.push('AWS SES-ontvangst vereist SES_INBOUND_SECRET van minstens 32 willekeurige tekens.');
    const providerDkim=env.MAIL_PROVIDER_DKIM === '1';
    if (!providerDkim && (!env.DKIM_PRIVATE_KEY || !dkim))
      fouten.push('Publieke persoonlijke mail vereist provider-DKIM (MAIL_PROVIDER_DKIM=1) of RTG-DKIM met DKIM_PRIVATE_KEY en MAIL_DOMEIN.');
    if (!providerDkim && dkim && basis !== dkim && !basis.endsWith('.' + dkim) && !dkim.endsWith('.' + basis)) {
      fouten.push('RTG_MAIL_PUBLIEK_BASIS en MAIL_DOMEIN lijnen niet uit; DMARC zou persoonlijke mail kunnen weigeren.');
    }
    if (!providerDkim && publiekeDomeinen.length > 1)
      fouten.push('Twee publieke afzenderdomeinen vereisen provider-DKIM per domein; één lokale MAIL_DOMEIN-sleutel kan beide niet correct uitlijnen.');
    waarschuwingen.push('Publieke persoonlijke mail vereist daarnaast live MX, SPF en DMARC op ieder domein; controleer die na iedere DNS-wijziging met de maildiagnose.');
  }

  /* Er is nog geen extern SMS-kanaal. Productie blijft dicht totdat de
     beheerder telefoonherstel aantoonbaar fail-closed heeft uitgeschakeld. */
  if (!priveBeta && env.RTG_HERSTEL_SMS_UIT_BEWUST !== '1') {
    fouten.push('Geen echte SMS-provider aangesloten: zet RTG_HERSTEL_SMS_UIT_BEWUST=1 om telefoonherstel bewust fail-closed uit te schakelen.');
  }

  /* Voice en video staan in Connection OS als werkelijk geïmplementeerde
     capabilities. Alleen STUN is daarvoor geen volledige productieketen:
     symmetrische NAT, streng 4G en bedrijfsfirewalls vereisen een relais. Een
     publieke release mag die acties dus niet projecteren terwijl TURN slechts
     een waarschuwing is. Private/lokale beta blijft bruikbaar voor een directe
     netwerkproef, maar publieke productie faalt hier dicht. */
  if (!priveBeta) {
    const stun = turn.projecteerStun(env, { publiekeProductie:true });
    if (!stun.urls || stun.fouten.length) {
      fouten.push('STUN-configuratie is niet veilig voor publieke productie: gebruik een geldig stun:/stuns:-adres met expliciete poort op exact STUN_PUBLIC_HOST (of de APP_URL-host); geen lege items, externe host, testnaam of lokaal/privaat adres (' +
        [...new Set(stun.fouten.map(x => x.reden))].join(', ') + ').');
    }
    const relay = turn.ontleedLijst(env.TURN_URL, { publiekeProductie:true });
    if (!String(env.TURN_URL || '').trim()) {
      fouten.push('TURN_URL ontbreekt: live voice/video is dan niet betrouwbaar via 4G, symmetrische NAT en bedrijfsfirewalls.');
    }
    if (String(env.TURN_URL || '').trim() && (!relay.urls.length || relay.fouten.length))
      fouten.push('TURN_URL is niet veilig voor publieke productie: gebruik minstens een volledig turns:-adres, eventueel aangevuld met turn:...?transport=udp, met een openbare host en expliciete geldige poort; geen lege items, kale of TCP-plaintext turn:, testnamen of lokale/private adressen (' +
        [...new Set(relay.fouten.map(x => x.reden))].join(', ') + ').');
    if (!turn.credentials(env, { publiekeProductie:true }))
      fouten.push('TURN-authenticatie ontbreekt of is te zwak: zet een willekeurig TURN_SECRET (32+ tekens) voor kortlevende TURN REST-credentials; herhaling en plaatshouders tellen niet, en een vaste TURN_USER/TURN_PASS is in publieke productie niet toegestaan omdat die ongewijzigd naar elke browser gaat.');
    if (env.STUN_FALLBACK_GOOGLE === '1') {
      fouten.push('STUN_FALLBACK_GOOGLE=1 is niet toegestaan in publieke productie: gebruik de eigen STUN/TURN-keten zonder stille externe metadata-uitgang.');
    }
  }
}

module.exports = { keurCommunicatie };
