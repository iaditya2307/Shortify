# URL Shortener

A runnable URL shortener MVP using FastAPI, SQLAlchemy, and SQLite.

## Features

- Create a short URL
- Automatic Base62 short codes
- Optional custom aliases
- Optional expiry timestamp
- Redirect short URL to original URL
- Click counter
- URL statistics
- Soft-delete / disable a short URL
- Swagger API documentation

## Project Structure

```text
url_shortener/
├── app/
│   ├── __init__.py
│   ├── base62.py
│   ├── database.py
│   ├── main.py
│   ├── models.py
│   ├── schemas.py
│   └── service.py
├── requirements.txt
└── README.md
```

## Run locally

Create a virtual environment:

```bash
python3 -m venv .venv
source .venv/bin/activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Start the server:

```bash
uvicorn app.main:app --reload
```

Open Swagger docs:

```text
http://127.0.0.1:8000/docs
```

## Create a short URL

```bash
curl -X POST http://127.0.0.1:8000/api/v1/urls   -H "Content-Type: application/json"   -d '{
    "long_url": "https://www.google.com/search?q=fastapi"
  }'
```

Example response:

```json
{
  "short_code": "4c93",
  "short_url": "http://127.0.0.1:8000/4c93",
  "long_url": "https://www.google.com/search?q=fastapi"
}
```

## Custom alias

```bash
curl -X POST http://127.0.0.1:8000/api/v1/urls   -H "Content-Type: application/json"   -d '{
    "long_url": "https://example.com/my-long-page",
    "custom_alias": "my-page"
  }'
```

Then visit:

```text
http://127.0.0.1:8000/my-page
```

## Stats

```bash
curl http://127.0.0.1:8000/api/v1/urls/my-page
```

## Delete / Disable

```bash
curl -X DELETE http://127.0.0.1:8000/api/v1/urls/my-page
```

## Next production upgrades

For a production-grade version, replace SQLite with PostgreSQL and add:

- Redis caching
- Docker
- Nginx / reverse proxy
- Rate limiting
- Authentication
- Kafka or queue-based analytics
- DB migrations with Alembic
- PostgreSQL replicas / sharding at very high scale
- Custom domain and HTTPS
