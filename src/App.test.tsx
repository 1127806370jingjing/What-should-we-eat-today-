import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';

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

describe('App', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('gets location, fetches nearby food, and shows a recommendation', async () => {
    mockGeolocationSuccess();
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      Response.json({
        shops: [
          { id: '1', name: '兰州牛肉面', distance: 220, address: '青年路' },
          { id: '2', name: '煲仔饭', distance: 350, address: '中山路' }
        ]
      })
    );
    vi.spyOn(Math, 'random').mockReturnValue(0);

    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: '今天吃什么' }));

    expect(await screen.findByText('兰州牛肉面')).toBeInTheDocument();
    expect(screen.getByText('青年路')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '再摇一次' })).toBeEnabled();
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
