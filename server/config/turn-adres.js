/* Adresclassificatie voor de TURN/STUN-keuring: welke host is openbaar, en
   welke is privé, loopback, gereserveerd of een plaatshouder. Afgesplitst van
   config/turn.js op de 10 KB-grens; config/turn.js exporteert ze ongewijzigd. */
'use strict';

const net = require('node:net');

const PLAATSHOUDER = /(?:voorbeeld|example|placeholder|change-?me|your-?(?:domain|host)|vul-?in|dummy|test-?only)/i;
const GERESERVEERD_DOMEIN = /(?:^|\.)(?:localhost|local|internal|invalid|test|example)$/i;
const VOORBEELD_DOMEIN = /(?:^|\.)example\.(?:com|net|org)$/i;

function priveIpv4(host) {
  const p = host.split('.').map(Number);
  if (p.length !== 4 || p.some(x => !Number.isInteger(x) || x < 0 || x > 255)) return true;
  return p[0] === 0 || p[0] === 10 || p[0] === 127 || p[0] >= 224 ||
    (p[0] === 100 && p[1] >= 64 && p[1] <= 127) ||
    (p[0] === 169 && p[1] === 254) ||
    (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
    (p[0] === 192 && (p[1] === 168 || p[1] === 0 || (p[1] === 0 && p[2] === 2))) ||
    (p[0] === 198 && (p[1] === 18 || p[1] === 19 || p[1] === 51 && p[2] === 100)) ||
    (p[0] === 203 && p[1] === 0 && p[2] === 113);
}

function priveIpv6(host) {
  const h = host.toLowerCase();
  if (h === '::' || h === '::1' || h.startsWith('2001:db8:') || h === '2001:db8::') return true;
  if (/^f[cd]/.test(h) || /^fe[89ab]/.test(h) || /^ff/.test(h)) return true;
  const mapped = ipv4Mapped(h);
  return mapped ? priveIpv4(mapped) : false;
}

/* Node herkent zowel ::ffff:127.0.0.1 als ::ffff:7f00:1 als IPv6. Alleen de
   eerste tekstvorm controleren laat dezelfde private IPv4-bestemming dus via
   hex-notatie binnen. Normaliseer de acht groepen en haal de laatste 32 bits
   terug voordat de gewone IPv4-classificatie beslist. */
function ipv4Mapped(host) {
  let h = String(host || '').toLowerCase();
  if (net.isIP(h) !== 6) return null;
  const gestippeld = h.match(/^(?:::ffff:)(\d+\.\d+\.\d+\.\d+)$/);
  if (gestippeld) return gestippeld[1];
  const kanten = h.split('::');
  if (kanten.length > 2) return null;
  const links = kanten[0] ? kanten[0].split(':') : [];
  const rechts = kanten.length === 2 && kanten[1] ? kanten[1].split(':') : [];
  const ontbrekend = 8 - links.length - rechts.length;
  if (ontbrekend < 0 || (kanten.length === 1 && ontbrekend !== 0)) return null;
  const groepen = [...links, ...Array(ontbrekend).fill('0'), ...rechts]
    .map(x => Number.parseInt(x || '0', 16));
  if (groepen.length !== 8 || groepen.some(x => !Number.isInteger(x) || x < 0 || x > 0xffff)) return null;
  if (groepen.slice(0, 5).some(x => x !== 0) || groepen[5] !== 0xffff) return null;
  return [groepen[6] >> 8, groepen[6] & 255, groepen[7] >> 8, groepen[7] & 255].join('.');
}

function openbareHost(host) {
  const kaal = String(host || '').replace(/^\[|\]$/g, '').toLowerCase();
  const ip = net.isIP(kaal);
  if (ip === 4) return !priveIpv4(kaal);
  if (ip === 6) return !priveIpv6(kaal);
  if (!kaal.includes('.') || kaal.length > 253 || PLAATSHOUDER.test(kaal) ||
      GERESERVEERD_DOMEIN.test(kaal) || VOORBEELD_DOMEIN.test(kaal)) return false;
  return kaal.split('.').every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label));
}

module.exports = { PLAATSHOUDER, priveIpv4, priveIpv6, ipv4Mapped, openbareHost };
