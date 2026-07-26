import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { MongoClient, ObjectId, Db } from "mongodb";
import { MercadoPagoConfig, Preference } from "mercadopago";
import jwt from "jsonwebtoken";
import admin from "firebase-admin";

dotenv.config();

// --- Final Polish for production runtime ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Environment Variables ---
const MONGO_URL = process.env.MONGO_URL;
const DB_NAME = process.env.DB_NAME || "amarena_db";
const MP_ACCESS_TOKEN = process.env.MERCADO_PAGO_ACCESS_TOKEN;
const JWT_SECRET = process.env.JWT_SECRET || "amarena_fallback_secret_2025";
const ADMIN_USER = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASS = process.env.ADMIN_PASSWORD || "admin123";

console.log("[Amarena] Starting startup sequence...");

// --- Lazy Initialization of Firebase Admin ---
let adminInitialized = false;

function initFirebaseAdmin() {
  if (!adminInitialized) {
    try {
      admin.initializeApp({
        credential: admin.credential.applicationDefault()
      });
      adminInitialized = true;
      console.log("[Amarena] Firebase Admin initialized.");
    } catch (err) {
      console.warn("[Amarena] Firebase Admin failed to initialize. Push notifications might not work.", err);
    }
  }
}

// --- Lazy Initialization of MongoDB ---
let dbClient: MongoClient | null = null;
let database: Db | null = null;
let dbConnectingPromise: Promise<Db> | null = null;

async function getDb() {
  if (database) return database;
  
  if (!dbConnectingPromise) {
    dbConnectingPromise = (async () => {
      try {
        if (!MONGO_URL) {
          throw new Error("MONGO_URL environment variable is not defined. Please set it in AI Studio Settings.");
        }
        console.log("[Amarena] Establishing MongoDB connection...");
        dbClient = new MongoClient(MONGO_URL, {
          maxPoolSize: 10,
          minPoolSize: 2,
          serverSelectionTimeoutMS: 5000,
          connectTimeoutMS: 10000,
        });
        
        await dbClient.connect();
        const db = dbClient.db(DB_NAME);
        database = db;
        
        console.log(`[Amarena] Successfully connected to MongoDB: ${DB_NAME}`);
        return db;
      } catch (error) {
        dbConnectingPromise = null;
        console.error("[Amarena] MongoDB connection error:", error instanceof Error ? error.message : String(error));
        throw error;
      }
    })();
  }
  
  return dbConnectingPromise;
}

// --- Mercado Pago Setup ---
let mpClient: MercadoPagoConfig | null = null;

function getMpClient() {
  if (!mpClient) {
    if (!MP_ACCESS_TOKEN) {
      throw new Error("MERCADO_PAGO_ACCESS_TOKEN environment variable is not defined");
    }
    mpClient = new MercadoPagoConfig({ accessToken: MP_ACCESS_TOKEN });
  }
  return mpClient;
}

// --- Middleware ---
const authenticateAdmin = (req: express.Request & { user?: { username: string; role: string } }, res: express.Response, next: express.NextFunction) => {
  const token = req.headers["authorization"]?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { username: string; role: string };
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  console.log("[Amarena] Initialization Info:");
  console.log("  - DB Status:", MONGO_URL ? "URL Provided" : "URL MISSING");
  console.log("  - MP Status:", MP_ACCESS_TOKEN ? "Token Provided" : "Token MISSING");
  console.log("  - ENV:", process.env.NODE_ENV || "development");

  // IMMEDIATELY START LISTENING to satisfy health checks
  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Amarena] Listening on port ${PORT} (satisfying health checks)`);
  });

  app.use(cors());
  app.use(express.json({ limit: "10mb" }));

  // Pre-connect and ensure indexes in background
  getDb().then(async (db) => {
    try {
      console.log("[Amarena] Ensuring database indexes...");
      await db.collection("products").createIndex({ category: 1 });
      await db.collection("products").createIndex({ active: 1 });
      await db.collection("orders").createIndex({ "clientInfo.phone": 1, createdAt: -1 });
      await db.collection("orders").createIndex({ createdAt: -1 });
      await db.collection("orders").createIndex({ status: 1 });
      await db.collection("pushTokens").createIndex({ token: 1 }, { unique: true });
      console.log("[Amarena] Database indexes ensured.");
    } catch (idxErr) {
      console.warn("[Amarena] Index creation warning:", idxErr instanceof Error ? idxErr.message : String(idxErr));
    }
  }).catch(err => {
    console.warn("[Amarena] Background DB startup failed:", err.message);
  });

  app.get("/api/health", async (_req, res) => {
    try {
      if (database) {
        await database.command({ ping: 1 });
        return res.json({ status: "ok", database: "connected", mode: process.env.NODE_ENV || "development" });
      }
      res.json({ status: "ok", database: "not_connected_yet", mode: process.env.NODE_ENV || "development" });
    } catch (err: unknown) {
      res.status(500).json({ status: "error", error: String(err) });
    }
  });

  // Auth
  app.post("/api/admin/login", async (req, res) => {
    const { username, password } = req.body;
    if (username === ADMIN_USER && password === ADMIN_PASS) {
      const token = jwt.sign({ username, role: "admin" }, JWT_SECRET, { expiresIn: "7d" });
      return res.json({ token, username });
    }
    res.status(401).json({ error: "Credenciais inválidas" });
  });

  // Products
  app.get("/api/products", async (req, res) => {
    try {
      const db = await getDb();
      const products = await db.collection("products").find().toArray();
      res.json(products.map(p => ({ ...p, id: p._id.toString() })));
    } catch (err: unknown) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.post("/api/products", authenticateAdmin, async (req, res) => {
    try {
      const db = await getDb();
      const { name, category, subcategory, price, description, image, active } = req.body;
      const result = await db.collection("products").insertOne({ 
        name, 
        category, 
        subcategory,
        price: parseFloat(price), 
        description, 
        image,
        active: active !== undefined ? active : true,
        createdAt: new Date() 
      });
      res.status(201).json({ id: result.insertedId });
    } catch (err: unknown) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.put("/api/products/:id", authenticateAdmin, async (req, res) => {
    try {
      const db = await getDb();
      const { name, category, subcategory, price, description, image, active } = req.body;
      await db.collection("products").updateOne(
        { _id: new ObjectId(req.params.id) },
        { 
          $set: { 
            name, 
            category, 
            subcategory,
            price: parseFloat(price), 
            description, 
            image,
            active: active !== undefined ? active : true,
            updatedAt: new Date() 
          } 
        }
      );
      res.json({ message: "Produto atualizado" });
    } catch (err: unknown) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.delete("/api/products/:id", authenticateAdmin, async (req, res) => {
    try {
      const db = await getDb();
      await db.collection("products").deleteOne({ _id: new ObjectId(req.params.id) });
      res.json({ message: "Produto removido" });
    } catch (err: unknown) {
      res.status(500).json({ error: String(err) });
    }
  });

  // Push Notifications
  app.post("/api/push-token", async (req, res) => {
    try {
      const db = await getDb();
      const { token } = req.body;
      await db.collection("pushTokens").updateOne(
        { token },
        { $set: { token, updatedAt: new Date() } },
        { upsert: true }
      );
      res.json({ message: "Token registered" });
    } catch(err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.post("/api/admin/push-notification", authenticateAdmin, async (req, res) => {
    try {
      initFirebaseAdmin();
      const db = await getDb();
      const { title, body } = req.body;
      
      const tokens = await db.collection("pushTokens").find().toArray();
      const registrationTokens = tokens.map(t => t.token);

      if (registrationTokens.length > 0) {
        await admin.messaging().sendEachForMulticast({
          tokens: registrationTokens,
          notification: { title, body },
        });
      }
      res.json({ message: "Notificações enviadas" });
    } catch (err: unknown) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.get("/api/orders/user/:phone", async (req, res) => {
    try {
      const db = await getDb();
      const phone = req.params.phone;
      const orders = await db.collection("orders").find({ "clientInfo.phone": phone }).sort({ createdAt: -1 }).toArray();
      res.json(orders.map(o => ({ ...o, id: o._id.toString() })));
    } catch (err: unknown) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.post("/api/orders", async (req, res) => {
    try {
      const db = await getDb();
      const { items, total, deliveryFee, paymentMethod, clientInfo } = req.body;
      const result = await db.collection("orders").insertOne({
        items,
        total,
        deliveryFee,
        paymentMethod,
        clientInfo,
        status: "pending",
        createdAt: new Date()
      });
      res.status(201).json({ id: result.insertedId });
    } catch (err: unknown) {
      res.status(500).json({ error: String(err) });
    }
  });

  // Orders
  app.get("/api/orders/:id/track", async (req, res) => {
    try {
      const db = await getDb();
      const order = await db.collection("orders").findOne(
        { _id: new ObjectId(req.params.id) },
        { projection: { 
          status: 1, 
          deliveryLocation: 1, 
          clientInfo: 1,
          createdAt: 1
        }}
      );
      if (!order) return res.status(404).json({ error: "Pedido não encontrado" });
      res.json(order);
    } catch (err: unknown) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.get("/api/admin/orders", authenticateAdmin, async (req, res) => {
    try {
      const db = await getDb();
      const orders = await db.collection("orders").find().sort({ createdAt: -1 }).toArray();
      res.json(orders.map(o => ({ ...o, id: o._id.toString() })));
    } catch (err: unknown) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.patch("/api/admin/orders/:id", authenticateAdmin, async (req, res) => {
    try {
      const db = await getDb();
      const updateFields: any = {};
      if (req.body.status !== undefined) updateFields.status = req.body.status;
      if (req.body.archived !== undefined) updateFields.archived = req.body.archived;
      updateFields.updatedAt = new Date();

      await db.collection("orders").updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: updateFields }
      );
      res.json({ message: "Pedido atualizado com sucesso" });
    } catch (err: unknown) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.post("/api/admin/orders/archive-completed", authenticateAdmin, async (req, res) => {
    try {
      const db = await getDb();
      const result = await db.collection("orders").updateMany(
        { 
          status: { $in: ["completed", "cancelled"] },
          archived: { $ne: true }
        },
        { $set: { archived: true, updatedAt: new Date() } }
      );
      res.json({ message: "Pedidos arquivados com sucesso", modifiedCount: result.modifiedCount });
    } catch (err: unknown) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.patch("/api/admin/orders/:id/location", authenticateAdmin, async (req, res) => {
    try {
      const db = await getDb();
      const { lat, lng } = req.body;
      await db.collection("orders").updateOne(
        { _id: new ObjectId(req.params.id) },
        { 
          $set: { 
            deliveryLocation: { lat, lng, updatedAt: new Date() },
            status: "shipped" 
          } 
        }
      );
      res.json({ message: "Localização atualizada" });
    } catch (err: unknown) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.get("/api/orders/:id/location", async (req, res) => {
    try {
      const db = await getDb();
      const order = await db.collection("orders").findOne(
        { _id: new ObjectId(req.params.id) },
        { projection: { deliveryLocation: 1, status: 1 } }
      );
      if (!order) return res.status(404).json({ error: "Pedido não encontrado" });
      res.json(order.deliveryLocation || null);
    } catch (err: unknown) {
      res.status(500).json({ error: String(err) });
    }
  });

  // Driver Endpoints (No Admin Auth required to allow them to use their link)
  app.patch("/api/driver/orders/:id/location", async (req, res) => {
    try {
      const db = await getDb();
      const { lat, lng } = req.body;
      await db.collection("orders").updateOne(
        { _id: new ObjectId(req.params.id) },
        { 
          $set: { 
            deliveryLocation: { lat, lng, updatedAt: new Date() },
            status: "shipped" 
          } 
        }
      );
      res.json({ message: "Localização atualizada" });
    } catch (err: unknown) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.patch("/api/driver/orders/:id/status", async (req, res) => {
    try {
      const db = await getDb();
      const { status } = req.body;
      await db.collection("orders").updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: { status } }
      );
      res.json({ message: "Status atualizado" });
    } catch (err: unknown) {
      res.status(500).json({ error: String(err) });
    }
  });

  // Settings
  app.get("/api/settings", async (req, res) => {
    try {
      const db = await getDb();
      console.log("Fetching settings from DB...");
      const settings = await db.collection("settings").findOne({ _id: new ObjectId("000000000000000000000001") });
      console.log("Settings found:", settings);
      if (settings) {
        const rest = { ...settings };
        delete rest._id;
        res.json(rest);
      } else {
        res.json({});
      }
    } catch (err: unknown) {
      console.error("Error fetching settings:", err);
      res.status(500).json({ error: String(err) });
    }
  });

  app.put("/api/settings", authenticateAdmin, async (req, res) => {
    try {
      const db = await getDb();
      const data = { ...req.body };
      delete data._id;
      await db.collection("settings").updateOne(
        { _id: new ObjectId("000000000000000000000001") },
        { $set: data },
        { upsert: true }
      );
      res.json({ message: "Configurações salvas" });
    } catch (err: unknown) {
      res.status(500).json({ error: String(err) });
    }
  });

  // Daily Closings
  app.get("/api/daily-closings", authenticateAdmin, async (req, res) => {
    try {
      const db = await getDb();
      const closings = await db.collection("daily_closings").find().sort({ createdAt: -1 }).limit(30).toArray();
      res.json(closings);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.post("/api/daily-closings", authenticateAdmin, async (req, res) => {
    try {
      const db = await getDb();
      const doc = { ...req.body, createdAt: new Date().toISOString() };
      await db.collection("daily_closings").insertOne(doc);
      res.json({ message: "Fechamento registrado com sucesso" });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // Analytics
  app.post("/api/analytics/visit", async (req, res) => {
    try {
      const db = await getDb();
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      await db.collection("daily_visits").updateOne(
        { date: today },
        { $inc: { count: 1 }, $setOnInsert: { date: today } },
        { upsert: true }
      );
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.get("/api/analytics/stats", authenticateAdmin, async (req, res) => {
    try {
      const db = await getDb();
      const today = new Date().toISOString().split('T')[0];
      const todayStats = await db.collection("daily_visits").findOne({ date: today });
      const totalVisits = await db.collection("daily_visits").aggregate([
        { $group: { _id: null, total: { $sum: "$count" } } }
      ]).toArray();
      
      const totalOrders = await db.collection("orders").countDocuments();
      const totalClients = (await db.collection("orders").distinct("clientInfo.phone")).length;

      res.json({
        todayVisits: todayStats ? todayStats.count : 0,
        totalVisits: totalVisits[0] ? totalVisits[0].total : 0,
        totalOrders,
        totalClients
      });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // Mercado Pago
  app.post("/api/payment/create-preference", async (req, res) => {
    try {
      const { items, external_reference } = req.body;
      const client = getMpClient();
      const preference = new Preference(client);
      
      const response = await preference.create({
        body: {
          items: items.map((item: { name: string; quantity: number; price: number }) => ({
            title: item.name,
            quantity: item.quantity,
            unit_price: item.price,
            currency_id: "BRL"
          })),
          external_reference,
          back_urls: {
            success: `${process.env.APP_URL}/success`,
            failure: `${process.env.APP_URL}/failure`,
            pending: `${process.env.APP_URL}/pending`
          },
          auto_return: "approved",
          payment_methods: {
            excluded_payment_types: [{ id: "ticket" }, { id: "bank_transfer" }],
            installments: 12
          }
        }
      });
      res.json({ id: response.id, init_point: response.init_point });
    } catch (err: unknown) {
      res.status(500).json({ error: String(err) });
    }
  });

  // Vite
  if (process.env.NODE_ENV !== "production") {
    try {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
      
      // Ensure 404s are handled as SPA fallback in dev too
      app.get("*", async (req, res, next) => {
        const url = req.originalUrl;
        if (url.startsWith("/api")) return next();
        
        try {
          let template = fs.readFileSync(path.resolve(process.cwd(), "index.html"), "utf-8");
          template = await vite.transformIndexHtml(url, template);
          res.status(200).set({ "Content-Type": "text/html" }).end(template);
        } catch (e) {
          vite.ssrFixStacktrace(e as Error);
          next(e);
        }
      });
    } catch (viteError) {
      console.warn("Failed to load Vite dev server. This is expected in production if built correctly.", viteError);
    }
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html")));
  }

  process.on("SIGINT", () => {
    console.log("[Amarena] Shutting down...");
    server.close(() => {
      if (dbClient) dbClient.close();
      process.exit(0);
    });
  });
}

startServer().catch(err => {
  console.error("Critical error starting server:", err);
  process.exit(1);
});
