import analyticsService from '../../services/procurement/analyticsService.js';
import redisManager from '../../config/redis.js';
import { buildCacheKey, cacheGetOrSet } from '../../utils/cache.js';

const ANALYTICS_CACHE_TTL_SECONDS = 300; // 5 minutes

class AnalyticsController {
  async monthlySpend(req, res) {
    try {
      const { from, to } = req.query;
      const cacheKey = buildCacheKey('procurement:analytics:monthlySpend', { from, to });
      const { value: series } = await cacheGetOrSet(
        redisManager,
        cacheKey,
        ANALYTICS_CACHE_TTL_SECONDS,
        () => analyticsService.getMonthlySpend({ from, to })
      );
      res.json({ success: true, data: { series, currency: 'INR' } });
    } catch (e) {
      res.status(500).json({ success: false, message: e.message || 'Failed to fetch monthly spend' });
    }
  }

  async byDepartment(req, res) {
    try {
      const { from, to } = req.query;
      const cacheKey = buildCacheKey('procurement:analytics:byDepartment', { from, to });
      const { value: series } = await cacheGetOrSet(
        redisManager,
        cacheKey,
        ANALYTICS_CACHE_TTL_SECONDS,
        () => analyticsService.getDepartmentBreakdown({ from, to })
      );
      res.json({ success: true, data: { series, currency: 'INR' } });
    } catch (e) {
      res.status(500).json({ success: false, message: e.message || 'Failed to fetch department breakdown' });
    }
  }

  async topSuppliers(req, res) {
    try {
      const { from, to, limit } = req.query;
      const normalizedLimit = Number(limit) || 5;
      const cacheKey = buildCacheKey('procurement:analytics:topSuppliers', { from, to, limit: normalizedLimit });
      const { value: series } = await cacheGetOrSet(
        redisManager,
        cacheKey,
        ANALYTICS_CACHE_TTL_SECONDS,
        () => analyticsService.getTopSuppliers({ from, to, limit: normalizedLimit })
      );
      res.json({ success: true, data: { series, currency: 'INR' } });
    } catch (e) {
      res.status(500).json({ success: false, message: e.message || 'Failed to fetch top suppliers' });
    }
  }
}

export default new AnalyticsController();


