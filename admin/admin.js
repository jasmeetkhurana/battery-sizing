(() => {
  const TOKEN_KEY = "bessAdmin.token";
  let token = sessionStorage.getItem(TOKEN_KEY) || "";
  let categories = [];
  let products = [];
  let activeTab = "products";
  let productFilter = "";

  const el = {
    loginGate: document.getElementById("loginGate"),
    loginToken: document.getElementById("loginToken"),
    loginBtn: document.getElementById("loginBtn"),
    loginError: document.getElementById("loginError"),
    shell: document.getElementById("adminShell"),
    view: document.getElementById("adminView"),
    modalBack: document.getElementById("modalBack"),
    modalBody: document.getElementById("modalBody"),
    toast: document.getElementById("toast"),
    logoutBtn: document.getElementById("logoutBtn")
  };

  function toast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.remove("hidden");
    setTimeout(() => el.toast.classList.add("hidden"), 2200);
  }

  function esc(str) {
    return String(str ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
  }

  async function api(path, options = {}) {
    const res = await fetch(path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "x-admin-token": token,
        ...(options.headers || {})
      }
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Request failed (${res.status})`);
    }
    return res.json();
  }

  // ---------- Auth ----------
  async function attemptLogin(candidate) {
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: candidate })
    });
    if (!res.ok) throw new Error("Invalid admin password");
    token = candidate;
    sessionStorage.setItem(TOKEN_KEY, token);
  }

  function showLogin() {
    el.loginGate.classList.remove("hidden");
    el.shell.classList.add("hidden");
  }

  async function enterAdmin() {
    el.loginGate.classList.add("hidden");
    el.shell.classList.remove("hidden");
    await reloadData();
    render();
  }

  el.loginBtn.addEventListener("click", async () => {
    try {
      await attemptLogin(el.loginToken.value.trim());
      await enterAdmin();
    } catch (e) {
      el.loginError.textContent = e.message;
      el.loginError.classList.remove("hidden");
    }
  });
  el.loginToken.addEventListener("keydown", (e) => {
    if (e.key === "Enter") el.loginBtn.click();
  });

  el.logoutBtn.addEventListener("click", () => {
    token = "";
    sessionStorage.removeItem(TOKEN_KEY);
    showLogin();
  });

  // ---------- Data ----------
  async function reloadData() {
    [categories, products] = await Promise.all([
      api("/api/categories"),
      api("/api/products?includeInactive=1")
    ]);
  }

  // ---------- Tabs ----------
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      activeTab = tab.dataset.tab;
      document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t === tab));
      render();
    });
  });

  function render() {
    if (activeTab === "products") renderProducts();
    if (activeTab === "categories") renderCategories();
    if (activeTab === "submissions") renderSubmissions();
  }

  // ---------- Products ----------
  function specChips(product) {
    const cat = categories.find((c) => c.id === product.categoryId);
    const schema = cat ? cat.specSchema : [];
    return schema
      .map((f) => {
        const v = product.specs[f.key];
        if (v === undefined || v === "" || v === null) return "";
        const shown = f.type === "boolean" ? (v ? "Yes" : "No") : v;
        return `<span class="chip">${esc(f.label)}: ${esc(shown)}${f.unit ? " " + esc(f.unit) : ""}</span>`;
      })
      .filter(Boolean)
      .join("");
  }

  function renderProducts() {
    const list = products.filter((p) => !productFilter || String(p.categoryId) === productFilter);
    el.view.innerHTML = `
      <div class="panel">
        <h2>Product Catalog</h2>
        <div class="toolbar">
          <select id="catFilter">
            <option value="">All categories (${products.length})</option>
            ${categories
              .map(
                (c) =>
                  `<option value="${c.id}" ${String(c.id) === productFilter ? "selected" : ""}>${esc(c.name)} (${products.filter((p) => p.categoryId === c.id).length})</option>`
              )
              .join("")}
          </select>
          <div class="spacer"></div>
          <button id="addProduct" class="btn btn-primary">+ Add Product</button>
        </div>
        <table>
          <thead><tr><th>Category</th><th>Manufacturer</th><th>Model</th><th>Key Specs</th><th>Status</th><th></th></tr></thead>
          <tbody>
            ${list
              .map(
                (p) => `
              <tr>
                <td>${esc(p.categoryName)}</td>
                <td>${esc(p.manufacturer)}</td>
                <td><strong>${esc(p.model)}</strong>${p.datasheetUrl ? `<br/><a href="${esc(p.datasheetUrl)}" target="_blank" class="muted">datasheet</a>` : ""}</td>
                <td><div class="spec-chips">${specChips(p)}</div></td>
                <td><span class="status-pill ${p.active ? "on" : "off"}">${p.active ? "Active" : "Inactive"}</span></td>
                <td>
                  <div class="btn-row">
                    <button class="btn btn-sm editProduct" data-id="${p.id}">Edit</button>
                    <button class="btn btn-sm ${p.active ? "btn-danger" : ""} toggleProduct" data-id="${p.id}">${p.active ? "Deactivate" : "Activate"}</button>
                  </div>
                </td>
              </tr>`
              )
              .join("")}
          </tbody>
        </table>
      </div>`;

    document.getElementById("catFilter").addEventListener("change", (e) => {
      productFilter = e.target.value;
      renderProducts();
    });
    document.getElementById("addProduct").addEventListener("click", () => openProductModal(null));
    el.view.querySelectorAll(".editProduct").forEach((btn) =>
      btn.addEventListener("click", () => openProductModal(products.find((p) => p.id === Number(btn.dataset.id))))
    );
    el.view.querySelectorAll(".toggleProduct").forEach((btn) =>
      btn.addEventListener("click", async () => {
        const p = products.find((x) => x.id === Number(btn.dataset.id));
        try {
          await api(`/api/products/${p.id}`, { method: "PUT", body: JSON.stringify({ active: !p.active }) });
          await reloadData();
          renderProducts();
          toast(`${p.model} ${p.active ? "deactivated" : "activated"}.`);
        } catch (e) {
          toast(e.message);
        }
      })
    );
  }

  function specFieldInput(field, value) {
    const id = `spec_${field.key}`;
    if (field.type === "boolean") {
      return `<div><label>${esc(field.label)}</label><select id="${id}" data-spec="${esc(field.key)}" data-type="boolean">
        <option value="" ${value === undefined || value === "" ? "selected" : ""}>—</option>
        <option value="true" ${value === true ? "selected" : ""}>Yes</option>
        <option value="false" ${value === false ? "selected" : ""}>No</option>
      </select></div>`;
    }
    const type = field.type === "number" ? "number" : "text";
    const unit = field.unit ? ` (${field.unit})` : "";
    return `<div><label>${esc(field.label)}${esc(unit)}</label><input id="${id}" data-spec="${esc(field.key)}" data-type="${field.type}" type="${type}" step="any" value="${value !== undefined && value !== null ? esc(value) : ""}" /></div>`;
  }

  function openProductModal(product) {
    const isEdit = !!product;
    const selectedCatId = product ? product.categoryId : categories[0]?.id;

    function body(catId) {
      const cat = categories.find((c) => c.id === Number(catId));
      const schema = cat ? cat.specSchema : [];
      return `
        <h3>${isEdit ? "Edit Product" : "Add Product"}</h3>
        <div class="form-grid">
          <div class="full"><label>Category</label>
            <select id="pCategory" ${isEdit ? "disabled" : ""}>
              ${categories.map((c) => `<option value="${c.id}" ${c.id === Number(catId) ? "selected" : ""}>${esc(c.name)}</option>`).join("")}
            </select>
          </div>
          <div><label>Manufacturer</label><input id="pManufacturer" value="${esc(product?.manufacturer || "")}" /></div>
          <div><label>Model</label><input id="pModel" value="${esc(product?.model || "")}" /></div>
          <div class="full"><label>Datasheet URL (optional)</label><input id="pDatasheet" value="${esc(product?.datasheetUrl || "")}" /></div>
          ${schema.map((f) => specFieldInput(f, product?.specs?.[f.key])).join("")}
        </div>
        <div class="modal-actions">
          <button id="modalCancel" class="btn">Cancel</button>
          <button id="modalSave" class="btn btn-primary">${isEdit ? "Save changes" : "Create product"}</button>
        </div>`;
    }

    openModal(body(selectedCatId));

    const rebind = () => {
      const catSelect = document.getElementById("pCategory");
      catSelect.addEventListener("change", () => {
        const keep = {
          manufacturer: document.getElementById("pManufacturer").value,
          model: document.getElementById("pModel").value,
          datasheet: document.getElementById("pDatasheet").value
        };
        el.modalBody.innerHTML = body(catSelect.value);
        document.getElementById("pManufacturer").value = keep.manufacturer;
        document.getElementById("pModel").value = keep.model;
        document.getElementById("pDatasheet").value = keep.datasheet;
        rebind();
      });
      document.getElementById("modalCancel").addEventListener("click", closeModal);
      document.getElementById("modalSave").addEventListener("click", async () => {
        const specs = {};
        el.modalBody.querySelectorAll("[data-spec]").forEach((node) => {
          const key = node.dataset.spec;
          const t = node.dataset.type;
          const raw = node.value;
          if (raw === "" || raw === undefined) return;
          if (t === "number") specs[key] = Number(raw);
          else if (t === "boolean") specs[key] = raw === "true";
          else specs[key] = raw;
        });
        const payload = {
          categoryId: Number(document.getElementById("pCategory").value),
          manufacturer: document.getElementById("pManufacturer").value.trim(),
          model: document.getElementById("pModel").value.trim(),
          datasheetUrl: document.getElementById("pDatasheet").value.trim(),
          specs
        };
        if (!payload.manufacturer || !payload.model) return toast("Manufacturer and model are required");
        try {
          if (isEdit) await api(`/api/products/${product.id}`, { method: "PUT", body: JSON.stringify(payload) });
          else await api("/api/products", { method: "POST", body: JSON.stringify(payload) });
          closeModal();
          await reloadData();
          renderProducts();
          toast(isEdit ? "Product updated." : "Product created.");
        } catch (e) {
          toast(e.message);
        }
      });
    };
    rebind();
  }

  // ---------- Categories ----------
  function renderCategories() {
    el.view.innerHTML = `
      <div class="panel">
        <h2>Categories</h2>
        <div class="toolbar">
          <p class="muted">Spec fields drive the product form and configurator display. New equipment types (e.g. wind turbines) can be added here without code changes.</p>
          <div class="spacer"></div>
          <button id="addCategory" class="btn btn-primary">+ Add Category</button>
        </div>
        <table>
          <thead><tr><th>Name</th><th>Key</th><th>Role</th><th>Spec Fields</th><th>Products</th><th></th></tr></thead>
          <tbody>
            ${categories
              .map(
                (c) => `
              <tr>
                <td><strong>${esc(c.name)}</strong></td>
                <td>${esc(c.key)}</td>
                <td>${esc(c.role)}</td>
                <td><div class="spec-chips">${c.specSchema.map((f) => `<span class="chip">${esc(f.label)}${f.unit ? " (" + esc(f.unit) + ")" : ""}</span>`).join("")}</div></td>
                <td>${products.filter((p) => p.categoryId === c.id).length}</td>
                <td><button class="btn btn-sm editCategory" data-id="${c.id}">Edit</button></td>
              </tr>`
              )
              .join("")}
          </tbody>
        </table>
      </div>`;

    document.getElementById("addCategory").addEventListener("click", () => openCategoryModal(null));
    el.view.querySelectorAll(".editCategory").forEach((btn) =>
      btn.addEventListener("click", () => openCategoryModal(categories.find((c) => c.id === Number(btn.dataset.id))))
    );
  }

  const ROLES = [
    { value: "pv_module", label: "PV Module" },
    { value: "pv_inverter", label: "PV Inverter" },
    { value: "mv_station", label: "MV Transformer Station" },
    { value: "battery", label: "Battery / BESS" },
    { value: "pcs", label: "PCS" },
    { value: "other", label: "Other / Future (e.g. wind)" }
  ];

  function schemaRowHtml(field = { key: "", label: "", unit: "", type: "number" }) {
    return `
      <div class="schema-row">
        <input placeholder="key (e.g. powerKw)" class="sKey" value="${esc(field.key)}" />
        <input placeholder="Label" class="sLabel" value="${esc(field.label)}" />
        <input placeholder="Unit" class="sUnit" value="${esc(field.unit)}" />
        <select class="sType">
          ${["number", "text", "boolean"].map((t) => `<option value="${t}" ${field.type === t ? "selected" : ""}>${t}</option>`).join("")}
        </select>
        <button class="btn btn-sm btn-danger sRemove" type="button">×</button>
      </div>`;
  }

  function openCategoryModal(category) {
    const isEdit = !!category;
    openModal(`
      <h3>${isEdit ? "Edit Category" : "Add Category"}</h3>
      <div class="form-grid">
        <div><label>Name</label><input id="cName" value="${esc(category?.name || "")}" /></div>
        <div><label>Key (unique, snake_case)</label><input id="cKey" value="${esc(category?.key || "")}" ${isEdit ? "disabled" : ""} /></div>
        <div class="full"><label>Role (how the configurator treats products in this category)</label>
          <select id="cRole">${ROLES.map((r) => `<option value="${r.value}" ${category?.role === r.value ? "selected" : ""}>${r.label}</option>`).join("")}</select>
        </div>
        <div class="full">
          <label>Spec fields</label>
          <div id="schemaRows">${(category?.specSchema || []).map(schemaRowHtml).join("")}</div>
          <button id="addSchemaRow" class="btn btn-sm" type="button">+ Add spec field</button>
        </div>
      </div>
      <div class="modal-actions">
        <button id="modalCancel" class="btn">Cancel</button>
        <button id="modalSave" class="btn btn-primary">${isEdit ? "Save changes" : "Create category"}</button>
      </div>`);

    const rowsBox = document.getElementById("schemaRows");
    const bindRemove = () => {
      rowsBox.querySelectorAll(".sRemove").forEach((btn) => {
        btn.onclick = () => btn.closest(".schema-row").remove();
      });
    };
    bindRemove();
    document.getElementById("addSchemaRow").addEventListener("click", () => {
      rowsBox.insertAdjacentHTML("beforeend", schemaRowHtml());
      bindRemove();
    });
    document.getElementById("modalCancel").addEventListener("click", closeModal);
    document.getElementById("modalSave").addEventListener("click", async () => {
      const specSchema = Array.from(rowsBox.querySelectorAll(".schema-row"))
        .map((row) => ({
          key: row.querySelector(".sKey").value.trim(),
          label: row.querySelector(".sLabel").value.trim(),
          unit: row.querySelector(".sUnit").value.trim(),
          type: row.querySelector(".sType").value
        }))
        .filter((f) => f.key && f.label);
      const payload = {
        name: document.getElementById("cName").value.trim(),
        key: document.getElementById("cKey").value.trim(),
        role: document.getElementById("cRole").value,
        specSchema
      };
      if (!payload.name || !payload.key) return toast("Name and key are required");
      try {
        if (isEdit) await api(`/api/categories/${category.id}`, { method: "PUT", body: JSON.stringify(payload) });
        else await api("/api/categories", { method: "POST", body: JSON.stringify(payload) });
        closeModal();
        await reloadData();
        renderCategories();
        toast(isEdit ? "Category updated." : "Category created.");
      } catch (e) {
        toast(e.message);
      }
    });
  }

  // ---------- Submissions ----------
  async function renderSubmissions() {
    let subs = [];
    try {
      subs = await api("/api/submissions");
    } catch (e) {
      el.view.innerHTML = `<div class="panel"><p class="muted">${esc(e.message)}</p></div>`;
      return;
    }
    el.view.innerHTML = `
      <div class="panel">
        <h2>Submissions</h2>
        ${
          subs.length === 0
            ? '<p class="muted">No submissions yet. Completed solution designs submitted from the app will appear here.</p>'
            : `<table>
          <thead><tr><th>ID</th><th>Date</th><th>Company</th><th>Site</th><th></th></tr></thead>
          <tbody>
            ${subs
              .map(
                (s) => `
              <tr>
                <td>${s.id}</td>
                <td>${new Date(s.createdAt).toLocaleString()}</td>
                <td>${esc(s.companyName)}</td>
                <td>${esc(s.siteName)}</td>
                <td><button class="btn btn-sm viewSub" data-id="${s.id}">View</button></td>
              </tr>`
              )
              .join("")}
          </tbody>
        </table>`
        }
      </div>`;

    el.view.querySelectorAll(".viewSub").forEach((btn) =>
      btn.addEventListener("click", async () => {
        try {
          const detail = await api(`/api/submissions/${btn.dataset.id}`);
          openModal(`
            <h3>Submission #${detail.id} — ${esc(detail.companyName)} / ${esc(detail.siteName)}</h3>
            <pre>${esc(JSON.stringify(detail.payload, null, 2))}</pre>
            <div class="modal-actions"><button id="modalCancel" class="btn">Close</button></div>`);
          document.getElementById("modalCancel").addEventListener("click", closeModal);
        } catch (e) {
          toast(e.message);
        }
      })
    );
  }

  // ---------- Modal ----------
  function openModal(html) {
    el.modalBody.innerHTML = html;
    el.modalBack.classList.remove("hidden");
  }
  function closeModal() {
    el.modalBack.classList.add("hidden");
    el.modalBody.innerHTML = "";
  }
  el.modalBack.addEventListener("click", (e) => {
    if (e.target === el.modalBack) closeModal();
  });

  // ---------- Boot ----------
  (async () => {
    if (token) {
      try {
        await attemptLogin(token);
        await enterAdmin();
        return;
      } catch (_) {
        token = "";
        sessionStorage.removeItem(TOKEN_KEY);
      }
    }
    showLogin();
  })();
})();
