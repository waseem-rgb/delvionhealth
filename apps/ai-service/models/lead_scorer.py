from typing import Optional


class LeadScorer:
    """
    Scores leads 0-100 based on behavioral and demographic signals.
    Rule-based + weighted scoring. Explainable (returns score breakdown).
    """

    WEIGHTS = {
        "source": 20,
        "engagement": 25,
        "value": 20,
        "recency": 20,
        "completeness": 15,
    }

    SOURCE_SCORES = {
        "HOSPITAL": 1.0,
        "REFERRAL": 0.9,
        "FIELD_REP": 0.8,
        "CALL_CENTER": 0.6,
        "WEBSITE": 0.5,
        "WHATSAPP": 0.4,
        "CAMPAIGN": 0.3,
        "OTHER": 0.2,
    }

    def score(
        self,
        source: str,
        note_count: int,
        days_since_created: int,
        days_since_last_activity: int,
        expected_value: Optional[float],
        has_email: bool,
        has_organization: bool,
        status: str,
    ) -> dict:
        scores = {}

        scores["source"] = self.SOURCE_SCORES.get(source, 0.3) * self.WEIGHTS["source"]

        engagement = min(note_count / 5.0, 1.0)
        scores["engagement"] = engagement * self.WEIGHTS["engagement"]

        if expected_value and expected_value > 0:
            value_score = min(expected_value / 500000, 1.0)
        else:
            value_score = 0.1
        scores["value"] = value_score * self.WEIGHTS["value"]

        if days_since_last_activity <= 1:
            recency = 1.0
        elif days_since_last_activity <= 7:
            recency = 0.8
        elif days_since_last_activity <= 14:
            recency = 0.6
        elif days_since_last_activity <= 30:
            recency = 0.4
        else:
            recency = max(0.1, 1 - (days_since_last_activity / 90))
        scores["recency"] = recency * self.WEIGHTS["recency"]

        completeness_fields = [has_email, has_organization, expected_value is not None]
        completeness = sum(completeness_fields) / len(completeness_fields)
        scores["completeness"] = completeness * self.WEIGHTS["completeness"]

        total = sum(scores.values())
        grade = "HOT" if total >= 70 else "WARM" if total >= 45 else "COLD"

        return {
            "score": round(total, 1),
            "grade": grade,
            "breakdown": {k: round(v, 1) for k, v in scores.items()},
            "recommendation": self._get_recommendation(grade, days_since_last_activity),
        }

    def _get_recommendation(self, grade: str, days_inactive: int) -> str:
        if grade == "HOT":
            return "Priority follow-up — schedule demo or site visit this week"
        elif grade == "WARM":
            if days_inactive > 7:
                return "Re-engage with personalized outreach — share case study"
            return "Nurture with product info — propose a call"
        else:
            return "Low priority — add to drip campaign, review in 30 days"
