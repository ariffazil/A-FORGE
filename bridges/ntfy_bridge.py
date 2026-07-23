#!/usr/bin/env python3
"""
ntfy_bridge.py — Push notification bridge for Hermes.
Backup notification channel when Telegram is down.
DITEMPA BUKAN DIBERI — Forged, Not Given.
"""
import json, os, requests, logging
from datetime import datetime

logging.basicConfig(level=logging.INFO, format='[ntfy_bridge] %(message)s')
log = logging.getLogger(__name__)

NTFY_URL = os.environ.get("NTFY_URL", "http://localhost:18080")
DEFAULT_TOPIC = os.environ.get("NTFY_TOPIC", "hermes-alerts")

def send_alert(message: str, topic: str = None, priority: str = "default", title: str = None):
    """Send push notification via ntfy."""
    topic = topic or DEFAULT_TOPIC
    headers = {}
    if title:
        headers["Title"] = title
    if priority:
        headers["Priority"] = priority
    
    try:
        resp = requests.post(f"{NTFY_URL}/{topic}", 
                           data=message.encode('utf-8'),
                           headers=headers,
                           timeout=10)
        if resp.status_code == 200:
            result = resp.json()
            log.info(f"✅ ntfy sent: {result.get('id','?')} → {topic}")
            return {"status": "sent", "id": result.get("id")}
        else:
            log.error(f"❌ ntfy failed: {resp.status_code}")
            return {"status": "error", "code": resp.status_code}
    except Exception as e:
        log.error(f"❌ ntfy exception: {e}")
        return {"status": "error", "error": str(e)}

def send_trade_alert(symbol: str, action: str, price: float, tp: float = None, sl: float = None):
    """Send formatted trading alert."""
    msg = f"🔔 {action} {symbol} @ {price}"
    if tp:
        msg += f"\n🎯 TP: {tp}"
    if sl:
        msg += f"\n🛑 SL: {sl}"
    return send_alert(msg, topic="trade-signals", priority="high", title=f"Trade: {action} {symbol}")

if __name__ == "__main__":
    send_alert("ntfy bridge test from FORGE", title="🔥 FORGE Test")
    print("Bridge test complete.")
