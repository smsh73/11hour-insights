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
    const seenUrls = new Set<string>();

    // Method 1: Find img tags with src containing data.dimode.co.kr (main newspaper images)
    $('img[src*="data.dimode.co.kr"]').each((index, element) => {
      const src = $(element).attr('src')?.trim();
      const alt = $(element).attr('alt') || $(element).attr('title') || '';
      
      if (src && !seenUrls.has(src)) {
        // Extract page number from alt/title (e.g., "001.jpg" -> 1)
        const pageMatch = alt.match(/(\d{3})\.(jpg|jpeg|png)/i);
        const pageNumber = pageMatch ? parseInt(pageMatch[1], 10) : index + 1;
        
        // Extract filename from alt/title or URL
        const fileName = alt.match(/(\d{3}\.(jpg|jpeg|png))/i)?.[0] || 
                        src.split('/').pop()?.split('?')[0] || 
                        `image_${index + 1}.jpg`;

        const imageUrl = src.startsWith('http') ? src : new URL(src, boardUrl).toString();

        images.push({
          url: imageUrl,
          fileName,
          pageNumber,
        });
        seenUrls.add(src);
      }
    });

    // Method 2: Find download links with filename attribute
    $('a.each-file[filename]').each((index, element) => {
      const filename = $(element).attr('filename');
      const dataHref = $(element).attr('data-href');
      const title = $(element).attr('title') || '';
      
      if (filename && filename.match(/\.(jpg|jpeg|png)/i)) {
        // Extract page number from filename (e.g., "001.jpg" -> 1)
        const pageMatch = filename.match(/(\d{3})\.(jpg|jpeg|png)/i);
        const pageNumber = pageMatch ? parseInt(pageMatch[1], 10) : index + 1;
        
        // Try to find corresponding img tag with same filename
        const altText = filename;
        const imgTag = $(`img[alt="${altText}"], img[title="${altText}"]`).first();
        let imageUrl = '';
        
        if (imgTag.length > 0) {
          const src = imgTag.attr('src')?.trim();
          if (src) {
            imageUrl = src.startsWith('http') ? src : new URL(src, boardUrl).toString();
          }
        }
        
        // If no img tag found, construct URL from data-href
        if (!imageUrl && dataHref) {
          imageUrl = dataHref.startsWith('http') 
            ? dataHref 
            : new URL(dataHref, boardUrl).toString();
        }
        
        // If still no URL, try to construct from filename pattern
        if (!imageUrl) {
          // Extract board ID from URL (e.g., /Board/Detail/66/65505 -> 65505)
          const boardIdMatch = boardUrl.match(/\/Detail\/\d+\/(\d+)/);
          if (boardIdMatch) {
            const boardId = boardIdMatch[1];
            // Try common patterns
            imageUrl = `https://data.dimode.co.kr/UserData/anyangjeil/files/66/${boardId}/${filename}`;
          }
        }
        
        if (imageUrl && !seenUrls.has(imageUrl)) {
          images.push({
            url: imageUrl,
            fileName: filename,
            pageNumber,
          });
          seenUrls.add(imageUrl);
        }
      }
    });

    // Method 3: Fallback - find any img tags with image extensions
    $('img[src*=".jpg"], img[src*=".jpeg"], img[src*=".png"]').each((index, element) => {
      const src = $(element).attr('src')?.trim();
      const alt = $(element).attr('alt') || $(element).attr('title') || '';
      
      if (src && !seenUrls.has(src) && src.includes('data.dimode.co.kr')) {
        const imageUrl = src.startsWith('http') ? src : new URL(src, boardUrl).toString();
        
        // Extract page number from alt/title or URL
        const pageMatch = alt.match(/(\d{3})\.(jpg|jpeg|png)/i) || 
                         imageUrl.match(/(\d{3})\.(jpg|jpeg|png)/i);
        const pageNumber = pageMatch ? parseInt(pageMatch[1], 10) : index + 1;
        
        const fileName = alt.match(/(\d{3}\.(jpg|jpeg|png))/i)?.[0] || 
                        imageUrl.split('/').pop()?.split('?')[0] || 
                        `image_${index + 1}.jpg`;

        images.push({
          url: imageUrl,
          fileName,
          pageNumber,
        });
        seenUrls.add(src);
      }
    });

    logger.info(`Scraped ${images.length} images from ${boardUrl}`);
    return images.sort((a, b) => a.pageNumber - b.pageNumber);
  } catch (error) {
    logger.error(`Error scraping ${boardUrl}:`, error);
    throw error;
  }
}

