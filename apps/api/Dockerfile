FROM python:3.11-slim

WORKDIR /app

# Install postgres client dependencies
RUN apt-get update && apt-get install -y libpq-dev gcc

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy all source code
COPY . .

EXPOSE 8000

# Run uvicorn without --reload for production
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
