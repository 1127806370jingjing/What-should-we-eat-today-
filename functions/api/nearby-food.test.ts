import { afterEach, describe, expect, it, vi } from 'vitest';
import { onRequestPost } from './nearby-food';

type TestEnv = {
  AMAP_WEB_SERVICE_KEY?: string;
};

function createContext(body: unknown, env: TestEnv = { AMAP_WEB_SERVICE_KEY: 'test-key' }) {
  return {
    request: new Request('https://example.com/api/nearby-food', {
      method: 'POST',
      body: JSON.stringify(body)
    }),
    env
  };
}

function createPoi(id: string) {
  return {
    id,
    name: `餐厅 ${id}`,
    address: `美食路 ${id} 号`,
    distance: '120',
    type: '餐饮服务;中餐厅',
    location: '121.500100,31.200200'
  };
}

function createPois(prefix: string, count: number) {
  return Array.from({ length: count }, (_, index) => createPoi(`${prefix}-${index + 1}`));
}

describe('nearby-food function', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('rejects invalid coordinates', async () => {
    const response = await onRequestPost(createContext({ lat: 'bad', lng: 121 }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: '请提供有效的经纬度'
    });
  });

  it('does not call Amap when the API key is missing', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const response = await onRequestPost(createContext({ lat: 31.2, lng: 121.5 }, {}));

    expect(response.status).toBe(500);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('converts coordinates, fetches food POIs, and returns normalized shops', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    fetchSpy
      .mockResolvedValueOnce(
        Response.json({
          status: '1',
          locations: '121.500000,31.200000'
        })
      )
      .mockResolvedValueOnce(
        Response.json({
          status: '1',
          pois: [
            {
              id: 'poi-1',
              name: '热干面小馆',
              address: '幸福路 8 号',
              distance: '312',
              type: '餐饮服务;中餐厅',
              location: '121.500100,31.200200',
              business: {
                rating: '4.7',
                cost: '28.00'
              }
            },
            {
              id: 'poi-2',
              name: '',
              address: '空名路'
            }
          ]
        })
      );

    const response = await onRequestPost(createContext({ lat: 31.2, lng: 121.5, radius: 9000 }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      shops: [
        {
          id: 'poi-1',
          name: '热干面小馆',
          address: '幸福路 8 号',
          distance: 312,
          type: '餐饮服务;中餐厅',
          location: '121.500100,31.200200',
          rating: '4.7',
          cost: '28.00'
        }
      ],
      meta: {
        fetchedPages: 1,
        reachedProviderLimit: false
      }
    });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy.mock.calls[1][0].toString()).toContain('radius=5000');
    expect(fetchSpy.mock.calls[1][0].toString()).toContain('types=050000');
  });

  it('fetches every available POI page and stops when a page has fewer than 25 items', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    fetchSpy
      .mockResolvedValueOnce(Response.json({ status: '1', locations: '121.500000,31.200000' }))
      .mockResolvedValueOnce(Response.json({ status: '1', pois: createPois('p1', 25) }))
      .mockResolvedValueOnce(Response.json({ status: '1', pois: createPois('p2', 25) }))
      .mockResolvedValueOnce(Response.json({ status: '1', pois: createPois('p3', 10) }));

    const response = await onRequestPost(createContext({ lat: 31.2, lng: 121.5, radius: 1500 }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.shops).toHaveLength(60);
    expect(data.meta).toEqual({
      fetchedPages: 3,
      reachedProviderLimit: false
    });
    expect(fetchSpy).toHaveBeenCalledTimes(4);
    expect(fetchSpy.mock.calls.slice(1).map(([url]) => new URL(url.toString()).searchParams.get('page_num'))).toEqual([
      '1',
      '2',
      '3'
    ]);
  });

  it('deduplicates shops across pages by POI id', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const firstPage = [...createPois('p1', 24), createPoi('duplicate')];
    const secondPage = [createPoi('duplicate'), ...createPois('p2', 9)];

    fetchSpy
      .mockResolvedValueOnce(Response.json({ status: '1', locations: '121.500000,31.200000' }))
      .mockResolvedValueOnce(Response.json({ status: '1', pois: firstPage }))
      .mockResolvedValueOnce(Response.json({ status: '1', pois: secondPage }));

    const response = await onRequestPost(createContext({ lat: 31.2, lng: 121.5, radius: 1500 }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.shops).toHaveLength(34);
    expect(data.shops.filter((shop: { id: string }) => shop.id === 'duplicate')).toHaveLength(1);
  });

  it('stops after the provider page limit and reports that limit was reached', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    fetchSpy.mockResolvedValueOnce(Response.json({ status: '1', locations: '121.500000,31.200000' }));

    for (let page = 1; page <= 8; page += 1) {
      fetchSpy.mockResolvedValueOnce(Response.json({ status: '1', pois: createPois(`p${page}`, 25) }));
    }

    const response = await onRequestPost(createContext({ lat: 31.2, lng: 121.5, radius: 1500 }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.shops).toHaveLength(200);
    expect(data.meta).toEqual({
      fetchedPages: 8,
      reachedProviderLimit: true
    });
    expect(fetchSpy).toHaveBeenCalledTimes(9);
  });

  it('paces follow-up page requests to avoid Amap QPS limits', async () => {
    vi.useFakeTimers();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    fetchSpy
      .mockResolvedValueOnce(Response.json({ status: '1', locations: '121.500000,31.200000' }))
      .mockResolvedValueOnce(Response.json({ status: '1', pois: createPois('p1', 25) }))
      .mockResolvedValueOnce(Response.json({ status: '1', pois: createPois('p2', 1) }));

    const responsePromise = onRequestPost(createContext({ lat: 31.2, lng: 121.5, radius: 1500 }));
    await vi.advanceTimersByTimeAsync(0);

    expect(fetchSpy).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(249);
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(1);
    const response = await responsePromise;

    expect(response.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it('returns a readable error if a later POI page fails', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    fetchSpy
      .mockResolvedValueOnce(Response.json({ status: '1', locations: '121.500000,31.200000' }))
      .mockResolvedValueOnce(Response.json({ status: '1', pois: createPois('p1', 25) }))
      .mockResolvedValueOnce(Response.json({ status: '0', info: 'DAILY_QUERY_OVER_LIMIT' }));

    const response = await onRequestPost(createContext({ lat: 31.2, lng: 121.5, radius: 1500 }));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: 'DAILY_QUERY_OVER_LIMIT'
    });
  });
});
