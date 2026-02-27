#!/usr/bin/env python3
"""
Apex-Vault Smart Harvester
Scrapes payload repositories and community sources, parses them into
the master_payloads.json schema for the VajraScan Arsenal.

Usage:
    python harvest_payloads.py
    python harvest_payloads.py --output ../data/master_payloads.json

Dependencies:
    pip install requests beautifulsoup4
"""

import requests
from bs4 import BeautifulSoup
import json
import os
import hashlib
import argparse
from datetime import datetime

# Default target categories — extend with your own sources
SOURCES = {
    "XSS": [
        "https://raw.githubusercontent.com/payloadbox/xss-payload-list/master/Intruder/xss-payload-list.txt",
    ],
    "SQLi": [
        "https://raw.githubusercontent.com/payloadbox/sql-injection-payload-list/master/Intruder/detect/Generic_SQLI.txt",
    ],
    "LFI": [
        "https://raw.githubusercontent.com/danielmiessler/SecLists/master/Fuzzing/LFI/LFI-Jhaddix.txt",
    ],
    "Command Injection": [
        "https://raw.githubusercontent.com/payloadbox/command-injection-payload-list/master/README.md",
    ],
    "XXE": [
        "https://raw.githubusercontent.com/payloadbox/xxe-injection-payload-list/master/README.md",
    ],
}

# Site-based scraping targets
SITE_SOURCES = {
    "SQLi": "https://payloads.site/sql-injection",
    "XSS": "https://payloads.site/xss",
    "LFI": "https://payloads.site/lfi-rfi",
}

# Payloads.site Supabase API Config
PAYLOADS_SITE_API = {
    "url": "https://qfpclamdlkcfhwicuegc.supabase.co/rest/v1",
    "key": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmcGNsYW1kbGtjZmh3aWN1ZWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM2MDI0MTIsImV4cCI6MjA1OTE3ODQxMn0.thF7eG2RAYv6Xc1pWgFNf97nlyIGTzQxvjVoEwNXfw4",
    "mappings": {
        "xss": "XSS",
        "sqli": "SQLi",
        "lfi": "LFI", 
        "rfi": "LFI", # Merge RFI into LFI for now
        "command": "Command Injection"
    }
}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36"
}

def generate_id(category, payload_text):
    """Generate a deterministic ID from category + payload text."""
    h = hashlib.md5(f"{category}:{payload_text}".encode()).hexdigest()[:8]
    prefix = category.lower().replace(" ", "")[:4]
    return f"{prefix}-{h}"

def classify_tags(payload_text, category):
    """Auto-tag payloads based on content analysis."""
    tags = []
    text = payload_text.lower()
    
    # XSS tags
    if "<script" in text: tags.append("script-tag")
    if "onerror" in text or "onload" in text or "onclick" in text: tags.append("event-handler")
    if "<svg" in text: tags.append("svg")
    if "<img" in text: tags.append("img")
    if "javascript:" in text: tags.append("javascript-protocol")
    if "alert(" in text or "prompt(" in text or "confirm(" in text: tags.append("popup")
    if "document.cookie" in text: tags.append("cookie-theft")
    if "eval(" in text or "atob(" in text: tags.append("obfuscation")
    if "fromcharcode" in text.lower(): tags.append("fromCharCode")
    
    # SQLi tags
    if "union" in text: tags.append("union")
    if "select" in text: tags.append("select")
    if "or 1=1" in text or "or '1'='1" in text: tags.append("auth-bypass")
    if "sleep(" in text or "waitfor" in text: tags.append("time-based")
    if "information_schema" in text: tags.append("schema-enum")
    if "--" in text: tags.append("comment")
    
    # LFI tags
    if "../" in text or "..\\" in text: tags.append("path-traversal")
    if "etc/passwd" in text: tags.append("linux")
    if "php://" in text: tags.append("php-wrapper")
    if "windows" in text: tags.append("windows")
    
    # Command Injection tags
    if "|" in text or ";" in text: tags.append("command-chain")
    if "whoami" in text or "/etc/passwd" in text: tags.append("recon")
    if "curl" in text or "wget" in text: tags.append("oob")
    
    # WAF evasion indicators
    if "%00" in text or "\\x" in text: tags.append("evasion")
    if "/**/" in text or "/*!*/" in text: tags.append("WAF bypass")
    if "%0a" in text or "%0d" in text: tags.append("newline-evasion")
    
    # Add category as basic tag
    tags.append(category.lower().replace(" ", "-"))
    
    return list(set(tags))[:8]  # Limit to 8 tags

def estimate_bypass_level(payload_text):
    """Estimate WAF bypass sophistication level (0-5)."""
    score = 0
    text = payload_text.lower()
    
    # Encoding complexity
    if "%25" in text or "%252f" in text: score += 2  # Double encoding
    if "\\x" in text or "\\u" in text: score += 1    # Hex/Unicode
    if "/*!*/" in text or "/**/" in text: score += 1  # Inline comments
    if "fromcharcode" in text: score += 1
    if "%0a" in text or "%0d" in text: score += 1
    if "${ifs}" in text.lower() or "$ifs" in text.lower(): score += 2
    if "string.fromcharcode" in text.lower(): score += 1
    if "atob(" in text: score += 1
    
    # Structural complexity
    if len(payload_text) > 100: score += 1
    if payload_text.count("(") > 3: score += 1
    
    return min(score, 5)

def harvest_raw_lists():
    """Harvest payloads from raw text file URLs."""
    harvested = []
    
    for category, urls in SOURCES.items():
        for url in urls:
            print(f"[*] Harvesting {category} from {url}...")
            try:
                response = requests.get(url, headers=HEADERS, timeout=15)
                response.raise_for_status()
                
                lines = response.text.strip().split("\n")
                for line in lines:
                    payload_text = line.strip()
                    if payload_text and len(payload_text) > 2 and not payload_text.startswith("#"):
                        harvested.append({
                            "id": generate_id(category, payload_text),
                            "category": category,
                            "payload": payload_text,
                            "bypass_level": estimate_bypass_level(payload_text),
                            "target_os": "any",
                            "waf_signatures": [],
                            "tags": classify_tags(payload_text, category),
                            "context": "raw",
                            "success_count": 0,
                            "source": url.split("/")[4] if "github" in url else "community"
                        })
            except Exception as e:
                print(f"[!] Error harvesting {url}: {e}")
    
    return harvested

def harvest_sites():
    """Harvest payloads from HTML-based payload sites."""
    harvested = []
    
    for category, url in SITE_SOURCES.items():
        print(f"[*] Scraping {category} from {url}...")
        try:
            response = requests.get(url, headers=HEADERS, timeout=10)
            soup = BeautifulSoup(response.text, 'html.parser')
            
            tags = soup.find_all(['code', 'pre'])
            for tag in tags:
                payload_text = tag.get_text().strip()
                if payload_text and len(payload_text) > 2:
                    harvested.append({
                        "id": generate_id(category, payload_text),
                        "category": category,
                        "payload": payload_text,
                        "bypass_level": estimate_bypass_level(payload_text),
                        "target_os": "any",
                        "waf_signatures": [],
                        "tags": classify_tags(payload_text, category),
                        "context": "raw",
                        "success_count": 0,
                        "source": "payloads.site"
                    })
        except Exception as e:
            print(f"[!] Error scraping {url}: {e}")
    
    return harvested

def fetch_from_payloads_site():
    """Fetch structured payloads from payloads.site Supabase API."""
    harvested = []
    headers = {
        "apikey": PAYLOADS_SITE_API["key"],
        "Authorization": f"Bearer {PAYLOADS_SITE_API['key']}"
    }
    
    for endpoint, local_cat in PAYLOADS_SITE_API["mappings"].items():
        print(f"[*] Fetching {local_cat} from payloads.site API ({endpoint})...")
        try:
            # Add tag for original source category if different (e.g. rfi)
            extra_tag = endpoint if endpoint != local_cat.lower().replace(" ", "") else None
            
            url = f"{PAYLOADS_SITE_API['url']}/{endpoint}?select=payload"
            response = requests.get(url, headers=headers, timeout=20)
            response.raise_for_status()
            
            data = response.json()
            print(f"    -> Found {len(data)} items")
            
            for item in data:
                payload_text = item.get("payload")
                if payload_text:
                    tags = classify_tags(payload_text, local_cat)
                    tags.append("payloads.site")
                    if extra_tag: tags.append(extra_tag)
                    
                    harvested.append({
                        "id": generate_id(local_cat, payload_text),
                        "category": local_cat,
                        "payload": payload_text,
                        "bypass_level": estimate_bypass_level(payload_text),
                        "target_os": "any",
                        "waf_signatures": [],
                        "tags": list(set(tags))[:8],
                        "context": "raw",
                        "success_count": 0,
                        "source": "payloads.site"
                    })
                    
        except Exception as e:
            print(f"[!] API Error for {endpoint}: {e}")
            
    return harvested

def deduplicate(payloads):
    """Remove duplicate payloads by text content."""
    seen = set()
    unique = []
    for p in payloads:
        key = f"{p['category']}:{p['payload']}"
        if key not in seen:
            seen.add(key)
            unique.append(p)
    return unique

def merge_with_existing(new_payloads, output_path):
    """Merge new payloads with existing database, preserving success_count."""
    existing = []
    if os.path.exists(output_path):
        try:
            with open(output_path, 'r', encoding='utf-8') as f:
                existing = json.load(f)
        except json.JSONDecodeError:
            existing = []
    
    # Build lookup of existing payloads by ID
    existing_map = {p["id"]: p for p in existing}
    
    merged = list(existing)  # Start with existing
    added = 0
    
    for p in new_payloads:
        if p["id"] not in existing_map:
            merged.append(p)
            added += 1
        else:
            # Preserve success_count from existing
            pass
    
    return merged, added

def main():
    parser = argparse.ArgumentParser(description="Apex-Vault Smart Harvester")
    parser.add_argument("--output", "-o",
                        default=os.path.join(os.path.dirname(__file__), "..", "data", "master_payloads.json"),
                        help="Output path for master_payloads.json")
    parser.add_argument("--raw-only", action="store_true", help="Only harvest from raw text sources")
    parser.add_argument("--sites-only", action="store_true", help="Only harvest from HTML sites")
    parser.add_argument("--max-per-category", type=int, default=500, help="Max payloads per category")
    
    args = parser.parse_args()
    
    print("=" * 60)
    print("  APEX-VAULT Smart Harvester v2.0")
    print(f"  Started: {datetime.now().isoformat()}")
    print("=" * 60)
    
    all_harvested = []
    
    if not args.sites_only:
        all_harvested.extend(harvest_raw_lists())
    
    if not args.raw_only:
        all_harvested.extend(harvest_sites())
        
    # Always try to fetch from payloads.site API unless raw-only
    if not args.raw_only:
        all_harvested.extend(fetch_from_payloads_site())
    
    # Deduplicate
    unique = deduplicate(all_harvested)
    
    # Limit per category
    category_counts = {}
    limited = []
    
    # Sort unique payloads by length (shorter first) to prioritize cleaner payloads
    unique.sort(key=lambda x: len(x['payload']))
    
    for p in unique:
        cat = p["category"]
        category_counts[cat] = category_counts.get(cat, 0) + 1
        if category_counts[cat] <= args.max_per_category:
            limited.append(p)
    
    # Merge with existing database
    output_path = args.output
    # Use absolute path if not provided
    if not os.path.isabs(output_path):
        output_path = os.path.abspath(output_path)
        
    print(f"[*] Merging into {output_path}...")
    merged, added = merge_with_existing(limited, output_path)
    
    # Save
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(merged, f, indent=4, ensure_ascii=False)
    
    print(f"\n{'=' * 60}")
    print(f"  Harvest Complete!")
    print(f"  Harvested unique:        {len(unique)}")
    print(f"  Kept (limit {args.max_per_category}):      {len(limited)}")
    print(f"  New payloads added:      {added}")
    print(f"  Total database size:     {len(merged)}")
    print(f"  Output: {output_path}")
    print(f"{'=' * 60}")
    
    # Category breakdown
    cat_stats = {}
    for p in merged:
        cat_stats[p["category"]] = cat_stats.get(p["category"], 0) + 1
    
    print("\n  Category Breakdown:")
    for cat, count in sorted(cat_stats.items()):
        print(f"    {cat:.<25} {count}")

if __name__ == "__main__":
    main()
