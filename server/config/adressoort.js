/* DE ADRESSOORT VAN EEN KALE HOSTNAAM: 'lokaal', 'openbaar' of 'onbekend'.

   Afgesplitst van ./openbaar.js (dat bestand ging over de 10 KB toen de
   IPv6-indeling erbij kwam). Daar staat waarom er drie antwoorden zijn en niet
   twee; dit bestand doet alleen de indeling van een naam of een adres. */
'use strict';

/* Gereserveerde en niet-routeerbare naamruimtes. Een adres hierin is geen bewijs
   van openbaar EN geen bewijs van lokaal -- het is een naam die nooit op het
   open internet uitkomt maar ook geen privaat netwerkadres is. RFC 6761 (.test,
   .invalid, .example, .localhost) plus de twee achtervoegsels die dit huis zelf
   in zijn eigen documenten gebruikt. */
const ONBESLIST_ACHTERVOEGSEL = ['.test', '.invalid', '.example', '.localhost', '.internal', '.intern',
  /* RFC 2606 reserveert niet alleen die TLD's maar OOK drie tweede-niveau-domeinen,
     en die stonden er eerst niet bij. Gevolg: `rtg.example.com` -- dat twee
     bestaande toetsen als APP_URL gebruiken (golive, poortwacht) -- werd als
     `openbaar` aangemerkt. Vandaag brak dat niets omdat die toetsen met
     NODE_ENV=production draaien, waar de bestaande grendel het al afvangt; de
     CLASSIFICATIE was er niet minder fout om, en hij zou bij de eerste toets
     zonder die vlag alsnog bijten. */
  '.example.com', '.example.net', '.example.org'];

function priveIPv4(host) {
  if (/^10\./.test(host) || /^192\.168\./.test(host)) return true;
  const m = /^172\.(\d+)\./.exec(host);
  return !!m && Number(m[1]) >= 16 && Number(m[1]) <= 31;
}

/* 'lokaal' | 'openbaar' | 'onbekend' voor een kale hostnaam (zonder schema).
   Een lege of onleesbare naam is 'onbekend' en nooit iets anders. */
/* EEN IPv6-LETTERLIJK ADRES. Dat heeft geen punt, en viel daardoor onder de
   regel "een naam zonder punt is een hostnaam op het eigen netwerk" -- een
   publiek IPv6-adres heette zo 'onbekend' en ontsnapte aan elke keuring voor
   een openbare installatie. Nu naar zijn reeks: loopback, unique local
   (fc00::/7) en link-local (fe80::/10) zijn lokaal; de documentatiereeks
   2001:db8::/32 en het ongespecificeerde adres zijn onbeslist; een ander
   unicastadres is openbaar. Een IPv4-adres in IPv6-jas volgt zijn IPv4-deel. */
function ipv6Soort(h) {
  if (h === '::1') return 'lokaal';
  if (h === '::') return 'onbekend';
  const v4 = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(h);
  if (v4) return adresSoort(v4[1]);
  const eerste = parseInt(h.split(':')[0] || '0', 16);
  if (!Number.isFinite(eerste)) return 'onbekend';
  if ((eerste & 0xfe00) === 0xfc00) return 'lokaal';      // fc00::/7
  if ((eerste & 0xffc0) === 0xfe80) return 'lokaal';      // fe80::/10
  if (/^2001:0?db8(:|$)/.test(h)) return 'onbekend';      // documentatie (RFC 3849)
  if ((eerste & 0xff00) === 0xff00) return 'onbekend';    // multicast: geen adres van een installatie
  return 'openbaar';
}

function adresSoort(host) {
  let h = String(host || '').trim().toLowerCase();
  if (!h) return 'onbekend';
  if (h.startsWith('[') && h.endsWith(']')) h = h.slice(1, -1);
  if (h === 'localhost' || h === '127.0.0.1' || h === '::1') return 'lokaal';
  if (h.includes(':')) return /^[0-9a-f:.]+$/.test(h) ? ipv6Soort(h) : 'onbekend';
  if (/^127\./.test(h)) return 'lokaal';
  if (h.endsWith('.local')) return 'lokaal';
  if (priveIPv4(h)) return 'lokaal';
  if (h === 'example.com' || h === 'example.net' || h === 'example.org') return 'onbekend';
  if (ONBESLIST_ACHTERVOEGSEL.some(s => h.endsWith(s))) return 'onbekend';
  /* Een naam zonder punt is een hostnaam op het eigen netwerk (een
     containernaam, een servicenaam), geen publiek domein. */
  if (!h.includes('.')) return 'onbekend';
  /* Een adres waar de wereld bij kan, is per definitie niet te bewijzen vanaf
     binnen het proces. Wat hier overblijft is een naam die als publiek domein
     is OPGEGEVEN, en dat is de bewering waar we hem aan houden. */
  return 'openbaar';
}


module.exports = { adresSoort };
