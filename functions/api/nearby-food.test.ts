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

describe('nearby-food function', () => {
  afterEach(() => {
    vi.restoreAllMocks();
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
      ]
    });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy.mock.calls[1][0].toString()).toContain('radius=5000');
    expect(fetchSpy.mock.calls[1][0].toString()).toContain('types=050000');
  });
});
