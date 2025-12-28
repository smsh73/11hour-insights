import axios from 'axios';
import * as cheerio from 'cheerio';
import { logger } from '../utils/logger';

export interface ScrapedImage {
  url: string;
  fileName: string;
  pageNumber: number;
}

export async function scrapeNewspaperPage(boardUrl: string): Promise<ScrapedImage[]> {
  try {
    const response = await axios.get(boardUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      timeout: 30000,
    });

    const $ = cheerio.load(response.data);
    const images: ScrapedImage[] = [];

    // Find all image attachments
    $('a[href*=".jpg"], a[href*=".jpeg"], a[href*=".png"]').each((index, element) => {
      const href = $(element).attr('href');
      const text = $(element).text().trim();

      if (href) {
        // Construct full URL if relative
        const imageUrl = href.startsWith('http') 
          ? href 
          : new URL(href, boardUrl).toString();

        // Extract page number from filename (e.g., 001.jpg -> 1)
        const pageMatch = text.match(/(\d{3})\.(jpg|jpeg|png)/i) || 
                         imageUrl.match(/(\d{3})\.(jpg|jpeg|png)/i);
        const pageNumber = pageMatch ? parseInt(pageMatch[1], 10) : index + 1;

        // Extract filename
        const fileName = imageUrl.split('/').pop() || `image_${index + 1}.jpg`;

        images.push({
          url: imageUrl,
          fileName,
          pageNumber,
        });
      }
    });

    // Also check for img tags with src attributes
    $('img[src*=".jpg"], img[src*=".jpeg"], img[src*=".png"]').each((index, element) => {
      const src = $(element).attr('src');
      if (src && !images.some(img => img.url.includes(src))) {
        const imageUrl = src.startsWith('http') 
          ? src 
          : new URL(src, boardUrl).toString();
        
        const pageMatch = imageUrl.match(/(\d{3})\.(jpg|jpeg|png)/i);
        const pageNumber = pageMatch ? parseInt(pageMatch[1], 10) : index + 1;
        const fileName = imageUrl.split('/').pop() || `image_${index + 1}.jpg`;

        images.push({
          url: imageUrl,
          fileName,
          pageNumber,
        });
      }
    });

    logger.info(`Scraped ${images.length} images from ${boardUrl}`);
    return images.sort((a, b) => a.pageNumber - b.pageNumber);
  } catch (error) {
    logger.error(`Error scraping ${boardUrl}:`, error);
    throw error;
  }
}

