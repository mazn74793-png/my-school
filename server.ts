import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure Multer (Memory Storage)
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      r2Configured: !!(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID),
      env: process.env.NODE_ENV
    });
  });

  // Pre-signed URL API for Direct Browser Uploads (Bypasses Vercel Payload Limits)
  app.post("/api/upload/presign", async (req, res) => {
    const { fileName, fileType } = req.body;
    
    if (!fileName) {
      return res.status(400).json({ success: false, message: "اسم الملف مطلوب" });
    }

    const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME } = process.env;

    if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
      return res.status(500).json({ 
        success: false, 
        message: "إعدادات Cloudflare R2 ناقصة." 
      });
    }

    try {
      const r2Client = new S3Client({
        region: "auto",
        endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: R2_ACCESS_KEY_ID,
          secretAccessKey: R2_SECRET_ACCESS_KEY,
        },
      });

      const timestamp = Date.now();
      const safeName = `${timestamp}-${fileName.replace(/[^a-zA-Z0-9.]/g, "_")}`;
      
      const command = new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: safeName,
        ContentType: fileType || "application/octet-stream",
      });

      const signedUrl = await getSignedUrl(r2Client, command, { expiresIn: 3600 });
      
      // Determine final public URL
      let finalPublicUrl = "";
      if (process.env.R2_PUBLIC_URL) {
        const baseUrl = process.env.R2_PUBLIC_URL.replace(/\/$/, "");
        finalPublicUrl = `${baseUrl}/${safeName}`;
      } else {
        finalPublicUrl = `https://pub-${R2_ACCOUNT_ID}.r2.dev/${safeName}`;
      }

      res.json({ 
        success: true, 
        signedUrl, 
        publicUrl: finalPublicUrl,
        key: safeName
      });

    } catch (error: any) {
      console.error("[R2-Presign] Error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Upload API using Cloudflare R2
  app.post("/api/upload", upload.single("file"), async (req: any, res) => {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "لم يتم اختيار ملف" });
    }

    const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME } = process.env;

    if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
      console.error("Missing R2 Environment Variables:", {
        R2_ACCOUNT_ID: !!R2_ACCOUNT_ID,
        R2_ACCESS_KEY_ID: !!R2_ACCESS_KEY_ID,
        R2_SECRET_ACCESS_KEY: !!R2_SECRET_ACCESS_KEY,
        R2_BUCKET_NAME: !!R2_BUCKET_NAME
      });
      return res.status(500).json({ 
        success: false, 
        message: "إعدادات Cloudflare R2 ناقصة. يرجى إضافة ACCOUNT_ID و ACCESS_KEY و SECRET_KEY و BUCKET_NAME في الإعدادات." 
      });
    }

    try {
      const r2Client = new S3Client({
        region: "auto",
        endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: R2_ACCESS_KEY_ID,
          secretAccessKey: R2_SECRET_ACCESS_KEY,
        },
      });

      const timestamp = Date.now();
      const safeOriginalName = req.file.originalname.replace(/[^a-zA-Z0-9.]/g, "_");
      const fileName = `${timestamp}-${safeOriginalName}`;
      
      console.log(`[R2] Attempting upload: ${fileName} to bucket: ${R2_BUCKET_NAME}`);

      const uploadParams = {
        Bucket: R2_BUCKET_NAME,
        Key: fileName,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
      };

      await r2Client.send(new PutObjectCommand(uploadParams));
      console.log(`[R2] Upload successful: ${fileName}`);

      // Construction of Public URL
      let publicUrl = "";
      if (process.env.R2_PUBLIC_URL) {
        // Use the user-provided Public Development URL or Custom Domain
        const baseUrl = process.env.R2_PUBLIC_URL.replace(/\/$/, "");
        publicUrl = `${baseUrl}/${fileName}`;
      } else {
        // Fallback to standard pub-hash.r2.dev format if account ID is provided
        // Note: The "pub-xxx" hash is often different from the Account ID.
        // It is strongly recommended to set R2_PUBLIC_URL in Vercel.
        publicUrl = `https://pub-${R2_ACCOUNT_ID}.r2.dev/${fileName}`;
      }

      res.json({ 
        success: true, 
        url: publicUrl,
        key: fileName
      });
    } catch (error: any) {
      console.error("[R2] Critical Upload Error:", error);
      
      let friendlyMessage = "فشل الرفع على السيرفر (R2 Error)";
      if (error.name === "InvalidAccessKeyId") friendlyMessage = "الـ Access Key ID غير صحيح";
      if (error.name === "SignatureDoesNotMatch") friendlyMessage = "الـ Secret Access Key غير صحيح";
      if (error.name === "NoSuchBucket") friendlyMessage = "اسم الـ Bucket غير موجود في حسابك";
      if (error.code === "ENOTFOUND") friendlyMessage = "لا يمكن الاتصال بـ Cloudflare (تأكد من Account ID)";

      res.status(500).json({ 
        success: false, 
        message: `${friendlyMessage}: ${error.message || ""}`,
        debug: process.env.NODE_ENV !== "production" ? error.stack : undefined
      });
    }
  });

  app.post("/api/contact", (req, res) => {
    const { name, email, message } = req.body;
    console.log(`Received message from ${name} (${email}): ${message}`);
    res.json({ success: true, message: "Message received successfully!" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production serving
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
