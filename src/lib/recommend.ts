import type { FoodShop } from '../types';

export function normalizeShops(shops: FoodShop[]): FoodShop[] {
  const seen = new Set<string>();
  const normalized: FoodShop[] = [];

  for (const shop of shops) {
    const name = shop.name.trim();

    if (!name) {
      continue;
    }

    const idKey = shop.id ? `id:${shop.id}` : '';
    const placeKey = `place:${name}:${shop.address?.trim() ?? ''}`;

    if ((idKey && seen.has(idKey)) || seen.has(placeKey)) {
      continue;
    }

    if (idKey) {
      seen.add(idKey);
    }
    seen.add(placeKey);

    normalized.push({
      ...shop,
      name,
      address: shop.address?.trim() || undefined
    });
  }

  return normalized;
}

export function chooseShop(
  shops: FoodShop[],
  random: () => number = Math.random
): FoodShop | null {
  const normalized = normalizeShops(shops);

  if (normalized.length === 0) {
    return null;
  }

  const index = Math.min(Math.floor(random() * normalized.length), normalized.length - 1);
  return normalized[index];
}
