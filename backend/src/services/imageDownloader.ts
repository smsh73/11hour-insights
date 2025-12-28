import axios from 'axios';
import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../utils/logger';

export async function downloadImage(
  imageUrl: string,
  savePath: string
): Promise<{ localPath: string; fileSize: number; mimeType: string }> {
  try {
    // Create directory if it doesn't exist
    const dir = path.dirname(savePath);
    await fs.mkdir(dir, { recursive: true });

    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      timeout: 60000,
    });

    await fs.writeFile(savePath, response.data);
    
    const stats = await fs.stat(savePath);
    const mimeType = response.headers['content-type'] || 'image/jpeg';

    logger.info(`Downloaded image: ${savePath} (${stats.size} bytes)`);
    
    return {
      localPath: savePath,
      fileSize: stats.size,
      mimeType,
    };
  } catch (error) {
    logger.error(`Error downloading image ${imageUrl}:`, error);
    throw error;
  }
}

