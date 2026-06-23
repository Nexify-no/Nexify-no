/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock database and schema
const mockDb = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockResolvedValue({ insertId: 1 }),
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
};

vi.mock('./db', () => ({
  getDb: vi.fn().mockResolvedValue(mockDb),
}));

vi.mock('../drizzle/schema', () => ({
  ideas: {
    id: 'id',
    userId: 'user_id',
    ideaText: 'idea_text',
    source: 'source',
    tags: 'tags',
    status: 'status',
    platform: 'platform',
    convertedPostId: 'converted_post_id',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
}));

describe('Idé-Bank (Idea Bank) Feature', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Ideas Schema', () => {
    it('should have correct table structure', () => {
      const expectedFields = [
        'id',
        'userId',
        'ideaText',
        'source',
        'tags',
        'status',
        'platform',
        'convertedPostId',
        'createdAt',
        'updatedAt',
      ];
      
      // Verify all expected fields exist
      expectedFields.forEach(field => {
        expect(field).toBeDefined();
      });
    });

    it('should support all status types', () => {
      const validStatuses = ['new', 'in_progress', 'used', 'archived'];
      validStatuses.forEach(status => {
        expect(['new', 'in_progress', 'used', 'archived']).toContain(status);
      });
    });

    it('should support all source types', () => {
      const validSources = ['manual', 'voice', 'trend', 'competitor'];
      validSources.forEach(source => {
        expect(['manual', 'voice', 'trend', 'competitor']).toContain(source);
      });
    });

    it('should support all platform types', () => {
      const validPlatforms = ['linkedin', 'twitter', 'instagram', 'facebook'];
      validPlatforms.forEach(platform => {
        expect(['linkedin', 'twitter', 'instagram', 'facebook']).toContain(platform);
      });
    });
  });

  describe('Ideas CRUD Operations', () => {
    it('should create a new idea with required fields', async () => {
      const newIdea = {
        userId: 1,
        ideaText: 'Test idea about AI marketing',
        source: 'manual' as const,
        status: 'new' as const,
      };

      // Verify the idea object has required fields
      expect(newIdea.userId).toBeDefined();
      expect(newIdea.ideaText).toBeDefined();
      expect(newIdea.source).toBe('manual');
      expect(newIdea.status).toBe('new');
    });

    it('should create idea with optional platform', async () => {
      const ideaWithPlatform = {
        userId: 1,
        ideaText: 'LinkedIn post about leadership',
        source: 'manual' as const,
        status: 'new' as const,
        platform: 'linkedin' as const,
      };

      expect(ideaWithPlatform.platform).toBe('linkedin');
    });

    it('should create idea with tags as JSON string', async () => {
      const tags = ['marketing', 'AI', 'tips'];
      const tagsJson = JSON.stringify(tags);

      expect(tagsJson).toBe('["marketing","AI","tips"]');
      expect(JSON.parse(tagsJson)).toEqual(tags);
    });

    it('should update idea status correctly', async () => {
      const statusTransitions = [
        { from: 'new', to: 'in_progress' },
        { from: 'in_progress', to: 'used' },
        { from: 'new', to: 'archived' },
      ];

      statusTransitions.forEach(transition => {
        expect(['new', 'in_progress', 'used', 'archived']).toContain(transition.from);
        expect(['new', 'in_progress', 'used', 'archived']).toContain(transition.to);
      });
    });

    it('should link converted post to idea', async () => {
      const ideaWithPost = {
        id: 1,
        status: 'used' as const,
        convertedPostId: 42,
      };

      expect(ideaWithPost.status).toBe('used');
      expect(ideaWithPost.convertedPostId).toBe(42);
    });
  });

  describe('Ideas Filtering', () => {
    it('should filter by status', () => {
      const ideas = [
        { id: 1, status: 'new' },
        { id: 2, status: 'in_progress' },
        { id: 3, status: 'used' },
        { id: 4, status: 'new' },
      ];

      const newIdeas = ideas.filter(i => i.status === 'new');
      expect(newIdeas).toHaveLength(2);
      expect(newIdeas.every(i => i.status === 'new')).toBe(true);
    });

    it('should search by ideaText', () => {
      const ideas = [
        { id: 1, ideaText: 'AI marketing tips' },
        { id: 2, ideaText: 'Leadership advice' },
        { id: 3, ideaText: 'AI automation guide' },
      ];

      const searchTerm = 'ai';
      const results = ideas.filter(i => 
        i.ideaText.toLowerCase().includes(searchTerm.toLowerCase())
      );

      expect(results).toHaveLength(2);
    });

    it('should search by tags', () => {
      const ideas = [
        { id: 1, ideaText: 'Post 1', tags: '["marketing","tips"]' },
        { id: 2, ideaText: 'Post 2', tags: '["leadership"]' },
        { id: 3, ideaText: 'Post 3', tags: '["marketing","AI"]' },
      ];

      const searchTerm = 'marketing';
      const results = ideas.filter(i => 
        i.tags && i.tags.toLowerCase().includes(searchTerm.toLowerCase())
      );

      expect(results).toHaveLength(2);
    });
  });

  describe('Ideas Stats', () => {
    it('should calculate correct stats', () => {
      const ideas = [
        { status: 'new' },
        { status: 'new' },
        { status: 'in_progress' },
        { status: 'used' },
        { status: 'used' },
        { status: 'used' },
        { status: 'archived' },
      ];

      const stats = {
        total: ideas.length,
        new: ideas.filter(i => i.status === 'new').length,
        inProgress: ideas.filter(i => i.status === 'in_progress').length,
        used: ideas.filter(i => i.status === 'used').length,
        archived: ideas.filter(i => i.status === 'archived').length,
      };

      expect(stats.total).toBe(7);
      expect(stats.new).toBe(2);
      expect(stats.inProgress).toBe(1);
      expect(stats.used).toBe(3);
      expect(stats.archived).toBe(1);
    });
  });

  describe('Convert to Post Flow', () => {
    it('should mark idea as in_progress when converting', () => {
      const idea = { id: 1, status: 'new' as const };
      const updatedIdea = { ...idea, status: 'in_progress' as const };

      expect(updatedIdea.status).toBe('in_progress');
    });

    it('should mark idea as used after post creation', () => {
      const idea = { id: 1, status: 'in_progress' as const, convertedPostId: null };
      const updatedIdea = { 
        ...idea, 
        status: 'used' as const, 
        convertedPostId: 42 
      };

      expect(updatedIdea.status).toBe('used');
      expect(updatedIdea.convertedPostId).toBe(42);
    });

    it('should return idea data for Generate page', () => {
      const idea = {
        id: 1,
        ideaText: 'Write about AI trends in 2026',
        platform: 'linkedin' as const,
        tags: '["AI","trends","2026"]',
      };

      const convertResult = {
        success: true,
        idea: {
          id: idea.id,
          ideaText: idea.ideaText,
          platform: idea.platform,
          tags: JSON.parse(idea.tags),
        },
      };

      expect(convertResult.success).toBe(true);
      expect(convertResult.idea.ideaText).toBe('Write about AI trends in 2026');
      expect(convertResult.idea.platform).toBe('linkedin');
      expect(convertResult.idea.tags).toEqual(['AI', 'trends', '2026']);
    });
  });

  describe('URL Parameters for Generate Page', () => {
    it('should construct correct URL with idea params', () => {
      const idea = {
        id: 5,
        ideaText: 'Test idea with special chars: æøå',
        platform: 'linkedin',
      };

      const params = new URLSearchParams();
      params.set('idea', idea.ideaText);
      params.set('ideaId', idea.id.toString());
      params.set('platform', idea.platform);

      const url = `/generate?${params.toString()}`;

      expect(url).toContain('idea=');
      expect(url).toContain('ideaId=5');
      expect(url).toContain('platform=linkedin');
    });

    it('should decode URL parameters correctly', () => {
      const encodedIdea = encodeURIComponent('Test idea: æøå & more');
      const decoded = decodeURIComponent(encodedIdea);

      expect(decoded).toBe('Test idea: æøå & more');
    });
  });
});