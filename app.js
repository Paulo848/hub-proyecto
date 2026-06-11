import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://ixmxjwhzqtqbklkxpezh.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4bXhqd2h6cXRxYmtsa3hwZXpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExNzcyOTYsImV4cCI6MjA5Njc1MzI5Nn0.WY_5Gym8jj5FBPkBKuE1yUmLMdIQ8IWSfl_IhCuzFsE";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

let currentWorkspaceId = null;

const $ = (id) => document.getElementById(id);

async function getUser() {
    const { data } = await supabase.auth.getUser();
    const user = data.user;

    $("userInfo").textContent = user
    ? `Sesión iniciada: ${user.email}`
    : "No has iniciado sesión";

    return user;
}

async function signUp() {
    const email = $("email").value.trim();
    const password = $("password").value.trim();

    const { error } = await supabase.auth.signUp({ email, password });

    if (error) {
        alert(error.message);
        return;
    }

    alert("Cuenta creada. Revisa el correo si Supabase pide confirmación.");
}

async function login() {
    const email = $("email").value.trim();
    const password = $("password").value.trim();

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
        alert(error.message);
        return;
    }

    await getUser();
    await loadWorkspaces();
}

async function logout() {
    await supabase.auth.signOut();
    currentWorkspaceId = null;
    $("workspace-detail").hidden = true;
    $("workspaces").innerHTML = "";
    await getUser();
}

async function createWorkspace() {
    const user = await getUser();
    if (!user) {
        alert("Primero inicia sesion.");
        return;
    }

    const name = $("workspaceName").value.trim();
    const description = $("workspaceDescription").value.trim();

    if (!name) {
        alert("Ponle un nombre al workspace.");
        return;
    }

    const { error } = await supabase
    .from("workspaces")
    .insert({ name, description });

    if (error) {
        alert(error.message);
        return;
    }

    $("workspaceName").value = "";
    $("workspaceDescription").value = "";
    await loadWorkspaces();
}

async function loadWorkspaces() {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) {
        $("workspaces").innerHTML = '<p class="muted">Inicia sesion para ver tus workspaces.</p>';
        return;
    }

    const { data, error } = await supabase
    .from("workspaces")
    .select("*")
    .order("created_at", { ascending: false });

    if (error) {
        console.error(error);
        return;
    }

    $("workspaces").innerHTML = "";

    data.forEach((workspace) => {
        const div = document.createElement("div");
        div.className = "card";
        div.innerHTML = `
        <h3>${workspace.name}</h3>
        <p>${workspace.description || ""}</p>
        <small>${new Date(workspace.created_at).toLocaleString()}</small>
        <br>
        <button>Abrir</button>
        `;

        div.querySelector("button").addEventListener("click", () => {
            openWorkspace(workspace);
        });

        $("workspaces").appendChild(div);
    });
}

async function openWorkspace(workspace) {
    currentWorkspaceId = workspace.id;
    $("workspace-detail").hidden = false;
    $("currentWorkspaceTitle").textContent = workspace.name;

    await loadLinks();
    await loadNotes();
    await loadMessages();
}

async function addLink() {
    const title = $("linkTitle").value.trim();
    const url = $("linkUrl").value.trim();

    if (!currentWorkspaceId || !title || !url) return;

    const { error } = await supabase.from("workspace_links").insert({
        workspace_id: currentWorkspaceId,
        title,
        url,
    });

    if (error) {
        alert(error.message);
        return;
    }

    $("linkTitle").value = "";
    $("linkUrl").value = "";
    await loadLinks();
}

async function loadLinks() {
    const { data, error } = await supabase
    .from("workspace_links")
    .select("*")
    .eq("workspace_id", currentWorkspaceId)
    .order("created_at", { ascending: false });

    if (error) return console.error(error);

    $("links").innerHTML = "";

    data.forEach((link) => {
        const div = document.createElement("div");
        div.className = "item";
        div.innerHTML = `
        <a href="${link.url}" target="_blank" rel="noopener noreferrer">${link.title}</a>
        <small>${link.created_by || ""}</small>
        `;
        $("links").appendChild(div);
    });
}

async function addNote() {
    const content = $("noteContent").value.trim();

    if (!currentWorkspaceId || !content) return;

    const { error } = await supabase.from("workspace_notes").insert({
        workspace_id: currentWorkspaceId,
        content,
    });

    if (error) {
        alert(error.message);
        return;
    }

    $("noteContent").value = "";
    await loadNotes();
}

async function loadNotes() {
    const { data, error } = await supabase
    .from("workspace_notes")
    .select("*")
    .eq("workspace_id", currentWorkspaceId)
    .order("created_at", { ascending: false });

    if (error) return console.error(error);

    $("notes").innerHTML = "";

    data.forEach((note) => {
        const div = document.createElement("div");
        div.className = "item";
        div.innerHTML = `
        <p>${note.content}</p>
        <small>${note.created_by || ""}</small>
        `;
        $("notes").appendChild(div);
    });
}

async function addMessage() {
    const content = $("messageContent").value.trim();

    if (!currentWorkspaceId || !content) return;

    const { error } = await supabase.from("workspace_messages").insert({
        workspace_id: currentWorkspaceId,
        content,
    });

    if (error) {
        alert(error.message);
        return;
    }

    $("messageContent").value = "";
    await loadMessages();
}

async function loadMessages() {
    const { data, error } = await supabase
    .from("workspace_messages")
    .select("*")
    .eq("workspace_id", currentWorkspaceId)
    .order("created_at", { ascending: true });

    if (error) return console.error(error);

    $("messages").innerHTML = "";

    data.forEach((message) => {
        const div = document.createElement("div");
        div.className = "item";
        div.innerHTML = `
        <p><strong>${message.created_by || "Usuario"}:</strong> ${message.content}</p>
        `;
        $("messages").appendChild(div);
    });
}

function subscribeRealtime() {
    supabase
    .channel("hub-realtime")
    .on(
        "postgres_changes",
        { event: "*", schema: "public" },
        async () => {
            await loadWorkspaces();

            if (currentWorkspaceId) {
                await loadLinks();
                await loadNotes();
                await loadMessages();
            }
        }
    )
    .subscribe();
}

$("signupBtn").addEventListener("click", signUp);
$("loginBtn").addEventListener("click", login);
$("logoutBtn").addEventListener("click", logout);
$("createWorkspaceBtn").addEventListener("click", createWorkspace);
$("addLinkBtn").addEventListener("click", addLink);
$("addNoteBtn").addEventListener("click", addNote);
$("addMessageBtn").addEventListener("click", addMessage);

await getUser();
await loadWorkspaces();
subscribeRealtime();
