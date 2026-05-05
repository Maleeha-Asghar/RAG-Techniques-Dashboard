import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://vhbsivfjgmdfjxqmzrvs.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZoYnNpdmZqZ21kZmp4cW16cnZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NDE5MDcsImV4cCI6MjA5MzExNzkwN30.FGOW_6ZD0TBw2Qxo67TQ2Rd-yKXR1W7l7519LdzU4Io';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentSection = 'overview';
let D = { techniques:[], clusters:[], stages:[], problems:[], mechanisms:[], relationships:[], illustrations:[] };

// ── Auth ──
window.handleLogin = async () => {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const errEl = document.getElementById('loginError');
    errEl.style.display = 'none';
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { errEl.textContent = error.message; errEl.style.display = 'block'; }
    else checkAuth();
};

window.handleLogout = async () => {
    await supabase.auth.signOut();
    document.getElementById('adminApp').classList.remove('active');
    document.getElementById('loginScreen').style.display = 'flex';
};

async function checkAuth() {
    const { data:{session} } = await supabase.auth.getSession();
    if (session) {
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('adminApp').classList.add('active');
        document.getElementById('adminEmail').textContent = session.user.email;
        await loadAll();
        render();
    }
}

supabase.auth.onAuthStateChange((e) => {
    if (e === 'SIGNED_OUT') {
        document.getElementById('adminApp').classList.remove('active');
        document.getElementById('loginScreen').style.display = 'flex';
    }
});

// ── Data ──
async function loadAll() {
    const [t,c,s,p,m,r,i] = await Promise.all([
        supabase.from('techniques').select('*,clusters(id,name,color),stages(id,name),problems(id,name),mechanisms(id,name)').order('name'),
        supabase.from('clusters').select('*').order('name'),
        supabase.from('stages').select('*').order('display_order'),
        supabase.from('problems').select('*').order('name'),
        supabase.from('mechanisms').select('*').order('name'),
        supabase.from('technique_relationships').select('*,technique:technique_id(name),related:related_technique_id(name)'),
        supabase.from('technique_illustrations').select('*,technique:technique_id(name)')
    ]);
    D.techniques=t.data||[]; D.clusters=c.data||[]; D.stages=s.data||[];
    D.problems=p.data||[]; D.mechanisms=m.data||[]; D.relationships=r.data||[]; D.illustrations=i.data||[];
}

// ── Nav ──
window.switchSection = (s) => {
    currentSection = s;
    document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.section === s));
    render();
};

function render() {
    const el = document.getElementById('mainContent');
    const fn = { overview:renderOverview, techniques:renderTechniques, clusters:renderClusters, stages:renderStages, problems:renderProblems, mechanisms:renderMechanisms, relationships:renderRelationships, illustrations:renderIllustrations };
    el.innerHTML = (fn[currentSection]||renderOverview)();
}

// ── Helpers ──
function toast(msg, type='success') {
    const t = document.getElementById('toast');
    t.textContent = msg; t.className = `toast ${type} show`;
    setTimeout(() => t.classList.remove('show'), 3000);
}
window.openModal = () => document.getElementById('modalOverlay').classList.add('open');
window.closeModal = () => document.getElementById('modalOverlay').classList.remove('open');

function selOpts(items, selected, valueKey='id', labelKey='name') {
    return items.map(i => `<option value="${i[valueKey]}" ${i[valueKey]===selected?'selected':''}>${i[labelKey]}</option>`).join('');
}

window.deleteRecord = async (table, id, name) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) toast(error.message, 'error');
    else { toast('Deleted!', 'success'); await loadAll(); render(); }
};

// ── Overview ──
function renderOverview() {
    return `<h2>Dashboard Overview</h2><p class="subtitle">RAG Techniques database statistics</p>
    <div class="stats-row">
        ${[['Techniques',D.techniques.length],['Clusters',D.clusters.length],['Stages',D.stages.length],['Problems',D.problems.length],['Mechanisms',D.mechanisms.length],['Relationships',D.relationships.length],['Illustrations',D.illustrations.length]]
        .map(([l,v])=>`<div class="stat-card"><div class="stat-value">${v}</div><div class="stat-label">${l}</div></div>`).join('')}
    </div>
    <h3 style="margin-top:20px;margin-bottom:12px">Recent Techniques</h3>
    <div class="table-container"><table><tr><th>Name</th><th>Cluster</th><th>Stage</th><th>Created</th></tr>
    ${D.techniques.slice(0,10).map(t=>`<tr><td>${t.name}</td><td><span class="badge badge-${(t.clusters?.id||'').toLowerCase()}">${t.clusters?.name||'—'}</span></td><td>${t.stages?.name||'—'}</td><td style="color:var(--text-muted)">${new Date(t.created_at).toLocaleDateString()}</td></tr>`).join('')}
    </table></div>`;
}

// ── Techniques ──
function renderTechniques() {
    return `<h2>Techniques</h2><p class="subtitle">${D.techniques.length} techniques</p>
    <div class="toolbar"><input type="search" id="techSearch" placeholder="Search..." oninput="filterTech()"><button class="btn btn-primary" onclick="openTechModal()">+ Add Technique</button></div>
    <div class="table-container" id="techTable">${techTable(D.techniques)}</div>`;
}

function techTable(list) {
    if (!list.length) return '<div class="empty-state">No techniques found</div>';
    return `<table><tr><th>Name</th><th>Cluster</th><th>Problem</th><th>Stage</th><th>Mechanism</th><th>Desc</th><th>Actions</th></tr>
    ${list.map(t=>`<tr><td style="max-width:240px">${t.name}</td><td><span class="badge badge-${(t.clusters?.id||'').toLowerCase()}">${t.clusters?.name||'—'}</span></td><td>${t.problems?.name||'—'}</td><td>${t.stages?.name||'—'}</td><td>${t.mechanisms?.name||'—'}</td><td>${t.description?'✅':'❌'}</td>
    <td class="td-actions"><button class="btn btn-secondary btn-sm" onclick="openTechModal('${t.id}')">Edit</button><button class="btn btn-danger btn-sm" onclick="deleteRecord('techniques','${t.id}','${t.name.replace(/'/g,"\\'")}')">Del</button></td></tr>`).join('')}</table>`;
}

window.filterTech = () => {
    const q = document.getElementById('techSearch').value.toLowerCase();
    document.getElementById('techTable').innerHTML = techTable(D.techniques.filter(t => t.name.toLowerCase().includes(q) || t.clusters?.name?.toLowerCase().includes(q)));
};

window.openTechModal = (id) => {
    const t = id ? D.techniques.find(x=>x.id===id) : {};
    // BIDIRECTIONAL: show relationships where this technique is source OR target
    const techRels = id ? D.relationships.filter(r => r.technique_id === id || r.related_technique_id === id) : [];
    const isEdit = !!id;
    const otherTechs = isEdit ? D.techniques.filter(x => x.id !== id) : D.techniques;
    
    // Existing relationships (for edit mode) - BIDIRECTIONAL display
    const existingRelsHtml = techRels.length ? techRels.map(r => {
        // If current technique is the target, show the source as the related technique
        const isCurrentTarget = r.related_technique_id === id;
        const relatedName = isCurrentTarget ? (r.technique?.name || 'Unknown') : (r.related?.name || 'Unknown');
        const currentName = isCurrentTarget ? (r.related?.name || 'Unknown') : (r.technique?.name || 'Unknown');
        return `<div style="display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid var(--border)">
            <span class="badge badge-${r.relationship_type === 'alternative' ? 'warning' : r.relationship_type === 'complementary' ? 'success' : 'default'}">${r.relationship_type}</span>
            <span style="flex:1">${relatedName}</span>
            <button class="btn btn-danger btn-sm" onclick="deleteRel('${r.id}', '${(currentName).replace(/'/g,"\\'")} ↔ ${(relatedName).replace(/'/g,"\\'")}')">×</button>
        </div>`;
    }).join('') : '<p style="color:var(--text-muted);font-size:13px">No relationships yet</p>';
    
    // Pending relationships (for add mode - stored in array)
    const pendingRelsHtml = isEdit ? '' : `
        <div id="pendingRelsList" style="max-height:120px;overflow-y:auto;margin-bottom:12px;background:var(--bg);border-radius:var(--radius);padding:8px 12px">
            <p style="color:var(--text-muted);font-size:13px">No pending relationships</p>
        </div>`;
    
    const relSection = `
    <div style="margin-top:16px;padding-top:16px;border-top:2px solid var(--border)">
        <h4 style="font-size:14px;margin-bottom:8px">${isEdit?'Relationships':'Pending Relationships'}</h4>
        ${isEdit?`<div style="max-height:150px;overflow-y:auto;margin-bottom:12px;background:var(--bg);border-radius:var(--radius);padding:8px 12px">${existingRelsHtml}</div>`:pendingRelsHtml}
        <div style="display:flex;gap:8px;align-items:flex-end">
            <div style="flex:2"><label>Related Technique</label><select id="fRelTech"><option value="">Select...</option>${selOpts(otherTechs, null)}</select></div>
            <div style="flex:1"><label>Type</label><select id="fRelType"><option value="alternative">Alternative</option><option value="complementary">Complementary</option><option value="pipeline">Pipeline</option></select></div>
            <button class="btn btn-secondary" style="margin-bottom:12px" onclick="${isEdit?`addRel('${id}')`:'addPendingRel()'}">${isEdit?'+ Add':'+ Queue'}</button>
        </div>
    </div>`;
    
    document.getElementById('modalContent').innerHTML = `<h3>${isEdit?'Edit':'Add'} Technique</h3>
    <input type="hidden" id="fId" value="${id||''}">
    <label>Name</label><input type="text" id="fName" value="${(t.name||'').replace(/"/g,'&quot;')}">
    <div class="form-row">
        <div><label>Cluster</label><select id="fCluster"><option value="">Select...</option>${selOpts(D.clusters,t.cluster_id)}</select></div>
        <div><label>Stage</label><select id="fStage"><option value="">Select...</option>${selOpts(D.stages,t.stage_id)}</select></div>
    </div>
    <div class="form-row">
        <div><label>Problem</label><select id="fProblem"><option value="">Select...</option>${selOpts(D.problems,t.problem_id)}</select></div>
        <div><label>Mechanism</label><select id="fMechanism"><option value="">Select...</option>${selOpts(D.mechanisms,t.mechanism_id)}</select></div>
    </div>
    <label>Description</label><textarea id="fDesc">${t.description||''}</textarea>
    ${relSection}
    <div class="modal-actions"><button class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="saveTech()">${isEdit?'Update':'Create'}</button></div>`;
    
    // Initialize pending relationships array for add mode
    if (!isEdit) window.pendingRels = [];
    openModal();
};

window.deleteRel = async (relId, name) => {
    if (!confirm(`Delete relationship "${name}"?`)) return;
    const { error } = await supabase.from('technique_relationships').delete().eq('id', relId);
    if (error) toast(error.message, 'error');
    else { toast('Relationship deleted! (bidirectional)', 'success'); await loadAll(); openTechModal(document.getElementById('fId').value); }
};

window.deleteRelBidirectional = async (techId, relatedId, name) => {
    if (!confirm(`Delete relationship "${name}"?`)) return;
    // Delete both directions if they exist
    const { error } = await supabase.from('technique_relationships')
        .delete()
        .or(`and(technique_id.eq.${techId},related_technique_id.eq.${relatedId}),and(technique_id.eq.${relatedId},related_technique_id.eq.${techId})`);
    if (error) toast(error.message, 'error');
    else { toast('Relationship deleted!', 'success'); await loadAll(); openTechModal(document.getElementById('fId').value); }
};

window.addRel = async (techId) => {
    const relatedId = document.getElementById('fRelTech').value;
    const relType = document.getElementById('fRelType').value;
    if (!relatedId) { toast('Select a related technique', 'error'); return; }
    if (relatedId === techId) { toast('Cannot relate technique to itself', 'error'); return; }
    const { error } = await supabase.from('technique_relationships').insert({ technique_id: techId, related_technique_id: relatedId, relationship_type: relType });
    if (error) toast(error.message, 'error');
    else { toast('Relationship added!', 'success'); await loadAll(); openTechModal(techId); }
};

window.addPendingRel = () => {
    const relatedId = document.getElementById('fRelTech').value;
    const relType = document.getElementById('fRelType').value;
    if (!relatedId) { toast('Select a related technique', 'error'); return; }
    
    const tech = D.techniques.find(t => t.id === relatedId);
    if (!tech) return;
    
    // Check for duplicates
    if (window.pendingRels.some(r => r.related_technique_id === relatedId)) {
        toast('This relationship already queued', 'error'); return;
    }
    
    window.pendingRels.push({ related_technique_id: relatedId, relationship_type: relType, techName: tech.name });
    renderPendingRels();
    document.getElementById('fRelTech').value = '';
    toast('Relationship queued!', 'success');
};

window.renderPendingRels = () => {
    const list = document.getElementById('pendingRelsList');
    if (!list) return;
    if (!window.pendingRels.length) {
        list.innerHTML = '<p style="color:var(--text-muted);font-size:13px">No pending relationships</p>';
        return;
    }
    list.innerHTML = window.pendingRels.map((r, idx) => 
        `<div style="display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid var(--border)">
            <span class="badge badge-${r.relationship_type === 'alternative' ? 'warning' : r.relationship_type === 'complementary' ? 'success' : 'default'}">${r.relationship_type}</span>
            <span style="flex:1">${r.techName}</span>
            <button class="btn btn-danger btn-sm" onclick="removePendingRel(${idx})">×</button>
        </div>`
    ).join('');
};

window.removePendingRel = (idx) => {
    window.pendingRels.splice(idx, 1);
    renderPendingRels();
};

window.saveTech = async () => {
    const id = document.getElementById('fId').value;
    const p = { name:document.getElementById('fName').value, cluster_id:document.getElementById('fCluster').value, stage_id:document.getElementById('fStage').value, problem_id:document.getElementById('fProblem').value, mechanism_id:document.getElementById('fMechanism').value, description:document.getElementById('fDesc').value||null };
    if (!p.name||!p.cluster_id||!p.stage_id||!p.problem_id||!p.mechanism_id) { toast('All fields except description required','error'); return; }
    
    if (id) {
        // Update existing
        const {error} = await supabase.from('techniques').update(p).eq('id',id);
        if (error) toast(error.message,'error');
        else { toast('Technique updated!'); closeModal(); await loadAll(); render(); }
    } else {
        // Create new + relationships
        const { data, error } = await supabase.from('techniques').insert(p).select().single();
        if (error) { toast(error.message,'error'); return; }
        
        // Create pending relationships
        const pending = window.pendingRels || [];
        if (pending.length) {
            const rels = pending.map(r => ({
                technique_id: data.id,
                related_technique_id: r.related_technique_id,
                relationship_type: r.relationship_type
            }));
            const { error: relError } = await supabase.from('technique_relationships').insert(rels);
            if (relError) toast(`Technique created but relationships failed: ${relError.message}`, 'error');
            else toast(`Technique created with ${pending.length} relationship(s)!`, 'success');
        } else {
            toast('Technique created!');
        }
        closeModal(); await loadAll(); render();
    }
};

// ── Clusters ──
function renderClusters() {
    return `<h2>Clusters</h2><p class="subtitle">${D.clusters.length} clusters</p>
    <button class="btn btn-primary" onclick="openClusterModal()" style="margin-bottom:16px">+ Add Cluster</button>
    <div class="table-container"><table><tr><th>ID</th><th>Name</th><th>Color</th><th>Description</th><th>#</th><th>Actions</th></tr>
    ${D.clusters.map(c=>{const n=D.techniques.filter(t=>t.cluster_id===c.id).length;
    return`<tr><td><code>${c.id}</code></td><td><span style="display:inline-flex;align-items:center;gap:6px"><span style="width:12px;height:12px;border-radius:50%;background:${c.color};display:inline-block"></span>${c.name}</span></td><td><code>${c.color}</code></td><td style="max-width:300px;font-size:12px;color:var(--text-secondary)">${c.description||'—'}</td><td>${n}</td>
    <td class="td-actions"><button class="btn btn-secondary btn-sm" onclick="openClusterModal('${c.id}')">Edit</button><button class="btn btn-danger btn-sm" onclick="deleteRecord('clusters','${c.id}','${c.name.replace(/'/g,"\\'")}')">Del</button></td></tr>`}).join('')}
    </table></div>`;
}

window.openClusterModal = (id) => {
    const c = id ? D.clusters.find(x=>x.id===id) : {};
    document.getElementById('modalContent').innerHTML = `<h3>${id?'Edit':'Add'} Cluster</h3>
    <label>ID (e.g. QT, RC)</label><input type="text" id="fCId" value="${c.id||''}" ${id?'readonly':''}>
    <label>Name</label><input type="text" id="fCName" value="${(c.name||'').replace(/"/g,'&quot;')}">
    <label>Color (hex)</label><input type="color" id="fCColor" value="${c.color||'#3b82f6'}" style="height:40px;padding:4px">
    <label>Description</label><textarea id="fCDesc">${c.description||''}</textarea>
    <div class="modal-actions"><button class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="saveCluster()">${id?'Update':'Create'}</button></div>`;
    openModal();
};

window.saveCluster = async () => {
    const origId = D.clusters.find(x=>x.id===document.getElementById('fCId').value)?.id;
    const p = { id:document.getElementById('fCId').value, name:document.getElementById('fCName').value, color:document.getElementById('fCColor').value, description:document.getElementById('fCDesc').value||null };
    if (!p.id||!p.name) { toast('ID and Name required','error'); return; }
    const {error} = origId ? await supabase.from('clusters').update({name:p.name,color:p.color,description:p.description}).eq('id',p.id) : await supabase.from('clusters').insert(p);
    if (error) toast(error.message,'error'); else { toast('Cluster saved!'); closeModal(); await loadAll(); render(); }
};

// ── Stages ──
function renderStages() {
    return `<h2>Stages</h2><p class="subtitle">${D.stages.length} pipeline stages</p>
    <button class="btn btn-primary" onclick="openStageModal()" style="margin-bottom:16px">+ Add Stage</button>
    <div class="table-container"><table><tr><th>ID</th><th>Name</th><th>Order</th><th># Techniques</th><th>Actions</th></tr>
    ${D.stages.map(s=>{const n=D.techniques.filter(t=>t.stage_id===s.id).length;
    return`<tr><td><code>${s.id}</code></td><td>${s.name}</td><td>${s.display_order}</td><td>${n}</td>
    <td class="td-actions"><button class="btn btn-secondary btn-sm" onclick="openStageModal('${s.id}')">Edit</button><button class="btn btn-danger btn-sm" onclick="deleteRecord('stages','${s.id}','${s.name.replace(/'/g,"\\'")}')">Del</button></td></tr>`}).join('')}
    </table></div>`;
}

window.openStageModal = (id) => {
    const s = id ? D.stages.find(x=>x.id===id) : {};
    document.getElementById('modalContent').innerHTML = `<h3>${id?'Edit':'Add'} Stage</h3>
    <label>ID (e.g. pre-retrieval)</label><input type="text" id="fSId" value="${s.id||''}" ${id?'readonly':''}>
    <label>Name</label><input type="text" id="fSName" value="${(s.name||'').replace(/"/g,'&quot;')}">
    <label>Display Order</label><input type="number" id="fSOrder" value="${s.display_order||0}">
    <div class="modal-actions"><button class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="saveStage()">${id?'Update':'Create'}</button></div>`;
    openModal();
};

window.saveStage = async () => {
    const p = { id:document.getElementById('fSId').value, name:document.getElementById('fSName').value, display_order:parseInt(document.getElementById('fSOrder').value)||0 };
    if (!p.id||!p.name) { toast('ID and Name required','error'); return; }
    const origId = D.stages.find(x=>x.id===p.id)?.id;
    const {error} = origId ? await supabase.from('stages').update({name:p.name,display_order:p.display_order}).eq('id',p.id) : await supabase.from('stages').insert(p);
    if (error) toast(error.message,'error'); else { toast('Stage saved!'); closeModal(); await loadAll(); render(); }
};

// ── Problems ──
function renderProblems() {
    return `<h2>Problems</h2><p class="subtitle">${D.problems.length} problem types</p>
    <button class="btn btn-primary" onclick="openSimpleModal('problems','Problem')" style="margin-bottom:16px">+ Add Problem</button>
    <div class="table-container"><table><tr><th>ID</th><th>Name</th><th># Techniques</th><th>Actions</th></tr>
    ${D.problems.map(p=>{const n=D.techniques.filter(t=>t.problem_id===p.id).length;
    return`<tr><td><code>${p.id}</code></td><td>${p.name}</td><td>${n}</td>
    <td class="td-actions"><button class="btn btn-secondary btn-sm" onclick="openSimpleModal('problems','Problem','${p.id}')">Edit</button><button class="btn btn-danger btn-sm" onclick="deleteRecord('problems','${p.id}','${p.name.replace(/'/g,"\\'")}')">Del</button></td></tr>`}).join('')}
    </table></div>`;
}

// ── Mechanisms ──
function renderMechanisms() {
    return `<h2>Mechanisms</h2><p class="subtitle">${D.mechanisms.length} mechanism types</p>
    <button class="btn btn-primary" onclick="openSimpleModal('mechanisms','Mechanism')" style="margin-bottom:16px">+ Add Mechanism</button>
    <div class="table-container"><table><tr><th>ID</th><th>Name</th><th># Techniques</th><th>Actions</th></tr>
    ${D.mechanisms.map(m=>{const n=D.techniques.filter(t=>t.mechanism_id===m.id).length;
    return`<tr><td><code>${m.id}</code></td><td>${m.name}</td><td>${n}</td>
    <td class="td-actions"><button class="btn btn-secondary btn-sm" onclick="openSimpleModal('mechanisms','Mechanism','${m.id}')">Edit</button><button class="btn btn-danger btn-sm" onclick="deleteRecord('mechanisms','${m.id}','${m.name.replace(/'/g,"\\'")}')">Del</button></td></tr>`}).join('')}
    </table></div>`;
}

// ── Generic simple modal (problems/mechanisms) ──
window.openSimpleModal = (table, label, id) => {
    const items = D[table];
    const item = id ? items.find(x=>x.id===id) : {};
    document.getElementById('modalContent').innerHTML = `<h3>${id?'Edit':'Add'} ${label}</h3>
    <label>ID (slug, e.g. retrieval-quality)</label><input type="text" id="fSmId" value="${item.id||''}" ${id?'readonly':''}>
    <label>Name</label><input type="text" id="fSmName" value="${(item.name||'').replace(/"/g,'&quot;')}">
    <div class="modal-actions"><button class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="saveSimple('${table}','${label}')">${id?'Update':'Create'}</button></div>`;
    openModal();
};

window.saveSimple = async (table, label) => {
    const id = document.getElementById('fSmId').value;
    const name = document.getElementById('fSmName').value;
    if (!id||!name) { toast('ID and Name required','error'); return; }
    const items = D[table];
    const exists = items.find(x=>x.id===id);
    const {error} = exists ? await supabase.from(table).update({name}).eq('id',id) : await supabase.from(table).insert({id,name});
    if (error) toast(error.message,'error'); else { toast(`${label} saved!`); closeModal(); await loadAll(); render(); }
};

// ── Relationships ──
function renderRelationships() {
    return `<h2>Relationships</h2><p class="subtitle">${D.relationships.length} technique relationships</p>
    <button class="btn btn-primary" onclick="openRelModal()" style="margin-bottom:16px">+ Add Relationship</button>
    <div class="table-container"><table><tr><th>Technique</th><th>Related</th><th>Type</th><th>Actions</th></tr>
    ${D.relationships.map(r=>`<tr><td>${r.technique?.name||'—'}</td><td>${r.related?.name||'—'}</td><td><span class="badge badge-default">${r.relationship_type}</span></td>
    <td class="td-actions"><button class="btn btn-danger btn-sm" onclick="deleteRecord('technique_relationships','${r.id}','${r.technique?.name||''} → ${r.related?.name||''}')">Delete</button></td></tr>`).join('')}
    </table></div>`;
}

window.openRelModal = () => {
    const tOpts = selOpts(D.techniques,null);
    document.getElementById('modalContent').innerHTML = `<h3>Add Relationship</h3>
    <label>Technique</label><select id="fRTech"><option value="">Select...</option>${tOpts}</select>
    <label>Related Technique</label><select id="fRRel"><option value="">Select...</option>${tOpts}</select>
    <label>Type</label><select id="fRType"><option value="alternative">Alternative</option><option value="complementary">Complementary</option><option value="pipeline">Pipeline</option></select>
    <div class="modal-actions"><button class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="saveRel()">Create</button></div>`;
    openModal();
};

window.saveRel = async () => {
    const p = { technique_id:document.getElementById('fRTech').value, related_technique_id:document.getElementById('fRRel').value, relationship_type:document.getElementById('fRType').value };
    if (!p.technique_id||!p.related_technique_id) { toast('Select both techniques','error'); return; }
    if (p.technique_id===p.related_technique_id) { toast('Cannot relate technique to itself','error'); return; }
    const {error} = await supabase.from('technique_relationships').insert(p);
    if (error) toast(error.message,'error'); else { toast('Relationship created!'); closeModal(); await loadAll(); render(); }
};

// ── Illustrations ──
function renderIllustrations() {
    return `<h2>Illustrations</h2><p class="subtitle">${D.illustrations.length} technique illustrations</p>
    <button class="btn btn-primary" onclick="openIllModal()" style="margin-bottom:16px">+ Add Illustration</button>
    <div class="table-container"><table><tr><th>Technique</th><th>Image Path</th><th>Caption</th><th>Actions</th></tr>
    ${D.illustrations.map(i=>`<tr><td>${i.technique?.name||'—'}</td><td><code>${i.image_path}</code></td><td>${i.caption||'—'}</td>
    <td class="td-actions"><button class="btn btn-secondary btn-sm" onclick="openIllModal('${i.id}')">Edit</button><button class="btn btn-danger btn-sm" onclick="deleteRecord('technique_illustrations','${i.id}','${i.technique?.name||''}')">Del</button></td></tr>`).join('')}
    </table></div>`;
}

window.openIllModal = (id) => {
    const ill = id ? D.illustrations.find(x=>x.id===id) : {};
    document.getElementById('modalContent').innerHTML = `<h3>${id?'Edit':'Add'} Illustration</h3>
    <input type="hidden" id="fIId" value="${id||''}">
    <label>Technique</label><select id="fITech"><option value="">Select...</option>${selOpts(D.techniques,ill.technique_id)}</select>
    <label>Image Path</label><input type="text" id="fIPath" value="${(ill.image_path||'').replace(/"/g,'&quot;')}" placeholder="illustrations/Technique Name.png">
    <label>Caption</label><input type="text" id="fICap" value="${(ill.caption||'').replace(/"/g,'&quot;')}">
    <div class="modal-actions"><button class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="saveIll()">${id?'Update':'Create'}</button></div>`;
    openModal();
};

window.saveIll = async () => {
    const id = document.getElementById('fIId').value;
    const p = { technique_id:document.getElementById('fITech').value, image_path:document.getElementById('fIPath').value, caption:document.getElementById('fICap').value||null };
    if (!p.technique_id||!p.image_path) { toast('Technique and Image Path required','error'); return; }
    const {error} = id ? await supabase.from('technique_illustrations').update(p).eq('id',id) : await supabase.from('technique_illustrations').insert(p);
    if (error) toast(error.message,'error'); else { toast('Illustration saved!'); closeModal(); await loadAll(); render(); }
};

// ── Init ──
checkAuth();
