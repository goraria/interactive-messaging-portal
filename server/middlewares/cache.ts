import { Request, Response, NextFunction } from 'express';

interface CacheEntry {
  data: any;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();

/**
 * Simple in-memory cache middleware
 * @param duration Cache duration in seconds
 */
export const cacheMiddleware = (duration: number = 60) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    const key = `${req.originalUrl}`;
    const cached = cache.get(key);

    if (cached) {
      const age = (Date.now() - cached.timestamp) / 1000;
      
      if (age < duration) {
        // Cache hit - return cached data
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('X-Cache-Age', Math.floor(age).toString());
        return res.json(cached.data);
      } else {
        // Cache expired - remove it
        cache.delete(key);
      }
    }

    // Cache miss - store original json method
    const originalJson = res.json.bind(res);
    
    res.json = (body: any) => {
      // Store in cache
      cache.set(key, {
        data: body,
        timestamp: Date.now(),
      });
      
      res.setHeader('X-Cache', 'MISS');
      return originalJson(body);
    };

    next();
  };
};

/**
 * Clear cache for specific pattern
 */
export const clearCache = (pattern?: string) => {
  if (!pattern) {
    cache.clear();
    return;
  }

  const keys = Array.from(cache.keys());
  keys.forEach(key => {
    if (key.includes(pattern)) {
      cache.delete(key);
    }
  });
};

/**
 * Get cache stats
 */
export const getCacheStats = () => {
  return {
    size: cache.size,
    keys: Array.from(cache.keys()),
  };
};
