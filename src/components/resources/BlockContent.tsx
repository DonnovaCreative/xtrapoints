import { Fragment } from 'react';

import { filledText, type Block } from './templateText';
export { plainValue, filledText, blocksToText, placeholders, type Block } from './templateText';
function Text({ value, fields }: { value: unknown; fields?: Record<string, string> }) {
  return <>{filledText(value, fields).split(/(\[[^\[\]\n]+\])/g).map((part, index) => /^\[.*\]$/.test(part) ? <mark className="rc-placeholder" key={index}>{part}</mark> : <Fragment key={index}>{part}</Fragment>)}</>;
}
export default function BlockContent({ blocks, fields = {} }: { blocks: Block[]; fields?: Record<string, string> }) {
  return <div className="rc-prose">{blocks.map((block, index) => {
    const props = { key: `${block.id || index}-${index}` };
    const type = block.type || block.kind;
    if (type === 'image' && /^https?:\/\/|^\//.test(block.src || '')) return <figure className="rc-media" {...props}><img src={block.src} alt={block.alt || ''} loading="lazy" />{block.caption && <figcaption>{block.caption}</figcaption>}</figure>;
    if (type === 'video' && /^https?:\/\/|^\//.test(block.src || '')) return <figure className="rc-media" {...props}><video controls preload="metadata" aria-label={block.title || 'Instructional video'}><source src={block.src} />{block.captionsSrc && <track kind="captions" src={block.captionsSrc} srcLang="en" label="English" default />}</video>{block.caption && <figcaption>{block.caption}</figcaption>}{block.transcript && <details><summary>Read transcript</summary><p>{block.transcript}</p></details>}</figure>;
    if (type === 'media-placeholder') return <figure className="rc-media-placeholder" {...props}><strong>Planned {block.mediaType || 'screenshot'}</strong><p>{block.title}</p><figcaption>{block.brief || block.caption}</figcaption></figure>;
    if (type === 'steps') return <ol className="rc-content-steps" {...props}>{(block.items || []).map((item: any, i: number) => <li key={i}>{typeof item === 'string' ? <Text value={item} fields={fields} /> : <><strong>{item.title}</strong><p>{item.text}</p></>}</li>)}</ol>;
    if (type === 'heading' || type === 'h' || type === 'subheading') return <h2 {...props}><Text value={block.text} fields={fields} /></h2>;
    if (type === 'list' || type === 'bullets') return <ul {...props}>{block.items.map((item: unknown, i: number) => <li key={i}><Text value={item} fields={fields} /></li>)}</ul>;
    if (type === 'table') return <div {...props} className="rc-table-scroll" tabIndex={0} role="region" aria-label="Reference table, scroll horizontally on small screens"><table><thead><tr>{block.headers.map((header: string, i: number) => <th scope="col" key={i}><Text value={header} fields={fields} /></th>)}</tr></thead><tbody>{block.rows.map((row: string[], i: number) => <tr key={i}>{row.map((cell, j) => <td key={j}><Text value={cell} fields={fields} /></td>)}</tr>)}</tbody></table></div>;
    if (type === 'message') return <section {...props} className="rc-message-body">{blocks.length > 1 && <h2>{block.id} · {block.title}</h2>}{blocks.length > 1 && <p className="rc-annotation">{block.trigger}</p>}{block.subject && <p className="rc-subject"><strong>Subject: </strong><Text value={block.subject} fields={fields} /></p>}{block.body.map((paragraph: string, i: number) => <p key={i}><Text value={paragraph} fields={fields} /></p>)}</section>;
    if (type === 'link') return <p {...props}><a href={block.href}><Text value={block.text} fields={fields} /></a></p>;
    if (type === 'source') return <aside className="rc-source" {...props}><strong>{block.url && /^https?:\/\//.test(block.url) ? <a href={block.url} target="_blank" rel="noreferrer">{block.title}</a> : block.title}</strong><p>{block.observation}</p>{block.evidence_type && <small>{block.evidence_type}</small>}</aside>;
    if (type === 'callout') return <aside {...props} className="rc-callout"><Text value={block.text} fields={fields} /></aside>;
    return <p {...props}><Text value={block.text} fields={fields} /></p>;
  })}</div>;
}
