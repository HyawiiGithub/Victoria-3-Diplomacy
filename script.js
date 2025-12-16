// UI helpers
const qs = (s, r = document) => r.querySelector(s);
const qsa = (s, r = document) => [...r.querySelectorAll(s)];
const show = el => el.classList.remove('hidden');
const hide = el => el.classList.add('hidden');

let me = null;

// Tabs
qsa('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    qsa('.tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    qsa('.tab-content').forEach(c => c.classList.add('hidden'));
    show(qs(`#${btn.dataset.tab}`));
  });
});

// Auth
qs('#login-form').addEventListener('submit', async e => {
  e.preventDefault();
  const body = Object.fromEntries(new FormData(e.target));
  const res = await fetch('/api/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) return alert(data.error || 'Login failed');
  me = data.user;
  enterApp();
});

qs('#register-form').addEventListener('submit', async e => {
  e.preventDefault();
  const body = Object.fromEntries(new FormData(e.target));
  const res = await fetch('/api/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) return alert(data.error || 'Registration failed');
  alert('Account created. You can login now.');
  qsa('.tab')[0].click();
});

// App navigation
qsa('.app-nav .nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const view = btn.dataset.view;
    qsa('.panel').forEach(p => hide(p));
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
});

// Treaty creation
qs('#new-treaty-btn').addEventListener('click', () => show(qs('#treaty-form-wrap')));
qs('#cancel-treaty').addEventListener('click', () => hide(qs('#treaty-form-wrap')));
qs('#treaty-form').addEventListener('submit', async e => {
  e.preventDefault();
  const body = Object.fromEntries(new FormData(e.target));
  const res = await fetch('/api/treaties', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) return alert(data.error || 'Failed to create treaty');
  hide(qs('#treaty-form-wrap'));
  e.target.reset();
  loadTreaties();
});

// Role assignment
qs('#role-form').addEventListener('submit', async e => {
  e.preventDefault();
  const body = Object.fromEntries(new FormData(e.target));
  const res = await fetch('/api/admin/role', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  qs('#role-feedback').textContent = res.ok ? 'Role updated.' : (data.error || 'Failed.');
  loadAdmin();
});

// Initial session check
(async function bootstrap(){
  const res = await fetch('/api/me');
  if (res.ok) {
    const data = await res.json();
    me = data.user;
    enterApp();
  }
})();

function enterApp() {
  hide(qs('#auth-view'));
  show(qs('#app-view'));
  qs('#user-badge').textContent = `${me.username} — ${me.title || 'No title'}`;
  qs('#role-line').textContent = `Power tier: ${labelRole(me.role)}`;
  loadDashboard();
  qsa('.app-nav .nav-btn')[0].click();
}

function labelRole(r) {
  return ({
    great: 'Great power',
    major: 'Major power',
    minor: 'Minor power',
    protectorate: 'Protectorate government'
  }[r] || 'Unassigned');
}

async function loadDashboard() {
  const res = await fetch('/api/treaties?limit=5');
  const data = res.ok ? await res.json() : { treaties: [] };
  const list = qs('#recent-treaties');
  list.innerHTML = '';
  data.treaties.forEach(t => {
    const li = document.createElement('li');
    li.textContent = `${t.name} (${t.category})`;
    list.appendChild(li);
  });

  const res2 = await fetch('/api/agreements/mine');
  const data2 = res2.ok ? await res2.json() : { count: 0 };
  qs('#agreement-count').textContent = `Agreements: ${data2.count}`;
}

async function loadTreaties() {
  const res = await fetch('/api/treaties');
  const data = await res.json();
  const wrap = qs('#treaty-list');
  wrap.innerHTML = '';
  data.treaties.forEach(t => {
    const item = document.createElement('div');
    item.className = 'treaty-item fade-in';
    item.innerHTML = `
      <div class="treaty-head">
        <div>
          <h3>${t.name}</h3>
          <div class="tags">
            <span class="tag">${t.category}</span>
          </div>
        </div>
        <div class="hint">Created by ${t.createdBy}</div>
      </div>
      <div class="hint">Limitations: ${t.limitations || '—'}</div>
      <div class="actions">
        <button class="cta glow" data-action="follow" data-id="${t.id}">Follow</button>
        <button class="cta" data-action="decline" data-id="${t.id}">Not follow</button>
      </div>
    `;
    wrap.appendChild(item);
  });

  wrap.addEventListener('click', async e => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    const action = btn.dataset.action;
    const res = await fetch(`/api/agreements/${id}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision: action })
    });
    const data = await res.json();
    if (!res.ok) return alert(data.error || 'Failed');
    loadDashboard();
  });
}

async function loadAdmin() {
  const res = await fetch('/api/admin/users');
  if (!res.ok) {
    qs('#user-list').innerHTML = '<li class="hint">Admin only</li>';
    return;
  }
  const data = await res.json();
  const ul = qs('#user-list');
  ul.innerHTML = '';
  data.users.forEach(u => {
    const li = document.createElement('li');
    li.className = 'treaty-item';
    li.innerHTML = `
      <div class="treaty-head">
        <strong>${u.username}</strong>
        <span class="tag">${labelRole(u.role)}</span>
      </div>
      <div class="hint">${u.title || 'No title'}</div>
    `;
    ul.appendChild(li);
  });
}
