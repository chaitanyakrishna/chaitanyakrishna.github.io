 (function () {
  const POSTS_INDEX_URL = 'blog/posts/posts.json';

  const EMBEDDED_POSTS_JSON_ID = 'posts-json';
  const EMBEDDED_POST_PREFIX = 'post-';

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatDate(iso) {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return iso;
      return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
      return iso;
    }
  }

  function getYear(value) {
    if (!value) return 'Other';
    const s = String(value).trim();
    const m = s.match(/^(\d{4})/);
    if (m) return m[1];

    try {
      const d = new Date(s);
      if (!Number.isNaN(d.getTime())) return String(d.getFullYear());
    } catch {
      // ignore
    }

    return 'Other';
  }

  async function fetchJson(url) {
    const resp = await fetch(url, { cache: 'no-store' });
    if (!resp.ok) throw new Error(`Failed to load ${url}`);
    return resp.json();
  }

  async function fetchText(url) {
    const resp = await fetch(url, { cache: 'no-store' });
    if (!resp.ok) throw new Error(`Failed to load ${url}`);
    return resp.text();
  }

  function readEmbeddedJson(id) {
    const el = document.getElementById(id);
    if (!el) return null;
    const raw = (el.textContent || '').trim();
    if (!raw) return null;

    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function readEmbeddedMarkdown(slug) {
    const el = document.getElementById(`${EMBEDDED_POST_PREFIX}${slug}`);
    if (!el) return null;
    const md = el.textContent || '';
    return md.trim() ? md : null;
  }

  function getSelectedSlug(posts) {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('post');
    if (slug && posts.some(p => p.slug === slug)) return slug;
    return posts[0]?.slug;
  }

  function renderPostList(posts, activeSlug) {
    const list = $('post-list');

    const byYear = new Map();
    for (const post of posts) {
      const year = getYear(post.published);
      if (!byYear.has(year)) byYear.set(year, []);
      byYear.get(year).push(post);
    }

    const years = Array.from(byYear.keys()).sort((a, b) => {
      const na = Number(a);
      const nb = Number(b);
      if (Number.isNaN(na) && Number.isNaN(nb)) return b.localeCompare(a);
      if (Number.isNaN(na)) return 1;
      if (Number.isNaN(nb)) return -1;
      return nb - na;
    });

    const html = [];
    for (const year of years) {
      html.push(`<div class="archive-year">${escapeHtml(year)}</div>`);
      const postsInYear = byYear.get(year) || [];
      for (const p of postsInYear) {
        const active = p.slug === activeSlug;
        html.push(`
          <a class="post-link ${active ? 'active' : ''}" href="blog.html?post=${encodeURIComponent(p.slug)}">
            <div class="post-link-title">${escapeHtml(p.title || p.slug)}</div>
            <div class="post-link-meta">${escapeHtml(formatDate(p.published))}</div>
          </a>
        `);
      }
    }

    list.innerHTML = html.join('');
  }

  function extractTitleFromMarkdown(md, fallback) {
    const match = md.match(/^#\s+(.+)\s*$/m);
    return match ? match[1].trim() : fallback;
  }

  function stripFirstH1(md) {
    return String(md).replace(/^#\s+.+\n+/m, '');
  }

  function stripHeaderMetaBlock(md) {
    // Removes the common header block:
    // **Published:** ...
    // **Author:** ...
    // **Tags:** ...
    // ---
    return String(md).replace(
      /^\s*(\*\*Published:\*\*.*\n)?(\*\*Author:\*\*.*\n)?(\*\*Tags:\*\*.*\n)?\s*---\s*\n+/m,
      ''
    );
  }

  function extractMeta(md) {
    const published = (md.match(/^\*\*Published:\*\*\s*(.+)\s*$/m) || [])[1];
    const author = (md.match(/^\*\*Author:\*\*\s*(.+)\s*$/m) || [])[1];
    const tags = (md.match(/^\*\*Tags:\*\*\s*(.+)\s*$/m) || [])[1];
    return { published, author, tags };
  }

  function setContentHtml(html) {
    const safe = window.DOMPurify
      ? window.DOMPurify.sanitize(html, { ADD_ATTR: ['class'], ADD_TAGS: ['span'] })
      : html;
    $('post-content').innerHTML = safe;

    if (window.hljs && typeof window.hljs.highlightElement === 'function') {
      const blocks = $('post-content')?.querySelectorAll('pre code') || [];
      blocks.forEach(block => {
        if (!block.classList.contains('hljs')) block.classList.add('hljs');
        window.hljs.highlightElement(block);
      });
    }

    enhanceCodeBlocks();
  }

  function copyTextToClipboard(text) {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      return navigator.clipboard.writeText(text);
    }

    return new Promise((resolve, reject) => {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.top = '-1000px';
        ta.style.left = '-1000px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        resolve();
      } catch (e) {
        reject(e);
      }
    });
  }

  function enhanceCodeBlocks() {
    const root = $('post-content');
    if (!root) return;

    const pres = root.querySelectorAll('pre');
    for (const pre of pres) {
      if (pre.querySelector('.code-copy')) continue;
      const codeEl = pre.querySelector('code');
      if (!codeEl) continue;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'code-copy';
      btn.setAttribute('aria-label', 'Copy code');
      btn.innerHTML = '<i class="mdi mdi-content-copy"></i>';

      btn.addEventListener('click', async () => {
        const codeText = codeEl.innerText || codeEl.textContent || '';
        try {
          await copyTextToClipboard(codeText);
          btn.innerHTML = '<i class="mdi mdi-check"></i>';
          setTimeout(() => {
            btn.innerHTML = '<i class="mdi mdi-content-copy"></i>';
          }, 1200);
        } catch {
          btn.innerHTML = '<i class="mdi mdi-alert-circle-outline"></i>';
          setTimeout(() => {
            btn.innerHTML = '<i class="mdi mdi-content-copy"></i>';
          }, 1500);
        }
      });

      pre.appendChild(btn);
    }
  }

  function setShareLinks({ slug, title }) {
    const bar = $('share-bar');
    if (!bar) return;

    const protocol = window.location?.protocol;
    const baseMeta = document.querySelector('meta[name="site-base"]')?.getAttribute('content')?.trim();

    let url;
    if (protocol === 'file:' && baseMeta) {
      const base = baseMeta.endsWith('/') ? baseMeta : `${baseMeta}/`;
      url = new URL('blog.html', base);
    } else {
      url = new URL(window.location.href);
      url.hash = '';
    }

    if (slug) url.searchParams.set('post', slug);

    const shareUrl = encodeURIComponent(url.toString());
    const shareText = encodeURIComponent(title || 'Blog post');

    const aLinkedIn = $('share-linkedin');
    const aTwitter = $('share-twitter');
    const aFacebook = $('share-facebook');

    if (aLinkedIn) aLinkedIn.href = `https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}`;
    if (aTwitter) aTwitter.href = `https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}`;
    if (aFacebook) aFacebook.href = `https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`;
  }

  async function load() {
    $('post-content').innerHTML = '<p class="text-muted">Loading…</p>';

    let posts = [];
    try {
      posts = readEmbeddedJson(EMBEDDED_POSTS_JSON_ID) || (await fetchJson(POSTS_INDEX_URL));
    } catch {
      posts = [
        {
          slug: 'importance-of-osint',
          title: 'The Importance of OSINT in Modern Cybersecurity',
          published: '2026-01-17',
          file: 'blog/posts/importance-of-osint.md'
        }
      ];
    }

    const activeSlug = getSelectedSlug(posts);
    renderPostList(posts, activeSlug);

    const active = posts.find(p => p.slug === activeSlug);
    if (!active) {
      $('post-content').innerHTML = '<p class="text-muted">No post selected.</p>';
      return;
    }

    try {
      const md = readEmbeddedMarkdown(active.slug) || (await fetchText(active.file));
      const title = extractTitleFromMarkdown(md, active.title || active.slug);
      const meta = extractMeta(md);
      const body = stripHeaderMetaBlock(stripFirstH1(md));

      $('post-title').textContent = title;

      const metaParts = [];
      if (meta.published) metaParts.push(`Published: ${meta.published}`);
      if (meta.author) metaParts.push(`Author: ${meta.author}`);
      if (meta.tags) metaParts.push(`Tags: ${meta.tags}`);
      $('post-meta').textContent = metaParts.join(' • ');

      document.title = `${title} | Blog`;

      setShareLinks({ slug: active.slug, title });

      let html;
      if (window.marked) {
        // Support both Marked v4+ (parse method) and older versions (function)
        const parse = typeof window.marked.parse === 'function' ? window.marked.parse : window.marked;
        
        // Parse markdown. Highlighting is applied in setContentHtml() via hljs.highlightElement() 
        // after content is inserted into the DOM.
        html = parse(body);

        if (html instanceof Promise) {
          html = await html;
        }
        setContentHtml(html);
      } else {
        $('post-content').textContent = body;
      }
    } catch (e) {
      $('post-content').innerHTML = `<p class="text-muted">Failed to load post.</p><pre class="small">${escapeHtml(String(e))}</pre>`;
    }
  }

  document.addEventListener('DOMContentLoaded', load);
})();
