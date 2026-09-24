# Security policy

Do not submit real contracts, personal data, or API keys in a public issue. Report a vulnerability privately to the repository owner through their GitHub profile.

## Supported version

This hackathon repository supports the latest commit on `main`.

## Data handling summary

NegoBrief does not intentionally persist uploaded documents. A live request validates the PDF, uploads it temporarily to Gemini, validates the structured response, and attempts remote deletion in a `finally` block. The original PDF remains in browser memory only for the active page session.

Environment files are ignored by Git. `GEMINI_API_KEY` must remain a server-only environment variable and must never use a `NEXT_PUBLIC_` prefix.
