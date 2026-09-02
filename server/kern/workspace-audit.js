/* Begrensd auditspoor van muterende Workspace Actions. De domeinactie houdt
   haar eigen audit; dit spoor bewijst alleen wat de Action Broker vroeg en
   afrondde. Vrije payloads, namen en moduledata worden bewust niet bewaard. */
'use strict';
const ID = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)+$/;
const MODULE = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;
const FASE = new Set(['requested', 'completed', 'failed']);

function noteer(md, invoer, actor, op) {
  const x = invoer && typeof invoer === 'object' ? invoer : {};
  const action = String(x.action || '').slice(0, 100), owner = String(x.owner || '').slice(0, 80);
  const phase = String(x.phase || '');
  if (!ID.test(action) || !MODULE.test(owner) || !FASE.has(phase))
    return { status: 400, error: 'Ongeldige workspace-auditregel.' };
  if (!md.interface || typeof md.interface !== 'object' || Array.isArray(md.interface)) md.interface = {};
  if (!Array.isArray(md.interface.workspaceAudit)) md.interface.workspaceAudit = [];
  const regel = { action, owner, phase, actor: String(actor || 'member').slice(0, 80),
    workspaceId: String(x.workspaceId || 'default').replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 80) || 'default', at: op };
  md.interface.workspaceAudit.push(regel);
  if (md.interface.workspaceAudit.length > 200) md.interface.workspaceAudit.splice(0, md.interface.workspaceAudit.length - 200);
  return { ok: true, audit: regel };
}
function lees(md) {
  const regels = md && md.interface && Array.isArray(md.interface.workspaceAudit) ? md.interface.workspaceAudit : [];
  return regels.slice(-50).reverse();
}
module.exports = { noteer, lees };
