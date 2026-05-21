import type { FoodShop } from '../types';

export type DrawTimelineStep = {
  shop: FoodShop;
  delay: number;
  isFinal: boolean;
};

const DRAW_STEP_DELAYS = [45, 55, 65, 80, 100, 125, 155, 190, 235, 285, 345];

export function getDrawStepDelays(): number[] {
  return [...DRAW_STEP_DELAYS];
}

export function createDrawTimeline(
  shops: FoodShop[],
  finalShop: FoodShop,
  random: () => number = Math.random
): DrawTimelineStep[] {
  const pool = shops.filter((shop) => shop.name.trim());
  const delays = getDrawStepDelays();

  if (pool.length === 0) {
    return [{ shop: finalShop, delay: delays.at(-1) ?? 0, isFinal: true }];
  }

  const timeline = delays.slice(0, -1).map((delay) => {
    const index = Math.min(Math.floor(random() * pool.length), pool.length - 1);

    return {
      shop: pool[index],
      delay,
      isFinal: false
    };
  });

  timeline.push({
    shop: finalShop,
    delay: delays.at(-1) ?? 0,
    isFinal: true
  });

  return timeline;
}
