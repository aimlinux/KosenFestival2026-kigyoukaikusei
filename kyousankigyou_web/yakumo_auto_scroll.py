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
    R     : 現在のページの先頭に戻る
    Q / Esc: 終了

※ 発表用PCで実行するローカルツールです。
    公式サイト自体や公開Webサイトのコードは変更しません。
"""

import asyncio
import time

from playwright.async_api import async_playwright

PAGES = [
    ("トップ", "https://8clouds.co.jp/"),
    ("主な開発事例", "https://8clouds.co.jp/development/"),
    ("エンジニアの開発経験", "https://8clouds.co.jp/development-records/"),
    ("Webサイト制作", "https://8clouds.co.jp/website/"),
    ("DX支援サービス", "https://8clouds.co.jp/dx/"),
    ("会社概要", "https://8clouds.co.jp/company/profile/"),
    ("代表メッセージ", "https://8clouds.co.jp/message/"),
    ("沿革", "https://8clouds.co.jp/history/"),
    ("社員保有資格", "https://8clouds.co.jp/qualification/"),
    ("アクセスマップ", "https://8clouds.co.jp/access/"),
]
DEFAULT_SCROLL_SPEED = 1.2
TICK_SECONDS = 0.035
BOTTOM_PAUSE_SECONDS = 5
START_AT_TOP = True


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page(viewport={"width": 1440, "height": 900})

        # ページ移動後も一時停止と速度設定を引き継ぐ。
        await page.add_init_script("""(() => {
        window.__pairlinkPaused = sessionStorage.getItem('__pairlinkPaused') === 'true';
        window.__pairlinkQuit = false;
        window.__pairlinkSpeed = Number(
            sessionStorage.getItem('__pairlinkSpeed') || '1.2'
        );
        window.addEventListener('keydown', (e) => {
        if (e.code === 'Space') {
            e.preventDefault();
            window.__pairlinkPaused = !window.__pairlinkPaused;
            sessionStorage.setItem('__pairlinkPaused', String(window.__pairlinkPaused));
        } else if (e.key === 'ArrowUp') {
            window.__pairlinkSpeed = Math.max(0.2, window.__pairlinkSpeed - 0.2);
            sessionStorage.setItem('__pairlinkSpeed', String(window.__pairlinkSpeed));
        } else if (e.key === 'ArrowDown') {
            window.__pairlinkSpeed = Math.min(8, window.__pairlinkSpeed + 0.2);
            sessionStorage.setItem('__pairlinkSpeed', String(window.__pairlinkSpeed));
        } else if (e.key.toLowerCase() === 'r') {
            window.scrollTo({top: 0, behavior: 'smooth'});
        } else if (e.key.toLowerCase() === 'q' || e.key === 'Escape') {
            window.__pairlinkQuit = true;
        }
        });
    })();""")

        print(
            "全ページを順番に自動スクロールします。"
            "Space: 停止/再開、↑↓: 速度調整、R: 現在ページの先頭、Q/Esc: 終了"
        )

        try:
            page_index = 0
            while True:
                page_name, page_url = PAGES[page_index]
                print(f"表示中: {page_name} ({page_url})")
                await page.goto(page_url, wait_until="domcontentloaded", timeout=60000)
                await page.wait_for_timeout(1800)

                if START_AT_TOP:
                    await page.evaluate("window.scrollTo(0, 0)")

                state = await page.evaluate("""() => ({
                    paused: window.__pairlinkPaused,
                    quit: window.__pairlinkQuit,
                    speed: window.__pairlinkSpeed,
                    y: window.scrollY,
                    max: Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
                })""")

                while state["y"] < state["max"] - 2:
                    if state["quit"]:
                        return
                    if state["paused"]:
                        await page.wait_for_timeout(100)
                    else:
                        await page.evaluate(
                            "(pixels) => window.scrollBy(0, pixels)", state["speed"]
                        )
                        await page.wait_for_timeout(int(TICK_SECONDS * 1000))

                    state = await page.evaluate("""() => ({
                        paused: window.__pairlinkPaused,
                        quit: window.__pairlinkQuit,
                        speed: window.__pairlinkSpeed,
                        y: window.scrollY,
                        max: Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
                    })""")

                if state["quit"]:
                    break

                remaining_pause = BOTTOM_PAUSE_SECONDS
                previous_tick = time.monotonic()
                while remaining_pause > 0:
                    state = await page.evaluate("""() => ({
                        paused: window.__pairlinkPaused,
                        quit: window.__pairlinkQuit
                    })""")
                    if state["quit"]:
                        return
                    now = time.monotonic()
                    if not state["paused"]:
                        remaining_pause -= now - previous_tick
                    previous_tick = now
                    await page.wait_for_timeout(100)

                page_index = (page_index + 1) % len(PAGES)
        finally:
            await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
