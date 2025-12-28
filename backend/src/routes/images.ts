import { Router, Request, Response } from 'express';
import * as path from 'path';
import * as fs from 'fs/promises';
import { pool } from '../config/database';

const router = Router();

// Serve image by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT local_path FROM newspaper_images WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Image not found' });
    }

    const imagePath = result.rows[0].local_path;
    const fullPath = path.resolve(imagePath);

    try {
      await fs.access(fullPath);
      res.sendFile(fullPath);
    } catch {
      res.status(404).json({ error: 'Image file not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to serve image' });
  }
});

export default router;

