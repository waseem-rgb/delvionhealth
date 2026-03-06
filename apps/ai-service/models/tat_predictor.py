from typing import List, Optional
from datetime import datetime, timedelta


class TATPredictor:
    """
    Predicts TAT (turnaround time) for orders based on test types,
    priority, time of day, and current lab load.
    """

    PRIORITY_MULTIPLIERS = {
        "STAT": 0.5,
        "URGENT": 0.7,
        "ROUTINE": 1.0,
    }

    def _time_of_day_factor(self, hour: int) -> float:
        if 6 <= hour <= 10:
            return 0.9
        elif 10 <= hour <= 14:
            return 1.0
        elif 14 <= hour <= 18:
            return 1.1
        else:
            return 1.3

    def predict(
        self,
        test_turnaround_hours: List[int],
        priority: str,
        collection_time: Optional[datetime] = None,
        pending_orders_count: int = 0,
    ) -> dict:
        if not test_turnaround_hours:
            return {"error": "No tests provided"}

        base_hours = max(test_turnaround_hours)
        priority_multiplier = self.PRIORITY_MULTIPLIERS.get(priority, 1.0)
        collection_dt = collection_time or datetime.now()
        time_factor = self._time_of_day_factor(collection_dt.hour)
        load_factor = 1.0 + max(0, (pending_orders_count - 20) * 0.02)

        predicted_hours = base_hours * priority_multiplier * time_factor * load_factor
        predicted_hours = round(predicted_hours, 1)

        expected_at = collection_dt + timedelta(hours=predicted_hours)
        confidence = 0.85 if len(test_turnaround_hours) <= 3 else 0.75

        today = datetime.now().date()
        date_str = "today" if expected_at.date() == today else expected_at.strftime("%d %b")

        return {
            "predicted_hours": predicted_hours,
            "expected_at": expected_at.isoformat(),
            "expected_at_display": expected_at.strftime("%I:%M %p"),
            "base_hours": base_hours,
            "priority_multiplier": priority_multiplier,
            "confidence": confidence,
            "message": f"Expected by {expected_at.strftime('%I:%M %p')} ({date_str})",
        }
