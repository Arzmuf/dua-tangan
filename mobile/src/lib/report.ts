import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { api } from './api';
import { dayTime } from './format';
import type { Report } from './types';

const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function buildHtml(r: Report): string {
  const rows = r.entries
    .map(
      (e) => `<tr class="${e.flagged ? 'flag' : ''}">
        <td class="n">${e.seq}</td>
        <td class="t">${escape(dayTime(e.created_at))}</td>
        <td>${escape(e.summary)}${e.flagged ? ' <span class="tag">Heated tone</span>' : ''}</td>
        <td class="h">${e.hash.slice(0, 12)}</td>
      </tr>`,
    )
    .join('');
  const parents = r.members.map((m) => escape(m.name)).join(' &amp; ');
  const kids = r.children.map((c) => escape(c.name)).join(', ');
  const verified = r.verification.valid
    ? `<div class="ok">✓ Integrity verified — all ${r.verification.count} entries match their hash chain.</div>`
    : `<div class="bad">⚠ Integrity check failed at entry #${r.verification.broken_seq}. The record may have been altered.</div>`;

  return `<!doctype html><html><head><meta charset="utf-8"><title>Dua Tangan activity report</title>
  <style>
    body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1D2B28;margin:32px;font-size:12px}
    h1{font-size:22px;margin:0 0 4px} .muted{color:#5F6F6B}
    .ok,.bad{margin:16px 0;padding:10px 12px;border-radius:10px;font-weight:600}
    .ok{background:#DDEFE9;color:#3F7F6E} .bad{background:#FFE4EA;color:#B83A57}
    table{width:100%;border-collapse:collapse;margin-top:8px}
    th{text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#5F6F6B;border-bottom:1px solid #E7ECEA;padding:6px 8px}
    td{padding:7px 8px;border-bottom:1px solid #F1F4F3;vertical-align:top}
    td.n{color:#97A3A0;width:28px} td.t{white-space:nowrap;width:130px} td.h{font-family:Menlo,monospace;color:#97A3A0;width:96px}
    tr.flag td{background:#FFF6F8} .tag{background:#FFE4EA;color:#B83A57;border-radius:6px;padding:1px 6px;font-size:10px;font-weight:600}
    footer{margin-top:18px;font-size:10px;color:#97A3A0}
  </style></head><body>
  <h1>Dua Tangan — Activity report</h1>
  <div class="muted">${parents}${kids ? ` · ${kids}` : ''} · ${r.entries.length} entries</div>
  <div class="muted">Generated ${escape(dayTime(r.generated_at))} · times shown in this device's time zone</div>
  ${verified}
  <table><thead><tr><th>#</th><th>When</th><th>What happened</th><th>Seal</th></tr></thead><tbody>${rows}</tbody></table>
  <footer>Each entry's seal is a SHA-256 hash that includes the previous entry's seal, so any edit or deletion breaks the chain.</footer>
  </body></html>`;
}

function printOnWeb(html: string) {
  // expo-print on web only calls window.print() on the current page, so print the report from a hidden iframe.
  const iframe = document.createElement('iframe');
  Object.assign(iframe.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
  document.body.appendChild(iframe);
  const frame = iframe.contentWindow;
  if (!frame) return;
  frame.document.open();
  frame.document.write(html);
  frame.document.close();
  setTimeout(() => {
    frame.focus();
    frame.print();
    setTimeout(() => iframe.remove(), 1000);
  }, 300);
}

export async function exportReport(): Promise<void> {
  const report = await api<Report>('/record/report');
  const html = buildHtml(report);
  if (Platform.OS === 'web') {
    printOnWeb(html);
    return;
  }
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Share activity report' });
  } else {
    await Print.printAsync({ uri });
  }
}
