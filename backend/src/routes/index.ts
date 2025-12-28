import { Router } from 'express';
import authRoutes from './auth';
import apiKeyRoutes from './apiKeys';
import issuesRoutes from './issues';
import articlesRoutes from './articles';
import extractionRoutes from './extraction';
import adminRoutes from './admin';
import timelineRoutes from './timeline';
import eventsRoutes from './events';
import imagesRoutes from './images';

const router = Router();

router.use('/auth', authRoutes);
router.use('/api-keys', apiKeyRoutes);
router.use('/issues', issuesRoutes);
router.use('/articles', articlesRoutes);
router.use('/extraction', extractionRoutes);
router.use('/admin', adminRoutes);
router.use('/timeline', timelineRoutes);
router.use('/events', eventsRoutes);
router.use('/images', imagesRoutes);

export default router;

