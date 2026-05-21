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

export function getCandidateShops(shops: FoodShop[], selectedShop: FoodShop | null, limit = 6): FoodShop[] {
  const normalized = normalizeShops(shops);

  if (!selectedShop) {
    return normalized.slice(0, limit);
  }

  return normalized
    .filter((shop) => shop.id !== selectedShop.id && shop.name !== selectedShop.name)
    .slice(0, limit);
}

export function filterShopsByRegex(shops: FoodShop[], pattern: string): { shops: FoodShop[]; error?: string } {
  const trimmedPattern = pattern.trim();

  if (!trimmedPattern) {
    return { shops, error: undefined };
  }

  try {
    const regex = new RegExp(trimmedPattern, 'i');
    return {
      shops: shops.filter((shop) =>
        [shop.name, shop.address, shop.type].some((value) => value ? regex.test(value) : false)
      ),
      error: undefined
    };
  } catch {
    return {
      shops,
      error: '正则表达式无效'
    };
  }
}
