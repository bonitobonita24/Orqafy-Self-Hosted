import { describe, expect, it, vi } from 'vitest';

import { createOcrClient } from './ocr';

describe('createOcrClient', () => {
  it('POSTs the bytes as multipart and returns the parsed extraction', async () => {
    const fetchImpl = vi.fn<typeof fetch>(() =>
      Promise.resolve(
        new Response(JSON.stringify({ text: 'INVOICE PRJ-017', engine: 'rapidocr', pages: 1 }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );
    const client = createOcrClient({ baseUrl: 'http://ocr:9003', fetchImpl });

    const out = await client.extract({
      body: new Uint8Array([1, 2, 3]),
      contentType: 'image/png',
      filename: 'scan.png',
    });

    expect(out).toEqual({ text: 'INVOICE PRJ-017', engine: 'rapidocr', pages: 1 });
    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('http://ocr:9003/ocr');
    expect((init as RequestInit).method).toBe('POST');
    expect((init as RequestInit).body).toBeInstanceOf(FormData);
  });

  it('throws when the sidecar returns a non-2xx status', async () => {
    const fetchImpl = vi.fn<typeof fetch>(() => Promise.resolve(new Response('boom', { status: 500 })));
    const client = createOcrClient({ baseUrl: 'http://ocr:9003', fetchImpl });
    await expect(
      client.extract({ body: new Uint8Array([1]), contentType: 'image/png', filename: 'x.png' }),
    ).rejects.toThrow(/OCR sidecar/);
  });
});
