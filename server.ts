import dotenv from "dotenv";
dotenv.config();
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";

console.log("[Server] Starting with PID:", process.pid);

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure Multer (Memory Storage)
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit for videos
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  
  // Request logging middleware
  app.use((req, res, next) => {
    if (req.url.startsWith("/api")) {
      console.log(`[API Request] ${req.method} ${req.url}`);
    }
    next();
  });
  
  app.get("/api/health", (req, res) => {
    console.log("[Health] Checking system status...");
    const config = {
      cloud: !!process.env.CLOUDINARY_CLOUD_NAME,
      key: !!process.env.CLOUDINARY_API_KEY,
      secret: !!process.env.CLOUDINARY_API_SECRET
    };
    console.log("[Health] Config status:", config);
    res.json({ 
      status: "ok", 
      cloudinaryConfigured: config.cloud && config.key && config.secret,
      env: process.env.NODE_ENV
    });
  });

  // Cloudinary Upload API
  app.post("/api/upload", upload.single("file"), async (req: any, res) => {
    console.log("[Upload] Route hit");
    if (!req.file) {
      console.error("[Upload] No file provided");
      return res.status(400).json({ success: false, message: "لم يتم اختيار ملف" });
    }

    console.log(`[Upload] Received file: ${req.file.originalname} (${req.file.size} bytes)`);

    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      console.error("[Upload] Missing Cloudinary environment variables");
      return res.status(500).json({ 
        success: false, 
        message: "إعدادات Cloudinary ناقصة في السيرفر. تأكد من إضافة المتغيرات في الإعدادات." 
      });
    }

    try {
      console.log(`[Cloudinary] Starting upload...`);
      
      // Upload using a buffer
      const uploadResult = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            resource_type: "auto",
            folder: "school_portfolio",
          },
          (error, result) => {
            if (error) {
              console.error("[Cloudinary] Upload Stream Error:", error);
              reject(error);
            } else {
              resolve(result);
            }
          }
        );
        uploadStream.end(req.file.buffer);
      });

      const result = uploadResult as any;
      console.log(`[Cloudinary] Upload successful: ${result.secure_url}`);

      res.json({ 
        success: true, 
        url: result.secure_url,
        public_id: result.public_id
      });
    } catch (error: any) {
      console.error("[Cloudinary] Critical Upload Catch:", error);
      res.status(500).json({ 
        success: false, 
        message: `خطأ أثناء الرفع: ${error.message || "فشل غير معروف"}` 
      });
    }
  });

  app.post("/api/contact", (req, res) => {
    const { name, email, message } = req.body;
    console.log(`Received message from ${name} (${email}): ${message}`);
    res.json({ success: true, message: "Message received successfully!" });
  });

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    console.log("[Vite] Initializing development server...");
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: { server }
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("[Vite] Ready.");
  } else {
    // Production serving
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
}

startServer();
