"""
Similarity detection for news deduplication.
Detects duplicate news content from different sources using multiple similarity metrics.
"""

import logging
import re
from typing import Dict, List, Tuple
from difflib import SequenceMatcher

logger = logging.getLogger(__name__)

def calculate_headline_similarity(headline1: str, headline2: str) -> float:
    """
    Calculate similarity between two headlines using sequence matching.
    Returns a score between 0.0 and 1.0.
    """
    if not headline1 or not headline2:
        return 0.0
    
    # Normalize: lowercase and remove extra spaces
    h1 = " ".join(headline1.lower().split())
    h2 = " ".join(headline2.lower().split())
    
    # Use SequenceMatcher for similarity
    return SequenceMatcher(None, h1, h2).ratio()


def calculate_content_similarity(summary1: str, summary2: str) -> float:
    """
    Calculate similarity between two content summaries using word overlap.
    Returns a score between 0.0 and 1.0.
    """
    if not summary1 or not summary2:
        return 0.0
    
    # Tokenize into words
    words1 = set(summary1.lower().split())
    words2 = set(summary2.lower().split())
    
    # Remove common stop words
    stop_words = {'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been', 'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'may', 'might', 'must', 'can'}
    words1 = words1 - stop_words
    words2 = words2 - stop_words
    
    if not words1 or not words2:
        return 0.0
    
    # Calculate Jaccard similarity
    intersection = len(words1 & words2)
    union = len(words1 | words2)
    
    return intersection / union if union > 0 else 0.0


def extract_numbers(text: str) -> set:
    """Extract all numbers from text for entity matching."""
    if not text:
        return set()
    
    # Find all numbers (including decimals and commas)
    numbers = re.findall(r'[\d,]+\.?\d*', text)
    # Normalize: remove commas
    return {n.replace(',', '') for n in numbers}


def calculate_entity_similarity(news1: Dict, news2: Dict) -> float:
    """
    Calculate similarity based on entities (company names, numbers, tickers).
    Returns a score between 0.0 and 1.0.
    """
    score = 0.0
    checks = 0
    
    # Check company name
    if news1.get('company_name') and news2.get('company_name'):
        checks += 1
        if news1['company_name'].lower() == news2['company_name'].lower():
            score += 1.0
    
    # Check ticker
    if news1.get('ticker') and news2.get('ticker'):
        checks += 1
        if news1['ticker'].upper() == news2['ticker'].upper():
            score += 1.0
    
    # Check numbers in headline and summary
    text1 = f"{news1.get('headline', '')} {news1.get('summary', '')}"
    text2 = f"{news2.get('headline', '')} {news2.get('summary', '')}"
    
    numbers1 = extract_numbers(text1)
    numbers2 = extract_numbers(text2)
    
    if numbers1 and numbers2:
        checks += 1
        # If they share significant numbers, likely same story
        common_numbers = numbers1 & numbers2
        if common_numbers:
            overlap_ratio = len(common_numbers) / max(len(numbers1), len(numbers2))
            score += overlap_ratio
    
    return score / checks if checks > 0 else 0.0


def calculate_combined_similarity(news1: Dict, news2: Dict) -> Tuple[float, Dict[str, float]]:
    """
    Calculate combined similarity score using multiple metrics.
    
    Returns:
        Tuple of (combined_score, individual_scores_dict)
    """
    # Calculate individual scores
    headline_sim = calculate_headline_similarity(
        news1.get('headline', ''),
        news2.get('headline', '')
    )
    
    content_sim = calculate_content_similarity(
        news1.get('summary', ''),
        news2.get('summary', '')
    )
    
    entity_sim = calculate_entity_similarity(news1, news2)
    
    # Weighted combination
    # Headline: 40%, Content: 40%, Entities: 20%
    combined = (headline_sim * 0.4) + (content_sim * 0.4) + (entity_sim * 0.2)
    
    scores = {
        'headline': headline_sim,
        'content': content_sim,
        'entity': entity_sim,
        'combined': combined
    }
    
    logger.debug(f"Similarity scores: {scores}")
    
    return combined, scores


def is_duplicate(news1: Dict, news2: Dict, threshold: float = 0.60) -> Tuple[bool, float]:
    """
    Determine if two news items are duplicates.
    
    Args:
        news1: First news item dict
        news2: Second news item dict
        threshold: Similarity threshold (default 0.80 = 80%)
    
    Returns:
        Tuple of (is_duplicate, similarity_score)
    """
    combined_score, _ = calculate_combined_similarity(news1, news2)
    
    return combined_score >= threshold, combined_score
