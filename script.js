
const SUPABASE_URL = "https://shkobsozqjxbefdqzjba.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_tMNht62z4mAnX7g5ukRn6w_cU8Sx0eo";
const STORAGE_BUCKET = "materi-azzura";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

const $ = (id) => document.getElementById(id);

const data = {
  materi: [],
  tugas: [],
  projek: []
};

let currentUser = null;

const today = $("today");
if (today) {
  today.textContent = new Date().toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

function showMessage(message) {
  alert(message);
}

function formatSize(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileType(filename = "") {
  const ext = filename.includes(".")
    ? filename.split(".").pop().toUpperCase()
    : "FILE";

  return ext.length > 5 ? "FILE" : ext;
}

function setFormLoading(form, loading) {
  const button = form.querySelector('button[type="submit"]');
  if (button) button.disabled = loading;
}

function isOwner(item) {
  return Boolean(
    currentUser &&
    item.owner_id &&
    item.owner_id === currentUser.id
  );
}

function safeLink(url) {
  if (!url) return null;

  try {
    const parsed = new URL(
      url.startsWith("http://") || url.startsWith("https://")
        ? url
        : `https://${url}`
    );

    if (!["http:", "https:"].includes(parsed.protocol)) return null;

    return parsed.href;
  } catch {
    return null;
  }
}

// Membuat modal login
function createLoginModal() {
  if ($("login-modal")) return;

  const modal = document.createElement("div");
  modal.id = "login-modal";
  modal.className = "login-modal";
  modal.style.display = "none";

  modal.innerHTML = `
    <div class="login-box">
      <h3>Login Pemilik</h3>
      <p style="font-size:12px; margin-bottom:15px; color:#987d87;">
        Masuk untuk mengelola materi, tugas, dan projek.
      </p>
      <form id="login-form">
        <input
          type="email"
          id="login-email"
          placeholder="Email"
          required
        >
        <input
          type="password"
          id="login-password"
          placeholder="Password"
          required
        >
        <button type="submit">Masuk</button>
        <button type="button" class="close-login" id="close-login">
          Batal
        </button>
      </form>
    </div>
  `;

  document.body.append(modal);

  $("close-login").addEventListener("click", () => {
    modal.style.display = "none";
  });

  $("login-form").addEventListener("submit", async (event) => {
    event.preventDefault();

    const button = event.currentTarget.querySelector(
      'button[type="submit"]'
    );

    button.disabled = true;

    try {
      const { error } = await supabaseClient.auth.signInWithPassword({
        email: $("login-email").value.trim(),
        password: $("login-password").value
      });

      if (error) throw error;

      modal.style.display = "none";
      $("login-form").reset();
      showMessage("Login berhasil ♡");
    } catch (error) {
      console.error(error);
      showMessage("Login gagal. Periksa email dan password.");
    } finally {
      button.disabled = false;
    }
  });
}

// Mengatur tampilan berdasarkan status login
function updateAuthDisplay() {
  const button = $("auth-button");

  document.querySelectorAll(".upload-panel").forEach((panel) => {
    panel.style.display = currentUser ? "" : "none";
  });

  if (button) {
    button.textContent = currentUser ? "Logout" : "Login";
  }

  Object.keys(data).forEach(render);
}

// Tombol login dan logout
async function handleAuthButton() {
  if (!currentUser) {
    createLoginModal();
    $("login-modal").style.display = "flex";
    return;
  }

  const confirmed = confirm("Yakin ingin logout?");
  if (!confirmed) return;

  const { error } = await supabaseClient.auth.signOut();

  if (error) {
    console.error(error);
    showMessage("Logout gagal.");
  }
}

// Mengambil data dari Supabase
async function loadItems(type) {
  const { data: rows, error } = await supabaseClient
    .from("academic_items")
    .select("*")
    .eq("type", type)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Gagal mengambil data:", error);
    showMessage(`Gagal memuat ${type}. Periksa tabel dan kebijakan Supabase.`);
    return;
  }

  data[type] = rows || [];
  render(type);
}

// Membuat tampilan setiap data
function render(type) {
  const container = $(type + "-list");
  if (!container) return;

  container.innerHTML = "";

  if (data[type].length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent =
      `Belum ada ${type === "materi" ? "materi" : type === "tugas" ? "tugas" : "projek"}.`;
    container.append(empty);
  }

  data[type].forEach((item) => {
    const card = document.createElement("div");
    card.className = "file-card";

    const icon = document.createElement("div");
    icon.className = "file-icon";
    icon.textContent = getFileType(item.file_name || "");

    const info = document.createElement("div");
    info.className = "file-info";

    const heading = document.createElement("h3");
    heading.textContent = item.nama || "Tanpa judul";

    const detail = document.createElement("p");
    const details = [];

    if (item.matkul) details.push(item.matkul);
    if (item.deadline) details.push(`Deadline: ${item.deadline}`);
    if (item.item_date) details.push(`Tanggal: ${item.item_date}`);
    if (item.deskripsi) details.push(item.deskripsi);
    if (item.file_name) {
      details.push(`${item.file_name} · ${formatSize(item.file_size)}`);
    }

    detail.textContent = details.join(" · ");
    info.append(heading, detail);

    // Checklist untuk tugas dan projek
    if (type === "tugas" || type === "projek") {
      const status = document.createElement("label");
      status.className = "item-status";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = item.status === "selesai";
      checkbox.disabled = !isOwner(item);

      const statusText = document.createElement("span");
      statusText.textContent =
        item.status === "selesai" ? "Selesai" : "Belum selesai";

      if (item.status === "selesai") {
        statusText.classList.add("status-selesai");
      }

      checkbox.addEventListener("change", async () => {
        checkbox.disabled = true;

        const newStatus = checkbox.checked ? "selesai" : "belum";

        const { error } = await supabaseClient
          .from("academic_items")
          .update({ status: newStatus })
          .eq("id", item.id)
          .eq("owner_id", currentUser.id);

        if (error) {
          console.error(error);
          checkbox.checked = !checkbox.checked;
          showMessage("Status gagal diperbarui.");
        } else {
          item.status = newStatus;
          render(type);
        }
      });

      status.append(checkbox, statusText);
      info.append(status);
    }

    const actions = document.createElement("div");
    actions.className = "file-actions";

    // Tombol tautan jika tersedia
    if (item.link_url) {
      const url = safeLink(item.link_url);

      if (url) {
        const link = document.createElement("a");
        link.href = url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = type === "projek" ? "Lihat Projek" : "Buka Tautan";
        actions.append(link);
      }
    }

    // Tombol unduh file
    if (item.file_path) {
      const download = document.createElement("button");
      download.type = "button";
      download.textContent = "Lihat File";

      download.addEventListener("click", async () => {
        download.disabled = true;

        try {
          const { data: result, error } = await supabaseClient
            .storage
            .from(STORAGE_BUCKET)
            .createSignedUrl(item.file_path, 60);

          if (error) throw error;

          window.open(result.signedUrl, "_blank", "noopener,noreferrer");
        } catch (error) {
          console.error(error);
          showMessage("File gagal dibuka. Periksa kebijakan Storage.");
        } finally {
          download.disabled = false;
        }
      });

      actions.append(download);
    }

    // Tombol edit dan hapus hanya untuk pemilik
    if (isOwner(item)) {
      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "edit-button";
      edit.textContent = "Edit";

      edit.addEventListener("click", () => editItem(type, item));

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "delete-button";
      remove.textContent = "Hapus";

      remove.addEventListener("click", () => deleteItem(type, item, remove));

      actions.append(edit, remove);
    }

    card.append(icon, info, actions);
    container.append(card);
  });

  const count = $(type + "-count");
  if (count) count.textContent = data[type].length;
}

// Mengedit informasi data
async function editItem(type, item) {
  const nama = prompt("Nama:", item.nama || "");
  if (nama === null) return;

  if (!nama.trim()) {
    showMessage("Nama tidak boleh kosong.");
    return;
  }

  const updates = {
    nama: nama.trim()
  };

  if (type === "materi" || type === "tugas") {
    const matkul = prompt("Mata kuliah:", item.matkul || "");
    if (matkul === null) return;
    updates.matkul = matkul.trim() || null;
  }

  if (type === "tugas") {
    const deadline = prompt("Deadline (YYYY-MM-DD):", item.deadline || "");
    if (deadline === null) return;
    updates.deadline = deadline || null;

    const link = prompt("Tautan tugas (boleh dikosongkan):", item.link_url || "");
    if (link === null) return;
    updates.link_url = link.trim() || null;
  }

  if (type === "projek") {
    const deskripsi = prompt("Deskripsi projek:", item.deskripsi || "");
    if (deskripsi === null) return;
    updates.deskripsi = deskripsi.trim() || null;

    const tanggal = prompt("Tanggal projek (YYYY-MM-DD):", item.item_date || "");
    if (tanggal === null) return;
    updates.item_date = tanggal || null;

    const link = prompt("Tautan/GitHub projek:", item.link_url || "");
    if (link === null) return;
    updates.link_url = link.trim() || null;
  }

  const { error } = await supabaseClient
    .from("academic_items")
    .update(updates)
    .eq("id", item.id)
    .eq("owner_id", currentUser.id);

  if (error) {
    console.error(error);
    showMessage("Data gagal diedit. Periksa kolom database.");
    return;
  }

  showMessage("Data berhasil diperbarui ♡");
  await loadItems(type);
}

// Menghapus data
async function deleteItem(type, item, button) {
  if (!confirm("Yakin ingin menghapus data ini?")) return;

  button.disabled = true;

  try {
    if (item.file_path) {
      const { error: storageError } = await supabaseClient
        .storage
        .from(STORAGE_BUCKET)
        .remove([item.file_path]);

      if (storageError) throw storageError;
    }

    const { error } = await supabaseClient
      .from("academic_items")
      .delete()
      .eq("id", item.id)
      .eq("owner_id", currentUser.id);

    if (error) throw error;

    showMessage("Data berhasil dihapus.");
    await loadItems(type);
  } catch (error) {
    console.error(error);
    showMessage("Data gagal dihapus. Periksa kebijakan database dan Storage.");
    button.disabled = false;
  }
}

// Menambah data dan mengunggah file
async function addItem(type, item, file) {
  if (!currentUser) {
    showMessage("Silakan login terlebih dahulu.");
    return false;
  }

  let filePath = null;

  try {
    if (file) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");

      filePath =
        `${currentUser.id}/${type}/${crypto.randomUUID()}-${safeName}`;

      const { error: uploadError } = await supabaseClient
        .storage
        .from(STORAGE_BUCKET)
        .upload(filePath, file, {
          upsert: false,
          contentType: file.type || "application/octet-stream"
        });

      if (uploadError) throw uploadError;
    }

    const record = {
      type,
      nama: item.nama,
      matkul: item.matkul || null,
      deadline: item.deadline || null,
      deskripsi: item.deskripsi || null,
      item_date: item.item_date || null,
      link_url: item.link_url || null,
      status: "belum",
      owner_id: currentUser.id,
      is_published: true,
      file_path: filePath,
      file_name: file ? file.name : null,
      file_size: file ? file.size : null
    };

    const { error: insertError } = await supabaseClient
      .from("academic_items")
      .insert(record);

    if (insertError) throw insertError;

    await loadItems(type);
    showMessage("Data berhasil disimpan ♡");
    return true;

  } catch (error) {
    console.error("Gagal menyimpan data:", error);

    if (filePath) {
      await supabaseClient.storage
        .from(STORAGE_BUCKET)
        .remove([filePath]);
    }

    showMessage(
      "Data gagal disimpan. Periksa kolom tabel, bucket, dan kebijakan Supabase."
    );

    return false;
  }
}

// Form Materi
if ($("materi-form")) {
  $("materi-form").addEventListener("submit", async (event) => {
    event.preventDefault();

    const form = event.currentTarget;
    const file = $("materi-file").files[0];

    if (!file) {
      showMessage("Pilih file materi terlebih dahulu.");
      return;
    }

    setFormLoading(form, true);

    const success = await addItem("materi", {
      nama: $("materi-nama").value.trim(),
      matkul: $("materi-matkul").value.trim()
    }, file);

    if (success) form.reset();
    setFormLoading(form, false);
  });
}

// Form Tugas
if ($("tugas-form")) {
  $("tugas-form").addEventListener("submit", async (event) => {
    event.preventDefault();

    const form = event.currentTarget;
    const file = $("tugas-file").files[0] || null;

    setFormLoading(form, true);

    const success = await addItem("tugas", {
      nama: $("tugas-nama").value.trim(),
      matkul: $("tugas-matkul").value.trim(),
      deadline: $("tugas-deadline").value,
      link_url: $("tugas-link")?.value.trim() || null
    }, file);

    if (success) form.reset();
    setFormLoading(form, false);
  });
}

// Form Projek
if ($("projek-form")) {
  $("projek-form").addEventListener("submit", async (event) => {
    event.preventDefault();

    const form = event.currentTarget;
    const file = $("projek-file").files[0] || null;

    setFormLoading(form, true);

    const success = await addItem("projek", {
      nama: $("projek-nama").value.trim(),
      deskripsi: $("projek-deskripsi").value.trim(),
      item_date: $("projek-tanggal")?.value || null,
      link_url: $("projek-link")?.value.trim() || null
    }, file);

    if (success) form.reset();
    setFormLoading(form, false);
  });
}

// Navigasi sidebar
document.querySelectorAll(".nav-link").forEach((link) => {
  link.addEventListener("click", () => {
    document.querySelectorAll(".nav-link").forEach((item) => {
      item.classList.remove("active");
    });

    link.classList.add("active");
  });
});

// Inisialisasi aplikasi
async function initApp() {
  createLoginModal();

  if ($("auth-button")) {
    $("auth-button").addEventListener("click", handleAuthButton);
  }

  const { data: sessionData, error } =
    await supabaseClient.auth.getSession();

  if (error) console.error(error);

  currentUser = sessionData?.session?.user || null;
  updateAuthDisplay();

  await Promise.all([
    loadItems("materi"),
    loadItems("tugas"),
    loadItems("projek")
  ]);

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    currentUser = session?.user || null;
    updateAuthDisplay();
  });
}

initApp();
