import { LoaderCircle, MapPin, RefreshCw, Sparkles, Utensils } from 'lucide-react';
import { useMemo, useState } from 'react';
import { chooseShop, normalizeShops } from './lib/recommend';
import type { FoodShop, NearbyFoodResponse } from './types';
import './styles.css';

type Status = 'idle' | 'locating' | 'loading' | 'ready' | 'error';

const DEFAULT_RADIUS = 1500;
const API_EMPTY_RESPONSE_MESSAGE = '附近店铺接口没有返回有效内容，请确认 Cloudflare Pages Function 已部署。';

function App() {
  const [status, setStatus] = useState<Status>('idle');
  const [shops, setShops] = useState<FoodShop[]>([]);
  const [selectedShop, setSelectedShop] = useState<FoodShop | null>(null);
  const [message, setMessage] = useState('');

  const shopCountText = useMemo(() => {
    if (shops.length === 0) {
      return '等你按下按钮';
    }

    return `附近 ${shops.length} 家店`;
  }, [shops.length]);

  async function handleStart() {
    setStatus('locating');
    setMessage('');
    setSelectedShop(null);

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
          radius: DEFAULT_RADIUS
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
      const recommendation = chooseShop(normalized);

      if (!recommendation) {
        setShops([]);
        setSelectedShop(null);
        setMessage('附近没找到餐饮店，换个位置或稍后再试试。');
        setStatus('error');
        return;
      }

      setShops(normalized);
      setSelectedShop(recommendation);
      setStatus('ready');
    } catch (error) {
      setStatus('error');
      setMessage(getFriendlyError(error));
    }
  }

  function handleReroll() {
    const nextShop = chooseShop(shops);

    if (nextShop) {
      setSelectedShop(nextShop);
      setMessage('');
      setStatus('ready');
    }
  }

  const isBusy = status === 'locating' || status === 'loading';

  return (
    <main className="app-shell">
      <section className="decision-panel" aria-labelledby="page-title">
        <div className="brand-row">
          <span className="brand-mark" aria-hidden="true">
            <Utensils size={24} />
          </span>
          <span>今天吃什么</span>
        </div>

        <div className="headline-block">
          <p className="eyebrow">1.5 公里内真实店铺</p>
          <h1 id="page-title">把选择困难交给附近的饭香</h1>
          <p className="intro">定位后自动找周围餐饮店，轻轻一摇，今天就它了。</p>
        </div>

        <div className="action-row">
          <button className="primary-button" type="button" onClick={handleStart} disabled={isBusy}>
            {isBusy ? <LoaderCircle className="spin" size={20} /> : <Sparkles size={20} />}
            <span>{isBusy ? '正在寻找' : '今天吃什么'}</span>
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={handleReroll}
            disabled={shops.length === 0 || isBusy}
          >
            <RefreshCw size={19} />
            <span>再摇一次</span>
          </button>
        </div>

        <p className="privacy-note">定位只用于本次查询，高德 key 保存在 Cloudflare 后端。</p>
      </section>

      <section className="result-area" aria-live="polite">
        <div className="status-strip">
          <span>{shopCountText}</span>
          <span>默认 1.5km</span>
        </div>

        {selectedShop ? (
          <article className="shop-card">
            <div className="card-topline">
              <span className="tag">今日推荐</span>
              {selectedShop.distance ? <span>{selectedShop.distance}m</span> : null}
            </div>
            <h2>{selectedShop.name}</h2>
            {selectedShop.address ? (
              <p className="address">
                <MapPin size={18} />
                <span>{selectedShop.address}</span>
              </p>
            ) : null}
            <div className="meta-grid">
              <span>{selectedShop.type?.split(';').slice(-1)[0] || '餐饮店'}</span>
              <span>{selectedShop.rating ? `${selectedShop.rating} 分` : '评分未知'}</span>
              <span>{selectedShop.cost ? `人均 ¥${Number(selectedShop.cost).toFixed(0)}` : '人均未知'}</span>
            </div>
          </article>
        ) : (
          <div className="empty-state">
            <Sparkles size={34} />
            <p>{message || '按下按钮，让附近的店铺替你做决定。'}</p>
          </div>
        )}

        {message && selectedShop ? <p className="message">{message}</p> : null}
      </section>
    </main>
  );
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

export default App;
