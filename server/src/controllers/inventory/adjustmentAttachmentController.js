import multer from 'multer';
import path from 'path';
import { query } from '../../database/connection.js';
import storageService from '../../services/storage/storageService.js';

export const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.pdf' && file.mimetype === 'application/pdf') return cb(null, true);
    return cb(new Error('Only PDF files are allowed'));
  },
  limits: { fileSize: Number(process.env.MAX_FILE_SIZE || 10 * 1024 * 1024) }
});

export async function attach(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ success: false, message: 'Invalid adjustment ID' });
    if (!req.file) return res.status(400).json({ success: false, message: 'PDF file is required' });

    const safeName = (req.file.originalname || 'attachment.pdf').replace(/[^a-zA-Z0-9_.-]/g, '_');
    const key = `adjustments/${id}/${Date.now()}_${safeName}`;
    const saved = await storageService.save(req.file.buffer, key, req.file.mimetype);

    await query(`UPDATE inventory_adjustments
                 SET attachment_path = $1,
                     attachment_name = $2,
                     attachment_mime = $3,
                     attachment_size = $4,
                     updated_at = NOW(),
                     updated_by = $5
                 WHERE id = $6`, [saved.key, req.file.originalname, req.file.mimetype, req.file.size, req.user.id, id]);
    res.json({ success: true, message: 'Attachment uploaded', data: { path: saved.key, name: req.file.originalname, size: req.file.size } });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message || 'Upload failed' });
  }
}

export async function get(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ success: false, message: 'Invalid adjustment ID' });
    const { rows } = await query('SELECT attachment_path, attachment_name, attachment_mime FROM inventory_adjustments WHERE id = $1', [id]);
    if (rows.length === 0 || !rows[0].attachment_path) return res.status(404).json({ success: false, message: 'No attachment' });
    const { attachment_path: p, attachment_name: name, attachment_mime: mime } = rows[0];

    const filename = (name || 'attachment.pdf').replace(/"/g, '');
    res.setHeader('Content-Type', mime || 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);

    if (p.startsWith('uploads/') || path.isAbsolute(p)) {
      return res.sendFile(path.resolve(p));
    }

    try {
      const stream = await storageService.getStream(p);
      stream.on('error', (err) => {
        console.error('Error streaming adjustment attachment', err);
        if (!res.headersSent) {
          res.status(500).json({ success: false, message: 'Failed to read attachment' });
        } else {
          res.end();
        }
      });
      return stream.pipe(res);
    } catch (err) {
      console.error('Error fetching adjustment attachment from storage', err);
      return res.status(500).json({ success: false, message: 'Failed to fetch attachment' });
    }
  } catch (e) {
    res.status(500).json({ success: false, message: e.message || 'Failed to fetch attachment' });
  }
}


