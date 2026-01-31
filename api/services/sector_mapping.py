from __future__ import annotations

from typing import Optional


def derive_sector_from_industry(industry: Optional[str]) -> Optional[str]:
    if not industry:
        return None

    industry_norm = industry.strip().lower()

    # Heuristic mapping: Finnhub's "finnhubIndustry" is not a strict taxonomy.
    # Keep this small + conservative; can be upgraded later to a proper classifier.
    if any(k in industry_norm for k in ["software", "semiconductor", "technology", "it services", "internet"]):
        return "Technology"

    if any(k in industry_norm for k in ["bank", "insurance", "capital markets", "asset management", "financial"]):
        return "Financials"

    if any(k in industry_norm for k in ["pharma", "biotech", "health", "medical", "hospital"]):
        return "Health Care"

    if any(k in industry_norm for k in ["oil", "gas", "energy", "pipeline", "renewable"]):
        return "Energy"

    if any(k in industry_norm for k in ["aerospace", "defense", "industrial", "machinery", "construction"]):
        return "Industrials"

    if any(k in industry_norm for k in ["retail", "consumer", "apparel", "autos", "travel", "leisure"]):
        return "Consumer"

    if any(k in industry_norm for k in ["telecom", "wireless", "media", "entertainment"]):
        return "Communication"

    if any(k in industry_norm for k in ["utility", "water", "electric", "power"]):
        return "Utilities"

    if any(k in industry_norm for k in ["real estate", "reit"]):
        return "Real Estate"

    if any(k in industry_norm for k in ["materials", "chemical", "mining", "metals"]):
        return "Materials"

    return None
