
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

$("today").textContent = new Date().toLocaleDateString("id-ID", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric"
});

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

function showMessage(message) {
  alert(message);
}

function setFormLoading(form, loading) {
  const button = form.querySelector('button[type="submit"]');
  if (button) button.disabled = loading;
}

function getItemDetails(item) {
  return [
    item.matkul || "",
    item.deadline ? `Deadline: ${item.deadline}` : "",
    item.deskripsi || "",
    item.file_name
      ? `${item.file_name} · ${formatSize(item.file_size)}`
      : "Belum ada file"
  ].filter(Boolean).join(" · ");
}

// Ambil data dari database Supabase
async function loadItems(type) {
  const { data: rows, error } = await supabaseClient
    .from("academic_items")
    .select("*")
    .eq("type", type)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Gagal mengambil data:", error);
    showMessage(
      `Gagal memuat ${type}. Periksa URL, key, tabel, dan kebijakan Supabase.`
    );
    return;
  }

  data[type] = rows || [];
  render(type);
}

// Tampilkan data di halaman
function render(type) {
  const container = $(type + "-list");
  if (!container) return;

  container.innerHTML = "";

  if (data[type].length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent =
      `Belum ada ${type === "materi" ? "materi" : type === "tugas" ? "tugas" : "projek"}. Tambahkan data pertamamu di atas ♡`;
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
    heading.textContent = item.nama;

    const detail = document.createElement("p");
    detail.textContent = getItemDetails(item);

    info.append(heading, detail);

    const actions = document.createElement("div");
    actions.className = "file-actions";

    if (item.file_path) {
      const download = document.createElement("button");
      download.type = "button";
      download.textContent = "Unduh";

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
          showMessage("File gagal dibuka. Periksa pengaturan Storage.");
        } finally {
          download.disabled = false;
        }
      });

      actions.append(download);
    }

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "delete-button";
    remove.textContent = "Hapus";

    remove.addEventListener("click", async () => {
      if (!confirm("Yakin ingin menghapus data ini?")) return;

      remove.disabled = true;

      try {
        // Hapus file dari Storage jika ada
        if (item.file_path) {
          const { error: storageError } = await supabaseClient
            .storage
            .from(STORAGE_BUCKET)
            .remove([item.file_path]);

          if (storageError) throw storageError;
        }

        // Hapus catatan dari database
        const { error: deleteError } = await supabaseClient
          .from("academic_items")
          .delete()
          .eq("id", item.id)
          .eq("type", type);

        if (deleteError) throw deleteError;

        await loadItems(type);
      } catch (error) {
        console.error(error);
        showMessage("Data gagal dihapus. Periksa kebijakan database dan Storage.");
        remove.disabled = false;
      }
    });

    actions.append(remove);
    card.append(icon, info, actions);
    container.append(card);
  });

  const count = $(type + "-count");
  if (count) count.textContent = data[type].length;
}

// Simpan catatan dan upload file
async function addItem(type, item, file) {
  let filePath = null;

  try {
    if (file) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      filePath = `${type}/${crypto.randomUUID()}-${safeName}`;

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

    // Jika upload berhasil tetapi penyimpanan catatan gagal,
    // coba hapus file agar tidak tertinggal.
    if (filePath) {
      await supabaseClient.storage
        .from(STORAGE_BUCKET)
        .remove([filePath]);
    }

    showMessage(
      "Data gagal disimpan. Periksa koneksi, tabel, bucket, dan kebijakan Supabase."
    );
    return false;
  }
}

// Form Materi Kuliah
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

// Form Tugas
$("tugas-form").addEventListener("submit", async (event) => {
  event.preventDefault();

  const form = event.currentTarget;
  const file = $("tugas-file").files[0] || null;

  setFormLoading(form, true);

  const success = await addItem("tugas", {
    nama: $("tugas-nama").value.trim(),
    matkul: $("tugas-matkul").value.trim(),
    deadline: $("tugas-deadline").value
  }, file);

  if (success) form.reset();
  setFormLoading(form, false);
});

// Form Projek
$("projek-form").addEventListener("submit", async (event) => {
  event.preventDefault();

  const form = event.currentTarget;
  const file = $("projek-file").files[0] || null;

  setFormLoading(form, true);

  const success = await addItem("projek", {
    nama: $("projek-nama").value.trim(),
    deskripsi: $("projek-deskripsi").value.trim()
  }, file);

  if (success) form.reset();
  setFormLoading(form, false);
});

// Navigasi sidebar
document.querySelectorAll(".nav-link").forEach((link) => {
  link.addEventListener("click", () => {
    document.querySelectorAll(".nav-link").forEach((item) => {
      item.classList.remove("active");
    });

    link.classList.add("active");
  });
});

// Muat semua data saat halaman dibuka
async function initApp() {
  await Promise.all([
    loadItems("materi"),
    loadItems("tugas"),
    loadItems("projek")
  ]);
}

initApp();
