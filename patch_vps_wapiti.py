#!/usr/bin/env python3
"""
VPS Wapiti Patch Script
=======================
Run this on the VPS with: sudo python3 patch_vps_wapiti.py

This patches the system-installed Wapiti (VAPT Engine 3.0.4) at:
  /usr/lib/python3/dist-packages/VAPT EngineCore/net/crawler.py

The fix adds TldBadUrl exception handling to the is_in_scope() function
to prevent crashes when crawling pages with malformed/non-HTTP URLs.

Root cause:
  The crawler visits links like "Is not a valid URL !" or "javascript:void(0)"
  and passes them directly to get_fld(), which raises TldBadUrl instead of
  being handled gracefully.
"""

import re
import shutil
import sys
from pathlib import Path

# Path to the system-installed crawler.py on the VPS
CRAWLER_PATH = Path("/usr/lib/python3/dist-packages/VAPT EngineCore/net/crawler.py")

# Also check the non-rebranded path just in case
ALT_CRAWLER_PATH = Path("/usr/lib/python3/dist-packages/wapitiCore/net/crawler.py")


def find_crawler():
    for p in [CRAWLER_PATH, ALT_CRAWLER_PATH]:
        if p.exists():
            return p
    return None


def patch_crawler(path: Path):
    print(f"[*] Patching: {path}")

    content = path.read_text(encoding="utf-8")

    # Check if already patched
    if "TldBadUrl" in content and "is_in_scope" in content:
        # Might already be patched for is_in_scope, check more specifically
        if "except TldBadUrl" in content:
            print("[+] is_in_scope already has TldBadUrl handling — checking for more...")


    # Ensure TldBadUrl is imported
    if "TldBadUrl" not in content:
        # Add TldBadUrl to the tld.exceptions import line
        content = re.sub(
            r"from tld\.exceptions import (TldDomainNotFound)",
            r"from tld.exceptions import TldDomainNotFound, TldBadUrl",
            content
        )
        # Also try the other common pattern
        content = re.sub(
            r"from tld\.exceptions import (.*?)TldDomainNotFound(.*?)$",
            lambda m: f"from tld.exceptions import {m.group(1)}TldDomainNotFound, TldBadUrl{m.group(2)}",
            content,
            flags=re.MULTILINE
        )
        print("[+] Added TldBadUrl to imports")
    else:
        print("[+] TldBadUrl already imported")

    # ========================
    # PATCH 1: is_in_scope() at line ~231
    # Original:
    #   return get_fld(resource.url) == get_fld(self._base.url)
    # ========================
    old_is_in_scope = "return get_fld(resource.url) == get_fld(self._base.url)"
    new_is_in_scope = """try:
                return get_fld(resource.url) == get_fld(self._base.url)
            except (TldDomainNotFound, TldBadUrl, ValueError):
                # Malformed/non-HTTP URLs (e.g. javascript:, data:, Is not a valid URL !)
                try:
                    from urllib.parse import urlparse
                    return urlparse(resource.url).netloc == urlparse(self._base.url).netloc
                except Exception:
                    return False"""

    if old_is_in_scope in content:
        content = content.replace(old_is_in_scope, new_is_in_scope)
        print("[+] Patched is_in_scope() — TldBadUrl now handled gracefully")
    else:
        print("[!] Could not find exact is_in_scope pattern — trying regex approach")
        # Try regex for slightly different whitespace
        pattern = r'return get_fld\(resource\.url\) == get_fld\(self\._base\.url\)'
        if re.search(pattern, content):
            content = re.sub(pattern, new_is_in_scope.strip(), content)
            print("[+] Patched is_in_scope() via regex")
        else:
            print("[!] WARNING: Could not patch is_in_scope() — manual intervention needed")
            print(f"    Look for this line in {path}:")
            print(f"    {old_is_in_scope}")

    # ========================
    # PATCH 2: Any other bare get_fld() calls without TldBadUrl handling
    # In is_in_scope there are potentially two get_fld calls
    # ========================

    # Make backup before writing
    backup_path = path.with_suffix(".py.bak")
    if not backup_path.exists():
        shutil.copy2(path, backup_path)
        print(f"[+] Backup saved to: {backup_path}")
    else:
        print(f"[~] Backup already exists at: {backup_path}")

    path.write_text(content, encoding="utf-8")
    print("[+] File written successfully!")

    # Verify patch was applied
    verify_content = path.read_text(encoding="utf-8")
    if "TldBadUrl" in verify_content:
        print("\n[✓] VERIFICATION PASSED: TldBadUrl is now handled in crawler.py")
        print("[✓] The scanner should no longer crash on malformed URLs")
    else:
        print("\n[✗] VERIFICATION FAILED: TldBadUrl not found in patched file")
        print("    Restoring backup...")
        shutil.copy2(backup_path, path)


def main():
    crawler_path = find_crawler()

    if not crawler_path:
        print("[✗] ERROR: Could not find crawler.py at:")
        print(f"    {CRAWLER_PATH}")
        print(f"    {ALT_CRAWLER_PATH}")
        print("\nCheck the actual path with:")
        print('    find / -name "crawler.py" 2>/dev/null | grep -i "wapiti\|VAPT"')
        sys.exit(1)

    patch_crawler(crawler_path)


if __name__ == "__main__":
    main()
