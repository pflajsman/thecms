import { Request, Response, NextFunction } from 'express';
import { getDashboardStats } from './stats.service';

export class StatsController {
  /**
   * Dashboard counts
   * GET /api/v1/stats
   */
  async getStats(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await getDashboardStats();
      res.status(200).json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  }
}

export const statsController = new StatsController();
