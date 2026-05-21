import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';

const STORAGE_KEY = 'what-to-eat:custom-groups:v1';
const DRAW_WAIT_OPTIONS = { timeout: 3500 };

function mockGeolocationSuccess() {
  const getCurrentPosition = vi.fn((success: PositionCallback) => {
    success({
      coords: {
        latitude: 31.2,
        longitude: 121.5,
        accuracy: 20,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null
      },
      timestamp: Date.now()
    } as GeolocationPosition);
  });

  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: { getCurrentPosition }
  });
}

function createFoodShops(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `shop-${index + 1}`,
    name: `餐厅 ${index + 1}`,
    distance: 100 + index,
    address: `美食路 ${index + 1} 号`,
    type: '餐饮;中餐'
  }));
}

describe('App', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('gets location, fetches nearby food, and shows a recommendation', async () => {
    mockGeolocationSuccess();
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      Response.json({
        shops: [
          { id: '1', name: '兰州牛肉面', distance: 220, address: '青年路', location: '121.500100,31.200200' },
          { id: '2', name: '煲仔饭', distance: 350, address: '中山路' }
        ]
      })
    );
    vi.spyOn(Math, 'random').mockReturnValue(0);

    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: '今天吃什么' }));

    expect(await screen.findByText('今日推荐', undefined, DRAW_WAIT_OPTIONS)).toBeInTheDocument();
    expect(screen.getByText('兰州牛肉面')).toBeInTheDocument();
    expect(screen.getByText('青年路')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '高德导航' })).toHaveAttribute(
      'href',
      expect.stringContaining('https://uri.amap.com/navigation?')
    );
    expect(screen.getByRole('link', { name: '高德导航' })).toHaveAttribute(
      'href',
      expect.stringContaining('callnative=1')
    );
    expect(screen.getByRole('link', { name: '高德导航' })).toHaveAttribute(
      'href',
      expect.stringContaining('mode=walk')
    );
    expect(screen.getByRole('link', { name: '高德导航' })).toHaveAttribute(
      'href',
      expect.stringContaining('to=121.500100%2C31.200200%2C%E5%85%B0%E5%B7%9E%E7%89%9B%E8%82%89%E9%9D%A2')
    );
    expect(screen.queryByRole('button', { name: '今天吃什么' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '再摇一次' })).toBeEnabled();
  });

  it('rerolls nearby food from the current pool without fetching again', async () => {
    mockGeolocationSuccess();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      Response.json({
        shops: [
          { id: '1', name: '兰州牛肉面', distance: 220, address: '青年路' },
          { id: '2', name: '煲仔饭', distance: 350, address: '中山路' }
        ]
      })
    );
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);

    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: '今天吃什么' }));
    expect(await screen.findByText('今日推荐', undefined, DRAW_WAIT_OPTIONS)).toBeInTheDocument();
    expect(screen.getByText('兰州牛肉面')).toBeInTheDocument();

    randomSpy.mockReturnValue(0.8);
    await userEvent.click(screen.getByRole('button', { name: '再摇一次' }));

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('今日推荐', undefined, DRAW_WAIT_OPTIONS)).toBeInTheDocument();
    expect(screen.getByText('煲仔饭')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '今天吃什么' })).not.toBeInTheDocument();
  }, 10000);

  it('resets the nearby action to fetch again after the radius changes', async () => {
    mockGeolocationSuccess();
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        Response.json({
          shops: [{ id: '1', name: '砂锅饭', distance: 180, address: '桂花路' }]
        })
      )
      .mockResolvedValueOnce(
        Response.json({
          shops: [{ id: '2', name: '烤肉饭', distance: 260, address: '银杏路' }]
        })
      );

    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: '今天吃什么' }));
    await screen.findByText('今日推荐', undefined, DRAW_WAIT_OPTIONS);
    expect(screen.getByText('砂锅饭')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '3 公里' }));

    expect(screen.getByRole('button', { name: '今天吃什么' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: '再摇一次' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '今天吃什么' }));
    await screen.findByText('今日推荐', undefined, DRAW_WAIT_OPTIONS);
    expect(screen.getByText('烤肉饭')).toBeInTheDocument();

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchSpy.mock.calls[1][1]?.body as string)).toMatchObject({ radius: 3000 });
  }, 10000);

  it('uses the selected radius preset when fetching nearby food', async () => {
    mockGeolocationSuccess();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      Response.json({
        shops: [{ id: '1', name: '砂锅饭', distance: 180, address: '桂花路' }]
      })
    );

    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: '3 公里' }));
    await userEvent.click(screen.getByRole('button', { name: '今天吃什么' }));

    await screen.findByText('今日推荐', undefined, DRAW_WAIT_OPTIONS);
    expect(screen.getByText('砂锅饭')).toBeInTheDocument();
    expect(JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)).toMatchObject({
      radius: 3000
    });
  });

  it('switches to custom draw mode and prompts when the selected group is empty', async () => {
    render(<App />);

    await userEvent.click(screen.getByRole('button', { name: '自选抽取' }));

    expect(screen.getByLabelText('抽取分组')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '修改分组' })).toBeInTheDocument();
    expect(screen.queryByLabelText('新建分组名称')).not.toBeInTheDocument();
    expect(screen.getByText('清淡组还没有保存店铺，请先从附近店铺勾选保存。')).toBeInTheDocument();
  });

  it('separates custom drawing from group editing', async () => {
    render(<App />);

    await userEvent.click(screen.getByRole('button', { name: '自选抽取' }));
    expect(screen.queryByLabelText('新建分组名称')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '修改分组' }));

    expect(screen.getByRole('heading', { name: '编辑自选分组' })).toBeInTheDocument();
    expect(screen.getByLabelText('新建分组名称')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '返回抽取' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '返回抽取' }));

    expect(screen.getByLabelText('抽取分组')).toBeInTheDocument();
    expect(screen.queryByLabelText('新建分组名称')).not.toBeInTheDocument();
  });

  it('creates groups separately from renaming and rejects duplicate names', async () => {
    render(<App />);

    await userEvent.click(screen.getByRole('button', { name: '自选抽取' }));
    await userEvent.click(screen.getByRole('button', { name: '修改分组' }));
    await userEvent.type(screen.getByLabelText('新建分组名称'), '清淡组');
    await userEvent.click(screen.getByRole('button', { name: '创建分组' }));

    expect(screen.getByText('已有同名分组。')).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText('新建分组名称'));
    await userEvent.type(screen.getByLabelText('新建分组名称'), '夜宵组');
    await userEvent.click(screen.getByRole('button', { name: '创建分组' }));

    expect(screen.getByRole('option', { name: '夜宵组' })).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText('重命名当前组'));
    await userEvent.type(screen.getByLabelText('重命名当前组'), '食肉组');
    await userEvent.click(screen.getByRole('button', { name: '保存名称' }));

    expect(screen.getByText('已有同名分组。')).toBeInTheDocument();
  });

  it('fetches nearby shops in custom mode, filters, saves selections, and draws from the saved group', async () => {
    mockGeolocationSuccess();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      Response.json({
        shops: [
          { id: '1', name: '兰州牛肉面', distance: 220, address: '青年路', type: '餐饮;快餐' },
          { id: '2', name: '煲仔饭', distance: 350, address: '中山路', type: '餐饮;粤菜' },
          { id: '3', name: '潮汕火锅', distance: 480, address: '人民路', type: '餐饮;火锅' },
          ...createFoodShops(30)
        ],
        meta: {
          fetchedPages: 2,
          reachedProviderLimit: false
        }
      })
    );
    vi.spyOn(Math, 'random').mockReturnValue(0);

    render(<App />);

    await userEvent.click(screen.getByRole('button', { name: '自选抽取' }));
    await userEvent.click(screen.getByRole('button', { name: '修改分组' }));
    await userEvent.click(screen.getByRole('button', { name: '3 公里' }));
    await userEvent.click(screen.getByRole('button', { name: '获取周围店铺' }));

    expect(await screen.findByRole('checkbox', { name: /兰州牛肉面/ })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: '附近店铺列表' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /餐厅 30/ })).toBeInTheDocument();
    expect(screen.getByText('已找到 33 家附近店铺。')).toBeInTheDocument();
    expect(JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)).toMatchObject({ radius: 3000 });

    await userEvent.type(screen.getByLabelText('筛选店铺（支持正则）'), '青年|火锅');

    expect(screen.getByRole('checkbox', { name: /兰州牛肉面/ })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /潮汕火锅/ })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /煲仔饭/ })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('checkbox', { name: /兰州牛肉面/ }));
    await userEvent.click(screen.getByRole('checkbox', { name: /潮汕火锅/ }));
    await userEvent.click(screen.getByRole('button', { name: '保存到当前组' }));

    expect(screen.getByText('新增 2 个，已存在 0 个。')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')[0].shops).toEqual([
      expect.objectContaining({ id: '1', name: '兰州牛肉面', savedAt: expect.any(String) }),
      expect.objectContaining({ id: '3', name: '潮汕火锅', savedAt: expect.any(String) })
    ]);

    await userEvent.click(screen.getByRole('button', { name: '抽一个' }));

    expect(screen.getByText('签筒正在摇')).toBeInTheDocument();
    expect(screen.getByText('候选正在收窄')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '正在摇签' })).toBeDisabled();
    expect(await screen.findByText('今日推荐', undefined, DRAW_WAIT_OPTIONS)).toBeInTheDocument();
  });

  it('shows a provider limit hint when nearby results reach the Amap paging limit', async () => {
    mockGeolocationSuccess();
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      Response.json({
        shops: createFoodShops(200),
        meta: {
          fetchedPages: 8,
          reachedProviderLimit: true
        }
      })
    );

    render(<App />);

    await userEvent.click(screen.getByRole('button', { name: '自选抽取' }));
    await userEvent.click(screen.getByRole('button', { name: '修改分组' }));
    await userEvent.click(screen.getByRole('button', { name: '获取周围店铺' }));

    expect(await screen.findByText('已加载高德本次查询可返回的全部结果。')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /餐厅 200/ })).toBeInTheDocument();
  });

  it('clears the custom draw result after switching groups', async () => {
    const now = '2026-05-21T00:00:00.000Z';
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        {
          id: 'light',
          name: '清淡组',
          shops: [{ id: 'shop-a', name: '粥铺', savedAt: now }],
          createdAt: now,
          updatedAt: now
        },
        {
          id: 'meat',
          name: '食肉组',
          shops: [{ id: 'shop-b', name: '烤肉饭', savedAt: now }],
          createdAt: now,
          updatedAt: now
        }
      ])
    );
    vi.spyOn(Math, 'random').mockReturnValue(0);

    render(<App />);

    await userEvent.click(screen.getByRole('button', { name: '自选抽取' }));
    await userEvent.click(screen.getByRole('button', { name: '抽一个' }));
    expect(await screen.findByText('今日推荐', undefined, DRAW_WAIT_OPTIONS)).toBeInTheDocument();
    expect(screen.getByText('粥铺')).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('抽取分组'), 'meat');

    expect(screen.queryByText('粥铺')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '抽一个' })).toBeEnabled();
  });

  it('keeps the nearby list visible and shows a message for invalid regex filters', async () => {
    mockGeolocationSuccess();
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      Response.json({
        shops: [
          { id: '1', name: '兰州牛肉面', distance: 220, address: '青年路', type: '餐饮;快餐' },
          { id: '2', name: '煲仔饭', distance: 350, address: '中山路', type: '餐饮;粤菜' }
        ]
      })
    );

    render(<App />);

    await userEvent.click(screen.getByRole('button', { name: '自选抽取' }));
    await userEvent.click(screen.getByRole('button', { name: '修改分组' }));
    await userEvent.click(screen.getByRole('button', { name: '获取周围店铺' }));
    await screen.findByRole('checkbox', { name: /兰州牛肉面/ });
    await userEvent.type(screen.getByLabelText('筛选店铺（支持正则）'), '(');

    expect(screen.getByText('正则表达式无效')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /兰州牛肉面/ })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /煲仔饭/ })).toBeInTheDocument();
  });

  it('shows a friendly message when geolocation is denied', async () => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: vi.fn((_success: PositionCallback, error: PositionErrorCallback) => {
          error({ code: 1, message: 'denied', PERMISSION_DENIED: 1 } as GeolocationPositionError);
        })
      }
    });

    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: '今天吃什么' }));

    await waitFor(() => {
      expect(screen.getByText('定位被拒绝了，打开定位权限后再试一次。')).toBeInTheDocument();
    });
  });

  it('shows a deployment hint when the food API returns an empty response', async () => {
    mockGeolocationSuccess();
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('', { status: 404 }));

    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: '今天吃什么' }));

    expect(
      await screen.findByText('附近店铺接口没有返回有效内容，请确认 Cloudflare Pages Function 已部署。')
    ).toBeInTheDocument();
  });
});
