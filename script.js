(() => {
  'use strict';

  /* ------------------------------------------------------------------
     Connectly: front-end demo. Data lives in localStorage only.
     ------------------------------------------------------------------ */

  const KEYS = {
    users: 'connectly.users',
    session: 'connectly.session',
    posts: 'connectly.posts',
    friends: 'connectly.friends',
  };

  const MAX_LENGTH = 500;
  const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

  const $ = (selector) => document.querySelector(selector);

  /* ---------- Storage ---------- */

  const store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch {
        return false;
      }
    },
    remove(key) {
      try { localStorage.removeItem(key); } catch { /* ignore */ }
    },
  };

  /* ---------- Seed data ---------- */

  const PEOPLE = [
    { id: 'amara',   name: 'Amara Okoye',   hue: 152, friend: true },
    { id: 'tunde',   name: 'Tunde Bello',   hue: 32,  friend: true },
    { id: 'ngozi',   name: 'Ngozi Eze',     hue: 330, friend: true },
    { id: 'david',   name: 'David Mensah',  hue: 210, friend: false },
    { id: 'halima',  name: 'Halima Yusuf',  hue: 270, friend: false },
    { id: 'kelechi', name: 'Kelechi Nwosu', hue: 12,  friend: false },
  ];

  const personById = (id) => PEOPLE.find((p) => p.id === id);

  const SCENE = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450">' +
    '<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0" stop-color="#f4b63d"/><stop offset="1" stop-color="#e8795a"/>' +
    '</linearGradient></defs>' +
    '<rect width="800" height="450" fill="url(#g)"/>' +
    '<circle cx="560" cy="210" r="70" fill="#fff3d6"/>' +
    '<path d="M0 330 Q150 250 300 320 T600 300 T800 330 V450 H0Z" fill="#1f6f54"/>' +
    '<path d="M0 380 Q200 320 400 380 T800 370 V450 H0Z" fill="#16423a"/>' +
    '</svg>'
  );

  const uid = (prefix) => prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  function seedPosts() {
    const now = Date.now();
    const min = 60 * 1000;
    const author = (id) => {
      const p = personById(id);
      return { authorId: p.id, authorName: p.name, hue: p.hue };
    };
    const comment = (id, text, ago) => ({
      id: uid('c_'), ...author(id), text, createdAt: now - ago * min,
    });

    return [
      {
        id: uid('p_'), ...author('amara'),
        text: 'Finished my first 10k this morning. Legs are jelly but I am smiling. Who is up for a slow jog on Saturday?',
        image: null, createdAt: now - 12 * min,
        likes: ['tunde', 'ngozi'],
        comments: [comment('tunde', 'Count me in. I will bring the water.', 8)],
      },
      {
        id: uid('p_'), ...author('tunde'),
        text: 'Evening view from the balcony. Some days the sky just shows off.',
        image: SCENE, createdAt: now - 130 * min,
        likes: ['amara', 'ngozi', 'david'],
        comments: [],
      },
      {
        id: uid('p_'), ...author('ngozi'),
        text: 'Reminder: the community garden swap is this Sunday. Bring seedlings, cuttings or just good company.',
        image: null, createdAt: now - 5 * 60 * min,
        likes: ['amara'],
        comments: [],
      },
      {
        id: uid('p_'), ...author('david'),
        text: 'Anyone have a good book recommendation? Something short I can finish in a week.',
        image: null, createdAt: now - 26 * 60 * min,
        likes: [],
        comments: [comment('halima', 'Try Things Fall Apart. Short, sharp and unforgettable.', 25 * 60)],
      },
    ];
  }

  /* ---------- State ---------- */

  const state = {
    user: null,
    posts: [],
    friends: {},          // personId -> 'requested'
    filter: 'all',
    query: '',
    openComments: new Set(),
    draftImage: null,
    mode: 'login',
  };

  /* ---------- Helpers ---------- */

  // Builds DOM nodes without innerHTML so user text is never parsed as markup.
  function h(tag, props = {}, ...kids) {
    const el = document.createElement(tag);
    for (const [key, value] of Object.entries(props)) {
      if (value === false || value == null) continue;
      if (key === 'class') el.className = value;
      else if (key === 'text') el.textContent = value;
      else if (key === 'style') el.style.cssText = value;
      else if (key.startsWith('on')) el.addEventListener(key.slice(2), value);
      else el.setAttribute(key, value === true ? '' : value);
    }
    for (const kid of kids.flat()) {
      if (kid == null || kid === false) continue;
      el.append(kid);
    }
    return el;
  }

  function initials(name) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    const first = parts[0]?.[0] ?? '?';
    const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
    return (first + last).toUpperCase();
  }

  function avatar(name, hue, size) {
    const style = `--h:${Number(hue) || 0}` + (size ? `;--s:${size}px` : '');
    return h('span', { class: 'avatar', style, 'aria-hidden': 'true', text: initials(name) });
  }

  function timeAgo(ts) {
    const diff = Math.max(0, Date.now() - ts);
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} d ago`;
    return new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  }

  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

  const savePosts = () => store.set(KEYS.posts, state.posts);

  /* ---------- Auth ---------- */

  function setMode(mode) {
    state.mode = mode;
    const signup = mode === 'signup';
    $('#auth-title').textContent = signup ? 'Create your account' : 'Log in';
    $('#auth-submit').textContent = signup ? 'Sign up' : 'Log in';
    $('#switch-text').textContent = signup ? 'Already have an account?' : 'New to Connectly?';
    $('#switch-mode').textContent = signup ? 'Log in' : 'Create an account';
    $('#name-field').hidden = !signup;
    $('#password').setAttribute('autocomplete', signup ? 'new-password' : 'current-password');
    $('#auth-error').textContent = '';
  }

  function authError(message) {
    $('#auth-error').textContent = message;
  }

  function onAuthSubmit(event) {
    event.preventDefault();
    authError('');

    const name = $('#name').value.trim();
    const email = $('#email').value.trim().toLowerCase();
    const password = $('#password').value;

    if (state.mode === 'signup' && name.length < 2) return authError('Enter your full name.');
    if (!/^\S+@\S+\.\S+$/.test(email)) return authError('Enter a valid email address, like name@example.com.');
    if (password.length < 6) return authError('Use at least 6 characters for your password.');

    const users = store.get(KEYS.users, []);
    const existing = users.find((u) => u.email === email);

    if (state.mode === 'signup') {
      if (existing) return authError('An account with that email already exists. Log in instead.');
      const user = { id: uid('u_'), name, email, hue: Math.floor(Math.random() * 360) };
      users.push(user);
      store.set(KEYS.users, users);
      signIn(user);
    } else {
      if (!existing) return authError('No account found for that email. Create an account first.');
      signIn(existing);
    }
  }

  function signIn(user) {
    state.user = user;
    store.set(KEYS.session, user);
    $('#auth-form').reset();
    showApp();
  }

  function signOut() {
    state.user = null;
    state.filter = 'all';
    state.query = '';
    state.openComments.clear();
    clearDraft();
    $('#search').value = '';
    store.remove(KEYS.session);
    showAuth();
  }

  function showAuth() {
    $('#app-view').hidden = true;
    $('#auth-view').hidden = false;
    setMode('login');
    $('#email').focus();
  }

  function showApp() {
    $('#auth-view').hidden = true;
    $('#app-view').hidden = false;

    const { name, hue } = state.user;
    const swap = (selector, size) => {
      const target = $(selector);
      target.replaceWith(Object.assign(avatar(name, hue, size), { id: target.id }));
    };
    swap('#top-avatar', 36);
    swap('#side-avatar', 36);
    swap('#composer-avatar', 44);
    $('#side-name').textContent = name;

    setFilter('all');
    renderPeople();
  }

  /* ---------- Feed ---------- */

  function visiblePosts() {
    const q = state.query.trim().toLowerCase();
    return state.posts.filter((post) => {
      if (state.filter === 'mine' && post.authorId !== state.user.id) return false;
      if (state.filter === 'liked' && !post.likes.includes(state.user.id)) return false;
      if (q && !(post.text.toLowerCase().includes(q) || post.authorName.toLowerCase().includes(q))) return false;
      return true;
    });
  }

  function emptyMessage() {
    if (state.query.trim()) return `Nothing matches "${state.query.trim()}". Try a different word or clear the search.`;
    if (state.filter === 'mine') return 'You have not posted yet. Write something above to get started.';
    if (state.filter === 'liked') return 'No liked posts yet. Select Like on a post to find it here.';
    return 'No posts yet. Be the first to share an update.';
  }

  function renderFeed() {
    const feed = $('#feed');
    const posts = visiblePosts();
    feed.replaceChildren(...posts.map(postCard));
    const empty = $('#empty');
    empty.hidden = posts.length > 0;
    empty.textContent = posts.length ? '' : emptyMessage();
  }

  function postCard(post) {
    const mine = post.authorId === state.user.id;
    const liked = post.likes.includes(state.user.id);
    const open = state.openComments.has(post.id);

    return h('article', { class: 'post', 'data-id': post.id },
      h('header', { class: 'post__head' },
        avatar(post.authorName, post.hue),
        h('div', { class: 'post__who' },
          h('strong', { text: post.authorName }),
          h('time', { datetime: new Date(post.createdAt).toISOString(), text: timeAgo(post.createdAt) }),
        ),
        mine && h('button', {
          class: 'post__delete', type: 'button',
          'aria-label': 'Delete this post', text: 'Delete',
          onclick: () => deletePost(post.id),
        }),
      ),
      post.text && h('p', { class: 'post__text', text: post.text }),
      post.image && h('img', {
        class: 'post__img', src: post.image, loading: 'lazy',
        alt: `Photo shared by ${post.authorName}`,
      }),
      h('div', { class: 'post__stats' },
        post.likes.length > 0 && h('span', { text: plural(post.likes.length, 'like') }),
        post.comments.length > 0 && h('span', { text: plural(post.comments.length, 'comment') }),
      ),
      h('div', { class: 'post__actions' },
        h('button', {
          class: 'action', type: 'button', 'aria-pressed': String(liked),
          text: liked ? 'Liked' : 'Like',
          onclick: () => toggleLike(post.id),
        }),
        h('button', {
          class: 'action', type: 'button', 'aria-expanded': String(open),
          text: 'Comment',
          onclick: () => toggleComments(post.id),
        }),
      ),
      open && commentsSection(post),
    );
  }

  function commentsSection(post) {
    const input = h('input', {
      type: 'text', maxlength: '300', autocomplete: 'off',
      'aria-label': 'Write a comment', placeholder: 'Write a comment',
    });

    const form = h('form', {
      class: 'comment-form',
      onsubmit: (event) => {
        event.preventDefault();
        addComment(post.id, input.value);
      },
    }, input, h('button', { class: 'btn btn--primary', type: 'submit', text: 'Send' }));

    return h('div', { class: 'comments' },
      post.comments.length > 0 && h('ul', { class: 'comments__list' },
        post.comments.map((c) => h('li', { class: 'comment' },
          avatar(c.authorName, c.hue, 32),
          h('div', { class: 'comment__bubble' },
            h('strong', { text: c.authorName }),
            h('p', { text: c.text }),
            h('time', { datetime: new Date(c.createdAt).toISOString(), text: timeAgo(c.createdAt) }),
          ),
        )),
      ),
      form,
    );
  }

  function refreshPost(id, { focusComment = false } = {}) {
    const post = state.posts.find((p) => p.id === id);
    const current = document.querySelector(`.post[data-id="${CSS.escape(id)}"]`);
    if (!post || !current) return renderFeed();
    const next = postCard(post);
    current.replaceWith(next);
    if (focusComment) next.querySelector('.comment-form input')?.focus();
  }

  function toggleLike(id) {
    const post = state.posts.find((p) => p.id === id);
    if (!post) return;
    const me = state.user.id;
    post.likes = post.likes.includes(me) ? post.likes.filter((x) => x !== me) : [...post.likes, me];
    savePosts();
    // On the "liked" filter an unliked post should leave the list.
    if (state.filter === 'liked') renderFeed();
    else refreshPost(id);
  }

  function toggleComments(id) {
    if (state.openComments.has(id)) state.openComments.delete(id);
    else state.openComments.add(id);
    refreshPost(id, { focusComment: state.openComments.has(id) });
  }

  function addComment(id, text) {
    const post = state.posts.find((p) => p.id === id);
    const clean = text.trim();
    if (!post || !clean) return;
    post.comments.push({
      id: uid('c_'),
      authorId: state.user.id,
      authorName: state.user.name,
      hue: state.user.hue,
      text: clean.slice(0, 300),
      createdAt: Date.now(),
    });
    savePosts();
    refreshPost(id, { focusComment: true });
  }

  function deletePost(id) {
    if (!window.confirm('Delete this post? This cannot be undone.')) return;
    state.posts = state.posts.filter((p) => p.id !== id);
    state.openComments.delete(id);
    savePosts();
    renderFeed();
  }

  /* ---------- Composer ---------- */

  function composerError(message) {
    $('#composer-error').textContent = message;
  }

  function clearDraft() {
    state.draftImage = null;
    $('#post-text').value = '';
    $('#photo').value = '';
    $('#preview-wrap').hidden = true;
    $('#preview').removeAttribute('src');
    $('#remove-photo').hidden = true;
    $('#count').textContent = `0 / ${MAX_LENGTH}`;
    composerError('');
  }

  // Shrinks photos before saving so localStorage does not fill up.
  function resizeImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const maxSide = 900;
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/jpeg', 0.75));
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('unreadable'));
      };
      img.src = url;
    });
  }

  async function onPhotoChosen(event) {
    const file = event.target.files[0];
    composerError('');
    if (!file) return;
    if (!file.type.startsWith('image/')) return composerError('Choose an image file, like a JPG or PNG.');
    if (file.size > MAX_UPLOAD_BYTES) return composerError('That photo is over 8 MB. Choose a smaller one.');

    try {
      state.draftImage = await resizeImage(file);
      $('#preview').src = state.draftImage;
      $('#preview-wrap').hidden = false;
      $('#remove-photo').hidden = false;
    } catch {
      composerError('That photo could not be read. Try a different one.');
    }
  }

  function removePhoto() {
    state.draftImage = null;
    $('#photo').value = '';
    $('#preview-wrap').hidden = true;
    $('#preview').removeAttribute('src');
    $('#remove-photo').hidden = true;
  }

  function onPostSubmit(event) {
    event.preventDefault();
    const text = $('#post-text').value.trim();
    if (!text && !state.draftImage) return composerError('Write something or add a photo before posting.');

    const post = {
      id: uid('p_'),
      authorId: state.user.id,
      authorName: state.user.name,
      hue: state.user.hue,
      text: text.slice(0, MAX_LENGTH),
      image: state.draftImage,
      createdAt: Date.now(),
      likes: [],
      comments: [],
    };

    state.posts.unshift(post);
    if (!savePosts()) {
      state.posts.shift();
      return composerError('Your browser storage is full. Remove the photo or delete an older post, then try again.');
    }

    clearDraft();
    if (state.filter === 'liked') setFilter('all');
    else renderFeed();
  }

  /* ---------- Side nav, search and people ---------- */

  function setFilter(filter) {
    state.filter = filter;
    document.querySelectorAll('.side__link').forEach((button) => {
      const active = button.dataset.filter === filter;
      button.classList.toggle('is-active', active);
      if (active) button.setAttribute('aria-current', 'true');
      else button.removeAttribute('aria-current');
    });
    renderFeed();
  }

  function renderPeople() {
    const suggestions = PEOPLE.filter((p) => !p.friend);
    const friends = PEOPLE.filter((p) => p.friend);

    $('#suggestions').replaceChildren(...suggestions.map((p) => {
      const requested = state.friends[p.id] === 'requested';
      return h('li', { class: 'person' },
        avatar(p.name, p.hue, 38),
        h('span', { class: 'person__name', text: p.name }),
        h('button', {
          class: 'chip', type: 'button', 'aria-pressed': String(requested),
          'aria-label': `${requested ? 'Cancel request to' : 'Add'} ${p.name}`,
          text: requested ? 'Requested' : 'Add friend',
          onclick: () => {
            if (requested) delete state.friends[p.id];
            else state.friends[p.id] = 'requested';
            store.set(KEYS.friends, state.friends);
            renderPeople();
          },
        }),
      );
    }));

    $('#friends').replaceChildren(...friends.map((p) =>
      h('li', { class: 'person' },
        avatar(p.name, p.hue, 38),
        h('span', { class: 'person__name', text: p.name }),
      ),
    ));
  }

  /* ---------- Init ---------- */

  function init() {
    let posts = store.get(KEYS.posts, null);
    if (!Array.isArray(posts)) {
      posts = seedPosts();
      store.set(KEYS.posts, posts);
    }
    state.posts = posts;
    state.friends = store.get(KEYS.friends, {});

    $('#auth-form').addEventListener('submit', onAuthSubmit);
    $('#switch-mode').addEventListener('click', () => setMode(state.mode === 'login' ? 'signup' : 'login'));
    $('#guest').addEventListener('click', () => signIn({ id: 'u_guest', name: 'Guest Visitor', email: '', hue: 200 }));
    $('#logout').addEventListener('click', signOut);

    $('#composer').addEventListener('submit', onPostSubmit);
    $('#post-text').addEventListener('input', (event) => {
      $('#count').textContent = `${event.target.value.length} / ${MAX_LENGTH}`;
      if (event.target.value) composerError('');
    });
    $('#photo-btn').addEventListener('click', () => $('#photo').click());
    $('#photo').addEventListener('change', onPhotoChosen);
    $('#remove-photo').addEventListener('click', removePhoto);

    document.querySelectorAll('.side__link').forEach((button) => {
      button.addEventListener('click', () => setFilter(button.dataset.filter));
    });

    $('#search').addEventListener('input', (event) => {
      state.query = event.target.value;
      renderFeed();
    });

    const session = store.get(KEYS.session, null);
    if (session && session.id && session.name) {
      state.user = session;
      showApp();
    } else {
      showAuth();
    }
  }

  init();
})();
