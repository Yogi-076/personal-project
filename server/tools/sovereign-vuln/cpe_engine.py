import re
from Levenshtein import ratio

class CPEEngine:
    def __init__(self):
        # Local knowledge base of common vendor mappings
        # In a real system, this would confirm against the official NVD dictionary
        self.vendor_aliases = {
            "apache http server": "apache:http_server",
            "nginx": "f5:nginx",
            "grafana": "grafana:grafana",
            "jenkins": "jenkins:jenkins",
            "gitlab": "gitlab:gitlab",
            "tomcat": "apache:tomcat",
            "elastic": "elastic:elasticsearch"
        }

    def _normalize_banner(self, banner: str) -> str:
        """Clean raw headers/banners into a comparable string."""
        return banner.lower().strip().replace("/", " ").replace("-", " ")

    def predict_cpe(self, banner: str) -> str:
        """
        Converts a raw service banner into a valid CPE 2.3 URI.
        Uses fuzzy matching to identify vendor/product.
        
        Input: "Apache/2.4.49 (Unix)"
        Output: "cpe:2.3:a:apache:http_server:2.4.49"
        """
        clean_banner = self._normalize_banner(banner)
        best_match = None
        highest_score = 0.0

        # Version Extraction Logic (Regex for semantic versioning)
        version_match = re.search(r'(\d+\.\d+\.?\d*)', clean_banner)
        version = version_match.group(1) if version_match else "*"

        # Vendor/Product Identification
        for alias, cpe_part in self.vendor_aliases.items():
            # Calculate similarity score
            # We check if the alias is a substring or fuzzy match
            if alias in clean_banner:
                score = 1.0
            else:
                score = ratio(alias, clean_banner.split(' ')[0]) # Simple heuristic on first word

            if score > highest_score and score > 0.8: # Threshold
                highest_score = score
                best_match = cpe_part

        if not best_match:
            # Fallback: Treat first word as vendor and product
            parts = clean_banner.split()
            if parts:
                vendor = parts[0]
                best_match = f"{vendor}:{vendor}"
            else:
                return "cpe:2.3:a:*:*:*"

        vendor, product = best_match.split(':')
        
        # Construct CPE 2.3 String
        # cpe:2.3:part:vendor:product:version:update:edition:language:sw_edition:target_sw:target_hw:other
        cpe_uri = f"cpe:2.3:a:{vendor}:{product}:{version}:*:*:*:*:*:*:*"
        
        return cpe_uri

    def parse_scan_result(self, tool_output: dict):
        """Ingests results from other tools (e.g. Forrecon JSONL) and maps to CPEs."""
        # This function would handle 'server' headers or discovered software
        pass

# Example Usage
if __name__ == "__main__":
    engine = CPEEngine()
    test_banners = [
        "Apache/2.4.49 (Unix)",
        "nginx/1.18.0",
        "Grafana v8.3.0",
        "Jetty(9.4.43.v20210629)"
    ]
    
    print("--- CPE Generator Test ---")
    for b in test_banners:
        print(f"'{b}' -> {engine.predict_cpe(b)}")
