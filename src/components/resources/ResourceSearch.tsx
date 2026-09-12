import { useEffect, useMemo, useState } from 'react';
type Result = { title: string; href: string; resource: string; resourceTitle: string; kind: string; text: string; category: string };
export default function ResourceSearch({ compact = false }: { compact?: boolean }) {
  const [query, setQuery] = useState(''), [index, setIndex] = useState<Result[]>([]), [status, setStatus] = useState(''), [expanded, setExpanded] = useState(false);
  useEffect(() => {
    if (!expanded || index.length) return;
    const controller = new AbortController();
    setStatus('Loading search…');
    fetch('/resources/search.json', { signal: controller.signal }).then(response => { if (!response.ok) throw new Error(); return response.json(); }).then(data => { setIndex(data.items); setStatus(''); }).catch(error => { if (error.name !== 'AbortError') setStatus('Search is unavailable. You can still browse every resource below.'); });
    return () => controller.abort();
  }, [expanded, index.length]);
  const results = useMemo(() => {
    const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    return index.filter(item => terms.every(term => `${item.title} ${item.text} ${item.category} ${item.resourceTitle}`.toLowerCase().includes(term))).sort((a, b) => terms.filter(term => b.title.toLowerCase().includes(term)).length - terms.filter(term => a.title.toLowerCase().includes(term)).length);
  }, [query, index]);
  return <div className={`rc-search ${compact ? 'rc-search-compact' : ''}`}>
    <label htmlFor="rc-resource-search">Search the toolkit</label>
    <div className="rc-search-field"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></svg><input id="rc-resource-search" type="search" value={query} autoComplete="off" placeholder="Try “recruitment”, “budget” or “qualification”" onFocus={() => setExpanded(true)} onChange={event => { setQuery(event.target.value); setExpanded(true); }} onKeyDown={event => { if (event.key === 'Escape') { setExpanded(false); setQuery(''); } }} aria-controls="rc-search-results" /></div>
    {expanded && query.trim() && <div className="rc-search-results" id="rc-search-results"><p role="status">{status || `${results.length} ${results.length === 1 ? 'result' : 'results'}`}</p>{results.slice(0, 30).map(result => <a key={result.href} href={result.href}><strong>{result.title}</strong><span>{result.resourceTitle} · {result.kind === 'template' ? 'Message or template' : result.category}</span></a>)}{!status && !results.length && <p>Try fewer words, or browse one of the six resources.</p>}{results.length > 30 && <p>Showing the first 30 results. Add another word to narrow your search.</p>}<button type="button" className="rc-text-button" onClick={() => { setQuery(''); setExpanded(false); }}>Clear search</button></div>}
  </div>;
}
