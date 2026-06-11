import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://ixmxjwhzqtqbklkxpezh.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4bXhqd2h6cXRxYmtsa3hwZXpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExNzcyOTYsImV4cCI6MjA5Njc1MzI5Nn0.WY_5Gym8jj5FBPkBKuE1yUmLMdIQ8IWSfl_IhCuzFsE";
const ADMIN_EMAIL = "jmoncadamo@unal.edu.co";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const app = document.getElementById("app");

const COLORS = [
  { id: "red", label: "Rojo", hex: "#fb7185" },
  { id: "orange", label: "Naranja", hex: "#fb923c" },
  { id: "yellow", label: "Amarillo", hex: "#facc15" },
  { id: "green", label: "Verde", hex: "#4ade80" },
  { id: "mint", label: "Menta", hex: "#34d399" },
  { id: "cyan", label: "Cian", hex: "#22d3ee" },
  { id: "blue", label: "Azul", hex: "#60a5fa" },
  { id: "indigo", label: "Indigo", hex: "#818cf8" },
  { id: "purple", label: "Morado", hex: "#a78bfa" },
  { id: "pink", label: "Rosa", hex: "#f472b6" },
  { id: "gray", label: "Gris", hex: "#94a3b8" },
  { id: "black", label: "Negro", hex: "#475569" },
];

const LINK_TYPES = ["Drive", "Docs", "Sheets", "Slides", "Draw.io", "PDF", "GitHub", "Otro"];

const state = {
  route: "login",
  routeId: null,
  user: null,
  me: null,
  members: [],
  aliases: [],
  workspaces: [],
  workspace: null,
  links: [],
  notes: [],
  messages: [],
  activity: [],
  authMode: "login",
  loading: true,
  error: "",
  modal: null,
  realtimeStatus: "offline",
  globalChannel: null,
  workspaceChannel: null,
  workspaceChannelId: null,
};

const escapeHtml = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const formatDate = (value) => {
  if (!value) return "Sin fecha";
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
};

const getColor = (id) => COLORS.find((color) => color.id === id) || COLORS[10];
const isAdmin = () => state.user?.email?.toLowerCase() === ADMIN_EMAIL;
const hasProfile = (member) => Boolean(member?.display_name?.trim() && member?.color);

function displayName(email) {
  const normalized = email?.toLowerCase();
  const alias = state.aliases.find((item) => item.target_email === normalized);
  if (alias?.alias) return alias.alias;
  const member = state.members.find((item) => item.email === normalized);
  return member?.display_name || normalized || "Usuario";
}

function memberByEmail(email) {
  return state.members.find((item) => item.email === email?.toLowerCase());
}

function avatarHtml(email, size = "mini") {
  const member = memberByEmail(email);
  const color = getColor(member?.color);
  const name = displayName(email);
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  return `<span class="${size === "large" ? "avatar" : "mini-avatar"}" style="background:${color.hex}" title="${escapeHtml(name)}">${escapeHtml(initial)}</span>`;
}

function notifyError(message) {
  state.error = message || "Ocurrio un error.";
  render();
}

function clearError() {
  state.error = "";
}

function routeTo(route, id = null) {
  const next = id ? `#/${route}/${id}` : `#/${route}`;
  if (window.location.hash === next) {
    applyRoute();
    return;
  }
  window.location.hash = next;
}

function parseRoute() {
  const hash = window.location.hash.replace(/^#\/?/, "");
  const [route = "home", id = null] = hash.split("/");
  state.route = route || "home";
  state.routeId = id;
}

async function applyRoute() {
  parseRoute();
  clearError();
  await refreshSession();
  await renderRouteData();
  syncRealtimeSubscriptions();
  render();
}

async function refreshSession() {
  const { data } = await supabase.auth.getUser();
  state.user = data.user;

  if (!state.user) {
    state.me = null;
    state.members = [];
    state.aliases = [];
    return;
  }

  const email = state.user.email.toLowerCase();
  const { data: members, error: membersError } = await supabase
    .from("hub_members")
    .select("*")
    .is("removed_at", null)
    .order("display_name", { ascending: true, nullsFirst: true });

  if (membersError) {
    state.members = [];
    state.me = null;
    return;
  }

  state.members = members || [];
  state.me = state.members.find((member) => member.email === email) || null;

  if (state.me) {
    const { data: aliases } = await supabase
      .from("member_aliases")
      .select("*")
      .order("updated_at", { ascending: false });
    state.aliases = aliases || [];
  } else {
    state.aliases = [];
  }
}

function guardRoute() {
  if (!state.user) return "login";
  if (!state.me) return "denied";
  if (!hasProfile(state.me)) return "profile";
  if (state.route === "members" && !isAdmin()) return "home";
  if (["login", "denied"].includes(state.route)) return "home";
  return state.route;
}

async function renderRouteData() {
  state.loading = true;
  const guarded = guardRoute();
  state.route = guarded;

  if (!state.user || !state.me || !hasProfile(state.me)) {
    state.loading = false;
    return;
  }

  await loadWorkspaces();

  if (state.route === "workspace" && state.routeId) {
    await loadWorkspace(state.routeId);
  }

  if (state.route === "history") {
    await loadActivity(state.routeId || null);
  }

  state.loading = false;
}

async function loadWorkspaces() {
  const { data, error } = await supabase
    .from("workspaces")
    .select("*")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  state.workspaces = data || [];
}

async function loadWorkspace(id) {
  const { data: workspace, error: workspaceError } = await supabase
    .from("workspaces")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (workspaceError) throw workspaceError;
  state.workspace = workspace;

  if (!workspace) {
    state.links = [];
    state.notes = [];
    state.messages = [];
    return;
  }

  const [linksResult, notesResult, messagesResult] = await Promise.all([
    supabase
      .from("workspace_links")
      .select("*")
      .eq("workspace_id", id)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false }),
    supabase
      .from("workspace_notes")
      .select("*")
      .eq("workspace_id", id)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false }),
    supabase
      .from("workspace_messages")
      .select("*")
      .eq("workspace_id", id)
      .order("created_at", { ascending: true }),
  ]);

  if (linksResult.error) throw linksResult.error;
  if (notesResult.error) throw notesResult.error;
  if (messagesResult.error) throw messagesResult.error;

  state.links = linksResult.data || [];
  state.notes = notesResult.data || [];
  state.messages = messagesResult.data || [];
}

async function loadLinks(workspaceId = state.workspace?.id) {
  if (!workspaceId) return;
  const { data, error } = await supabase
    .from("workspace_links")
    .select("*")
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  state.links = data || [];
}

async function loadNotes(workspaceId = state.workspace?.id) {
  if (!workspaceId) return;
  const { data, error } = await supabase
    .from("workspace_notes")
    .select("*")
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  state.notes = data || [];
}

async function loadMessages(workspaceId = state.workspace?.id) {
  if (!workspaceId) return;
  const { data, error } = await supabase
    .from("workspace_messages")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  state.messages = data || [];
}

async function loadActivity(workspaceId = null) {
  let query = supabase
    .from("activity_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(120);

  if (workspaceId) query = query.eq("workspace_id", workspaceId);

  const { data, error } = await query;
  if (error) throw error;
  state.activity = data || [];
}

async function refreshMembersAndAliases() {
  await refreshSession();
  if (state.route === "profile" || state.route === "home" || state.route === "members" || state.route === "workspace") {
    render();
  }
}

async function refreshWorkspaces(payload = null) {
  if (!state.user || !state.me || !hasProfile(state.me)) return;
  await loadWorkspaces();

  if (state.route === "workspace" && state.routeId) {
    if (payload?.new?.id === state.routeId || payload?.old?.id === state.routeId) {
      await refreshWorkspaceHeader(state.routeId);
      return;
    }

    const stillExists = state.workspaces.some((workspace) => workspace.id === state.routeId);
    if (!stillExists) {
      routeTo("home");
      return;
    }
  }

  render();
}

async function refreshWorkspaceHeader(workspaceId = state.workspace?.id) {
  if (!workspaceId) return;
  const { data, error } = await supabase
    .from("workspaces")
    .select("*")
    .eq("id", workspaceId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw error;
  state.workspace = data;

  if (!data) {
    routeTo("home");
    return;
  }

  render();
}

async function refreshCurrentWorkspacePart(part) {
  if (state.route !== "workspace" || !state.workspace?.id) return;

  const list = document.getElementById("messageList");
  const shouldStickToBottom = list
    ? list.scrollHeight - list.scrollTop - list.clientHeight < 80
    : true;

  if (part === "links") await loadLinks();
  if (part === "notes") await loadNotes();
  if (part === "messages") await loadMessages();
  if (part === "header") await refreshWorkspaceHeader();

  render();

  if (part === "messages" && shouldStickToBottom) {
    requestAnimationFrame(() => {
      const nextList = document.getElementById("messageList");
      if (nextList) nextList.scrollTop = nextList.scrollHeight;
    });
  }
}

async function refreshCurrentHistory() {
  if (state.route !== "history") return;
  await loadActivity(state.routeId || null);
  render();
}

function render() {
  const guarded = guardRoute();
  state.route = guarded;

  if (!state.user) {
    app.innerHTML = renderAuth();
  } else if (!state.me) {
    app.innerHTML = renderAccessDenied();
  } else {
    app.innerHTML = renderShell();
  }

  bindEvents();
}

function renderAuth() {
  return `
    <main class="auth-page">
      <section class="auth-panel">
        <div class="auth-copy">
          <div class="brand-mark">H</div>
          <h1>Hub del Proyecto</h1>
          <p>Un punto unico para entrar al trabajo del equipo: workspaces por actividad, enlaces importantes, notas y chat en tiempo real.</p>
        </div>
        <div class="auth-form">
          <div class="tabs">
            <button class="tab ${state.authMode === "login" ? "active" : ""}" data-auth-mode="login">Entrar</button>
            <button class="tab ${state.authMode === "signup" ? "active" : ""}" data-auth-mode="signup">Crear cuenta</button>
          </div>
          ${state.error ? `<div class="error">${escapeHtml(state.error)}</div>` : ""}
          <form id="authForm" class="stack">
            <div class="field">
              <label for="authEmail">Correo</label>
              <input id="authEmail" name="email" class="input" type="email" autocomplete="email" placeholder="correo@unal.edu.co" required />
            </div>
            <div class="field">
              <label for="authPassword">Contrasena</label>
              <input id="authPassword" name="password" class="input" type="password" autocomplete="${state.authMode === "login" ? "current-password" : "new-password"}" minlength="6" required />
            </div>
            <button class="btn primary" type="submit">${state.authMode === "login" ? "Entrar al hub" : "Crear cuenta"}</button>
            <p class="tiny">Solo los correos agregados a la lista de miembros pueden usar el hub.</p>
          </form>
        </div>
      </section>
    </main>
  `;
}

function renderAccessDenied() {
  return `
    <main class="auth-page">
      <section class="panel" style="max-width: 560px;">
        <div class="panel-header">
          <h2>Acceso pendiente</h2>
        </div>
        <div class="panel-body stack">
          <p class="muted">Tu cuenta inicio sesion, pero tu correo todavia no esta en la lista de miembros del hub.</p>
          <p class="tiny">${escapeHtml(state.user.email)}</p>
          <button class="btn" data-action="logout">Cerrar sesion</button>
        </div>
      </section>
    </main>
  `;
}

function renderShell() {
  return `
    <div class="app-shell">
      ${renderTopbar()}
      ${state.error ? `<div class="page"><div class="error">${escapeHtml(state.error)}</div></div>` : ""}
      ${renderCurrentPage()}
      ${state.modal ? renderModal() : ""}
    </div>
  `;
}

function renderTopbar() {
  return `
    <header class="topbar">
      <div class="brand">
        <button class="brand-mark" data-route="home" title="Inicio">H</button>
        <div>
          <h1>Hub del Proyecto</h1>
          <p>${state.route === "workspace" && state.workspace ? escapeHtml(state.workspace.name) : "Centro de trabajo del equipo"}</p>
        </div>
      </div>
      <nav class="top-actions">
        <button class="btn ghost small" data-route="home">Home</button>
        <button class="btn ghost small" data-route="history">Historial</button>
        ${isAdmin() ? `<button class="btn ghost small" data-route="members">Miembros</button>` : ""}
        <span id="liveStatus" class="live-status ${state.realtimeStatus}">${state.realtimeStatus === "online" ? "En vivo" : state.realtimeStatus === "connecting" ? "Conectando" : "Sin vivo"}</span>
        <button class="profile-chip" data-route="profile">
          ${avatarHtml(state.me.email, "large")}
          <span>${escapeHtml(state.me.display_name || state.me.email)}</span>
        </button>
      </nav>
    </header>
  `;
}

function renderCurrentPage() {
  if (!hasProfile(state.me)) return renderProfile(true);
  if (state.route === "profile") return renderProfile(false);
  if (state.route === "workspace") return renderWorkspacePage();
  if (state.route === "history") return renderHistoryPage();
  if (state.route === "members") return renderMembersPage();
  return renderHome();
}

function renderHome() {
  return `
    <main class="page layout-home">
      <aside class="panel">
        <div class="panel-header">
          <h2>Equipo</h2>
          <span class="status-pill ok">${state.members.length} miembros</span>
        </div>
        <div class="panel-body member-list">
          ${state.members.map(renderMemberItem).join("") || `<div class="empty">No hay miembros visibles.</div>`}
        </div>
      </aside>
      <section>
        <div class="section-title">
          <div>
            <h2>Workspaces</h2>
            <p class="muted">Estado actual de cada espacio de trabajo.</p>
          </div>
          <button class="btn primary" data-modal="workspace">Nuevo workspace</button>
        </div>
        <div class="grid workspace-grid">
          ${state.workspaces.map(renderWorkspaceCard).join("") || `<div class="empty">Crea el primer workspace del equipo.</div>`}
        </div>
      </section>
    </main>
  `;
}

function renderMemberItem(member) {
  const name = displayName(member.email);
  const hasCompleteProfile = hasProfile(member);
  return `
    <div class="member-item">
      ${avatarHtml(member.email)}
      <div class="member-copy">
        <strong>${escapeHtml(name)}</strong>
        <div class="tiny">${escapeHtml(member.email)}</div>
      </div>
      <span class="status-pill member-status ${hasCompleteProfile ? "ok" : "warn"}">${hasCompleteProfile ? "listo" : "pendiente"}</span>
    </div>
  `;
}

function renderWorkspaceCard(workspace) {
  return `
    <article class="card">
      <div>
        <h3>${escapeHtml(workspace.name)}</h3>
        <p>${escapeHtml(workspace.description || "Sin descripcion")}</p>
      </div>
      <div class="meta">
        <span>Creado por ${escapeHtml(displayName(workspace.created_by))}</span>
        <span>Modificado por ${escapeHtml(displayName(workspace.updated_by))}</span>
        <span>${formatDate(workspace.updated_at)}</span>
      </div>
      <div class="btn-row">
        <button class="btn primary small" data-open-workspace="${workspace.id}">Abrir</button>
        <button class="btn small" data-edit-workspace="${workspace.id}">Editar</button>
        <button class="btn danger small" data-delete-workspace="${workspace.id}">Eliminar</button>
      </div>
    </article>
  `;
}

function renderProfile(required) {
  const title = required ? "Completa tu perfil" : "Perfil";
  return `
    <main class="page">
      <section class="panel">
        <div class="panel-header">
          <div>
            <h2>${title}</h2>
            <p class="muted">${required ? "Necesitas nombre y color para entrar al hub." : "Edita tu nombre, color y apodos personales."}</p>
          </div>
          ${!required ? `<button class="btn" data-route="home">Volver</button>` : ""}
        </div>
        <div class="panel-body stack">
          <form id="profileForm" class="stack">
            <div class="field">
              <label for="displayName">Nombre</label>
              <input id="displayName" name="display_name" class="input" value="${escapeHtml(state.me.display_name || "")}" placeholder="Tu nombre visible" required />
            </div>
            <div class="field">
              <label>Color</label>
              <div class="color-grid">
                ${COLORS.map((color) => renderColorChoice(color, state.me.color)).join("")}
              </div>
              <input id="profileColor" name="color" type="hidden" value="${escapeHtml(state.me.color || "")}" required />
            </div>
            <div class="btn-row">
              <button class="btn primary" type="submit">Guardar perfil</button>
              <button class="btn" type="button" data-action="logout">Cerrar sesion</button>
            </div>
          </form>
        </div>
      </section>
      ${required ? "" : renderAliasesPanel()}
    </main>
  `;
}

function renderColorChoice(color, currentColor) {
  const owner = state.members.find((member) => member.color === color.id && member.email !== state.me.email);
  const active = currentColor === color.id;
  return `
    <button class="color-choice ${active ? "active" : ""}" type="button" data-color="${color.id}" ${owner ? "disabled" : ""}>
      <span class="color-dot" style="background:${color.hex}"></span>
      <span>
        <strong>${color.label}</strong>
        <span class="tiny">${owner ? `Ocupado por ${escapeHtml(displayName(owner.email))}` : active ? "Tu color actual" : "Disponible"}</span>
      </span>
    </button>
  `;
}

function renderAliasesPanel() {
  const others = state.members.filter((member) => member.email !== state.me.email);
  return `
    <section class="panel" style="margin-top:16px;">
      <div class="panel-header">
        <h2>Apodos personales</h2>
      </div>
      <div class="panel-body grid">
        ${others.map(renderAliasRow).join("") || `<div class="empty">No hay otros miembros todavia.</div>`}
      </div>
    </section>
  `;
}

function renderAliasRow(member) {
  const alias = state.aliases.find((item) => item.target_email === member.email);
  return `
    <form class="inline-form alias-form" data-target-email="${member.email}">
      <div class="member-item">
        ${avatarHtml(member.email)}
        <div>
          <strong>${escapeHtml(member.display_name || member.email)}</strong>
          <div class="tiny">${escapeHtml(member.email)}</div>
        </div>
      </div>
      <div class="split-fields">
        <input class="input" name="alias" value="${escapeHtml(alias?.alias || "")}" placeholder="Apodo solo para ti" />
        <div class="btn-row">
          <button class="btn small" type="submit">Guardar</button>
          ${alias ? `<button class="btn danger small" type="button" data-delete-alias="${alias.id}">Quitar</button>` : ""}
        </div>
      </div>
    </form>
  `;
}

function renderWorkspacePage() {
  if (!state.workspace) {
    return `<main class="page"><div class="empty">Workspace no encontrado.</div></main>`;
  }

  return `
    <main class="page workspace-page">
      <section class="workspace-header">
        <div class="workspace-header-main">
          <div>
            <h2>${escapeHtml(state.workspace.name)}</h2>
            <p class="muted">${escapeHtml(state.workspace.description || "Sin descripcion")}</p>
          </div>
          <div class="btn-row">
            <button class="btn" data-route="home">Volver</button>
            <button class="btn" data-history-workspace="${state.workspace.id}">Historial</button>
            <button class="btn" data-edit-workspace="${state.workspace.id}">Editar</button>
            <button class="btn danger" data-delete-workspace="${state.workspace.id}">Eliminar</button>
          </div>
        </div>
        <div class="meta">
          <span>Creado por ${escapeHtml(displayName(state.workspace.created_by))}</span>
          <span>Ultima modificacion por ${escapeHtml(displayName(state.workspace.updated_by))} · ${formatDate(state.workspace.updated_at)}</span>
        </div>
      </section>
      <div class="workspace-main">
        <section class="panel">
          <div class="panel-header">
            <h3>Enlaces y recursos</h3>
            <button class="btn primary small" data-modal="link">Agregar enlace</button>
          </div>
          <div class="panel-body resource-list">
            ${state.links.map(renderLinkItem).join("") || `<div class="empty">Todavia no hay enlaces en este workspace.</div>`}
          </div>
          <div class="panel-header">
            <h3>Notas</h3>
            <button class="btn small" data-modal="note">Nueva nota</button>
          </div>
          <div class="panel-body note-list">
            ${state.notes.map(renderNoteItem).join("") || `<div class="empty">Sin notas por ahora.</div>`}
          </div>
        </section>
        <section class="panel chat-panel">
          <div class="panel-header">
            <h3>Chat</h3>
          </div>
          <div class="panel-body message-list" id="messageList">
            ${state.messages.map(renderMessage).join("") || `<div class="empty">Empieza el chat del workspace.</div>`}
          </div>
          <div class="panel-body">
            <form id="messageForm" class="inline-form">
              <textarea class="textarea" name="content" placeholder="Escribe un mensaje" required></textarea>
              <button class="btn primary" type="submit">Enviar</button>
            </form>
          </div>
        </section>
      </div>
    </main>
  `;
}

function renderLinkItem(link) {
  return `
    <article class="resource-item">
      <div class="resource-top">
        <div class="resource-title">
          <span class="type-pill">${escapeHtml(link.type)}</span>
          <a href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(link.title)}</a>
        </div>
        <div class="btn-row">
          <button class="btn small" data-edit-link="${link.id}">Editar</button>
          <button class="btn danger small" data-delete-link="${link.id}">Eliminar</button>
        </div>
      </div>
      ${link.note ? `<p class="muted">${escapeHtml(link.note)}</p>` : ""}
      <div class="meta">
        <span>Creado por ${escapeHtml(displayName(link.created_by))}</span>
        <span>Modificado por ${escapeHtml(displayName(link.updated_by))} · ${formatDate(link.updated_at)}</span>
      </div>
    </article>
  `;
}

function renderNoteItem(note) {
  return `
    <article class="note-item">
      <p>${escapeHtml(note.content)}</p>
      <div class="meta">
        <span>Creado por ${escapeHtml(displayName(note.created_by))}</span>
        <span>Modificado por ${escapeHtml(displayName(note.updated_by))} · ${formatDate(note.updated_at)}</span>
      </div>
      <div class="btn-row">
        <button class="btn small" data-edit-note="${note.id}">Editar</button>
        <button class="btn danger small" data-delete-note="${note.id}">Eliminar</button>
      </div>
    </article>
  `;
}

function renderMessage(message) {
  const canEdit = message.created_by === state.me.email && !message.deleted_at;
  return `
    <article class="message">
      ${avatarHtml(message.created_by, "large")}
      <div>
        <div class="message-head">
          <div>
            <strong>${escapeHtml(displayName(message.created_by))}</strong>
            <span class="tiny">${formatDate(message.created_at)}${message.updated_at !== message.created_at && !message.deleted_at ? " · editado" : ""}</span>
          </div>
          ${canEdit ? `
            <div class="btn-row">
              <button class="btn small" data-edit-message="${message.id}">Editar</button>
              <button class="btn danger small" data-delete-message="${message.id}">Borrar</button>
            </div>
          ` : ""}
        </div>
        <p class="message-text ${message.deleted_at ? "deleted-message" : ""}">${message.deleted_at ? "Mensaje eliminado" : escapeHtml(message.content)}</p>
      </div>
    </article>
  `;
}

function renderHistoryPage() {
  const selected = state.routeId || "";
  return `
    <main class="page">
      <section class="panel">
        <div class="panel-header">
          <div>
            <h2>Historial</h2>
            <p class="muted">Trazabilidad de cambios en workspaces y enlaces.</p>
          </div>
          <select class="select" id="historyWorkspace" style="max-width:320px;">
            <option value="">Todos los workspaces</option>
            ${state.workspaces.map((workspace) => `<option value="${workspace.id}" ${selected === workspace.id ? "selected" : ""}>${escapeHtml(workspace.name)}</option>`).join("")}
          </select>
        </div>
        <div class="panel-body history-list">
          ${state.activity.map(renderHistoryItem).join("") || `<div class="empty">No hay actividad registrada.</div>`}
        </div>
      </section>
    </main>
  `;
}

function renderHistoryItem(item) {
  return `
    <article class="history-item">
      <div class="resource-top">
        <strong>${escapeHtml(labelAction(item.action))}</strong>
        <span class="tiny">${formatDate(item.created_at)}</span>
      </div>
      <p class="muted">Por ${escapeHtml(displayName(item.actor_email))}</p>
      ${renderActivityDiff(item)}
    </article>
  `;
}

function labelAction(action) {
  const labels = {
    workspace_created: "Workspace creado",
    workspace_updated: "Workspace modificado",
    workspace_deleted: "Workspace eliminado",
    link_created: "Enlace creado",
    link_updated: "Enlace modificado",
    link_deleted: "Enlace eliminado",
  };
  return labels[action] || action;
}

function renderActivityDiff(item) {
  const oldData = item.old_data || {};
  const newData = item.new_data || {};
  const fields = item.entity_type === "workspace"
    ? ["name", "description", "deleted_at"]
    : ["title", "url", "type", "note", "deleted_at"];

  const changes = fields
    .filter((field) => JSON.stringify(oldData[field] ?? null) !== JSON.stringify(newData[field] ?? null))
    .map((field) => `
      <div class="tiny">
        <strong>${escapeHtml(field)}</strong>:
        ${escapeHtml(oldData[field] ?? "vacio")} -> ${escapeHtml(newData[field] ?? "vacio")}
      </div>
    `)
    .join("");

  return changes || `<div class="tiny">Sin diferencias visibles.</div>`;
}

function renderMembersPage() {
  return `
    <main class="page">
      <section class="panel">
        <div class="panel-header">
          <div>
            <h2>Miembros</h2>
            <p class="muted">Administracion de acceso al hub.</p>
          </div>
        </div>
        <div class="panel-body stack">
          <form id="memberForm" class="inline-form">
            <div class="split-fields">
              <input class="input" name="email" type="email" placeholder="correo@unal.edu.co" required />
              <button class="btn primary" type="submit">Agregar</button>
            </div>
          </form>
          <div class="grid">
            ${state.members.map(renderAdminMemberRow).join("")}
          </div>
        </div>
      </section>
    </main>
  `;
}

function renderAdminMemberRow(member) {
  return `
    <div class="resource-item">
      <div class="resource-top">
        <div class="member-item">
          ${avatarHtml(member.email)}
          <div class="member-copy">
            <strong>${escapeHtml(member.display_name || "Perfil pendiente")}</strong>
            <div class="tiny">${escapeHtml(member.email)}</div>
          </div>
        </div>
        <div class="btn-row">
          <span class="status-pill ${hasProfile(member) ? "ok" : "warn"}">${hasProfile(member) ? "completo" : "pendiente"}</span>
          ${member.email === ADMIN_EMAIL ? "" : `<button class="btn danger small" data-remove-member="${member.email}">Quitar</button>`}
        </div>
      </div>
    </div>
  `;
}

function renderModal() {
  const modal = state.modal;
  const titles = {
    workspace: modal.id ? "Editar workspace" : "Nuevo workspace",
    link: modal.id ? "Editar enlace" : "Agregar enlace",
    note: modal.id ? "Editar nota" : "Nueva nota",
    message: "Editar mensaje",
  };

  return `
    <div class="modal-backdrop">
      <section class="modal">
        <div class="modal-header">
          <h2>${titles[modal.type]}</h2>
          <button class="btn icon" data-close-modal title="Cerrar">x</button>
        </div>
        <div class="panel-body">
          ${renderModalBody(modal)}
        </div>
      </section>
    </div>
  `;
}

function renderModalBody(modal) {
  if (modal.type === "workspace") {
    const workspace = modal.id ? state.workspaces.find((item) => item.id === modal.id) || state.workspace : {};
    return `
      <form id="workspaceForm" class="stack" data-id="${modal.id || ""}">
        <div class="field">
          <label>Nombre</label>
          <input class="input" name="name" value="${escapeHtml(workspace?.name || "")}" required />
        </div>
        <div class="field">
          <label>Descripcion</label>
          <textarea class="textarea" name="description">${escapeHtml(workspace?.description || "")}</textarea>
        </div>
        <button class="btn primary" type="submit">Guardar</button>
      </form>
    `;
  }

  if (modal.type === "link") {
    const link = modal.id ? state.links.find((item) => item.id === modal.id) : {};
    const type = link?.type || "Otro";
    return `
      <form id="linkForm" class="stack" data-id="${modal.id || ""}">
        <div class="field">
          <label>Titulo</label>
          <input class="input" name="title" value="${escapeHtml(link?.title || "")}" required />
        </div>
        <div class="field">
          <label>URL</label>
          <input class="input" name="url" value="${escapeHtml(link?.url || "")}" placeholder="https://" required />
        </div>
        <div class="split-fields">
          <div class="field">
            <label>Tipo</label>
            <select class="select" name="type">
              ${LINK_TYPES.map((item) => `<option value="${item}" ${item === type ? "selected" : ""}>${item}</option>`).join("")}
            </select>
          </div>
          <div class="field">
            <label>&nbsp;</label>
            <button class="btn" type="button" data-detect-link-type>Detectar tipo</button>
          </div>
        </div>
        <div class="field">
          <label>Nota corta</label>
          <textarea class="textarea" name="note">${escapeHtml(link?.note || "")}</textarea>
        </div>
        <button class="btn primary" type="submit">Guardar enlace</button>
      </form>
    `;
  }

  if (modal.type === "note") {
    const note = modal.id ? state.notes.find((item) => item.id === modal.id) : {};
    return `
      <form id="noteForm" class="stack" data-id="${modal.id || ""}">
        <div class="field">
          <label>Nota</label>
          <textarea class="textarea" name="content" required>${escapeHtml(note?.content || "")}</textarea>
        </div>
        <button class="btn primary" type="submit">Guardar nota</button>
      </form>
    `;
  }

  if (modal.type === "message") {
    const message = state.messages.find((item) => item.id === modal.id);
    return `
      <form id="editMessageForm" class="stack" data-id="${modal.id}">
        <div class="field">
          <label>Mensaje</label>
          <textarea class="textarea" name="content" required>${escapeHtml(message?.content || "")}</textarea>
        </div>
        <button class="btn primary" type="submit">Guardar mensaje</button>
      </form>
    `;
  }

  return "";
}

function bindEvents() {
  document.querySelectorAll("[data-route]").forEach((button) => {
    button.addEventListener("click", () => routeTo(button.dataset.route));
  });

  document.querySelectorAll("[data-auth-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      state.authMode = button.dataset.authMode;
      clearError();
      render();
    });
  });

  document.getElementById("authForm")?.addEventListener("submit", handleAuth);
  document.getElementById("profileForm")?.addEventListener("submit", handleProfile);
  document.getElementById("messageForm")?.addEventListener("submit", handleCreateMessage);
  document.getElementById("workspaceForm")?.addEventListener("submit", handleWorkspaceForm);
  document.getElementById("linkForm")?.addEventListener("submit", handleLinkForm);
  document.getElementById("noteForm")?.addEventListener("submit", handleNoteForm);
  document.getElementById("editMessageForm")?.addEventListener("submit", handleEditMessageForm);
  document.getElementById("memberForm")?.addEventListener("submit", handleAddMember);

  document.querySelectorAll("[data-color]").forEach((button) => {
    button.addEventListener("click", () => {
      const input = document.getElementById("profileColor");
      input.value = button.dataset.color;
      document.querySelectorAll(".color-choice").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
    });
  });

  document.querySelectorAll(".alias-form").forEach((form) => {
    form.addEventListener("submit", handleAliasForm);
  });

  document.querySelectorAll("[data-open-workspace]").forEach((button) => {
    button.addEventListener("click", () => routeTo("workspace", button.dataset.openWorkspace));
  });

  document.querySelectorAll("[data-history-workspace]").forEach((button) => {
    button.addEventListener("click", () => routeTo("history", button.dataset.historyWorkspace));
  });

  document.querySelectorAll("[data-modal]").forEach((button) => {
    button.addEventListener("click", () => {
      state.modal = { type: button.dataset.modal };
      render();
    });
  });

  document.querySelectorAll("[data-edit-workspace]").forEach((button) => {
    button.addEventListener("click", () => {
      state.modal = { type: "workspace", id: button.dataset.editWorkspace };
      render();
    });
  });

  document.querySelectorAll("[data-edit-link]").forEach((button) => {
    button.addEventListener("click", () => {
      state.modal = { type: "link", id: button.dataset.editLink };
      render();
    });
  });

  document.querySelectorAll("[data-edit-note]").forEach((button) => {
    button.addEventListener("click", () => {
      state.modal = { type: "note", id: button.dataset.editNote };
      render();
    });
  });

  document.querySelectorAll("[data-edit-message]").forEach((button) => {
    button.addEventListener("click", () => {
      state.modal = { type: "message", id: button.dataset.editMessage };
      render();
    });
  });

  document.querySelector("[data-close-modal]")?.addEventListener("click", () => {
    state.modal = null;
    render();
  });

  document.querySelector("[data-detect-link-type]")?.addEventListener("click", () => {
    const form = document.getElementById("linkForm");
    form.elements.type.value = detectLinkType(form.elements.url.value);
  });

  document.querySelectorAll("[data-delete-workspace]").forEach((button) => {
    button.addEventListener("click", () => deleteWorkspace(button.dataset.deleteWorkspace));
  });

  document.querySelectorAll("[data-delete-link]").forEach((button) => {
    button.addEventListener("click", () => deleteLink(button.dataset.deleteLink));
  });

  document.querySelectorAll("[data-delete-note]").forEach((button) => {
    button.addEventListener("click", () => deleteNote(button.dataset.deleteNote));
  });

  document.querySelectorAll("[data-delete-message]").forEach((button) => {
    button.addEventListener("click", () => deleteMessage(button.dataset.deleteMessage));
  });

  document.querySelectorAll("[data-delete-alias]").forEach((button) => {
    button.addEventListener("click", () => deleteAlias(button.dataset.deleteAlias));
  });

  document.querySelectorAll("[data-remove-member]").forEach((button) => {
    button.addEventListener("click", () => removeMember(button.dataset.removeMember));
  });

  document.querySelector("[data-action='logout']")?.addEventListener("click", logout);

  document.getElementById("historyWorkspace")?.addEventListener("change", (event) => {
    routeTo("history", event.target.value || null);
  });
}

async function handleAuth(event) {
  event.preventDefault();
  clearError();
  const form = event.currentTarget;
  const email = form.elements.email.value.trim().toLowerCase();
  const password = form.elements.password.value;

  const result = state.authMode === "login"
    ? await supabase.auth.signInWithPassword({ email, password })
    : await supabase.auth.signUp({ email, password });

  if (result.error) {
    notifyError(result.error.message);
    return;
  }

  if (state.authMode === "signup" && !result.data.session) {
    notifyError("Cuenta creada. Revisa el correo para confirmar y luego inicia sesion.");
    return;
  }

  routeTo("home");
}

async function handleProfile(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const displayNameValue = form.elements.display_name.value.trim();
  const color = form.elements.color.value;

  if (!displayNameValue || !color) {
    notifyError("Nombre y color son obligatorios.");
    return;
  }

  const { error } = await supabase
    .from("hub_members")
    .update({ display_name: displayNameValue, color })
    .eq("email", state.me.email);

  if (error) {
    notifyError(error.message);
    return;
  }

  await applyRoute();
  routeTo("home");
}

async function handleWorkspaceForm(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const id = form.dataset.id;
  const payload = {
    name: form.elements.name.value.trim(),
    description: form.elements.description.value.trim(),
  };

  if (!payload.name) {
    notifyError("El workspace necesita nombre.");
    return;
  }

  const result = id
    ? await supabase.from("workspaces").update(payload).eq("id", id)
    : await supabase.from("workspaces").insert(payload);

  if (result.error) {
    notifyError(result.error.message);
    return;
  }

  state.modal = null;
  await applyRoute();
}

async function handleLinkForm(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const id = form.dataset.id;
  const payload = {
    title: form.elements.title.value.trim(),
    url: form.elements.url.value.trim(),
    type: form.elements.type.value || detectLinkType(form.elements.url.value),
    note: form.elements.note.value.trim(),
  };

  if (!payload.title || !payload.url) {
    notifyError("Titulo y URL son obligatorios.");
    return;
  }

  const result = id
    ? await supabase.from("workspace_links").update(payload).eq("id", id)
    : await supabase.from("workspace_links").insert({ ...payload, workspace_id: state.workspace.id });

  if (result.error) {
    notifyError(result.error.message);
    return;
  }

  state.modal = null;
  await applyRoute();
}

async function handleNoteForm(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const id = form.dataset.id;
  const content = form.elements.content.value.trim();

  if (!content) {
    notifyError("La nota no puede estar vacia.");
    return;
  }

  const result = id
    ? await supabase.from("workspace_notes").update({ content }).eq("id", id)
    : await supabase.from("workspace_notes").insert({ workspace_id: state.workspace.id, content });

  if (result.error) {
    notifyError(result.error.message);
    return;
  }

  state.modal = null;
  await applyRoute();
}

async function handleCreateMessage(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const content = form.elements.content.value.trim();
  if (!content) return;

  const { error } = await supabase.from("workspace_messages").insert({
    workspace_id: state.workspace.id,
    content,
  });

  if (error) {
    notifyError(error.message);
    return;
  }

  form.reset();
  await applyRoute();
}

async function handleEditMessageForm(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const content = form.elements.content.value.trim();

  if (!content) {
    notifyError("El mensaje no puede quedar vacio.");
    return;
  }

  const { error } = await supabase
    .from("workspace_messages")
    .update({ content })
    .eq("id", form.dataset.id);

  if (error) {
    notifyError(error.message);
    return;
  }

  state.modal = null;
  await applyRoute();
}

async function handleAliasForm(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const alias = form.elements.alias.value.trim();
  const targetEmail = form.dataset.targetEmail;
  const existing = state.aliases.find((item) => item.target_email === targetEmail);

  if (!alias && existing) {
    await deleteAlias(existing.id);
    return;
  }

  if (!alias) return;

  const result = existing
    ? await supabase.from("member_aliases").update({ alias }).eq("id", existing.id)
    : await supabase.from("member_aliases").insert({ target_email: targetEmail, alias });

  if (result.error) {
    notifyError(result.error.message);
    return;
  }

  await applyRoute();
}

async function handleAddMember(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const email = form.elements.email.value.trim().toLowerCase();

  const { error } = await supabase.from("hub_members").insert({ email });
  if (error) {
    notifyError(error.message);
    return;
  }

  form.reset();
  await applyRoute();
}

async function deleteWorkspace(id) {
  if (!confirm("Eliminar este workspace? Se ocultara, pero quedara en historial.")) return;
  const { error } = await supabase.from("workspaces").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) return notifyError(error.message);
  routeTo("home");
}

async function deleteLink(id) {
  if (!confirm("Eliminar este enlace?")) return;
  const { error } = await supabase.from("workspace_links").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) return notifyError(error.message);
  await applyRoute();
}

async function deleteNote(id) {
  if (!confirm("Eliminar esta nota?")) return;
  const { error } = await supabase.from("workspace_notes").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) return notifyError(error.message);
  await applyRoute();
}

async function deleteMessage(id) {
  if (!confirm("Borrar este mensaje?")) return;
  const { error } = await supabase
    .from("workspace_messages")
    .update({ content: "", deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return notifyError(error.message);
  await applyRoute();
}

async function deleteAlias(id) {
  const { error } = await supabase.from("member_aliases").delete().eq("id", id);
  if (error) return notifyError(error.message);
  await applyRoute();
}

async function removeMember(email) {
  if (!confirm(`Quitar acceso a ${email}?`)) return;
  const { error } = await supabase
    .from("hub_members")
    .update({ removed_at: new Date().toISOString() })
    .eq("email", email);
  if (error) return notifyError(error.message);
  await applyRoute();
}

async function logout() {
  await supabase.auth.signOut();
  state.user = null;
  state.me = null;
  state.members = [];
  routeTo("login");
}

function detectLinkType(urlValue) {
  const url = urlValue.toLowerCase();
  if (url.includes("docs.google.com/document")) return "Docs";
  if (url.includes("docs.google.com/spreadsheets")) return "Sheets";
  if (url.includes("docs.google.com/presentation")) return "Slides";
  if (url.includes("drive.google.com")) return "Drive";
  if (url.includes("app.diagrams.net") || url.includes("draw.io")) return "Draw.io";
  if (url.includes("github.com")) return "GitHub";
  if (url.split("?")[0].endsWith(".pdf")) return "PDF";
  return "Otro";
}

function setRealtimeStatus(status) {
  state.realtimeStatus = status;
  const indicator = document.getElementById("liveStatus");
  if (indicator) {
    indicator.className = `live-status ${status}`;
    indicator.textContent = status === "online" ? "En vivo" : status === "connecting" ? "Conectando" : "Sin vivo";
  }
}

function syncRealtimeSubscriptions() {
  if (!state.user || !state.me) {
    unsubscribeGlobalRealtime();
    unsubscribeWorkspaceRealtime();
    setRealtimeStatus("offline");
    return;
  }

  subscribeGlobalRealtime();

  if (state.route === "workspace" && state.workspace?.id) {
    subscribeWorkspaceRealtime(state.workspace.id);
    return;
  }

  unsubscribeWorkspaceRealtime();
}

function subscribeGlobalRealtime() {
  if (state.globalChannel) return;

  setRealtimeStatus("connecting");

  state.globalChannel = supabase
    .channel("hub-global")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "hub_members" },
      () => refreshMembersAndAliases().catch((error) => notifyError(error.message))
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "workspaces" },
      (payload) => refreshWorkspaces(payload).catch((error) => notifyError(error.message))
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "activity_log" },
      () => refreshCurrentHistory().catch((error) => notifyError(error.message))
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") setRealtimeStatus("online");
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        setRealtimeStatus("offline");
      }
    });
}

function subscribeWorkspaceRealtime(workspaceId) {
  if (state.workspaceChannel && state.workspaceChannelId === workspaceId) return;

  unsubscribeWorkspaceRealtime();
  state.workspaceChannelId = workspaceId;

  state.workspaceChannel = supabase
    .channel(`workspace-live-${workspaceId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "workspace_messages", filter: `workspace_id=eq.${workspaceId}` },
      () => refreshCurrentWorkspacePart("messages").catch((error) => notifyError(error.message))
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "workspace_links", filter: `workspace_id=eq.${workspaceId}` },
      () => refreshCurrentWorkspacePart("links").catch((error) => notifyError(error.message))
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "workspace_notes", filter: `workspace_id=eq.${workspaceId}` },
      () => refreshCurrentWorkspacePart("notes").catch((error) => notifyError(error.message))
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "activity_log", filter: `workspace_id=eq.${workspaceId}` },
      () => refreshCurrentHistory().catch((error) => notifyError(error.message))
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") setRealtimeStatus("online");
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        setRealtimeStatus(state.globalChannel ? "connecting" : "offline");
      }
    });
}

function unsubscribeGlobalRealtime() {
  if (!state.globalChannel) return;
  supabase.removeChannel(state.globalChannel);
  state.globalChannel = null;
}

function unsubscribeWorkspaceRealtime() {
  if (!state.workspaceChannel) return;
  supabase.removeChannel(state.workspaceChannel);
  state.workspaceChannel = null;
  state.workspaceChannelId = null;
}

window.addEventListener("hashchange", applyRoute);
supabase.auth.onAuthStateChange(() => {
  applyRoute();
});

applyRoute().catch((error) => {
  state.loading = false;
  notifyError(error.message);
});
