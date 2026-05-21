import type { FoodShop, NearbyFoodRequest, NearbyFoodResponse } from '../../src/types';

type Env = {
  AMAP_WEB_SERVICE_KEY?: string;
};

type FunctionContext = {
  request: Request;
  env: Env;
};

type AmapConvertResponse = {
  status?: string;
  info?: string;
  locations?: string;
};

type AmapPoi = {
  id?: string;
  name?: string;
  address?: string | string[];
  distance?: string | number;
  type?: string;
  location?: string;
  business?: {
    rating?: string;
    cost?: string;
  };
};

type AmapPoiResponse = {
  status?: string;
  info?: string;
  pois?: AmapPoi[];
};

const AMAP_CONVERT_URL = 'https://restapi.amap.com/v3/assistant/coordinate/convert';
const AMAP_AROUND_URL = 'https://restapi.amap.com/v5/place/around';
const DEFAULT_RADIUS = 1500;
const MAX_RADIUS = 5000;
const PAGE_SIZE = 25;
const MAX_PAGE_NUM = 8;
const PAGE_DELAY_MS = 250;

export async function onRequestPost(context: FunctionContext): Promise<Response> {
  if (!context.env.AMAP_WEB_SERVICE_KEY) {
    return json({ error: '服务端还没有配置高德 API key' }, 500);
  }

  let payload: NearbyFoodRequest;

  try {
    payload = (await context.request.json()) as NearbyFoodRequest;
  } catch {
    return json({ error: '请求格式不正确' }, 400);
  }

  if (!isValidCoordinate(payload.lat, payload.lng)) {
    return json({ error: '请提供有效的经纬度' }, 400);
  }

  try {
    const radius = clampRadius(payload.radius);
    const amapLocation = await convertToAmapCoordinate(
      payload.lng,
      payload.lat,
      context.env.AMAP_WEB_SERVICE_KEY
    );
    const nearbyFood = await fetchNearbyFood(amapLocation, radius, context.env.AMAP_WEB_SERVICE_KEY);

    return json<NearbyFoodResponse>(nearbyFood);
  } catch (error) {
    const message = error instanceof Error ? error.message : '附近店铺查询失败';
    return json({ error: message }, 502);
  }
}

export async function onRequestOptions(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: corsHeaders()
  });
}

function isValidCoordinate(lat: unknown, lng: unknown): lat is number {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

function clampRadius(radius: unknown): number {
  if (typeof radius !== 'number' || !Number.isFinite(radius)) {
    return DEFAULT_RADIUS;
  }

  return Math.min(Math.max(Math.round(radius), 300), MAX_RADIUS);
}

async function convertToAmapCoordinate(lng: number, lat: number, key: string): Promise<string> {
  const url = new URL(AMAP_CONVERT_URL);
  url.searchParams.set('key', key);
  url.searchParams.set('locations', `${lng},${lat}`);
  url.searchParams.set('coordsys', 'gps');
  url.searchParams.set('output', 'json');

  const response = await fetch(url);
  const data = (await response.json()) as AmapConvertResponse;

  if (!response.ok || data.status !== '1' || !data.locations) {
    throw new Error(data.info || '坐标转换失败');
  }

  return data.locations.split(';')[0];
}

async function fetchNearbyFood(location: string, radius: number, key: string): Promise<NearbyFoodResponse> {
  const seen = new Set<string>();
  const shops: FoodShop[] = [];
  let fetchedPages = 0;
  let reachedProviderLimit = false;

  for (let pageNum = 1; pageNum <= MAX_PAGE_NUM; pageNum += 1) {
    const pois = await fetchNearbyFoodPage(location, radius, key, pageNum);
    fetchedPages = pageNum;
    shops.push(...normalizePois(pois, seen));

    if (pois.length < PAGE_SIZE) {
      return {
        shops,
        meta: {
          fetchedPages,
          reachedProviderLimit: false
        }
      };
    }

    reachedProviderLimit = pageNum === MAX_PAGE_NUM;

    if (!reachedProviderLimit) {
      await delay(PAGE_DELAY_MS);
    }
  }

  return {
    shops,
    meta: {
      fetchedPages,
      reachedProviderLimit
    }
  };
}

async function fetchNearbyFoodPage(location: string, radius: number, key: string, pageNum: number): Promise<AmapPoi[]> {
  const url = new URL(AMAP_AROUND_URL);
  url.searchParams.set('key', key);
  url.searchParams.set('location', location);
  url.searchParams.set('radius', String(radius));
  url.searchParams.set('types', '050000');
  url.searchParams.set('page_size', String(PAGE_SIZE));
  url.searchParams.set('page_num', String(pageNum));
  url.searchParams.set('show_fields', 'business');
  url.searchParams.set('output', 'json');

  const response = await fetch(url);
  const data = (await response.json()) as AmapPoiResponse;

  if (!response.ok || data.status !== '1') {
    throw new Error(data.info || '附近餐饮查询失败');
  }

  return data.pois ?? [];
}

function normalizePois(pois: AmapPoi[], seen = new Set<string>()): FoodShop[] {
  const shops: FoodShop[] = [];

  for (const poi of pois) {
    const name = poi.name?.trim() ?? '';
    const id = poi.id?.trim() ?? '';

    if (!name || !id || seen.has(id)) {
      continue;
    }

    seen.add(id);
    shops.push({
      id,
      name,
      address: normalizeAddress(poi.address),
      distance: normalizeDistance(poi.distance),
      type: poi.type,
      location: poi.location,
      rating: poi.business?.rating,
      cost: poi.business?.cost
    });
  }

  return shops;
}

function normalizeAddress(address: AmapPoi['address']): string | undefined {
  if (Array.isArray(address)) {
    return address.filter(Boolean).join('');
  }

  return address?.trim() || undefined;
}

function normalizeDistance(distance: AmapPoi['distance']): number | undefined {
  const value = typeof distance === 'string' ? Number(distance) : distance;
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function json<T>(body: T, status = 200): Response {
  return Response.json(body, {
    status,
    headers: corsHeaders()
  });
}

function corsHeaders(): HeadersInit {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
}
