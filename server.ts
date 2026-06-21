import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { MercadoPagoConfig, Preference } from "mercadopago";
import jwt from "jsonwebtoken";
import admin from "firebase-admin";

dotenv.config();

// --- Final Polish for production runtime ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const firebaseConfigPath = path.join(process.cwd(), "firebase-applet-config.json");
const firebaseConfig = fs.existsSync(firebaseConfigPath) ? JSON.parse(fs.readFileSync(firebaseConfigPath, "utf8")) : {};

// --- Environment Variables ---
const MP_ACCESS_TOKEN = process.env.MERCADO_PAGO_ACCESS_TOKEN;
const JWT_SECRET = process.env.JWT_SECRET || "amarena_fallback_secret_2025";
const ADMIN_USER = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASS = process.env.ADMIN_PASSWORD || "ADMIN123";

console.log("[Amarena] Starting startup sequence...");

// --- Lazy Initialization of Firebase Admin ---
let adminInitialized = false;

function initFirebaseAdmin() {
  if (!adminInitialized) {
    try {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: firebaseConfig.projectId || "amarena-sorvetes"
      });
      adminInitialized = true;
      console.log("[Amarena] Firebase Admin initialized.");
    } catch (err) {
      console.warn("[Amarena] Firebase Admin failed to initialize. Push notifications might not work.", err);
    }
  }
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
  console.log("  - MP Status:", MP_ACCESS_TOKEN ? "Token Provided" : "Token MISSING");
  console.log("  - ENV:", process.env.NODE_ENV || "development");

  // IMMEDIATELY START LISTENING to satisfy health checks
  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Amarena] Listening on port ${PORT} (satisfying health checks)`);
  });

  app.use(cors());
  app.use(express.json({ limit: "10mb" }));

  app.get("/api/health", async (_req, res) => {
    res.json({ status: "ok", mode: process.env.NODE_ENV || "development" });
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

  // Push Notifications
  app.post("/api/admin/push-notification", authenticateAdmin, async (req, res) => {
    try {
      initFirebaseAdmin();
      const { title, body } = req.body;
      
      const firestore = admin.firestore();
      const snapshot = await firestore.collection("pushTokens").get();
      const registrationTokens = snapshot.docs.map(doc => doc.data().token);

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
            success: `${process.env.APP_URL || ''}/success`,
            failure: `${process.env.APP_URL || ''}/failure`,
            pending: `${process.env.APP_URL || ''}/pending`
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
      process.exit(0);
    });
  });
}

startServer().catch(err => {
  console.error("Critical error starting server:", err);
  process.exit(1);
});
