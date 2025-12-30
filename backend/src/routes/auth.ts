import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from '../config/database';
import { logger } from '../utils/logger';

const router = Router();

// Login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const secret: string = process.env.JWT_SECRET || 'secret';
    const expiresIn: string = process.env.JWT_EXPIRES_IN || '7d';
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      secret,
      { expiresIn: expiresIn } as jwt.SignOptions
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Create initial admin user
router.post('/init-admin', async (req: Request, res: Response) => {
  try {
    // Allow in production but require a secret key for security
    const secretKey = process.env.ADMIN_INIT_SECRET || 'dev-secret-key';
    const providedKey = req.headers['x-admin-secret'] || req.body.secret;
    
    if (process.env.NODE_ENV === 'production' && providedKey !== secretKey) {
      return res.status(403).json({ error: 'Secret key required in production' });
    }

    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (username, password_hash, role)
       VALUES ($1, $2, 'admin')
       ON CONFLICT (username) DO NOTHING
       RETURNING id, username, role`,
      [username, passwordHash]
    );

    if (result.rows.length === 0) {
      return res.status(409).json({ error: 'User already exists' });
    }

    res.json({ message: 'Admin user created', user: result.rows[0] });
  } catch (error) {
    logger.error('Init admin error:', error);
    res.status(500).json({ error: 'Failed to create admin user' });
  }
});

export default router;

