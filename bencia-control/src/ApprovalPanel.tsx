import { FormEvent, useEffect, useState } from 'react';
import { Check, Clock3, Plus, ShieldCheck, X } from 'lucide-react';
import { supabase } from './lib/supabase';

type Agent = { id: string; name: string };
type Approval = {
  id: string; agent_id: string; requested_by: string; status: string;
  request_summary: string; decided_by: string | null; decided_at: string | null;
  created_at: string; agents: { name: string } | null;
};

export default function ApprovalPanel({ orgId, userId, role, agents }: {
  orgId: string; userId: string; role: string; agents: Agent[];
}) {
  const [rows,setRows] = useState<Approval[]>([]);
  const [agentId,setAgentId] = useState('');
  const [summary,setSummary] = useState('');
  const [showForm,setShowForm] = useState(false);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const canDecide = ['owner','admin','reviewer'].includes(role);

  async function load() {
    if (!supabase) return;
    const { data,error } = await supabase.from('approval_requests')
      .select('id,agent_id,requested_by,status,request_summary,decided_by,decided_at,created_at,agents(name)')
      .eq('organization_id',orgId).order('created_at',{ascending:false});
    if (error) throw error;
    setRows((data ?? []) as unknown as Approval[]);
  }
  useEffect(()=>{ load().catch(e=>setError(e.message ?? 'Could not load approval requests.')); },[orgId]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!supabase || !agentId || !summary.trim()) return;
    setBusy(true); setError(''); setNotice('');
    const { error } = await supabase.from('approval_requests').insert({
      organization_id:orgId, agent_id:agentId, requested_by:userId, request_summary:summary.trim()
    });
    if (error) setError(error.message);
    else { setSummary(''); setAgentId(''); setShowForm(false); setNotice('Approval request submitted.'); await load(); }
    setBusy(false);
  }

  async function decide(id:string, decision:'approved'|'rejected'|'changes_requested') {
    if (!supabase) return;
    setBusy(true); setError(''); setNotice('');
    const { error } = await supabase.rpc('decide_approval_request',{p_request_id:id,p_decision:decision});
    if (error) setError(error.message);
    else { setNotice('Decision recorded in the activity history.'); await load(); }
    setBusy(false);
  }

  return <section className="approval-panel">
    <div className="connected-heading"><div><p className="eyebrow">GOVERNANCE WORKFLOW</p><h1>Approval requests</h1><p className="sub">Review agent access requests and record accountable decisions.</p></div><button className="primary" onClick={()=>setShowForm(true)} disabled={!agents.length}><Plus size={16}/> New request</button></div>
    {notice && <div className="notice"><Check size={15}/>{notice}</div>}
    {error && <div className="connected-error" role="alert">{error}</div>}
    {!canDecide && <p className="approval-note"><ShieldCheck size={15}/> Your role can submit and view requests. Owner, admin or reviewer role is required to decide.</p>}
    <div className="approval-list">
      {rows.map(r=><article className="approval-card" key={r.id}>
        <div className="approval-card-top"><span className={'status '+(r.status==='pending'?'warn':'good')}>{r.status.replace('_',' ')}</span><small><Clock3 size={12}/> {new Date(r.created_at).toLocaleString()}</small></div>
        <h3>{r.agents?.name ?? 'Agent'}</h3><p>{r.request_summary}</p>
        <small className="approval-meta">Requested by {r.requested_by===userId?'you':r.requested_by.slice(0,8)}</small>
        {r.status==='pending' && canDecide && <div className="approval-actions">
          <button className="secondary" disabled={busy} onClick={()=>decide(r.id,'changes_requested')}>Request changes</button>
          <button className="secondary" disabled={busy} onClick={()=>decide(r.id,'rejected')}><X size={13}/> Reject</button>
          <button className="primary" disabled={busy} onClick={()=>decide(r.id,'approved')}><Check size={13}/> Approve</button>
        </div>}
        {r.decided_at && <small className="approval-meta">Decision recorded {new Date(r.decided_at).toLocaleString()}</small>}
      </article>)}
      {rows.length===0 && <div className="approval-empty"><ShieldCheck size={24}/><b>No approval requests yet</b><span>Create a request to begin the review trail.</span></div>}
    </div>
    {showForm && <div className="overlay"><form className="modal" onSubmit={submit}><h2>New approval request</h2><p className="sub">Describe the access or change that needs review.</p><label>Agent<select required value={agentId} onChange={e=>setAgentId(e.target.value)}><option value="">Choose an agent</option>{agents.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label><label>Request summary<textarea required maxLength={1000} rows={4} value={summary} onChange={e=>setSummary(e.target.value)} placeholder="Explain the requested access and why it is needed."/></label><div className="modal-actions"><button type="button" className="secondary" onClick={()=>setShowForm(false)}>Cancel</button><button className="primary" disabled={busy}>{busy?'Submitting…':'Submit request'}</button></div></form></div>}
  </section>;
}
