import json
from pathlib import Path
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from collections import Counter
import numpy as np


class SymptomTestMapper:
    """
    Maps symptoms/queries to recommended lab tests.
    Uses TF-IDF similarity for fuzzy matching + exact keyword lookup.
    No GPU required. Works entirely on CPU.
    """

    def __init__(self):
        mapping_path = Path(__file__).parent.parent / "data" / "symptom_test_mapping.json"
        with open(mapping_path) as f:
            self.data = json.load(f)

        self.symptom_keys = (
            list(self.data["symptoms"].keys()) +
            list(self.data["conditions"].keys())
        )
        self.all_tests = {
            key: tests
            for mapping in [self.data["symptoms"], self.data["conditions"]]
            for key, tests in mapping.items()
        }

        descriptions = [key.replace("_", " ") for key in self.symptom_keys]
        self.vectorizer = TfidfVectorizer(ngram_range=(1, 2))
        self.tfidf_matrix = self.vectorizer.fit_transform(descriptions)

    def suggest(self, query: str, top_k: int = 8) -> dict:
        query_lower = query.lower().replace("-", " ")

        # 1. Exact keyword match
        exact_matches = []
        for key in self.symptom_keys:
            if key.replace("_", " ") in query_lower or query_lower in key.replace("_", " "):
                exact_matches.extend(self.all_tests[key])

        # 2. TF-IDF similarity
        query_vec = self.vectorizer.transform([query_lower])
        similarities = cosine_similarity(query_vec, self.tfidf_matrix)[0]
        top_indices = np.argsort(similarities)[::-1][:3]

        fuzzy_matches = []
        matched_symptoms = []
        for idx in top_indices:
            if similarities[idx] > 0.1:
                key = self.symptom_keys[idx]
                matched_symptoms.append({
                    "symptom": key.replace("_", " "),
                    "score": float(similarities[idx]),
                })
                fuzzy_matches.extend(self.all_tests[key])

        all_suggestions = exact_matches + fuzzy_matches

        if not all_suggestions:
            return {
                "query": query,
                "suggestions": [],
                "matched_symptoms": [],
                "confidence": 0.0,
            }

        ranked = Counter(all_suggestions).most_common(top_k)
        confidence = float(min(similarities[top_indices[0]], 1.0)) if len(top_indices) > 0 else 0.0

        return {
            "query": query,
            "suggestions": [
                {"test_name": test, "relevance_score": round(min(count / 3.0, 1.0), 2)}
                for test, count in ranked
            ],
            "matched_symptoms": matched_symptoms[:3],
            "confidence": round(confidence, 2),
        }
