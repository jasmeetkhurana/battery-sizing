const path = require("path");
const express = require("express");
const db = require("./db");

const PORT = process.env.PORT || 3000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "loop-admin";

const app = express();
app.use(express.json({ limit: "5mb" }));

const ROOT = path.join(__dirname, "..");
app.use(express.static(ROOT, { index: "index.html" }));
app.use("/admin", express.static(path.join(ROOT, "admin"), { index: "index.html" }));

function requireAdmin(req, res, next) {
  const token = req.headers["x-admin-token"];
  if (token !== ADMIN_TOKEN) return res.status(401).json({ error: "Unauthorized" });
  next();
}

function parseCategory(row) {
  return { ...row, specSchema: JSON.parse(row.specSchema) };
}

function parseProduct(row) {
  return { ...row, specs: JSON.parse(row.specs), active: !!row.active };
}

// ---- Auth check (used by admin UI login) ----
app.post("/api/admin/login", (req, res) => {
  if ((req.body || {}).token === ADMIN_TOKEN) return res.json({ ok: true });
  res.status(401).json({ error: "Invalid admin password" });
});

// ---- Categories ----
app.get("/api/categories", (req, res) => {
  const rows = db.prepare("SELECT * FROM categories ORDER BY name").all();
  res.json(rows.map(parseCategory));
});

app.post("/api/categories", requireAdmin, (req, res) => {
  const { key, name, role, specSchema } = req.body || {};
  if (!key || !name || !role) return res.status(400).json({ error: "key, name and role are required" });
  try {
    const info = db
      .prepare("INSERT INTO categories (key, name, role, specSchema) VALUES (?, ?, ?, ?)")
      .run(String(key).trim(), String(name).trim(), String(role).trim(), JSON.stringify(specSchema || []));
    const row = db.prepare("SELECT * FROM categories WHERE id = ?").get(info.lastInsertRowid);
    res.status(201).json(parseCategory(row));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.put("/api/categories/:id", requireAdmin, (req, res) => {
  const existing = db.prepare("SELECT * FROM categories WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Category not found" });
  const { key, name, role, specSchema } = req.body || {};
  db.prepare("UPDATE categories SET key = ?, name = ?, role = ?, specSchema = ? WHERE id = ?").run(
    key || existing.key,
    name || existing.name,
    role || existing.role,
    specSchema ? JSON.stringify(specSchema) : existing.specSchema,
    req.params.id
  );
  res.json(parseCategory(db.prepare("SELECT * FROM categories WHERE id = ?").get(req.params.id)));
});

// ---- Products ----
app.get("/api/products", (req, res) => {
  const { categoryId, includeInactive } = req.query;
  let sql = "SELECT p.*, c.key AS categoryKey, c.name AS categoryName, c.role AS categoryRole FROM products p JOIN categories c ON c.id = p.categoryId";
  const where = [];
  const params = [];
  if (!includeInactive) where.push("p.active = 1");
  if (categoryId) {
    where.push("p.categoryId = ?");
    params.push(categoryId);
  }
  if (where.length) sql += " WHERE " + where.join(" AND ");
  sql += " ORDER BY c.name, p.manufacturer, p.model";
  res.json(db.prepare(sql).all(...params).map(parseProduct));
});

app.post("/api/products", requireAdmin, (req, res) => {
  const { categoryId, manufacturer, model, specs, datasheetUrl } = req.body || {};
  if (!categoryId || !manufacturer || !model) {
    return res.status(400).json({ error: "categoryId, manufacturer and model are required" });
  }
  const cat = db.prepare("SELECT id FROM categories WHERE id = ?").get(categoryId);
  if (!cat) return res.status(400).json({ error: "Unknown categoryId" });
  const info = db
    .prepare("INSERT INTO products (categoryId, manufacturer, model, specs, datasheetUrl, active) VALUES (?, ?, ?, ?, ?, 1)")
    .run(categoryId, manufacturer.trim(), model.trim(), JSON.stringify(specs || {}), datasheetUrl || "");
  const row = db
    .prepare(
      "SELECT p.*, c.key AS categoryKey, c.name AS categoryName, c.role AS categoryRole FROM products p JOIN categories c ON c.id = p.categoryId WHERE p.id = ?"
    )
    .get(info.lastInsertRowid);
  res.status(201).json(parseProduct(row));
});

app.put("/api/products/:id", requireAdmin, (req, res) => {
  const existing = db.prepare("SELECT * FROM products WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Product not found" });
  const { categoryId, manufacturer, model, specs, datasheetUrl, active } = req.body || {};
  db.prepare(
    "UPDATE products SET categoryId = ?, manufacturer = ?, model = ?, specs = ?, datasheetUrl = ?, active = ? WHERE id = ?"
  ).run(
    categoryId || existing.categoryId,
    manufacturer !== undefined ? manufacturer : existing.manufacturer,
    model !== undefined ? model : existing.model,
    specs !== undefined ? JSON.stringify(specs) : existing.specs,
    datasheetUrl !== undefined ? datasheetUrl : existing.datasheetUrl,
    active !== undefined ? (active ? 1 : 0) : existing.active,
    req.params.id
  );
  const row = db
    .prepare(
      "SELECT p.*, c.key AS categoryKey, c.name AS categoryName, c.role AS categoryRole FROM products p JOIN categories c ON c.id = p.categoryId WHERE p.id = ?"
    )
    .get(req.params.id);
  res.json(parseProduct(row));
});

app.delete("/api/products/:id", requireAdmin, (req, res) => {
  const existing = db.prepare("SELECT * FROM products WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Product not found" });
  db.prepare("UPDATE products SET active = 0 WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

// ---- Submissions ----
app.post("/api/submissions", (req, res) => {
  const payload = req.body;
  if (!payload || typeof payload !== "object") return res.status(400).json({ error: "Invalid payload" });
  const companyName = payload.contact?.companyName || payload.profile?.companyName || "";
  const siteName = payload.site?.siteName || payload.profile?.siteName || "";
  const info = db
    .prepare("INSERT INTO submissions (createdAt, companyName, siteName, payload) VALUES (?, ?, ?, ?)")
    .run(new Date().toISOString(), companyName, siteName, JSON.stringify(payload));
  res.status(201).json({ id: info.lastInsertRowid });
});

app.get("/api/submissions", requireAdmin, (req, res) => {
  const rows = db.prepare("SELECT id, createdAt, companyName, siteName FROM submissions ORDER BY id DESC").all();
  res.json(rows);
});

app.get("/api/submissions/:id", requireAdmin, (req, res) => {
  const row = db.prepare("SELECT * FROM submissions WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Submission not found" });
  res.json({ ...row, payload: JSON.parse(row.payload) });
});

// Seed on first run so `npm start` works out of the box.
const catCount = db.prepare("SELECT COUNT(*) AS n FROM categories").get().n;
if (catCount === 0) {
  require("./seed");
}

app.listen(PORT, () => {
  console.log(`Solar + BESS platform running at http://localhost:${PORT}`);
  console.log(`Admin panel at http://localhost:${PORT}/admin (password: ${ADMIN_TOKEN})`);
});
