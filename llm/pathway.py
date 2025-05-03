import os
import pathway as pw
from pathway.xpacks.llm import llms, embedders, splitters, document_store, question_answering
from pathway.stdlib.indexing import BruteForceKnnFactory
import litellm
import json
import re
import requests
from typing import List, Tuple, Dict, Any

# Define custom parser UDF
@pw.udf
def custom_parser_udf(data: bytes) -> List[Tuple[str, Dict]]:
    try:
        article = json.loads(data.decode('utf-8'))
        title = article.get('title', '')
        description = article.get('description', '')
        files = article.get('files', [])  # List of IPFS CIDs
        thumbnail = article.get('thumbnail', 'None')  # IPFS CID or 'None'

        # Fetch file metadata via IPFS public gateway
        def get_ipfs_metadata(cid: str) -> str:
            try:
                # Use ipfs.io public gateway to fetch stat
                url = f"https://ipfs.io/api/v0/stat?arg={cid}"
                response = requests.get(url, timeout=5)
                response.raise_for_status()
                stat = response.json()
                return f"Type: {stat.get('Type', 'unknown')}, Size: {stat.get('CumulativeSize', 0)} bytes"
            except Exception as e:
                return f"Error fetching CID {cid}: {str(e)}"

        # Construct file metadata for prompt
        file_metadata = []
        for cid in files:
            metadata = get_ipfs_metadata(cid) if cid else "None"
            file_metadata.append(f"CID: {cid}, Metadata: {metadata}")
        thumbnail_metadata = get_ipfs_metadata(thumbnail) if thumbnail != 'None' else "None"

        # Credibility analysis prompt
        prompt = f"""
        # News Article Credibility Analysis

        ## Article Information
        - **Title:** {title}
        - **Description:** {description}
        - **Thumbnail CID:** {thumbnail} (Metadata: {thumbnail_metadata})
        - **Additional Files:** {', '.join(file_metadata) if file_metadata else 'None'}

        ## Analysis Request
        As an experienced news media analyst, evaluate the credibility of this news article. Provide a structured analysis addressing:
        1. **Journalistic Standards**: Assess attribution, specificity, balance, and structure.
        2. **Context and Balance**: Evaluate contextualization, emotional language, and headline accuracy.
        3. **Verification Indicators**: Identify credible elements (e.g., official statements).
        4. **Credibility Concerns**: Flag contradictions, sensationalism, or unverified claims.
        5. **Credibility Score**: Assign a score (0-100, starting at 50) with reasoning.
        6. **Categorization**: Assign category (Emergency, Solution, Sensitive), sub-category (Verified, Potential Flagged, Trending), and labels (e.g., News, Politics).

        ## Response Format
        Return the analysis with JSON blocks for Credibility Score and Categorization:
        ```
        ### Credibility Score
        ```json
        {{"score": <integer>, "reasoning": ["<reason> (+/-<points>)", ...]}}
        ```
        ### Categorization
        ```json
        {{"category": "<category>", "sub_category": "<sub_category>", "labels": ["<label>", ...]}}
        ```
        """

        # Call Gemini API via LiteLLM
        try:
            response = litellm.completion(
                model="gemini/gemini-1.5-pro",
                messages=[{"role": "user", "content": prompt}],
                temperature=0,
                api_key=os.environ["GEMINI_API_KEY"],
            )
            response_text = response.choices[0].message.content

            # Extract credibility score
            score_match = re.search(r'### Credibility Score\n```json\n([\s\S]*?)\n```', response_text, re.DOTALL)
            score = 50
            reasoning = ["Default score due to missing or invalid score data"]
            if score_match:
                score_json = json.loads(score_match.group(1).strip())
                score = score_json.get("score", 50)
                reasoning = score_json.get("reasoning", ["No reasoning provided"])

            # Extract categorization
            categorization_match = re.search(r'### Categorization\n```json\n([\s\S]*?)\n```', response_text, re.DOTALL)
            category = "Unknown"
            sub_category = "Unknown"
            labels = []
            if categorization_match:
                categorization_json = json.loads(categorization_match.group(1).strip())
                category = categorization_json.get("category", "Unknown")
                sub_category = categorization_json.get("sub_category", "Unknown")
                labels = categorization_json.get("labels", [])

        except Exception as e:
            score = 50
            reasoning = ["Error in Gemini API: " + str(e)]
            category = "Unknown"
            sub_category = "Unknown"
            labels = ["Error: " + str(e)]

        # Prepare text and metadata for indexing
        text = f"{title} {description}"
        metadata = {
            "title": title,
            "description": description,
            "files": files,
            "thumbnail": thumbnail,
            "credibility_score": score,
            "reasoning": reasoning,
            "category": category,
            "sub_category": sub_category,
            "labels": labels,
        }
        return [(text, metadata)]
    except Exception as e:
        return [(f"Error parsing article: {str(e)}", {"error": str(e)})]

# Set up data sources
sources = [pw.io.fs.read(path="news_articles/", format="raw", with_metadata=True)]

# Set up LLM and embedder
llm = llms.LiteLLMChat(model="gemini/gemini-1.5-pro", api_key=os.environ["GEMINI_API_KEY"])
embedder = embedders.LiteLLMEmbedder(model="gemini/gemini-1.5-pro", api_key=os.environ["GEMINI_API_KEY"])

# Set up splitter and retriever
splitter = splitters.TokenCountSplitter(max_tokens=400)
retriever_factory = BruteForceKnnFactory(
    reserved_space=1000,
    embedder=embedder,
    metric=pw.stdlib.indexing.BruteForceKnnMetricKind.COS,
    dimensions=768  # Adjust based on Gemini embedding size
)

# Set up document store
document_store = document_store.DocumentStore(
    docs=sources,
    parser=custom_parser_udf,
    splitter=splitter,
    retriever_factory=retriever_factory
)

# Set up question answerer
question_answerer = question_answering.BaseRAGQuestionAnswerer(llm=llm, indexer=document_store)

# Start the web server
from pathway.xpacks.llm.servers import QASummaryRestServer

server = QASummaryRestServer(question_answerer=question_answerer)
server.run_server(host="0.0.0.0", port=8000)