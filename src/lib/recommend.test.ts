import { describe, expect, it, vi } from 'vitest';
import type { FoodShop } from '../types';
import { chooseShop, filterShopsByRegex, getCandidateShops, normalizeShops } from './recommend';

describe('normalizeShops', () => {
  it('removes shops without names and deduplicates by id or name/address', () => {
    const shops: FoodShop[] = [
      { id: '1', name: '面馆', address: '人民路 1 号', distance: 100 },
      { id: '1', name: '面馆复制', address: '人民路 1 号', distance: 120 },
      { id: '2', name: '面馆', address: '人民路 1 号', distance: 110 },
      { id: '3', name: '', address: '无名路', distance: 200 },
      { id: '4', name: '小笼包', address: '和平路', distance: 90 }
    ];

    expect(normalizeShops(shops)).toEqual([
      { id: '1', name: '面馆', address: '人民路 1 号', distance: 100 },
      { id: '4', name: '小笼包', address: '和平路', distance: 90 }
    ]);
  });
});

describe('chooseShop', () => {
  it('uses the provided random source to pick from normalized shops', () => {
    const shops: FoodShop[] = [
      { id: '1', name: '米粉' },
      { id: '2', name: '砂锅' },
      { id: '3', name: '烤肉饭' }
    ];
    const random = vi.fn(() => 0.67);

    expect(chooseShop(shops, random)).toEqual({ id: '3', name: '烤肉饭' });
    expect(random).toHaveBeenCalledOnce();
  });

  it('returns null when no usable shops remain', () => {
    expect(chooseShop([{ id: '1', name: '' }])).toBeNull();
  });
});

describe('getCandidateShops', () => {
  it('returns a limited list that excludes the selected shop', () => {
    const shops: FoodShop[] = [
      { id: '1', name: '米粉' },
      { id: '2', name: '砂锅' },
      { id: '3', name: '烤肉饭' },
      { id: '4', name: '麻辣烫' },
      { id: '5', name: '粥铺' }
    ];

    expect(getCandidateShops(shops, { id: '2', name: '砂锅' }, 3)).toEqual([
      { id: '1', name: '米粉' },
      { id: '3', name: '烤肉饭' },
      { id: '4', name: '麻辣烫' }
    ]);
  });
});

describe('filterShopsByRegex', () => {
  const shops: FoodShop[] = [
    { id: '1', name: '兰州牛肉面', address: '青年路', type: '餐饮;快餐' },
    { id: '2', name: '煲仔饭', address: '中山路', type: '餐饮;粤菜' },
    { id: '3', name: '潮汕火锅', address: '人民路', type: '餐饮;火锅' }
  ];

  it('filters shops by name address or type with a case-insensitive regex', () => {
    expect(filterShopsByRegex(shops, '青年|火锅')).toMatchObject({
      shops: [
        { id: '1', name: '兰州牛肉面' },
        { id: '3', name: '潮汕火锅' }
      ],
      error: undefined
    });
  });

  it('keeps the original list and returns an error for invalid regex', () => {
    expect(filterShopsByRegex(shops, '[')).toMatchObject({
      shops,
      error: '正则表达式无效'
    });
  });
});
