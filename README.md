
# Dark Web Ingestion Module for SamGPT

This project includes a Python module for ingesting dark web content using TorPy and storing it in a Chroma vector database for retrieval.

## Features

- Connects to the Tor network using TorPy
- Fetches content from .onion URLs
- Processes and chunks the text
- Embeds the chunks using SentenceTransformer
- Stores the embeddings in a local Chroma database
- Prevents re-ingestion of already processed URLs
- Handles errors gracefully

## Requirements

The module requires Python 3.7+ and the following packages:
- torpy
- beautifulsoup4
- chromadb
- sentence-transformers

These will be automatically installed if not present when the script is run.

## Usage

### Command Line

```bash
# Ingest URLs directly
python src/utils/dark_web_ingestion.py --url "example.onion" --url "another.onion"

# Ingest URLs from a file (JSON or text)
python src/utils/dark_web_ingestion.py --file urls.json
```

### In Python Code

```python
from src.utils.dark_web_ingestion import DarkWebIngestion, main

# Option 1: Use the main function
main(urls=["example.onion", "another.onion"])

# Option 2: Use the DarkWebIngestion class directly
ingestion = DarkWebIngestion()
stats = ingestion.ingest_onion(["example.onion", "another.onion"])
print(f"Ingested {stats['chunks_ingested']} chunks from {stats['urls_processed']} URLs")
```

### From TypeScript/JavaScript

The project includes TypeScript connectors in `src/utils/dark_web_connector.ts` that provide a simulation of how the Python module would be called from a JavaScript/TypeScript application.

In a production environment, these functions would use Node.js's `child_process` module to execute the Python script.

## Storage

The ingested content is stored in a Chroma vector database in the `src/utils/chroma_db` directory. This location can be customized by modifying the `PERSISTENCE_DIR` constant in the script.

## Important Notes

1. This module is designed for educational and research purposes only.
2. Accessing certain content on the dark web may be illegal in some jurisdictions.
3. Always ensure you comply with all applicable laws and regulations.
4. The module does not include any filtering for illegal or harmful content.
