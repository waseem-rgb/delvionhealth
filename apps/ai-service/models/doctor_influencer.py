from typing import Optional


class DoctorInfluencer:
    """
    Calculates doctor influence score (0-100) for CRM prioritisation.
    Based on referral volume, revenue generated, and visit recency.
    """

    def score(
        self,
        referral_count_30d: int,
        referral_count_90d: int,
        total_revenue: float,
        days_since_last_visit: Optional[int],
        days_since_last_referral: Optional[int],
        has_email: bool,
        specialty_tier: int = 2,
    ) -> dict:
        recent_score = min(referral_count_30d / 15.0, 1.0) * 25
        trend_score = min(referral_count_90d / 40.0, 1.0) * 15
        revenue_score = min(total_revenue / 200000, 1.0) * 30

        if days_since_last_visit is None:
            visit_score = 0
        elif days_since_last_visit <= 7:
            visit_score = 20
        elif days_since_last_visit <= 30:
            visit_score = 15
        elif days_since_last_visit <= 90:
            visit_score = 8
        else:
            visit_score = 2

        specialty_bonus = {1: 10, 2: 6, 3: 3}.get(specialty_tier, 5)

        total = recent_score + trend_score + revenue_score + visit_score + specialty_bonus
        total = min(round(total, 1), 100)

        tier = (
            "PLATINUM" if total >= 75
            else "GOLD" if total >= 50
            else "SILVER" if total >= 25
            else "BRONZE"
        )

        visit_priority = (
            "VISIT THIS WEEK"
            if (days_since_last_visit or 999) > 30 and total >= 50
            else "SCHEDULED" if (days_since_last_visit or 999) <= 14
            else "MONITOR"
        )

        return {
            "score": total,
            "tier": tier,
            "visit_priority": visit_priority,
            "breakdown": {
                "recent_referrals": round(recent_score, 1),
                "referral_trend": round(trend_score, 1),
                "revenue_impact": round(revenue_score, 1),
                "visit_recency": round(visit_score, 1),
                "specialty_bonus": specialty_bonus,
            },
        }
