import { describe, expect, it } from 'vitest';
import type { FoodShop } from '../types';
import {
  DEFAULT_SELECTED_CATEGORY_IDS,
  FOOD_CATEGORIES,
  SELECTED_CATEGORIES_STORAGE_KEY,
  annotateShopCategory,
  chooseWeightedShop,
  classifyShop,
  createDefaultSelectedCategoryIds,
  loadSelectedCategoryIds,
  saveSelectedCategoryIds,
  toggleSelectedCategoryId
} from './foodCategories';

function memoryStorage(initial?: string) {
  const store = new Map<string, string>();

  if (initial) {
    store.set(SELECTED_CATEGORIES_STORAGE_KEY, initial);
  }

  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    }
  };
}

describe('food categories', () => {
  it('keeps the preset category order and default selected queue', () => {
    expect(FOOD_CATEGORIES.map((category) => category.name)).toEqual([
      '便当套餐',
      '米粉汤面',
      '汉堡披萨',
      '奶茶咖啡',
      '沙拉轻食',
      '地方菜系',
      '解馋小吃'
    ]);
    expect(createDefaultSelectedCategoryIds()).toEqual(DEFAULT_SELECTED_CATEGORY_IDS);
  });

  it('classifies shops by name type or address and prefers longer keyword matches', () => {
    expect(classifyShop({ id: '1', name: '兰州牛肉面', type: '餐饮;快餐' })?.name).toBe('米粉汤面');
    expect(classifyShop({ id: '2', name: '一份沙拉', address: '健康餐街区' })?.name).toBe('沙拉轻食');
    expect(classifyShop({ id: '3', name: '未知餐厅' })).toBeUndefined();
  });

  it('weights selected categories and keeps unselected categories ordinary', () => {
    expect(annotateShopCategory({ id: '1', name: '兰州牛肉面' }, ['rice-noodle-soup']).category).toMatchObject({
      name: '米粉汤面',
      weighted: true,
      weight: 3
    });
    expect(annotateShopCategory({ id: '2', name: '拿铁咖啡' }, ['rice-noodle-soup']).category).toMatchObject({
      name: '奶茶咖啡',
      weighted: false,
      weight: 1
    });
    expect(annotateShopCategory({ id: '3', name: '未知餐厅' }, ['rice-noodle-soup']).category).toBeUndefined();
  });

  it('chooses from weighted intervals with a fixed random value', () => {
    const shops: FoodShop[] = [
      { id: 'coffee', name: '拿铁咖啡' },
      { id: 'noodle', name: '牛肉面' }
    ];

    expect(chooseWeightedShop(shops, ['rice-noodle-soup'], () => 0.2)).toMatchObject({
      id: 'coffee',
      category: { name: '奶茶咖啡', weight: 1 }
    });
    expect(chooseWeightedShop(shops, ['rice-noodle-soup'], () => 0.4)).toMatchObject({
      id: 'noodle',
      category: { name: '米粉汤面', weight: 3 }
    });
  });

  it('loads, saves, and recovers selected category ids safely', () => {
    const storage = memoryStorage();
    saveSelectedCategoryIds(storage, ['milk-tea-coffee', 'rice-noodle-soup', 'bad-id', 'milk-tea-coffee']);

    expect(loadSelectedCategoryIds(storage)).toEqual(['rice-noodle-soup', 'milk-tea-coffee']);
    expect(loadSelectedCategoryIds(memoryStorage('{bad-json'))).toEqual(DEFAULT_SELECTED_CATEGORY_IDS);
    expect(loadSelectedCategoryIds(memoryStorage(JSON.stringify(['bad-id'])))).toEqual(DEFAULT_SELECTED_CATEGORY_IDS);
  });

  it('toggles category ids while preserving preset order', () => {
    expect(toggleSelectedCategoryId(['bento-set', 'rice-noodle-soup'], 'bento-set')).toEqual(['rice-noodle-soup']);
    expect(toggleSelectedCategoryId(['rice-noodle-soup'], 'milk-tea-coffee')).toEqual([
      'rice-noodle-soup',
      'milk-tea-coffee'
    ]);
    expect(toggleSelectedCategoryId(['rice-noodle-soup'], 'bad-id')).toEqual(['rice-noodle-soup']);
  });
});
