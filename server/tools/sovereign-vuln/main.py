from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import uvicorn
from cpe_engine import CPEEngine
from database import Database, VulnerabilityRecord

app = FastAPI(title="Sovereign-VULN", version="1.0.0", description="Vulnerability Analysis & Remediation Engine")

# Initialize Singletons
db = Database()
cpe_engine = CPEEngine()

class ScanInput(BaseModel):
    banner: str
    source_tool: str = "manual"

class VulnerabilityAlert(BaseModel):
    cve_id: str
    epss_score: float
    severity: str
    remediation_cmd: Optional[str] = None
    patch_link: Optional[str] = None

class AnalysisResult(BaseModel):
    target_cpe: str
    critical_vulnerabilities: List[VulnerabilityAlert]
    risk_score: float

@app.post("/analyze/banner", response_model=AnalysisResult)
async def analyze_banner(input_data: ScanInput):
    """
    1. Generate CPE from Banner.
    2. Query Local Cache for Vulnerabilities.
    3. Return Prioritized Remediation Plan.
    """
    # 1. Generate CPE
    cpe = cpe_engine.predict_cpe(input_data.banner)
    
    # 2. Query DB (Mocking DB population for now as we don't have the NVD sync yet)
    # in a real scenario: vulns = db.query_vulnerabilities(cpe)
    
    # Simulating data for demonstration of the logic flow
    vulns = []
    
    # Dynamic Mocking based on detection
    if "apache" in cpe and "2.4.49" in cpe:
        vulns.append({
            "cve_id": "CVE-2021-41773",
            "cvss_v3": 7.5,
            "epss_score": 0.97,
            "patch_url": "https://httpd.apache.org/security/vulnerabilities_24.html",
            "workaround": "Disable Path Traversal by updating permissions."
        })
    elif "grafana" in cpe and "8." in cpe:
        vulns.append({
            "cve_id": "CVE-2021-43798",
            "cvss_v3": 7.5,
            "epss_score": 0.96,
            "patch_url": "https://grafana.com/blog/2021/12/07/grafana-8.3.1-release/",
            "workaround": "Upgrade to 8.3.1 immediately."
        })

    # 3. Construct Response
    alerts = []
    total_risk = 0.0
    
    for v in vulns:
        severity = "CRITICAL" if v['cvss_v3'] >= 9.0 else "HIGH"
        # Generate generic remediation command for Linux
        fix_cmd = "apt-get update && apt-get install --only-upgrade " + cpe.split(':')[4]
        
        alerts.append(VulnerabilityAlert(
            cve_id=v['cve_id'],
            epss_score=v['epss_score'],
            severity=severity,
            remediation_cmd=fix_cmd,
            patch_link=v.get('patch_url')
        ))
        total_risk += v['cvss_v3'] * v['epss_score']

    return AnalysisResult(
        target_cpe=cpe,
        critical_vulnerabilities=alerts,
        risk_score=round(total_risk, 2)
    )

@app.get("/health")
def health_check():
    return {"status": "operable", "engine": "Sovereign-VULN"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
