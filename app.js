const API = "https://api.escuelajs.co/api/v1/products";

let products = [];
let filtered = [];

let page = 1;
let pageSize = 10;

let sortField = "";
let sortAsc = true;

let debounceTimer = null;

const $ = (id) => document.getElementById(id);

const els = {
  tbody: $("tbody"),
  pagination: $("pagination"),
  rangeInfo: $("rangeInfo"),
  countInfo: $("countInfo"),

  searchInput: $("searchInput"),
  pageSize: $("pageSize"),

  thTitle: $("thTitle"),
  thPrice: $("thPrice"),
  sortTitle: $("sortTitle"),
  sortPrice: $("sortPrice"),

  btnExport: $("btnExport"),

  // detail/edit
  editId: $("editId"),
  editTitle: $("editTitle"),
  editPrice: $("editPrice"),
  editDesc: $("editDesc"),
  editCategory: $("editCategory"),
  editImage: $("editImage"),
  btnSave: $("btnSave"),

  // create
  newTitle: $("newTitle"),
  newPrice: $("newPrice"),
  newDesc: $("newDesc"),
  newCategoryId: $("newCategoryId"),
  newImages: $("newImages"),
  btnCreate: $("btnCreate"),
};

const detailModal = new bootstrap.Modal(document.getElementById("detailModal"));
const createModal = new bootstrap.Modal(document.getElementById("createModal"));

const toast = new bootstrap.Toast(document.getElementById("toast"), { delay: 2300 });
const toastBody = $("toastBody");
function showToast(msg) { toastBody.textContent = msg; toast.show(); }

function safeImg(url) {
  return (url && String(url).startsWith("http")) ? url : "https://placehold.co/80x80?text=No+Img";
}

/**
 * Lọc nội dung "xấu" để tránh hiện trên dashboard khi demo/nộp.
 * (API này là public, nhiều người tạo sản phẩm bừa => nên lọc)
 */
function isSafeText(s) {
  const t = String(s || "").toLowerCase();
  const banned = [
    "adult", "sex", "porn", "nude", "toy", "xxx",
    // có thể thêm từ khóa khác nếu cần
  ];
  return !banned.some(k => t.includes(k));
}

function sanitizeData(list) {
  return list.filter(p =>
    isSafeText(p.title) && isSafeText(p.description)
  );
}

async function loadData() {
  els.countInfo.textContent = "Loading...";
  try {
    const res = await fetch(API);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();

    products = sanitizeData(data);
    filtered = [...products];

    page = 1;
    applySearchSort();
    render();
  } catch (e) {
    console.error(e);
    els.countInfo.textContent = "Không tải được dữ liệu.";
    showToast("Lỗi API hoặc mạng!");
  }
}

function applySearchSort() {
  const q = (els.searchInput.value || "").trim().toLowerCase();

  filtered = products.filter(p =>
    String(p.title || "").toLowerCase().includes(q)
  );

  if (sortField) {
    filtered.sort((a, b) => {
      const av = a?.[sortField];
      const bv = b?.[sortField];

      if (typeof av === "string" && typeof bv === "string") {
        return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      }

      const an = Number(av ?? 0);
      const bn = Number(bv ?? 0);
      return sortAsc ? an - bn : bn - an;
    });
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  if (page > totalPages) page = totalPages;
  if (page < 1) page = 1;
}

function updateSortIcons() {
  els.sortTitle.textContent = "⬍";
  els.sortPrice.textContent = "⬍";

  if (sortField === "title") els.sortTitle.textContent = sortAsc ? "▲" : "▼";
  if (sortField === "price") els.sortPrice.textContent = sortAsc ? "▲" : "▼";
}

function render() {
  updateSortIcons();

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  const end = Math.min(start + pageSize, total);
  const view = filtered.slice(start, end);

  els.countInfo.textContent = `Showing ${total} items`;
  els.rangeInfo.textContent = total ? `Items ${start + 1}-${end} / ${total}` : `No data`;

  els.tbody.innerHTML = "";
  view.forEach(p => {
    const tr = document.createElement("tr");
    tr.className = "row-hover";
    // hover hiện description:
    tr.title = p.description || "";

    const img = safeImg(p?.images?.[0]);
    const cate = p?.category?.name || "";

    tr.innerHTML = `
      <td>${p.id ?? ""}</td>
      <td>${p.title ?? ""}</td>
      <td>${p.price ?? ""}</td>
      <td>${cate}</td>
      <td>
        <img class="img-thumb" src="${img}"
             onerror="this.src='https://placehold.co/80x80?text=No+Img'" />
      </td>
    `;

    tr.addEventListener("click", () => openDetail(p.id));
    els.tbody.appendChild(tr);
  });

  renderPagination(totalPages);
}

function renderPagination(totalPages) {
  const ul = els.pagination;
  ul.innerHTML = "";

  const addItem = (label, disabled, active, onClick) => {
    const li = document.createElement("li");
    li.className = `page-item ${disabled ? "disabled" : ""} ${active ? "active" : ""}`;
    const a = document.createElement("a");
    a.className = "page-link";
    a.href = "javascript:void(0)";
    a.textContent = label;
    if (!disabled) a.addEventListener("click", onClick);
    li.appendChild(a);
    ul.appendChild(li);
  };

  addItem("Prev", page === 1, false, () => { page--; render(); });

  const windowSize = 5;
  let start = Math.max(1, page - windowSize);
  let end = Math.min(totalPages, page + windowSize);

  if (start > 1) addItem("1", false, page === 1, () => { page = 1; render(); });
  if (start > 2) addItem("…", true, false, () => {});

  for (let i = start; i <= end; i++) {
    addItem(String(i), false, i === page, () => { page = i; render(); });
  }

  if (end < totalPages - 1) addItem("…", true, false, () => {});
  if (end < totalPages) addItem(String(totalPages), false, page === totalPages, () => { page = totalPages; render(); });

  addItem("Next", page === totalPages, false, () => { page++; render(); });
}

// ===== Search onChange + debounce =====
els.searchInput.addEventListener("input", () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    page = 1;
    applySearchSort();
    render();
  }, 250);
});

// ===== Page size =====
els.pageSize.addEventListener("change", (e) => {
  pageSize = Number(e.target.value);
  page = 1;
  applySearchSort();
  render();
});

// ===== Sort =====
els.thTitle.addEventListener("click", () => toggleSort("title"));
els.thPrice.addEventListener("click", () => toggleSort("price"));

function toggleSort(field) {
  if (sortField === field) sortAsc = !sortAsc;
  else { sortField = field; sortAsc = true; }
  applySearchSort();
  render();
}

// ===== Export CSV: chỉ export VIEW hiện tại =====
els.btnExport.addEventListener("click", () => exportCSV());

function exportCSV() {
  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const end = Math.min(start + pageSize, total);
  const view = filtered.slice(start, end);

  let csv = "id,title,price,category,image\n";
  view.forEach(p => {
    const row = [
      p.id ?? "",
      `"${String(p.title ?? "").replaceAll('"', '""')}"`,
      p.price ?? "",
      `"${String(p?.category?.name ?? "").replaceAll('"', '""')}"`,
      `"${String(p?.images?.[0] ?? "").replaceAll('"', '""')}"`
    ];
    csv += row.join(",") + "\n";
  });

  // BOM cho Excel
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "products_view.csv";
  a.click();

  showToast("Đã export CSV theo trang đang hiển thị.");
}

// ===== Detail/Edit =====
function clearInvalidEdit() {
  [els.editTitle, els.editPrice, els.editDesc].forEach(x => x.classList.remove("is-invalid"));
}

function validateEdit() {
  let ok = true;
  const title = (els.editTitle.value || "").trim();
  const price = Number(els.editPrice.value);
  const desc = (els.editDesc.value || "").trim();

  if (title.length < 3) { els.editTitle.classList.add("is-invalid"); ok = false; }
  if (!Number.isFinite(price) || price <= 0) { els.editPrice.classList.add("is-invalid"); ok = false; }
  if (desc.length < 5) { els.editDesc.classList.add("is-invalid"); ok = false; }

  return ok;
}

function openDetail(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;

  clearInvalidEdit();

  els.editId.value = p.id ?? "";
  els.editTitle.value = p.title ?? "";
  els.editPrice.value = p.price ?? "";
  els.editDesc.value = p.description ?? "";
  els.editCategory.value = p?.category?.name ?? "";
  els.editImage.value = p?.images?.[0] ?? "";

  detailModal.show();
}

els.btnSave.addEventListener("click", updateProduct);

async function updateProduct() {
  clearInvalidEdit();
  if (!validateEdit()) return;

  const id = els.editId.value;

  try {
    const res = await fetch(`${API}/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: els.editTitle.value.trim(),
        price: Number(els.editPrice.value),
        description: els.editDesc.value.trim(),
      })
    });

    if (!res.ok) throw new Error("HTTP " + res.status);

    showToast("Cập nhật thành công (PUT).");
    detailModal.hide();
    await loadData();
  } catch (e) {
    console.error(e);
    showToast("Update thất bại (API có thể chặn PUT).");
  }
}

// ===== Create =====
function clearInvalidCreate() {
  [els.newTitle, els.newPrice, els.newDesc].forEach(x => x.classList.remove("is-invalid"));
}

function validateCreate() {
  let ok = true;
  const title = (els.newTitle.value || "").trim();
  const price = Number(els.newPrice.value);
  const desc = (els.newDesc.value || "").trim();

  if (title.length < 3) { els.newTitle.classList.add("is-invalid"); ok = false; }
  if (!Number.isFinite(price) || price <= 0) { els.newPrice.classList.add("is-invalid"); ok = false; }
  if (desc.length < 5) { els.newDesc.classList.add("is-invalid"); ok = false; }

  return ok;
}

els.btnCreate.addEventListener("click", createProduct);

async function createProduct() {
  clearInvalidCreate();
  if (!validateCreate()) return;

  const raw = (els.newImages.value || "").trim();
  const images = raw
    ? raw.split("\n").map(s => s.trim()).filter(Boolean)
    : ["https://placehold.co/640x480?text=New+Product"];

  const payload = {
    title: els.newTitle.value.trim(),
    price: Number(els.newPrice.value),
    description: els.newDesc.value.trim(),
    categoryId: Number(els.newCategoryId.value || 1),
    images
  };

  try {
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error("HTTP " + res.status);

    showToast("Tạo mới thành công (POST).");
    createModal.hide();

    // reset form
    els.newTitle.value = "";
    els.newPrice.value = "";
    els.newDesc.value = "";
    els.newCategoryId.value = 1;
    els.newImages.value = "";

    await loadData();
  } catch (e) {
    console.error(e);
    showToast("Create thất bại (API có thể chặn POST).");
  }
}

// init
loadData();
