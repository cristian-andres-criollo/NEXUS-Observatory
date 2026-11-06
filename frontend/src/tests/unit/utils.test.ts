import { describe, it, expect, vi } from 'vitest';
import {
  cn,
  formatCost,
  formatTokens,
  formatLatency,
  scoreColor,
  scoreLabel,
  generateSessionId,
} from '../../lib/utils';

describe('utils.ts', () => {
  describe('cn', () => {
    it('should merge class names correctly', () => {
      expect(cn('class1', 'class2')).toBe('class1 class2');
      expect(cn('class1', false && 'class2', 'class3')).toBe('class1 class3');
      expect(cn('class1', null, undefined, 'class2')).toBe('class1 class2');
    });
  });

  describe('formatCost', () => {
    it('should format zero correctly', () => {
      expect(formatCost(0)).toBe('$0.000000');
    });

    it('should format decimal numbers correctly', () => {
      expect(formatCost(1.2345678)).toBe('$1.234568');
      expect(formatCost(0.000001)).toBe('$0.000001');
    });
  });

  describe('formatTokens', () => {
    it('should format numbers less than 1000 correctly', () => {
      expect(formatTokens(500)).toBe('500');
      expect(formatTokens(999)).toBe('999');
    });

    it('should format numbers greater or equal to 1000 with K suffix', () => {
      expect(formatTokens(1000)).toBe('1.0K');
      expect(formatTokens(1500)).toBe('1.5K');
      expect(formatTokens(12345)).toBe('12.3K');
    });
  });

  describe('formatLatency', () => {
    it('should format milliseconds less than 1000', () => {
      expect(formatLatency(500)).toBe('500ms');
      expect(formatLatency(999)).toBe('999ms');
    });

    it('should format milliseconds to seconds when >= 1000', () => {
      expect(formatLatency(1000)).toBe('1.00s');
      expect(formatLatency(1500)).toBe('1.50s');
    });
  });

  describe('scoreColor', () => {
    it('should return correct hsl color for scores', () => {
      // 0 = 0 hue (red)
      expect(scoreColor(0)).toBe('hsl(0, 100%, 50%)');
      // 1 = 120 hue (green)
      expect(scoreColor(1)).toBe('hsl(120, 100%, 50%)');
      // 0.5 = 60 hue (yellow)
      expect(scoreColor(0.5)).toBe('hsl(60, 100%, 50%)');
    });

    it('should handle inverse scoring', () => {
      // 0 inversely is 1 = green
      expect(scoreColor(0, true)).toBe('hsl(120, 100%, 50%)');
      // 1 inversely is 0 = red
      expect(scoreColor(1, true)).toBe('hsl(0, 100%, 50%)');
    });
  });

  describe('scoreLabel', () => {
    it('should return ALTO for score >= 0.8', () => {
      expect(scoreLabel(0.8)).toBe('ALTO');
      expect(scoreLabel(0.9)).toBe('ALTO');
    });

    it('should return MEDIO for 0.5 <= score < 0.8', () => {
      expect(scoreLabel(0.5)).toBe('MEDIO');
      expect(scoreLabel(0.79)).toBe('MEDIO');
    });

    it('should return BAJO for score < 0.5', () => {
      expect(scoreLabel(0.49)).toBe('BAJO');
      expect(scoreLabel(0)).toBe('BAJO');
    });
  });

  describe('generateSessionId', () => {
    it('should generate a string starting with session_', () => {
      const sessionId = generateSessionId();
      expect(sessionId.startsWith('session_')).toBe(true);
    });

    it('should generate unique session ids', () => {
      const id1 = generateSessionId();
      const id2 = generateSessionId();
      expect(id1).not.toBe(id2);
    });
  });
});
