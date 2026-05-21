import type { CustomGroup, FoodShop, SavedShop } from '../types';

export const CUSTOM_GROUPS_STORAGE_KEY = 'what-to-eat:custom-groups:v1';

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

type GroupMutationResult = {
  groups: CustomGroup[];
  group?: CustomGroup;
  error?: string;
};

type SaveShopsResult = {
  groups: CustomGroup[];
  savedCount: number;
  skippedCount: number;
  error?: string;
};

const EMPTY_GROUP_NAME_ERROR = '分组名不能为空。';
const DUPLICATE_GROUP_NAME_ERROR = '已有同名分组。';

export function createDefaultGroups(): CustomGroup[] {
  return [createGroup('清淡组'), createGroup('食肉组')];
}

export function loadCustomGroups(storage: StorageLike | undefined): CustomGroup[] {
  if (!storage) {
    return createDefaultGroups();
  }

  try {
    const raw = storage.getItem(CUSTOM_GROUPS_STORAGE_KEY);

    if (!raw) {
      return createDefaultGroups();
    }

    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return createDefaultGroups();
    }

    const groups = parsed.map(normalizeCustomGroup).filter((group): group is CustomGroup => Boolean(group));
    return groups.length > 0 ? groups : createDefaultGroups();
  } catch {
    return createDefaultGroups();
  }
}

export function saveCustomGroups(storage: StorageLike | undefined, groups: CustomGroup[]): void {
  storage?.setItem(CUSTOM_GROUPS_STORAGE_KEY, JSON.stringify(groups));
}

export function addCustomGroup(groups: CustomGroup[], name: string): GroupMutationResult {
  const trimmedName = name.trim();
  const error = validateGroupName(groups, trimmedName);

  if (error) {
    return { groups, error };
  }

  const group = createGroup(trimmedName);
  return {
    groups: [...groups, group],
    group
  };
}

export function renameCustomGroup(groups: CustomGroup[], groupId: string, name: string): GroupMutationResult {
  const trimmedName = name.trim();
  const error = validateGroupName(groups, trimmedName, groupId);

  if (error) {
    return { groups, error };
  }

  const nextGroups = groups.map((group) =>
    group.id === groupId
      ? {
          ...group,
          name: trimmedName,
          updatedAt: now()
        }
      : group
  );

  return {
    groups: nextGroups,
    group: nextGroups.find((group) => group.id === groupId)
  };
}

export function deleteCustomGroup(groups: CustomGroup[], groupId: string): CustomGroup[] {
  return groups.filter((group) => group.id !== groupId);
}

export function saveShopsToGroup(
  groups: CustomGroup[],
  groupId: string,
  shops: FoodShop[]
): SaveShopsResult {
  const targetGroup = groups.find((group) => group.id === groupId);

  if (!targetGroup) {
    return { groups, savedCount: 0, skippedCount: shops.length, error: '没有找到当前分组。' };
  }

  const existingIds = new Set(targetGroup.shops.map((shop) => shop.id));
  const timestamp = now();
  const savedShops: SavedShop[] = [];
  let skippedCount = 0;

  for (const shop of shops) {
    const savedShop = normalizeSavedShop({ ...shop, savedAt: timestamp });

    if (!savedShop || existingIds.has(savedShop.id)) {
      skippedCount += 1;
      continue;
    }

    existingIds.add(savedShop.id);
    savedShops.push(savedShop);
  }

  if (savedShops.length === 0) {
    return {
      groups,
      savedCount: 0,
      skippedCount
    };
  }

  return {
    groups: groups.map((group) =>
      group.id === groupId
        ? {
            ...group,
            shops: [...group.shops, ...savedShops],
            updatedAt: timestamp
          }
        : group
    ),
    savedCount: savedShops.length,
    skippedCount
  };
}

export function deleteShopFromGroup(groups: CustomGroup[], groupId: string, shopId: string): CustomGroup[] {
  return groups.map((group) =>
    group.id === groupId
      ? {
          ...group,
          shops: group.shops.filter((shop) => shop.id !== shopId),
          updatedAt: now()
        }
      : group
  );
}

function createGroup(name: string): CustomGroup {
  const timestamp = now();

  return {
    id: createId(),
    name,
    shops: [],
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function validateGroupName(groups: CustomGroup[], name: string, currentGroupId?: string): string | undefined {
  if (!name) {
    return EMPTY_GROUP_NAME_ERROR;
  }

  const hasDuplicateName = groups.some((group) => group.id !== currentGroupId && group.name.trim() === name);
  return hasDuplicateName ? DUPLICATE_GROUP_NAME_ERROR : undefined;
}

function normalizeCustomGroup(value: unknown): CustomGroup | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const group = value as CustomGroup;

  if (
    typeof group.id !== 'string' ||
    typeof group.name !== 'string' ||
    !Array.isArray(group.shops) ||
    typeof group.createdAt !== 'string' ||
    typeof group.updatedAt !== 'string'
  ) {
    return null;
  }

  return {
    ...group,
    name: group.name.trim(),
    shops: group.shops
      .map((shop) => normalizeSavedShop(shop))
      .filter((shop): shop is SavedShop => Boolean(shop))
  };
}

function normalizeSavedShop(value: unknown): SavedShop | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const shop = value as Partial<SavedShop>;
  const id = normalizeOptionalText(shop.id);
  const name = normalizeOptionalText(shop.name);

  if (!id || !name) {
    return null;
  }

  const distance = typeof shop.distance === 'number' && Number.isFinite(shop.distance) ? shop.distance : undefined;

  return {
    id,
    name,
    address: normalizeOptionalText(shop.address),
    distance,
    type: normalizeOptionalText(shop.type),
    location: normalizeOptionalText(shop.location),
    rating: normalizeOptionalText(shop.rating),
    cost: normalizeOptionalText(shop.cost),
    note: normalizeOptionalText(shop.note),
    savedAt: normalizeOptionalText(shop.savedAt) ?? now()
  };
}

function normalizeOptionalText(value: unknown): string | undefined {
  return typeof value === 'string' ? value.trim() || undefined : undefined;
}

function now(): string {
  return new Date().toISOString();
}

function createId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
