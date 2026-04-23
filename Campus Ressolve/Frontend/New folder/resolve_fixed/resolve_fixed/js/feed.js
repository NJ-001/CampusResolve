// ============================================================
// CampusResolve — Feed Renderer (feed.js)
// Reads complaints from CR storage and renders them into
// #feedContainer, replacing hardcoded seed cards on first run.
// All filter/sort/tab interactions wire up here too.
// ============================================================

(function () {

  // ---- ARCHIVE CONFIG ----
  const ARCHIVE_DAYS = 30; // resolved complaints hidden from main feed after this many days

  function isArchived(c) {
    // A resolved complaint is "archived" (fully hidden) if resolved > ARCHIVE_DAYS ago
    if (c.status !== 'resolved') return false;
    const resolvedDate = new Date(c.updatedAt || c.createdAt);
    const daysSince = (Date.now() - resolvedDate.getTime()) / 86400000;
    return daysSince > ARCHIVE_DAYS;
  }

  function isActiveResolved(c) {
    // Resolved but not yet archived (within 30 days) — goes to Archive tab only
    if (c.status !== 'resolved') return false;
    return !isArchived(c);
  }

  // ---- STATE ----
  let currentSort   = 'hot';   // hot | new | top | archive
  let currentDept   = 'all';
  let currentStatus = 'all';
  let currentSearch = '';
  let currentCategory = 'all';
  let currentMine = false;

  // ---- HELPERS ----
  function timeAgo(isoStr) {
    const diff = (Date.now() - new Date(isoStr).getTime()) / 1000;
    if (diff < 60)           return 'just now';
    if (diff < 3600)         return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400)        return Math.floor(diff / 3600) + 'h ago';
    if (diff < 86400 * 7)   return Math.floor(diff / 86400) + 'd ago';
    return new Date(isoStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  }

  function statusLabel(s) {
    return { open: 'Open', under_review: 'Under Review', assigned: 'Assigned', resolved: 'Resolved' }[s] || s;
  }
  function statusClass(s) {
    return { open: 'status-open', under_review: 'status-review', assigned: 'status-assigned', resolved: 'status-resolved' }[s] || 'status-open';
  }

  function scoreFor(c) {
    return typeof c.score === 'number' ? c.score : ((c.upvotes || 0) - (c.downvotes || 0));
  }

  function hotScore(c) {
    const votes = scoreFor(c);
    const ageHours = (Date.now() - new Date(c.createdAt).getTime()) / 3600000;
    return votes / Math.pow(ageHours + 2, 1.5);
  }

  // ---- CARD BUILDER ----
  function buildCard(c) {
    const score = scoreFor(c);
    const commentCount = Array.isArray(c.comments)
      ? c.comments.filter(Boolean).length
      : Number(c.comments || 0);
    const attachmentActions = [];
    if (c.imageUrl) {
      attachmentActions.push(`
            <a class="action-btn" href="${c.imageUrl}" target="_blank" rel="noopener" onclick="event.stopPropagation()">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05 12.25 20.24a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.2a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
              Evidence
            </a>`);
    }
    if (c.resolutionImageUrl) {
      attachmentActions.push(`
            <a class="action-btn" href="${c.resolutionImageUrl}" target="_blank" rel="noopener" onclick="event.stopPropagation()">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
              Resolution Photo
            </a>`);
    }

    return `
      <div class="complaint-card" data-id="${c.id}" data-status="${c.status}" data-dept="${c.department}" data-category="${c.category}" data-created="${c.createdAt}" data-score="${score}">
        <div class="vote-rail voteBox">
          <button class="vote-btn upvote"   onclick="vote(this,  1)" title="Upvote">▲</button>
          <span   class="vote-count voteCount">${score}</span>
          <button class="vote-btn downvote" onclick="vote(this, -1)" title="Downvote">▼</button>
        </div>
        <div class="card-body">
          <div class="card-meta">
            <span class="tag tag-dept">${c.department}</span>
            <span class="tag tag-category">${c.category}</span>
            <span class="status-badge ${statusClass(c.status)}">${statusLabel(c.status)}</span>
            <span class="card-author">${c.authorName} • ${timeAgo(c.createdAt)}</span>
          </div>
          <div class="card-title">${escHtml(c.title)}</div>
          <div class="card-excerpt">${escHtml(c.description)}</div>
          <div class="card-actions">
            <button class="action-btn" onclick="openCommentSection('${c.id}', event)">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              ${commentCount} Comment${commentCount !== 1 ? 's' : ''}
            </button>
            <button class="action-btn" onclick="copyComplaintLink('${c.id}', this)">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
              Copy Link
            </button>
            ${attachmentActions.join('')}
          </div>
        </div>
      </div>`;
  }

  function escHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ---- FILTER & SORT ----
  function applyAll() {
    let complaints = CR.getComplaints();

    // --- ARCHIVE MODE: show only resolved complaints ---
    if (currentSort === 'archive') {
      complaints = complaints.filter(c => c.status === 'resolved' && !isArchived(c));
      complaints.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
      renderFeed(complaints);
      updateStats();
      updateTrending();
      updateActivity();
      return;
    }

    // --- MAIN FEED: keep resolved hidden unless the user explicitly asks for them ---
    if (currentStatus === 'resolved') {
      complaints = complaints.filter(c => c.status === 'resolved' && !isArchived(c));
    } else {
      complaints = complaints.filter(c => c.status !== 'resolved');
    }

    // Search
    if (currentSearch) {
      const q = currentSearch.toLowerCase();
      complaints = complaints.filter(c =>
        c.title.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.department.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q)
      );
    }

    if (currentMine) {
      const session = CR.getSession();
      const currentUserId = String(session?.id || '');
      complaints = complaints.filter(c => String(c.authorId || '') === currentUserId);
    }

    // Department filter
    if (currentDept !== 'all') {
      complaints = complaints.filter(c => {
        const d = c.department.toLowerCase();
        if (currentDept === 'computer')   return d.includes('computer');
        if (currentDept === 'it')         return d.includes('information') || d.includes(' it');
        if (currentDept === 'food')       return d.includes('food');
        if (currentDept === 'facilities') return d.includes('facilit');
        if (currentDept === 'admin')      return d.includes('admin');
        return true;
      });
    }

    // Status filter
    if (currentStatus !== 'all') {
      complaints = complaints.filter(c => c.status === currentStatus);
    }

    // Category dropdown
    if (currentCategory !== 'all') {
      complaints = complaints.filter(c => {
        const cat  = c.category.toLowerCase();
        const dept = c.department.toLowerCase();
        if (currentCategory === 'food')       return dept.includes('food') || cat.includes('food');
        if (currentCategory === 'facilities') return dept.includes('facilit') || cat.includes('facilit') || cat.includes('infrastructure');
        if (currentCategory === 'admin')      return dept.includes('admin');
        if (currentCategory === 'academic')   return cat.includes('academic');
        if (currentCategory === 'it')         return dept.includes('computer') || dept.includes('information') || cat.includes('it') || cat.includes('tech');
        return true;
      });
    }

    // Sort
    if (currentSort === 'new') {
      complaints.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else if (currentSort === 'top') {
      complaints.sort((a, b) => {
        const va = scoreFor(a);
        const vb = scoreFor(b);
        return vb - va;
      });
    } else { // hot (default)
      complaints.sort((a, b) => hotScore(b) - hotScore(a));
    }

    renderFeed(complaints);
    updateStats();
    updateTrending();
    updateActivity();
  }

  function renderFeed(complaints) {
    const container = document.getElementById('feedContainer');
    if (!container) return;

    if (complaints.length === 0) {
      container.innerHTML = `
        <div style="text-align:center;padding:60px 20px;color:var(--text-3);">
          <div style="font-size:36px;margin-bottom:12px;">🔍</div>
          <div style="font-family:'Syne',sans-serif;font-size:16px;font-weight:600;color:var(--text-2);margin-bottom:6px;">No complaints found</div>
          <div style="font-size:13px;">Try adjusting your filters or search query.</div>
        </div>`;
      return;
    }

    container.innerHTML = complaints.map(buildCard).join('');
    if (typeof window.attachDeleteButtons === 'function') window.attachDeleteButtons();
    if (typeof window.hydrateVotes === 'function') window.hydrateVotes();
  }

  // ---- LIVE STATS ----
  function updateStats() {
    const all = CR.getComplaints();
    const counts = { total: all.length, open: 0, under_review: 0, assigned: 0, resolved: 0 };
    all.forEach(c => { if (counts[c.status] !== undefined) counts[c.status]++; });

    const activeComplaints = all.filter(c => c.status !== 'resolved');
    const activeCount    = activeComplaints.length;
    const resolvedActive = all.filter(c => isActiveResolved(c)).length;

    // Platform stats (right sidebar)
    _setText('stat-total',    activeCount);
    _setText('stat-resolved', counts.resolved);
    _setText('stat-review',   counts.under_review);
    _setText('stat-open',     counts.open);

    // Archive tab badge
    _setText('archive-count', resolvedActive);

    // Sort By counts (left sidebar)
    _setText('count-hot',      activeCount);
    _setText('count-new',      activeCount);
    _setText('count-top',      activeCount);
    _setText('count-resolved', counts.resolved);

    // Status filter counts (left sidebar)
    _setText('count-status-open',     counts.open);
    _setText('count-status-review',   counts.under_review);
    _setText('count-status-assigned', counts.assigned);
    _setText('count-status-resolved', counts.resolved);

    // Department filter counts (active complaints only — no resolved)
    _setText('count-dept-all',        activeCount);
    _setText('count-dept-computer',   activeComplaints.filter(c => c.department.toLowerCase().includes('computer')).length);
    _setText('count-dept-it',         activeComplaints.filter(c => c.department.toLowerCase().includes('information') || c.department.toLowerCase().includes(' it') || c.department.toLowerCase().includes('infrastructure')).length);
    _setText('count-dept-food',       activeComplaints.filter(c => c.department.toLowerCase().includes('food')).length);
    _setText('count-dept-facilities', activeComplaints.filter(c => c.department.toLowerCase().includes('facilit')).length);
    _setText('count-dept-admin',      activeComplaints.filter(c => c.department.toLowerCase().includes('admin')).length);
  }

  function updateTrending() {
    const el = document.getElementById('trendingList');
    if (!el) return;
    const all = CR.getComplaints();
    const sorted = [...all].sort((a, b) => {
      const va = scoreFor(a);
      const vb = scoreFor(b);
      return vb - va;
    }).slice(0, 4);

    el.innerHTML = sorted.map((c, i) => {
      const score = scoreFor(c);
      return `
        <div class="trending-item">
          <div class="trend-num">${i + 1}</div>
          <div>
            <div class="trend-text">${escHtml(c.title.length > 42 ? c.title.slice(0, 42) + '…' : c.title)}</div>
            <div class="trend-dept">${c.department} • ${score} votes</div>
          </div>
        </div>`;
    }).join('');
  }

  function updateActivity() {
    const el = document.getElementById('activityList');
    if (!el) return;
    const all = CR.getComplaints();
    const recent = [...all]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5);

    const dotColor = { open: 'var(--primary)', under_review: 'var(--status-review)', assigned: 'var(--status-assigned)', resolved: 'var(--status-resolved)' };
    const actionLabel = { open: 'New complaint', under_review: 'Under review', assigned: 'Assigned', resolved: 'Resolved' };

    el.innerHTML = recent.map(c => `
      <div class="activity-item">
        <div class="activity-dot" style="background:${dotColor[c.status] || 'var(--primary)'}"></div>
        <div class="activity-text">${actionLabel[c.status] || 'Updated'}: ${escHtml(c.title.length > 35 ? c.title.slice(0, 35) + '…' : c.title)}</div>
        <div class="activity-time">${timeAgo(c.createdAt)}</div>
      </div>`).join('');
  }

  function _setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  // ---- PUBLIC API (called from inline handlers in index.html) ----
  window.feedSetSort = function (sort) {
    currentSort = sort;
    applyAll();
  };

  window.feedSetDept = function (dept) {
    currentDept = dept;
    applyAll();
  };

  window.feedSetStatus = function (status) {
    currentStatus = status || 'all';
    applyAll();
  };

  window.feedSetCategory = function (cat) {
    currentCategory = cat;
    applyAll();
  };

  window.feedSearch = function (q) {
    currentSearch = q;
    applyAll();
  };

  window.feedShowMine = function (mineOnly) {
    currentMine = !!mineOnly;
    applyAll();
  };

  // After a new complaint is submitted, re-render
  window.feedRefresh = async function () {
    await CR.refreshComplaints();
    applyAll();
  };

  // Copy link helper
  window.copyComplaintLink = function (id, btn) {
    const url = window.location.href.split('?')[0] + '?complaint=' + id;
    navigator.clipboard.writeText(url).then(() => {
      const orig = btn.innerHTML;
      btn.innerHTML = '✅ Copied!';
      setTimeout(() => { btn.innerHTML = orig; }, 1800);
    });
  };

  // ---- INIT ----
  (async function initFeed() {
    const result = await CR.refreshComplaints();
    const container = document.getElementById('feedContainer');
    if (!result.ok && container) {
      container.innerHTML = `
        <div style="text-align:center;padding:60px 20px;color:var(--text-3);">
          <div style="font-family:'Syne',sans-serif;font-size:16px;font-weight:600;color:var(--text-2);margin-bottom:6px;">Could not load complaints</div>
          <div style="font-size:13px;">Start the backend server and refresh this page.</div>
        </div>`;
      return;
    }
    applyAll();
  })();

})();

// ---- VOTE (global — called from onclick in rendered cards) ----
window.vote = function (button, direction) {
  const user = CR.getSession();
  if (!user) return;
  const voterId = user.id || user.email;

  const card       = button.closest('.complaint-card');
  const voteBox    = button.closest('.voteBox');
  const complaintId = card?.getAttribute('data-id');
  if (!voteBox || !complaintId) return;

  const VOTE_KEY = 'cr_complaint_votes';
  const store    = JSON.parse(localStorage.getItem(VOTE_KEY) || '{}');

  if (!store[complaintId]) store[complaintId] = { score: 0, voters: {} };
  const entry    = store[complaintId];
  const previous = entry.voters[voterId] || 0;

  if (previous === direction) {
    // toggle off
    entry.score -= direction;
    delete entry.voters[voterId];
  } else {
    entry.score += (direction - previous);
    entry.voters[voterId] = direction;
  }

  localStorage.setItem(VOTE_KEY, JSON.stringify(store));

  const currentVote = entry.voters[voterId] || 0;
  const countEl  = voteBox.querySelector('.voteCount');
  const upBtn    = voteBox.querySelector('.upvote');
  const downBtn  = voteBox.querySelector('.downvote');
  if (countEl)  countEl.textContent = String(entry.score);
  if (upBtn)    upBtn.classList.toggle('voted-up',   currentVote === 1);
  if (downBtn)  downBtn.classList.toggle('voted-down', currentVote === -1);
};
