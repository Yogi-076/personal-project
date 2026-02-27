import duckdb
import logging
from datetime import datetime
from pydantic import BaseModel
from typing import Optional, List

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("sovereign-db")

class VulnerabilityRecord(BaseModel):
    cve_id: str
    description: str
    cvss_score: float
    epss_score: float
    cpe_uri: str
    remediation_patch: Optional[str] = None
    remediation_workaround: Optional[str] = None

class Database:
    def __init__(self, db_path="vulnerability_cache.duckdb"):
        self.conn = duckdb.connect(db_path)
        self._init_schema()

    def _init_schema(self):
        """Initialize the Vulnerability Cache Schema optimized for analytics."""
        logger.info("Initializing DuckDB Schema...")
        
        # CVE Table: Stores official NVD data + EPSS scores
        self.conn.execute("""
            CREATE TABLE IF NOT EXISTS cves (
                cve_id VARCHAR PRIMARY KEY,
                description TEXT,
                cvss_v3 FLOAT,
                epss_score FLOAT,
                published_date TIMESTAMP,
                last_modified TIMESTAMP
            )
        """)

        # CPE Map: Links Software Versions to CVEs
        self.conn.execute("""
            CREATE TABLE IF NOT EXISTS cpe_cve_map (
                cpe_uri VARCHAR,
                cve_id VARCHAR,
                FOREIGN KEY (cve_id) REFERENCES cves(cve_id)
            )
        """)

        # Remediation Table: AI-generated or Vendor-provided fixes
        self.conn.execute("""
            CREATE TABLE IF NOT EXISTS remediation (
                cve_id VARCHAR PRIMARY KEY,
                patch_url VARCHAR,
                workaround TEXT,
                FOREIGN KEY (cve_id) REFERENCES cves(cve_id)
            )
        """)
        logger.info("Schema Initialization Complete.")

    def upsert_cve(self, record: VulnerabilityRecord):
        """Insert or Update a CVE record."""
        self.conn.execute("""
            INSERT INTO cves (cve_id, description, cvss_v3, epss_score, published_date, last_modified)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT (cve_id) DO UPDATE SET
                epss_score = excluded.epss_score,
                last_modified = excluded.last_modified
        """, (
            record.cve_id, 
            record.description, 
            record.cvss_score, 
            record.epss_score, 
            datetime.now(), 
            datetime.now()
        ))
        
        # Link CPE
        self.conn.execute("""
            INSERT OR IGNORE INTO cpe_cve_map (cpe_uri, cve_id) VALUES (?, ?)
        """, (record.cpe_uri, record.cve_id))

        if record.remediation_patch or record.remediation_workaround:
            self.conn.execute("""
                INSERT OR REPLACE INTO remediation (cve_id, patch_url, workaround)
                VALUES (?, ?, ?)
            """, (record.cve_id, record.remediation_patch, record.remediation_workaround))

    def query_vulnerabilities(self, cpe_uri: str) -> List[dict]:
        """
        Query the cache for all Critical/High vulnerabilities associated with a CPE.
        Returns EPSS-prioritized list.
        """
        query = """
            SELECT 
                c.cve_id, 
                c.cvss_v3, 
                c.epss_score, 
                r.patch_url, 
                r.workaround
            FROM cpe_cve_map m
            JOIN cves c ON m.cve_id = c.cve_id
            LEFT JOIN remediation r ON c.cve_id = r.cve_id
            WHERE m.cpe_uri = ? AND c.cvss_v3 >= 7.0
            ORDER BY c.epss_score DESC, c.cvss_v3 DESC
        """
        return self.conn.execute(query, (cpe_uri,)).fetchdf().to_dict(orient='records')
