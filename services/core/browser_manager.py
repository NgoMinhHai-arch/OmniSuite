import random
import threading
import atexit
from contextlib import contextmanager

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0",
]

def get_random_ua():
    return random.choice(USER_AGENTS)

class PlaywrightBrowserPool:
    """Pool quản lý browser instance biệt lập theo từng luồng (Thread-Local) để tránh lỗi đa luồng."""
    _thread_local = threading.local()
    _lock = threading.Lock()
    MAX_REQUESTS_BEFORE_RESTART = 50 

    @classmethod
    def get_browser(cls):
        from playwright.sync_api import sync_playwright
        
        # Đảm bảo mỗi thread có cụm Playwright/Browser riêng
        if not hasattr(cls._thread_local, 'playwright') or cls._thread_local.playwright is None:
            cls._thread_local.playwright = sync_playwright().start()
            cls._thread_local.browser = None
            cls._thread_local.request_count = 0
            
        if (cls._thread_local.browser is None or 
            not cls._thread_local.browser.is_connected() or 
            cls._thread_local.request_count >= cls.MAX_REQUESTS_BEFORE_RESTART):
            
            cls._cleanup_thread()
            cls._thread_local.browser = cls._thread_local.playwright.chromium.launch(
                headless=True,
                args=[
                    '--disable-blink-features=AutomationControlled',
                    '--no-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--memory-pressure-off',
                    '--disk-cache-size=0',
                    '--media-cache-size=0'
                ]
            )
            cls._thread_local.request_count = 0
            print(f"[Pool] New Thread-Local Browser initialized for thread {threading.get_ident()}.")
            
        cls._thread_local.request_count += 1
        return cls._thread_local.browser

    @classmethod
    def _cleanup_thread(cls):
        """Dọn dẹp tài nguyên của riêng luồng hiện tại."""
        try:
            if hasattr(cls._thread_local, 'browser') and cls._thread_local.browser and cls._thread_local.browser.is_connected():
                cls._thread_local.browser.close()
        except: pass
        cls._thread_local.browser = None

    @classmethod
    def shutdown(cls):
        """Shutdown toàn bộ (chủ yếu dùng khi thoát ứng dụng)."""
        print("[Pool] Global shutdown requested.")

atexit.register(PlaywrightBrowserPool.shutdown)

class HumanBehaviorSimulator:
    """Mô phỏng hành vi người dùng thực để tránh Captcha/Bot-detection."""
    @staticmethod
    def human_delay(min_ms=800, max_ms=2500):
        beta_val = random.betavariate(2, 5)
        return min_ms + beta_val * (max_ms - min_ms)

    @staticmethod
    def simulate_reading_scroll(page, total_scrolls=3):
        for i in range(total_scrolls):
            scroll_amount = random.randint(300, 900)
            page.mouse.wheel(0, scroll_amount)
            if random.random() < 0.3:
                page.wait_for_timeout(int(random.randint(200, 500)))
                page.mouse.wheel(0, -random.randint(50, 150))
            read_time = HumanBehaviorSimulator.human_delay(600, 1800) if i < 2 else HumanBehaviorSimulator.human_delay(300, 800)
            page.wait_for_timeout(int(read_time))

@contextmanager
def managed_page():
    """Context manager quản lý vòng đời Page & Context tập trung."""
    browser = PlaywrightBrowserPool.get_browser()
    context = None
    page = None
    try:
        context = browser.new_context(
            locale='vi-VN',
            timezone_id='Asia/Ho_Chi_Minh',
            geolocation={'latitude': 12.2388, 'longitude': 109.1967},
            permissions=['geolocation'],
            user_agent=get_random_ua(),
            viewport={'width': 1366, 'height': 768},
        )
        # Chặn resources để tiết kiệm memory
        context.route("**/*.{png,jpg,jpeg,gif,webp,svg,ico,woff,woff2,ttf,mp4,mp3,pdf}", lambda route: route.abort())
        context.add_init_script("Object.defineProperty(navigator, 'webdriver', { get: () => undefined });")
        page = context.new_page()
        yield page
    finally:
        if page:
            try: page.close()
            except: pass
        if context:
            try: context.close()
            except: pass
