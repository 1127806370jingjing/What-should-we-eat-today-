import { describe, expect, it } from 'vitest';
import type { FoodShop } from '../types';
import { createDrawTimeline, getDrawStepDelays } from './drawCeremony';

describe('draw ceremony pacing', () => {
  it('uses progressively slower draw steps', () => {
    const delays = getDrawStepDelays();
    const totalDuration = delays.reduce((sum, delay) => sum + delay, 0);

    expect(delays.length).toBeGreaterThan(8);
    expect(totalDuration).toBeGreaterThanOrEqual(2000);
    expect(totalDuration).toBeLessThanOrEqual(2800);
    expect(delays[delays.length - 1]).toBeGreaterThan(delays[0] * 6);
    expect(delays.at(-1)).toBeGreaterThan(delays.at(-3) ?? 0);
    for (let index = 1; index < delays.length; index += 1) {
      expect(delays[index]).toBeGreaterThanOrEqual(delays[index - 1]);
    }
  });

  it('ends the timeline with the final selected shop', () => {
    const shops: FoodShop[] = [
      { id: '1', name: '米粉' },
      { id: '2', name: '烤肉饭' },
      { id: '3', name: '小笼包' }
    ];

    const timeline = createDrawTimeline(shops, shops[1], () => 0);

    expect(timeline.at(-1)).toMatchObject({
      shop: { id: '2', name: '烤肉饭' },
      isFinal: true
    });
    expect(timeline.slice(0, -1).some((step) => step.shop.name !== '烤肉饭')).toBe(true);
  });
});
