import os
import subprocess
import uuid
import json
import sys
import platform
from pathlib import Path
import tempfile
from flask import Flask, request, jsonify
from flask_cors import CORS
import threading
import time
import signal
import atexit
import requests

# Add project root to sys.path to allow importing from 'services'
project_root = str(Path(__file__).parent.parent.resolve())
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from google import genai
from openai import OpenAI as OpenAIClient

# Modulized SEO Services
from services.seo_scraper.classifier import classify_site_intent
from services.seo_scraper.engines import search_with_tiered_strategy
from services.seo_scraper.ai_analysis import analyze_site_intent_with_ai

# === LỚP 1: Process Registry — Đăng ký và theo dõi mọi subprocess ===
class ProcessRegistry:
    def __init__(self):
        self._processes = {}
        self._lock = threading.Lock()
        # Watchdog thread tự động dọn zombie sau timeout
        self._watchdog = threading.Thread(target=self._watchdog_loop, daemon=True)
        self._watchdog.start()
    
    def register(self, task_id, process):
        with self._lock:
            self._processes[task_id] = process
    
    def kill(self, task_id):
        with self._lock:
            proc = self._processes.pop(task_id, None)
        if proc and proc.poll() is None:
            try:
                if platform.system() == "Windows":
                    subprocess.run(["taskkill", "/F", "/T", "/PID", str(proc.pid)], capture_output=True)
                else:
                    os.kill(proc.pid, signal.SIGTERM)
            except Exception:
                pass
    
    def kill_all(self):
        with self._lock:
            ids = list(self._processes.keys())
        for tid in ids:
            self.kill(tid)
    
    def _watchdog_loop(self):
        while True:
            time.sleep(30)
            with self._lock:
                dead_tasks = [tid for tid, p in self._processes.items() if p.poll() is not None]
            for tid in dead_tasks:
                with self._lock:
                    self._processes.pop(tid, None)

process_registry = ProcessRegistry()
atexit.register(process_registry.kill_all)

# === LỚP 2: Heartbeat Monitoring — Theo dõi kết nối Frontend ===
_last_heartbeat = {}
_heartbeat_lock = threading.Lock()

def heartbeat_monitor():
    TIMEOUT = 45 
    while True:
        time.sleep(10)
        now = time.time()
        with _heartbeat_lock:
            dead_tasks = [tid for tid, last in _last_heartbeat.items() if now - last > TIMEOUT]
        for tid in dead_tasks:
            process_registry.kill(tid)
            with _heartbeat_lock:
                _last_heartbeat.pop(tid, None)

threading.Thread(target=heartbeat_monitor, daemon=True).start()

PORT = 8081

# ANSI COLORS FOR TERMINAL
P = "\033[38;2;99;102;241m" 
C = "\033[96m"             
W = "\033[1m\033[97m"      
R = "\033[0m"              

print(f"{P}--------------------------------------------{R}")
print(f"{P}| {W}  OMNITOOL AI  {P}|{R} {C}SEO ENGINE v5.1  {P}|{R}")
print(f"{P}--------------------------------------------{R}")
print(f"{P}| {R} STATUS: {W}ONLINE{R}  {P}|{R}  PORT: {C}{PORT}{R}             {P}|{R}")
print(f"{P}--------------------------------------------{R}")

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": ["http://localhost:3000", "http://127.0.0.1:3000"]}})

@app.route('/api/analyze-single', methods=['POST'])
def analyze_single():
    try:
        body = request.get_json() or {}
        url = body.get('url', '')
        title = body.get('title', '')
        gemini_api_key = body.get('gemini_api_key', '')

        if not gemini_api_key:
            return jsonify({"error": "Cần Gemini API key"}), 400

        prompt = f"""
        Phân tích website này như một chuyên gia SEO Việt Nam:
        URL: {url}
        Tiêu đề: {title}

        Trả về JSON với các trường:
        - intent: [Bán hàng | Cung cấp thông tin | Tuyển dụng]
        - coverage: [Cao | Trung bình | Thấp]
        - weakness: Điểm yếu cụ thể nhất (1 câu ngắn, tiếng Việt)
        - opportunity: Cơ hội khai thác (1 câu hành động, tiếng Việt)

        Chỉ trả về JSON, không thêm gì khác.
        """
        client = genai.Client(api_key=gemini_api_key)
        response = client.models.generate_content(model='gemini-2.0-flash', contents=prompt)
        txt = response.text.strip()
        if "```" in txt:
            txt = txt.split("```")[1]
            if txt.startswith("json"):
                txt = txt[4:]

        result = json.loads(txt[txt.find("{"):txt.rfind("}")+1])
        result['url'] = url
        result['title'] = title
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/task/heartbeat', methods=['POST'])
def task_heartbeat():
    task_id = request.get_json().get('task_id')
    if task_id:
        with _heartbeat_lock:
            _last_heartbeat[task_id] = time.time()
    return jsonify({"status": "alive"})

@app.route('/api/task/cancel', methods=['POST'])
def cancel_task():
    task_id = request.get_json().get('task_id')
    if task_id:
        process_registry.kill(task_id)
        with _heartbeat_lock:
            _last_heartbeat.pop(task_id, None)
    return jsonify({"status": "cancelled"})

@app.route('/api/search/keywords', methods=['POST'])
def search_keywords():
    try:
        body = request.get_json() or {}
        keywords = body.get('keywords', [])
        keys = body.get('keys', {})
        mode = body.get('mode', 'smart')
        
        final_results = []
        seen_urls = set()
        serp_key = keys.get('serpapi_key')
        
        for kw in keywords[:5]:
            try:
                raw_results = search_with_tiered_strategy(kw, keys, mode=mode)
                for r in raw_results:
                    url = r['url'].lower().rstrip('/')
                    if url not in seen_urls:
                        seen_urls.add(url)
                        r['keyword'] = kw
                        final_results.append(r)
            except Exception as e:
                print(f"[!] Keyword error: {e}")

        analysis_data = {}
        if final_results:
            to_analyze = []
            for r in final_results[:60]:
                url = r['url']
                title = r.get('title', 'Website')
                classification = classify_site_intent(url, title)
                
                if classification.needs_ai and serp_key:
                    to_analyze.append({"url": url, "title": title})
                else:
                    analysis_data[url] = {
                        "url": url,
                        "intent": classification.intent,
                        "coverage": "Trung bình (Heuristic)",
                        "weakness": f"Nhận diện qua {', '.join(classification.signals)}"
                    }
            
            if to_analyze and serp_key:
                ai_results = analyze_site_intent_with_ai(to_analyze[:30], serp_key)
                for item in ai_results:
                    analysis_data[item['url']] = item

        return jsonify({
            "urls": [r['url'] for r in final_results[:60]],
            "raw_data": final_results[:60],
            "analysis": list(analysis_data.values()) if analysis_data else []
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=PORT)
