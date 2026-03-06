import sys
import os
import traceback
from urllib.parse import urlparse

# Add local wapiti source to path
sys.path.insert(0, os.path.join(os.getcwd(), 'wapiti-master', 'wapiti-master'))

try:
    from wapitiCore.net.scope import is_same_domain
    from wapitiCore.net import Request
    from wapitiCore.parsers.html_parser import Html
    print("Successfully imported patched modules")

    # Test URLs that might cause issues
    test_urls = [
        "Is not a valid URL !",
        "http://[",
        "http://???",
        "not-a-url"
    ]

    base_req = Request("http://example.com")

    for url in test_urls:
        print(f"\n--- Testing URL: '{url}' ---")
        
        print(f"Testing is_same_domain...")
        try:
            result = is_same_domain(url, base_req)
            print(f"is_same_domain result: {result}")
        except Exception:
            print("is_same_domain CRASHED")
            traceback.print_exc()

        print(f"Testing Html class...")
        try:
            # For Html class, the URL must be somewhat valid to start with or it crashes in __init__
            test_target = url if url.startswith("http") else "http://example.com"
            html_obj = Html("<html></html>", test_target)
            print(f"Html object created, fld: {html_obj._fld}")
            
            # Test link parsing
            print("Testing is_external_to_domain...")
            # Use the bad URL as a candidate link
            ext_result = html_obj.is_external_to_domain(url)
            print(f"is_external_to_domain result: {ext_result}")
            
        except Exception:
            print("Html class CRASHED")
            traceback.print_exc()

    print("\nVerification process completed.")

except Exception:
    traceback.print_exc()
    sys.exit(1)
