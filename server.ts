import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import streamifier from "streamifier";

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure Cloudflare R2
const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
  },
});

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
  
  // Upload API using Cloudflare R2
  app.post("/api/upload", upload.single("file"), async (req: any, res) => {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "لم يتم اختيار ملف" });
    }

    if (!process.env.R2_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY || !process.env.R2_BUCKET_NAME) {
      return res.status(500).json({ 
        success: false, 
        message: "إعدادات Cloudflare R2 ناقصة. يرجى إضافة R2_ACCOUNT_ID و R2_ACCESS_KEY_ID و R2_SECRET_ACCESS_KEY و R2_BUCKET_NAME في Vercel." 
      });
    }

    try {
      const timestamp = Date.now();
      const safeOriginalName = req.file.originalname.replace(/[^a-zA-Z0-9.]/g, "_");
      const fileName = `${timestamp}-${safeOriginalName}`;
      
      console.log(`Uploading ${fileName} to bucket ${process.env.R2_BUCKET_NAME}`);

      const uploadParams = {
        Bucket: process.env.R2_BUCKET_NAME,
        Key: fileName,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
      };

      await r2Client.send(new PutObjectCommand(uploadParams));

      // Use public R2 domain or custom worker URL if available
      let publicUrl = "";
      if (process.env.R2_PUBLIC_URL) {
        // Ensure R2_PUBLIC_URL doesn't end with a slash, then append the file name
        const baseUrl = process.env.R2_PUBLIC_URL.replace(/\/$/, "");
        publicUrl = `${baseUrl}/${fileName}`;
      } else {
        // Fallback for standard R2 endpoint (might be rate-limited or require specific setup)
        // Usually the user provides the pub-xxx.r2.dev URL which is the R2_PUBLIC_URL
        publicUrl = `https://pub-${process.env.R2_ACCOUNT_ID}.r2.dev/${fileName}`; 
      }

      res.json({ 
        success: true, 
        url: publicUrl,
        key: fileName
      });
    } catch (error: any) {
      console.error("Cloudflare R2 Upload Error Full:", error);
      res.status(500).json({ 
        success: false, 
        message: `خطأ في الرفع: ${error.message || "حدث خطأ غير متوقع"}. تأكد من صلاحيات التوكن واسم الباكيت.` 
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
