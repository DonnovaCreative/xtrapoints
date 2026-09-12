import { useEffect, useMemo, useState } from 'react';
import BlockContent, { blocksToText, placeholders, type Block } from './BlockContent';

type Field = { id: string; label: string; placeholder: string; multiline?: boolean };
const storageKey = 'xp-resource-center-shared-v1';
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
export default function TemplateWorkbench({ title, blocks, sharedFields, rules = false }: { title: string; blocks: Block[]; sharedFields: Field[]; rules?: boolean }) {
  const [fields, setFields] = useState<Record<string, string>>({}), [remember, setRemember] = useState(false), [storageStatus, setStorageStatus] = useState('');
  const [directText, setDirectText] = useState<string | null>(null), [approved, setApproved] = useState(false), [status, setStatus] = useState(''), [fallback, setFallback] = useState('');
  const names = useMemo(() => placeholders(blocks), [blocks]);
  const sharedNames = new Set(sharedFields.map(field => field.placeholder));
  const draft = directText ?? blocksToText(blocks, fields);
  const unresolved = [...new Set([...draft.matchAll(/\[([^\[\]\n]+)\]/g)].map(match => match[1]))];
  const canApprove = rules && unresolved.length === 0 && Boolean(draft.trim());
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
      if (!saved || saved.remember !== true) return;
      const values: Record<string, string> = {};
      for (const field of sharedFields) if (typeof saved.fields?.[field.placeholder] === 'string') values[field.placeholder] = saved.fields[field.placeholder].slice(0, 3000);
      setFields(values); setRemember(true); setStorageStatus('Shared program details are remembered on this device.');
    } catch { setStorageStatus('Device storage is unavailable. You can still customize and download this draft.'); }
  }, []);
  function persist(next: Record<string, string>, save: boolean) {
    try {
      if (save) localStorage.setItem(storageKey, JSON.stringify({ remember: true, fields: Object.fromEntries(sharedFields.map(field => [field.placeholder, next[field.placeholder] || ''])) }));
      else localStorage.removeItem(storageKey);
      setStorageStatus(save ? 'Shared program details are remembered on this device.' : 'Details stay on this page until you leave.');
    } catch { setStorageStatus('Device storage is unavailable. Download your draft to keep your work.'); }
  }
  function changeField(name: string, value: string) {
    const next = { ...fields, [name]: value }; setFields(next); setApproved(false); setStatus('');
    if (remember && sharedNames.has(name)) persist(next, true);
  }
  // Message copy is deliberately only the subject/body/signature. Instructions
  // and draft status belong to this workbench, never in the recipient's email.
  const exportText = blocks.some(block => (block.type || block.kind) === 'message')
    ? draft
    : `${rules ? 'Participant rules' : title}\n\n${rules && !(approved && canApprove) ? 'Draft for review — complete open choices and obtain your organization’s approval before sharing.\n\n' : ''}${draft}`;
  const exportHtml = () => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>body{font:16px/1.65 Arial,sans-serif;color:#03116d;max-width:850px;margin:40px auto;padding:0 24px}h1{font-size:30px;line-height:1.2}pre{font:inherit;white-space:pre-wrap;overflow-wrap:anywhere;color:#202a43}.draft{border:1px solid #9ca3af;padding:14px}@media print{body{margin:0;padding:0}h1{break-after:avoid}}</style></head><body><h1>${escapeHtml(rules ? 'Participant rules' : title)}</h1>${approved && canApprove ? '' : '<p class="draft">Draft for review — complete open choices and obtain your organization’s approval before sharing.</p>'}<pre>${escapeHtml(draft)}</pre></body></html>`;
  async function copy() {
    try { await navigator.clipboard.writeText(exportText); setStatus(approved ? 'Participant copy copied.' : 'Draft copied. Complete and review it before sharing.'); }
    catch { setFallback(exportText); setStatus('Automatic copying is unavailable. Select and copy the text below.'); }
  }
  function download() {
    const url = URL.createObjectURL(new Blob([exportHtml()], { type: 'text/html;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `${rules ? 'participant-rules' : title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}${approved ? '' : '-draft'}.html`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus('HTML downloaded. Give this file to your website administrator when it is approved.');
  }
  function print() {
    const frame = document.createElement('iframe'); frame.title = 'Printable draft'; frame.style.cssText = 'position:fixed;width:1px;height:1px;bottom:0;left:0;border:0';
    frame.srcdoc = exportHtml(); document.body.appendChild(frame);
    frame.onload = () => { frame.contentWindow?.focus(); frame.contentWindow?.print(); setTimeout(() => frame.remove(), 60000); };
    setStatus('Use the print dialog to save a PDF. If it is unavailable, download the HTML and print it from your browser.');
  }
  return <section className="rc-workbench" aria-label="Template editor">
    <div className="rc-draft-toolbar"><div><strong>Your working draft</strong><p>{unresolved.length ? `${unresolved.length} bracketed details or choices to complete` : 'Review the wording and links before use'}</p></div><button type="button" className="rc-button" onClick={copy} disabled={!draft.trim()}>{rules ? 'Copy participant rules' : 'Copy draft'}</button></div>
    <details className="rc-editor-fields"><summary>Customize this {rules ? 'participant copy' : 'template'}</summary><p className="rc-muted">Use approved program details. Recipient details and full drafts stay on this page until you leave. Download a copy to keep your work.</p>
      <div className="rc-fields">{names.map(name => <label key={name}><span>{sharedFields.find(field => field.placeholder === name)?.label || name}</span>{name.length > 42 || sharedFields.find(field => field.placeholder === name)?.multiline ? <textarea value={fields[name] || ''} onChange={event => changeField(name, event.target.value)} maxLength={5000} rows={3} /> : <input value={fields[name] || ''} onChange={event => changeField(name, event.target.value)} maxLength={3000} autoComplete="off" />}</label>)}</div>
      <label className="rc-check"><input type="checkbox" checked={remember} onChange={event => { setRemember(event.target.checked); persist(fields, event.target.checked); }} />Remember only shared program details on this device</label>
      <p className="rc-muted">This saves organization, program name, purpose, administrator and program contact. Recipient details and full draft text are never saved.</p>
      <button type="button" className="rc-text-button" onClick={() => { const next = { ...fields }; sharedFields.forEach(field => delete next[field.placeholder]); setFields(next); setRemember(false); setApproved(false); persist(next, false); }}>Clear remembered program details</button><p className="rc-muted" role="status">{storageStatus}</p>
    </details>
    {rules && <details className="rc-editor-fields"><summary>Edit the complete wording</summary><p className="rc-muted">Remove unused options and internal instructions. Direct edits are kept separately from field values.</p><label className="rc-full-editor">Participant rules text<textarea rows={20} value={draft} onChange={event => { setDirectText(event.target.value); setApproved(false); setStatus(''); }} /></label>{directText !== null && <button type="button" className="rc-text-button" onClick={() => { setDirectText(null); setApproved(false); setStatus('Direct edits replaced with the current field values.'); }}>Replace direct edits with field values</button>}</details>}
    {directText !== null && <p className="rc-callout">You are using direct edits. Field changes will apply when you replace direct edits with field values.</p>}
    <div className="rc-draft-preview">{directText === null ? <BlockContent blocks={blocks} fields={fields} /> : <div className="rc-prose"><pre>{draft}</pre></div>}</div>
    {rules && <div className="rc-export-panel"><label className="rc-check"><input type="checkbox" disabled={!canApprove} checked={approved && canApprove} onChange={event => setApproved(event.target.checked)} />My organization has reviewed and approved this wording for sharing</label><p className="rc-muted">Complete all brackets to enable this choice. It removes the draft label from your export; it does not collect participant consent.</p><div className="rc-action-row"><button type="button" className="rc-button rc-button-secondary" onClick={download} disabled={!draft.trim()}>Download HTML</button><button type="button" className="rc-button rc-button-secondary" onClick={print} disabled={!draft.trim()}>Print / save PDF</button></div></div>}
    <p role="status" className="rc-action-status">{status}</p>{fallback && <label className="rc-full-editor">Select and copy your draft<textarea rows={10} readOnly value={fallback} onFocus={event => event.target.select()} /></label>}
  </section>;
}
