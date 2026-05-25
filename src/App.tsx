import { Check, LoaderCircle, MapPin, Navigation, Plus, RefreshCw, Search, Sparkles, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import Logo from './components/Logo';
import {
  addCustomGroup,
  deleteCustomGroup,
  deleteShopFromGroup,
  loadCustomGroups,
  renameCustomGroup,
  saveCustomGroups,
  saveShopsToGroup
} from './lib/customGroups';
import { createDrawTimeline } from './lib/drawCeremony';
import {
  FOOD_CATEGORIES,
  annotateShopCategory,
  chooseWeightedShop,
  loadSelectedCategoryIds,
  saveSelectedCategoryIds,
  toggleSelectedCategoryId
} from './lib/foodCategories';
import { filterShopsByRegex, getCandidateShops, normalizeShops } from './lib/recommend';
import type { ClassifiedShop, CustomGroup, FoodShop, NearbyFoodResponse, SavedShop } from './types';
import './styles.css';

type Status = 'idle' | 'locating' | 'loading' | 'drawing' | 'revealing' | 'ready' | 'error';
type DrawMode = 'nearby' | 'custom';
type CustomPanelMode = 'draw' | 'edit';
type FeedbackTone = 'info' | 'error';

const API_EMPTY_RESPONSE_MESSAGE = '附近店铺接口没有返回有效内容，请确认 Cloudflare Pages Function 已部署。';
const DEFAULT_RADIUS_METERS = 1500;
const FINAL_REVEAL_DELAY_MS = 1000;
const RADIUS_OPTIONS = [
  { label: '0.5 公里', meters: 500 },
  { label: '1 公里', meters: 1000 },
  { label: '1.5 公里', meters: 1500 },
  { label: '3 公里', meters: 3000 },
  { label: '5 公里', meters: 5000 }
];

function App() {
  const [initialGroups] = useState(() => loadCustomGroups(getStorage()));
  const [initialSelectedCategoryIds] = useState(() => loadSelectedCategoryIds(getStorage()));
  const [mode, setMode] = useState<DrawMode>('nearby');
  const [customPanelMode, setCustomPanelMode] = useState<CustomPanelMode>('draw');
  const [status, setStatus] = useState<Status>('idle');
  const [radiusMeters, setRadiusMeters] = useState(DEFAULT_RADIUS_METERS);
  const [shops, setShops] = useState<FoodShop[]>([]);
  const [nearbyMeta, setNearbyMeta] = useState<NearbyFoodResponse['meta']>();
  const [loadedRadiusMeters, setLoadedRadiusMeters] = useState<number | null>(null);
  const [candidateShops, setCandidateShops] = useState<ClassifiedShop[]>([]);
  const [selectedShop, setSelectedShop] = useState<ClassifiedShop | null>(null);
  const [message, setMessage] = useState('');
  const [drawPreview, setDrawPreview] = useState('今天吃什么');
  const [drawShopNames, setDrawShopNames] = useState<string[]>([]);
  const [customGroups, setCustomGroups] = useState<CustomGroup[]>(initialGroups);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>(initialSelectedCategoryIds);
  const [selectedGroupId, setSelectedGroupId] = useState(initialGroups[0]?.id ?? '');
  const [newGroupName, setNewGroupName] = useState('');
  const [groupNameDraft, setGroupNameDraft] = useState('');
  const [groupFeedback, setGroupFeedback] = useState('');
  const [groupFeedbackTone, setGroupFeedbackTone] = useState<FeedbackTone>('info');
  const [nearbyFilter, setNearbyFilter] = useState('');
  const [selectedNearbyShopIds, setSelectedNearbyShopIds] = useState<string[]>([]);
  const [saveFeedback, setSaveFeedback] = useState('');
  const drawTimerRefs = useRef<number[]>([]);

  const selectedGroup = customGroups.find((group) => group.id === selectedGroupId) ?? customGroups[0];
  const isBusy = status === 'locating' || status === 'loading' || status === 'drawing' || status === 'revealing';
  const radiusLabel = RADIUS_OPTIONS.find((option) => option.meters === radiusMeters)?.label ?? '1.5 公里';
  const filteredNearbyResult = useMemo(() => filterShopsByRegex(shops, nearbyFilter), [shops, nearbyFilter]);
  const filteredNearbyShops = filteredNearbyResult.shops;
  const isNearbyPoolFresh = shops.length > 0 && loadedRadiusMeters === radiusMeters;
  const canReroll = Boolean(selectedShop && (mode === 'custom' || isNearbyPoolFresh));
  const mainActionLabel = isBusy ? '正在摇签' : mode === 'nearby' ? (canReroll ? '再摇一次' : '今天吃什么') : canReroll ? '再摇一次' : '抽一个';
  const shopCountText =
    mode === 'nearby'
      ? shops.length > 0
        ? `附近 ${shops.length} 家店`
        : '等你按下按钮'
      : selectedGroup
        ? `${selectedGroup.name} 已保存 ${selectedGroup.shops.length} 家`
        : '还没有分组';

  useEffect(() => {
    setGroupNameDraft(selectedGroup?.name ?? '');
  }, [selectedGroup?.id, selectedGroup?.name]);

  useEffect(() => {
    return () => {
      clearDrawTimers();
    };
  }, []);

  async function handleNearbyStart() {
    await queryNearbyShops(true);
  }

  async function handleFetchNearbyForCustom() {
    await queryNearbyShops(false);
  }

  async function queryNearbyShops(drawAfterLoad: boolean) {
    setStatus('locating');
    setMessage('');
    setSaveFeedback('');
    setSelectedShop(null);
    setCandidateShops([]);

    try {
      const position = await getCurrentPosition();
      setStatus('loading');

      const response = await fetch('/api/nearby-food', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          radius: radiusMeters
        })
      });
      const data = await readNearbyFoodResponse(response);

      if (!data) {
        throw new Error(API_EMPTY_RESPONSE_MESSAGE);
      }

      if (!response.ok) {
        throw new Error(data.error || '附近店铺查询失败');
      }

      if (!Array.isArray(data.shops)) {
        throw new Error('附近店铺接口返回格式不正确。');
      }

      const normalized = normalizeShops(data.shops);
      setShops(normalized);
      setNearbyMeta(data.meta);
      setLoadedRadiusMeters(radiusMeters);
      setSelectedNearbyShopIds((current) =>
        current.filter((shopId) => normalized.some((shop) => shop.id === shopId))
      );

      if (drawAfterLoad) {
        beginDraw(normalized, '附近没找到餐饮店，换个位置或稍后再试试。');
        return;
      }

      setStatus(normalized.length > 0 ? 'idle' : 'error');
      setMessage(normalized.length > 0 ? `已找到 ${normalized.length} 家附近店铺。` : '附近没找到餐饮店，换个位置或稍后再试试。');
    } catch (error) {
      clearDrawTimers();
      setStatus('error');
      setMessage(getFriendlyError(error));
    }
  }

  function handleCustomDraw() {
    const customPool = getSelectedCustomPool();
    beginDraw(customPool, `${selectedGroup?.name ?? '这个分组'}还没有保存店铺，请先从附近店铺勾选保存。`);
  }

  function handleReroll() {
    const pool = mode === 'nearby' ? shops : getSelectedCustomPool();
    beginDraw(
      pool,
      mode === 'nearby'
        ? '附近没找到餐饮店，换个位置或稍后再试试。'
        : '当前分组还没有保存店铺，请先从附近店铺勾选保存。'
    );
  }

  async function handlePrimaryAction() {
    if (mode === 'nearby') {
      if (canReroll) {
        handleReroll();
        return;
      }

      await handleNearbyStart();
      return;
    }

    if (canReroll) {
      handleReroll();
      return;
    }

    handleCustomDraw();
  }

  function beginDraw(pool: FoodShop[], emptyMessage: string) {
    const normalized = normalizeShops(pool);

    clearDrawTimers();

    if (normalized.length === 0) {
      setSelectedShop(null);
      setCandidateShops([]);
      setMessage(emptyMessage);
      setStatus('error');
      return;
    }

    const recommendation = chooseWeightedShop(normalized, selectedCategoryIds);

    if (!recommendation) {
      setStatus('error');
      setMessage(emptyMessage);
      return;
    }

    const timeline = createDrawTimeline(normalized, recommendation);
    let elapsedTime = 0;

    setMessage('');
    setSelectedShop(null);
    setCandidateShops([]);
    setDrawShopNames(normalized.map((shop) => shop.name).filter(Boolean));
    setDrawPreview(timeline[0]?.shop.name ?? recommendation.name);
    setStatus('drawing');

    timeline.forEach((step, index) => {
      elapsedTime += step.delay;

      const timerId = window.setTimeout(() => {
        setDrawPreview(step.shop.name);

        if (step.isFinal || index === timeline.length - 1) {
          setStatus('revealing');

          const revealTimerId = window.setTimeout(() => {
            clearDrawTimers();
            setSelectedShop(recommendation);
            setCandidateShops(
              getCandidateShops(normalized, recommendation, 6).map((shop) =>
                annotateShopCategory(shop, selectedCategoryIds)
              )
            );
            setStatus('ready');
          }, FINAL_REVEAL_DELAY_MS);

          drawTimerRefs.current.push(revealTimerId);
        }
      }, elapsedTime);

      drawTimerRefs.current.push(timerId);
    });
  }

  function changeMode(nextMode: DrawMode) {
    clearDrawTimers();
    setMode(nextMode);
    setCustomPanelMode('draw');
    setStatus('idle');
    setMessage('');
    setSelectedShop(null);
    setCandidateShops([]);
  }

  function changeRadius(nextRadiusMeters: number) {
    if (nextRadiusMeters === radiusMeters) {
      return;
    }

    clearDrawTimers();
    setRadiusMeters(nextRadiusMeters);
    setLoadedRadiusMeters(null);
    setNearbyMeta(undefined);
    setShops([]);
    setSelectedNearbyShopIds([]);
    setStatus('idle');
    setMessage('');
    setSaveFeedback('');
    setSelectedShop(null);
    setCandidateShops([]);
  }

  function selectCustomGroup(groupId: string) {
    clearDrawTimers();
    setSelectedGroupId(groupId);
    setStatus('idle');
    setMessage('');
    setSelectedShop(null);
    setCandidateShops([]);
  }

  function commitCustomGroups(nextGroups: CustomGroup[]) {
    const stableGroups = nextGroups.length > 0 ? nextGroups : loadCustomGroups(undefined);
    setCustomGroups(stableGroups);
    saveCustomGroups(getStorage(), stableGroups);
    setSelectedGroupId((currentGroupId) =>
      stableGroups.some((group) => group.id === currentGroupId) ? currentGroupId : stableGroups[0]?.id ?? ''
    );
  }

  function handleToggleCategory(categoryId: string) {
    const nextSelectedCategoryIds = toggleSelectedCategoryId(selectedCategoryIds, categoryId);
    setSelectedCategoryIds(nextSelectedCategoryIds);
    saveSelectedCategoryIds(getStorage(), nextSelectedCategoryIds);
  }

  function showGroupFeedback(text: string, tone: FeedbackTone = 'info') {
    setGroupFeedback(text);
    setGroupFeedbackTone(tone);
  }

  function handleAddGroup() {
    const result = addCustomGroup(customGroups, newGroupName);

    if (result.error) {
      showGroupFeedback(result.error, 'error');
      return;
    }

    commitCustomGroups(result.groups);
    selectCustomGroup(result.group?.id ?? selectedGroupId);
    setNewGroupName('');
    showGroupFeedback(`已创建 ${result.group?.name ?? '新分组'}。`);
  }

  function handleRenameGroup() {
    if (!selectedGroup) {
      return;
    }

    const result = renameCustomGroup(customGroups, selectedGroup.id, groupNameDraft);

    if (result.error) {
      showGroupFeedback(result.error, 'error');
      return;
    }

    commitCustomGroups(result.groups);
    showGroupFeedback('分组名称已保存。');
  }

  function handleDeleteGroup() {
    if (!selectedGroup || customGroups.length <= 1) {
      showGroupFeedback('至少保留一个分组。', 'error');
      return;
    }

    if (!window.confirm(`删除「${selectedGroup.name}」吗？`)) {
      return;
    }

    commitCustomGroups(deleteCustomGroup(customGroups, selectedGroup.id));
    showGroupFeedback('分组已删除。');
  }

  function handleSaveSelectedNearbyShops() {
    if (!selectedGroup) {
      return;
    }

    if (selectedNearbyShopIds.length === 0) {
      setSaveFeedback('先勾选店铺。');
      return;
    }

    const selectedNearbyShops = shops.filter((shop) => selectedNearbyShopIds.includes(shop.id));
    const result = saveShopsToGroup(customGroups, selectedGroup.id, selectedNearbyShops);

    if (result.error) {
      setSaveFeedback(result.error);
      return;
    }

    commitCustomGroups(result.groups);
    setSelectedNearbyShopIds([]);
    setSaveFeedback(`新增 ${result.savedCount} 个，已存在 ${result.skippedCount} 个。`);
  }

  function handleDeleteShop(shopId: string) {
    if (!selectedGroup) {
      return;
    }

    commitCustomGroups(deleteShopFromGroup(customGroups, selectedGroup.id, shopId));
  }

  function toggleNearbyShop(shopId: string) {
    setSelectedNearbyShopIds((current) =>
      current.includes(shopId) ? current.filter((currentId) => currentId !== shopId) : [...current, shopId]
    );
  }

  function getSelectedCustomPool(): FoodShop[] {
    return selectedGroup?.shops ?? [];
  }

  function clearDrawTimers() {
    drawTimerRefs.current.forEach((timerId) => window.clearTimeout(timerId));
    drawTimerRefs.current = [];
  }

  const emptyText =
    message ||
    (mode === 'custom' && selectedGroup && selectedGroup.shops.length === 0
      ? `${selectedGroup.name}还没有保存店铺，请先从附近店铺勾选保存。`
      : '按下按钮，让附近的店铺替你做决定。');

  return (
    <main className="app-shell">
      <section className="decision-panel" aria-labelledby="page-title">
        <div className="brand-row">
          <span className="brand-mark">
            <Logo />
          </span>
          <span>今天吃什么</span>
        </div>

        <div className="headline-block">
          <p className="eyebrow">{mode === 'nearby' ? `${radiusLabel}内真实店铺` : '自选组里抽签'}</p>
          <h1 id="page-title">把选择困难交给附近的饭香</h1>
          <p className="intro">附近随机和自选清单都能抽，签筒摇一摇，今天就它了。</p>
        </div>

        <div className="mode-switch" aria-label="抽取模式">
          <button type="button" className={mode === 'nearby' ? 'active' : ''} onClick={() => changeMode('nearby')}>
            随机抽取
          </button>
          <button type="button" className={mode === 'custom' ? 'active' : ''} onClick={() => changeMode('custom')}>
            自选抽取
          </button>
        </div>

        <RadiusSelector radiusMeters={radiusMeters} setRadiusMeters={changeRadius} />
        <CategorySelector selectedCategoryIds={selectedCategoryIds} onToggleCategory={handleToggleCategory} />

        {mode === 'custom' ? (
          <CustomGroupEditor
            panelMode={customPanelMode}
            customGroups={customGroups}
            selectedGroup={selectedGroup}
            selectedGroupId={selectedGroupId}
            onSelectGroup={selectCustomGroup}
            newGroupName={newGroupName}
            setNewGroupName={setNewGroupName}
            groupNameDraft={groupNameDraft}
            setGroupNameDraft={setGroupNameDraft}
            groupFeedback={groupFeedback}
            groupFeedbackTone={groupFeedbackTone}
            nearbyFilter={nearbyFilter}
            setNearbyFilter={setNearbyFilter}
            nearbyShops={filteredNearbyShops}
            nearbyShopCount={shops.length}
            nearbyFilterError={filteredNearbyResult.error}
            reachedProviderLimit={nearbyMeta?.reachedProviderLimit ?? false}
            selectedNearbyShopIds={selectedNearbyShopIds}
            saveFeedback={saveFeedback}
            isBusy={isBusy}
            onAddGroup={handleAddGroup}
            onRenameGroup={handleRenameGroup}
            onDeleteGroup={handleDeleteGroup}
            onFetchNearby={handleFetchNearbyForCustom}
            onToggleNearbyShop={toggleNearbyShop}
            onSaveSelectedNearbyShops={handleSaveSelectedNearbyShops}
            onDeleteShop={handleDeleteShop}
            onEditGroups={() => setCustomPanelMode('edit')}
            onBackToDraw={() => setCustomPanelMode('draw')}
          />
        ) : null}

        <div className="action-row">
          <button
            className="primary-button"
            type="button"
            onClick={handlePrimaryAction}
            disabled={isBusy}
          >
            {isBusy ? <LoaderCircle className="spin" size={20} /> : canReroll ? <RefreshCw size={20} /> : <Sparkles size={20} />}
            <span>{mainActionLabel}</span>
          </button>
        </div>

        <p className="privacy-note">定位只用于本次查询，高德 key 保存在 Cloudflare 后端；自选组只存在当前浏览器。</p>
      </section>

      <section className="result-area" aria-live="polite">
        <div className="status-strip">
          <span>{shopCountText}</span>
          <span>{mode === 'nearby' ? `默认 ${radiusLabel}` : `附近列表 ${shops.length} 家`}</span>
        </div>

        {selectedShop ? (
          <>
            <ShopResultCard shop={selectedShop} />
            {candidateShops.length > 0 ? (
              <div className="candidate-list">
                <h3>其他可以选项</h3>
                <div className="candidate-grid">
                  {candidateShops.map((shop) => (
                    <span key={shop.id}>
                      <strong>{shop.name}</strong>
                      <small>{shop.category?.name ?? (shop.distance ? `${shop.distance}m` : '其他餐饮')}</small>
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <div className="empty-state">
            <Logo />
            <p>{emptyText}</p>
          </div>
        )}
      </section>
      {status === 'drawing' || status === 'revealing' ? (
        <DrawOverlay drawPreview={drawPreview} shopNames={drawShopNames} isRevealing={status === 'revealing'} />
      ) : null}
    </main>
  );
}

function RadiusSelector({
  radiusMeters,
  setRadiusMeters
}: {
  radiusMeters: number;
  setRadiusMeters: (value: number) => void;
}) {
  return (
    <div className="control-block">
      <p className="control-title">默认半径</p>
      <div className="radius-options" aria-label="默认半径">
        {RADIUS_OPTIONS.map((option) => (
          <button
            key={option.meters}
            type="button"
            className={radiusMeters === option.meters ? 'selected' : ''}
            onClick={() => setRadiusMeters(option.meters)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function CategorySelector({
  selectedCategoryIds,
  onToggleCategory
}: {
  selectedCategoryIds: string[];
  onToggleCategory: (categoryId: string) => void;
}) {
  return (
    <div className="category-selector">
      <div className="category-selector-heading">
        <p className="control-title">今天偏向</p>
        <p className="preference-summary">选中的大类会提高抽中概率，不是过滤条件。</p>
      </div>
      <div className="category-chip-row" aria-label="今天偏向">
        {FOOD_CATEGORIES.map((category) => {
          const isSelected = selectedCategoryIds.includes(category.id);

          return (
            <button
              key={category.id}
              type="button"
              className={isSelected ? 'selected' : ''}
              aria-pressed={isSelected}
              onClick={() => onToggleCategory(category.id)}
            >
              <span>{category.name}</span>
              {isSelected ? <small>加权</small> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DrawOverlay({
  drawPreview,
  shopNames,
  isRevealing
}: {
  drawPreview: string;
  shopNames: string[];
  isRevealing: boolean;
}) {
  const rollingShopNames = createRollingShopNames(shopNames, drawPreview);

  return (
    <div className={`draw-overlay ${isRevealing ? 'revealing' : ''}`} role="status" aria-live="polite">
      <div className="draw-overlay-panel">
        <p className="draw-kicker">{isRevealing ? '抽中了，就是它' : '餐厅池正在滚动'}</p>
        <div className="lottery-stage">
          <div className="restaurant-slot-window">
            <div className="restaurant-stream" role="list" aria-label="滚动餐厅列表">
              {rollingShopNames.map((name, index) => (
                <span key={`${name}-${index}`} role="listitem">
                  {name}
                </span>
              ))}
            </div>
            <span className="slot-fade slot-fade-top" aria-hidden="true" />
            <span className="slot-fade slot-fade-bottom" aria-hidden="true" />
            <div className="lottery-frame">
              <span className="frame-label">{isRevealing ? '中奖锁定' : '抽奖框乱抽中'}</span>
              <strong className="draw-preview">{drawPreview}</strong>
            </div>
          </div>
          <div className="draw-sparks" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </div>
        </div>
        <div className="near-miss-track" aria-hidden="true">
          <span>快中了</span>
          <span>擦肩而过</span>
          <span>最后一签</span>
        </div>
        <div className="draw-meter" aria-hidden="true">
          <span />
        </div>
        <p className="draw-hint">
          <span>候选正在收窄</span>
          <span>差一点就定格，又被签筒摇走了</span>
        </p>
      </div>
    </div>
  );
}

function createRollingShopNames(shopNames: string[], drawPreview: string): string[] {
  const uniqueNames = Array.from(new Set(shopNames.filter((name) => name.trim())));
  const sourceNames = uniqueNames.length > 0 ? uniqueNames : [drawPreview];

  return Array.from({ length: 4 }, () => sourceNames).flat();
}

type CustomGroupEditorProps = {
  panelMode: CustomPanelMode;
  customGroups: CustomGroup[];
  selectedGroup: CustomGroup | undefined;
  selectedGroupId: string;
  onSelectGroup: (groupId: string) => void;
  newGroupName: string;
  setNewGroupName: (value: string) => void;
  groupNameDraft: string;
  setGroupNameDraft: (value: string) => void;
  groupFeedback: string;
  groupFeedbackTone: FeedbackTone;
  nearbyFilter: string;
  setNearbyFilter: (value: string) => void;
  nearbyShops: FoodShop[];
  nearbyShopCount: number;
  nearbyFilterError?: string;
  reachedProviderLimit: boolean;
  selectedNearbyShopIds: string[];
  saveFeedback: string;
  isBusy: boolean;
  onAddGroup: () => void;
  onRenameGroup: () => void;
  onDeleteGroup: () => void;
  onFetchNearby: () => void;
  onToggleNearbyShop: (shopId: string) => void;
  onSaveSelectedNearbyShops: () => void;
  onDeleteShop: (shopId: string) => void;
  onEditGroups: () => void;
  onBackToDraw: () => void;
};

function CustomGroupEditor({
  panelMode,
  customGroups,
  selectedGroup,
  selectedGroupId,
  onSelectGroup,
  newGroupName,
  setNewGroupName,
  groupNameDraft,
  setGroupNameDraft,
  groupFeedback,
  groupFeedbackTone,
  nearbyFilter,
  setNearbyFilter,
  nearbyShops,
  nearbyShopCount,
  nearbyFilterError,
  reachedProviderLimit,
  selectedNearbyShopIds,
  saveFeedback,
  isBusy,
  onAddGroup,
  onRenameGroup,
  onDeleteGroup,
  onFetchNearby,
  onToggleNearbyShop,
  onSaveSelectedNearbyShops,
  onDeleteShop,
  onEditGroups,
  onBackToDraw
}: CustomGroupEditorProps) {
  return (
    <div className="custom-editor">
      <div className="group-selector-row">
        <label>
          抽取分组
          <select value={selectedGroupId} onChange={(event) => onSelectGroup(event.target.value)}>
            {customGroups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </label>
        <span>{selectedGroup ? `${selectedGroup.shops.length} 家已保存` : '无分组'}</span>
        {panelMode === 'draw' ? (
          <button type="button" onClick={onEditGroups}>
            修改分组
          </button>
        ) : null}
      </div>

      {panelMode === 'edit' ? (
        <>
          <div className="panel-heading">
            <h2>编辑自选分组</h2>
            <button type="button" onClick={onBackToDraw}>
              返回抽取
            </button>
          </div>

          <div className="group-management">
            <div className="inline-form">
              <label>
                新建分组名称
                <input value={newGroupName} onChange={(event) => setNewGroupName(event.target.value)} />
              </label>
              <button type="button" onClick={onAddGroup}>
                <Plus size={16} />
                创建分组
              </button>
            </div>

            {selectedGroup ? (
              <div className="inline-form">
                <label>
                  重命名当前组
                  <input value={groupNameDraft} onChange={(event) => setGroupNameDraft(event.target.value)} />
                </label>
                <button type="button" onClick={onRenameGroup}>
                  保存名称
                </button>
                <button type="button" className="ghost-danger" onClick={onDeleteGroup} disabled={customGroups.length <= 1}>
                  <Trash2 size={16} />
                  删除当前组
                </button>
              </div>
            ) : null}
          </div>

          {groupFeedback ? <p className={`form-message ${groupFeedbackTone === 'error' ? 'error' : ''}`}>{groupFeedback}</p> : null}

          <div className="nearby-save-panel">
            <div className="panel-heading">
              <h2>附近店铺</h2>
              <button type="button" onClick={onFetchNearby} disabled={isBusy}>
                {isBusy ? <LoaderCircle className="spin" size={16} /> : <Search size={16} />}
                获取周围店铺
              </button>
            </div>

            <div className="nearby-list-toolbar">
              <label>
                筛选店铺（支持正则）
                <input value={nearbyFilter} onChange={(event) => setNearbyFilter(event.target.value)} />
              </label>
              <span className="shop-count-pill">
                显示 {nearbyShops.length} / {nearbyShopCount} 家
              </span>
            </div>
            {nearbyFilterError ? <p className="form-message error">{nearbyFilterError}</p> : null}
            {reachedProviderLimit ? <p className="form-message">已加载高德本次查询可返回的全部结果。</p> : null}

            <div className="nearby-shop-list dense-shop-list" role="list" aria-label="附近店铺列表">
              {nearbyShops.length > 0 ? (
                nearbyShops.map((shop) => (
                  <label className="nearby-shop-option" key={shop.id} role="listitem">
                    <input
                      type="checkbox"
                      checked={selectedNearbyShopIds.includes(shop.id)}
                      onChange={() => onToggleNearbyShop(shop.id)}
                    />
                    <span className="nearby-shop-content">
                      <strong>{shop.name}</strong>
                      <small>{formatShopLine(shop)}</small>
                    </span>
                    <span className="shop-row-meta">
                      {getShopMetricText(shop).map((item) => (
                        <small key={item}>{item}</small>
                      ))}
                    </span>
                  </label>
                ))
              ) : (
                <p className="muted-line">
                  {nearbyShopCount > 0 ? '没有匹配的店铺。' : '先获取周围店铺。'}
                </p>
              )}
            </div>

            <div className="save-row">
              <button type="button" onClick={onSaveSelectedNearbyShops} disabled={!selectedGroup || selectedNearbyShopIds.length === 0}>
                <Check size={16} />
                保存到当前组
              </button>
              <span>已勾选 {selectedNearbyShopIds.length} 家</span>
            </div>
            {saveFeedback ? <p className="form-message">{saveFeedback}</p> : null}
          </div>

          {selectedGroup ? (
            <div className="saved-shop-panel">
              <h2>当前组</h2>
              <div className="saved-shop-list dense-shop-list" role="list" aria-label="已保存店铺列表">
                {selectedGroup.shops.length > 0 ? (
                  selectedGroup.shops.map((shop) => (
                    <SavedShopItem key={shop.id} groupName={selectedGroup.name} shop={shop} onDeleteShop={onDeleteShop} />
                  ))
                ) : (
                  <p className="muted-line">还没有保存店铺。</p>
                )}
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function SavedShopItem({
  groupName,
  shop,
  onDeleteShop
}: {
  groupName: string;
  shop: SavedShop;
  onDeleteShop: (shopId: string) => void;
}) {
  return (
    <div className="saved-shop-item" role="listitem">
      <span>
        <strong>{shop.name}</strong>
        <small>{formatShopLine(shop)}</small>
      </span>
      <span className="shop-row-meta">
        {getShopMetricText(shop).map((item) => (
          <small key={item}>{item}</small>
        ))}
      </span>
      <button type="button" className="icon-danger" onClick={() => onDeleteShop(shop.id)} aria-label={`从${groupName}删除 ${shop.name}`}>
        <Trash2 size={16} />
      </button>
    </div>
  );
}

function ShopResultCard({ shop }: { shop: ClassifiedShop }) {
  const navigationHref = getAmapNavigationHref(shop);

  return (
    <article className="shop-card">
      <div className="card-topline">
        <span className="tag">今日推荐</span>
        {shop.distance ? <span>{shop.distance}m</span> : null}
      </div>
      {shop.category ? (
        <span className="category-tag">
          {shop.category.name} · {shop.category.weighted ? '已加权' : '普通'}
        </span>
      ) : null}
      <h2>{shop.name}</h2>
      {shop.address ? (
        <p className="address">
          <MapPin size={18} />
          <span>{shop.address}</span>
        </p>
      ) : null}
      {navigationHref ? (
        <a className="navigation-link" href={navigationHref} target="_blank" rel="noreferrer">
          <Navigation size={18} />
          <span>高德导航</span>
        </a>
      ) : null}
      <div className="meta-grid">
        <span>{shop.type?.split(';').slice(-1)[0] || '自选店铺'}</span>
        <span>{shop.rating ? `${shop.rating} 分` : '评分未知'}</span>
        <span>{formatCost(shop.cost, shop.note)}</span>
      </div>
    </article>
  );
}

function getAmapNavigationHref(shop: FoodShop): string | undefined {
  const location = parseAmapLocation(shop.location);

  if (!location) {
    return undefined;
  }

  const params = new URLSearchParams({
    to: `${location.lng},${location.lat},${shop.name}`,
    mode: 'walk',
    src: 'what-to-eat-today',
    callnative: '1'
  });

  return `https://uri.amap.com/navigation?${params.toString()}`;
}

function parseAmapLocation(location: string | undefined): { lng: string; lat: string } | undefined {
  if (!location) {
    return undefined;
  }

  const [lng, lat] = location.split(',').map((value) => value.trim());
  const numericLng = Number(lng);
  const numericLat = Number(lat);

  if (!lng || !lat || !Number.isFinite(numericLng) || !Number.isFinite(numericLat)) {
    return undefined;
  }

  if (numericLng < -180 || numericLng > 180 || numericLat < -90 || numericLat > 90) {
    return undefined;
  }

  return { lng, lat };
}

function formatShopLine(shop: FoodShop): string {
  return [shop.distance ? `${shop.distance}m` : undefined, shop.address, shop.type?.split(';').slice(-1)[0]]
    .filter(Boolean)
    .join(' · ') || '暂无更多信息';
}

function getShopMetricText(shop: FoodShop): string[] {
  return [
    shop.distance ? `${shop.distance}m` : undefined,
    shop.rating ? `${shop.rating}分` : undefined,
    shop.cost ? `人均 ${shop.cost}` : undefined
  ].filter((item): item is string => Boolean(item));
}

function formatCost(cost: string | undefined, note: string | undefined): string {
  if (!cost) {
    return note ? '有备注' : '人均未知';
  }

  const numericCost = Number(cost);
  return Number.isFinite(numericCost) ? `人均 ¥${numericCost.toFixed(0)}` : '人均未知';
}

function getCurrentPosition(): Promise<GeolocationPosition> {
  if (!navigator.geolocation) {
    return Promise.reject(new Error('当前浏览器不支持定位。'));
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000
    });
  });
}

async function readNearbyFoodResponse(
  response: Response
): Promise<(NearbyFoodResponse & { error?: string }) | null> {
  const text = await response.text();

  if (!text.trim()) {
    return null;
  }

  try {
    return JSON.parse(text) as NearbyFoodResponse & { error?: string };
  } catch {
    return null;
  }
}

function getFriendlyError(error: unknown): string {
  if (isGeolocationError(error)) {
    if (error.code === error.PERMISSION_DENIED) {
      return '定位被拒绝了，打开定位权限后再试一次。';
    }

    return '定位暂时失败了，换个网络环境再试试。';
  }

  return error instanceof Error ? error.message : '今天的饭还没摇出来，再试一次。';
}

function isGeolocationError(error: unknown): error is GeolocationPositionError {
  return typeof error === 'object' && error !== null && 'code' in error && 'PERMISSION_DENIED' in error;
}

function getStorage(): Storage | undefined {
  return typeof window === 'undefined' ? undefined : window.localStorage;
}

export default App;
