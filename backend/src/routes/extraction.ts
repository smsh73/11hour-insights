import { Router, Request, Response } from 'express';
import { extractionService } from '../services/extractionService';

const router = Router();

// Get extraction progress
router.get('/progress/:issueId', async (req: Request, res: Response) => {
  try {
    const { issueId } = req.params;
    const progress = await extractionService.getExtractionProgress(parseInt(issueId));
    
    if (!progress) {
      return res.status(404).json({ error: 'No extraction job found' });
    }

    res.json(progress);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get progress' });
  }
});

export default router;

