import type { ClassifiedShop, FoodCategory, FoodShop } from '../types';
import { normalizeShops } from './recommend';

export const SELECTED_CATEGORIES_STORAGE_KEY = 'what-to-eat:selected-categories:v1';
export const DEFAULT_SELECTED_CATEGORY_IDS = ['bento-set', 'rice-noodle-soup', 'burger-pizza'];

export const FOOD_CATEGORIES: FoodCategory[] = [
  {
    id: 'bento-set',
    name: '便当套餐',
    keywords: ['便当', '套餐', '盖饭', '饭', '快餐', '简餐']
  },
  {
    id: 'rice-noodle-soup',
    name: '米粉汤面',
    keywords: ['米粉', '汤粉', '粉', '面', '拉面', '牛肉面', '拌面', '馄饨', '云吞']
  },
  {
    id: 'burger-pizza',
    name: '汉堡披萨',
    keywords: ['汉堡', '披萨', '炸鸡', '薯条', '西餐', '麦当劳', '肯德基', '必胜客']
  },
  {
    id: 'milk-tea-coffee',
    name: '奶茶咖啡',
    keywords: ['奶茶', '咖啡', '茶饮', '果茶', '甜品', '饮品']
  },
  {
    id: 'salad-light',
    name: '沙拉轻食',
    keywords: ['沙拉', '轻食', '健康餐', '低脂', '蔬食']
  },
  {
    id: 'regional-cuisine',
    name: '地方菜系',
    keywords: ['川菜', '湘菜', '粤菜', '东北菜', '火锅', '烧烤', '日料', '韩餐', '本帮菜']
  },
  {
    id: 'snacks',
    name: '解馋小吃',
    keywords: ['小吃', '麻辣烫', '炸串', '卤味', '烧饼', '包子', '饺子', '串串']
  }
];

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

export function createDefaultSelectedCategoryIds(): string[] {
  return [...DEFAULT_SELECTED_CATEGORY_IDS];
}

export function loadSelectedCategoryIds(storage: StorageLike | undefined): string[] {
  if (!storage) {
    return createDefaultSelectedCategoryIds();
  }

  try {
    const raw = storage.getItem(SELECTED_CATEGORIES_STORAGE_KEY);

    if (!raw) {
      return createDefaultSelectedCategoryIds();
    }

    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return createDefaultSelectedCategoryIds();
    }

    const normalized = normalizeSelectedCategoryIds(parsed);
    return normalized.length > 0 ? normalized : createDefaultSelectedCategoryIds();
  } catch {
    return createDefaultSelectedCategoryIds();
  }
}

export function saveSelectedCategoryIds(storage: StorageLike | undefined, categoryIds: string[]): void {
  storage?.setItem(SELECTED_CATEGORIES_STORAGE_KEY, JSON.stringify(normalizeSelectedCategoryIds(categoryIds)));
}

export function toggleSelectedCategoryId(selectedCategoryIds: string[], categoryId: string): string[] {
  if (!FOOD_CATEGORIES.some((category) => category.id === categoryId)) {
    return normalizeSelectedCategoryIds(selectedCategoryIds);
  }

  const selectedSet = new Set(normalizeSelectedCategoryIds(selectedCategoryIds));

  if (selectedSet.has(categoryId)) {
    selectedSet.delete(categoryId);
  } else {
    selectedSet.add(categoryId);
  }

  return FOOD_CATEGORIES.map((category) => category.id).filter((id) => selectedSet.has(id));
}

export function classifyShop(shop: FoodShop): FoodCategory | undefined {
  const haystack = [shop.name, shop.type, shop.address].filter(Boolean).join(' ').toLowerCase();

  if (!haystack) {
    return undefined;
  }

  return FOOD_CATEGORIES.map((category) => ({
    category,
    matchedKeywordLength: Math.max(
      0,
      ...category.keywords.map((keyword) =>
        haystack.includes(keyword.trim().toLowerCase()) ? keyword.trim().length : 0
      )
    )
  }))
    .filter((match) => match.matchedKeywordLength > 0)
    .sort((left, right) => right.matchedKeywordLength - left.matchedKeywordLength)[0]?.category;
}

export function annotateShopCategory(shop: FoodShop, selectedCategoryIds: string[]): ClassifiedShop {
  const category = classifyShop(shop);

  if (!category) {
    return { ...shop };
  }

  const weighted = selectedCategoryIds.includes(category.id);

  return {
    ...shop,
    category: {
      id: category.id,
      name: category.name,
      weighted,
      weight: weighted ? 3 : 1
    }
  };
}

export function chooseWeightedShop(
  shops: FoodShop[],
  selectedCategoryIds: string[],
  random: () => number = Math.random
): ClassifiedShop | null {
  const selectedIds = normalizeSelectedCategoryIds(selectedCategoryIds);
  const weightedShops = normalizeShops(shops).map((shop) => annotateShopCategory(shop, selectedIds));

  if (weightedShops.length === 0) {
    return null;
  }

  const totalWeight = weightedShops.reduce((sum, shop) => sum + (shop.category?.weight ?? 1), 0);
  let cursor = random() * totalWeight;

  for (const shop of weightedShops) {
    cursor -= shop.category?.weight ?? 1;

    if (cursor < 0) {
      return shop;
    }
  }

  return weightedShops[weightedShops.length - 1];
}

function normalizeSelectedCategoryIds(value: unknown[]): string[] {
  const validIds = new Set(FOOD_CATEGORIES.map((category) => category.id));
  const selectedSet = new Set(value.filter((id): id is string => typeof id === 'string' && validIds.has(id)));

  return FOOD_CATEGORIES.map((category) => category.id).filter((id) => selectedSet.has(id));
}
