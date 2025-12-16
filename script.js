// Utilities
const qs = (s, r = document) => r.querySelector(s);
const qsa = (s, r = document) => [...r.querySelectorAll(s)];
const show = el => el.classList.remove('hidden');
const hide = el => el.classList.add('hidden');

let me = null;
let treatyListBound = false;

// Toasts
let toastTimer;
function toast(msg, type = 'success', ms = 2200){
  const t = qs('#toast');
  t.textContent = msg;
  t.className = `toast ${type}`;
  show(t);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => hide(t), ms);
}

// Tabs
qsa('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    qsa('.tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const id = btn.dataset.tab;
    qsa('.columns form').forEach(f => hide(f));
    show(qs(`#${id}`));
  });
});

// Form helpers
function validate(form){
  let ok = true;
  qsa('.field', form).forEach(f => {
    const input = f.querySelector('input, select, textarea');
    const err = f.querySelector('.error');
    if (!input) return;
    input.setCustomValidity('');
    if (input.hasAttribute('required') && !input.value.trim()){
      input.setCustomValidity('Required'); ok = false;
    }
    if (input.id === 'reg_password' && input.value.length && input.value.length < 6){
      input.setCustomValidity('Min 6 characters'); ok = false;
    }
    err.textContent = input.validationMessage;
  });
  return ok;
}
function collect(form){
  return Object.fromEntries(new FormData(form));
}

// Auth
qs('#login').addEventListener('submit', async e => {
  e.preventDefault();
  if (!validate(e.target)) return;
  const body = collect(e.target);
  const res = await fetch('/api/login', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(()=>({}));
  if (!res.ok){ toast(data.error || 'Login failed', 'error'); return; }
  me = data.user;
  toast(`Welcome, ${me.username}`, 'success');
  enterApp();
});

qs('#register').addEventListener('submit', async e => {
  e.preventDefault();
  if (!validate(e.target)) return;
  const body = collect(e.target);
  const res = await fetch('/api/register', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(()=>({}));
  if (!res.ok){ toast(data.error || 'Registration failed', 'error'); return; }
  toast('Account created. You can login now.');
  qsa('.tab')[0].click(); // switch to Login tab
});

// App navigation
qsa('.nav .btn').forEach(btn => {
  const view = btn.dataset.view;
  if (!view) return;
  btn.addEventListener('click', () => {
    qsa('#app-view .panel').forEach(p => hide(p));
    show(qs(`#${view}-view`));
    if (view === 'treaties') loadTreaties();
    if (view === 'admin') loadAdmin();
  });
});

qs('#logout-btn').addEventListener('click', async () => {
  await fetch('/api/logout', { method: 'POST' });
  me = null;
  hide(qs('#app-view'));
  show(qs('#auth-view'));
  toast('Logged out');
});

// Treaty UI
qs('#new-treaty-btn').addEventListener('click', () => {
  show(qs('#treaty-form'));
  qs('#t_name').focus();
});
qs('#cancel-treaty').addEventListener('click', () => hide(qs('#treaty-form')));

qs('#treaty-form').addEventListener('submit', async e => {
  e.preventDefault();
  if (!validate(e.target)) return;
  const body = collect(e.target);
  const res = await fetch('/api/treaties', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(()=>({}));
  if (!res.ok){ toast(data.error || 'Failed to create treaty', 'error'); return; }
  toast('Treaty created');
  hide(qs('#treaty-form'));
  e.target.reset();
  loadTreaties();
});

function mountTreatyActions(){
  if (treatyListBound) return;
  treatyListBound = true;
  qs('#treaty-list').addEventListener('click', async e => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    const action = btn.dataset.action;
    btn.disabled = true;
    const res = await fetch(`/api/agreements/${id}`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ decision: action })
    });
    const data = await res.json().catch(()=>({}));
    btn.disabled = false;
    if (!res.ok){ toast(data.error || 'Failed', 'error'); return; }
    toast(action === 'follow' ? 'Agreement recorded' : 'Declined');
    loadDashboard();
  });
}

async function loadTreaties(){
  const res = await fetch('/api/treaties');
  const data = await res.json().catch(()=>({ treaties: [] }));
  const wrap = qs('#treaty-list');
  wrap.innerHTML = '';
  if (!data.treaties.length){
    wrap.innerHTML = '<li class="item"><span class="muted">No treaties yet.</span></li>';
  } else {
    data.treaties.forEach(t => {
      const li = document.createElement('li');
      li.className = 'item fade-in';
      li.innerHTML = `
        <div class="item-head">
          <strong>${escapeHtml(t.name)}</strong>
          <span class="muted">by ${escapeHtml(t.createdBy)}</span>
        </div>
        <div class="tags">
          <span class="tag">${escapeHtml(t.category)}</span>
        </div>
        <div class="muted">Limitations: ${escapeHtml(t.limitations || '—')}</div>
        <div class="row">
          <button class="btn primary" data-action="follow" data-id="${t.id}">Follow</button>
          <button class="btn ghost" data-action="decline" data-id="${t.id}">Not follow</button>
        </div>
      `;
      wrap.appendChild(li);
    });
  }
  mountTreatyActions();
}

// Admin
qs('#role-form').addEventListener('submit', async e => {
  e.preventDefault();
  if (!validate(e.target)) return;
  const body = collect(e.target);
  const res = await fetch('/api/admin/role', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(()=>({}));
  if (!res.ok){ toast(data.error || 'Failed to assign role', 'error'); return; }
  toast('Role updated');
  qs('#role-feedback').textContent = 'Role updated.';
  loadAdmin();
});

async function loadAdmin(){
  const res = await fetch('/api/admin/users');
  const ul = qs('#user-list');
  if (!res.ok){
    ul.innerHTML = '<li class="item"><span class="muted">Admin only</span></li>';
    return;
  }
  const data = await res.json().catch(()=>({ users: [] }));
  ul.innerHTML = '';
  if (!data.users.length){
    ul.innerHTML = '<li class="item"><span class="muted">No users</span></li>';
    return;
  }
  data.users.forEach(u => {
    const li = document.createElement('li');
    li.className = 'item';
    li.innerHTML = `
      <div class="item-head">
        <strong>${escapeHtml(u.username)}</strong>
        <span class="tag">${escapeHtml(labelRole(u.role))}</span>
      </div>
      <div class="muted">${escapeHtml(u.title || 'No title')}</div>
    `;
    ul.appendChild(li);
  });
}

// Dashboard
async function loadDashboard(){
  const res = await fetch('/api/treaties?limit=5');
  const data = res.ok ? await res.json() : { treaties: [] };
  const list = qs('#recent-treaties');
  list.innerHTML = '';
  if (!data.treaties.length){
    list.innerHTML = '<li class="item"><span class="muted">No treaties yet.</span></li>';
  } else {
    data.treaties.forEach(t => {
      const li = document.createElement('li');
      li.className = 'item';
      li.innerHTML = `<div class="item-head"><strong>${escapeHtml(t.name)}</strong><span class="muted">${escapeHtml(t.category)}</span></div>`;
      list.appendChild(li);
    });
  }

  const res2 = await fetch('/api/agreements/mine');
  const data2 = res2.ok ? await res2.json() : { count: 0 };
  qs('#agreement-count').textContent = `Agreements: ${data2.count}`;
}

function labelRole(r){
  return ({
    great:'Great power',
    major:'Major power',
    minor:'Minor power',
    protectorate:'Protectorate government'
  }[r] || 'Unassigned');
}

function enterApp(){
  hide(qs('#auth-view'));
  show(qs('#app-view'));
  qs('#user-badge').textContent = `${me.username} — ${me.title || 'No title'}`;
  qs('#role-line').textContent = `Power tier: ${labelRole(me.role)}`;
  loadDashboard();
  // default to dashboard
  qsa('#app-view .panel').forEach(p => hide(p));
  show(qs('#dashboard-view'));
}

// XSS-safe text
function escapeHtml(str){
  return String(str)
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'",'&#39;');
}

// Initial session check
(async function bootstrap(){
  const res = await fetch('/api/me');
  if (res.ok){
    const data = await res.json();
    me = data.user;
    enterApp();
  } else {
    show(qs('#auth-view'));
  }
})();
