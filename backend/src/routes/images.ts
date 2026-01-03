import { Router, Request, Response } from 'express';
import * as path from 'path';
import * as fs from 'fs/promises';
import { pool } from '../config/database';
import { logger } from '../utils/logger';

const router = Router();

// Serve image by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    logger.info(`[Images API] Requesting image ID: ${id}`);
    
    const result = await pool.query(
      'SELECT local_path, image_url FROM newspaper_images WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      logger.warn(`[Images API] Image not found in database: ${id}`);
      return res.status(404).json({ error: 'Image not found' });
    }

    const imageRecord = result.rows[0];
    const imagePath = imageRecord.local_path;
    const imageUrl = imageRecord.image_url;
    
    logger.info(`[Images API] Image found: local_path=${imagePath}, image_url=${imageUrl}`);

    // local_path가 있으면 파일 시스템에서 제공
    if (imagePath) {
      // Azure App Service에서는 /tmp/images를 사용
      const fullPath = path.isAbsolute(imagePath) 
        ? imagePath 
        : path.resolve(imagePath);
      
      logger.info(`[Images API] Attempting to serve file: ${fullPath}`);
      
      try {
        await fs.access(fullPath);
        logger.info(`[Images API] File exists, sending: ${fullPath}`);
        res.sendFile(fullPath);
        return;
      } catch (error) {
        logger.warn(`[Images API] File not found at ${fullPath}, trying image_url fallback`);
        // 파일이 없으면 원본 URL로 리다이렉트
        if (imageUrl) {
          logger.info(`[Images API] Redirecting to image_url: ${imageUrl}`);
          return res.redirect(imageUrl);
        }
      }
    }
    
    // local_path가 없거나 파일이 없으면 원본 URL 사용
    if (imageUrl) {
      logger.info(`[Images API] Redirecting to image_url: ${imageUrl}`);
      return res.redirect(imageUrl);
    }

    logger.error(`[Images API] No image path or URL available for ID: ${id}`);
    res.status(404).json({ error: 'Image file not found' });
  } catch (error) {
    logger.error(`[Images API] Error serving image:`, error);
    res.status(500).json({ error: 'Failed to serve image' });
  }
});

export default router;

