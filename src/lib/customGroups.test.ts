import { describe, expect, it } from 'vitest';
import {
  addCustomGroup,
  createDefaultGroups,
  deleteCustomGroup,
  deleteShopFromGroup,
  loadCustomGroups,
  renameCustomGroup,
  saveCustomGroups,
  saveShopsToGroup
} from './customGroups';

describe('custom group management', () => {
  it('creates empty default groups without fake shops', () => {
    expect(createDefaultGroups().map((group) => ({ name: group.name, shops: group.shops }))).toEqual([
      { name: '清淡组', shops: [] },
      { name: '食肉组', shops: [] }
    ]);
  });

  it('adds, renames, and deletes groups', () => {
    const base = createDefaultGroups();
    const { groups: withGroup } = addCustomGroup(base, '夜宵组');
    const newGroup = withGroup.find((group) => group.name === '夜宵组');

    expect(newGroup).toBeDefined();
    expect(renameCustomGroup(withGroup, newGroup!.id, '周末组').groups).toContainEqual(
      expect.objectContaining({ id: newGroup!.id, name: '周末组' })
    );
    expect(deleteCustomGroup(withGroup, newGroup!.id)).not.toContainEqual(
      expect.objectContaining({ id: newGroup!.id })
    );
  });

  it('rejects empty and duplicate group names', () => {
    const base = createDefaultGroups();
    const duplicateAdd = addCustomGroup(base, ' 清淡组 ');
    const duplicateRename = renameCustomGroup(base, base[0].id, '食肉组');

    expect(addCustomGroup(base, '   ')).toMatchObject({ groups: base, error: '分组名不能为空。' });
    expect(duplicateAdd).toMatchObject({ groups: base, error: '已有同名分组。' });
    expect(renameCustomGroup(base, base[0].id, '   ')).toMatchObject({ groups: base, error: '分组名不能为空。' });
    expect(duplicateRename).toMatchObject({ groups: base, error: '已有同名分组。' });
  });

  it('saves api shops into a group and deduplicates by id', () => {
    const [group] = createDefaultGroups();
    const firstSave = saveShopsToGroup([group], group.id, [
      { id: 'poi-1', name: '番茄鸡蛋面', address: '青年路', distance: 120, type: '餐饮;快餐' },
      { id: 'poi-2', name: '牛肉饭', address: '中山路', rating: '4.7', cost: '28' }
    ]);
    const secondSave = saveShopsToGroup(firstSave.groups, group.id, [
      { id: 'poi-1', name: '番茄鸡蛋面', address: '青年路' },
      { id: 'poi-2', name: '牛肉饭', address: '中山路' }
    ]);
    const shop = firstSave.groups[0].shops[0];

    expect(firstSave).toMatchObject({ savedCount: 2, skippedCount: 0 });
    expect(shop).toMatchObject({
      id: 'poi-1',
      name: '番茄鸡蛋面',
      address: '青年路',
      distance: 120,
      type: '餐饮;快餐',
      savedAt: expect.any(String)
    });
    expect(secondSave).toMatchObject({ savedCount: 0, skippedCount: 2 });
    expect(secondSave.groups[0].shops).toHaveLength(2);
    expect(deleteShopFromGroup(firstSave.groups, group.id, shop.id)[0].shops).toHaveLength(1);
  });
});

describe('custom group storage', () => {
  it('loads defaults when storage is empty or broken', () => {
    const storage = window.localStorage;
    storage.clear();

    expect(loadCustomGroups(storage)).toHaveLength(2);

    storage.setItem('what-to-eat:custom-groups:v1', '{broken');
    expect(loadCustomGroups(storage).map((group) => group.name)).toEqual(['清淡组', '食肉组']);
  });

  it('saves groups to localStorage and loads them again', () => {
    const storage = window.localStorage;
    storage.clear();
    const groups = addCustomGroup(createDefaultGroups(), '咖啡组').groups;

    saveCustomGroups(storage, groups);

    expect(loadCustomGroups(storage)).toEqual(groups);
  });

  it('loads old manual shop data and adds savedAt for compatibility', () => {
    const storage = window.localStorage;
    storage.clear();
    storage.setItem(
      'what-to-eat:custom-groups:v1',
      JSON.stringify([
        {
          id: 'old-group',
          name: '旧分组',
          shops: [{ id: 'old-shop', name: '手写小店', note: '少油' }],
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z'
        }
      ])
    );

    expect(loadCustomGroups(storage)[0].shops[0]).toMatchObject({
      id: 'old-shop',
      name: '手写小店',
      note: '少油',
      savedAt: expect.any(String)
    });
  });
});
