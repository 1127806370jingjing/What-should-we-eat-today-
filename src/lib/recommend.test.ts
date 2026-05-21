import { describe, expect, it, vi } from 'vitest';
import type { FoodShop } from '../types';
import { chooseShop, normalizeShops } from './recommend';

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
