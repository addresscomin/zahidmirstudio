import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Activity, AlertTriangle, Bot, Building2, Check, ChevronDown, Plus, Search, ShieldCheck, Users } from 'lucide-react';
import { supabase } from './lib/supabase';
import ApprovalPanel from './ApprovalPanel';

type Org = { organization_id: string; role: string; organizations: { id: string; name: string } | null };
type AgentRow = { id: string; name: string; environment: string; framework: string | null; owner_id: string | null; created_at: string };
type PermissionRow = { agent_id: string; resource_name: string; access_level: string; reviewed_at: string | null };

export default function ConnectedWorkspace() {
  const [userId,setUserId] = useState('');
  const [activeTab,setActiveTab] = useState<'agents'|'approvals'>('agents');
  const [orgs,setOrgs] = useState<Org[]>([]);
  const [orgId,setOrgId] = useState('');
  const [orgName,setOrgName] = useState('');
  const [agents,setAgents] = useState<AgentRow[]>([]);
  const [permissions,setPermissions] = useState<PermissionRow[]>([]);
  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState(false);
  const [showOrg,setShowOrg] = useState(false);
  const [showAgent,setShowAgent] = useState(false);
  const [query,setQuery] = useState('');
  const [name,setName] = useState('');
  const [framework,setFramework] = useState('Not specified');
  const [environment,setEnvironment] = useState('development');
  const [ownerAssigned,setOwnerAssigned] = useState(true);
  const [tools,setTools] = useState('');
  const [notice,setNotice] = useState('');
  const [error,setError] = useState('');

  const loadAgents = useCallback(async (id: string) => {
    if (!supabase || !id) return;
    const [a,p] = await Promise.all([
      supabase.from('agents').select('id,name,environment,framework,owner_id,created_at').eq('organization_id',id).order('created_at',{ascending:false}),
      supabase.from('agent_permissions').select('agent_id,resource_name,access_level,reviewed_at').eq('organization_id',id)
    ]);
    if (a.error) throw a.error;
    if (p.error) throw p.error;
    setAgents((a.data ?? []) as AgentRow[]);
    setPermissions((p.data ?? []) as PermissionRow[]);
  },[]);

  const loadOrgs = useCallback(async () => {
    if (!supabase) return;
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!userData.user) throw new Error('Your session expired. Please sign in again.');
    setUserId(userData.user.id);
    const { data, error: orgError } = await supabase
      .from('organization_memberships')
      .select('organization_id,role,organizations(id,name)')
      .order('created_at',{ascending:true});
    if (orgError) throw orgError;
    const rows = (data ?? []) as unknown as Org[];
    setOrgs(rows);
    const nextId = rows[0]?.organization_id ?? '';
    setOrgId(nextId);
    if (nextId) await loadAgents(nextId);
    else setAgents([]);
  },[loadAgents]);

  useEffect(() => {
    loadOrgs().catch(e => setError(e.message ?? 'Could not load your workspace.')).finally(()=>setLoading(false));
  },[loadOrgs]);

  async function createOrg(e: FormEvent) {
    e.preventDefault();
    if (!supabase || !orgName.trim()) return;
    setBusy(true); setError('');
    const { data, error: createError } = await supabase.from('organizations')
      .insert({ name: orgName.trim(), created_by: userId }).select('id').single();
    if (createError) { setError(createError.message); setBusy(false); return; }
    setOrgName(''); setShowOrg(false);
    await loadOrgs();
    setOrgId(data.id);
    await loadAgents(data.id);
    setNotice('Workspace created.');
    setBusy(false);
  }

  async function createAgent(e: FormEvent) {
    e.preventDefault();
    if (!supabase || !orgId || !name.trim()) return;
    setBusy(true); setError('');
    const { data, error: insertError } = await supabase.from('agents').insert({
      organization_id: orgId, name: name.trim(), framework: framework.trim() || null,
      environment, owner_id: ownerAssigned ? userId : null
    }).select('id,name,environment,framework,owner_id,created_at').single();
    if (insertError) { setError(insertError.message); setBusy(false); return; }
    const resources = tools.split(',').map(x=>x.trim()).filter(Boolean);
    if (resources.length) {
      const { error: permissionError } = await supabase.from('agent_permissions').insert(
        resources.map(resource_name=>({ organization_id:orgId, agent_id:data.id, resource_name, access_level:'unknown' }))
      );
      if (permissionError) {
        setError('Agent saved, but its declared tools could not be saved: '+permissionError.message);
        await loadAgents(orgId); setBusy(false); return;
      }
    }
    await supabase.from('activity_events').insert({
      organization_id:orgId, agent_id:data.id, actor_id:userId,
      event_type:'agent.registered', summary:'Registered agent: '+data.name,
      metadata:{ environment, framework }
    });
    setName(''); setFramework('Not specified'); setEnvironment('development'); setTools('');
    setShowAgent(false); await loadAgents(orgId);
    setNotice('Agent saved to your Bencia workspace.');
    setBusy(false);
  }

  async function changeOrg(id: string) {
    setOrgId(id); setLoading(true); setError('');
    try { await loadAgents(id); } catch(e:any) { setError(e.message ?? 'Could not load agents.'); }
    finally { setLoading(false); }
  }

  const filtered = agents.filter(a => [a.name,a.framework ?? '',a.environment].join(' ').toLowerCase().includes(query.toLowerCase()));
  const flagged = agents.filter(a => !a.owner_id || permissions.some(p=>p.agent_id===a.id && !p.reviewed_at)).length;
  const activeOrg = orgs.find(o=>o.organization_id===orgId);
  if (loading) return <div className="connected-loading">Loading your secure Bencia workspace…</div>;

  return <div className="connected-app">
    <aside className="connected-side">
      <div className="brand"><span className="mark">B</span><span><b>BENCIA</b><small>CONTROL</small></span></div>
      <p className="eyebrow">WORKSPACE</p>
      {orgs.length>0 && <div className="org-select"><Building2 size={15}/><select value={orgId} onChange={e=>changeOrg(e.target.value)}>{orgs.map(o=><option key={o.organization_id} value={o.organization_id}>{o.organizations?.name ?? 'Workspace'}</option>)}</select><ChevronDown size={13}/></div>}
      <button className={`connected-nav ${activeTab==='agents'?'active':''}`} onClick={()=>setActiveTab('agents')}><Bot size={16}/> Agent registry</button>
      <button className={`connected-nav ${activeTab==='approvals'?'active':''}`} onClick={()=>setActiveTab('approvals')}><ShieldCheck size={16}/> Approvals</button>
      <div className="connected-user"><Users size={15}/><span>Signed-in member<small>{activeOrg?.role ?? 'No role'}</small></span></div>
      <button className="auth-signout" onClick={()=>supabase?.auth.signOut()}>Sign out</button>
    </aside>
    <main className="connected-main">
      <header><span>Bencia Control / <b>{activeOrg?.organizations?.name ?? 'Workspace setup'}</b></span><span className="live-label">● AUTHENTICATED</span></header>
      <section className="connected-content">
        {notice && <div className="notice"><Check size={15}/>{notice}<button onClick={()=>setNotice('')}>×</button></div>}
        {error && <div className="connected-error" role="alert">{error}</div>}
        {orgs.length===0 ? <div className="workspace-empty"><Building2 size={28}/><p className="eyebrow">FIRST-TIME SETUP</p><h1>Create your organization workspace.</h1><p>Your agent inventory will be isolated to this workspace. You can invite teammates after membership management is implemented.</p><button className="primary" onClick={()=>setShowOrg(true)}><Plus size={16}/> Create workspace</button></div> :
        activeTab==='approvals' ? <ApprovalPanel orgId={orgId} userId={userId} role={activeOrg?.role ?? 'member'} agents={agents.map(a=>({id:a.id,name:a.name}))}/> : <>
          <div className="connected-heading"><div><p className="eyebrow">ORGANIZATION INVENTORY</p><h1>Agent registry</h1><p className="sub">Live records from your organization database.</p></div><button className="primary" onClick={()=>setShowAgent(true)}><Plus size={16}/> Register agent</button></div>
          <div className="connected-metrics">
            <div><Bot/><strong>{agents.length}</strong><span>Registered agents</span></div>
            <div><AlertTriangle/><strong>{flagged}</strong><span>Need attention</span></div>
            <div><ShieldCheck/><strong>{Math.max(agents.length-flagged,0)}</strong><span>Without current flags</span></div>
            <div><Users/><strong>{agents.filter(a=>a.owner_id).length}</strong><span>Assigned owners</span></div>
          </div>
          <div className="connected-search"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search agents or frameworks"/></div>
          <div className="connected-table-wrap"><table><thead><tr><th>AGENT</th><th>OWNER</th><th>ENVIRONMENT</th><th>DECLARED TOOLS</th><th>REVIEW</th></tr></thead><tbody>
            {filtered.map(a=>{const ps=permissions.filter(p=>p.agent_id===a.id);return <tr key={a.id}><td><b>{a.name}</b><small>{a.id.slice(0,8)} · {a.framework ?? 'Framework not set'}</small></td><td>{a.owner_id===userId?'You':'Unassigned'}</td><td>{a.environment}</td><td>{ps.map(p=>p.resource_name).join(', ') || 'None declared'}</td><td><span className={a.owner_id && ps.every(p=>p.reviewed_at)?'status good':'status warn'}>{!a.owner_id?'Missing owner':ps.some(p=>!p.reviewed_at)?'Needs review':'No declared gaps'}</span></td></tr>})}
          </tbody></table>{filtered.length===0&&<p className="no-results">No agents found in this workspace.</p>}</div>
          <div className="connected-foot"><Activity size={17}/><span><b>Live organization data</b><small>Records are loaded through Supabase Auth and organization-scoped database policies.</small></span></div>
        </>}
      </section>
    </main>
    {showOrg && <div className="overlay"><form className="modal" onSubmit={createOrg}><h2>Create organization</h2><p className="sub">You will become the first workspace owner.</p><label>Organization name<input required minLength={2} maxLength={120} value={orgName} onChange={e=>setOrgName(e.target.value)} placeholder="e.g. Bencia Labs"/></label><div className="modal-actions"><button type="button" className="secondary" onClick={()=>setShowOrg(false)}>Cancel</button><button className="primary" disabled={busy}>{busy?'Creating…':'Create workspace'}</button></div></form></div>}
    {showAgent && <div className="overlay"><form className="modal" onSubmit={createAgent}><h2>Register an agent</h2><p className="sub">Only metadata is stored. Do not add secrets or prompt contents.</p><label>Agent name<input required maxLength={160} value={name} onChange={e=>setName(e.target.value)} placeholder="Support assistant"/></label><label>Framework<input value={framework} onChange={e=>setFramework(e.target.value)} placeholder="LangChain, custom, etc."/></label><label>Environment<select value={environment} onChange={e=>setEnvironment(e.target.value)}><option value="development">Development</option><option value="staging">Staging</option><option value="production">Production</option></select></label><label>Declared tools / APIs<input value={tools} onChange={e=>setTools(e.target.value)} placeholder="CRM API, Search API"/></label><label className="owner-check"><input type="checkbox" checked={ownerAssigned} onChange={e=>setOwnerAssigned(e.target.checked)}/> Assign me as the responsible owner</label><div className="modal-actions"><button type="button" className="secondary" onClick={()=>setShowAgent(false)}>Cancel</button><button className="primary" disabled={busy}>{busy?'Saving…':'Save agent'}</button></div></form></div>}
  </div>;
}
