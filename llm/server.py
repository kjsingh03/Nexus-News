from flask import Flask, request, jsonify, make_response
import requests
import os
from dotenv import load_dotenv
import logging
import uuid
import re
from datetime import datetime
import json

app = Flask(__name__)

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent"

# Directory to store temporary uploaded files
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Current date for comparison
CURRENT_DATE = datetime.now()


def save_uploaded_file(file):
    """Save an uploaded file and return its path"""
    if not file or not file.filename:
        return None

    file_path = os.path.join(UPLOAD_DIR, f"{uuid.uuid4()}_{file.filename}")
    file.save(file_path)
    return file_path


def extract_date(text, patterns=None):
    """Extract date from text using multiple patterns"""
    if not text:
        return None

    patterns = patterns or [
        r"\d{1,2} [a-zA-Z]+ \d{4}",  # 25 December 2024
        r"[A-Za-z]+ \d{1,2}, \d{4}",  # December 25, 2024
        r"\d{4}-\d{2}-\d{2}",  # 2024-12-25
    ]

    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            date_str = match.group()
            try:
                # Try different date formats
                for fmt in ["%d %B %Y", "%b %d, %Y", "%Y-%m-%d"]:
                    try:
                        return datetime.strptime(date_str, fmt)
                    except ValueError:
                        continue
            except Exception as e:
                logger.warning(f"Could not parse date '{date_str}': {e}")

    return None


def query_gemini(title, description, thumbnail_filename, files):
    """Query Gemini API with optimized news-aware prompt"""
    prompt = f"""
    # News Article Credibility Analysis

    ## Article Information
    - **Title:** {title}
    - **Description:** {description}
    - **Thumbnail Filename:** {thumbnail_filename}
    - **Additional Files:** {', '.join(files) if files else 'None'}

    ## Analysis Request
    As an experienced news media analyst, evaluate the credibility of this news article, recognizing that legitimate reporting may cover serious topics (e.g., violence, disasters). Provide a concise, structured analysis addressing:

    1. **Journalistic Standards**:
       - Assess attribution (e.g., named sources), specificity (e.g., dates, locations), balance (e.g., multiple perspectives), and structure (e.g., inverted pyramid).
       - Check if facts are separated from opinions.

    2. **Context and Balance**:
       - Evaluate if serious content is contextualized appropriately.
       - Assess if emotional language is justified.
       - Check for multiple perspectives and headline accuracy.

    3. **Verification Indicators**:
       - Identify credible elements (e.g., official statements, verifiable facts).
       - Note specific details or expert quotes that enhance credibility.

    4. **Credibility Concerns**:
       - Flag contradictions with established facts or logical inconsistencies.
       - Identify manipulation signs (e.g., sensationalism, misleading files).
       - Highlight unverified extraordinary claims.

    5. **Credibility Score**:
       - Assign a score (0-100, starting at 50) based on:
         - **Source Reliability**: Named, official sources (+), vague/anonymous sources (-).
         - **Evidence Consistency**: Alignment between title, description, and files (+), discrepancies (-).
         - **Fact Verification**: Alignment with known facts (+), contradictions (-).
         - **Misinformation Signals**: Clickbait, profanity, or sensationalism (-).
         - **File Authenticity**: Relevance and integrity of files (+), suspicious names or context (-).
       - Provide reasoning for score adjustments (e.g., "+10 for named source", "-15 for clickbait").
       - Limit for calculating credibility must be max 10-15 and
       - Return in JSON:
         ```json
         {{
           "score": <integer>,
           "reasoning": ["<reason> (+/-<points>)", ...]
         }}
         ```

    6. **Categorization**:
       - Assign one category, one sub-category, and multiple labels in JSON:
         ```json
         {{
           "category": "<Emergency|Solution|Sensitive>",
           "sub_category": "<Verified|Potential Flagged|Trending>",
           "labels": ["<label>", ...]
         }}
         ```
       - **Category**:
         - Emergency: Disasters, accidents, urgent safety issues.
         - Solution: Innovations, positive developments.
         - Sensitive: Conflicts, violence, health crises, controversies.
       - **Sub-Category**:
         - Verified: Backed by credible sources.
         - Potential Flagged: Some credible elements, needs verification.
         - Trending: High attention, lacks verification.
       - **Labels** (select relevant):
         - Education, Scam, News, Opinion, Conspiracy, Violence, Pocso, Misinformation, Health, Politics, etc.

    7. **Determination**:
       - State: Likely credible, needs verification, or likely false.
       - Summarize key evidence.
       - Note limitations (e.g., unverified files).

    ## Response Format
    Return the analysis as text with JSON blocks for Credibility Score and Categorization, each in triple backticks. Ensure JSON is valid, non-empty, and follows the exact structure above. Example:
    ```
    [Analysis...]
    ### Credibility Score
    ```json
    {{
      "score": 70,
      "reasoning": ["Named official source (+15)", "Vague details (-5)"]
    }}
    ```
    ### Categorization
    ```json
    {{
      "category": "Emergency",
      "sub_category": "Potential Flagged",
      "labels": ["Violence", "Education"]
    }}
    ```
    [Determination...]
    ```

    Focus on analyzing all proofs (sources, files, context) meticulously to ensure an accurate score and categorization. Avoid empty or malformed JSON.
    """

    headers = {"Content-Type": "application/json"}
    payload = {"contents": [{"parts": [{"text": prompt}]}]}

    try:
        response = requests.post(
            f"{GEMINI_API_URL}?key={GEMINI_API_KEY}", headers=headers, json=payload
        )
        response.raise_for_status()

        gemini_data = response.json()
        insights = (
            gemini_data.get("candidates", [{}])[0]
            .get("content", {})
            .get("parts", [{}])[0]
            .get("text", "")
        )

        # Extract credibility score JSON
        score_match = re.search(
            r"### Credibility Score\n```json\n([\s\S]*?)\n```", insights, re.DOTALL
        )
        credibility = {
            "score": 50,
            "reasoning": ["Default score due to missing or invalid score data"],
        }
        if score_match:
            try:
                score_json = json.loads(score_match.group(1).strip())
                credibility.update(
                    {
                        "score": score_json.get("score", 50),
                        "reasoning": score_json.get(
                            "reasoning", ["No reasoning provided"]
                        ),
                    }
                )
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse credibility score JSON: {e}")

        # Extract categorization JSON
        categorization_match = re.search(
            r"### Categorization\n```json\n([\s\S]*?)\n```", insights, re.DOTALL
        )
        categorization = {
            "category": "Unknown",
            "sub_category": "Unknown",
            "labels": [],
        }
        if categorization_match:
            try:
                categorization_json = json.loads(categorization_match.group(1).strip())
                categorization.update(
                    {
                        "category": categorization_json.get("category", "Unknown"),
                        "sub_category": categorization_json.get(
                            "sub_category", "Unknown"
                        ),
                        "labels": categorization_json.get("labels", []),
                    }
                )
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse categorization JSON: {e}")

        return insights, categorization, credibility

    except Exception as e:
        logger.error(f"Gemini API error: {str(e)}")
        raise Exception(f"Failed to get insights from Gemini API: {str(e)}")


@app.route("/news/insights", methods=["POST"])
def get_news_insights():
    created_files = []

    try:
        # Extract form data
        title = request.form.get("title", "").strip()
        description = request.form.get("description", "").strip()

        # Validate required fields
        if not title or not description:
            return make_response(
                jsonify(
                    {
                        "status": "false",
                        "error": "Missing required fields: title and description",
                    }
                ),
                400,
            )

        # Process thumbnail
        thumbnail_filename = "None"
        if "thumbnail" in request.files:
            thumbnail_file = request.files["thumbnail"]
            if thumbnail_file.filename:
                thumbnail_filename = thumbnail_file.filename
                created_files.append(save_uploaded_file(thumbnail_file))

        files = []
        if "files" in request.files:
            file_list = request.files.getlist("files")
            for file in file_list:
                if file and file.filename:
                    files.append(file.filename)
                    created_files.append(save_uploaded_file(file))

        insights, categorization, credibility = query_gemini(title, description, thumbnail_filename, files)

        print(title, description, thumbnail_filename, files)

        response_data = {
            "status": "success",
            "insights": insights,
            "score": credibility["score"],
            "score_reasoning": credibility["reasoning"],
            "category": categorization["category"],
            "sub_category": categorization["sub_category"],
            "labels": categorization["labels"],
        }

        return make_response(jsonify(response_data), 200)

    except Exception as e:
        logger.error(f"Error processing request: {str(e)}")
        return make_response(jsonify({"error": str(e)}), 500)

    finally:
        for file_path in created_files:
            try:
                if file_path and os.path.isfile(file_path):
                    os.unlink(file_path)
            except Exception as e:
                logger.error(f"Error deleting file {file_path}: {e}")


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
