"""Single-process production entry point: python -m backend.serve."""
import os


def main():
    import uvicorn

    port = int(os.environ.get("PORT", "10000"))
    if not 1 <= port <= 65535:
        raise ValueError("PORT must be between 1 and 65535")
    uvicorn.run("backend.app:app", host="0.0.0.0", port=port, workers=1)


if __name__ == "__main__":
    main()
