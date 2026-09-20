const fs = require("fs");
const path = require("path");
const formidable = require("formidable");
const { query } = require("../../../../lib/db");
const { getUserFromReq } = require("../../../../lib/auth");

export const config = { api: { bodyParser: false } };

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

export default async function handler(req, res) {
  const authUser = getUserFromReq(req);
  if (!authUser) return res.status(401).json({ error: "Not authenticated" });
  const { id } = req.query;

  if (req.method === "POST") {
    if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

    const form = formidable({
      uploadDir: UPLOAD_DIR,
      keepExtensions: true,
      maxFileSize: 100 * 1024 * 1024, // 100MB (notes/ppt/video)
    });

    form.parse(req, async (err, fields, files) => {
      if (err) return res.status(500).json({ error: "Upload failed", details: err.message });

      const file = files.file?.[0] || files.file;
      if (!file) return res.status(400).json({ error: "No file provided" });

      const filename = path.basename(file.filepath);
      const url = `/uploads/${filename}`;

      const result = await query(
        `INSERT INTO session_files (session_id, uploaded_by, filename, url)
         VALUES ($1,$2,$3,$4) RETURNING *`,
        [id, authUser.id, file.originalFilename || filename, url]
      );

      return res.status(201).json({ file: result.rows[0] });
    });
    return;
  }

  if (req.method === "GET") {
    const result = await query("SELECT * FROM session_files WHERE session_id = $1 ORDER BY created_at", [id]);
    return res.status(200).json({ files: result.rows });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
