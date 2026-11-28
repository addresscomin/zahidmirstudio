import { useMemo, useState } from 'react';
import ConnectedWorkspace from './ConnectedWorkspace';
import { isSupabaseConfigured } from './lib/supabase';
import { Activity, AlertTriangle, Bot, Check, ChevronRight, FileClock, FileText, LayoutDashboard, Plus, Search, ShieldCheck, Users, X } from 'lucide-react';

type Agent = {
  id: string; name: string; framework: string; environment: string;
  owner: string; tools: string[]; data: string; review: 'Current' | 'Needs review' | 'Missing owner';
};
const seed: Agent[] = [
  { id:'AG-001', name:'Support Copilot', framework:'LangChain', environment:'Production', owner:'Aarav Mehta', tools:['CRM API','Knowledge Base'], data:'Customer records', review:'Current' },
  { id:'AG-002', name:'Invoice Extractor', framework:'Custom', environment:'Production', owner:'Isha Kapoor', tools:['Document Store','Billing API'], data:'Financial records', review:'Needs review' },
  { id:'AG-003', name:'Lead Researcher', framework:'CrewAI', environment:'Staging', owner:'Unassigned', tools:['CRM API','Web Search'], data:'Business contacts', review:'Missing owner' }
];
const nav = [
  ['Overview', LayoutDashboard], ['Agent registry', Bot], ['Approvals', ShieldCheck],
  ['Activity log', FileClock], ['Emergency control', AlertTriangle], ['Reports', FileText]
] as const;

export default function App() {
  const [page,setPage] = useState('Overview');
  const [agents,setAgents] = useState(seed);
  const [query,setQuery] = useState('');
  const [showForm,setShowForm] = useState(false);
  const [selected,setSelected] = useState<Agent|null>(null);
  const [name,setName] = useState('');
  const [owner,setOwner] = useState('');
  const [tools,setTools] = useState('');
  const [notice,setNotice] = useState('');
  const filtered = useMemo(() => agents.filter(a => [a.name,a.id,a.owner,a.framework].join(' ').toLowerCase().includes(query.toLowerCase())),[agents,query]);
  const flagged = agents.filter(a => a.review !== 'Current').length;
  if (isSupabaseConfigured) return <ConnectedWorkspace/>;
  function addAgent(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const item: Agent = { id:`AG-${String(agents.length+1).padStart(3,'0')}`, name:name.trim(), framework:'Not specified', environment:'Development', owner:owner.trim() || 'Unassigned', tools:tools.split(',').map(x=>x.trim()).filter(Boolean), data:'Not declared', review:owner.trim()?'Needs review':'Missing owner' };
    setAgents([item,...agents]); setName(''); setOwner(''); setTools(''); setShowForm(false);
    setNotice('Added to local preview only. Backend persistence is not connected.');
  }
  return <div className="app">
    <aside className="sidebar">
      <div className="brand"><span className="mark">B</span><span><b>BENCIA</b><small>CONTROL</small></span></div>
      <div className="workspace"><b>Northstar Labs</b><small>Workspace preview</small></div>
      <p className="eyebrow">WORKSPACE</p>
      {nav.map(([label,Icon])=><button key={label} className={page===label?'nav active':'nav'} onClick={()=>{setPage(label);setSelected(null)}}><Icon size={17}/>{label}</button>)}
      <div className="side-foot"><Users size={16}/> Alex Morgan <small>Preview admin</small></div>
    </aside>
    <main>
      <header><span>Workspace / <b>{selected?.name ?? page}</b></span><label className="preview">● PREVIEW DATA</label></header>
      <section className="content">
        {notice && <div className="notice"><Check size={15}/>{notice}<button onClick={()=>setNotice('')}><X size={15}/></button></div>}
        {selected ? <><button className="back" onClick={()=>setSelected(null)}>← Back to registry</button><h1>{selected.name}</h1><p className="sub">{selected.id} · {selected.framework} · {selected.environment}</p><div className="panel detail"><h3>Agent details</h3><p>Owner: <b>{selected.owner}</b></p><p>Data categories: <b>{selected.data}</b></p><p>Review status: <b>{selected.review}</b></p><h3>Declared tools and access</h3>{selected.tools.map(t=><div className="tool" key={t}>{t}<span>Declared</span></div>)}</div></> :
        page==='Overview' ? <>
          <div className="heading"><div><p className="eyebrow">GOVERNANCE WORKSPACE</p><h1>Know what your agents can access.</h1><p className="sub">A clear view of ownership, declared permissions and review gaps.</p></div><button className="primary" onClick={()=>setShowForm(true)}><Plus size={16}/> Register agent</button></div>
          <div className="metrics"><Metric icon={<Bot/>} label="Registered agents" value={agents.length}/><Metric icon={<AlertTriangle/>} label="Need attention" value={flagged}/><Metric icon={<ShieldCheck/>} label="Current reviews" value={agents.length-flagged}/><Metric icon={<Users/>} label="Assigned owners" value={agents.filter(a=>a.owner!=='Unassigned').length}/></div>
          <div className="section-title"><div><h2>Agent inventory</h2><p>Ownership, environment and declared access status.</p></div><button className="quiet" onClick={()=>setPage('Agent registry')}>View registry <ChevronRight size={15}/></button></div>
          <AgentTable agents={agents.slice(0,5)} onSelect={setSelected}/>
          <div className="panel foot-panel"><Activity size={18}/><div><b>Governance coverage</b><p>{Math.round((agents.length-flagged)/Math.max(agents.length,1)*100)}% of registered agents have a current review in this preview dataset.</p></div></div>
        </> : page==='Agent registry' ? <>
          <div className="heading"><div><p className="eyebrow">INVENTORY</p><h1>Agent registry</h1><p className="sub">Search registered agents and inspect their declared access.</p></div><button className="primary" onClick={()=>setShowForm(true)}><Plus size={16}/> Register agent</button></div>
          <div className="search"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search agents, owners or frameworks"/></div>
          <AgentTable agents={filtered} onSelect={setSelected}/>
        </> : <div className="empty"><div className="empty-icon"><ShieldCheck size={26}/></div><p className="eyebrow">PLANNED MODULE</p><h1>{page}</h1><p>This module is part of the approved Bencia Control specification. It will be implemented after the secure database and role model are in place.</p></div>}
      </section>
    </main>
    {showForm && <div className="overlay"><form className="modal" onSubmit={addAgent}><div className="modal-head"><div><h2>Register an agent</h2><p>Add basic metadata to the local preview.</p></div><button type="button" className="close" onClick={()=>setShowForm(false)}><X size={18}/></button></div><label>Agent name<input required value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Support Assistant"/></label><label>Owner<input value={owner} onChange={e=>setOwner(e.target.value)} placeholder="Responsible person"/></label><label>Tools and APIs<input value={tools} onChange={e=>setTools(e.target.value)} placeholder="CRM API, Search API"/></label><div className="modal-actions"><button type="button" className="secondary" onClick={()=>setShowForm(false)}>Cancel</button><button className="primary">Add agent</button></div><p className="hint">Preview only. Do not enter customer data or secrets.</p></form></div>}
  </div>;
}
function Metric({icon,label,value}:{icon:React.ReactNode;label:string;value:number}) { return <div className="metric"><div className="metric-icon">{icon}</div><strong>{String(value).padStart(2,'0')}</strong><span>{label}</span></div> }
function AgentTable({agents,onSelect}:{agents:Agent[];onSelect:(a:Agent)=>void}) {
  return <div className="table-wrap"><table><thead><tr><th>AGENT</th><th>OWNER</th><th>ENVIRONMENT</th><th>DECLARED TOOLS</th><th>REVIEW</th></tr></thead><tbody>{agents.map(a=><tr key={a.id} onClick={()=>onSelect(a)}><td><b>{a.name}</b><small>{a.id} · {a.framework}</small></td><td>{a.owner}</td><td>{a.environment}</td><td>{a.tools.join(', ')||'None declared'}</td><td><span className={a.review==='Current'?'status good':'status warn'}>{a.review}</span></td></tr>)}</tbody></table>{agents.length===0&&<p className="no-results">No matching agents.</p>}</div>;
}
