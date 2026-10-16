"""
PairLink Cafe - 八雲ソフトウェア公式サイト 自動スクロール紹介ツール

初回セットアップ（PowerShell）:
    py -m pip install playwright
    py -m playwright install chromium

実行:
    py yakumo_auto_scroll.py

操作:
    Space : 一時停止 / 再開
    ↑ / ↓ : スクロール速度を調整
    R     : ページ先頭に戻る
    Q / Esc: 終了

※ 発表用PCで実行するローカルツールです。
    公式サイト自体や公開Webサイトのコードは変更しません。
"""

import asyncio
from playwright.async_api import async_playwright

URL = "https://8clouds.co.jp/"
SCROLL_PIXELS_PER_TICK = 1.2
TICK_SECONDS = 0.035
BOTTOM_PAUSE_SECONDS = 5
START_AT_TOP = True

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page(viewport={"width": 1440, "height": 900})
        await page.goto(URL, wait_until="domcontentloaded", timeout=60000)
        await page.wait_for_timeout(1800)

        # ページ側にキーボード操作を登録。スクロールは自動化ツールから行う。
        await page.evaluate("""() => {
        window.__pairlinkPaused = false;
        window.__pairlinkQuit = false;
        window.__pairlinkSpeed = 1.2;
        window.addEventListener('keydown', (e) => {
        if (e.code === 'Space') {
            e.preventDefault();
            window.__pairlinkPaused = !window.__pairlinkPaused;
        } else if (e.key === 'ArrowUp') {
            window.__pairlinkSpeed = Math.max(0.2, window.__pairlinkSpeed - 0.2);
        } else if (e.key === 'ArrowDown') {
            window.__pairlinkSpeed = Math.min(8, window.__pairlinkSpeed + 0.2);
        } else if (e.key.toLowerCase() === 'r') {
            window.scrollTo({top: 0, behavior: 'smooth'});
        } else if (e.key.toLowerCase() === 'q' || e.key === 'Escape') {
            window.__pairlinkQuit = true;
        }
        });
    }""")

        if START_AT_TOP:
            await page.evaluate("window.scrollTo(0, 0)")
        print("自動スクロール中です。Space: 停止/再開、↑↓: 速度調整、R: 最上部、Q/Esc: 終了")

        try:
            while True:
                state = await page.evaluate("""() => ({
                    paused: window.__pairlinkPaused,
                    quit: window.__pairlinkQuit,
                    speed: window.__pairlinkSpeed,
                    y: window.scrollY,
                    max: Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
                })""")

                if state["quit"]:
                    break

                if state["paused"]:
                    await page.wait_for_timeout(100)
                    continue

                if state["y"] >= state["max"] - 2:
                    await page.wait_for_timeout(BOTTOM_PAUSE_SECONDS * 1000)
                    await page.evaluate("window.scrollTo({top: 0, behavior: 'smooth'})")
                    await page.wait_for_timeout(1200)
                    continue

                await page.evaluate("(pixels) => window.scrollBy(0, pixels)", state["speed"])
                await page.wait_for_timeout(int(TICK_SECONDS * 1000))
        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
